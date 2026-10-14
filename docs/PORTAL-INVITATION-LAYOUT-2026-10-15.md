# Portal invitation display

Refreshing an already verified staff workspace previously replaced the entire
workspace with its loading gate. Sending an invitation called that refresh,
discarding local feedback and scroll position. The same verified user now keeps
the workspace mounted while the access and data request refreshes. Initial access,
different users, failed verification, inactive staff and MFA requirements still
use the existing gate. Loading states show a spinner without the technical access
check message. No server permissions, MFA rules or session policies changed.

Invitation cards now stack customer details, date and status vertically. Email
addresses have the full card width instead of sharing a narrow row with a long
status badge. Both awaiting and completed accounts use the same layout.

The supplied recording was inspected. The actual preview was visually checked
at widths of 320, 390 and 1440 pixels using fictional customer cards. Screenshots
are in the ignored work/portal-layout-2026-10-15 directory.

The 49 photo picker, upload and record workflow tests pass, including library
selection, folder images, PDFs, partial failure recovery and duplicate skipping.
Mobile typecheck and targeted lint pass. These checks do not claim a fresh upload
from a physical iPhone or a verified download to the separate workshop computer.
No customer invitation email or live customer test upload was sent.
