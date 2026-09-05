# Apple beta review response draft

NOT READY TO SEND until the signed review build is attached, both native logins
are verified and private credentials have been entered in App Store Connect.
Build 1.0.0 (6) is signed, saved, uploaded and VALID / IN_BETA_TESTING internally.
Its external state is READY_FOR_BETA_SUBMISSION, not submitted. The owner's
iPhone acceptance check and private review credentials still need confirmation.
Never put passwords in this file.

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

We have prepared PSI version 1.0.0, build 6, with the normal invitation-only
customer app and a clearly labelled, selectable isolated demonstration mode in
the same binary. It uses the same customer and workshop screens. The demonstration
contains fictional vehicles, an inspection record, a dyno graph, a sample invoice,
completed service history, workshop recommendations, private vehicle photos, a
booking request and an event. No live customer information is included.

The customer app credentials are saved in Beta App Review Information. Open
Account, select Open demonstration, then Enter demo and restart. After the app
restarts, use the Apple review sign-in form with those credentials. A mailbox
or one-time email code is not required in this review environment. You can review
My Garage, Bookings, Reports, Settings and PSI Events, including private documents,
vehicle photos, service history, PSI odometer records and future check-in details.

We have also provided separate workshop review credentials in the private review
notes. Sign out of the customer account, sign in with the workshop account, then
open PSI Portal from Account. This allows you to inspect the workshop booking
queue, customer records, record publishing and account-deletion workflow using
fictional data. The live workshop portal remains separate and requires staff MFA.

The Return to normal PSI app button signs out the demonstration session and
restarts the normal app. Normal PSI customers sign in with their own email codes;
the demo credentials do not grant access to the live workshop or customer data.
External testers will use this same binary after beta approval, not a replacement
review-only version.

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
