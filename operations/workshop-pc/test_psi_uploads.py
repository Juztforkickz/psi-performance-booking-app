import io
import json
import os
from pathlib import Path
import tempfile
import time
import unittest
from PIL import Image
from psi_uploads import Connection, RequestFailure, create_job_folder, ensure_object, manifest_for, prepare_file, process_job


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


if __name__ == '__main__':
    unittest.main()
