"""Offline request/byte regression coverage; fixtures contain no customer data."""
import json
import unittest
from urllib.parse import parse_qs, urlsplit
from unittest.mock import patch

import psi_uploads as u


def ident(number):
    return f'00000000-0000-4000-8000-{number:012d}'


class EgressTests(unittest.TestCase):
    def setUp(self):
        self.manifests = [{'customer_id': ident(n), 'vehicle_id': ident(n + 100)} for n in range(1, 21)]
        self.rows = [{**m, 'id': ident(n + 200), 'record_id': ident(n + 300),
                      'object_path': 'fictional/photo.jpg', 'mime_type': 'image/jpeg', 'size_bytes': 100,
                      'sha256': 'a' * 64, 'source_sha256': 'b' * 64,
                      'visual_signature': 'rgb64:100:100:' + 'ab' * 12288,
                      'vault_records': {'kind': 'media', 'published_at': '2026-10-21', 'job_id': ident(n + 400)}}
                     for n, m in enumerate(self.manifests)]
        self.calls = []
        self.bytes = 0
        outer = self

        class Connection:
            report_scopes = {(m['customer_id'], m['vehicle_id']) for m in outer.manifests}
            report_rows = {}

            def call(self, path):
                outer.calls.append(path)
                query = parse_qs(urlsplit(path).query)
                rows = outer.rows
                if 'customer_id' in query:
                    rows = [r for r in rows if r['customer_id'] == query['customer_id'][0][3:]
                            and r['vehicle_id'] == query['vehicle_id'][0][3:]]
                elif len(self.report_scopes) == 1:
                    rows = [r for r in rows if (r['customer_id'], r['vehicle_id']) in self.report_scopes]
                if not query['select'][0].startswith('*'):
                    fields = query['select'][0].split(',vault_records!')[0].split(',') + ['vault_records']
                    rows = [{k: r[k] for k in fields} for r in rows]
                offset = int(query['offset'][0])
                rows = rows[offset:offset + int(query['limit'][0])]
                outer.bytes += len(json.dumps(rows, separators=(',', ':')).encode())
                return rows

        self.c = Connection()

    def test_routine_scan_batches_requests_and_omits_signature(self):
        for m in self.manifests:
            u.published_photos(self.c, m)
        before = (len(self.calls), self.bytes)
        self.calls.clear()
        self.bytes = 0
        for m in self.manifests:
            rows = u.published_photos(self.c, m, for_download=True)
            self.assertEqual(len(rows), 1)
            self.assertEqual(rows[0]['customer_id'], m['customer_id'])
            self.assertNotIn('visual_signature', rows[0])
        after = (len(self.calls), self.bytes)
        self.assertEqual(before[0], 20)
        self.assertEqual(after[0], 1)
        self.assertLess(after[1], before[1] / 10)
        print(f'OFFLINE FIXTURE: requests {before[0]} -> {after[0]}; JSON bytes {before[1]} -> {after[1]}')

    def test_next_scan_sees_new_assets(self):
        manifest = self.manifests[0]
        self.assertEqual(len(u.published_photos(self.c, manifest, for_download=True)), 1)
        self.rows.append({**self.rows[0], 'id': ident(999)})
        # configure_report_scan resets the shared cache at every scan boundary.
        with patch.object(u, 'manifest_for', return_value={**manifest, 'schema': 1}), \
             patch.object(u, '_read_vehicle_workspace', return_value=None):
            u.configure_report_scan(self.c, [object()])
        self.assertEqual(len(u.published_photos(self.c, manifest, for_download=True)), 2)

    def test_unverified_response_is_rejected(self):
        self.rows.append({**self.rows[0], 'customer_id': ident(999)})
        with self.assertRaisesRegex(ValueError, 'ownership scope'):
            u.published_photos(self.c, self.manifests[0], for_download=True)

    def test_upload_comparisons_still_get_signatures(self):
        self.assertIn('visual_signature', u.published_photos(self.c, self.manifests[0])[0])


if __name__ == '__main__':
    unittest.main()
