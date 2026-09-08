"""PSI workshop importer. Originals stay on disk; explicit job manifests are mandatory.

Prepare locally: python psi_uploads.py --root "C:/PSI Uploads" --prepare-only
Upload: python psi_uploads.py --root "C:/PSI Uploads" --url https://PROJECT.supabase.co --key PUBLIC_KEY --email STAFF_EMAIL
The login requires the existing staff email code and MFA. No service-role key is used.
"""
import argparse
import getpass
import hashlib
import io
import json
import os
from pathlib import Path
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from datetime import date
from PIL import Image, ImageOps

CATEGORIES = {'before': ('media', 'before'), 'progress': ('media', 'progress'), 'after': ('media', 'after'), 'dyno': ('dyno', None), 'invoices': ('invoice', None), 'documents': ('document', None)}

class RequestFailure(RuntimeError):
    def __init__(self, status):
        self.status = status
        super().__init__(f'PSI request failed ({status}); check staff access and retry')

def atomic_json(path, value):
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(json.dumps(value, indent=2), encoding='utf-8')
    temporary.replace(path)

def prepare_file(path):
    """Bound size, honour orientation, strip EXIF/GPS, preserve PDF originals."""
    if path.stat().st_size > 40 * 1024 * 1024:
        raise ValueError('Source exceeds 40 MB')
    raw = path.read_bytes()
    if path.suffix.lower() == '.pdf':
        if not raw.startswith(b'%PDF-') or len(raw) > 20 * 1024 * 1024:
            raise ValueError('Invalid or oversized PDF')
        return raw, None, 'application/pdf'
    with Image.open(io.BytesIO(raw)) as source:
        source.load()
        im = ImageOps.exif_transpose(source).convert('RGB')
    im.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
    original = io.BytesIO()
    im.save(original, 'JPEG', quality=82, optimize=True)
    im.thumbnail((360, 360), Image.Resampling.LANCZOS)
    thumb = io.BytesIO()
    im.save(thumb, 'JPEG', quality=72, optimize=True)
    return original.getvalue(), thumb.getvalue(), 'image/jpeg'

class Connection:
    def __init__(self, url, key):
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme != 'https' or not parsed.hostname or not parsed.hostname.endswith('.supabase.co') or parsed.path not in ('', '/'):
            raise ValueError('Use the exact HTTPS Supabase project URL')
        if key.startswith('sb_secret_'):
            raise ValueError('Only a publishable key is allowed on the workshop PC')
        if key.count('.') == 2:
            import base64
            payload = json.loads(base64.urlsafe_b64decode(key.split('.')[1] + '==='))
            if payload.get('role') != 'anon':
                raise ValueError('Never put a service-role key on the workshop PC')
        self.url, self.key = url.rstrip('/'), key
        self.token, self.refresh, self.expires = '', '', 0

    def call(self, path, method='GET', data=None, binary=None, headers=None, read_binary=False):
        if self.refresh and time.time() > self.expires - 90 and not path.startswith('/auth/'):
            self.set_session(self.call('/auth/v1/token?grant_type=refresh_token', 'POST', {'refresh_token': self.refresh}))
        body = binary if binary is not None else json.dumps(data).encode() if data is not None else None
        h = {'apikey': self.key, 'Authorization': 'Bearer ' + (self.token or self.key), 'Content-Type': 'application/json'}
        h.update(headers or {})
        req = urllib.request.Request(self.url + path, data=body, method=method, headers=h)
        try:
            with urllib.request.urlopen(req, timeout=45) as response:
                result = response.read()
                return result if read_binary else json.loads(result) if result else None
        except urllib.error.HTTPError as e:
            # Do not log request tokens, customer response bodies or private file URLs.
            status = e.code
            if status == 400 and path.startswith('/storage/v1/object/authenticated/'):
                try:
                    detail = json.loads(e.read(2048))
                    if str(detail.get('statusCode')) == '404' and detail.get('message', '').lower() == 'object not found':
                        status = 404
                except (ValueError, UnicodeError):
                    pass
            raise RequestFailure(status) from None

    def set_session(self, session):
        self.token = session['access_token']
        self.refresh = session['refresh_token']
        self.expires = time.time() + session.get('expires_in', 3600)

    def login(self, email):
        self.call('/auth/v1/otp', 'POST', {'email': email, 'create_user': False})
        session = self.call('/auth/v1/verify', 'POST', {'email': email, 'token': getpass.getpass('PSI email code: '), 'type': 'email'})
        self.set_session(session)
        user = self.call('/auth/v1/user')
        factors = [f for f in user.get('factors', []) if f.get('factor_type') == 'totp' and f.get('status') == 'verified']
        if not factors:
            raise RuntimeError('Enrol the staff authenticator in the PSI portal first')
        factor = factors[0]['id']
        challenge = self.call(f'/auth/v1/factors/{factor}/challenge', 'POST', {})
        self.set_session(self.call(f'/auth/v1/factors/{factor}/verify', 'POST', {'challenge_id': challenge['id'], 'code': getpass.getpass('Authenticator code: ')}))
        self.user_id = user['id']
        staff = self.call('/rest/v1/staff_members?select=status&user_id=eq.' + self.user_id)
        if not staff or staff[0]['status'] != 'active':
            raise RuntimeError('An active PSI staff account is required')

