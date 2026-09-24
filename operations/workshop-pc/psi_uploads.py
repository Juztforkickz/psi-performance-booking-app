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
from datetime import date, datetime, timedelta
import re
from PIL import Image, ImageOps

CATEGORIES = {
    'Service & repair history': ('service', None, 'service'),
    'Recommended work': ('recommendation', None, 'recommendation'),
    'Dyno results & graphs': ('dyno', None, 'dyno'),
    'Invoice archive': ('invoice', None, 'invoices'),
    'Workshop photos': ('media', None, 'photos'),
    "Documents + DTC's": ('document', None, 'documents'),
}
CATEGORY_ALIASES = {
    'photos': 'Workshop photos',
    'dyno': 'Dyno results & graphs',
    'invoices': 'Invoice archive',
    'documents': "Documents + DTC's",
    'Reports & documents': "Documents + DTC's",
}
LEGACY_PHOTO_CATEGORIES = ('before', 'progress', 'after')
TEXT_RECORD_CATEGORIES = {
    'Service & repair history': 'service',
    'Recommended work': 'recommendation',
}


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


def hide_windows_folder(path):
    if os.name != 'nt':
        return
    try:
        attributes = ctypes.windll.kernel32.GetFileAttributesW(str(path))
        if attributes == -1:
            return
        hidden = 0x2
        system = 0x4
        ctypes.windll.kernel32.SetFileAttributesW(str(path), attributes | hidden | system)
    except Exception:
        pass


def prepared_folder(folder):
    path = folder / '.psi-prepared'
    path.mkdir(exist_ok=True)
    hide_windows_folder(path)
    return path


def prepare_file(path):
    """Bound size, honour orientation, strip EXIF/GPS, preserve PDF originals."""
    if path.stat().st_size > 40 * 1024 * 1024:
        raise ValueError('Source exceeds 40 MB')
    raw = path.read_bytes()
    if path.suffix.lower() == '.pdf':
        if not raw.startswith(b'%PDF-') or len(raw) > 20 * 1024 * 1024:
            raise ValueError('Invalid or oversized PDF')
        return raw, None, 'application/pdf'
    if path.suffix.lower() == '.txt':
        if len(raw) > 256 * 1024:
            raise ValueError('Text note exceeds 256 KB')
        raw.decode('utf-8-sig')
        return raw, None, 'text/plain; charset=utf-8'
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
        print(f'Requesting a six-digit PSI app portal sign-in code for {email}...')
        try:
            self.call('/auth/v1/otp', 'POST', {'email': email, 'create_user': False})
            prompt = f'Enter the six-digit code sent to {email} (typing is hidden), then press Enter: '
        except RequestFailure as error:
            if error.status != 429:
                raise
            prompt = f'Email limit reached. Enter a recent unused code for {email} (typing is hidden), or press Enter to wait: '
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
    schema = manifest.get('schema')
    identity_fields = ('job_id', 'customer_id', 'vehicle_id') if schema == 1 else ('job_id', 'workshop_contact_id', 'workshop_vehicle_id')
    if schema not in (1, 2):
        raise ValueError('Unsupported PSI job manifest')
    for field in identity_fields:
        uuid.UUID(manifest[field])
    if not manifest.get('reference') or not manifest.get('registration'):
        raise ValueError('Incomplete PSI job manifest')
    if schema == 2 and manifest.get('owner_type') != 'workshop':
        raise ValueError('Incomplete workshop-only PSI job manifest')
    date.fromisoformat(manifest['job_date'])
    if connection:
        if manifest.get('project_ref') != urllib.parse.urlparse(connection.url).hostname.split('.')[0]:
            raise ValueError('Manifest belongs to a different PSI environment')
        if getattr(connection, 'verified_jobs', {}).get(manifest['job_id']) == manifest:
            return manifest
        jobs = connection.call('/rest/v1/workshop_jobs?select=*&id=eq.' + manifest['job_id'])
        job_fields = ('customer_id', 'vehicle_id', 'reference', 'job_date') if schema == 1 else ('workshop_contact_id', 'workshop_vehicle_id', 'reference', 'job_date')
        if len(jobs) != 1 or any(jobs[0][field] != manifest[field] for field in job_fields):
            raise ValueError('Job, customer or vehicle does not match the server')
        if schema == 1:
            vehicles = connection.call('/rest/v1/customer_vehicles?select=registration,customer_id,archived_at&id=eq.' + manifest['vehicle_id'])
            if len(vehicles) != 1 or vehicles[0]['registration'] != manifest['registration'] or vehicles[0]['archived_at'] or vehicles[0]['customer_id'] != manifest['customer_id']:
                raise ValueError('Vehicle identity changed; PSI must review the folder')
        else:
            vehicles = connection.call('/rest/v1/workshop_vehicles?select=registration,workshop_contact_id,status&id=eq.' + manifest['workshop_vehicle_id'])
            if len(vehicles) != 1 or vehicles[0]['registration'] != manifest['registration'] or vehicles[0]['status'] != 'active' or vehicles[0]['workshop_contact_id'] != manifest['workshop_contact_id']:
                raise ValueError('Workshop-only vehicle identity changed; PSI must review the folder')
    return manifest

