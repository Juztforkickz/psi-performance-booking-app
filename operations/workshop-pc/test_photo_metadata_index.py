import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import psi_uploads as u


def ident(number):
    return f'00000000-0000-4000-8000-{number:012d}'


class PhotoMetadataIndexTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.folder = Path(self.temp.name)
        self.manifest = {'schema': 1, 'job_id': ident(1), 'customer_id': ident(2), 'vehicle_id': ident(3)}
        self.index = {'id': ident(4), 'record_id': ident(5), 'customer_id': ident(2), 'vehicle_id': ident(3),
                      'vault_records': {'job_id': ident(1)}}
        self.content = b'%PDF-verified-test-photo-document'
        self.detail = {**self.index, 'mime_type': 'application/pdf', 'size_bytes': len(self.content),
                       'sha256': hashlib.sha256(self.content).hexdigest(), 'source_sha256': None,
                       'object_path': '/'.join([ident(2), ident(3), ident(5), ident(4)]) + '/original.pdf'}
        self.calls = []
        self.details = [self.detail]
        outer = self
        class Connection:
            def call(self, path, **kwargs):
                outer.calls.append(path)
                if '/storage/' in path:
                    return outer.content
                if '&id=eq.' in path:
                    return outer.details
                return [outer.index]
        self.connection = Connection()

    def tearDown(self):
        self.temp.cleanup()

    def sync(self):
        with patch.object(u, 'manifest_for', return_value=self.manifest), patch.object(u, 'linked_job_manifests', return_value=[]):
            return u.sync_portal_photos(self.folder, self.connection)

    def test_routine_index_excludes_unused_file_and_signature_fields(self):
        self.assertEqual(u.published_photos(self.connection, self.manifest, for_download=True), [self.index])
        projection = self.calls[0].split('select=')[1].split('&')[0]
        self.assertEqual(projection, 'id,record_id,customer_id,vehicle_id,vault_records!inner(job_id)')
        self.assertIn('&ready=eq.true', self.calls[0])
        self.assertIn('&vault_records.published_at=not.is.null', self.calls[0])

    def test_new_photo_fetches_checked_details_then_downloads_once(self):
        self.assertEqual(self.sync(), 1)
        details = [path for path in self.calls if '&id=eq.' in path]
        self.assertEqual(len(details), 1)
        self.assertIn('&customer_id=eq.' + ident(2), details[0])
        self.assertIn('&vehicle_id=eq.' + ident(3), details[0])
        self.assertIn('&ready=eq.true&vault_records.kind=eq.media', details[0])
        self.assertEqual(next((self.folder / 'Workshop photos').iterdir()).read_bytes(), self.content)

    def test_unchanged_repeat_needs_no_details_or_storage_download(self):
        self.sync()
        self.calls.clear()
        self.assertEqual(self.sync(), 0)
        self.assertEqual(len(self.calls), 1)
        self.assertNotIn('&id=eq.', self.calls[0])

    def test_missing_local_file_is_restored_once(self):
        self.sync()
        next((self.folder / 'Workshop photos').iterdir()).unlink()
        self.assertEqual(self.sync(), 1)
        self.assertEqual(self.sync(), 0)

    def test_locally_changed_original_is_never_overwritten(self):
        self.sync()
        original = next((self.folder / 'Workshop photos').iterdir())
        original.write_bytes(b'%PDF-user-edited-original')
        self.assertEqual(self.sync(), 1)
        self.assertEqual(original.read_bytes(), b'%PDF-user-edited-original')

    def test_changed_owner_vehicle_record_or_asset_identity_fails_closed(self):
        for field in ('id', 'record_id', 'customer_id', 'vehicle_id'):
            with self.subTest(field=field), patch.dict(self.detail, {field: ident(99)}):
                with self.assertRaises(ValueError):
                    self.sync()
                self.assertFalse(any('/storage/' in path for path in self.calls))

    def test_changed_job_identity_fails_closed(self):
        self.detail['vault_records'] = {'job_id': ident(99)}
        with self.assertRaises(ValueError):
            self.sync()
        self.assertFalse(any('/storage/' in path for path in self.calls))

    def test_unpublished_or_missing_details_never_download(self):
        self.details = []
        with self.assertRaises(ValueError):
            self.sync()
        self.assertFalse(any('/storage/' in path for path in self.calls))

    def test_bad_download_checksum_does_not_make_a_visible_file(self):
        self.detail['sha256'] = '0' * 64
        with self.assertRaises(ValueError):
            self.sync()
        self.assertEqual(list((self.folder / 'Workshop photos').iterdir()), [])

    def test_other_job_index_is_ignored_without_fetching_details(self):
        self.index['vault_records'] = {'job_id': ident(99)}
        self.assertEqual(self.sync(), 0)
        self.assertEqual(len(self.calls), 1)


if __name__ == '__main__':
    unittest.main()
