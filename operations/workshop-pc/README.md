# PSI workshop PC uploader

This local Python tool prepares photographs and imports PDFs into the existing private Performance+ vault. Software licence cost: A$0. It is ready for a supervised first upload; it is not installed as an unattended Windows service.

## One-time setup

Use Python 3.11 or newer. In this directory run `python -m pip install -r requirements.txt`. Staff must already have an active PSI portal account and an enrolled authenticator. Never use a service-role or secret API key on the PC.

## Each workshop job

1. In the PSI staff portal, select the actual customer and vehicle, verify the registration, enter the PSI job reference and date, and confirm the association.
2. Choose **Download verified PC folder manifest**. Put that `psi-job.json` inside the matching job folder. The file contains identifiers, not credentials. Keep it on the protected workshop PC.
3. Copy the selected files into these subfolders:

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

4. First inspect local preparation:

```powershell
python psi_uploads.py --root "C:/PSI Uploads" --prepare-only
```

5. To upload, supply your environment's public project URL and **publishable** key, then enter the email code and authenticator code when prompted:

```powershell
python psi_uploads.py --root "C:/PSI Uploads" --url "https://PROJECT.supabase.co" --key "PUBLISHABLE_KEY" --email "YOUR_STAFF_EMAIL"
```

Add `--watch` to scan every 30 seconds while the process is open. Stop with Ctrl+C. Authentication tokens remain in memory and the local session is signed out when the process exits normally. Restart/login after a PC restart or revoked staff session. No Windows startup task is installed.

## Behaviour and recovery

- Folder names are labels. No customer name, partial registration or filename can authorize a match. The manifest's project, job, customer, vehicle, registration and date must match live records. A changed registration requires a new verified manifest.
- JPEG, PNG, WebP and TIFF photographs are oriented correctly and resized to at most 1600 pixels on the longest edge; JPEG quality 82. Thumbnails use a maximum 360-pixel edge and quality 72. EXIF/GPS is removed. HEIC and video are not supported by this initial tool: export JPEG first.
- PDF originals stay byte-for-byte intact. There is no assumed Mainline API, OCR, or automatic numerical extraction. Enter verified HP/Nm in the portal when needed.
- Originals remain untouched. Local `.psi-prepared` files are safe previews; `.psi-upload-status.json` reports prepared, uploaded, or needs_review. Neither is cloud backup.
- Identical prepared content within the same job and category is deduplicated by SHA-256 and a server unique source reference. A before and an after folder can deliberately retain the same image. Re-encoded variants are different content.
- Files must stop changing for at least five seconds. Symlinked folders/files are ignored. Maximum source 40 MB; maximum uploaded object 20 MB. Oversized/invalid files require review.
- Each successful file is a dated record associated with the verified workshop job. Publication waits for that file and thumbnail to finish. A partially failed job can have other completed records published; this is not whole-folder atomic publication.
- An interrupted upload stays unpublished and resumes on the next scan. Existing objects must match the prepared bytes exactly; only missing objects are uploaded, then the completed record is published. Changed or uncertain contents require PSI review and are never overwritten. Fully uploaded files are skipped on subsequent scans. Drafts created by manual portal uploads still need administrator review rather than this PC resume path.
- Protect the PC with its own login, disk encryption and backups. The app cannot determine whether a photographer placed a wrong car's photo inside an otherwise correctly verified folder; the selection/manifest confirmation remains a required human check.

## Verification

`python -m unittest -v test_psi_uploads.py` tests compression, privacy metadata removal, untouched originals, PDF validation, repeat preparation, incomplete copies, missing manifests, mismatched identities and forbidden destination/keys. These tests do not upload customer data.