def _safe_folder_part(value, limit):
    value = re.sub(r'[<>:"/\\|?*\x00-\x1f]+', '-', str(value or ''))
    value = re.sub(r'\s+', ' ', value).strip(' .-')
    return value[:limit].rstrip(' .-')


def folder_label_for(manifest):
    customer = _safe_folder_part(manifest.get('customer_name'), 60)
    vehicle = _safe_folder_part(' '.join(str(value or '') for value in (
        manifest.get('vehicle_year'), manifest.get('vehicle_make'), manifest.get('vehicle_model')
    )), 70)
    registration = _safe_folder_part(manifest.get('registration'), 20)
    reference = _safe_folder_part(manifest.get('reference'), 70)
    if customer and vehicle:
        label = f'{customer} - {vehicle} - {registration} - {reference}'
    else:
        label = f'{reference}-{registration}'
    label = label.upper().strip(' .-')
    if not label:
        raise ValueError('Manifest has no safe job folder label')
    return label


def _manifest_update_allowed(existing, manifest):
    shared = ('job_id', 'project_ref', 'reference', 'registration', 'job_date')
    if any(existing.get(field) != manifest.get(field) for field in shared):
        return False
    if existing.get('schema') == manifest.get('schema') == 1:
        return all(existing.get(field) == manifest.get(field) for field in ('customer_id', 'vehicle_id'))
    if existing.get('schema') == manifest.get('schema') == 2:
        return all(existing.get(field) == manifest.get(field) for field in ('workshop_contact_id', 'workshop_vehicle_id'))
    return existing.get('schema') == 2 and manifest.get('schema') == 1


def _existing_job_folder(root, job_id):
    matches = []
    if root.is_dir():
        for candidate in root.iterdir():
            manifest_path = candidate / 'psi-job.json'
            if candidate.is_symlink() or not candidate.is_dir() or not manifest_path.is_file():
                continue
            try:
                existing = json.loads(manifest_path.read_text(encoding='utf-8-sig'))
            except (OSError, UnicodeError, json.JSONDecodeError):
                continue
            if existing.get('job_id') == job_id:
                matches.append((candidate, existing))
    if len(matches) > 1:
        raise ValueError('More than one local folder has this PSI job ID; PSI review required')
    return matches[0] if matches else (None, None)


def _available_photo_destination(photos, phase, name):
    destination = photos / name
    if not destination.exists():
        return destination
    destination = photos / f'{phase} - {name}'
    if not destination.exists():
        return destination
    stem, suffix = Path(name).stem, Path(name).suffix
    number = 2
    while True:
        destination = photos / f'{phase} - {stem} ({number}){suffix}'
        if not destination.exists():
            return destination
        number += 1


