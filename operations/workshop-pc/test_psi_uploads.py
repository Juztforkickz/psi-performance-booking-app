import io
import json
import os
from pathlib import Path
import tempfile
import time
import unittest
from PIL import Image
from psi_uploads import (
    Connection, RequestFailure, SessionStore, create_job_folder, create_manual_job,
    ensure_object, import_manifest_inbox, manifest_for, prepare_file, process_job,
    sync_job_folders,
)


class WorkshopImporterTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.folder = Path(self.temp.name)
        self.manifest = {
            'schema': 1, 'project_ref': 'test',
            'job_id': 'a4300000-0000-4000-8000-000000000001',
            'customer_id': 'a4100000-0000-4000-8000-000000000001',
            'vehicle_id': 'a4200000-0000-4000-8000-000000000001',
            'registration': 'ABC123', 'reference': 'PSI-TEST', 'job_date': '2026-09-08',
        }
        (self.folder / 'psi-job.json').write_text(json.dumps(self.manifest))

    def tearDown(self):
        self.temp.cleanup()

    def image(self, category='before'):
        folder = self.folder / category
        folder.mkdir(exist_ok=True)
        path = folder / 'car.jpg'
        exif = Image.Exif()
        exif[270] = 'Private camera metadata'
        Image.new('RGB', (2400, 3600), 'silver').save(path, exif=exif)
        os.utime(path, (time.time() - 10, time.time() - 10))
        return path

    def test_compression_is_bounded_strips_metadata_and_keeps_original(self):
        path = self.image()
        original = path.read_bytes()
        prepared, thumbnail, mime = prepare_file(path)
        self.assertEqual(mime, 'image/jpeg')
        with Image.open(io.BytesIO(prepared)) as image:
            self.assertEqual(image.size, (1067, 1600))
            self.assertFalse(image.getexif())
        with Image.open(io.BytesIO(thumbnail)) as image:
            self.assertLessEqual(max(image.size), 360)
        self.assertEqual(path.read_bytes(), original)

    def test_pdf_preserved_and_disguised_file_rejected(self):
        path = self.folder / 'dyno.pdf'
        pdf = b'%PDF-1.7\nTest fixture\n%%EOF'
        path.write_bytes(pdf)
        self.assertEqual(prepare_file(path), (pdf, None, 'application/pdf'))
        path.write_bytes(b'<html>not a PDF</html>')
        with self.assertRaises(ValueError):
            prepare_file(path)

    def test_prepare_only_is_repeatable_without_upload(self):
        self.image()
        first = process_job(self.folder)
        second = process_job(self.folder)
        self.assertEqual(first, second)
        self.assertEqual(next(iter(second.values()))['status'], 'prepared')
        self.assertEqual(len(list((self.folder / '.psi-prepared' / 'before').glob('*.jpg'))), 2)

    def test_dyno_image_requires_review(self):
        self.image('dyno')
        result = process_job(self.folder)
        self.assertEqual(next(iter(result.values()))['status'], 'needs_review')
        self.assertFalse((self.folder / '.psi-prepared').exists())

    def test_in_progress_transfer_is_skipped(self):
        path = self.image()
        os.utime(path, None)
        self.assertEqual(process_job(self.folder), {})

    def test_names_cannot_replace_manifest(self):
        (self.folder / 'psi-job.json').unlink()
        with self.assertRaises(FileNotFoundError):
            process_job(self.folder)

    def test_downloaded_manifest_creates_verified_category_folders(self):
        source = self.folder / 'downloaded.json'
        source.write_text(json.dumps(self.manifest))
        root = self.folder / 'uploads'
        job = create_job_folder(root, source)
        self.assertEqual(job.name, 'PSI-TEST-ABC123')
        self.assertEqual(json.loads((job / 'psi-job.json').read_text()), self.manifest)
        self.assertEqual(set(path.name for path in job.iterdir() if path.is_dir()), set(('before', 'progress', 'after', 'dyno', 'invoices', 'documents')))
        self.assertEqual(create_job_folder(root, source), job)

    def test_manifest_cannot_replace_another_job_folder(self):
        source = self.folder / 'downloaded.json'
        source.write_text(json.dumps(self.manifest))
        root = self.folder / 'uploads'
        job = create_job_folder(root, source)
        changed = {**self.manifest, 'job_id': 'a4300000-0000-4000-8000-000000000009'}
        source.write_text(json.dumps(changed))
        with self.assertRaisesRegex(ValueError, 'different PSI job'):
            create_job_folder(root, source)

    def test_mismatched_server_owner_environment_and_date_rejected(self):
        manifest = self.manifest
        class FakeConnection:
            url = 'https://test.supabase.co'
            def call(self, path):
                return [{**manifest, 'customer_id': 'a4100000-0000-4000-8000-000000000002'}]
        with self.assertRaisesRegex(ValueError, 'does not match'):
            manifest_for(self.folder, FakeConnection())
        FakeConnection.url = 'https://another.supabase.co'
        with self.assertRaisesRegex(ValueError, 'different PSI environment'):
            manifest_for(self.folder, FakeConnection())
        FakeConnection.url = 'https://test.supabase.co'
        FakeConnection.call = lambda self, path: [{**manifest, 'job_date': '2026-09-09'}]
        with self.assertRaisesRegex(ValueError, 'does not match'):
            manifest_for(self.folder, FakeConnection())

    def test_service_keys_and_non_supabase_destination_rejected(self):
        with self.assertRaises(ValueError):
            Connection('https://test.supabase.co', 'sb_secret_never-store-this')
        with self.assertRaises(ValueError):
            Connection('https://example.com', 'sb_publishable_test')
        with self.assertRaises(ValueError):
            Connection('http://test.supabase.co', 'sb_publishable_test')

    def test_interrupted_upload_only_resumes_identical_or_missing_objects(self):
        class FakeStorage:
            def __init__(self, existing=None, status=404):
                self.existing, self.status, self.uploads = existing, status, []
            def call(self, path, method='GET', **kwargs):
                if method == 'POST':
                    self.uploads.append(kwargs['binary'])
                    return
                if self.existing is None:
                    raise RequestFailure(self.status)
                return self.existing
        same = FakeStorage(b'photo')
        ensure_object(same, 'verified/path', b'photo', 'image/jpeg')
        self.assertEqual(same.uploads, [])
        missing = FakeStorage()
        ensure_object(missing, 'verified/path', b'photo', 'image/jpeg')
        self.assertEqual(missing.uploads, [b'photo'])
        wrong = FakeStorage(b'another car')
        with self.assertRaisesRegex(ValueError, 'different contents'):
            ensure_object(wrong, 'verified/path', b'photo', 'image/jpeg')
        self.assertEqual(wrong.uploads, [])
        denied = FakeStorage(status=403)
        with self.assertRaises(RequestFailure):
            ensure_object(denied, 'verified/path', b'photo', 'image/jpeg')
        self.assertEqual(denied.uploads, [])

    @unittest.skipUnless(os.name == 'nt', 'Windows DPAPI is required')
    def test_remembered_session_is_encrypted_and_round_trips_for_windows_user(self):
        path = self.folder / 'session.dpapi'
        store = SessionStore(path)
        store.save('refresh-token-test-value')
        self.assertNotIn(b'refresh-token-test-value', path.read_bytes())
        self.assertEqual(store.load(), 'refresh-token-test-value')
        store.clear()
        self.assertFalse(path.exists())

    def test_recent_server_jobs_create_idempotent_verified_folders(self):
        job = {
            'id': self.manifest['job_id'], 'customer_id': self.manifest['customer_id'],
            'vehicle_id': self.manifest['vehicle_id'], 'reference': self.manifest['reference'],
            'title': 'Service', 'job_date': self.manifest['job_date'],
        }
        class FakeConnection:
            url = 'https://test.supabase.co'
            def call(inner, path, *args, **kwargs):
                if path.startswith('/rest/v1/workshop_jobs'):
                    return [job]
                return [{'id': self.manifest['vehicle_id'], 'customer_id': self.manifest['customer_id'],
                         'registration': self.manifest['registration'], 'archived_at': None}]
        root = self.folder / 'uploads'
        root.mkdir()
        first, errors = sync_job_folders(root, FakeConnection())
        second, repeated_errors = sync_job_folders(root, FakeConnection())
        self.assertEqual(errors + repeated_errors, [])
        self.assertEqual(first, second)
        self.assertTrue((first[0] / 'dyno').is_dir())

    def test_phone_job_uses_existing_vehicle_and_staff_identity(self):
        class FakeConnection:
            url = 'https://test.supabase.co'
            user_id = 'a4000000-0000-4000-8000-000000000001'
            posted = None
            verified_jobs = {}
            def call(inner, path, method='GET', data=None, **kwargs):
                if path.startswith('/rest/v1/customer_vehicles?select=id'):
                    return [{'id': self.manifest['vehicle_id'], 'customer_id': self.manifest['customer_id'],
                             'registration': 'ABC123', 'year': 2020, 'make': 'Ford', 'model': 'Mustang',
                             'archived_at': None}]
                if path.startswith('/rest/v1/customer_profiles'):
                    return [{'user_id': self.manifest['customer_id'], 'first_name': 'Test', 'last_name': 'Customer',
                             'email': 'customer@example.invalid'}]
                if method == 'POST':
                    inner.posted = data
                    return [{**data, 'id': self.manifest['job_id']}]
                return [{'id': self.manifest['vehicle_id'], 'customer_id': self.manifest['customer_id'],
                         'registration': 'ABC123', 'archived_at': None}]
        answers = iter(('abc 123', '1', '2026-09-15', 'service', 'Phone service'))
        connection = FakeConnection()
        root = self.folder / 'phone'
        folder = create_manual_job(root, connection, lambda _prompt: next(answers))
        self.assertEqual(connection.posted['created_by'], connection.user_id)
        self.assertEqual(connection.posted['title'], 'Phone service')
        self.assertTrue(connection.posted['reference'].startswith('PSI-PHONE-20260915-'))
        self.assertTrue((folder / 'psi-job.json').is_file())

    def test_manifest_inbox_ignores_unrelated_json(self):
        inbox = self.folder / 'downloads'
        inbox.mkdir()
        (inbox / 'settings.json').write_text('{"theme":"dark"}')
        root = self.folder / 'inbox-uploads'
        root.mkdir()
        self.assertEqual(import_manifest_inbox(root, inbox, object()), [])


if __name__ == '__main__':
    unittest.main()
