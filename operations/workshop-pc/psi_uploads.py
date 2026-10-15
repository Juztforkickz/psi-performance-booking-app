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
import shutil
from PIL import Image, ImageOps, ImageChops, ImageStat
from pillow_heif import register_heif_opener

register_heif_opener(thumbnails=False)

IMAGE_SUFFIXES = ('.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff', '.heic', '.heif')

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
CUSTOMER_FOLDER_MARKER = '.psi-customer-folder.json'
LEGACY_VEHICLE_INDEX_FOLDER = '00 CUSTOMER VEHICLES - VIEW ONLY'
LEGACY_VEHICLE_INDEX_MARKER = 'psi-vehicle-index.json'
VEHICLE_WORKSPACE_MARKER = '.psi-vehicle-workspace.json'
WORKSPACE_RECOVERY_FOLDER = '.psi-workspace-recovery'


class PauseRequested(BaseException):
    """A graceful control request, not an upload error or a failed receipt."""


def check_pause(connection):
    pause_file = getattr(connection, 'pause_file', None)
    if pause_file and Path(pause_file).exists():
        raise PauseRequested()


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
    """Bound size, honour orientation, strip EXIF/GPS, convert images to JPEG."""
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
        if method == 'GET' and not path.startswith('/auth/'):
            check_pause(self)
        if self.refresh and time.time() > self.expires - 90 and not path.startswith('/auth/'):
            self.set_session(self.call('/auth/v1/token?grant_type=refresh_token', 'POST', {'refresh_token': self.refresh}))
        body = binary if binary is not None else json.dumps(data).encode() if data is not None else None
        h = {'apikey': self.key, 'Authorization': 'Bearer ' + (self.token or self.key), 'Content-Type': 'application/json'}
        h.update(headers or {})
        req = urllib.request.Request(self.url + path, data=body, method=method, headers=h)
        try:
            timeout = 180 if binary is not None or read_binary else 45
            with urllib.request.urlopen(req, timeout=timeout) as response:
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
        except RequestFailure as error:
            if error.status not in (400, 401, 403):
                raise
            self.token, self.refresh, self.expires = '', '', 0
            self.session_store.clear()
            return False
        except RuntimeError:
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
    return verify_manifest(manifest, connection)


def verify_manifest(manifest, connection=None):
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
    vehicle = _safe_folder_part(' '.join(str(value or '') for value in (
        manifest.get('vehicle_year'), manifest.get('vehicle_make'), manifest.get('vehicle_model')
    )), 70)
    registration = _safe_folder_part(manifest.get('registration'), 20)
    reference = _safe_folder_part(manifest.get('reference'), 70)
    label = f'{vehicle} - {registration} - {reference}' if vehicle else f'{reference}-{registration}'
    label = label.upper().strip(' .-')
    if not label:
        raise ValueError('Manifest has no safe job folder label')
    return label


def _customer_identity(manifest):
    if manifest.get('schema') == 1:
        return 'customer_id', manifest['customer_id']
    return 'workshop_contact_id', manifest['workshop_contact_id']


def _customer_marker(manifest):
    key, value = _customer_identity(manifest)
    return {
        'schema': 1,
        'owner_type': 'app' if key == 'customer_id' else 'workshop',
        key: value,
        'customer_name': manifest.get('customer_name'),
    }


def _read_customer_marker(folder):
    marker_path = folder / CUSTOMER_FOLDER_MARKER
    if folder.is_symlink() or not folder.is_dir() or not marker_path.is_file():
        return None
    try:
        return json.loads(marker_path.read_text(encoding='utf-8-sig'))
    except (OSError, UnicodeError, json.JSONDecodeError):
        return None


def _marker_matches(marker, identity):
    return bool(marker) and marker.get(identity[0]) == identity[1]


def _customer_folder_label(manifest):
    label = _safe_folder_part(manifest.get('customer_name'), 100).upper()
    if label:
        return label
    return ('CUSTOMER ' + _customer_identity(manifest)[1][:8]).upper()


def _customer_folder_for(root, manifest, existing_folder=None, existing_manifest=None):
    """Return one managed customer folder, preserving strong account ownership boundaries."""
    identity = _customer_identity(manifest)
    expected_marker = _customer_marker(manifest)
    matches = []
    for candidate in root.iterdir():
        if _marker_matches(_read_customer_marker(candidate), identity):
            matches.append(candidate)
    if len(matches) > 1:
        raise ValueError('More than one local customer folder has the same PSI identity')

    desired = root / _customer_folder_label(manifest)
    folder = matches[0] if matches else None
    existing_parent = _customer_parent(root, existing_folder) if existing_folder else None
    claim_upgrade = (
        folder is None and existing_parent is not None and _read_customer_marker(existing_parent)
        and existing_manifest is not None and _manifest_update_allowed(existing_manifest, manifest)
        and existing_manifest.get('schema') == 2 and manifest.get('schema') == 1
    )
    if claim_upgrade:
        folder = existing_parent
        # Keep the established customer folder name when a workshop-only job
        # is claimed by the verified app account. A harmless profile spelling
        # change must not require Windows to rename a folder that may be open
        # in Explorer, because that would block the ownership upgrade.
        desired = existing_parent

    if folder is None:
        if desired.exists():
            marker = _read_customer_marker(desired)
            if not _marker_matches(marker, identity):
                desired = root / f'{_customer_folder_label(manifest)} - {identity[1][:8].upper()}'
        if desired.exists():
            raise ValueError('The preferred PSI customer folder name is already in use')
        desired.mkdir()
        folder = desired
    elif folder != desired:
        if desired.exists() and desired != existing_parent:
            marker = _read_customer_marker(desired)
            if not _marker_matches(marker, identity):
                desired = root / f'{_customer_folder_label(manifest)} - {identity[1][:8].upper()}'
        if desired.exists() and desired != folder:
            raise ValueError('The preferred PSI customer folder name is already in use')
        if desired != folder:
            folder.rename(desired)
            folder = desired

    marker_path = folder / CUSTOMER_FOLDER_MARKER
    current = _read_customer_marker(folder)
    if current != expected_marker:
        atomic_json(marker_path, expected_marker)
    hide_windows_folder(marker_path)
    return folder


def _cleanup_empty_customer_folder(folder, root):
    if folder == root or not folder.is_dir() or folder.is_symlink() or not _read_customer_marker(folder):
        return
    entries = list(folder.iterdir())
    if entries and all(entry.name == CUSTOMER_FOLDER_MARKER for entry in entries):
        (folder / CUSTOMER_FOLDER_MARKER).unlink(missing_ok=True)
        folder.rmdir()


def _remove_legacy_vehicle_index(root):
    """Remove only the exact app-generated view-only index and never user content."""
    index = root / LEGACY_VEHICLE_INDEX_FOLDER
    marker_path = index / LEGACY_VEHICLE_INDEX_MARKER
    if not index.exists():
        return False
    if index.is_symlink() or not index.is_dir() or not marker_path.is_file():
        raise ValueError('The old customer vehicle index contains an unverified folder')
    marker = json.loads(marker_path.read_text(encoding='utf-8-sig'))
    if marker.get('schema') != 1 or marker.get('purpose') != 'customer_vehicle_index':
        raise ValueError('The old customer vehicle index is not app-managed')
    allowed_root_files = {LEGACY_VEHICLE_INDEX_MARKER, 'READ ME.txt', '.psi-upload-status.json'}
    for entry in index.iterdir():
        if entry.is_file():
            if entry.name not in allowed_root_files:
                raise ValueError('The old customer vehicle index contains a user file and was preserved')
            continue
        if entry.is_symlink() or not entry.is_dir() or not (entry / 'psi-customer.json').is_file():
            raise ValueError('The old customer vehicle index contains an unverified customer folder')
        for vehicle in entry.iterdir():
            if vehicle.is_file():
                if vehicle.name != 'psi-customer.json':
                    raise ValueError('The old customer vehicle index contains a user file and was preserved')
                continue
            if vehicle.is_symlink() or not vehicle.is_dir():
                raise ValueError('The old customer vehicle index contains an unverified vehicle folder')
            contents = list(vehicle.iterdir())
            if any(item.is_dir() or item.name != 'psi-vehicle.json' for item in contents):
                raise ValueError('The old customer vehicle index contains a user file and was preserved')
    for customer in [entry for entry in index.iterdir() if entry.is_dir()]:
        for vehicle in [entry for entry in customer.iterdir() if entry.is_dir()]:
            (vehicle / 'psi-vehicle.json').unlink(missing_ok=True)
            vehicle.rmdir()
        (customer / 'psi-customer.json').unlink(missing_ok=True)
        customer.rmdir()
    for name in allowed_root_files:
        (index / name).unlink(missing_ok=True)
    index.rmdir()
    return True


def _manifest_update_allowed(existing, manifest, allow_workshop_identity_repair=False):
    shared = ('job_id', 'project_ref', 'reference', 'registration', 'job_date')
    if any(existing.get(field) != manifest.get(field) for field in shared):
        return False
    if existing.get('schema') == manifest.get('schema') == 1:
        return all(existing.get(field) == manifest.get(field) for field in ('customer_id', 'vehicle_id'))
    if existing.get('schema') == manifest.get('schema') == 2:
        # An owner-reviewed duplicate-contact repair can move the same verified
        # job to a replacement workshop vehicle/customer identity. The job ID,
        # reference, registration and date above must still match exactly.
        return allow_workshop_identity_repair or all(
            existing.get(field) == manifest.get(field)
            for field in ('workshop_contact_id', 'workshop_vehicle_id')
        )
    return existing.get('schema') == 2 and manifest.get('schema') == 1


def _existing_job_folder(root, job_id):
    matches = []
    if root.is_dir():
        candidates, _ = local_folder_scan(root)
        for candidate in candidates:
            manifest_path = candidate / 'psi-job.json'
            if not manifest_path.is_file():
                continue
            try:
                existing = json.loads(manifest_path.read_text(encoding='utf-8-sig'))
            except (OSError, UnicodeError, json.JSONDecodeError):
                continue
            manifests = [existing]
            links = candidate / '.psi-linked-jobs.json'
            if links.is_file() and not links.is_symlink():
                manifests += json.loads(links.read_text(encoding='utf-8-sig')).get('jobs', [])
            for item in manifests:
                if item.get('job_id') == job_id:
                    matches.append((candidate, item))
    if matches and any(not _manifest_update_allowed(matches[0][1], item) for _, item in matches[1:]):
        raise ValueError('Conflicting local folders have this PSI job ID; PSI review required')
    return matches[0] if matches else (None, None)


def _customer_parent(root, folder):
    """Find the managed customer above either a legacy job or a vehicle visit."""
    for parent in (folder, *folder.parents):
        if parent == root:
            break
        if parent.parent == root and _read_customer_marker(parent):
            return parent
    return None


def _workspace_identity(manifest):
    owner_key, owner_id = _customer_identity(manifest)
    vehicle_id = manifest.get('vehicle_id') if manifest.get('schema') == 1 else manifest.get('workshop_vehicle_id')
    return manifest.get('project_ref'), owner_key, owner_id, vehicle_id


def _vehicle_description(manifest):
    return (
        re.sub(r'[^A-Z0-9]', '', str(manifest.get('registration', '')).upper()),
        str(manifest.get('vehicle_year') or ''),
        ' '.join(str(manifest.get('vehicle_make') or '').casefold().split()),
        ' '.join(str(manifest.get('vehicle_model') or '').casefold().split()),
    )


def _compatible_vehicle_description(first, second):
    return len(first) == len(second) == 4 and all(not a or not b or a == b for a, b in zip(first, second))