def consolidate_photo_folders(folder):
    """Move legacy phase folders into one simple photos folder without overwriting."""
    photos = folder / 'Workshop photos'
    photos.mkdir(exist_ok=True)
    state_path = folder / '.psi-upload-status.json'
    try:
        state = json.loads(state_path.read_text(encoding='utf-8')) if state_path.exists() else {}
    except (OSError, UnicodeError, json.JSONDecodeError):
        state = {}
    state_changed = False
    for phase in LEGACY_PHOTO_CATEGORIES:
        legacy = folder / phase
        if not legacy.is_dir() or legacy.is_symlink():
            continue
        for source in sorted(legacy.iterdir()):
            if not source.is_file() or source.is_symlink():
                continue
            destination = _available_photo_destination(photos, phase, source.name)
            old_relative = str(source.relative_to(folder))
            source.rename(destination)
            new_relative = str(destination.relative_to(folder))
            if old_relative in state:
                state[new_relative] = state.pop(old_relative)
                state_changed = True
        try:
            legacy.rmdir()
        except OSError:
            pass
    if state_changed:
        atomic_json(state_path, state)


def _available_destination(folder, name):
    destination = folder / name
    if not destination.exists():
        return destination
    stem, suffix = Path(name).stem, Path(name).suffix
    number = 2
    while True:
        destination = folder / f'{stem} ({number}){suffix}'
        if not destination.exists():
            return destination
        number += 1


def migrate_category_folders(folder):
    state_path = folder / '.psi-upload-status.json'
    try:
        state = json.loads(state_path.read_text(encoding='utf-8')) if state_path.exists() else {}
    except (OSError, UnicodeError, json.JSONDecodeError):
        state = {}
    state_changed = False
    for old_name, new_name in CATEGORY_ALIASES.items():
        old = folder / old_name
        new = folder / new_name
        if not old.is_dir() or old.is_symlink() or old == new:
            continue
        new.mkdir(exist_ok=True)
        for source in sorted(old.iterdir()):
            if source.is_symlink():
                continue
            destination = _available_destination(new, source.name)
            old_relative = str(source.relative_to(folder))
            source.rename(destination)
            new_relative = str(destination.relative_to(folder))
            if old_relative in state:
                state[new_relative] = state.pop(old_relative)
                state_changed = True
        try:
            old.rmdir()
        except OSError:
            pass
    if state_changed:
        atomic_json(state_path, state)


def create_folder_from_manifest(root, manifest):
    root.mkdir(parents=True, exist_ok=True)
    desired = root / folder_label_for(manifest)
    folder, existing = _existing_job_folder(root, manifest['job_id'])
    if folder is None:
        folder = desired
        folder.mkdir(exist_ok=True)
        destination = folder / 'psi-job.json'
        existing = json.loads(destination.read_text(encoding='utf-8-sig')) if destination.exists() else None
    else:
        destination = folder / 'psi-job.json'
    if existing is not None and existing != manifest and not _manifest_update_allowed(existing, manifest):
        raise ValueError('This folder already contains a different PSI job manifest')
    if folder != desired:
        if desired.exists():
            raise ValueError('The preferred PSI job folder name is already in use')
        folder.rename(desired)
        folder = desired
        destination = folder / 'psi-job.json'
    if existing != manifest:
        atomic_json(destination, manifest)
    for category in CATEGORIES:
        (folder / category).mkdir(exist_ok=True)
    migrate_category_folders(folder)
    consolidate_photo_folders(folder)
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


