# PSI workshop PC uploader

This local Python tool prepares photographs and imports PDFs into the existing private Performance+ vault. Software licence cost: A$0. It runs automatically for the signed-in Windows user after one supervised PSI staff sign-in.

## One-time setup

Use Python 3.11 or newer. In this directory run `python -m pip install -r requirements.txt`. Staff must already have an active PSI portal account and an enrolled authenticator. Never use a service-role or secret API key on the PC.

For the intended workshop PC, copy this whole folder to that computer and run the installer once from PowerShell:

```powershell
.\Install-PSIWorkshopUploader.ps1 -ProjectUrl "https://PROJECT.supabase.co" -PublishableKey "PUBLISHABLE_KEY" -StaffEmail "YOUR_STAFF_EMAIL"
```

It creates the upload root and a **PSI Workshop Uploads** desktop shortcut for the signed-in Windows user. It also creates a hidden Windows Startup shortcut. The saved configuration contains only the public project address, publishable key, staff email, upload path and Downloads inbox path. Customer records and privileged keys are not stored in it.

Open the desktop shortcut once, choose **Sign in and start automatic watching**, and enter the PSI email code and authenticator code. Only the rotating refresh token is remembered; Windows DPAPI encrypts it for this Windows account. The watcher then starts hidden at Windows sign-in, refreshes the session, checks that it is still AAL2 and active staff, and scans every 30 seconds. Revoking the session, disabling the staff account or changing security settings makes it fail closed and require sign-in again.

## Each workshop job

1. Confirm the app booking. The protected backend automatically creates its workshop job and exact Xero reference.
2. Within 30 seconds, the workshop PC reads that staff-authorized job and creates the complete verified folder tree automatically. Jobs from the last 30 days plus future jobs are synchronized idempotently.
3. If automatic synchronization is unavailable, **Booking details → Workshop actions → Download PC folder file · fallback** still provides a credential-free manifest. The watcher imports valid PSI manifests from Downloads, or staff can choose **Add a downloaded job folder file** from the desktop shortcut.

For a phone or walk-in job, open the desktop shortcut and choose **Create a phone / walk-in job**. Enter the registration, select the matching existing app vehicle, enter the date, job type and description. The signed-in AAL2 staff account creates a checked standalone workshop job and its local folder. This does not falsely mark an unpaid app booking as payment-confirmed. If the customer or vehicle is new, add or invite them in the PSI portal first.

The resulting layout is:

```powershell
python psi_uploads.py --root "C:/PSI Uploads" --add-job "C:/Users/YOU/Downloads/PSI-REFERENCE-REG-psi-job.json"
```

4. Copy files into the folder that command creates:

```text
C:/PSI Uploads/
  PSI-2026-0123 - ABC123/
    psi-job.json
    before/
    progress/
    after/
    dyno/          (PDF only)
    invoices/      (PDF only)
    documents/
```

To inspect local preparation without upload:

```powershell
python psi_uploads.py --root "C:/PSI Uploads" --prepare-only
```

For command-line recovery, upload with the environment's public project URL and **publishable** key:

```powershell
python psi_uploads.py --root "C:/PSI Uploads" --url "https://PROJECT.supabase.co" --key "PUBLISHABLE_KEY" --email "YOUR_STAFF_EMAIL"
```

Add `--watch`, `--session-file` and `--manifest-inbox` to match the installed automatic mode. The desktop shortcut can remove the remembered session; this also signals a running background watcher to stop on its next scan. A named Windows mutex prevents duplicate automatic watchers.

## Behaviour and recovery

- Folder names and filenames are labels. No customer name, partial registration or filename can authorize a match. The portal manifest's project, job, customer, vehicle, registration and date must match live records. A changed registration requires a new verified manifest.
- JPEG, PNG, WebP and TIFF photographs are oriented correctly and resized to at most 1600 pixels on the longest edge; JPEG quality 82. Thumbnails use a maximum 360-pixel edge and quality 72. EXIF/GPS is removed. HEIC and video are not supported by this initial tool: export JPEG first.
- PDF originals stay byte-for-byte intact. Save a Mainline result as PDF into the job's `dyno` folder; it uploads to that vehicle's Dyno Vault. There is no assumed Mainline API or automatic numerical extraction, so enter verified HP/Nm in the portal when needed.
- Originals remain untouched. Local `.psi-prepared` files are safe previews; `.psi-upload-status.json` reports prepared, uploaded, or needs_review. Neither is cloud backup.
- Identical prepared content within the same job and category is deduplicated by SHA-256 and a server unique source reference. A before and an after folder can deliberately retain the same image. Re-encoded variants are different content.
- Files must stop changing for at least five seconds. Symlinked folders/files are ignored. Maximum source 40 MB; maximum uploaded object 20 MB. Oversized/invalid files require review.
- Each successful file is a dated record associated with the verified workshop job. Publication waits for that file and thumbnail to finish. A partially failed job can have other completed records published; this is not whole-folder atomic publication.
- An interrupted upload stays unpublished and resumes on the next scan. Existing objects must match the prepared bytes exactly; only missing objects are uploaded, then the completed record is published. Changed or uncertain contents require PSI review and are never overwritten. Fully uploaded files are skipped on subsequent scans. Drafts created by manual portal uploads still need administrator review rather than this PC resume path.
- Protect the PC with its own login, disk encryption and backups. The app cannot determine whether a photographer placed a wrong car's photo inside an otherwise correctly verified folder; the selection/manifest confirmation remains a required human check.

## Verification

`python -m unittest -v test_psi_uploads.py` tests compression, privacy metadata removal, untouched originals, PDF validation, repeat preparation, incomplete copies, missing manifests, mismatched identities and forbidden destination/keys. These tests do not upload customer data.
