"""All report folders download once, never become new uploads or overwrite work."""
import hashlib
import json
import os
from pathlib import Path
import tempfile
import time
import unittest
from unittest.mock import patch
import psi_uploads as u


def ident(number):
    return f'00000000-0000-4000-8000-{number:012d}'


class ReportSyncTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.folder = Path(self.temp.name)
        self.m = {'schema': 1, 'project_ref': 'test', 'job_id': ident(1), 'customer_id': ident(2), 'vehicle_id': ident(3),
                  'registration': 'TEST123', 'reference': 'PSI-TEST', 'job_date': '2026-10-12'}
        u.atomic_json(self.folder / 'psi-job.json', self.m)
        for category in u.CATEGORIES:
            (self.folder / category).mkdir()
        self.tables = {table: [] for table in u.REPORT_TABLES}
        self.storage = {}
        self.requests = []
        outer = self
        class Staff:
            url = 'https://test.supabase.co'
            verified_jobs = {outer.m['job_id']: outer.m}
            def call(inner, path, method='GET', **kwargs):
                outer.requests.append((method, path))
                if method != 'GET':
                    raise AssertionError('A downloaded file attempted a cloud write')
                if path.startswith('/storage/v1/object/authenticated/'):
                    return outer.storage[path.split('/authenticated/')[1]]
                if path.startswith('/rest/v1/'):
                    table = path.split('/rest/v1/')[1].split('?')[0]
                    rows = outer.tables[table]
                    if table == 'vault_assets':
                        photo = '&vault_records.kind=eq.media' in path
                        rows = [a for a in rows if (a['vault_records']['kind'] == 'media') == photo]
                    if table == 'vault_records':
                        rows = [r for r in rows if r['kind'] != 'media']
                    return rows
                raise AssertionError(path)
        self.c = Staff()

    def tearDown(self):
        self.temp.cleanup()

    def row(self, number, **values):
        return {'id': ident(number), 'customer_id': self.m['customer_id'], 'vehicle_id': self.m['vehicle_id'],
                'archived_at': None, 'created_at': '2026-10-12T00:00:00Z', 'updated_at': '2026-10-12T00:00:00Z', **values}

    def vault(self, number, kind, content=None, job_id=None, **values):
        record = self.row(number, job_id=job_id or self.m['job_id'], kind=kind, title='INV-TEST99' if kind == 'invoice' else kind,
                          source='staff', notes='Full notes\nSecond line', occurred_on='2026-10-12', published_at='2026-10-12T00:00:00Z', **values)
        self.tables['vault_records'].append(record)
        if content is not None:
            asset_id = ident(number+100)
            path = '/'.join([record['customer_id'], record['vehicle_id'], record['id'], asset_id]) + '/original.pdf'
            asset = self.row(number+100, record_id=record['id'], object_path=path, mime_type='application/pdf',
                             size_bytes=len(content), sha256=hashlib.sha256(content).hexdigest(), caption=record['title'], ready=True,
                             vault_records={'kind': kind, 'job_id': record['job_id'], 'published_at': record['published_at']})
            self.tables['vault_assets'].append(asset)
            self.storage['performance-vault/' + path] = content
        return record

    def test_every_category_downloads_once_and_never_uploads_back(self):
        for n, kind in enumerate(('media','invoice','dyno','document','service'), 10):
            self.vault(n, kind, b'%PDF-' + kind.encode() if kind != 'service' else None)
        lines = '\n'.join('Line ' + str(i) for i in range(11))
        self.tables['repair_records'] = [self.row(30, title='Work done', notes=lines, repair_date='2026-10-12', record_source='psi_record')]
        self.tables['recommended_work'] = [self.row(31, title='Recommended', notes=lines, status='recommended', timing='Next visit', record_source='psi_record')]
        self.assertEqual(u.sync_portal_records(self.folder, self.c), 7)
        self.assertEqual(u.sync_portal_records(self.folder, self.c), 0)
        for category in u.CATEGORIES:
            self.assertTrue(any((self.folder / category).iterdir()), category)
        recommended = next((self.folder / 'Recommended work').iterdir())
        self.assertIn(lines, recommended.read_text())
        for path in self.folder.rglob('*'):
            if path.is_file() and path.parent.name in u.CATEGORIES:
                os.utime(path, (time.time()-10, time.time()-10))
        # Touching a downloaded file without changing bytes must not cause upload.
        u.sync_portal_records(self.folder, self.c)
        state = u.process_job(self.folder, self.c)
        self.assertTrue(all(v['status'] == 'uploaded' for k,v in state.items() if not k.startswith('_')))
        self.assertTrue(all(method == 'GET' for method,path in self.requests))

    def test_preexisting_identical_file_is_reused_and_collision_is_not_overwritten(self):
        self.vault(11, 'invoice', b'%PDF-original')
        original = self.folder / 'Invoice archive' / 'INV-TEST99.pdf'
        original.write_bytes(b'%PDF-my-different-file')
        match = original.parent / 'my existing invoice.pdf'
        match.write_bytes(b'%PDF-original')
        self.assertEqual(u.sync_portal_records(self.folder, self.c), 0)
        self.assertEqual(original.read_bytes(), b'%PDF-my-different-file')
        self.assertEqual(len(list(original.parent.iterdir())), 2)

    def test_deleted_download_is_restored_and_local_edits_are_preserved(self):
        self.vault(11, 'invoice', b'%PDF-original')
        u.sync_portal_records(self.folder, self.c)
        original = next((self.folder / 'Invoice archive').iterdir())
        original.write_bytes(b'%PDF-local-edit')
        self.assertEqual(u.sync_portal_records(self.folder, self.c), 1)
        self.assertEqual(original.read_bytes(), b'%PDF-local-edit')
        cloud = next(p for p in original.parent.iterdir() if p != original)
        cloud.unlink()
        self.assertEqual(u.sync_portal_records(self.folder, self.c), 1)
        self.assertEqual(u.sync_portal_records(self.folder, self.c), 0)

    def test_unpublished_other_job_wrong_owner_and_bad_checksum_are_not_downloaded(self):
        record = self.vault(11, 'invoice', b'%PDF-original', job_id=ident(999))
        self.assertEqual(u.sync_portal_records(self.folder, self.c), 0)
        record['job_id'] = self.m['job_id']
        record['published_at'] = None
        self.assertEqual(u.sync_portal_records(self.folder, self.c), 0)
        record['published_at'] = '2026-10-12'
        self.tables['vault_assets'][0]['sha256'] = '0' * 64
        with self.assertRaises(ValueError):
            u.sync_portal_records(self.folder, self.c)
        self.assertEqual(list((self.folder / 'Invoice archive').iterdir()), [])
        record['customer_id'] = ident(888)
        with self.assertRaisesRegex(ValueError, 'ownership scope'):
            u.sync_portal_records(self.folder, self.c)

    def test_receipt_failure_cannot_expose_an_untracked_download(self):
        self.vault(11, 'invoice', b'%PDF-original')
        with patch.object(u, 'atomic_json', side_effect=OSError('Simulated receipt disk failure')):
            with self.assertRaises(ValueError):
                u.sync_portal_records(self.folder, self.c)
        self.assertEqual(list((self.folder / 'Invoice archive').iterdir()), [])
        self.assertEqual(u.sync_portal_records(self.folder, self.c), 1)

    def test_uploaded_pc_note_is_not_exported_as_a_duplicate(self):
        note = self.folder / 'Service & repair history' / 'Existing note.txt'
        note.write_text('Full original\nEvery line retained')
        os.utime(note, (time.time()-10, time.time()-10))
        record = self.row(30, title=note.stem, notes=note.read_text(), repair_date='2026-10-12', record_source='psi_record')
        self.tables['repair_records'] = [record]
        relative = str(note.relative_to(self.folder))
        u.atomic_json(self.folder / '.psi-upload-status.json', {relative: u._source_state('pc:original-key', 'uploaded',
                      (note.stat().st_size,note.stat().st_mtime_ns), record_id=record['id'], job_id=self.m['job_id'])})
        self.assertEqual(u.sync_portal_records(self.folder, self.c), 0)
        self.assertEqual(len(list(note.parent.iterdir())), 1)
        state = json.loads((self.folder / '.psi-upload-status.json').read_text())
        self.assertEqual(state[relative]['key'], 'pc:original-key')
        self.assertEqual(note.read_text(), record['notes'])

    def test_legacy_invoice_graph_document_and_metadata_are_supported(self):
        for number, kind, table, field, prefix in ((40,'invoice','invoices','invoice_id','invoices'),(41,'dyno_graph','dyno_records','dyno_record_id','dyno-graphs'),(42,'repair_document',None,None,'documents')):
            parent = self.row(number, invoice_number='INV-LEGACY', title='Legacy', invoice_date='2026-10-12', notes='Full notes')
            if table:
                self.tables[table].append(parent)
            path = self.m['customer_id'] + '/vehicles/' + self.m['vehicle_id'] + '/' + prefix + '/' + ident(number) + '.pdf'
            content = b'%PDF-' + kind.encode()
            asset = self.row(number+100, file_kind=kind, bucket_id='vehicle-documents', object_path=path,
                             mime_type='application/pdf', file_size_bytes=len(content), **({field:parent['id']} if field else {}))
            self.tables['vehicle_files'].append(asset)
            self.storage['vehicle-documents/' + path] = content
        self.assertEqual(u.sync_portal_records(self.folder, self.c), 3)
        self.assertEqual(u.sync_portal_records(self.folder, self.c), 0)
        for category in ('Invoice archive','Dyno results & graphs',"Documents + DTC's"):
            self.assertEqual(len(list((self.folder / category).iterdir())), 1)

    def test_batch_cache_is_scoped_paginated_and_reset_each_scan(self):
        self.tables['recommended_work'] = [self.row(31, title='Recommended', notes='One line')]
        u.configure_report_scan(self.c, [self.folder])
        u.sync_portal_records(self.folder, self.c)
        before = len([p for m,p in self.requests if p.startswith('/rest/v1/recommended_work?')])
        u.sync_portal_records(self.folder, self.c)
        self.assertEqual(len([p for m,p in self.requests if p.startswith('/rest/v1/recommended_work?')]), before)
        u.configure_report_scan(self.c, [self.folder])
        u.sync_portal_records(self.folder, self.c)
        self.assertEqual(len([p for m,p in self.requests if p.startswith('/rest/v1/recommended_work?')]), before+1)

    def test_pause_and_workshop_only_never_download(self):
        stop = self.folder / 'watcher.stop'
        stop.touch()
        self.c.pause_file = stop
        with self.assertRaises(u.PauseRequested):
            u.sync_portal_records(self.folder, self.c)
        stop.unlink()
        with patch.object(u, 'manifest_for', return_value={'schema':2}):
            self.assertEqual(u.sync_portal_records(self.folder, self.c), 0)
        self.assertEqual(self.requests, [])

    def test_pagination_and_batched_ownership_never_mix_customers(self):
        self.c.report_scopes = {(self.m['customer_id'],self.m['vehicle_id']), (ident(8),ident(9))}
        rows = [self.row(n+1000, title='Note') for n in range(110)]
        rows.append(self.row(2000, customer_id=ident(8), vehicle_id=ident(9), title='Other customer'))
        calls = []
        def pages(path, **kwargs):
            calls.append(path)
            offset = int(path.split('&offset=')[1])
            return rows[offset:offset+100]
        with patch.object(self.c, 'call', side_effect=pages):
            own = u._report_rows(self.c, 'repair_records', self.m, filters='&archived_at=is.null')
        self.assertEqual(len(own), 110)
        self.assertEqual(len(calls), 2)
        self.assertTrue(all(row['customer_id'] == self.m['customer_id'] for row in own))

    def test_download_keeps_secondary_job_identity(self):
        secondary = {**self.m, 'job_id': ident(99), 'reference': 'SECOND-VISIT', 'job_date': '2026-10-13'}
        self.c.verified_jobs = {self.m['job_id']: self.m, secondary['job_id']: secondary}
        self.vault(11, 'invoice', b'%PDF-second-job', job_id=secondary['job_id'])
        with patch.object(u, 'linked_job_manifests', return_value=[secondary]):
            self.assertEqual(u.sync_portal_records(self.folder, self.c), 1)
        state = json.loads((self.folder / '.psi-upload-status.json').read_text())
        receipt = next(v for k,v in state.items() if k.startswith('Invoice archive'))
        self.assertEqual(receipt['job_id'], secondary['job_id'])

    def test_legacy_attachment_rejects_wrong_bucket_and_traversal(self):
        record = self.row(40, invoice_number='INV-LEGACY', invoice_date='2026-10-12', notes='')
        self.tables['invoices'].append(record)
        base = self.m['customer_id'] + '/vehicles/' + self.m['vehicle_id']
        row = self.row(140, file_kind='invoice', invoice_id=record['id'], bucket_id='vehicle-documents',
                       object_path=base + '/invoices/' + ident(40) + '.pdf', mime_type='application/pdf',file_size_bytes=10)
        for changed in ({'bucket_id':'other'}, {'object_path':base+'/../other.pdf'}, {'object_path':'../other.pdf'}):
            self.tables['vehicle_files'] = [{**row, **changed}]
            with self.assertRaises(ValueError):
                u.sync_portal_records(self.folder, self.c)
        self.assertEqual(list((self.folder / 'Invoice archive').iterdir()), [])

    def test_invoice_is_downloaded_before_slow_photo_comparison(self):
        self.vault(11, 'invoice', b'%PDF-original')
        def photos(*args):
            self.assertEqual(len(list((self.folder / 'Invoice archive').iterdir())), 1)
            return 0
        with patch.object(u, 'sync_portal_photos', side_effect=photos):
            self.assertEqual(u.sync_portal_records(self.folder, self.c), 1)

    def test_photo_receipt_failure_never_exposes_an_untracked_file(self):
        self.vault(11, 'media', b'%PDF-photo-original')
        with patch.object(u, 'atomic_json', side_effect=OSError('Simulated receipt disk failure')):
            with self.assertRaises(ValueError):
                u.sync_portal_records(self.folder, self.c)
        self.assertEqual(list((self.folder / 'Workshop photos').iterdir()), [])
        self.assertEqual(u.sync_portal_records(self.folder, self.c), 1)


if __name__ == '__main__':
    unittest.main()