def manifest_from_job(connection, job, vehicle=None, customer_name=None):
    project_ref = urllib.parse.urlparse(connection.url).hostname.split('.')[0]
    if job.get('customer_id') and job.get('vehicle_id'):
        if vehicle is None:
            vehicles = connection.call(
                '/rest/v1/customer_vehicles?select=id,customer_id,registration,year,make,model,archived_at&id=eq.' + job['vehicle_id']
            )
            vehicle = vehicles[0] if len(vehicles) == 1 else None
        if not vehicle or vehicle['archived_at'] or vehicle['customer_id'] != job['customer_id']:
            raise ValueError('The workshop job vehicle is unavailable')
        if customer_name is None:
            customers = connection.call(
                '/rest/v1/customer_profiles?select=first_name,last_name,email&user_id=eq.' + job['customer_id']
            )
            if customers:
                customer_name = ' '.join(filter(None, (customers[0].get('first_name'), customers[0].get('last_name')))).strip() or customers[0].get('email')
        return {
            'schema': 1, 'project_ref': project_ref, 'job_id': job['id'],
            'customer_id': job['customer_id'], 'vehicle_id': job['vehicle_id'],
            'registration': vehicle['registration'], 'reference': job['reference'], 'job_date': job['job_date'],
            'customer_name': customer_name, 'vehicle_year': vehicle.get('year'),
            'vehicle_make': vehicle.get('make'), 'vehicle_model': vehicle.get('model'),
        }
    if job.get('workshop_contact_id') and job.get('workshop_vehicle_id'):
        if vehicle is None:
            vehicles = connection.call(
                '/rest/v1/workshop_vehicles?select=id,workshop_contact_id,registration,year,make,model,status&id=eq.' + job['workshop_vehicle_id']
            )
            vehicle = vehicles[0] if len(vehicles) == 1 else None
        if not vehicle or vehicle['status'] != 'active' or vehicle['workshop_contact_id'] != job['workshop_contact_id']:
            raise ValueError('The workshop-only job vehicle is unavailable')
        if customer_name is None:
            contacts = connection.call(
                '/rest/v1/workshop_contacts?select=display_name&id=eq.' + job['workshop_contact_id']
            )
            customer_name = contacts[0].get('display_name') if contacts else None
        return {
            'schema': 2, 'owner_type': 'workshop', 'project_ref': project_ref, 'job_id': job['id'],
            'workshop_contact_id': job['workshop_contact_id'], 'workshop_vehicle_id': job['workshop_vehicle_id'],
            'registration': vehicle['registration'], 'reference': job['reference'], 'job_date': job['job_date'],
            'customer_name': customer_name, 'vehicle_year': vehicle.get('year'),
            'vehicle_make': vehicle.get('make'), 'vehicle_model': vehicle.get('model'),
        }
    raise ValueError('The workshop job has no valid owner mode')


def sync_job_folders(root, connection, days_back=30):
    """Create local folders for recent/future confirmed and manual workshop jobs."""
    earliest = (date.today() - timedelta(days=days_back)).isoformat()
    path = ('/rest/v1/workshop_jobs?select=id,customer_id,vehicle_id,workshop_contact_id,workshop_vehicle_id,reference,title,job_date'
            '&job_date=gte.' + earliest + '&order=job_date.asc&limit=500')
    vehicles = connection.call(
        '/rest/v1/customer_vehicles?select=id,customer_id,registration,year,make,model,archived_at&archived_at=is.null&limit=2000'
    )
    vehicles_by_id = {vehicle['id']: vehicle for vehicle in vehicles}
    workshop_vehicles = connection.call(
        '/rest/v1/workshop_vehicles?select=id,workshop_contact_id,registration,year,make,model,status&status=eq.active&limit=2000'
    )
    workshop_vehicles_by_id = {vehicle['id']: vehicle for vehicle in workshop_vehicles}
    customers = connection.call(
        '/rest/v1/customer_profiles?select=user_id,first_name,last_name,email&account_state=eq.active&limit=2000'
    )
    customer_names = {
        customer['user_id']: ' '.join(filter(None, (customer.get('first_name'), customer.get('last_name')))).strip() or customer.get('email')
        for customer in customers
    }
    workshop_contacts = connection.call(
        '/rest/v1/workshop_contacts?select=id,display_name&status=eq.active&limit=2000'
    )
    workshop_names = {contact['id']: contact['display_name'] for contact in workshop_contacts}
    connection.verified_jobs = {}
    created, errors = [], []
    for job in connection.call(path):
        try:
            vehicle = vehicles_by_id.get(job.get('vehicle_id')) if job.get('vehicle_id') else workshop_vehicles_by_id.get(job.get('workshop_vehicle_id'))
            customer_name = customer_names.get(job.get('customer_id')) if job.get('customer_id') else workshop_names.get(job.get('workshop_contact_id'))
            manifest = manifest_from_job(connection, job, vehicle, customer_name)
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