def vehicle_workspace_label(manifest):
    text = ' '.join(str(manifest.get(key) or '') for key in ('vehicle_year', 'vehicle_make', 'vehicle_model')).strip()
    return (_safe_folder_part(text, 100) + ' - ' + _safe_folder_part(manifest['registration'], 20)).upper().strip(' .-')


def _read_vehicle_workspace(folder):
    path = folder / VEHICLE_WORKSPACE_MARKER
    if folder.is_symlink() or path.is_symlink():
        raise ValueError('Vehicle workspaces must not use symlinks')
    if not path.is_file():
        return None
    marker = json.loads(path.read_text(encoding='utf-8-sig'))
    if marker.get('schema') not in (1, 2) or marker.get('purpose') != 'vehicle_workspace':
        raise ValueError('Invalid vehicle workspace marker')
    return marker


def _preflight_vehicle_workspace(root, manifest, connection=None):
    """IDs decide ownership; matching labels with different IDs never merge."""
    matches = []
    for customer in root.iterdir() if root.is_dir() else []:
        if not _marker_matches(_read_customer_marker(customer), _customer_identity(manifest)):
            continue
        for candidate in customer.iterdir():
            if not candidate.is_dir() or candidate.is_symlink():
                continue
            marker = _read_vehicle_workspace(candidate)
            if marker is not None:
                if tuple(marker.get('identity', [])) != _workspace_identity(manifest):
                    if (tuple(marker.get('identity', []))[:3] == _workspace_identity(manifest)[:3]
                            and tuple(marker.get('description', [])) == _vehicle_description(manifest)):
                        raise ValueError('Matching vehicle details have different vehicle IDs; PSI review required')
                    continue
                if not _compatible_vehicle_description(tuple(marker.get('description', [])), _vehicle_description(manifest)):
                    raise ValueError('Vehicle workspace details conflict with the verified vehicle; PSI review required')
                matches.append(candidate)
            elif (candidate / 'psi-job.json').is_file():
                existing = manifest_for(candidate)
                if _workspace_identity(existing) != _workspace_identity(manifest):
                    if (_workspace_identity(existing)[:3] == _workspace_identity(manifest)[:3]
                            and _vehicle_description(existing) == _vehicle_description(manifest)):
                        raise ValueError('Matching legacy vehicle details have different vehicle IDs; PSI review required')
                    continue
                verify_manifest(existing, connection)
                if _workspace_identity(existing) == _workspace_identity(manifest) and not _compatible_vehicle_description(_vehicle_description(existing), _vehicle_description(manifest)):
                    raise ValueError('Legacy vehicle details conflict; preserve and review both folders')
    # Exact verified ownership can share one folder. Conflicting descriptions
    # above still stop; a label or approximate customer name never authorizes it.
    return sorted(matches, key=lambda path: (path.name != vehicle_workspace_label(manifest), len(str(path)), str(path)))[0] if matches else None


def _vehicle_workspace_for(root, customer, manifest):
    workspace = _preflight_vehicle_workspace(root, manifest)
    if workspace is not None:
        marker = _read_vehicle_workspace(workspace)
        description = [old or new for old, new in zip(marker['description'], _vehicle_description(manifest))]
        if description != marker['description']:
            desired = customer / vehicle_workspace_label(manifest)
            if workspace != desired and not desired.exists():
                _move_job_into_workspace(root, workspace, desired)
                workspace = desired
            marker['description'] = description
            atomic_json(workspace / VEHICLE_WORKSPACE_MARKER, marker)
    if workspace is None:
        workspace = customer / vehicle_workspace_label(manifest)
        if workspace.exists():
            workspace = customer / (vehicle_workspace_label(manifest) + ' - ' + _workspace_identity(manifest)[3][:8].upper())
        if workspace.exists():
            raise ValueError('Vehicle workspace destination is occupied; nothing overwritten')
        workspace.mkdir()
        atomic_json(workspace / VEHICLE_WORKSPACE_MARKER, {
            'schema': 1, 'purpose': 'vehicle_workspace', 'identity': list(_workspace_identity(manifest)),
            'description': list(_vehicle_description(manifest)),
        })
        hide_windows_folder(workspace / VEHICLE_WORKSPACE_MARKER)
    return workspace


def workspace_inventory(folder):
    """Recovery proof includes receipts and hidden metadata, not just visible files."""
    result = {}
    for path in sorted(folder.rglob('*')):
        if path.is_symlink():
            raise ValueError('A migration source contains a symlink; nothing moved')
        if path.is_file():
            result[str(path.relative_to(folder))] = {
                'bytes': path.stat().st_size, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
            }
    return result


def _move_job_into_workspace(root, source, destination):
    if source.resolve().is_relative_to(root.resolve()) is False or destination.resolve().is_relative_to(root.resolve()) is False:
        raise ValueError('Workspace migration must stay inside the upload root')
    if destination.exists() or destination.is_symlink():
        raise ValueError('Job destination is occupied; nothing overwritten')
    recovery = root / WORKSPACE_RECOVERY_FOLDER
    if recovery.is_symlink():
        raise ValueError('Workspace recovery must not be a symlink')
    recovery.mkdir(exist_ok=True)
    marker = recovery / '.psi-recovery.json'
    if marker.is_symlink():
        raise ValueError('Invalid recovery marker')
    if not marker.exists():
        atomic_json(marker, {'schema': 1, 'purpose': 'vehicle_workspace_recovery'})
    elif json.loads(marker.read_text(encoding='utf-8-sig')) != {'schema': 1, 'purpose': 'vehicle_workspace_recovery'}:
        raise ValueError('Recovery folder is not app-managed; nothing moved')
    hide_windows_folder(recovery)
    inventory = workspace_inventory(source)
    journal = {'schema': 1, 'source': str(source.relative_to(root)), 'destination': str(destination.relative_to(root)),
               'inventory': inventory, 'state': 'backed_up'}
    checkpoint = None
    # A Windows lock can defer a move. Reuse its verified backup instead of
    # making another full copy on every 30-second watcher scan.
    for candidate in recovery.iterdir():
        candidate_journal = candidate / 'migration.json'
        if candidate.is_symlink() or not candidate.is_dir() or not candidate_journal.is_file() or candidate_journal.is_symlink():
            continue
        previous = json.loads(candidate_journal.read_text(encoding='utf-8-sig'))
        if (previous.get('state') == 'backed_up' and previous.get('source') == journal['source']
                and previous.get('destination') == journal['destination'] and previous.get('inventory') == inventory):
            if workspace_inventory(candidate / 'original') != inventory:
                raise ValueError('Deferred migration backup changed; source left untouched')
            checkpoint = candidate
            break
    if checkpoint is None:
        checkpoint = recovery / uuid.uuid4().hex
        checkpoint.mkdir()
        shutil.copytree(source, checkpoint / 'original', copy_function=shutil.copy2)
    if workspace_inventory(checkpoint / 'original') != inventory or workspace_inventory(source) != inventory:
        raise ValueError('Files changed during backup; source left untouched')
    atomic_json(checkpoint / 'migration.json', journal)
    source.rename(destination)
    if workspace_inventory(destination) != inventory:
        raise ValueError('Migration verification failed; recovery copy preserved')
    journal['state'] = 'complete'
    atomic_json(checkpoint / 'migration.json', journal)


def _cleanup_empty_vehicle_workspace(folder):
    if not folder or not _read_vehicle_workspace(folder):
        return
    jobs = folder / 'Jobs'
    if set(item.name for item in folder.iterdir()) == {VEHICLE_WORKSPACE_MARKER}:
        (folder / VEHICLE_WORKSPACE_MARKER).unlink()
        folder.rmdir()
        return
    if jobs.is_dir() and not jobs.is_symlink() and not any(jobs.iterdir()):
        if set(item.name for item in folder.iterdir()) == {VEHICLE_WORKSPACE_MARKER, 'Jobs'}:
            jobs.rmdir()
            (folder / VEHICLE_WORKSPACE_MARKER).unlink()
            folder.rmdir()


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


def linked_job_manifests(folder, primary, connection):
    """Owner-approved desktop grouping never changes protected published records."""
    path = folder / '.psi-linked-jobs.json'
    if not path.exists():
        return []
    data = json.loads(path.read_text(encoding='utf-8-sig'))
    vehicle_files = data.get('schema') == 2 and data.get('purpose') == 'shared_vehicle_files'
    if path.is_symlink() or (not connection and not vehicle_files):
        raise ValueError('Linked job workspace requires live staff verification')
    if data.get('schema') not in (1, 2) or (data.get('schema') == 2 and not vehicle_files) or data.get('primary_job_id') != primary['job_id']:
        raise ValueError('Invalid linked job workspace')
    verify_manifest(primary, connection)
    seen = {primary['job_id']}
    linked = data.get('jobs')
    if not isinstance(linked, list) or not linked:
        raise ValueError('Invalid linked job list')
    for item in linked:
        verify_manifest(item, connection)
        if item['job_id'] in seen or (not vehicle_files and (primary.get('schema') != 1 or item.get('schema') != 1)):
            raise ValueError('Invalid linked job identity')
        if _workspace_identity(item) != _workspace_identity(primary) or not _compatible_vehicle_description(
                _vehicle_description(item), _vehicle_description(primary)):
            raise ValueError('Linked jobs must belong to the exact account and vehicle')
        if not vehicle_files and item['job_date'] != primary['job_date']:
            raise ValueError('Linked jobs must belong to the exact account, vehicle and visit date')
        seen.add(item['job_id'])
    hide_windows_folder(path)
    return linked


def _linked_workspace(root, manifest, connection):
    matches = []
    jobs, _ = local_folder_scan(root)
    for folder in jobs:
        path = folder / '.psi-linked-jobs.json'
        if not path.exists():
            continue
        data = json.loads(path.read_text(encoding='utf-8-sig'))
        if not any(item.get('job_id') == manifest['job_id'] for item in data.get('jobs', [])):
            continue
        primary = manifest_for(folder, connection)
        linked = linked_job_manifests(folder, primary, connection)
        item = next(item for item in linked if item['job_id'] == manifest['job_id'])
        if not _manifest_update_allowed(item, manifest):
            raise ValueError('Linked job changed; PSI review required')
        existing, _ = _existing_job_folder(root, manifest['job_id'])
        if existing is not None:
            raise ValueError('Linked job still has a second folder; preserve and review it')
        matches.append(folder)
    if len(matches) > 1:
        raise ValueError('More than one workspace links this job; PSI review required')
    return matches[0] if matches else None


def create_folder_from_manifest(root, manifest, allow_workshop_identity_repair=False, connection=None):
    root.mkdir(parents=True, exist_ok=True)
    verify_manifest(manifest, connection)
    folder, existing = _existing_job_folder(root, manifest['job_id'])
    if existing is not None and existing != manifest and not _manifest_update_allowed(
        existing, manifest, allow_workshop_identity_repair
    ):
        raise ValueError('This folder already contains a different PSI job manifest')
    previous_parent = _customer_parent(root, folder) if folder else None
    customer_folder = _customer_folder_for(root, manifest, folder, existing)
    if folder is not None and not folder.exists():
        folder, _ = _existing_job_folder(root, manifest['job_id'])
        if folder is None:
            raise ValueError('The existing job folder moved unexpectedly; PSI review required')
    # A verified account claim changes ownership IDs, not the historical job ID.
    # Upgrade the old container identity only for the already checked same job.
    old_workspace = folder.parent.parent if folder and folder.parent.name == 'Jobs' else folder
    if old_workspace and existing and _workspace_identity(existing) != _workspace_identity(manifest):
        old_marker = _read_vehicle_workspace(old_workspace)
        if old_marker:
            old_marker['identity'] = list(_workspace_identity(manifest))
            atomic_json(old_workspace / VEHICLE_WORKSPACE_MARKER, old_marker)
    workspace = _vehicle_workspace_for(root, customer_folder, manifest)
    _flatten_vehicle_workspace(root, workspace, manifest, connection, allow_workshop_identity_repair)
    if previous_parent is not None:
        _cleanup_empty_customer_folder(previous_parent, root)
    return workspace


