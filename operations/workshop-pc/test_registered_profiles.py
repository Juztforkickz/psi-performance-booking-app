"""Completed registrations prepare safe desktop folders before the first visit."""
import json
import os
from pathlib import Path
import tempfile
import time
import unittest

import psi_uploads as u


class RegisteredProfileTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name) / 'Uploads'
        self.root.mkdir()
        self.customer = {
            'user_id': '00000000-0000-4000-8000-000000000010',
            'first_name': 'Example', 'last_name': 'Customer',
            'email': 'example@example.invalid', 'mobile': '0400000000', 'account_state': 'active',
        }
        self.vehicle = {
            'id': '00000000-0000-4000-8000-000000000020',
            'customer_id': self.customer['user_id'], 'registration': 'TEST123',
            'year': 2016, 'make': 'Holden', 'model': 'VF2 SSV', 'archived_at': None,
        }
        self.jobs = []
        self.calls = []
        outer = self

        class Staff:
            url = 'https://test.supabase.co'
            verified_jobs = {}

            def call(inner, path, method='GET', data=None, **kwargs):
                outer.calls.append((path, method))
                if method != 'GET':
                    raise AssertionError('Registration must never write a database job or payment')
                if path.startswith('/rest/v1/customer_profiles?'):
                    return [outer.customer]
                if path.startswith('/rest/v1/customer_vehicles?'):
                    return [outer.vehicle]
                if path.startswith('/rest/v1/workshop_jobs?'):
                    return outer.jobs
                if path.startswith(('/rest/v1/workshop_contacts?', '/rest/v1/workshop_vehicles?')):
                    return []
                raise AssertionError(path)

        self.connection = Staff()

    def tearDown(self):
        self.temp.cleanup()

    def sync(self, customers=None, vehicles=None):
        prepared, errors = u.sync_registered_profile_folders(
            self.root, self.connection,
            [self.customer] if customers is None else customers,
            [self.vehicle] if vehicles is None else vehicles,
        )
        return prepared, errors

    def test_signup_without_booking_creates_one_customer_vehicle_and_six_categories(self):
        folders, errors = u.sync_job_folders(self.root, self.connection)
        self.assertEqual((folders, errors), ([], []))
        customer, vehicle = self.connection.registered_profile_folders
        self.assertEqual(customer.name, 'EXAMPLE CUSTOMER')
        self.assertEqual(vehicle.parent, customer)
        self.assertEqual(set(p.name for p in vehicle.iterdir() if p.is_dir()), set(u.CATEGORIES))
        self.assertFalse((vehicle / 'psi-job.json').exists())
        self.assertFalse((vehicle / 'Jobs').exists())
        self.assertEqual(u.local_folder_scan(self.root), ([], []))
        before = u.workspace_inventory(self.root)
        u.sync_job_folders(self.root, self.connection)
        self.assertEqual(u.workspace_inventory(self.root), before)
        self.assertTrue(all(method == 'GET' for _, method in self.calls))

    def test_customer_without_vehicle_then_vehicle_added_reuses_the_same_profile(self):
        first, errors = self.sync(vehicles=[])
        self.assertEqual(errors, [])
        self.assertEqual(len(first), 1)
        second, errors = self.sync()
        self.assertEqual(errors, [])
        self.assertEqual(second[0], first[0])
        self.assertEqual(len([p for p in self.root.iterdir() if p.is_dir()]), 1)

    def test_invite_incomplete_inactive_and_archived_vehicle_are_not_prepared(self):
        for changes in ({'first_name': None}, {'last_name': None}, {'mobile': None}, {'account_state': 'deleted'}):
            with self.subTest(changes=changes):
                self.assertEqual(self.sync(customers=[{**self.customer, **changes}]), ([], []))
        prepared, errors = self.sync(vehicles=[{**self.vehicle, 'archived_at': '2026-11-01T00:00:00Z'}])
        self.assertEqual(errors, [])
        self.assertEqual(len(prepared), 1)

    def test_files_wait_locally_then_real_booking_reuses_folder_and_preserves_bytes(self):
        prepared, errors = self.sync()
        self.assertEqual(errors, [])
        workspace = prepared[1]
        photo = workspace / 'Workshop photos' / 'original.jpg'
        u.Image.new('RGB', (16, 16), (50, 100, 150)).save(photo)
        original = photo.read_bytes()
        os.utime(photo, (time.time() - 10, time.time() - 10))
        self.assertEqual(u.local_folder_scan(self.root), ([], []))
        self.jobs = [{
            'id': '00000000-0000-4000-8000-000000000030',
            'customer_id': self.customer['user_id'], 'vehicle_id': self.vehicle['id'],
            'reference': 'PSI-EXAMPLE', 'title': 'Service', 'job_date': '2099-11-06',
        }]
        folders, errors = u.sync_job_folders(self.root, self.connection)
        self.assertEqual(errors, [])
        self.assertEqual(folders, [workspace])
        self.assertEqual(u.manifest_for(workspace)['job_id'], self.jobs[0]['id'])
        self.assertEqual(photo.read_bytes(), original)
        self.assertEqual(u.local_folder_scan(self.root), ([workspace], []))
        u.process_job(workspace)
        receipt = json.loads((workspace / '.psi-upload-status.json').read_text())
        self.assertEqual(receipt[str(photo.relative_to(workspace))]['job_id'], self.jobs[0]['id'])

    def test_same_name_and_registration_different_ids_stay_separate(self):
        other_customer = {**self.customer, 'user_id': '00000000-0000-4000-8000-000000000011'}
        other_vehicle = {**self.vehicle, 'id': '00000000-0000-4000-8000-000000000021',
                         'customer_id': other_customer['user_id']}
        prepared, errors = self.sync(customers=[self.customer, other_customer], vehicles=[self.vehicle, other_vehicle])
        self.assertEqual(errors, [])
        self.assertNotEqual(prepared[0], prepared[2])
        self.assertNotEqual(prepared[1], prepared[3])
        self.assertEqual(u.local_folder_scan(self.root), ([], []))

    def test_vehicle_not_owned_by_registered_customer_is_never_attached(self):
        prepared, errors = self.sync(vehicles=[{**self.vehicle, 'customer_id': '00000000-0000-4000-8000-000000000099'}])
        self.assertEqual(errors, [])
        self.assertEqual(len(prepared), 1)

    def test_cross_project_customer_marker_requires_review_and_preserves_files(self):
        prepared, _ = self.sync()
        marker = prepared[0] / u.CUSTOMER_FOLDER_MARKER
        value = json.loads(marker.read_text())
        value['project_ref'] = 'other-project'
        u.atomic_json(marker, value)
        before = u.workspace_inventory(self.root)
        _, errors = self.sync()
        self.assertIn('different PSI environment', errors[0])
        self.assertEqual(u.workspace_inventory(self.root), before)

    def test_pending_profile_marker_cannot_bypass_customer_ownership(self):
        prepared, _ = self.sync()
        marker = prepared[1] / u.VEHICLE_WORKSPACE_MARKER
        value = json.loads(marker.read_text())
        value['identity'][2] = '00000000-0000-4000-8000-000000000099'
        u.atomic_json(marker, value)
        self.assertEqual(u.local_folder_scan(self.root), ([], [prepared[1]]))

    def test_verified_workshop_account_claim_reuses_prepared_profile_and_preserves_receipt(self):
        prepared, _ = self.sync()
        legacy = {
            'schema': 2, 'owner_type': 'workshop', 'project_ref': 'test',
            'job_id': '00000000-0000-4000-8000-000000000030',
            'workshop_contact_id': '10000000-0000-4000-8000-000000000040',
            'workshop_vehicle_id': '10000000-0000-4000-8000-000000000050',
            'registration': 'TEST123', 'vehicle_year': 2016, 'vehicle_make': 'Holden',
            'vehicle_model': 'VF2 SSV', 'customer_name': 'Previous Workshop Name',
            'reference': 'PSI-EXAMPLE', 'job_date': '2099-11-06',
        }
        old_folder = u.create_folder_from_manifest(self.root, legacy)
        relative = str(Path('Workshop photos') / 'original.pdf')
        (old_folder / relative).write_bytes(b'%PDF-original-preserved')
        receipt = {'status': 'uploaded', 'job_id': legacy['job_id'], 'record_id': 'existing-record'}
        u.atomic_json(old_folder / '.psi-upload-status.json', {relative: receipt})
        self.jobs = [{
            'id': legacy['job_id'], 'customer_id': self.customer['user_id'],
            'vehicle_id': self.vehicle['id'], 'reference': legacy['reference'],
            'title': 'Service', 'job_date': legacy['job_date'],
        }]
        folders, errors = u.sync_job_folders(self.root, self.connection)
        self.assertEqual(errors, [])
        self.assertEqual(folders, [prepared[1]])
        self.assertEqual((folders[0] / relative).read_bytes(), b'%PDF-original-preserved')
        self.assertEqual(json.loads((folders[0] / '.psi-upload-status.json').read_text())[relative], receipt)
        self.assertEqual(u.local_folder_scan(self.root), ([prepared[1]], []))


if __name__ == '__main__':
    unittest.main()