def _parse_job_date(value, today=None):
    value = value.strip()
    if not value:
        return (today or date.today()).isoformat()
    for format_string in ('%d/%m/%Y', '%d-%m-%Y', '%Y-%m-%d'):
        try:
            return datetime.strptime(value, format_string).date().isoformat()
        except ValueError:
            pass
    raise ValueError('Enter the job date as DD/MM/YYYY, DD-MM-YYYY or YYYY-MM-DD')


def _parse_job_type(value):
    normalized = re.sub(r'\s+', ' ', value.strip().lower()).replace(' and ', ' & ')
    choices = {
        '': ('service', 'Service', 1),
        '1': ('service', 'Service', 1),
        'service': ('service', 'Service', 1),
        '2': ('dyno', 'Dyno tuning', 2),
        'dyno': ('dyno', 'Dyno tuning', 2),
        '3': ('upgrades_repairs', 'Upgrades & Repairs', 3),
        'upgrade': ('upgrades_repairs', 'Upgrades & Repairs', 3),
        'upgrades': ('upgrades_repairs', 'Upgrades & Repairs', 3),
        'repair': ('upgrades_repairs', 'Upgrades & Repairs', 3),
        'repairs': ('upgrades_repairs', 'Upgrades & Repairs', 3),
        'upgrades & repairs': ('upgrades_repairs', 'Upgrades & Repairs', 3),
    }
    if normalized == '':
        return 'service', 'Service'
    parts = [part.strip() for part in normalized.split('+')]
    if any(not part for part in parts):
        raise ValueError('Choose job type 1, 2, 3 or combine them with +')
    selected = []
    for part in parts:
        if part not in choices:
            raise ValueError('Choose job type 1, 2, 3 or combine them with +')
        selected.append(choices[part])
    selected = sorted({order: (kind, title, order) for kind, title, order in selected}.values(), key=lambda item: item[2])
    kind = '+'.join(item[0] for item in selected)
    title = ' + '.join(item[1] for item in selected)
    return kind, title


class _ReturnToMenu(Exception):
    pass


class _RestartManualWizard(Exception):
    pass


class _WizardInput:
    """Replay confirmed answers so `back` can revisit one prompt without writing data."""
    def __init__(self, input_fn):
        self.input_fn = input_fn
        self.answers = []
        self.index = 0

    def begin(self):
        self.index = 0

    def ask(self, prompt):
        if self.index < len(self.answers):
            answer = self.answers[self.index]
            self.index += 1
            return answer
        answer = self.input_fn(prompt)
        if answer.strip().lower() == 'back':
            if self.index == 0:
                raise _ReturnToMenu()
            self.answers = self.answers[:self.index - 1]
            raise _RestartManualWizard()
        self.answers.append(answer)
        self.index += 1
        return answer


def _manual_job_details(input_fn, registration):
    today = date.today()
    job_date = _parse_job_date(input_fn(
        f'Job date [{today.strftime("%d/%m/%Y")}] (past dates allowed): '
    ), today)
    print('Job type:')
    print('1. Service')
    print('2. Dyno')
    print('3. Upgrades & Repairs')
    _kind, default_job_title = _parse_job_type(input_fn('Choose one or more, for example 1+2 [1]: '))
    default_title = default_job_title + ' · ' + registration
    title = input_fn(f'Job description [{default_title}]: ').strip() or default_title
    if len(title.encode('utf-8')) > 180:
        raise ValueError('Job description is too long')
    return job_date, title


def _new_workshop_customer(input_fn, registration):
    if input_fn('No existing vehicle matches. Create a workshop-only customer and vehicle? [y/N]: ').strip().lower() not in ('y', 'yes'):
        raise ValueError('No workshop job was created')
    display_name = input_fn('Customer name: ').strip()
    mobile = input_fn('Customer mobile (optional if email supplied): ').strip()
    email = input_fn('Customer email (optional if mobile supplied): ').strip().lower()
    if not display_name or (not mobile and not email):
        raise ValueError('Enter the customer name and at least a mobile or email')
    if email and not re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', email):
        raise ValueError('Enter a valid customer email or leave it blank')
    year_text = input_fn('Vehicle year: ').strip()
    if not year_text.isdigit() or not 1900 <= int(year_text) <= 2200:
        raise ValueError('Enter a valid four-digit vehicle year')
    make = input_fn('Vehicle make: ').strip()
    model = input_fn('Vehicle model: ').strip()
    if not make or not model:
        raise ValueError('Enter the vehicle make and model')
    return {
        'p_display_name': display_name,
        'p_email': email or None,
        'p_mobile': mobile or None,
        'p_registration': registration,
        'p_year': int(year_text),
        'p_make': make,
        'p_model': model,
    }


