import io
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from PIL import Image
import psi_uploads as uploader


class PauseHandoverTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.folder = Path(self.temp.name)
        self.pause = self.folder / 'watcher.stop'
        self.connection = type('Staff', (), {'pause_file': self.pause})()

    def tearDown(self):
        self.temp.cleanup()

    def test_pause_is_not_reported_as_failed_upload(self):
        self.pause.touch()
        with self.assertRaises(uploader.PauseRequested):
            try:
                uploader.check_pause(self.connection)
            except Exception:
                self.fail('A pause must not be caught by file failure handlers')

    def test_read_request_pauses_before_network_access(self):
        self.pause.touch()
        connection = object.__new__(uploader.Connection)
        connection.pause_file = self.pause
        with patch.object(uploader.urllib.request, 'urlopen', side_effect=AssertionError('Network access')):
            with self.assertRaises(uploader.PauseRequested):
                connection.call('/rest/v1/workshop_jobs')

    def test_completed_text_receipt_is_saved_before_pause(self):
        category = self.folder / 'Service & repair history'
        category.mkdir()
        for name in ('first.txt', 'second.txt'):
            (category / name).write_text(name)
            os.utime(category / name, (1, 1))
        def publish(folder, manifest, connection, state, path, relative, *args):
            state[relative] = {'status': 'uploaded', 'record_id': 'saved-record'}
            self.pause.touch()
        manifest = {'schema': 1, 'job_id': 'test-job'}
        with patch.object(uploader, 'manifest_for', return_value=manifest), \
             patch.object(uploader, 'linked_job_manifests', return_value=[]), \
             patch.object(uploader, 'archive_exact_source_duplicates'), \
             patch.object(uploader, '_publish_text_record', side_effect=publish):
            with self.assertRaises(uploader.PauseRequested):
                uploader.process_job(self.folder, self.connection)
        state = json.loads((self.folder / '.psi-upload-status.json').read_text())
        self.assertEqual(state[str(Path('Service & repair history') / 'first.txt')]['record_id'], 'saved-record')
        self.assertNotIn('status', state)
        self.assertNotIn(str(Path('Service & repair history') / 'second.txt'), state)

    def test_portal_comparison_stops_without_touching_originals(self):
        photos = self.folder / 'Workshop photos'
        photos.mkdir()
        original = photos / 'original.jpg'
        original.write_bytes(b'untouched workshop original')
        asset = {'vault_records': {'job_id': 'job'}}
        def request_photos(*args, **kwargs):
            self.pause.touch()
            return [asset]
        with patch.object(uploader, 'manifest_for', return_value={'schema': 1, 'job_id': 'job'}), \
             patch.object(uploader, 'linked_job_manifests', return_value=[]), \
             patch.object(uploader, 'published_photos', side_effect=request_photos):
            with self.assertRaises(uploader.PauseRequested):
                uploader.sync_portal_photos(self.folder, self.connection)
        self.assertEqual(original.read_bytes(), b'untouched workshop original')
        self.assertFalse((self.folder / '.psi-upload-status.json').exists())

    def test_native_signature_preserves_exact_original_cell_averages(self):
        for width, height in ((1, 1), (17, 23), (64, 64), (127, 131)):
            image = Image.new('RGB', (width, height))
            image.putdata([((i * 7) % 256, (i * 13) % 256, (i * 19) % 256) for i in range(width * height)])
            pixels = image.load()
            expected = []
            for y in range(64):
                for x in range(64):
                    x0, y0 = x * width // 64, y * height // 64
                    x1, y1 = max(x0 + 1, (x + 1) * width // 64), max(y0 + 1, (y + 1) * height // 64)
                    sums = [0, 0, 0]
                    for py in range(y0, y1):
                        for px in range(x0, x1):
                            pixel = pixels[min(px, width - 1), min(py, height - 1)]
                            for channel in range(3):
                                sums[channel] += pixel[channel]
                    count = (x1 - x0) * (y1 - y0)
                    expected.extend(int(total / count + .5) for total in sums)
            output = io.BytesIO()
            image.save(output, 'PNG')
            self.assertEqual(uploader.photo_signature(output.getvalue()),
                             f'rgb64:{width}:{height}:' + bytes(expected).hex())


if __name__ == '__main__':
    unittest.main()
