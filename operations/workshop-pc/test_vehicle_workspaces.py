"""One verified vehicle workspace, separate immutable visit attribution."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import tempfile
import time
import unittest
from unittest.mock import patch
import psi_uploads as u


class VehicleWorkspaceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name) / 'Uploads'
        self.root.mkdir()
        self.first = {'schema': 1, 'project_ref': 'test',
            'job_id': '00000000-0000-4000-8000-000000000001',
            'customer_id': '00000000-0000-4000-8000-000000000010',
            'vehicle_id': '00000000-0000-4000-8000-000000000020',
            'registration': '2CF9JD', 'vehicle_year': 2016, 'vehicle_make': 'Holden', 'vehicle_model': 'VF2 SSV',
            'customer_name': 'Alex Croker', 'job_date': '2026-10-12', 'reference': 'PSI-BOOKING'}
        self.second = {**self.first, 'job_id': '00000000-0000-4000-8000-000000000002',
                       'job_date': '2026-10-13', 'reference': 'ALEX VF LS3 ENGINE REPAIRS'}
        self.posts = []
        outer = self
        class Staff:
            url = 'https://test.supabase.co'
            user_id = '00000000-0000-4000-8000-000000000030'
            def __init__(inner):
                inner.verified_jobs = {m['job_id']: m for m in (outer.first, outer.second)}
            def call(inner, path, method='GET', data=None, **kwargs):
                if method == 'POST' and path == '/rest/v1/workshop_jobs':
                    outer.posts.append(data)
                    return [{'id': outer.second['job_id'], **data}]
                if path.startswith('/rest/v1/workshop_jobs?'):
                    return [{'id': m['job_id'], **m} for m in (outer.first, outer.second)]
                if path.startswith('/rest/v1/customer_vehicles?'):
                    return [{'id': outer.first['vehicle_id'], 'customer_id': outer.first['customer_id'],
                             'registration': '2CF9JD', 'year': 2016, 'make': 'Holden', 'model': 'VF2 SSV', 'archived_at': None}]
                if path.startswith('/rest/v1/customer_profiles?'):
                    return [{'user_id': outer.first['customer_id'], 'first_name': 'Alex', 'last_name': 'Croker', 'email': 'alex@example.invalid'}]
                if path.startswith(('/rest/v1/workshop_vehicles?', '/rest/v1/workshop_contacts?')):
                    return []
                raise AssertionError((method, path))
        self.c = Staff()

    def tearDown(self):
        self.temp.cleanup()

    def legacy(self, manifest):
        customer = self.root / 'ALEX CROKER'
        customer.mkdir(exist_ok=True)
        u.atomic_json(customer / u.CUSTOMER_FOLDER_MARKER, u._customer_marker(manifest))
        folder = customer / u.folder_label_for(manifest)
        folder.mkdir()
        u.atomic_json(folder / 'psi-job.json', manifest)
        for category in u.CATEGORIES:
            (folder / category).mkdir()
        return folder

    def test_same_vehicle_different_dates_reuse_workspace_without_collapsing_jobs(self):
        first = u.create_folder_from_manifest(self.root, self.first, connection=self.c)
        second = u.create_folder_from_manifest(self.root, self.second, connection=self.c)
        self.assertEqual(first.parent, second.parent)
        self.assertNotEqual(first, second)
        self.assertEqual(first.parent.parent.name, '2016 HOLDEN VF2 SSV - 2CF9JD')
        for _ in range(3):
            self.assertEqual(u.create_folder_from_manifest(self.root, self.first, connection=self.c), first)
            self.assertEqual(u.create_folder_from_manifest(self.root, self.second, connection=self.c), second)
        self.assertEqual(json.loads((first / 'psi-job.json').read_text())['job_date'], '2026-10-12')
        self.assertEqual(json.loads((second / 'psi-job.json').read_text())['job_date'], '2026-10-13')
        self.assertEqual(self.posts, [])

    def test_background_sync_and_manifest_import_are_idempotent(self):
        first, errors = u.sync_job_folders(self.root, self.c, 365)
        second, more_errors = u.sync_job_folders(self.root, self.c, 365)
        self.assertEqual(errors + more_errors, [])
        self.assertEqual(first, second)
        self.assertEqual(len({f.parent.parent for f in first}), 1)
        source = Path(self.temp.name) / 'download.json'
        source.write_text(json.dumps(self.second))
        self.assertEqual(u.create_job_folder(self.root, source, self.c), first[1])
        self.assertEqual(len(u.local_folder_scan(self.root)[0]), 2)

    def test_manual_new_job_resolves_existing_vehicle_workspace(self):
        first = u.create_folder_from_manifest(self.root, self.first, connection=self.c)
        replies = iter(['2CF9JD', '1'])
        with patch.object(u, '_manual_job_details', return_value=('2026-10-13', 'Engine repair')), \
             patch.object(u, '_reuse_invoice_job', return_value=None):
            second = u.create_manual_job(self.root, self.c, lambda _: next(replies))
        self.assertEqual(first.parent, second.parent)
        self.assertEqual(len(self.posts), 1)
        self.assertNotEqual(u.manifest_for(first)['job_id'], u.manifest_for(second)['job_id'])

    def test_legacy_moves_preserve_hashes_dates_and_each_jobs_receipts(self):
        before = {}
        for m in (self.first, self.second):
            folder = self.legacy(m)
            (folder / 'Workshop photos' / 'same-name.jpg').write_bytes(m['job_id'].encode())
            u.atomic_json(folder / '.psi-upload-status.json', {
                'Workshop photos\\same-name.jpg': {'status': 'uploaded', 'key': 'pc:' + m['job_id'] + ':photos:hash',
                                                     'record_id': 'record-' + m['job_id']},
                '_cloud_photos': {m['job_id']: {'name': 'same-name.jpg', 'sha256': 'saved-receipt'}},
            })
            before[m['job_id']] = u.workspace_inventory(folder)
        for m in (self.first, self.second):
            moved = u.create_folder_from_manifest(self.root, m, connection=self.c)
            self.assertEqual(u.workspace_inventory(moved), before[m['job_id']])
        checkpoints = list((self.root / u.WORKSPACE_RECOVERY_FOLDER).glob('*/migration.json'))
        self.assertEqual(len(checkpoints), 2)
        for path in checkpoints:
            journal = json.loads(path.read_text())
            self.assertEqual(journal['state'], 'complete')
            self.assertEqual(u.workspace_inventory(path.parent / 'original'), journal['inventory'])
        jobs, review = u.local_folder_scan(self.root)
        self.assertEqual(len(jobs), 2)
        self.assertEqual(review, [])
        self.assertEqual(self.posts, [])

    def test_same_names_or_registration_do_not_merge_customer_or_vehicle_ids(self):
        first = u.create_folder_from_manifest(self.root, self.first)
        other_car = {**self.first, 'job_id': '00000000-0000-4000-8000-000000000003',
                     'vehicle_id': '00000000-0000-4000-8000-000000000021', 'registration': 'OTHER123'}
        second = u.create_folder_from_manifest(self.root, other_car)
        other_customer = {**other_car, 'job_id': '00000000-0000-4000-8000-000000000004',
                          'customer_id': '00000000-0000-4000-8000-000000000011'}
        third = u.create_folder_from_manifest(self.root, other_customer)
        self.assertNotEqual(first.parent.parent, second.parent.parent)
        self.assertNotEqual(second.parents[2], third.parents[2])

    def test_same_vehicle_label_with_conflicting_vehicle_ids_is_flagged(self):
        first = u.create_folder_from_manifest(self.root, self.first)
        before = u.workspace_inventory(first.parent.parent)
        conflict = {**self.second, 'vehicle_id': '00000000-0000-4000-8000-000000000099'}
        with self.assertRaisesRegex(ValueError, 'different vehicle IDs'):
            u.create_folder_from_manifest(self.root, conflict)
        self.assertEqual(u.workspace_inventory(first.parent.parent), before)

    def test_ambiguous_workspaces_and_conflicting_vehicle_details_stop(self):
        first = u.create_folder_from_manifest(self.root, self.first)
        workspace = first.parent.parent
        duplicate = workspace.parent / 'ambiguous'
        duplicate.mkdir()
        shutil.copy2(workspace / u.VEHICLE_WORKSPACE_MARKER, duplicate / u.VEHICLE_WORKSPACE_MARKER)
        (duplicate / 'Jobs').mkdir()
        before = u.workspace_inventory(workspace)
        with self.assertRaisesRegex(ValueError, 'More than one canonical workspace'):
            u.create_folder_from_manifest(self.root, self.second)
        self.assertEqual(u.workspace_inventory(workspace), before)
        shutil.rmtree(duplicate)
        with self.assertRaisesRegex(ValueError, 'details conflict'):
            u.create_folder_from_manifest(self.root, {**self.second, 'vehicle_model': 'Different car'})

    def test_manual_ambiguity_stops_before_creating_a_database_job(self):
        first = u.create_folder_from_manifest(self.root, self.first)
        duplicate = first.parents[2] / 'ambiguous'
        duplicate.mkdir()
        shutil.copy2(first.parent.parent / u.VEHICLE_WORKSPACE_MARKER, duplicate / u.VEHICLE_WORKSPACE_MARKER)
        (duplicate / 'Jobs').mkdir()
        replies = iter(['2CF9JD', '1'])
        with self.assertRaisesRegex(ValueError, 'More than one canonical workspace'):
            u.create_manual_job(self.root, self.c, lambda _: next(replies))
        self.assertEqual(self.posts, [])

    def test_failed_backup_never_moves_or_overwrites_a_source(self):
        legacy = self.legacy(self.first)
        before = u.workspace_inventory(legacy)
        real_copy = shutil.copytree
        def bad_copy(source, destination, *args, **kwargs):
            result = real_copy(source, destination, *args, **kwargs)
            (Path(destination) / 'psi-job.json').write_text('incomplete simulated backup')
            return result
        with patch.object(u.shutil, 'copytree', side_effect=bad_copy):
            with self.assertRaisesRegex(ValueError, 'Files changed during backup'):
                u.create_folder_from_manifest(self.root, self.first, connection=self.c)
        self.assertEqual(u.workspace_inventory(legacy), before)
        self.assertEqual(self.posts, [])

    def test_locked_directory_retries_reuse_one_verified_backup(self):
        legacy = self.legacy(self.first)
        before = u.workspace_inventory(legacy)
        real_rename = Path.rename
        def locked(path, target):
            if path == legacy:
                raise PermissionError('Simulated open Windows folder')
            return real_rename(path, target)
        with patch.object(Path, 'rename', locked):
            for _ in range(2):
                with self.assertRaises(PermissionError):
                    u.create_folder_from_manifest(self.root, self.first, connection=self.c)
        checkpoints = list((self.root / u.WORKSPACE_RECOVERY_FOLDER).glob('*/migration.json'))
        self.assertEqual(len(checkpoints), 1)
        self.assertEqual(u.workspace_inventory(legacy), before)
        self.assertEqual([p for p in legacy.parent.iterdir() if p.is_dir()], [legacy])
        moved = u.create_folder_from_manifest(self.root, self.first, connection=self.c)
        self.assertEqual(u.workspace_inventory(moved), before)
        self.assertEqual(len(list((self.root / u.WORKSPACE_RECOVERY_FOLDER).glob('*/migration.json'))), 1)

    def test_different_visit_photos_download_to_correct_job_with_no_upload_loop(self):
        folders = [u.create_folder_from_manifest(self.root, m, connection=self.c) for m in (self.first, self.second)]
        assets, contents = [], {}
        for index, m in enumerate((self.first, self.second), 40):
            asset_id = f'00000000-0000-4000-8000-{index:012d}'
            record_id = f'00000000-0000-4000-8000-{index+10:012d}'
            content = b'%PDF-' + m['job_id'].encode()
            path = f'{m["customer_id"]}/{m["vehicle_id"]}/{record_id}/{asset_id}/original.pdf'
            contents[path] = content
            assets.append({'id': asset_id, 'record_id': record_id, 'customer_id': m['customer_id'], 'vehicle_id': m['vehicle_id'],
                           'object_path': path, 'mime_type': 'application/pdf', 'size_bytes': len(content),
                           'sha256': hashlib.sha256(content).hexdigest(), 'vault_records': {'job_id': m['job_id']}})
        def read(path, method='GET', **kwargs):
            self.assertEqual(method, 'GET')
            if path.startswith('/rest/v1/vault_assets?'):
                return assets
            if path.startswith('/storage/v1/object/authenticated/performance-vault/'):
                return contents[path.split('/performance-vault/')[1]]
            raise AssertionError(path)
        with patch.object(self.c, 'call', side_effect=read):
            for folder, asset in zip(folders, assets):
                self.assertEqual(u.sync_portal_photos(folder, self.c), 1)
                self.assertEqual(u.sync_portal_photos(folder, self.c), 0)
                files = list((folder / 'Workshop photos').iterdir())
                self.assertEqual([f.name for f in files], [asset['id'] + '.pdf'])
                state = json.loads((folder / '.psi-upload-status.json').read_text())
                self.assertEqual(state[str(files[0].relative_to(folder))]['record_id'], asset['record_id'])
                self.assertEqual(len(state['_cloud_photos']), 1)

    def test_upload_uses_each_visit_job_and_date_not_a_workspace_primary(self):
        for m in (self.first, self.second):
            folder = u.create_folder_from_manifest(self.root, m, connection=self.c)
            source = folder / "Documents + DTC's" / 'scan.pdf'
            source.write_bytes(b'%PDF-1.7\nscan\n%%EOF')
            os.utime(source, (time.time()-10, time.time()-10))
            writes = []
            def api(path, method='GET', data=None, **kwargs):
                if path.startswith('/rest/v1/vault_records?'):
                    return []
                if method == 'POST' and path == '/rest/v1/vault_records':
                    writes.append(data)
                    return [{'id': 'record', 'published_at': None, **data}]
                if path.startswith('/rest/v1/vault_assets?'):
                    return []
                if method in ('POST', 'PATCH'):
                    return None
                raise AssertionError(path)
            with patch.object(self.c, 'call', side_effect=api), patch.object(u, 'ensure_object'):
                state = u.process_job(folder, self.c)
            self.assertEqual(writes[0]['job_id'], m['job_id'])
            self.assertEqual(writes[0]['occurred_on'], m['job_date'])
            self.assertTrue(state[str(source.relative_to(folder))]['key'].startswith('pc:' + m['job_id'] + ':'))


if __name__ == '__main__':
    unittest.main()