def _create_manual_job_once(root, connection, input_fn):
    registration = re.sub(r'\s+', '', input_fn('Vehicle registration: ').upper())
    if not registration:
        raise ValueError('Enter the vehicle registration')
    vehicles = connection.call(
        '/rest/v1/customer_vehicles?select=id,customer_id,registration,year,make,model,archived_at'
        '&archived_at=is.null&registration=eq.' + urllib.parse.quote(registration, safe='')
    )
    choices = []
    for vehicle in vehicles:
        customers = connection.call(
            '/rest/v1/customer_profiles?select=user_id,first_name,last_name,email&user_id=eq.' + vehicle['customer_id']
        )
        if customers:
            customer = customers[0]
            name = ' '.join(filter(None, (customer.get('first_name'), customer.get('last_name')))).strip() or customer['email']
            choices.append(('app', vehicle, name))
    workshop_vehicles = connection.call(
        '/rest/v1/workshop_vehicles?select=id,workshop_contact_id,registration,year,make,model,status'
        '&status=eq.active&registration=eq.' + urllib.parse.quote(registration, safe='')
    )
    for vehicle in workshop_vehicles:
        contacts = connection.call(
            '/rest/v1/workshop_contacts?select=id,display_name,email,mobile,status&id=eq.' + vehicle['workshop_contact_id']
        )
        if contacts and contacts[0]['status'] == 'active':
            choices.append(('workshop', vehicle, contacts[0]['display_name']))

    selected_choice = None
    if choices:
        for index, (owner_type, vehicle, name) in enumerate(choices, 1):
            label = 'App customer' if owner_type == 'app' else 'Workshop-only customer'
            print(f'{index}. {vehicle["year"]} {vehicle["make"]} {vehicle["model"]} · {name} · {label}')
        print(f'{len(choices) + 1}. Create a new workshop-only customer and vehicle')
        selected = int(input_fn('Choose vehicle: ') or '1')
        if selected < 1 or selected > len(choices) + 1:
            raise ValueError('Choose one of the listed vehicles')
        if selected <= len(choices):
            selected_choice = choices[selected - 1]

    if selected_choice and selected_choice[0] == 'app':
        _, vehicle, customer_name = selected_choice
        job_date, title = _manual_job_details(input_fn, vehicle['registration'])
        reference = 'PSI-PHONE-' + job_date.replace('-', '') + '-' + uuid.uuid4().hex[:8].upper()
        job = connection.call('/rest/v1/workshop_jobs', 'POST', {
            'customer_id': vehicle['customer_id'], 'vehicle_id': vehicle['id'],
            'reference': reference, 'title': title, 'job_date': job_date,
            'created_by': connection.user_id,
        }, headers={'Prefer': 'return=representation'})[0]
    else:
        existing_vehicle = selected_choice[1] if selected_choice else None
        customer_name = selected_choice[2] if selected_choice else None
        customer = {
            'p_display_name': None, 'p_email': None, 'p_mobile': None,
            'p_registration': None, 'p_year': None, 'p_make': None, 'p_model': None,
        } if existing_vehicle else _new_workshop_customer(input_fn, registration)
        vehicle_registration = existing_vehicle['registration'] if existing_vehicle else registration
        job_date, title = _manual_job_details(input_fn, vehicle_registration)
        payload = {
            'p_existing_workshop_vehicle_id': existing_vehicle['id'] if existing_vehicle else None,
            **customer, 'p_title': title, 'p_job_date': job_date,
        }
        job = connection.call('/rest/v1/rpc/create_workshop_only_job', 'POST', payload)[0]
        customer_name = customer_name or customer['p_display_name']
        vehicle = existing_vehicle or {
            'id': job['workshop_vehicle_id'], 'workshop_contact_id': job['workshop_contact_id'],
            'registration': registration, 'year': customer['p_year'], 'make': customer['p_make'],
            'model': customer['p_model'], 'status': 'active',
        }

    manifest = manifest_from_job(connection, job, vehicle, customer_name)
    connection.verified_jobs[job['id']] = manifest
    return create_folder_from_manifest(root, manifest)


