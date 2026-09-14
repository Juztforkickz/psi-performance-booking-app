"""PSI workshop importer. Originals stay on disk; explicit job manifests are mandatory.

Prepare locally: python psi_uploads.py --root "C:/PSI Uploads" --prepare-only
Upload: python psi_uploads.py --root "C:/PSI Uploads" --url https://PROJECT.supabase.co --key PUBLIC_KEY --email STAFF_EMAIL
The login requires the existing staff email code and MFA. No service-role key is used.
"""
import argparse
import base64
import ctypes
from ctypes import wintypes
import getpass
import hashlib
import io
import json
import os
from pathlib import Path
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from datetime import date, timedelta
import re
from PIL import Image, ImageOps

CATEGORIES = {'before': ('media', 'before'), 'progress': ('media', 'progress'), 'after': ('media', 'after'), 'dyno': ('dyno', None), 'invoices': ('invoice', None), 'documents': ('document', None)}


class SessionStore:
    """Persist only the rotating refresh token, protected for this Windows user."""
    class _Blob(ctypes.Structure):
        _fields_ = [('size', wintypes.DWORD), ('data', ctypes.POINTER(ctypes.c_byte))]

    def __init__(self, path):
        self.path = Path(path)

    @classmethod
    def _protect(cls, value, decrypt=False):
        if os.name != 'nt':
            raise RuntimeError('Remembered sign-in requires Windows DPAPI')
        source = ctypes.create_string_buffer(value)
        incoming = cls._Blob(len(value), ctypes.cast(source, ctypes.POINTER(ctypes.c_byte)))
        outgoing = cls._Blob()
        function = ctypes.windll.crypt32.CryptUnprotectData if decrypt else ctypes.windll.crypt32.CryptProtectData
        description = ctypes.c_wchar_p()
        if decrypt:
            ok = function(ctypes.byref(incoming), ctypes.byref(description), None, None, None, 1, ctypes.byref(outgoing))
        else:
            ok = function(ctypes.byref(incoming), 'PSI Workshop Uploader', None, None, None, 1, ctypes.byref(outgoing))
        if not ok:
            raise ctypes.WinError()
        try:
            return ctypes.string_at(outgoing.data, outgoing.size)
        finally:
            ctypes.windll.kernel32.LocalFree(outgoing.data)

    def save(self, refresh_token):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        temporary = self.path.with_suffix(self.path.suffix + '.tmp')
        temporary.write_bytes(self._protect(refresh_token.encode('utf-8')))
        temporary.replace(self.path)

    def load(self):
        if not self.path.is_file():
            return None
        return self._protect(self.path.read_bytes(), decrypt=True).decode('utf-8')

    def clear(self):
        self.path.unlink(missing_ok=True)

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
    def __init__(self, url, key, session_store=None):
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
        self.session_store = session_store
        self.token, self.refresh, self.expires = '', '', 0
        self.verified_jobs = {}

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
        if self.session_store:
            self.session_store.save(self.refresh)

    def validate_staff(self):
        try:
            payload = json.loads(base64.urlsafe_b64decode(self.token.split('.')[1] + '==='))
        except (ValueError, IndexError, KeyError, json.JSONDecodeError):
            raise RuntimeError('The PSI staff session is invalid') from None
        if payload.get('aal') != 'aal2':
            raise RuntimeError('The PSI staff session requires authenticator verification')
        user = self.call('/auth/v1/user')
        self.user_id = user['id']
        staff = self.call('/rest/v1/staff_members?select=status&user_id=eq.' + self.user_id)
        if not staff or staff[0]['status'] != 'active':
            raise RuntimeError('An active PSI staff account is required')

    def restore(self):
        refresh = self.session_store.load() if self.session_store else None
        if not refresh:
            return False
        try:
            self.set_session(self.call('/auth/v1/token?grant_type=refresh_token', 'POST', {'refresh_token': refresh}))
            self.validate_staff()
            return True
        except Exception:
            self.token, self.refresh, self.expires = '', '', 0
            self.session_store.clear()
            return False

    def login(self, email):
        try:
            self.call('/auth/v1/otp', 'POST', {'email': email, 'create_user': False})
            prompt = 'PSI email code: '
        except RequestFailure as error:
            if error.status != 429:
                raise
            prompt = 'Email limit reached. Enter a recent unused PSI email code, or press Enter to wait: '
        email_code = getpass.getpass(prompt).strip()
        if not email_code:
            raise RuntimeError('Supabase has temporarily limited new sign-in emails. Wait at least 60 seconds; if the project uses the built-in email service, its shared limit can be two emails per hour.')
        session = self.call('/auth/v1/verify', 'POST', {'email': email, 'token': email_code, 'type': 'email'})
        self.set_session(session)
        user = self.call('/auth/v1/user')
        factors = [f for f in user.get('factors', []) if f.get('factor_type') == 'totp' and f.get('status') == 'verified']
        if not factors:
            raise RuntimeError('Enrol the staff authenticator in the PSI portal first')
        factor = factors[0]['id']
        challenge = self.call(f'/auth/v1/factors/{factor}/challenge', 'POST', {})
        self.set_session(self.call(f'/auth/v1/factors/{factor}/verify', 'POST', {'challenge_id': challenge['id'], 'code': getpass.getpass('Authenticator code: ')}))
        self.validate_staff()

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
        if getattr(connection, 'verified_jobs', {}).get(manifest['job_id']) == manifest:
            return manifest
        jobs = connection.call('/rest/v1/workshop_jobs?select=*&id=eq.' + manifest['job_id'])
        if len(jobs) != 1 or any(jobs[0][f] != manifest[f] for f in ('customer_id', 'vehicle_id', 'reference', 'job_date')):
            raise ValueError('Job, customer or vehicle does not match the server')
        vehicles = connection.call('/rest/v1/customer_vehicles?select=registration,customer_id,archived_at&id=eq.' + manifest['vehicle_id'])
        if len(vehicles) != 1 or vehicles[0]['registration'] != manifest['registration'] or vehicles[0]['archived_at'] or vehicles[0]['customer_id'] != manifest['customer_id']:
            raise ValueError('Vehicle identity changed; PSI must review the folder')
    return manifest

