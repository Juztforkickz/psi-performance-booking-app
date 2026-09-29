# PSI Android borrowed phone acceptance

Use this short acceptance pass for the active Google Play internal release
`1.0.1 (5)`, published to private testers on 29 September 2026. The signed source checkpoint is
`4fea69b1c2ca3a1cddb94024be9c080544f00251` and the EAS build ID is
`24fb542a-fa79-4c2e-a9c8-69d01d4da0f0`.

The archived App Bundle SHA256 is
`CD0372217783A8769495EE26427BD0F139383F7F081DE0CFBED76E15641C1C6C`.

The phone owner does not need to give PSI their Google password. Matt should
join the private test with `matt@psiperformance.com.au`, install the app from
Google Play, and remove the PSI account and app from the borrowed phone after
testing.

## Before testing

1. Confirm the phone has Google Play and a supported Android version.
2. Add `matt@psiperformance.com.au` to Google Play temporarily if needed.
3. Open the private tester link:
   <https://play.google.com/apps/internaltest/4701264059153280916>
4. Join the test and install PSI from Google Play.
5. In Android app information, confirm version `1.0.1` and build `5`.

## Required checks

1. Open PSI and confirm the icon, splash screen and dark presentation are clear.
2. Open the demonstration and inspect Home, My Garage, Bookings, Reports,
   Events, Plan & Build, Support, Privacy and Delete Account.
3. Confirm Service & Report and Dyno Tuning use the same clean booking chooser.
4. Confirm Petrol, Diesel, Hybrid, Plug in Hybrid and Electric vehicle choices
   display the relevant service options.
5. Open every text field used for account details, vehicle details, bookings,
   notes and events. Confirm the page remains scrollable while the keyboard is
   open and every action stays reachable.
6. Confirm Android Back and predictive Back return to the expected screen and
   never close a partly completed form without a warning.
7. Use a disposable PSI customer account to test email code sign in, session
   restoration, sign out and account isolation. Do not use the phone owner's
   personal email.
8. Test camera permission, photo selection, photo upload, replacement, removal
   and private reopening.
9. Enable notifications from inside PSI. Confirm the Android permission prompt,
   notification settings, banner, sound and app badge behaviour.
10. Submit one test booking request. Confirm no duplicate request, payment or
    calendar event is created.
11. Open one private invoice or report and confirm it is visible only to the
    signed in customer.
12. Test the account deletion request and cancellation with the disposable
    account. Complete permanent deletion only through the controlled owner
    procedure.
13. Confirm Performance+ purchasing is unavailable in this Android release and
    no Google payment is requested.
14. Capture at least four clean portrait screenshots at 1080 pixels or more,
    using demonstration records only. Do not show real customer information.

## Pass condition

The release passes when every check above works without a crash, private data
leak, duplicate booking, hidden keyboard action or misleading payment state.
Record the phone model, Android version, test date and any failed step before
removing the app and PSI Google account from the borrowed phone.
