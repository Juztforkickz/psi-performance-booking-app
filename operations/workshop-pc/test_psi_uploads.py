import io
import hashlib
import json
import os
from datetime import date
from pathlib import Path
import tempfile
import time
import unittest
from unittest.mock import patch
from PIL import Image
from psi_uploads import (
    Connection, RequestFailure, SessionStore, _ReturnToMenu, _parse_job_date, create_job_folder, create_manual_job,
    ensure_object, folder_label_for, import_manifest_inbox, manifest_for, prepare_file, process_job,
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

    def image(self, category='photos'):
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
        self.assertEqual(len(list((self.folder / '.psi-prepared' / 'photos').glob('*.jpg'))), 2)

    def test_workshop_only_files_wait_for_an_owner_approved_account_claim(self):
        workshop_manifest = {
            'schema': 2, 'owner_type': 'workshop', 'project_ref': 'test',
            'job_id': self.manifest['job_id'],
            'workshop_contact_id': 'a4400000-0000-4000-8000-000000000001',
            'workshop_vehicle_id': 'a4500000-0000-4000-8000-000000000001',
            'registration': 'ABC123', 'reference': 'PSI-PHONE-TEST', 'job_date': '2026-09-08',
        }
        (self.folder / 'psi-job.json').write_text(json.dumps(workshop_manifest))
        self.image()
        result = process_job(self.folder)
        self.assertEqual(next(iter(result.values()))['status'], 'waiting_for_customer_account')
        self.assertTrue((self.folder / '.psi-prepared' / 'photos').is_dir())

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
        self.assertEqual(set(path.name for path in job.iterdir() if path.is_dir()), set(('photos', 'dyno', 'invoices', 'documents')))
        self.assertEqual(create_job_folder(root, source), job)

    def test_legacy_photo_folders_consolidate_without_duplicates_or_reupload(self):
        source = self.folder / 'downloaded.json'
        source.write_text(json.dumps(self.manifest))
        root = self.folder / 'uploads'
        legacy = root / 'PSI-TEST-ABC123'
        (legacy / 'before').mkdir(parents=True)
        (legacy / 'after').mkdir()
        (legacy / 'psi-job.json').write_text(json.dumps(self.manifest))
        before = legacy / 'before' / 'car.jpg'
        after = legacy / 'after' / 'car.jpg'
        before.write_bytes(b'before')
        after.write_bytes(b'after')
        digest = hashlib.sha256(before.read_bytes()).hexdigest()
        (legacy / '.psi-upload-status.json').write_text(json.dumps({
            'before\\car.jpg': {'key': f'pc:{self.manifest["job_id"]}:before:{digest}', 'status': 'uploaded'},
        }))

        job = create_job_folder(root, source)

        self.assertFalse((job / 'before').exists())
        self.assertFalse((job / 'after').exists())
        self.assertEqual((job / 'photos' / 'car.jpg').read_bytes(), b'before')
        self.assertEqual((job / 'photos' / 'after - car.jpg').read_bytes(), b'after')
        state = json.loads((job / '.psi-upload-status.json').read_text())
        self.assertEqual(state['photos\\car.jpg']['status'], 'uploaded')

    def test_verified_identity_metadata_names_and_renames_the_job_folder(self):
        source = self.folder / 'downloaded.json'
        source.write_text(json.dumps(self.manifest))
        root = self.folder / 'named-uploads'
        old_folder = create_job_folder(root, source)
        named = {
            **self.manifest,
            'customer_name': 'Tyrone Brown', 'vehicle_year': 2011,
            'vehicle_make': 'Porsche', 'vehicle_model': 'Cayenne',
        }
        source.write_text(json.dumps(named))
        renamed = create_job_folder(root, source)
        self.assertEqual(
            renamed.name,
            'TYRONE BROWN - 2011 PORSCHE CAYENNE - ABC123 - PSI-TEST',
        )
        self.assertFalse(old_folder.exists())
        self.assertEqual(json.loads((renamed / 'psi-job.json').read_text()), named)

    def test_folder_label_removes_windows_path_characters(self):
        named = {
            **self.manifest,
            'customer_name': 'Customer / Name', 'vehicle_year': 2020,
            'vehicle_make': 'Ford', 'vehicle_model': 'Ranger: Wildtrak',
        }
        label = folder_label_for(named)
        self.assertNotRegex(label, r'[<>:"/\\|?*]')
        self.assertIn('CUSTOMER - NAME', label)

    def test_manifest_cannot_replace_another_job_folder(self):
        source = self.folder / 'downloaded.json'
        source.write_text(json.dumps(self.manifest))
        root = self.folder / 'uploads'
        job = create_job_folder(root, source)
        changed = {**self.manifest, 'job_id': 'a4300000-0000-4000-8000-000000000009'}
        source.write_text(json.dumps(changed))
        with self.assertRaisesRegex(ValueError, 'different PSI job'):
            create_job_folder(root, source)

    def test_claimed_workshop_folder_upgrades_to_app_manifest(self):
        source = self.folder / 'downloaded.json'
        workshop_manifest = {
            'schema': 2, 'owner_type': 'workshop', 'project_ref': 'test',
            'job_id': self.manifest['job_id'],
            'workshop_contact_id': 'a4400000-0000-4000-8000-000000000001',
            'workshop_vehicle_id': 'a4500000-0000-4000-8000-000000000001',
            'registration': self.manifest['registration'], 'reference': self.manifest['reference'],
            'job_date': self.manifest['job_date'],
        }
        source.write_text(json.dumps(workshop_manifest))
        root = self.folder / 'claimed-uploads'
        folder = create_job_folder(root, source)
        source.write_text(json.dumps(self.manifest))
        self.assertEqual(create_job_folder(root, source), folder)
        self.assertEqual(json.loads((folder / 'psi-job.json').read_text()), self.manifest)

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

    def test_rate_limited_login_can_use_recent_unused_email_code(self):
        class FakeConnection(Connection):
            def __init__(inner):
                inner.calls = []
                inner.token = inner.refresh = ''
                inner.expires = 0
                inner.session_store = None
                inner.verified_jobs = {}
            def call(inner, path, method='GET', data=None, **kwargs):
                inner.calls.append((path, data))
                if path == '/auth/v1/otp':
                    raise RequestFailure(429)
                if path == '/auth/v1/verify':
                    return {'access_token': 'email-token', 'refresh_token': 'email-refresh'}
                if path == '/auth/v1/user':
                    return {'id': 'staff-id', 'factors': [{'id': 'factor-id', 'factor_type': 'totp', 'status': 'verified'}]}
                if path.endswith('/challenge'):
                    return {'id': 'challenge-id'}
                if path.endswith('/verify'):
                    return {'access_token': 'mfa-token', 'refresh_token': 'mfa-refresh'}
                raise AssertionError(path)
            def set_session(inner, session):
                inner.token = session['access_token']
                inner.refresh = session['refresh_token']
            def validate_staff(inner):
                inner.user_id = 'staff-id'
        connection = FakeConnection()
        with patch('psi_uploads.getpass.getpass', side_effect=('123456', '654321')) as get_code:
            connection.login('staff@example.invalid')
        verification = next(data for path, data in connection.calls if path == '/auth/v1/verify')
        self.assertEqual(verification['token'], '123456')
        self.assertEqual(connection.token, 'mfa-token')
        self.assertIn('staff@example.invalid', get_code.call_args_list[0].args[0])
        self.assertIn('typing is hidden', get_code.call_args_list[0].args[0])

    def test_rate_limited_login_without_recent_code_is_actionable(self):
        class FakeConnection(Connection):
            def call(inner, path, *args, **kwargs):
                raise RequestFailure(429)
        connection = FakeConnection('https://test.supabase.co', 'sb_publishable_test')
        with patch('psi_uploads.getpass.getpass', return_value=''):
            with self.assertRaisesRegex(RuntimeError, 'temporarily limited'):
                connection.login('staff@example.invalid')

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
                if path.startswith('/rest/v1/workshop_vehicles'):
                    return []
                if path.startswith('/rest/v1/workshop_contacts'):
                    return []
                if path.startswith('/rest/v1/customer_profiles'):
                    return [{'user_id': self.manifest['customer_id'], 'first_name': 'Test',
                             'last_name': 'Customer', 'email': 'customer@example.invalid'}]
                return [{'id': self.manifest['vehicle_id'], 'customer_id': self.manifest['customer_id'],
                         'registration': self.manifest['registration'], 'year': 2020,
                         'make': 'Ford', 'model': 'Mustang', 'archived_at': None}]
        root = self.folder / 'uploads'
        root.mkdir()
        first, errors = sync_job_folders(root, FakeConnection())
        second, repeated_errors = sync_job_folders(root, FakeConnection())
        self.assertEqual(errors + repeated_errors, [])
        self.assertEqual(first, second)
        self.assertEqual(first[0].name, 'TEST CUSTOMER - 2020 FORD MUSTANG - ABC123 - PSI-TEST')
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
                if path.startswith('/rest/v1/workshop_vehicles'):
                    return []
                if method == 'POST':
                    inner.posted = data
                    return [{**data, 'id': self.manifest['job_id']}]
                return [{'id': self.manifest['vehicle_id'], 'customer_id': self.manifest['customer_id'],
                         'registration': 'ABC123', 'archived_at': None}]
        answers = iter(('abc 123', '1', '15/09/2026', 'service', 'Phone service'))
        connection = FakeConnection()
        root = self.folder / 'phone'
        folder = create_manual_job(root, connection, lambda _prompt: next(answers))
        self.assertEqual(connection.posted['created_by'], connection.user_id)
        self.assertEqual(connection.posted['title'], 'Phone service')
        self.assertTrue(connection.posted['reference'].startswith('PSI-PHONE-20260915-'))
        self.assertTrue((folder / 'psi-job.json').is_file())
        self.assertTrue(folder.name.startswith('TEST CUSTOMER - 2020 FORD MUSTANG - ABC123 - PSI-PHONE-'))

    def test_manual_job_date_accepts_australian_iso_and_past_formats(self):
        self.assertEqual(_parse_job_date('23/09/2026'), '2026-09-23')
        self.assertEqual(_parse_job_date('23-09-2026'), '2026-09-23')
        self.assertEqual(_parse_job_date('2026-09-23'), '2026-09-23')
        self.assertEqual(_parse_job_date('', date(2026, 9, 24)), '2026-09-24')
        with self.assertRaisesRegex(ValueError, 'DD/MM/YYYY'):
            _parse_job_date('09/23/2026')

    def test_phone_job_back_revisits_previous_prompt_before_one_write(self):
        class FakeConnection:
            url = 'https://test.supabase.co'
            user_id = 'a4000000-0000-4000-8000-000000000001'
            verified_jobs = {}
            posts = []
            def call(inner, path, method='GET', data=None, **kwargs):
                if path.startswith('/rest/v1/customer_vehicles?select=id'):
                    return [{'id': self.manifest['vehicle_id'], 'customer_id': self.manifest['customer_id'],
                             'registration': 'ABC123', 'year': 2020, 'make': 'Ford', 'model': 'Mustang',
                             'archived_at': None}]
                if path.startswith('/rest/v1/customer_profiles'):
                    return [{'user_id': self.manifest['customer_id'], 'first_name': 'Test', 'last_name': 'Customer',
                             'email': 'customer@example.invalid'}]
                if path.startswith('/rest/v1/workshop_vehicles'):
                    return []
                if method == 'POST':
                    inner.posts.append(data)
                    return [{**data, 'id': self.manifest['job_id']}]
                return [{'id': self.manifest['vehicle_id'], 'customer_id': self.manifest['customer_id'],
                         'registration': 'ABC123', 'archived_at': None}]
        answers = iter(('abc123', '1', '15/09/2026', 'back', '14/09/2026', 'dyno', 'Corrected job'))
        connection = FakeConnection()
        create_manual_job(self.folder / 'back-job', connection, lambda _prompt: next(answers))
        self.assertEqual(len(connection.posts), 1)
        self.assertEqual(connection.posts[0]['job_date'], '2026-09-14')
        self.assertEqual(connection.posts[0]['title'], 'Corrected job')

    def test_back_at_registration_returns_to_menu_without_server_calls(self):
        class NoCalls:
            def call(self, *_args, **_kwargs):
                raise AssertionError('No server call should occur')
        with self.assertRaises(_ReturnToMenu):
            create_manual_job(self.folder / 'cancelled-job', NoCalls(), lambda _prompt: 'back')

    def test_phone_job_can_create_workshop_only_customer_without_an_account(self):
        workshop_contact_id = 'a4400000-0000-4000-8000-000000000001'
        workshop_vehicle_id = 'a4500000-0000-4000-8000-000000000001'
        class FakeConnection:
            url = 'https://test.supabase.co'
            user_id = 'a4000000-0000-4000-8000-000000000001'
            rpc_payload = None
            verified_jobs = {}
            def call(inner, path, method='GET', data=None, **kwargs):
                if path.startswith('/rest/v1/customer_vehicles') or path.startswith('/rest/v1/workshop_vehicles'):
                    return []
                if path == '/rest/v1/rpc/create_workshop_only_job' and method == 'POST':
                    inner.rpc_payload = data
                    return [{
                        'id': self.manifest['job_id'], 'customer_id': None, 'vehicle_id': None,
                        'workshop_contact_id': workshop_contact_id, 'workshop_vehicle_id': workshop_vehicle_id,
                        'reference': 'PSI-PHONE-20260915-1234ABCD', 'title': data['p_title'],
                        'job_date': data['p_job_date'],
                    }]
                raise AssertionError(path)
        answers = iter((
            '2fc 2bj', 'yes', 'Phone Customer', '0400 000 000', 'phone@example.com',
            '2018', 'Toyota', '86', '2026-09-15', 'dyno', 'Phone dyno booking',
        ))
        connection = FakeConnection()
        root = self.folder / 'workshop-only'
        folder = create_manual_job(root, connection, lambda _prompt: next(answers))
        self.assertEqual(connection.rpc_payload['p_display_name'], 'Phone Customer')
        self.assertEqual(connection.rpc_payload['p_registration'], '2FC2BJ')
        manifest = json.loads((folder / 'psi-job.json').read_text())
        self.assertEqual(manifest['schema'], 2)
        self.assertEqual(manifest['owner_type'], 'workshop')
        self.assertEqual(manifest['workshop_contact_id'], workshop_contact_id)
        self.assertEqual(
            folder.name,
            'PHONE CUSTOMER - 2018 TOYOTA 86 - 2FC2BJ - PSI-PHONE-20260915-1234ABCD',
        )

    def test_manifest_inbox_ignores_unrelated_json(self):
        inbox = self.folder / 'downloads'
        inbox.mkdir()
        (inbox / 'settings.json').write_text('{"theme":"dark"}')
        root = self.folder / 'inbox-uploads'
        root.mkdir()
        self.assertEqual(import_manifest_inbox(root, inbox, object()), [])


if __name__ == '__main__':
    unittest.main()