def create_folder_from_manifest(root, manifest):
    label = re.sub(r'[^A-Z0-9._-]+', '-', f'{manifest["reference"]} - {manifest["registration"]}'.upper())
    label = re.sub(r'-{2,}', '-', label).strip('-._')
    if not label:
        raise ValueError('Manifest has no safe job folder label')
    folder = root / label
    folder.mkdir(parents=True, exist_ok=True)
    destination = folder / 'psi-job.json'
    if destination.exists():
        existing = json.loads(destination.read_text(encoding='utf-8-sig'))
        if existing != manifest:
            raise ValueError('This folder already contains a different PSI job manifest')
    else:
        atomic_json(destination, manifest)
    for category in CATEGORIES:
        (folder / category).mkdir(exist_ok=True)
    return folder


def create_job_folder(root, manifest_path, connection=None):
    """Create one verified folder tree from a portal-downloaded manifest."""
    source = Path(manifest_path).resolve(strict=True)
    temporary = source.parent / (source.name + '.psi-verify')
    temporary.mkdir(exist_ok=False)
    try:
        (temporary / 'psi-job.json').write_bytes(source.read_bytes())
        manifest = manifest_for(temporary, connection)
    finally:
        (temporary / 'psi-job.json').unlink(missing_ok=True)
        temporary.rmdir()
    return create_folder_from_manifest(root, manifest)


def manifest_from_job(connection, job, vehicle=None):
    if vehicle is None:
        vehicles = connection.call(
            '/rest/v1/customer_vehicles?select=id,customer_id,registration,archived_at&id=eq.' + job['vehicle_id']
        )
        vehicle = vehicles[0] if len(vehicles) == 1 else None
    if not vehicle or vehicle['archived_at'] or vehicle['customer_id'] != job['customer_id']:
        raise ValueError('The workshop job vehicle is unavailable')
    return {
        'schema': 1,
        'project_ref': urllib.parse.urlparse(connection.url).hostname.split('.')[0],
        'job_id': job['id'],
        'customer_id': job['customer_id'],
        'vehicle_id': job['vehicle_id'],
        'registration': vehicle['registration'],
        'reference': job['reference'],
        'job_date': job['job_date'],
    }