def manifest_for(folder, connection=None):
    manifest = json.loads((folder / 'psi-job.json').read_text(encoding='utf-8-sig'))
    for field in ('job_id', 'customer_id', 'vehicle_id'):
        uuid.UUID(manifest[field])
    if manifest.get('schema') != 1 or not manifest.get('reference') or not manifest.get('registration'):
        raise ValueError('Incomplete PSI job manifest')
    date.fromisoformat(manifest['job_date'])
    if connection:
        if manifest.get('project_ref') != urllib.parse.urlparse(connection.url).hostname.split('.')[0]:
            raise ValueError('Manifest belongs to a different PSI environment')
        jobs = connection.call('/rest/v1/workshop_jobs?select=*&id=eq.' + manifest['job_id'])
        if len(jobs) != 1 or any(jobs[0][f] != manifest[f] for f in ('customer_id', 'vehicle_id', 'reference', 'job_date')):
            raise ValueError('Job, customer or vehicle does not match the server')
        vehicles = connection.call('/rest/v1/customer_vehicles?select=registration,customer_id,archived_at&id=eq.' + manifest['vehicle_id'])
        if len(vehicles) != 1 or vehicles[0]['registration'] != manifest['registration'] or vehicles[0]['archived_at'] or vehicles[0]['customer_id'] != manifest['customer_id']:
            raise ValueError('Vehicle identity changed; PSI must review the folder')
    return manifest

def ensure_object(connection, path, content, mime):
    """Resume only when an existing private object's bytes are identical."""
    try:
        existing = connection.call('/storage/v1/object/authenticated/performance-vault/' + path, read_binary=True)
    except RequestFailure as error:
        if error.status != 404:
            raise
        connection.call('/storage/v1/object/performance-vault/' + path, 'POST', binary=content,
                        headers={'Content-Type': mime, 'Cache-Control': 'no-store', 'x-upsert': 'false'})
        return
    if hashlib.sha256(existing).digest() != hashlib.sha256(content).digest():
        raise ValueError('An existing private object has different contents; PSI review required')