def _folder_manifests(folder, connection=None):
    primary = manifest_for(folder, connection)
    return [primary] + linked_job_manifests(folder, primary, connection)


def _flat_job_for_source(prior, manifests, default):
    job_id = prior.get('job_id')
    if not job_id and str(prior.get('key', '')).startswith('pc:'):
        job_id = prior['key'].split(':')[1]
    if job_id and job_id not in manifests:
        raise ValueError('File receipt refers to an unverified job; nothing reassigned')
    return manifests.get(job_id, default)


def _flat_backup(root, source, workspace):
    """Write-ahead recovery, reusable after a locked directory or interrupted copy."""
    recovery = root / WORKSPACE_RECOVERY_FOLDER
    recovery.mkdir(exist_ok=True)
    marker = recovery / '.psi-recovery.json'
    expected = {'schema': 1, 'purpose': 'vehicle_workspace_recovery'}
    if recovery.is_symlink() or marker.is_symlink():
        raise ValueError('Recovery must not use symlinks')
    if marker.exists() and json.loads(marker.read_text()) != expected:
        raise ValueError('Recovery folder is not app-managed')
    if not marker.exists():
        atomic_json(marker, expected)
    hide_windows_folder(recovery)
    inventory = workspace_inventory(source)
    journal = {'schema': 1, 'operation': 'flatten_vehicle_files', 'source': str(source.relative_to(root)),
               'destination': str(workspace.relative_to(root)), 'inventory': inventory, 'state': 'backed_up'}
    for candidate in recovery.iterdir():
        path = candidate / 'migration.json'
        if candidate.is_dir() and not candidate.is_symlink() and path.is_file() and not path.is_symlink():
            saved = json.loads(path.read_text())
            if all(saved.get(key) == value for key, value in journal.items()):
                if workspace_inventory(candidate / 'original') != inventory:
                    raise ValueError('Recovery copy changed; source preserved')
                return candidate, journal
    checkpoint = recovery / uuid.uuid4().hex
    checkpoint.mkdir()
    shutil.copytree(source, checkpoint / 'original', copy_function=shutil.copy2)
    if workspace_inventory(checkpoint / 'original') != inventory or workspace_inventory(source) != inventory:
        raise ValueError('Files changed during backup; source left untouched')
    atomic_json(checkpoint / 'migration.json', journal)
    return checkpoint, journal


def _merge_flat_source(root, workspace, source, manifests, connection):
    """Copy files with a durable route/receipt before retiring the original folder."""
    if not source.resolve().is_relative_to(root.resolve()) or not workspace.resolve().is_relative_to(root.resolve()):
        raise ValueError('Consolidation must stay inside the upload root')
    checkpoint, journal = _flat_backup(root, source, workspace)
    source_state_path = source / '.psi-upload-status.json'
    source_state = json.loads(source_state_path.read_text()) if source_state_path.exists() else {}
    state_path = workspace / '.psi-upload-status.json'
    state = json.loads(state_path.read_text()) if state_path.exists() else {}
    primary = manifests[0]
    by_id = {item['job_id']: item for item in manifests}
    mapping = {}
    for path in sorted(source.rglob('*')):
        check_pause(connection)
        if not path.is_file():
            continue
        old_relative = str(path.relative_to(source))
        parts = path.relative_to(source).parts
        category = CATEGORY_ALIASES.get(parts[0], 'Workshop photos' if parts[0] in LEGACY_PHOTO_CATEGORIES else parts[0])
        if parts[0].startswith('.psi-') or parts[0] == 'psi-job.json':
            # Exact original internal metadata and caches remain in recovery.
            continue
        destination_folder = workspace / category if category in CATEGORIES else workspace / path.relative_to(source).parent
        for parent in (destination_folder, *destination_folder.parents):
            if parent == workspace:
                break
            if parent.is_symlink():
                raise ValueError('Consolidation destination must not use symlinks')
        destination_folder.mkdir(parents=True, exist_ok=True)
        fingerprint = journal['inventory'][old_relative]
        prior = dict(source_state.get(old_relative, {}))
        owner = _flat_job_for_source(prior, by_id, primary)
        prior['job_id'] = owner['job_id']
        identical = None
        for candidate in sorted(destination_folder.iterdir()):
            if candidate.is_symlink():
                raise ValueError('Upload categories must not contain symlinks')
            if candidate.is_file() and candidate.stat().st_size == fingerprint['bytes'] and hashlib.sha256(candidate.read_bytes()).hexdigest() == fingerprint['sha256']:
                identical = candidate
                break
        destination = identical or _available_destination(destination_folder, path.name)
        if identical is None:
            # Exclusive temporary copy, then Windows' no-overwrite rename.
            temporary = destination_folder / (uuid.uuid4().hex + '.download')
            try:
                with path.open('rb') as incoming, temporary.open('xb') as outgoing:
                    shutil.copyfileobj(incoming, outgoing)
                    outgoing.flush()
                    os.fsync(outgoing.fileno())
                shutil.copystat(path, temporary)
                if hashlib.sha256(temporary.read_bytes()).hexdigest() != fingerprint['sha256']:
                    raise ValueError('Copy verification failed; originals preserved')
                if os.name == 'nt':
                    os.rename(temporary, destination)
                else:
                    os.link(temporary, destination)
            finally:
                temporary.unlink(missing_ok=True)
        relative = str(destination.relative_to(workspace))
        mapping[old_relative] = relative
        existing = state.get(relative, {})
        if not existing or (prior.get('status') == 'uploaded' and existing.get('status') != 'uploaded'):
            if prior.get('source_size') is not None:
                prior['source_size'] = destination.stat().st_size
                prior['source_mtime_ns'] = destination.stat().st_mtime_ns
            state[relative] = prior
        # Keep every pre-existing cloud receipt while changing only its local name.
    receipts = state.setdefault('_cloud_photos', {}) if source_state.get('_cloud_photos') else state.get('_cloud_photos', {})
    for asset_id, receipt in source_state.get('_cloud_photos', {}).items():
        old_relative = str(Path('Workshop photos') / receipt.get('name', ''))
        receipts[asset_id] = {**receipt, 'name': Path(mapping[old_relative]).name} if old_relative in mapping else receipt
    atomic_json(state_path, state)
    journal['files'] = mapping
    for old_relative, relative in mapping.items():
        target = workspace / relative
        if target.stat().st_size != journal['inventory'][old_relative]['bytes'] or hashlib.sha256(target.read_bytes()).hexdigest() != journal['inventory'][old_relative]['sha256']:
            raise ValueError('Consolidated file verification failed; originals preserved')
    if workspace_inventory(source) != journal['inventory']:
        raise ValueError('Source changed during consolidation; preserved for review')
    # The original folder is retained, not deleted, outside the upload scanner.
    source.rename(checkpoint / 'retired')
    journal['state'] = 'complete'
    atomic_json(checkpoint / 'migration.json', journal)


def _flatten_vehicle_workspace(root, workspace, incoming, connection, allow_repair=False):
    candidates, _ = local_folder_scan(root)
    sources, all_jobs = [], {}
    for source in candidates:
        old = manifest_for(source)
        if source != workspace and _workspace_identity(old) != _workspace_identity(incoming) and old['job_id'] != incoming['job_id']:
            continue
        items = [old]
        link_path = source / '.psi-linked-jobs.json'
        if link_path.exists():
            # A v2 account claim can upgrade every job's IDs together. Validate
            # its old local ownership first, then verify/upgrade every job below.
            link_data = json.loads(link_path.read_text(encoding='utf-8-sig'))
            items += linked_job_manifests(source, old, None if link_data.get('schema') == 2 else connection)
        checked = []
        for item in items:
            if item['job_id'] == incoming['job_id']:
                if not _manifest_update_allowed(item, incoming, allow_repair):
                    raise ValueError('This folder already contains a different PSI job manifest')
                item = incoming
            elif _workspace_identity(item) != _workspace_identity(incoming) and connection:
                jobs = connection.call('/rest/v1/workshop_jobs?select=*&id=eq.' + item['job_id'])
                upgraded = manifest_from_job(connection, jobs[0]) if len(jobs) == 1 else {}
                if not _manifest_update_allowed(item, upgraded, allow_repair):
                    raise ValueError('Account claim requires verification of every historical job')
                item = upgraded
            verify_manifest(item, connection)
            if _workspace_identity(item) != _workspace_identity(incoming) or not _compatible_vehicle_description(_vehicle_description(item), _vehicle_description(incoming)):
                raise ValueError('Vehicle or customer differs; nothing consolidated')
            if item['job_id'] in all_jobs and not _manifest_update_allowed(all_jobs[item['job_id']], item):
                raise ValueError('Historical job details conflict; nothing consolidated')
            all_jobs[item['job_id']] = item
            checked.append(item)
        sources.append((source, checked))
    all_jobs[incoming['job_id']] = incoming
    # New, unassigned files use the latest eligible visit, not a future booking
    # or an invoice-only job. Every existing file keeps its own stored job ID.
    eligible = [item for item in all_jobs.values() if item['job_date'] <= date.today().isoformat()
                and not item['reference'].startswith(('XERO INV-', 'PSI-PHOTOS-'))]
    past = [item for item in all_jobs.values() if item['job_date'] <= date.today().isoformat()]
    pool = eligible or past
    active = (max(pool, key=lambda item: (item['job_date'], item['job_id'])) if pool
              else min(all_jobs.values(), key=lambda item: (item['job_date'], item['job_id'])))
    marker = _read_vehicle_workspace(workspace)
    if (marker.get('schema') == 2 and not marker.get('pending_merge')
            and all(source == workspace for source, _ in sources)
            and len(sources) == 1 and {m['job_id']: m for m in sources[0][1]} == all_jobs
            and manifest_for(workspace) == active):
        return
    marker.update({'schema': 2, 'pending_merge': True})
    atomic_json(workspace / VEHICLE_WORKSPACE_MARKER, marker)
    # Preserve root-file attribution before the active manifest can change.
    state_path = workspace / '.psi-upload-status.json'
    state = json.loads(state_path.read_text()) if state_path.exists() else {}
    if (workspace / 'psi-job.json').is_file():
        root_manifest = manifest_for(workspace)
        for category in (*CATEGORIES, *CATEGORY_ALIASES, *LEGACY_PHOTO_CATEGORIES):
            directory = workspace / category
            for path in directory.iterdir() if directory.is_dir() else []:
                if path.is_file() and not path.is_symlink():
                    relative = str(path.relative_to(workspace))
                    prior = state.setdefault(relative, {})
                    owner = _flat_job_for_source(prior, all_jobs, root_manifest)
                    prior['job_id'] = owner['job_id']
        atomic_json(state_path, state)
    atomic_json(workspace / 'psi-job.json', active)
    link_path = workspace / '.psi-linked-jobs.json'
    others = [item for item in all_jobs.values() if item['job_id'] != active['job_id']]
    if others:
        atomic_json(link_path, {'schema': 2, 'purpose': 'shared_vehicle_files', 'primary_job_id': active['job_id'], 'jobs': others})
        hide_windows_folder(link_path)
    else:
        link_path.unlink(missing_ok=True)
    for source, items in sources:
        if source != workspace:
            _merge_flat_source(root, workspace, source, items, connection)
            parent = source.parent
            if parent.name == 'Jobs' and parent.is_dir() and not any(parent.iterdir()):
                parent.rmdir()
                if parent.parent != workspace:
                    _cleanup_empty_vehicle_workspace(parent.parent)
    for category in CATEGORIES:
        (workspace / category).mkdir(exist_ok=True)
    visits = workspace / 'Jobs'
    if visits.is_dir() and not visits.is_symlink() and not any(visits.iterdir()):
        visits.rmdir()
    for sibling in list(workspace.parent.iterdir()):
        if sibling != workspace and sibling.is_dir() and (sibling / VEHICLE_WORKSPACE_MARKER).is_file():
            other = _read_vehicle_workspace(sibling)
            if other and other['identity'] == marker['identity']:
                _cleanup_empty_vehicle_workspace(sibling)
    migrate_category_folders(workspace)
    consolidate_photo_folders(workspace)
    marker['pending_merge'] = False
    atomic_json(workspace / VEHICLE_WORKSPACE_MARKER, marker)
    hide_windows_folder(workspace / VEHICLE_WORKSPACE_MARKER)


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
    return create_folder_from_manifest(root, manifest, connection=connection)


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
            '&or=(job_date.gte.' + earliest + ',reference.like.PSI-PHOTOS-*)&order=job_date.asc&limit=500')
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
    try:
        _remove_legacy_vehicle_index(root)
    except Exception as error:
        errors.append('Old customer vehicle index: ' + str(error))
    live_jobs = connection.call(path)
    for job in live_jobs:
        check_pause(connection)
        try:
            vehicle = vehicles_by_id.get(job.get('vehicle_id')) if job.get('vehicle_id') else workshop_vehicles_by_id.get(job.get('workshop_vehicle_id'))
            customer_name = customer_names.get(job.get('customer_id')) if job.get('customer_id') else workshop_names.get(job.get('workshop_contact_id'))
            manifest = manifest_from_job(connection, job, vehicle, customer_name)
            connection.verified_jobs[job['id']] = manifest
            folder = create_folder_from_manifest(root, manifest, allow_workshop_identity_repair=True, connection=connection)
            created.append(folder)
        except Exception as error:
            errors.append(f'{job.get("reference", "Unknown job")}: {error}')
    update_duplicate_review(root, live_jobs, errors)
    return created, errors


