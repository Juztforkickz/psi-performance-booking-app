"""Short shared vehicle folders, with immutable per-file job attribution."""
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
            'registration': 'TEST123', 'vehicle_year': 2016, 'vehicle_make': 'Holden', 'vehicle_model': 'VF2 SSV',
            'customer_name': 'Example Customer', 'job_date': '2026-10-12', 'reference': 'PSI-BOOKING'}
        self.second = {**self.first, 'job_id': '00000000-0000-4000-8000-000000000002',
                       'job_date': '2026-10-13', 'reference': 'ENGINE REPAIRS'}
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
                    return [{'id': m['job_id'], **m} for m in (outer.first, outer.second)
                            if '&id=eq.' not in path or m['job_id'] == path.split('&id=eq.')[1]]
                if path.startswith('/rest/v1/customer_vehicles?'):
                    return [{'id': outer.first['vehicle_id'], 'customer_id': outer.first['customer_id'],
                             'registration': 'TEST123', 'year': 2016, 'make': 'Holden', 'model': 'VF2 SSV', 'archived_at': None}]
                if path.startswith('/rest/v1/customer_profiles?'):
                    return [{'user_id': outer.first['customer_id'], 'first_name': 'Example', 'last_name': 'Customer', 'email': 'example@example.invalid'}]
                if path.startswith(('/rest/v1/workshop_vehicles?', '/rest/v1/workshop_contacts?')):
                    return []
                raise AssertionError((method, path))
        self.c = Staff()

    def tearDown(self):
        self.temp.cleanup()

    def legacy(self, manifest, nested=False):
        customer = self.root / 'EXAMPLE CUSTOMER'
        customer.mkdir(exist_ok=True)
        u.atomic_json(customer / u.CUSTOMER_FOLDER_MARKER, u._customer_marker(manifest))
        if nested:
            workspace = customer / u.vehicle_workspace_label(manifest)
            workspace.mkdir(exist_ok=True)
            u.atomic_json(workspace / u.VEHICLE_WORKSPACE_MARKER, {
                'schema': 1, 'purpose': 'vehicle_workspace', 'identity': list(u._workspace_identity(manifest)),
                'description': list(u._vehicle_description(manifest))})
            parent = workspace / 'Jobs'
            parent.mkdir(exist_ok=True)
            folder = parent / (manifest['job_date'] + ' - ' + manifest['job_id'][:8] + manifest['job_id'][-1])
        else:
            folder = customer / u.folder_label_for(manifest)
        folder.mkdir()
        u.atomic_json(folder / 'psi-job.json', manifest)
        for category in u.CATEGORIES:
            (folder / category).mkdir()
        return folder

    def file(self, folder, name, content=b'%PDF-1.7\nscan\n%%EOF', category="Documents + DTC's", status=None, manifest=None):
        path = folder / category / name
        path.write_bytes(content)
        os.utime(path, (time.time()-10, time.time()-10))
        if status:
            m = manifest or self.first
            state_path = folder / '.psi-upload-status.json'
            state = json.loads(state_path.read_text()) if state_path.exists() else {}
            state[str(path.relative_to(folder))] = u._source_state(
                f'pc:{m["job_id"]}:documents:{hashlib.sha256(content).hexdigest()}', status,
                (path.stat().st_size, path.stat().st_mtime_ns), record_id='record-' + m['job_id'])
            u.atomic_json(state_path, state)
        return path

    def jobs(self, folder):
        return {m['job_id']: m for m in u._folder_manifests(folder, self.c)}

    def test_same_vehicle_dates_booking_and_manual_share_short_folder(self):
        first = u.create_folder_from_manifest(self.root, self.first, connection=self.c)
        second = u.create_folder_from_manifest(self.root, self.second, connection=self.c)
        self.assertEqual(first, second)
        self.assertEqual(first.relative_to(self.root).parts, ('EXAMPLE CUSTOMER', '2016 HOLDEN VF2 SSV - TEST123'))
        self.assertFalse((first / 'Jobs').exists())
        self.assertEqual({m['job_date'] for m in self.jobs(first).values()}, {'2026-10-12', '2026-10-13'})
        for _ in range(3):
            for m in (self.first, self.second):
                self.assertEqual(u.create_folder_from_manifest(self.root, m, connection=self.c), first)
        self.assertEqual(len(u.local_folder_scan(self.root)[0]), 1)
        self.assertEqual(self.posts, [])

    def test_background_sync_and_downloaded_manifest_reuse_same_folder(self):
        first, errors = u.sync_job_folders(self.root, self.c, 365)
        second, more_errors = u.sync_job_folders(self.root, self.c, 365)
        self.assertEqual(errors + more_errors, [])
        self.assertEqual(first, second)
        self.assertEqual(len(set(first)), 1)
        source = Path(self.temp.name) / 'download.json'
        source.write_text(json.dumps(self.second))
        self.assertEqual(u.create_job_folder(self.root, source, self.c), first[0])

    def test_manual_creation_checks_existing_vehicle_folder(self):
        first = u.create_folder_from_manifest(self.root, self.first, connection=self.c)
        replies = iter(['TEST123', '1'])
        with patch.object(u, '_manual_job_details', return_value=('2026-10-13', 'Engine repair')), \
             patch.object(u, '_reuse_invoice_job', return_value=None):
            second = u.create_manual_job(self.root, self.c, lambda _: next(replies))
        self.assertEqual(first, second)
        self.assertEqual(len(self.posts), 1)
        self.assertEqual(len(self.jobs(first)), 2)

    def test_nested_jobs_flatten_files_receipts_and_full_recovery(self):
        before = {}
        for m in (self.first, self.second):
            source = self.legacy(m, nested=True)
            self.file(source, 'scan.pdf', m['job_id'].encode(), status='uploaded', manifest=m)
            (source / 'extra user note.txt').write_text('Keep this too')
            before[m['job_id']] = u.workspace_inventory(source)
        workspace = u.create_folder_from_manifest(self.root, self.first, connection=self.c)
        self.assertFalse((workspace / 'Jobs').exists())
        self.assertEqual(len(list((workspace / "Documents + DTC's").iterdir())), 2)
        self.assertTrue((workspace / 'extra user note.txt').exists())
        state = json.loads((workspace / '.psi-upload-status.json').read_text())
        receipts = [v for k,v in state.items() if k.startswith("Documents + DTC's")]
        self.assertEqual({v['job_id'] for v in receipts}, set(before))
        self.assertTrue(all(v['status'] == 'uploaded' and v['record_id'] for v in receipts))
        checkpoints = list((self.root / u.WORKSPACE_RECOVERY_FOLDER).glob('*/migration.json'))
        self.assertEqual(len(checkpoints), 2)
        for path in checkpoints:
            journal = json.loads(path.read_text())
            self.assertEqual(journal['state'], 'complete')
            self.assertEqual(u.workspace_inventory(path.parent / 'original'), journal['inventory'])
            self.assertEqual(u.workspace_inventory(path.parent / 'retired'), journal['inventory'])
        self.assertEqual(self.posts, [])

    def test_exact_duplicates_merge_but_different_bytes_with_same_name_survive(self):
        a, b = self.legacy(self.first), self.legacy(self.second)
        self.file(a, 'scan.pdf', b'one', status='uploaded')
        self.file(b, 'copy.pdf', b'one', status='waiting_for_customer_account', manifest=self.second)
        self.file(b, 'scan.pdf', b'two')
        folder = u.create_folder_from_manifest(self.root, self.first, connection=self.c)
        files = list((folder / "Documents + DTC's").iterdir())
        self.assertEqual(sorted(p.read_bytes() for p in files), [b'one', b'two'])
        state = json.loads((folder / '.psi-upload-status.json').read_text())
        kept = next(p for p in files if p.read_bytes() == b'one')
        self.assertEqual(state[str(kept.relative_to(folder))]['status'], 'uploaded')
        u.create_folder_from_manifest(self.root, self.second, connection=self.c)
        self.assertEqual(len(list((folder / "Documents + DTC's").iterdir())), 2)

    def test_verified_duplicate_vehicle_containers_consolidate(self):
        first = u.create_folder_from_manifest(self.root, self.first, connection=self.c)
        second = first.parent / 'accidental copy'
        shutil.copytree(first, second)
        self.file(second, 'only-in-copy.pdf')
        self.assertEqual(u.create_folder_from_manifest(self.root, self.first, connection=self.c), first)
        self.assertFalse(second.exists())
        self.assertTrue((first / "Documents + DTC's" / 'only-in-copy.pdf').exists())

    def test_customer_vehicle_separation_and_conflicting_ids(self):
        first = u.create_folder_from_manifest(self.root, self.first)
        other_car = {**self.first, 'job_id': '00000000-0000-4000-8000-000000000003',
                     'vehicle_id': '00000000-0000-4000-8000-000000000021', 'registration': 'OTHER123'}
        second = u.create_folder_from_manifest(self.root, other_car)
        other_customer = {**other_car, 'job_id': '00000000-0000-4000-8000-000000000004',
                          'customer_id': '00000000-0000-4000-8000-000000000011'}
        third = u.create_folder_from_manifest(self.root, other_customer)
        self.assertNotEqual(first, second)
        self.assertEqual(first.parent, second.parent)
        self.assertNotEqual(second.parent, third.parent)
        conflict = {**self.second, 'vehicle_id': '00000000-0000-4000-8000-000000000099'}
        with self.assertRaisesRegex(ValueError, 'different vehicle IDs'):
            u.create_folder_from_manifest(self.root, conflict)

    def test_conflicting_metadata_stops_manual_job_before_database_write(self):
        first = u.create_folder_from_manifest(self.root, self.first)
        marker_path = first / u.VEHICLE_WORKSPACE_MARKER
        marker = json.loads(marker_path.read_text())
        marker['description'][3] = 'different car'
        u.atomic_json(marker_path, marker)
        replies = iter(['TEST123', '1'])
        with self.assertRaisesRegex(ValueError, 'details conflict'):
            u.create_manual_job(self.root, self.c, lambda _: next(replies))
        self.assertEqual(self.posts, [])

    def test_failed_backup_preserves_source(self):
        source = self.legacy(self.first)
        before = u.workspace_inventory(source)
        real_copy = shutil.copytree
        def bad_copy(original, destination, *args, **kwargs):
            result = real_copy(original, destination, *args, **kwargs)
            (Path(destination) / 'psi-job.json').write_text('incomplete backup')
            return result
        with patch.object(u.shutil, 'copytree', side_effect=bad_copy):
            with self.assertRaisesRegex(ValueError, 'Files changed during backup'):
                u.create_folder_from_manifest(self.root, self.first, connection=self.c)
        self.assertEqual(u.workspace_inventory(source), before)

    def test_locked_move_keeps_original_reuses_backup_and_blocks_uploads(self):
        source = self.legacy(self.first)
        self.file(source, 'scan.pdf')
        before = u.workspace_inventory(source)
        real_rename = Path.rename
        def locked(path, target):
            if path == source:
                raise PermissionError('Simulated Windows lock')
            return real_rename(path, target)
        with patch.object(Path, 'rename', locked):
            for _ in range(2):
                with self.assertRaises(PermissionError):
                    u.create_folder_from_manifest(self.root, self.first, connection=self.c)
        self.assertEqual(u.workspace_inventory(source), before)
        workspace = source.parent / u.vehicle_workspace_label(self.first)
        with self.assertRaisesRegex(ValueError, 'not complete'):
            u.process_job(workspace, self.c)
        self.assertEqual(len(list((self.root / u.WORKSPACE_RECOVERY_FOLDER).glob('*/migration.json'))), 1)
        u.create_folder_from_manifest(self.root, self.first, connection=self.c)
        self.assertFalse(source.exists())
        self.assertFalse(u._read_vehicle_workspace(workspace)['pending_merge'])
        self.assertEqual(len(list((workspace / "Documents + DTC's").iterdir())), 1)

    def test_per_file_upload_job_and_date_survive_active_job_change(self):
        first = self.legacy(self.first, nested=True)
        second = self.legacy(self.second, nested=True)
        self.file(first, 'first.pdf', b'%PDF-first', status='prepared', manifest=self.first)
        self.file(second, 'second.pdf', b'%PDF-second', status='prepared', manifest=self.second)
        folder = u.create_folder_from_manifest(self.root, self.first, connection=self.c)
        writes = []
        def api(path, method='GET', data=None, **kwargs):
            if path.startswith('/rest/v1/vault_records?') or path.startswith('/rest/v1/vault_assets?'):
                return []
            if method == 'POST' and path == '/rest/v1/vault_records':
                writes.append(data)
                return [{'id': 'record', 'published_at': None, **data}]
            if method in ('POST', 'PATCH'):
                return None
            raise AssertionError(path)
        with patch.object(self.c, 'call', side_effect=api), patch.object(u, 'ensure_object'):
            u.process_job(folder, self.c)
            u.process_job(folder, self.c)
        self.assertEqual({(w['job_id'], w['occurred_on']) for w in writes},
                         {(self.first['job_id'], self.first['job_date']), (self.second['job_id'], self.second['job_date'])})
        self.assertEqual(len(writes), 2)

    def test_future_booking_does_not_reassign_existing_files(self):
        folder = u.create_folder_from_manifest(self.root, self.first, connection=self.c)
        self.file(folder, 'original.pdf', status='prepared')
        future = {**self.second, 'job_date': '2099-10-13'}
        self.c.verified_jobs[future['job_id']] = future
        u.create_folder_from_manifest(self.root, future, connection=self.c)
        self.assertEqual(u.manifest_for(folder)['job_id'], self.first['job_id'])
        state = json.loads((folder / '.psi-upload-status.json').read_text())
        self.assertEqual(next(v for k,v in state.items() if k.startswith("Documents + DTC's"))['job_id'], self.first['job_id'])

    def test_invoice_job_does_not_steal_active_workshop_visit(self):
        folder = u.create_folder_from_manifest(self.root, self.first, connection=self.c)
        invoice = {**self.second, 'reference': 'XERO INV-9999'}
        self.c.verified_jobs[invoice['job_id']] = invoice
        u.create_folder_from_manifest(self.root, invoice, connection=self.c)
        self.assertEqual(u.manifest_for(folder)['job_id'], self.first['job_id'])

    def test_unverified_receipt_never_gets_reassigned_to_active_job(self):
        folder = u.create_folder_from_manifest(self.root, self.first, connection=self.c)
        path = self.file(folder, 'unverified.pdf')
        relative = str(path.relative_to(folder))
        u.atomic_json(folder / '.psi-upload-status.json', {relative: {'key': 'pc:unverified:documents:hash'}})
        state = u.process_job(folder, self.c)
        self.assertEqual(state[relative]['status'], 'needs_review')
        self.assertNotIn('job_id', state[relative])
        self.assertEqual(state[relative]['key'], 'pc:unverified:documents:hash')

    def test_multi_visit_workshop_account_claim_preserves_waiting_receipts(self):
        workshop = []
        for item in (self.first, self.second):
            m = {k:v for k,v in item.items() if k not in ('customer_id', 'vehicle_id')}
            m.update({'schema': 2, 'owner_type': 'workshop',
                      'workshop_contact_id': '00000000-0000-4000-8000-000000000070',
                      'workshop_vehicle_id': '00000000-0000-4000-8000-000000000080'})
            workshop.append(m)
        folder = u.create_folder_from_manifest(self.root, workshop[0])
        self.file(folder, 'waiting.pdf', status='waiting_for_customer_account', manifest=workshop[0])
        u.create_folder_from_manifest(self.root, workshop[1])
        claimed = u.create_folder_from_manifest(self.root, self.second, connection=self.c)
        self.assertEqual(folder, claimed)
        self.assertEqual({m['schema'] for m in self.jobs(folder).values()}, {1})
        state = json.loads((folder / '.psi-upload-status.json').read_text())
        receipt = next(v for k,v in state.items() if k.startswith("Documents + DTC's"))
        self.assertEqual(receipt['status'], 'waiting_for_customer_account')
        self.assertEqual(receipt['job_id'], self.first['job_id'])

    def test_cloud_photos_for_all_visits_share_folder_without_upload_loop(self):
        folder = u.create_folder_from_manifest(self.root, self.first, connection=self.c)
        u.create_folder_from_manifest(self.root, self.second, connection=self.c)
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
            self.assertEqual(u.sync_portal_photos(folder, self.c), 2)
            self.assertEqual(u.sync_portal_photos(folder, self.c), 0)
        state = json.loads((folder / '.psi-upload-status.json').read_text())
        self.assertEqual({state[str(Path('Workshop photos') / (a['id'] + '.pdf'))]['job_id'] for a in assets}, set(self.jobs(folder)))
        self.assertEqual(len(state['_cloud_photos']), 2)


if __name__ == '__main__':
    unittest.main()