def process_job(folder, connection=None):
    manifest = manifest_for(folder, connection)
    state_path = folder / '.psi-upload-status.json'
    state = json.loads(state_path.read_text()) if state_path.exists() else {}
    for category, (kind, phase) in CATEGORIES.items():
        category_path = folder / category
        if not category_path.is_dir() or category_path.is_symlink():
            continue
        for path in sorted(category_path.iterdir()):
            if path.is_symlink() or not path.is_file() or path.suffix.lower() not in ('.jpg', '.jpeg', '.png', '.webp', '.pdf', '.tif', '.tiff'):
                continue
            relative = str(path.relative_to(folder))
            try:
                before = (path.stat().st_size, path.stat().st_mtime_ns)
                # Wait for completed file transfers before processing.
                if time.time() - path.stat().st_mtime < 5:
                    continue
                content, thumb, mime = prepare_file(path)
                if before != (path.stat().st_size, path.stat().st_mtime_ns):
                    continue
                if kind in ('dyno', 'invoice') and mime != 'application/pdf':
                    raise ValueError('Dyno and invoice folders accept PDF files only')
                digest = hashlib.sha256(content).hexdigest()
                source_key = f'pc:{manifest["job_id"]}:{category}:{digest}'
                if state.get(relative, {}).get('key') == source_key and state[relative]['status'] == 'uploaded':
                    continue
                if not connection:
                    out = folder / '.psi-prepared' / category
                    out.mkdir(parents=True, exist_ok=True)
                    (out / (digest + ('.pdf' if mime == 'application/pdf' else '.jpg'))).write_bytes(content)
                    if thumb:
                        (out / (digest + '-thumb.jpg')).write_bytes(thumb)
                    state[relative] = {'key': source_key, 'status': 'prepared', 'bytes': len(content), 'thumbnail_bytes': len(thumb or b'')}
                else:
                    existing = connection.call('/rest/v1/vault_records?select=*&source_reference=eq.' + urllib.parse.quote(source_key, safe=''))
                    if existing and existing[0]['published_at']:
                        state[relative] = {'key': source_key, 'status': 'uploaded'}
                        atomic_json(state_path, state)
                        continue
                    if existing:
                        record = existing[0]
                    else:
                        record = connection.call('/rest/v1/vault_records', 'POST', {'job_id': manifest['job_id'], 'customer_id': manifest['customer_id'], 'vehicle_id': manifest['vehicle_id'], 'kind': kind, 'title': path.stem[:180], 'notes': '', 'occurred_on': manifest['job_date'], 'source': 'staff', 'source_reference': source_key, 'created_by': connection.user_id}, headers={'Prefer': 'return=representation'})[0]
                    assets = connection.call('/rest/v1/vault_assets?select=*&record_id=eq.' + record['id'])
                    if len(assets) > 1:
                        raise ValueError('Unexpected assets on this imported record; PSI review required')
                    if not assets:
                        asset_id = str(uuid.uuid4())
                        base = f'{manifest["customer_id"]}/{manifest["vehicle_id"]}/{record["id"]}/{asset_id}'
                        object_path = base + ('/original.pdf' if mime == 'application/pdf' else '/original.jpg')
                        thumb_path = base + '/thumb.jpg' if thumb else None
                        connection.call('/rest/v1/vault_assets', 'POST', {'id': asset_id, 'record_id': record['id'], 'customer_id': manifest['customer_id'], 'vehicle_id': manifest['vehicle_id'], 'object_path': object_path, 'thumbnail_path': thumb_path, 'mime_type': mime, 'size_bytes': len(content), 'sha256': digest, 'caption': path.name[:300], 'phase': phase, 'created_by': connection.user_id})
                        assets = [{'id': asset_id, 'object_path': object_path, 'thumbnail_path': thumb_path,
                                   'sha256': digest, 'size_bytes': len(content), 'ready': False}]
                    if not assets[0]['ready']:
                        asset = assets[0]
                        base = f'{manifest["customer_id"]}/{manifest["vehicle_id"]}/{record["id"]}/{asset["id"]}'
                        object_path = base + ('/original.pdf' if mime == 'application/pdf' else '/original.jpg')
                        thumb_path = base + '/thumb.jpg' if thumb else None
                        if asset['sha256'] != digest or asset['size_bytes'] != len(content) or asset['object_path'] != object_path or asset['thumbnail_path'] != thumb_path:
                            raise ValueError('Reserved asset does not match this file; PSI review required')
                        ensure_object(connection, object_path, content, mime)
                        if thumb:
                            ensure_object(connection, thumb_path, thumb, 'image/jpeg')
                        connection.call('/rest/v1/vault_assets?id=eq.' + asset['id'], 'PATCH', {'ready': True})
                    from datetime import datetime, timezone
                    connection.call('/rest/v1/vault_records?id=eq.' + record['id'], 'PATCH', {'published_at': datetime.now(timezone.utc).isoformat()})
                    state[relative] = {'key': source_key, 'status': 'uploaded'}
            except Exception as error:
                state[relative] = {'status': 'needs_review', 'error': str(error)}
            atomic_json(state_path, state)
    return state

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', required=True)
    parser.add_argument('--prepare-only', action='store_true')
    parser.add_argument('--watch', action='store_true')
    parser.add_argument('--url'); parser.add_argument('--key'); parser.add_argument('--email')
    args = parser.parse_args()
    root = Path(args.root).resolve(strict=True)
    connection = None
    if not args.prepare_only:
        if not all((args.url, args.key, args.email)):
            parser.error('Upload requires --url, --key (publishable only), and --email')
        connection = Connection(args.url, args.key)
        connection.login(args.email)
    try:
        while True:
            for folder in root.iterdir():
                if not folder.is_dir() or folder.is_symlink():
                    continue
                try:
                    if not (folder / 'psi-job.json').is_file():
                        atomic_json(folder / '.psi-upload-status.json', {'status': 'needs_review', 'error': 'No verified psi-job.json; nothing uploaded'})
                        continue
                    process_job(folder, connection)
                except Exception as error:
                    atomic_json(folder / '.psi-upload-status.json', {'status': 'needs_review', 'error': str(error)})
            print('Scan complete. Check each job folder’s .psi-upload-status.json for results.')
            if not args.watch:
                break
            time.sleep(30)
    finally:
        if connection:
            try: connection.call('/auth/v1/logout?scope=local', 'POST', {})
            except Exception: pass

if __name__ == '__main__':
    main()