def update_duplicate_review(root, live_jobs, errors):
    """Persist uncertain same-visit job candidates, never silently merge visits."""
    folders, _ = local_folder_scan(root)
    linked_ids = set()
    for folder in folders:
        link_path = folder / '.psi-linked-jobs.json'
        if link_path.is_file() and not link_path.is_symlink():
            links = json.loads(link_path.read_text(encoding='utf-8-sig'))
            linked_ids.update(item['job_id'] for item in links.get('jobs', []))
    groups = {}
    for job in live_jobs:
        if not job.get('customer_id') or not job.get('vehicle_id') or job['id'] in linked_ids:
            continue
        key = (job['customer_id'], job['vehicle_id'], job['job_date'])
        groups.setdefault(key, []).append(job)
    candidates = []
    for (customer_id, vehicle_id, visit_date), jobs in sorted(groups.items()):
        if len(jobs) > 1 and any(job.get('reference', '').startswith('XERO INV-') for job in jobs):
            candidates.append({'customer_id': customer_id, 'vehicle_id': vehicle_id, 'date': visit_date,
                               'jobs': [{'job_id': job['id'], 'reference': job['reference']} for job in jobs]})
    data = {'schema': 1, 'same_visit_invoice_candidates': candidates, 'sync_errors': errors}
    path = root / '.psi-duplicate-review.json'
    if path.is_symlink():
        raise ValueError('Duplicate review report must not be a symlink')
    current = json.loads(path.read_text(encoding='utf-8-sig')) if path.exists() else None
    if current != data:
        atomic_json(path, data)
    hide_windows_folder(path)


def local_folder_scan(root):
    """Return verified job folders and unverified folders needing human review."""
    jobs, review = [], []
    for top in root.iterdir():
        if top.is_symlink() or not top.is_dir():
            continue
        if top.name == WORKSPACE_RECOVERY_FOLDER:
            marker = top / '.psi-recovery.json'
            try:
                if not marker.is_symlink() and marker.is_file() and json.loads(marker.read_text(encoding='utf-8-sig')) == {
                    'schema': 1, 'purpose': 'vehicle_workspace_recovery'
                }:
                    continue
            except (OSError, ValueError):
                pass
            review.append(top)
            continue
        if (top / 'psi-job.json').is_file():
            jobs.append(top)
            continue
        if _read_customer_marker(top):
            for child in top.iterdir():
                if child.is_symlink() or not child.is_dir():
                    continue
                has_primary = (child / 'psi-job.json').is_file()
                if has_primary:
                    jobs.append(child)
                if (child / VEHICLE_WORKSPACE_MARKER).is_file():
                    try:
                        _read_vehicle_workspace(child)
                        visits = child / 'Jobs'
                        if has_primary and not visits.exists():
                            continue
                        if visits.is_symlink() or not visits.is_dir():
                            raise ValueError('Invalid vehicle Jobs directory')
                        for visit in visits.iterdir():
                            if visit.is_symlink() or not visit.is_dir() or not (visit / 'psi-job.json').is_file():
                                review.append(visit)
                            else:
                                jobs.append(visit)
                    except (OSError, ValueError):
                        review.append(child)
                elif not has_primary:
                    review.append(child)
            continue
        review.append(top)
    return jobs, review


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
    display_name = input_fn('Customer name: ').strip()
    mobile = input_fn('Customer mobile (optional if email supplied): ').strip()
    email = input_fn('Customer email (optional if mobile supplied): ').strip().lower()
    if not display_name or (not mobile and not email):
        raise ValueError('Enter the customer name and at least a mobile or email')
    if email and not re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', email):
        raise ValueError('Enter a valid customer email or leave it blank')
    return {
        'p_display_name': display_name,
        'p_email': email or None,
        'p_mobile': mobile or None,
        **_new_vehicle_details(input_fn, registration),
    }


def _new_vehicle_details(input_fn, registration):
    year_text = input_fn('Vehicle year: ').strip()
    if not year_text.isdigit() or not 1900 <= int(year_text) <= 2200:
        raise ValueError('Enter a valid four-digit vehicle year')
    make = input_fn('Vehicle make: ').strip()
    model = input_fn('Vehicle model: ').strip()
    if not make or not model:
        raise ValueError('Enter the vehicle make and model')
    return {
        'p_registration': registration,
        'p_year': int(year_text),
        'p_make': make,
        'p_model': model,
    }


def _normalized_identity_text(value):
    return re.sub(r'\s+', ' ', str(value or '').strip()).casefold()


def _normalized_mobile(value):
    return re.sub(r'\D+', '', str(value or ''))


def _customer_search_choices(connection, search_term):
    """Return active customers matching a staff-entered discovery term.

    This is only a discovery search. The selected immutable customer/contact ID,
    rather than the entered text, is used when the vehicle is created.
    """
    wanted_text = _normalized_identity_text(search_term)
    wanted_mobile = _normalized_mobile(search_term)
    phone_search = len(wanted_mobile) >= 4 and not re.search(r'[a-z@]', wanted_text)
    if len(wanted_text) < 2:
        raise ValueError('Enter at least two letters, or a customer email or mobile')

    matches = []
    profiles = connection.call(
        '/rest/v1/customer_profiles?select=user_id,first_name,last_name,email,mobile,account_state'
        '&account_state=eq.active&limit=2000'
    )
    for profile in profiles:
        name = ' '.join(filter(None, (profile.get('first_name'), profile.get('last_name')))).strip()
        email = str(profile.get('email') or '').strip()
        mobile = str(profile.get('mobile') or '').strip()
        text_match = wanted_text in _normalized_identity_text(name) or wanted_text in email.casefold()
        mobile_match = phone_search and wanted_mobile in _normalized_mobile(mobile)
        if text_match or mobile_match:
            matches.append(('app', profile, name or email, email, mobile))

    contacts = connection.call(
        '/rest/v1/workshop_contacts?select=id,display_name,email,mobile,status'
        '&status=eq.active&limit=2000'
    )
    for contact in contacts:
        name = str(contact.get('display_name') or '').strip()
        email = str(contact.get('email') or '').strip()
        mobile = str(contact.get('mobile') or '').strip()
        text_match = wanted_text in _normalized_identity_text(name) or wanted_text in email.casefold()
        mobile_match = phone_search and wanted_mobile in _normalized_mobile(mobile)
        if text_match or mobile_match:
            matches.append(('workshop', contact, name or email or mobile, email, mobile))

    matches.sort(key=lambda item: (_normalized_identity_text(item[2]), item[0], item[1].get('user_id') or item[1].get('id')))
    if not matches:
        raise ValueError('No active customer matched that search. Nothing was created')
    if len(matches) > 20:
        raise ValueError('More than 20 customers matched. Search again with more of the name, email or mobile')
    return matches


def _select_existing_customer(connection, input_fn):
    matches = _customer_search_choices(
        connection,
        input_fn('Search customer name, email or mobile: ').strip(),
    )
    print('Check the customer details carefully before choosing:')
    for index, (owner_type, _owner, name, email, mobile) in enumerate(matches, 1):
        label = 'App customer' if owner_type == 'app' else 'Workshop-only customer'
        details = ' | '.join(value for value in (name, email, mobile, label) if value)
        print(f'{index}. {details}')
    selected_text = input_fn('Choose customer: ').strip()
    if not selected_text.isdigit() or not 1 <= int(selected_text) <= len(matches):
        raise ValueError('Choose one of the listed customers')
    owner_type, owner, name, _email, _mobile = matches[int(selected_text) - 1]
    return owner_type, owner, name


def _existing_customer_match(connection, customer):
    """Find one exact existing identity before creating another contact.

    Name alone is never enough. The entered name must match exactly together
    with either the verified email or the normalized mobile number.
    """
    wanted_name = _normalized_identity_text(customer['p_display_name'])
    wanted_email = str(customer.get('p_email') or '').strip().casefold()
    wanted_mobile = _normalized_mobile(customer.get('p_mobile'))
    matches = []

    profiles = connection.call(
        '/rest/v1/customer_profiles?select=user_id,first_name,last_name,email,mobile,account_state'
        '&account_state=eq.active&limit=2000'
    )
    for profile in profiles:
        name = ' '.join(filter(None, (profile.get('first_name'), profile.get('last_name')))).strip()
        name_matches = _normalized_identity_text(name) == wanted_name
        email_matches = bool(wanted_email) and str(profile.get('email') or '').strip().casefold() == wanted_email
        mobile_matches = bool(wanted_mobile) and _normalized_mobile(profile.get('mobile')) == wanted_mobile
        if name_matches and (email_matches or mobile_matches):
            matches.append(('app', profile, name or profile['email']))

    contacts = connection.call(
        '/rest/v1/workshop_contacts?select=id,display_name,email,mobile,status'
        '&status=eq.active&limit=2000'
    )
    for contact in contacts:
        name_matches = _normalized_identity_text(contact.get('display_name')) == wanted_name
        email_matches = bool(wanted_email) and str(contact.get('email') or '').strip().casefold() == wanted_email
        mobile_matches = bool(wanted_mobile) and _normalized_mobile(contact.get('mobile')) == wanted_mobile
        if name_matches and (email_matches or mobile_matches):
            matches.append(('workshop', contact, contact['display_name']))

    if len(matches) > 1:
        raise ValueError(
            'More than one existing customer has these exact details. '
            'Nothing was created; review the customer records first.'
        )
    return matches[0] if matches else None


