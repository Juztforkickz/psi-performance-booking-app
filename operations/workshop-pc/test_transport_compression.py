import gzip
import io
import json
import unittest
from unittest.mock import patch
import urllib.error

from psi_uploads import Connection, RequestFailure


class Response(io.BytesIO):
    def __init__(self, content, encoding=None):
        super().__init__(content)
        self.headers = {'Content-Encoding': encoding} if encoding else {}


class TransportCompressionTests(unittest.TestCase):
    def setUp(self):
        self.connection = Connection('https://test.supabase.co', 'sb_publishable_test')
        self.connection.token = 'existing-staff-token'

    def test_data_api_get_negotiates_gzip_and_preserves_complete_json(self):
        value = [{'id': 'test-record', 'notes': 'Complete line one\nLine two, café', 'number': 17}]
        payload = json.dumps(value).encode()
        with patch('urllib.request.urlopen', return_value=Response(gzip.compress(payload), 'gzip')) as opened:
            self.assertEqual(self.connection.call('/rest/v1/repair_records?select=*'), value)
        request = opened.call_args.args[0]
        self.assertEqual(request.get_header('Accept-encoding'), 'gzip')
        self.assertEqual(request.get_header('Authorization'), 'Bearer existing-staff-token')
        self.assertEqual(request.get_header('Apikey'), 'sb_publishable_test')
        self.assertEqual(opened.call_args.kwargs['timeout'], 45)

    def test_plain_json_fallback_is_unchanged(self):
        with patch('urllib.request.urlopen', return_value=Response(b'[{"id":"plain"}]')):
            self.assertEqual(self.connection.call('/rest/v1/invoices'), [{'id': 'plain'}])

    def test_binary_download_bytes_are_untouched(self):
        payload = b'%PDF-original-private-file'
        with patch('urllib.request.urlopen', return_value=Response(payload)) as opened:
            self.assertEqual(self.connection.call('/storage/v1/object/authenticated/test/original.pdf', read_binary=True), payload)
        self.assertIsNone(opened.call_args.args[0].get_header('Accept-encoding'))
        self.assertEqual(opened.call_args.kwargs['timeout'], 180)

    def test_auth_and_upload_requests_do_not_negotiate_compression(self):
        for path, method, arguments in (
            ('/auth/v1/token?grant_type=refresh_token', 'POST', {'data': {'refresh_token': 'test'}}),
            ('/storage/v1/object/test/original.jpg', 'POST', {'binary': b'original-jpeg-bytes'}),
            ('/rest/v1/vault_assets?id=eq.test', 'PATCH', {'data': {'ready': True}}),
        ):
            with self.subTest(path=path), patch('urllib.request.urlopen', return_value=Response(b'{}')) as opened:
                self.connection.call(path, method, **arguments)
                self.assertIsNone(opened.call_args.args[0].get_header('Accept-encoding'))

    def test_explicit_identity_request_header_is_respected(self):
        with patch('urllib.request.urlopen', return_value=Response(b'[]')) as opened:
            self.assertEqual(self.connection.call('/rest/v1/vault_assets', headers={'Accept-Encoding': 'identity'}), [])
        self.assertEqual(opened.call_args.args[0].get_header('Accept-encoding'), 'identity')

    def test_corrupt_gzip_fails_closed_without_retrying_a_write(self):
        with patch('urllib.request.urlopen', return_value=Response(b'not-gzip', 'gzip')) as opened:
            with self.assertRaises(OSError):
                self.connection.call('/rest/v1/vault_assets')
        self.assertEqual(opened.call_count, 1)

    def test_http_authorization_failure_still_uses_existing_error_path(self):
        error = urllib.error.HTTPError('https://test.supabase.co/rest/v1/vault_assets', 403, 'Forbidden', {}, io.BytesIO(b'{}'))
        with patch('urllib.request.urlopen', side_effect=error):
            with self.assertRaises(RequestFailure) as failed:
                self.connection.call('/rest/v1/vault_assets')
        self.assertEqual(failed.exception.status, 403)


if __name__ == '__main__':
    unittest.main()
