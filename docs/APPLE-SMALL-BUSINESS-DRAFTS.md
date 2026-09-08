# Apple enrolment and review drafts

Prepared 9 September 2026. **Drafts only: nothing has been sent, enrolled or submitted.** Replace bracketed fields and verify the final build before using them. All prices below are AUD.

## Small Business Program: what Matt needs to do

The Account Holder applies through Apple's [Small Business Program enrolment page](https://developer.apple.com/app-store/small-business-program/). This is a form, not an application letter. Review the latest Paid Apps agreement, identify every associated developer account and check combined proceeds against Apple's eligibility rules. Acceptance gives a 15% commission rate on eligible sales from Apple's applicable effective date; do not assume an application immediately changes proceeds.

Have these ready:

The existing EAS signing configuration reports Apple Team ID `6HP5M94822`, organisation **PSI PERFORMANCE PTY LTD**. Confirm these in the Account Holder's Apple membership before submitting; associated-account declarations still require Matt's confirmation.

- Legal entity and Account Holder exactly as shown in Apple Developer membership.
- Team ID, associated developer accounts and any app transfers.
- Relevant App Store financial reports, or confirmation that there have been no proceeds, **only if verified**.
- Current agreement, banking and tax status in App Store Connect.

The older [store release package](STORE-RELEASE-PACKAGE.md) records PSI PERFORMANCE PTY LTD as the developer organisation and different workshop supplier wording. Confirm the contracting entity in the signed Apple account before completing declarations. Do not infer eligibility from the workshop's size or confuse workshop turnover with App Store proceeds. Use Apple's own calculation instructions for the eligibility declaration; no estimated currency conversion here substitutes for that calculation.

## Optional support message before enrolment

**Subject:** Small Business Program enrolment assistance — PSI Performance

Hello Apple Developer Support,

I am the Account Holder for [verified legal entity], Team ID [Team ID]. We develop PSI Performance, bundle ID `com.psiperformance.booking`, App Store Connect app ID `6806902732`.

We are preparing an optional auto-renewable subscription, PSI Performance+, within our existing free automotive customer app. The planned Australian prices are A$9.99 monthly and A$99 annually.

I would like to enrol in the App Store Small Business Program. Please advise if any account or agreement steps are outstanding before I complete the enrolment form. Our associated developer accounts are [verified list, or “none” only after checking]. Our relevant proceeds and app-transfer information are [verified details].

Please also confirm where I can see the effective date of the reduced commission after acceptance.

Kind regards,
[Account Holder's full name]
[Apple account contact email]
PSI Performance

## Optional follow-up after submitting the form

**Subject:** Small Business Program application status — Team [Team ID]

Hello Apple Developer Support,

I submitted our Small Business Program enrolment on [actual submission date], reference [reference, if provided], for [verified legal entity], Team ID [Team ID]. Could you confirm its status and whether you need further information? Once approved, please confirm the applicable commission effective date.

Kind regards,
[Account Holder's full name]

Use this second draft only after a real submission. Do not describe an application as approved until Apple confirms it.

## TestFlight “What to Test” — current foundation build

Please test the existing free PSI features: sign-in, My Garage, bookings, kilometre entry, maintenance reminders and existing dyno results. In My Garage, choose a vehicle illustration and try both landscape crop and whole-photo fit with a portrait photo.

Open PSI Performance+ to check the locked record counts and vehicle history layout. With a PSI-provided complimentary beta entitlement, check your own invoice PDFs, workshop photos and dyno PDFs. Report incorrect vehicle associations immediately. Test signing out and switching between your authorised test accounts.

Paid purchases are not enabled in this foundation build. The fictional demo does not create bookings, customer records or purchases. Existing beta accounts remain available.

## App Review notes — final subscription build template

**Not ready to paste until the activation checklist and real device purchase tests pass.** Apple requires the first auto-renewable subscription type to accompany a new app version; include its subscription group and intended products in that submission. [Apple submission instructions](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-in-app-purchase/)

PSI Performance is a free customer app for an automotive workshop. Free functionality includes vehicle profiles, bookings, kilometre recording, maintenance reminders and existing dyno results. PSI Performance+ is an optional digital subscription at A$9.99 monthly or A$99 annually, providing access to PSI-published invoices, workshop photos, documents and the premium vehicle history. Physical workshop services and parts are purchased separately.

To review: [verified login/access instructions that do not require waiting for a workshop employee]. Open My Garage, select [fictional review vehicle], then open PSI Performance+. The monthly and annual options provide the same entitlement. Purchase through Apple, use Restore purchases to restore to the same PSI account, and use Manage subscription to open Apple's subscription management. Cancellation preserves access until expiry; expiry locks premium records while retaining the free account.

[Verified instructions for testing purchases in the submitted build's isolated environment.] [Verified steps to inspect representative premium content.] The optional fictional demo is labelled separately and has no live customer data.

Review contact: [name], [available phone], [email].

Before submission, replace all placeholders, attach actual subscription screenshots, verify review access end to end, and update privacy/subscription disclosures. An owner-granted beta entitlement demonstrates content access but does not demonstrate an Apple purchase or restore.