def _create_new_vehicle_for_customer(connection, owner_type, owner, customer):
    if owner_type == 'app':
        return connection.call('/rest/v1/customer_vehicles', 'POST', {
            'customer_id': owner['user_id'],
            'registration': customer['p_registration'],
            'year': customer['p_year'],
            'make': customer['p_make'],
            'model': customer['p_model'],
            'created_by': connection.user_id,
        }, headers={'Prefer': 'return=representation'})[0]
    return connection.call('/rest/v1/workshop_vehicles', 'POST', {
        'workshop_contact_id': owner['id'],
        'registration': customer['p_registration'],
        'year': customer['p_year'],
        'make': customer['p_make'],
        'model': customer['p_model'],
        'created_by': connection.user_id,
    }, headers={'Prefer': 'return=representation'})[0]


def _reuse_invoice_job(connection, vehicle, title, input_fn):
    """Offer verified invoice-only jobs, never merge separate visits by name."""
    jobs = connection.call(
        '/rest/v1/workshop_jobs?select=*&customer_id=eq.' + vehicle['customer_id']
        + '&vehicle_id=eq.' + vehicle['id'] + '&order=job_date.desc&limit=100'
    )
    candidates = []
    for job in jobs:
        if (job.get('customer_id') != vehicle['customer_id']
                or job.get('vehicle_id') != vehicle['id']
                or job.get('booking_request_id')
                or not str(job.get('reference', '')).startswith('XERO INV-')
                or not str(job.get('title', '')).startswith('Xero invoice INV-')):
            continue
        records = connection.call('/rest/v1/vault_records?select=id,kind&job_id=eq.' + job['id'])
        if records and all(record.get('kind') == 'invoice' for record in records):
            candidates.append(job)
    if not candidates:
        return None
    print('Existing invoice jobs for this verified customer and vehicle:')
    for index, job in enumerate(candidates, 1):
        print(f'{index}. {job["reference"]} | {job["job_date"]}')
    print('0. Create a separate visit')
    answer = input_fn('Use the invoice job for this work? Choose its number, or 0 for a separate visit: ').strip()
    if not answer.isdigit() or not 0 <= int(answer) <= len(candidates):
        raise ValueError('Choose an invoice job number or 0 for a separate visit')
    if int(answer) == 0:
        return None
    print('Reusing the existing invoice job and its original date; invoice links are preserved.')
    job = candidates[int(answer) - 1]
    updated = connection.call(
        '/rest/v1/workshop_jobs?id=eq.' + job['id']
        + '&customer_id=eq.' + vehicle['customer_id'] + '&vehicle_id=eq.' + vehicle['id']
        + '&title=eq.' + urllib.parse.quote(job['title'], safe=''),
        'PATCH', {'title': title}, headers={'Prefer': 'return=representation'},
    )
    if len(updated) != 1:
        raise ValueError('The existing invoice job changed. Nothing new was created; review and retry')
    return updated[0]


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
            print(f'{index}. {vehicle["year"]} {vehicle["make"]} {vehicle["model"]} | {name} | {label}')
        print(f'{len(choices) + 1}. Create a new workshop-only customer and vehicle')
        selected = int(input_fn('Choose vehicle: ') or '1')
        if selected < 1 or selected > len(choices) + 1:
            raise ValueError('Choose one of the listed vehicles')
        if selected <= len(choices):
            selected_choice = choices[selected - 1]

    new_customer = None
    if not selected_choice:
        print('No selected vehicle matches this registration.')
        print('1. Find an existing customer and add this vehicle')
        print('2. Create a new workshop-only customer and vehicle')
        customer_option = input_fn('Choose customer option [1]: ').strip() or '1'
        if customer_option == '1':
            owner_type, owner, customer_name = _select_existing_customer(connection, input_fn)
            new_customer = _new_vehicle_details(input_fn, registration)
            vehicle = _create_new_vehicle_for_customer(connection, owner_type, owner, new_customer)
            selected_choice = (owner_type, vehicle, customer_name)
        elif customer_option == '2':
            new_customer = _new_workshop_customer(input_fn, registration)
            matched_customer = _existing_customer_match(connection, new_customer)
            if matched_customer:
                owner_type, owner, customer_name = matched_customer
                print(f'Existing customer matched exactly: {customer_name}. Adding this vehicle to that customer.')
                vehicle = _create_new_vehicle_for_customer(connection, owner_type, owner, new_customer)
                selected_choice = (owner_type, vehicle, customer_name)
        else:
            raise ValueError('Choose 1 to find a customer or 2 to create a new customer')

    if selected_choice and selected_choice[0] == 'app':
        _, vehicle, customer_name = selected_choice
        _preflight_vehicle_workspace(root, {
            'schema': 1, 'project_ref': urllib.parse.urlparse(connection.url).hostname.split('.')[0],
            'customer_id': vehicle['customer_id'], 'vehicle_id': vehicle['id'],
            'registration': vehicle['registration'], 'vehicle_year': vehicle.get('year'),
            'vehicle_make': vehicle.get('make'), 'vehicle_model': vehicle.get('model'),
        }, connection)
        job_date, title = _manual_job_details(input_fn, vehicle['registration'])
        job = _reuse_invoice_job(connection, vehicle, title, input_fn)
        if job is None:
            reference = 'PSI-PHONE-' + job_date.replace('-', '') + '-' + uuid.uuid4().hex[:8].upper()
            job = connection.call('/rest/v1/workshop_jobs', 'POST', {
                'customer_id': vehicle['customer_id'], 'vehicle_id': vehicle['id'],
                'reference': reference, 'title': title, 'job_date': job_date,
                'created_by': connection.user_id,
            }, headers={'Prefer': 'return=representation'})[0]
    else:
        existing_vehicle = selected_choice[1] if selected_choice else None
        if existing_vehicle:
            _preflight_vehicle_workspace(root, {
                'schema': 2, 'project_ref': urllib.parse.urlparse(connection.url).hostname.split('.')[0],
                'workshop_contact_id': existing_vehicle['workshop_contact_id'], 'workshop_vehicle_id': existing_vehicle['id'],
                'registration': existing_vehicle['registration'], 'vehicle_year': existing_vehicle.get('year'),
                'vehicle_make': existing_vehicle.get('make'), 'vehicle_model': existing_vehicle.get('model'),
            }, connection)
        customer_name = selected_choice[2] if selected_choice else None
        customer = {
            'p_display_name': None, 'p_email': None, 'p_mobile': None,
            'p_registration': None, 'p_year': None, 'p_make': None, 'p_model': None,
        } if existing_vehicle else new_customer
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
    return create_folder_from_manifest(root, manifest, connection=connection)


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


def _unchanged_terminal_source(prior, before, workshop_only):
    if prior.get('source_size') != before[0] or prior.get('source_mtime_ns') != before[1]:
        return False
    if prior.get('status') == 'uploaded':
        return True
    return workshop_only and prior.get('status') == 'waiting_for_customer_account'


def _source_state(source_key, status, before, **extra):
    return {
        'key': source_key,
        'status': status,
        'source_size': before[0],
        'source_mtime_ns': before[1],
        **extra,
    }


def _publish_text_record(folder, manifest, connection, state, path, relative, category, category_key, record_type):
    before = (path.stat().st_size, path.stat().st_mtime_ns)
    if time.time() - path.stat().st_mtime < 5:
        return
    workshop_only = manifest.get('schema') == 2 and manifest.get('owner_type') == 'workshop'
    prior = state.get(relative, {})
    if _unchanged_terminal_source(prior, before, workshop_only):
        return
    raw, note = _text_note(path)
    if before != (path.stat().st_size, path.stat().st_mtime_ns):
        return
    digest = hashlib.sha256(raw).hexdigest()
    source_key = f'pc:{manifest["job_id"]}:{category_key}:{digest}'
    if (prior.get('key') == source_key or str(prior.get('key', '')).endswith(':' + digest)) and prior.get('status') == 'uploaded':
        state[relative] = _source_state(source_key, 'uploaded', before, record_id=prior.get('record_id'))
        return
    if not connection or workshop_only:
        out = prepared_folder(folder) / category
        out.mkdir(parents=True, exist_ok=True)
        hide_windows_folder(folder / '.psi-prepared')
        (out / (digest + '.txt')).write_bytes(raw)
        state[relative] = _source_state(
            source_key, 'waiting_for_customer_account' if workshop_only else 'prepared', before,
            bytes=len(raw),
        )
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
    state[relative] = _source_state(source_key, 'uploaded', before, record_id=record['id'])


def _object_suffix(mime):
    if mime == 'application/pdf':
        return '.pdf'
    if mime.startswith('image/'):
        return '.jpg'
    raise ValueError('Unsupported upload file type')


def invoice_identity(value):
    """Return a conservative invoice key only for filenames carrying an INV number."""
    compact = re.sub(r'[^A-Z0-9]+', '', Path(value).stem.upper())
    for prefix in ('XEROINVOICE', 'INVOICE', 'XERO'):
        if compact.startswith(prefix):
            compact = compact[len(prefix):]
            break
    return compact if re.fullmatch(r'INV[A-Z0-9]{2,}', compact) else None


def published_invoice_for_job(connection, job_id, filename):
    """Avoid a second visible copy when Xero or the workshop already published this invoice."""
    identity = invoice_identity(filename)
    if not identity:
        return None
    path = (
        '/rest/v1/vault_records?select=id,title,source,published_at'
        '&job_id=eq.' + urllib.parse.quote(job_id, safe='')
        + '&kind=eq.invoice&published_at=not.is.null'
    )
    matches = [record for record in connection.call(path) if invoice_identity(record.get('title', '')) == identity]
    if len(matches) > 1:
        raise ValueError('More than one published copy of this invoice needs PSI review')
    return matches[0] if matches else None


def archive_exact_source_duplicates(folder, state, connection=None):
    """Keep one identical source per job/category; retain every extra in recovery."""
    check_pause(connection)
    recovery = folder / '.psi-duplicate-originals'
    if recovery.is_symlink():
        raise ValueError('Duplicate recovery folder must not be a symlink')
    index_path = recovery / 'index.json'
    if index_path.is_symlink():
        raise ValueError('Duplicate recovery index must not be a symlink')
    prior_index = json.loads(index_path.read_text(encoding='utf-8-sig')) if index_path.exists() else []
    if not isinstance(prior_index, list):
        raise ValueError('Invalid duplicate recovery index')
    changes = []
    for category in CATEGORIES:
        category_path = folder / category
        if not category_path.is_dir() or category_path.is_symlink():
            continue
        groups = {}
        for source in sorted(category_path.iterdir()):
            if not source.is_file() or source.is_symlink():
                continue
            if source.suffix.lower() not in IMAGE_SUFFIXES + ('.pdf', '.txt'):
                continue
            before = (source.stat().st_size, source.stat().st_mtime_ns)
            if before[0] > 40 * 1024 * 1024 or time.time() - source.stat().st_mtime < 5:
                continue
            digest = hashlib.sha256(source.read_bytes()).hexdigest()
            if before != (source.stat().st_size, source.stat().st_mtime_ns):
                continue
            groups.setdefault((before[0], digest), []).append(source)
        for (_, digest), sources in groups.items():
            if len(sources) < 2:
                continue
            sources.sort(key=lambda source: (
                state.get(str(source.relative_to(folder)), {}).get('status') != 'uploaded', source.name))
            keep = sources[0]
            for source in sources[1:]:
                relative = str(source.relative_to(folder))
                destination_folder = recovery / category
                if destination_folder.is_symlink():
                    raise ValueError('Duplicate recovery category must not be a symlink')
                destination_folder.mkdir(parents=True, exist_ok=True)
                destination = _available_destination(destination_folder, source.name)
                # Recheck immediately before archiving; never overwrite an original.
                if hashlib.sha256(source.read_bytes()).hexdigest() != digest or hashlib.sha256(keep.read_bytes()).hexdigest() != digest:
                    raise ValueError('Duplicate source changed while checking; preserved for review')
                prior = state.get(relative, {})
                source.rename(destination)
                state.pop(relative, None)
                changes.append({'source': relative, 'retained': str(keep.relative_to(folder)),
                                'archived': str(destination.relative_to(folder)), 'sha256': digest, 'prior_status': prior})
    if changes:
        atomic_json(index_path, prior_index + changes)
        atomic_json(folder / '.psi-upload-status.json', state)
        hide_windows_folder(recovery)
    return changes


