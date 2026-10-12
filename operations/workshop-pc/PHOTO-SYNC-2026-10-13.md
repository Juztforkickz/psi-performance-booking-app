# Photos upload repair, 13 October 2026

The portal Photos form now accepts images or PDFs without a job reference, title or description. Customer and vehicle confirmation remains required. The existing library and Files buttons remain available. A current unambiguous workshop job is reused, or a private vehicle Photos collection is created automatically.

Native file reads use Expo File array buffers. Each file has its own resumable record and storage reservation. Completed files remain published after a later failure, and only failed selections remain for retry. Exact source and prepared hashes are checked within the verified vehicle. Visual candidates also require a full pixel comparison; uncertain matches are retained. No historical photos are deleted.

Workshop uploader 1.2.14 downloads published Photos assets into the verified job's Workshop photos directory. It verifies ownership, object path, size and SHA256, preserves existing originals and writes download receipts to prevent upload loops. Interrupted downloads do not become visible photo files. Existing workshop only customer matching and waiting account handling are preserved.

The reported stopped draft had no assets or stored objects when inspected. Its original files must be selected again on the device. The prior generic error did not retain enough detail to establish its precise underlying cause.

Validation: mobile typecheck and targeted lint passed. The workflow and upload tests passed, including partial publication failure and retry. Workshop importer and photo sync tests passed, including wrong vehicle/path rejection, integrity checking, repeated sync and preserving edited local files. The update manifest hashes were checked against staged files. The actual Photos component was visually checked at 390 by 844.

Database migration portal_photo_sync was applied successfully. Customer row access controls remain enabled. No owner entitlement or authentication policies were changed.

The workshop computer installation and a real iPhone upload still require verification. Publishing the updater does not prove that the workshop computer has installed it. Use the existing Install workshop app update action, then keep the watcher signed in and running.

Source checkpoint e15918f was pushed to main. GitHub Pages run 38300658026 completed successfully. The public workshop updater serves version 1.2.14 and its Python file checksum matches the published manifest.

Apple channel app-store-release, runtime 1.0.0-app-store-release-1: update group 923ff53e-d0c2-405d-a76a-7a5ba9c47117, update 01a131ae-c842-7ca4-9680-3d600f9242ec. Android channel android-play-internal, runtime 1.0.0-android-play-internal-1: update group a6b11ea1-c04a-4049-9031-0a218632975a, update 01a131b0-0775-7eb3-aeb4-9831ddfa3289. Both live update feeds returned HTTP 200 with the correct runtime and repair code markers in the delivered bundles.

Final validation total: 34 mobile workflow/upload tests, 57 workshop tests and two updater manifest tests passed. Mobile typecheck and targeted lint passed. No Netlify deployment was performed.
