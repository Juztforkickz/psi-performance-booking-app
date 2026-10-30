# Car sale listing attachments

## Use

Open PSI portal, More, Customer Cars for Sale. Open an existing listing, or save a new private draft. Confirm the vehicle owner has approved sharing the attachments, then select Add photos, Add videos or Add files. Uploaded media saves directly to the listing. Changing text still uses Save changes. Publishing remains a separate existing action.

A listing supports 24 attachments. Photos are converted to JPEG, resized to 1600 pixels on the longest edge and stripped of source EXIF by reencoding. Source photos may be up to 40 MiB, prepared photos up to 10 MiB, videos up to 50 MiB and documents up to 20 MiB. No billing plan, quota, native permission or dependency change is included. Storage consumption remains subject to the existing project allowance.

MP4, MOV and WebM videos open using the phone player or browser. PDF, text, CSV, Word and Excel files use the existing device download or opening capability. Upload only documents approved for sharing, without private customer or workshop information. The existing enquiry route, alert preferences, listing lifecycle and customer identity controls stay in place.

## Security and storage

Attachments use their own private `car-listing-media` bucket. Nothing is copied automatically from private vehicle or Performance+ storage. Staff with an active verified MFA session reserve attachments through a protected database function. Direct client writes to attachment metadata are denied. The server derives object paths, enforces types, sizes and listing limits, and validates the completed object's recorded size and MIME type before making it ready. Client byte signatures and photo decoding provide additional validation. This is not antivirus scanning or server cryptographic verification of file contents.

Customers can read only ready attachments belonging to published or under offer listings. Draft, unfinished, removed, sold and withdrawn attachments are unavailable to customers through RLS. Files use fresh signed URLs with a 120 second lifetime. Already issued URLs may remain usable until they expire, and previously downloaded copies cannot be recalled.

Files are immutable. Removal changes audited metadata while retaining originals for recovery. No normal app action physically deletes them. Only ready photos can be the cover; one is selected automatically and can be changed. Removing a cover selects the next ready photo.

SHA256 deduplicates prepared contents within each listing. A reservation is reused on retry, including recovery when upload succeeded but confirmation was interrupted. Six MiB TUS chunks resume from the server offset. The local resume record contains only the upload URL and is scoped to the staff account and attachment. No token is saved in that record. Upload destinations are limited to this project's storage host. Staff identity is rechecked when authorizing requests.

Media changes never modify listing status, so they do not trigger another listing announcement. Existing customer, vehicle, listing, invoice, subscription and rewards records are not migrated or rewritten.

## Verification

`tests/car-listing-media.test.mjs` exercises actual upload modules with isolated network and native adapters. `tests/staff-record-workflow.test.mjs` exercises actual listing and media components, picker confirmation, draft editing, busy guards, customer actions and the photo viewer's safe close window. These adapters do not establish physical device behavior.

`tests/car-listing-media-rls.sql` runs only in the existing Apple review sandbox. Its final expected exception reports the passed assertions and rolls back every fixture, including queued notifications. It tests actual authenticated database roles, MFA, customer permission rejection, storage boundaries, readiness, visibility, idempotency, cover selection, retention, capacity and audit history. Storage object fixtures are metadata records inside that rolled back transaction; they are not real file uploads.

Production activation and delivered phone updates must be verified separately. A successful release feed does not prove installation or an actual photo/video upload on a customer's phone.