def create_manual_job(root, connection, input_fn=input):
    """Create an AAL2 staff-authorized phone/walk-in job with reversible prompts."""
    wizard = _WizardInput(input_fn)
    print('Type back at any question to return to the previous question.')
    while True:
        wizard.begin()
        try:
            return _create_manual_job_once(root, connection, wizard.ask)
        except _RestartManualWizard:
            print('Going back one question...')

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


def _text_note(path):
    raw = path.read_bytes()
    if len(raw) > 256 * 1024:
        raise ValueError('Text note exceeds 256 KB')
    note = raw.decode('utf-8-sig').strip()
    if not note:
        raise ValueError('Text note is empty')
    if len(note) > 10000:
        raise ValueError('Text note exceeds 10000 characters')
    return raw, note


def _publish_text_record(folder, manifest, connection, state, path, relative, category, category_key, record_type):
    before = (path.stat().st_size, path.stat().st_mtime_ns)
    if time.time() - path.stat().st_mtime < 5:
        return
    raw, note = _text_note(path)
    if before != (path.stat().st_size, path.stat().st_mtime_ns):
        return
    digest = hashlib.sha256(raw).hexdigest()
    source_key = f'pc:{manifest["job_id"]}:{category_key}:{digest}'
    prior = state.get(relative, {})
    if (prior.get('key') == source_key or str(prior.get('key', '')).endswith(':' + digest)) and prior.get('status') == 'uploaded':
        return
    workshop_only = manifest.get('schema') == 2 and manifest.get('owner_type') == 'workshop'
    if not connection or workshop_only:
        out = prepared_folder(folder) / category
        out.mkdir(parents=True, exist_ok=True)
        hide_windows_folder(folder / '.psi-prepared')
        (out / (digest + '.txt')).write_bytes(raw)
        state[relative] = {
            'key': source_key,
            'status': 'waiting_for_customer_account' if workshop_only else 'prepared',
            'bytes': len(raw),
        }
        return
    title = path.stem[:180]
    if record_type == 'service':
        record = connection.call('/rest/v1/repair_records', 'POST', {
            'customer_id': manifest['customer_id'], 'vehicle_id': manifest['vehicle_id'],
            'record_source': 'psi_record', 'title': title, 'repair_date': manifest['job_date'],
            'odometer_km': None, 'notes': note, 'record_kind': 'repair',
            'created_by': connection.user_id,
        }, headers={'Prefer': 'return=representation'})[0]
    elif record_type == 'recommendation':
        record = connection.call('/rest/v1/recommended_work', 'POST', {
            'customer_id': manifest['customer_id'], 'vehicle_id': manifest['vehicle_id'],
            'record_source': 'psi_record', 'title': title, 'timing': None, 'notes': note,
            'status': 'recommended', 'created_by': connection.user_id,
        }, headers={'Prefer': 'return=representation'})[0]
    else:
        raise ValueError('Unsupported text record folder')
    state[relative] = {'key': source_key, 'status': 'uploaded', 'record_id': record['id']}


def _object_suffix(mime):
    if mime == 'application/pdf':
        return '.pdf'
    if mime.startswith('image/'):
        return '.jpg'
    raise ValueError('Unsupported upload file type')