def sync_job_folders(root, connection, days_back=30):
    """Create local folders for recent/future confirmed and manual workshop jobs."""
    earliest = (date.today() - timedelta(days=days_back)).isoformat()
    path = ('/rest/v1/workshop_jobs?select=id,customer_id,vehicle_id,reference,title,job_date'
            '&job_date=gte.' + earliest + '&order=job_date.asc&limit=500')
    vehicles = connection.call(
        '/rest/v1/customer_vehicles?select=id,customer_id,registration,archived_at&archived_at=is.null&limit=2000'
    )
    vehicles_by_id = {vehicle['id']: vehicle for vehicle in vehicles}
    connection.verified_jobs = {}
    created, errors = [], []
    for job in connection.call(path):
        try:
            manifest = manifest_from_job(connection, job, vehicles_by_id.get(job['vehicle_id']))
            connection.verified_jobs[job['id']] = manifest
            folder = create_folder_from_manifest(root, manifest)
            created.append(folder)
        except Exception as error:
            errors.append(f'{job.get("reference", "Unknown job")}: {error}')
    return created, errors


def import_manifest_inbox(root, inbox, connection):
    """Import valid PSI manifests without moving or deleting downloaded files."""
    imported = []
    inbox = Path(inbox)
    if not inbox.is_dir():
        return imported
    for path in sorted(inbox.glob('*.json')):
        try:
            candidate = json.loads(path.read_text(encoding='utf-8-sig'))
            if candidate.get('schema') != 1 or not all(candidate.get(field) for field in ('job_id', 'customer_id', 'vehicle_id')):
                continue
            imported.append(create_job_folder(root, path, connection))
        except (OSError, ValueError, KeyError, json.JSONDecodeError):
            continue
    return imported