def photo_signature(content):
    """Same conservative RGB cell averages as the portal, with EXIF removed."""
    with Image.open(io.BytesIO(content)) as source:
        image = ImageOps.exif_transpose(source).convert('RGB')
        width, height = image.size
        values = []
        for y in range(64):
            for x in range(64):
                x0, y0 = x * width // 64, y * height // 64
                x1, y1 = max(x0 + 1, (x + 1) * width // 64), max(y0 + 1, (y + 1) * height // 64)
                # Native channel sums preserve the old exact cell averages without
                # millions of interpreted pixel operations for every comparison.
                cell = image.crop((min(x0, width - 1), min(y0, height - 1),
                                   min(x1, width), min(y1, height)))
                sums = ImageStat.Stat(cell).sum
                count = (x1 - x0) * (y1 - y0)
                values.extend(int(total / count + .5) for total in sums)
        return f'rgb64:{width}:{height}:' + bytes(values).hex()


def visually_identical(first, second):
    pattern = r'rgb64:([1-9][0-9]*):([1-9][0-9]*):([a-f0-9]{24576})'
    a, b = re.fullmatch(pattern, first or ''), re.fullmatch(pattern, second or '')
    if not a or not b or abs(int(a[1]) / int(a[2]) - int(b[1]) / int(b[2])) > .001:
        return False
    left, right = bytes.fromhex(a[3]), bytes.fromhex(b[3])
    differences = [abs(x - y) for x, y in zip(left, right)]
    mean = sum(left) / len(left)
    return max(differences) <= 3 and sum(differences) / len(left) <= .5 and sum(x * x for x in left) / len(left) - mean * mean > 64


def published_photos(connection, manifest):
    photos = []
    for offset in range(0, 1000000, 100):
        check_pause(connection)
        rows = connection.call('/rest/v1/vault_assets?select=*,vault_records!inner(kind,published_at,job_id)'
            + '&customer_id=eq.' + manifest['customer_id'] + '&vehicle_id=eq.' + manifest['vehicle_id']
            + '&ready=eq.true&vault_records.kind=eq.media&vault_records.published_at=not.is.null'
            + f'&order=id&limit=100&offset={offset}')
        photos.extend(rows)
        if len(rows) < 100:
            return photos
    raise ValueError('Photo list is too large; PSI review required')


def identical_photo_pixels(first, second):
    with Image.open(io.BytesIO(first)) as a, Image.open(io.BytesIO(second)) as b:
        left, right = ImageOps.exif_transpose(a).convert('RGB'), ImageOps.exif_transpose(b).convert('RGB')
        if left.size != right.size:
            return False
        difference = ImageChops.difference(left, right)
        return max(high for low, high in difference.getextrema()) <= 3 and sum(ImageStat.Stat(difference).mean) / 3 <= .5


def read_cloud_photo(connection, asset, manifest):
    """Validate identity, path, size and digest before accepting cloud bytes."""
    if asset['customer_id'] != manifest['customer_id'] or asset['vehicle_id'] != manifest['vehicle_id']:
        raise ValueError('Photo belongs to a different customer or vehicle')
    for field in ('id', 'record_id'):
        if str(uuid.UUID(asset[field])) != asset[field]:
            raise ValueError('Invalid photo identifier')
    mime = asset['mime_type']
    suffix = {'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'application/pdf': '.pdf'}.get(mime)
    if not suffix or not 0 < asset['size_bytes'] <= 20 * 1024 * 1024:
        raise ValueError('Unsupported photo size or type')
    expected = f'{manifest["customer_id"]}/{manifest["vehicle_id"]}/{asset["record_id"]}/{asset["id"]}/original{suffix}'
    if asset['object_path'] != expected:
        raise ValueError('Photo path does not match its verified profile')
    content = connection.call('/storage/v1/object/authenticated/performance-vault/' + urllib.parse.quote(expected, safe='/'), read_binary=True)
    if len(content) != asset['size_bytes'] or hashlib.sha256(content).hexdigest() != asset['sha256']:
        raise ValueError('Downloaded photo did not pass its integrity check')
    return content, suffix


def sync_portal_photos(folder, connection):
    """Download published profile photos to their verified desktop job folder."""
    check_pause(connection)
    marker = _read_vehicle_workspace(folder)
    if marker and marker.get('pending_merge'):
        raise ValueError('Folder consolidation is not complete; existing uploads remain protected')
    manifest = manifest_for(folder, connection)
    if manifest.get('schema') == 2:
        return 0
    manifests = [manifest] + linked_job_manifests(folder, manifest, connection)
    job_ids = {item['job_id'] for item in manifests}
    destination = folder / 'Workshop photos'
    if destination.is_symlink():
        raise ValueError('Photos folder must not be a symlink')
    destination.mkdir(exist_ok=True)
    state_path = folder / '.psi-upload-status.json'
    state = json.loads(state_path.read_text()) if state_path.exists() else {}
    receipts = state.setdefault('_cloud_photos', {})
    downloaded = 0
    local_features = {}
    for asset in published_photos(connection, manifest):
        check_pause(connection)
        if asset['vault_records']['job_id'] not in job_ids:
            continue
        receipt = receipts.get(asset['id'], {})
        prior_name = receipt.get('name', '')
        # A receipt cannot redirect reads outside this folder.
        if prior_name and Path(prior_name).name == prior_name:
            prior_path = destination / prior_name
            if prior_path.is_file() and not prior_path.is_symlink() and prior_path.stat().st_size <= 40 * 1024 * 1024:
                prior_before = (prior_path.stat().st_size, prior_path.stat().st_mtime_ns)
                if (hashlib.sha256(prior_path.read_bytes()).hexdigest() == receipt.get('sha256')
                        and prior_before == (prior_path.stat().st_size, prior_path.stat().st_mtime_ns)):
                    relative = str(prior_path.relative_to(folder))
                    before = prior_before
                    prior = state.get(relative, {})
                    state[relative] = {**prior, 'status': 'uploaded', 'source_size': before[0], 'source_mtime_ns': before[1],
                                      'job_id': prior.get('job_id') or asset['vault_records']['job_id']}
                    state[relative].setdefault('key', 'cloud:' + asset['id'])
                    state[relative].setdefault('record_id', asset['record_id'])
                    atomic_json(state_path, state)
                    continue
        content, suffix = read_cloud_photo(connection, asset, manifest)
        target = destination / (asset['id'] + suffix)
        matched = None
        matched_digest, matched_before = asset['sha256'], None
        for local in destination.iterdir():
            check_pause(connection)
            if local.is_symlink() or not local.is_file() or local.suffix.lower() not in IMAGE_SUFFIXES + ('.pdf',):
                continue
            before = (local.stat().st_size, local.stat().st_mtime_ns)
            if before[0] > 40 * 1024 * 1024 or time.time() - local.stat().st_mtime < 5:
                continue
            cached = local_features.get(local)
            if cached is None or cached['stat'] != before:
                cached = {'stat': before, 'digest': hashlib.sha256(local.read_bytes()).hexdigest()}
                local_features[local] = cached
            raw_digest = cached['digest']
            identical = raw_digest in (asset['sha256'], asset.get('source_sha256'))
            if not identical and asset.get('visual_signature') and local.suffix.lower() in IMAGE_SUFFIXES:
                if 'visual' not in cached:
                    prepared, _, _ = prepare_file(local)
                    cached['visual'] = photo_signature(prepared)
                if visually_identical(cached['visual'], asset['visual_signature']):
                    prepared, _, _ = prepare_file(local)
                    identical = identical_photo_pixels(prepared, content)
            if identical and before == (local.stat().st_size, local.stat().st_mtime_ns):
                matched = local
                matched_digest, matched_before = raw_digest, before
                break
        if matched is None:
            if target.exists() or target.is_symlink():
                if target.is_symlink() or not target.is_file() or hashlib.sha256(target.read_bytes()).hexdigest() != asset['sha256']:
                    target = _available_destination(destination, target.name)
            if not target.exists():
                # Only complete files become visible to the upload scanner.
                partial = destination / (str(uuid.uuid4()) + '.download')
                try:
                    with partial.open('xb') as output:
                        output.write(content)
                        output.flush()
                        os.fsync(output.fileno())
                    before = (partial.stat().st_size, partial.stat().st_mtime_ns)
                    relative = str(target.relative_to(folder))
                    state[relative] = _source_state('cloud:' + asset['id'], 'uploaded', before,
                        record_id=asset['record_id'], job_id=asset['vault_records']['job_id'], cloud_origin=True)
                    receipts[asset['id']] = {'name': target.name, 'sha256': asset['sha256']}
                    atomic_json(state_path, state)
                    if os.name == 'nt':
                        os.rename(partial, target)  # Windows refuses replacement.
                    else:
                        os.link(partial, target)  # Atomic, exclusive creation.
                finally:
                    partial.unlink(missing_ok=True)
                downloaded += 1
            matched = target
        before = (matched.stat().st_size, matched.stat().st_mtime_ns)
        digest = hashlib.sha256(matched.read_bytes()).hexdigest()
        if (digest != matched_digest or before != (matched.stat().st_size, matched.stat().st_mtime_ns)
                or (matched_before is not None and before != matched_before)):
            raise ValueError('Local photo changed during download verification; retrying without overwriting it')
        relative = str(matched.relative_to(folder))
        # Never replace the existing per-file visit route with a later asset.
        if state.get(relative, {}).get('status') != 'uploaded':
            state[relative] = _source_state('cloud:' + asset['id'], 'uploaded', before, record_id=asset['record_id'], job_id=asset['vault_records']['job_id'])
        receipts[asset['id']] = {'name': matched.name, 'sha256': digest}
        atomic_json(state_path, state)
    return downloaded


REPORT_CATEGORIES = {
    'service': 'Service & repair history', 'recommendation': 'Recommended work',
    'dyno': 'Dyno results & graphs', 'invoice': 'Invoice archive',
    'media': 'Workshop photos', 'document': "Documents + DTC's", 'modification': "Documents + DTC's",
}
REPORT_TABLES = ('vault_records', 'vault_assets', 'repair_records', 'recommended_work', 'dyno_records', 'invoices', 'vehicle_files')


def configure_report_scan(connection, folders):
    """Batch only live-verified owner/vehicle pairs, with a fresh cache per scan."""
    scopes = set()
    for folder in folders:
        check_pause(connection)
        try:
            marker = _read_vehicle_workspace(folder)
            if marker and marker.get('pending_merge'):
                continue
            manifest = manifest_for(folder, connection)
            if manifest['schema'] == 1:
                scopes.add((manifest['customer_id'], manifest['vehicle_id']))
        except (OSError, ValueError):
            # The normal per-folder checks surface the precise error below.
            continue
    connection.report_scopes = scopes
    connection.report_rows = {}


def _report_rows(connection, table, manifest, select='*', filters=''):
    if table not in REPORT_TABLES:
        raise ValueError('Unsupported report source')
    own = (manifest['customer_id'], manifest['vehicle_id'])
    scopes = getattr(connection, 'report_scopes', set())
    scopes = scopes if own in scopes else {own}
    cache = getattr(connection, 'report_rows', None)
    key = (table, select, filters, tuple(sorted(scopes)))
    if cache is not None and key in cache:
        return [row for row in cache[key] if (row['customer_id'], row['vehicle_id']) == own]
    result = []
    # Keep each URL bounded, even if the workshop grows beyond the current PC.
    ordered = sorted(scopes)
    for start in range(0, len(ordered), 20):
        batch = ordered[start:start+20]
        ownership = ','.join(f'and(customer_id.eq.{owner},vehicle_id.eq.{vehicle})' for owner, vehicle in batch)
        for offset in range(0, 1000000, 100):
            check_pause(connection)
            page = connection.call(f'/rest/v1/{table}?select={select}&or=({ownership}){filters}&order=id&limit=100&offset={offset}')
            if any((row.get('customer_id'), row.get('vehicle_id')) not in batch for row in page):
                raise ValueError('Report response does not match its verified ownership scope')
            result.extend(page)
            if len(page) < 100:
                break
        else:
            raise ValueError('Report list is too large; PSI review required')
    if cache is not None:
        cache[key] = result
    return [row for row in result if (row['customer_id'], row['vehicle_id']) == own]


def _report_revision(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False).encode('utf-8')).hexdigest()


def _report_owned(row, manifest):
    if row.get('customer_id') != manifest['customer_id'] or row.get('vehicle_id') != manifest['vehicle_id']:
        raise ValueError('Report belongs to a different customer or vehicle')
    if str(uuid.UUID(row['id'])) != row['id']:
        raise ValueError('Invalid report identifier')


def _download_payload(content, mime):
    suffix = {'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp',
              'text/plain': '.txt'}.get(mime)
    if not suffix or not content or len(content) > (256 * 1024 if suffix == '.txt' else 20 * 1024 * 1024):
        raise ValueError('Unsupported or oversized report file')
    if suffix == '.pdf' and not content.startswith(b'%PDF-'):
        raise ValueError('Invalid downloaded PDF')
    if suffix == '.txt':
        content.decode('utf-8-sig')
    elif mime.startswith('image/'):
        with Image.open(io.BytesIO(content)) as image:
            image.verify()
    return suffix


def _save_report_download(folder, category, source, revision, filename, content_fn, state, manifest,
                          record_id, connection, notes=None, source_reference=None):
    """Receipt before atomic visibility: a crash cannot turn a download into a new upload."""
    destination = folder / category
    if destination.is_symlink():
        raise ValueError('Report category must not be a symlink')
    destination.mkdir(exist_ok=True)
    state_path = folder / '.psi-upload-status.json'
    receipts = state.setdefault('_cloud_downloads', {})
    receipt = receipts.get(source, {})
    matched = None
    expected_local_digest = None
    relative = receipt.get('path', '')
    if relative and Path(relative).parts[:-1] == (category,) and Path(relative).name:
        local = folder / relative
        if (receipt.get('revision') == revision and local.is_file() and not local.is_symlink()
                and local.stat().st_size <= 40 * 1024 * 1024
                and hashlib.sha256(local.read_bytes()).hexdigest() == receipt.get('sha256')):
            matched = local
            expected_local_digest = receipt['sha256']
    # Text uploaded from this PC already exists, usually without export headers.
    if matched is None and notes is not None:
        for relative, prior in list(state.items()):
            check_pause(connection)
            if not isinstance(prior, dict) or prior.get('record_id') != record_id or prior.get('status') != 'uploaded':
                continue
            if Path(relative).parts[:-1] != (category,):
                continue
            local = folder / relative
            if local.is_file() and not local.is_symlink() and local.stat().st_size <= 256 * 1024:
                try:
                    raw = local.read_bytes()
                    local_note = raw.decode('utf-8-sig').replace('\r\n', '\n').replace('\r', '\n').strip()
                    remote_note = str(notes).replace('\r\n', '\n').replace('\r', '\n').strip()
                    if local_note == remote_note:
                        matched = local
                        expected_local_digest = hashlib.sha256(raw).hexdigest()
                        break
                except UnicodeError:
                    pass
    created = False
    if matched is None:
        content, mime = content_fn()
        suffix = _download_payload(content, mime)
        for local in sorted(destination.iterdir()):
            check_pause(connection)
            if not local.is_file() or local.is_symlink() or local.stat().st_size > 40 * 1024 * 1024:
                continue
            raw = local.read_bytes()
            identical = raw == content
            # A prepared JPEG may correspond to an untouched local HEIC/PNG.
            if not identical and mime.startswith('image/') and local.suffix.lower() in IMAGE_SUFFIXES:
                prepared, _, _ = prepare_file(local)
                identical = prepared == content
            if identical:
                matched = local
                expected_local_digest = hashlib.sha256(raw).hexdigest()
                break
        if matched is None:
            label = _safe_folder_part(Path(filename).stem, 90) or ('Report ' + record_id[:8])
            target = _available_destination(destination, label + suffix)
            partial = destination / (uuid.uuid4().hex + '.download')
            try:
                with partial.open('xb') as output:
                    output.write(content)
                    output.flush()
                    os.fsync(output.fileno())
                before = (partial.stat().st_size, partial.stat().st_mtime_ns)
                relative = str(target.relative_to(folder))
                state[relative] = _source_state('cloud:' + source, 'uploaded', before,
                    record_id=record_id, job_id=manifest['job_id'], cloud_origin=True)
                receipts[source] = {'path': relative, 'revision': revision, 'sha256': hashlib.sha256(content).hexdigest()}
                atomic_json(state_path, state)
                if os.name == 'nt':
                    os.rename(partial, target)
                else:
                    os.link(partial, target)
                matched, created = target, True
                expected_local_digest = hashlib.sha256(content).hexdigest()
            finally:
                partial.unlink(missing_ok=True)
    before = (matched.stat().st_size, matched.stat().st_mtime_ns)
    digest = hashlib.sha256(matched.read_bytes()).hexdigest()
    if digest != expected_local_digest or before != (matched.stat().st_size, matched.stat().st_mtime_ns):
        raise ValueError('Local report changed during download verification')
    relative = str(matched.relative_to(folder))
    prior = state.get(relative, {})
    # Preserve the original visit and source key for an already synced PC file.
    state[relative] = {**prior, 'status': 'uploaded', 'source_size': before[0], 'source_mtime_ns': before[1],
                      'record_id': prior.get('record_id') or record_id, 'job_id': prior.get('job_id') or manifest['job_id']}
    state[relative].setdefault('key', source_reference or 'cloud:' + source)
    receipts[source] = {'path': relative, 'revision': revision, 'sha256': digest}
    atomic_json(state_path, state)
    return int(created)


def _report_text(record, kind):
    title = record.get('title') or record.get('invoice_number') or ('Dyno results' if kind == 'dyno' else 'Vehicle record')
    when = record.get('occurred_on') or record.get('repair_date') or record.get('invoice_date') or record.get('tested_at') or record.get('created_at', '')[:10]
    lines = [str(title), 'Date: ' + str(when), 'Source: ' + str(record.get('record_source') or record.get('source') or 'PSI')]
    for field, label in (('odometer_km','Odometer km'),('status','Status'),('timing','Timing'),('fuel','Fuel'),
                         ('power_kw_at_hubs','Power kW'),('torque_nm_at_hubs','Torque Nm'),('power_kw','Power kW'),('torque_nm','Torque Nm')):
        if record.get(field) is not None:
            lines.append(label + ': ' + str(record[field]))
    if record.get('amount_cents') is not None:
        if record.get('currency', 'AUD') != 'AUD':
            raise ValueError('Non-AUD invoice requires PSI review')
        lines.append('Amount: A$' + format(record['amount_cents'] / 100, '.2f') + ' AUD')
    lines += ['', str(record.get('notes') or record.get('summary') or '')]
    return ('\n'.join(lines)).encode('utf-8'), str(when)[:10] + ' ' + str(title) + '.txt'


def _read_legacy_report(connection, row, manifest):
    _report_owned(row, manifest)
    path = row['object_path']
    parts = path.split('/')
    if (row['bucket_id'] != 'vehicle-documents' or not path.startswith(manifest['customer_id'] + '/vehicles/' + manifest['vehicle_id'] + '/')
            or any(part in ('', '.', '..') for part in parts) or '\\' in path or '%' in path or '?' in path or '#' in path):
        raise ValueError('Private report path does not match its verified vehicle')
    if not 0 < row['file_size_bytes'] <= 20 * 1024 * 1024:
        raise ValueError('Invalid report size')
    content = connection.call('/storage/v1/object/authenticated/vehicle-documents/' + urllib.parse.quote(path, safe='/'), read_binary=True)
    if len(content) != row['file_size_bytes']:
        raise ValueError('Private report size verification failed')
    _download_payload(content, row['mime_type'])
    return content, row['mime_type']


def sync_portal_records(folder, connection):
    """All six report categories, read-only in the cloud and non-destructive locally."""
    check_pause(connection)
    marker = _read_vehicle_workspace(folder)
    if marker and marker.get('pending_merge'):
        raise ValueError('Folder consolidation is not complete; no reports downloaded')
    primary = manifest_for(folder, connection)
    if primary['schema'] == 2:
        return 0
    manifests = {m['job_id']: m for m in [primary] + linked_job_manifests(folder, primary, connection)}
    downloaded = 0
    state_path = folder / '.psi-upload-status.json'
    state = json.loads(state_path.read_text()) if state_path.exists() else {}
    errors = []
    def save(category, source, revision, name, reader, manifest, record_id, **kwargs):
        nonlocal downloaded
        try:
            downloaded += _save_report_download(folder, category, source, revision, name, reader, state, manifest,
                                                 record_id, connection, **kwargs)
        except Exception as error:
            errors.append(source + ': ' + str(error))
    records = _report_rows(connection, 'vault_records', primary, filters='&published_at=not.is.null&kind=neq.media')
    by_id = {}
    for record in records:
        _report_owned(record, primary)
        if record.get('published_at') and record.get('job_id') in manifests and record['kind'] in REPORT_CATEGORIES:
            by_id[record['id']] = record
    attached = set()
    assets = _report_rows(connection, 'vault_assets', primary, select='*,vault_records!inner(kind,published_at)',
                          filters='&ready=eq.true&vault_records.published_at=not.is.null&vault_records.kind=neq.media')
    for asset in assets:
        record = by_id.get(asset['record_id'])
        if not record or not asset.get('ready'):
            continue
        _report_owned(asset, primary)
        attached.add(record['id'])
        title = (re.sub(r'^(?:xero\s+)?invoice\s+', '', record['title'], flags=re.IGNORECASE).strip()
                 if record['kind'] == 'invoice' and invoice_identity(record['title']) else None)
        title = title or asset.get('caption') or record['title'] or asset['id']
        save(REPORT_CATEGORIES[record['kind']], 'vault_asset:' + asset['id'], _report_revision(asset), title,
             lambda a=asset: (read_cloud_photo(connection, a, primary)[0], a['mime_type']),
             manifests[record['job_id']], record['id'], source_reference=record.get('source_reference'))
    for record in by_id.values():
        if record['kind'] != 'service' and record['id'] in attached:
            continue
        content, name = _report_text(record, record['kind'])
        save(REPORT_CATEGORIES[record['kind']], 'vault_record:' + record['id'], _report_revision(record), name,
             lambda b=content: (b, 'text/plain'), manifests[record['job_id']], record['id'],
             notes=record.get('notes') if record['kind'] == 'service' else None, source_reference=record.get('source_reference'))
    legacy = {}
    for table in ('repair_records', 'recommended_work', 'dyno_records', 'invoices'):
        rows = _report_rows(connection, table, primary, filters='&archived_at=is.null')
        legacy[table] = {row['id']: row for row in rows if row.get('archived_at') is None}
    attached_legacy = set()
    for row in _report_rows(connection, 'vehicle_files', primary, filters='&archived_at=is.null&file_kind=neq.vehicle_photo'):
        _report_owned(row, primary)
        if row.get('archived_at') is not None:
            continue
        kind = {'invoice': 'invoice', 'dyno_graph': 'dyno', 'repair_document': 'document'}.get(row['file_kind'])
        if not kind:
            continue
        table = 'invoices' if kind == 'invoice' else 'dyno_records'
        parent_id = row.get('invoice_id') if kind == 'invoice' else row.get('dyno_record_id')
        parent = legacy[table].get(parent_id) if kind != 'document' else None
        if kind != 'document' and not parent:
            raise ValueError('Private attachment has no active verified parent record')
        title = parent.get('invoice_number') if kind == 'invoice' else 'Dyno graph' if kind == 'dyno' else 'Document ' + row['id'][:8]
        if parent:
            attached_legacy.add((table, parent_id))
        save(REPORT_CATEGORIES[kind], 'vehicle_file:' + row['id'], _report_revision(row), title,
             lambda r=row: _read_legacy_report(connection, r, primary), primary, parent_id or row['id'])
    for table, kind in (('repair_records','service'),('recommended_work','recommendation'),('dyno_records','dyno'),('invoices','invoice')):
        for record in legacy[table].values():
            _report_owned(record, primary)
            if (table, record['id']) in attached_legacy:
                continue
            content, name = _report_text(record, kind)
            save(REPORT_CATEGORIES[kind], table + ':' + record['id'], _report_revision(record), name,
                 lambda b=content: (b, 'text/plain'), primary, record['id'],
                 notes=record.get('notes') if kind in ('service','recommendation') else None)
    # Do not hold invoices and text records behind a first-time photo comparison.
    # The photo pass reloads the just-saved receipt file, preserving both indexes.
    try:
        downloaded += sync_portal_photos(folder, connection)
    except Exception as error:
        errors.append('Workshop photos: ' + str(error))
    if errors:
        raise ValueError('Report downloads need review: ' + '; '.join(errors))
    return downloaded


def mark_folder_review(folder, error):
    """An identity/locked-file error must not erase completed file receipts."""
    path = folder / '.psi-upload-status.json'
    try:
        state = json.loads(path.read_text(encoding='utf-8-sig')) if path.exists() else {}
        if not isinstance(state, dict):
            raise ValueError('Invalid status')
    except (OSError, UnicodeError, ValueError):
        # Preserve malformed evidence instead of replacing it.
        if path.exists():
            path.rename(_available_destination(folder, '.psi-upload-status-recovery.json'))
        state = {}
    state.update({'status': 'needs_review', 'error': str(error)})
    atomic_json(path, state)

def process_job(folder, connection=None):
    check_pause(connection)
    marker = _read_vehicle_workspace(folder)
    if marker and marker.get('pending_merge'):
        raise ValueError('Folder consolidation is not complete; no files uploaded')
    default_manifest = manifest_for(folder, connection)
    linked = linked_job_manifests(folder, default_manifest, connection)
    manifests = {item['job_id']: item for item in [default_manifest] + linked}
    migrate_category_folders(folder)
    consolidate_photo_folders(folder)
    if (folder / '.psi-prepared').is_dir():
        hide_windows_folder(folder / '.psi-prepared')
    state_path = folder / '.psi-upload-status.json'
    state = json.loads(state_path.read_text()) if state_path.exists() else {}
    removed_folder_error = state.pop('status', None) is not None
    removed_folder_error = state.pop('error', None) is not None or removed_folder_error
    if removed_folder_error:
        atomic_json(state_path, state)
    if connection:
        archive_exact_source_duplicates(folder, state, connection)
    for category, (kind, phase, category_key) in CATEGORIES.items():
        category_path = folder / category
        if not category_path.is_dir() or category_path.is_symlink():
            continue
        for path in sorted(category_path.iterdir()):
            check_pause(connection)
            if path.is_symlink() or not path.is_file():
                continue
            is_text_record = path.suffix.lower() == '.txt' and category in TEXT_RECORD_CATEGORIES
            if not is_text_record and path.suffix.lower() not in IMAGE_SUFFIXES + ('.pdf',):
                continue
            relative = str(path.relative_to(folder))
            if time.time() - path.stat().st_mtime < 5:
                continue
            selected_job_id = None
            try:
                manifest = _flat_job_for_source(state.get(relative, {}), manifests, default_manifest)
                selected_job_id = manifest['job_id']
                workshop_only = manifest.get('schema') == 2 and manifest.get('owner_type') == 'workshop'
                state.setdefault(relative, {})['job_id'] = manifest['job_id']
                if is_text_record:
                    _publish_text_record(folder, manifest, connection, state, path, relative, category, category_key, TEXT_RECORD_CATEGORIES[category])
                    state[relative]['job_id'] = manifest['job_id']
                    atomic_json(state_path, state)
                    continue
                if category == 'Recommended work':
                    raise ValueError('Recommended work accepts .txt notes only')
                before = (path.stat().st_size, path.stat().st_mtime_ns)
                # Wait for completed file transfers before processing.
                if time.time() - path.stat().st_mtime < 5:
                    continue
                prior = state.get(relative, {})
                if _unchanged_terminal_source(prior, before, workshop_only):
                    continue
                content, thumb, mime = prepare_file(path)
                if before != (path.stat().st_size, path.stat().st_mtime_ns):
                    continue
                if kind in ('dyno', 'invoice') and mime != 'application/pdf':
                    raise ValueError('Dyno and invoice folders accept PDF files only')
                digest = hashlib.sha256(content).hexdigest()
                source_digest = hashlib.sha256(path.read_bytes()).hexdigest() if kind == 'media' else None
                visual = photo_signature(content) if kind == 'media' and mime.startswith('image/') else None
                if before != (path.stat().st_size, path.stat().st_mtime_ns):
                    continue
                source_key = f'pc:{manifest["job_id"]}:{category_key}:{digest}'
                if (prior.get('key') == source_key or str(prior.get('key', '')).endswith(':' + digest)) and prior.get('status') == 'uploaded':
                    state[relative] = _source_state(source_key, 'uploaded', before)
                    continue
                if connection and not workshop_only and kind == 'media':
                    duplicate = None
                    for saved in published_photos(connection, manifest):
                        check_pause(connection)
                        if saved['sha256'] == digest or saved.get('source_sha256') == source_digest:
                            duplicate = saved
                            break
                        if visual and saved['mime_type'].startswith('image/'):
                            previous = saved.get('visual_signature')
                            saved_content = None
                            if not previous:
                                saved_content, _ = read_cloud_photo(connection, saved, manifest)
                                previous = photo_signature(saved_content)
                            if visually_identical(visual, previous):
                                if saved_content is None:
                                    saved_content, _ = read_cloud_photo(connection, saved, manifest)
                                if identical_photo_pixels(content, saved_content):
                                    duplicate = saved
                                    break
                    if duplicate:
                        state[relative] = _source_state(source_key, 'uploaded', before, record_id=duplicate['record_id'], deduplicated=True)
                        atomic_json(state_path, state)
                        continue
                if connection and not workshop_only and kind == 'invoice':
                    published_invoice = published_invoice_for_job(connection, manifest['job_id'], path.name)
                    for linked_manifest in manifests.values():
                        if linked_manifest['job_id'] == manifest['job_id']:
                            continue
                        other = published_invoice_for_job(connection, linked_manifest['job_id'], path.name)
                        if other and published_invoice:
                            raise ValueError('Multiple published invoices in linked workspace need PSI review')
                        published_invoice = other or published_invoice
                    if published_invoice:
                        state[relative] = _source_state(
                            source_key, 'uploaded', before,
                            record_id=published_invoice['id'], deduplicated=True,
                        )
                        atomic_json(state_path, state)
                        continue
                if not connection or workshop_only:
                    out = prepared_folder(folder) / category
                    out.mkdir(parents=True, exist_ok=True)
                    hide_windows_folder(folder / '.psi-prepared')
                    (out / (digest + _object_suffix(mime))).write_bytes(content)
                    if thumb:
                        (out / (digest + '-thumb.jpg')).write_bytes(thumb)
                    state[relative] = _source_state(
                        source_key, 'waiting_for_customer_account' if workshop_only else 'prepared', before,
                        bytes=len(content),
                        thumbnail_bytes=len(thumb or b''),
                    )
                else:
                    existing = connection.call('/rest/v1/vault_records?select=*&source_reference=eq.' + urllib.parse.quote(source_key, safe=''))
                    if existing and existing[0]['published_at']:
                        state[relative] = _source_state(source_key, 'uploaded', before)
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
                        metadata = {'source_sha256': source_digest, 'visual_signature': visual} if kind == 'media' else {}
                        connection.call('/rest/v1/vault_assets', 'POST', {'id': asset_id, 'record_id': record['id'], 'customer_id': manifest['customer_id'], 'vehicle_id': manifest['vehicle_id'], 'object_path': object_path, 'thumbnail_path': thumb_path, 'mime_type': mime, 'size_bytes': len(content), 'sha256': digest, 'caption': path.name[:300], 'phase': phase, 'created_by': connection.user_id, **metadata})
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
                    state[relative] = _source_state(source_key, 'uploaded', before)
            except Exception as error:
                state[relative] = {**state.get(relative, {}), 'status': 'needs_review', 'error': str(error)}
            finally:
                if relative in state and selected_job_id is not None:
                    state[relative].setdefault('job_id', selected_job_id)
                    atomic_json(state_path, state)
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
    if connection:
        connection.pause_file = args.stop_file
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
            job_folders, review_folders = local_folder_scan(root)
            if connection:
                configure_report_scan(connection, job_folders)
            for folder in review_folders:
                atomic_json(folder / '.psi-upload-status.json', {'status': 'needs_review', 'error': 'No verified psi-job.json; nothing uploaded'})
            for folder in job_folders:
                check_pause(connection)
                try:
                    if connection:
                        sync_portal_records(folder, connection)
                    process_job(folder, connection)
                except Exception as error:
                    mark_folder_review(folder, error)
            print('Scan complete. Check each job folder’s .psi-upload-status.json for results.')
            if not args.watch:
                break
            for _ in range(30):
                if args.stop_file and Path(args.stop_file).exists():
                    break
                time.sleep(1)
    except PauseRequested:
        print('Automatic watcher paused safely. Completed uploads and file receipts are preserved.')
        return 0
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
