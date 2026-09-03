# Apple beta review response draft

NOT READY TO SEND until the signed review build is attached, both native logins
are verified and private credentials have been entered in App Store Connect.
Replace the build-number placeholder below. Never put passwords in this file.

## Private App Store Connect information

Select the PSI app, TestFlight, Test Information, Beta App Review Information.
Enable Sign-in required. Enter `psiappreview@gmail.com` and its dedicated **app**
password in the customer credential fields. Put the separate staff username
`psiappreview+staff@gmail.com` and its different app password in the private review
notes. These are not Gmail passwords. Neither account needs access to a mailbox
or a code from Matt. Do not include the isolation-test account.

## Reply after verification

Hello App Review team,

Thank you for explaining the access issue under Guideline 2.1(a).

We have prepared build [REVIEW BUILD NUMBER] with a clearly labelled, isolated
demonstration environment using the same customer and workshop screens. It
contains fictional vehicles, an inspection record, a dyno graph, a sample invoice,
a booking request and an event. No live customer information is included.

The customer app credentials are saved in Beta App Review Information. Open
Account and use the Apple review sign-in form with those credentials. A mailbox
or one-time email code is not required in this review environment. You can review
My Garage, Bookings, Reports, Settings and PSI Events, including private documents.

We have also provided separate workshop review credentials in the private review
notes. Sign out of the customer account, sign in with the workshop account, then
open PSI Portal from Account. This allows you to inspect the workshop booking
queue, customer records, record publishing and account-deletion workflow using
fictional data. The live workshop portal remains separate and requires staff MFA.

The sandbox deliberately disables external email and push delivery, real Calendar
changes and payments. It shows in-app notifications and the integration queue
without claiming that external messages were delivered. Sandbox invitation testing
is limited to the fictional addresses demo1@example.invalid through
demo5@example.invalid. The production customer flow remains invitation-only with
email-code sign-in. We are disclosing these review-specific differences explicitly.

Please let us know if any additional access or information is needed, or if you
require a different review arrangement for these external integrations.

Kind regards,
PSI Performance PTY LTD