def create_manual_job(root, connection, input_fn=input):
    """Create an AAL2 staff-authorized workshop job for an existing app vehicle."""
    registration = re.sub(r'\s+', '', input_fn('Vehicle registration: ').upper())
    if not registration:
        raise ValueError('Enter the vehicle registration')
    vehicles = connection.call(
        '/rest/v1/customer_vehicles?select=id,customer_id,registration,year,make,model,archived_at'
        '&archived_at=is.null&registration=eq.' + urllib.parse.quote(registration, safe='')
    )
    if not vehicles:
        raise ValueError('No active app vehicle matches that registration. Add or invite the customer in the PSI portal first.')
    choices = []
    for vehicle in vehicles:
        customers = connection.call(
            '/rest/v1/customer_profiles?select=user_id,first_name,last_name,email&user_id=eq.' + vehicle['customer_id']
        )
        if customers:
            customer = customers[0]
            name = ' '.join(filter(None, (customer.get('first_name'), customer.get('last_name')))).strip() or customer['email']
            choices.append((vehicle, name))
    if not choices:
        raise ValueError('The matching vehicle owner is unavailable')
    for index, (vehicle, name) in enumerate(choices, 1):
        print(f'{index}. {vehicle["year"]} {vehicle["make"]} {vehicle["model"]} · {name}')
    selected = int(input_fn('Choose vehicle: ') or '1')
    if selected < 1 or selected > len(choices):
        raise ValueError('Choose one of the listed vehicles')
    vehicle, _ = choices[selected - 1]
    job_date = input_fn(f'Job date [{date.today().isoformat()}]: ').strip() or date.today().isoformat()
    date.fromisoformat(job_date)
    kind = input_fn('Job type (service/dyno) [service]: ').strip().lower() or 'service'
    if kind not in ('service', 'dyno'):
        raise ValueError('Job type must be service or dyno')
    default_title = ('Dyno tuning' if kind == 'dyno' else 'Service') + ' · ' + vehicle['registration']
    title = input_fn(f'Job description [{default_title}]: ').strip() or default_title
    if len(title.encode('utf-8')) > 180:
        raise ValueError('Job description is too long')
    reference = 'PSI-PHONE-' + job_date.replace('-', '') + '-' + uuid.uuid4().hex[:8].upper()
    job = connection.call('/rest/v1/workshop_jobs', 'POST', {
        'customer_id': vehicle['customer_id'],
        'vehicle_id': vehicle['id'],
        'reference': reference,
        'title': title,
        'job_date': job_date,
        'created_by': connection.user_id,
    }, headers={'Prefer': 'return=representation'})[0]
    manifest = manifest_from_job(connection, job, vehicle)
    connection.verified_jobs[job['id']] = manifest
    return create_folder_from_manifest(root, manifest)

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
    parser.add_argument('--add-job', metavar='MANIFEST', help='Create verified job folders from a portal-downloaded manifest')
    parser.add_argument('--manual-job', action='store_true', help='Create a phone/walk-in job for an existing app vehicle')
    parser.add_argument('--manifest-inbox', help='Automatically import valid PSI job JSON files from this folder')
    parser.add_argument('--session-file', help='DPAPI-protected remembered staff session file')
    parser.add_argument('--forget-session', action='store_true')
    parser.add_argument('--stop-file', help='Signal file used to stop the background watcher safely')
    parser.add_argument('--non-interactive', action='store_true', help='Exit instead of prompting when remembered sign-in is unavailable')
    parser.add_argument('--sync-days-back', type=int, default=30)
    parser.add_argument('--url'); parser.add_argument('--key'); parser.add_argument('--email')
    args = parser.parse_args()
    root = Path(args.root).resolve()
    session_store = SessionStore(args.session_file) if args.session_file else None
    if args.forget_session:
        if not session_store:
            parser.error('--forget-session requires --session-file')
        session_store.clear()
        if args.stop_file:
            Path(args.stop_file).write_text('stop', encoding='ascii')
        print('The remembered PSI staff sign-in was removed from this Windows account.')
        return
    if args.add_job:
        root.mkdir(parents=True, exist_ok=True)
        folder = create_job_folder(root, args.add_job)
        print(f'Created PSI job folder: {folder}')
        return
    root = root.resolve(strict=True)
    connection = None
    if not args.prepare_only:
        if not all((args.url, args.key, args.email)):
            parser.error('Upload requires --url, --key (publishable only), and --email')
        connection = Connection(args.url, args.key, session_store)
        if connection.restore():
            print('Restored the protected PSI staff sign-in for this Windows account.')
        elif args.non_interactive:
            print('Automatic watcher paused: use the desktop shortcut to sign in again.')
            return 3
        else:
            connection.login(args.email)
            print('PSI staff sign-in protected for automatic restarts.')
        if args.stop_file and not args.non_interactive:
            Path(args.stop_file).unlink(missing_ok=True)
    if args.manual_job:
        root.mkdir(parents=True, exist_ok=True)
        folder = create_manual_job(root, connection)
        print(f'Created phone/walk-in PSI job: {folder}')
        return
    try:
        while True:
            if args.stop_file and Path(args.stop_file).exists():
                print('Automatic watcher stopped by the desktop controls.')
                break
            if connection:
                folders, sync_errors = sync_job_folders(root, connection, max(0, args.sync_days_back))
                if folders:
                    print(f'Synced {len(folders)} confirmed/manual workshop job folder(s).')
                for error in sync_errors:
                    print('Job folder needs review: ' + error)
                if args.manifest_inbox:
                    imported = import_manifest_inbox(root, args.manifest_inbox, connection)
                    if imported:
                        print(f'Imported {len(imported)} downloaded PSI job file(s).')
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
        if connection and not session_store:
            try: connection.call('/auth/v1/logout?scope=local', 'POST', {})
            except Exception: pass

if __name__ == '__main__':
    try:
        raise SystemExit(main() or 0)
    except (RequestFailure, RuntimeError, ValueError, OSError) as error:
        print('PSI Workshop Uploads: ' + str(error), file=sys.stderr)
        raise SystemExit(1) from None
