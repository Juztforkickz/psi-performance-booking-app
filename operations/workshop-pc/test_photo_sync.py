import hashlib
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from PIL import Image
import psi_uploads as uploader


class PhotoSyncTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.folder = Path(self.temp.name)
        self.manifest = {'schema': 1, 'job_id': '00000000-0000-4000-8000-000000000001',
                         'customer_id': '00000000-0000-4000-8000-000000000002',
                         'vehicle_id': '00000000-0000-4000-8000-000000000003'}
        self.content = b'%PDF-test-photo-file'
        self.asset = {'id': '00000000-0000-4000-8000-000000000004',
                      'record_id': '00000000-0000-4000-8000-000000000005',
                      'customer_id': self.manifest['customer_id'], 'vehicle_id': self.manifest['vehicle_id'],
                      'mime_type': 'application/pdf', 'size_bytes': len(self.content),
                      'sha256': hashlib.sha256(self.content).hexdigest(),
                      'vault_records': {'job_id': self.manifest['job_id']}}
        self.asset['object_path'] = '/'.join([self.asset[key] for key in ('customer_id', 'vehicle_id', 'record_id', 'id')]) + '/original.pdf'
        outer = self
        class Connection:
            def call(self, path, **kwargs):
                if path.startswith('/rest/v1/vault_assets?'):
                    return [outer.asset]
                if path.startswith('/storage/v1/object/authenticated/performance-vault/'):
                    return outer.content
                raise AssertionError(path)
        self.connection = Connection()

    def tearDown(self):
        self.temp.cleanup()

    def sync(self):
        with patch.object(uploader, 'manifest_for', return_value=self.manifest), patch.object(uploader, 'linked_job_manifests', return_value=[]):
            return uploader.sync_portal_photos(self.folder, self.connection)

    def test_download_repeated_sync_and_upload_loop_prevention(self):
        self.assertEqual(self.sync(), 1)
        self.assertEqual(self.sync(), 0)
        files = list((self.folder / 'Workshop photos').iterdir())
        self.assertEqual(len(files), 1)
        self.assertEqual(files[0].read_bytes(), self.content)
        state = json.loads((self.folder / '.psi-upload-status.json').read_text())
        self.assertTrue(uploader._unchanged_terminal_source(state[str(files[0].relative_to(self.folder))],
                        (files[0].stat().st_size, files[0].stat().st_mtime_ns), False))

    def test_changed_local_file_is_preserved_and_cloud_copy_recovered(self):
        self.sync()
        original = next((self.folder / 'Workshop photos').iterdir())
        original.write_bytes(b'%PDF-edited-workshop-file')
        self.assertEqual(self.sync(), 1)
        self.assertEqual(original.read_bytes(), b'%PDF-edited-workshop-file')
        self.assertEqual(len(list(original.parent.iterdir())), 2)

    def test_wrong_vehicle_path_and_corrupt_download_never_saved(self):
        for changes in ({'vehicle_id': 'other'}, {'object_path': '../wrong'}, {'sha256': '0' * 64}):
            with self.subTest(changes=changes), patch.dict(self.asset, changes):
                with self.assertRaises(ValueError):
                    self.sync()
        self.assertEqual(list((self.folder / 'Workshop photos').iterdir()), [])

    def test_other_job_is_not_copied_into_this_folder(self):
        self.asset['vault_records']['job_id'] = 'different-job'
        self.assertEqual(self.sync(), 0)

    def test_visual_identity_keeps_changed_detail_and_flat_images(self):
        photo = Image.new('RGB', (64, 64))
        photo.putdata([(i % 256, 80, 150) for i in range(4096)])
        def signature(image):
            output = io.BytesIO(); image.save(output, format='PNG')
            return uploader.photo_signature(output.getvalue())
        first = signature(photo)
        self.assertTrue(uploader.visually_identical(first, first))
        photo.putpixel((5, 0), (15, 80, 150))
        self.assertFalse(uploader.visually_identical(first, signature(photo)))
        blank = signature(Image.new('RGB', (64, 64), 'black'))
        self.assertFalse(uploader.visually_identical(blank, blank))

    def test_pixel_check_detects_detail_hidden_in_coarse_signature(self):
        photo = Image.new('RGB', (640, 640))
        photo.putdata([(i % 256, 80, 150) for i in range(640 * 640)])
        first = io.BytesIO(); photo.save(first, format='PNG')
        photo.putpixel((5, 0), (20, 80, 150))
        second = io.BytesIO(); photo.save(second, format='PNG')
        self.assertTrue(uploader.visually_identical(uploader.photo_signature(first.getvalue()), uploader.photo_signature(second.getvalue())))
        self.assertFalse(uploader.identical_photo_pixels(first.getvalue(), second.getvalue()))


if __name__ == '__main__':
    unittest.main()