def process_job(folder, connection=None):
    manifest = manifest_for(folder, connection)
    migrate_category_folders(folder)
    consolidate_photo_folders(folder)
    if (folder / '.psi-prepared').is_dir():
        hide_windows_folder(folder / '.psi-prepared')
    workshop_only = manifest.get('schema') == 2 and manifest.get('owner_type') == 'workshop'
    state_path = folder / '.psi-upload-status.json'
    state = json.loads(state_path.read_text()) if state_path.exists() else {}
    for category, (kind, phase, category_key) in CATEGORIES.items():
        category_path = folder / category
        if not category_path.is_dir() or category_path.is_symlink():
            continue
        for path in sorted(category_path.iterdir()):
            if path.is_symlink() or not path.is_file():
                continue
            is_text_record = path.suffix.lower() == '.txt' and category in TEXT_RECORD_CATEGORIES
            if not is_text_record and path.suffix.lower() not in ('.jpg', '.jpeg', '.png', '.webp', '.pdf', '.tif', '.tiff'):
                continue
            relative = str(path.relative_to(folder))
            try:
                if is_text_record:
                    _publish_text_record(folder, manifest, connection, state, path, relative, category, category_key, TEXT_RECORD_CATEGORIES[category])
                    atomic_json(state_path, state)
                    continue
                if category == 'Recommended work':
                    raise ValueError('Recommended work accepts .txt notes only')
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
                source_key = f'pc:{manifest["job_id"]}:{category_key}:{digest}'
                prior = state.get(relative, {})
                if (prior.get('key') == source_key or str(prior.get('key', '')).endswith(':' + digest)) and prior.get('status') == 'uploaded':
                    continue
                if not connection or workshop_only:
                    out = prepared_folder(folder) / category
                    out.mkdir(parents=True, exist_ok=True)
                    hide_windows_folder(folder / '.psi-prepared')
                    (out / (digest + _object_suffix(mime))).write_bytes(content)
                    if thumb:
                        (out / (digest + '-thumb.jpg')).write_bytes(thumb)
                    state[relative] = {
                        'key': source_key,
                        'status': 'waiting_for_customer_account' if workshop_only else 'prepared',
                        'bytes': len(content),
                        'thumbnail_bytes': len(thumb or b''),
                    }
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
                        object_path = base + ('/original' + _object_suffix(mime))
                        thumb_path = base + '/thumb.jpg' if thumb else None
                        connection.call('/rest/v1/vault_assets', 'POST', {'id': asset_id, 'record_id': record['id'], 'customer_id': manifest['customer_id'], 'vehicle_id': manifest['vehicle_id'], 'object_path': object_path, 'thumbnail_path': thumb_path, 'mime_type': mime, 'size_bytes': len(content), 'sha256': digest, 'caption': path.name[:300], 'phase': phase, 'created_by': connection.user_id})
                        assets = [{'id': asset_id, 'object_path': object_path, 'thumbnail_path': thumb_path,
                                   'sha256': digest, 'size_bytes': len(content), 'ready': False}]
                    if not assets[0]['ready']:
                        asset = assets[0]
                        base = f'{manifest["customer_id"]}/{manifest["vehicle_id"]}/{record["id"]}/{asset["id"]}'
                        object_path = base + ('/original' + _object_suffix(mime))
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
    parser.add_argument('--manual-job', action='store_true', help='Create a phone/walk-in job with or without an app account')
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
        try:
            folder = create_manual_job(root, connection)
        except _ReturnToMenu:
            print('Returning to the PSI Workshop Uploads menu. No job was created.')
            return 10
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
            for _ in range(30):
                if args.stop_file and Path(args.stop_file).exists():
                    break
                time.sleep(1)
    finally:
        if connection and not session_store:
            try: connection.call('/auth/v1/logout?scope=local', 'POST', {})
            except Exception: pass

if __name__ == '__main__':
    try:
        raise SystemExit(main() or 0)
    except (RequestFailure, RuntimeError, ValueError, OSError) as error:
        message = 'PSI Workshop Uploads: ' + str(error)
        print(message, file=sys.stderr)
        error_log = os.environ.get('PSI_WORKSHOP_ERROR_LOG')
        if error_log:
            try:
                Path(error_log).write_text(message + '\n', encoding='utf-8')
            except OSError:
                pass
        raise SystemExit(1) from None
