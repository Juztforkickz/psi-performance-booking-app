# Ask PSI private inspection

Prepared 7 October 2026. This is an inspection guide and release checklist. It is not permission to launch.

## Open the private preview

Open [Ask PSI private inspection](http://127.0.0.1:8773/__review) on this computer while the local review server is running.

1. Open the inspection link in two separate browser tabs before choosing a view.
2. In the first tab select **Open customer chat**. In the second tab select **Open workshop inbox**. Each button opens its view in the same tab; no new tab opens automatically. Keep both tabs open.
3. Use fictional messages and a harmless sample photo. Do not upload customer records or personal photos.

The launcher serves the actual app from the local export and signs in only the two approved sandbox identities. Each view keeps its session in its own tab. The link is local to this computer and is not a public preview or a phone link. If the server has stopped, the local launcher must be restarted using the existing protected sandbox credentials. Do not copy passwords or session tokens into this document.

The customer view uses local port 8773 and the workshop view uses 8774. Separate origins prevent authentication broadcasts from mixing the two review identities. Each opens the actual app in a 390 by 844 phone layout with an option to open the full browser view. This is a layout preview, not a native phone emulator.

## Checks completed on 7 October 2026

1. The 56 targeted messaging, worker, interface and notification lifecycle checks passed. Eleven review environment isolation checks also passed.
2. Full mobile TypeScript and lint checks passed. Local iOS, Android and web exports passed against the pinned sandbox. No native build was uploaded or submitted.
3. The actual browser flow created a service conversation linked to a fictional Holden, uploaded and opened a sample Boost photo, received a workshop reply and displayed read times on both sides.
4. Assignment, automatic waiting status after a workshop reply, return to Needs PSI reply after a customer reply, closing and reopening were verified. Existing history remained visible.
5. Authenticated sandbox checks verified private storage, participant protection and all thirteen staff snapshot table reads. Existing canonical portal schema prerequisites were added only to the sandbox.
6. The local launcher rejected unrelated origins, unexpected hostnames and the wrong role entry point. Unrelated filesystem paths did not expose repository files.

Evidence and screenshots are retained locally in `artifacts/ask-psi-private-review`. This ignored folder contains inspection exports, not a public deployment. The fictional conversation is retained for Matt's walkthrough. No real email or push was sent.

## Customer inspection

1. Open **New question**, choose a topic and select a demo vehicle. Send a short message. Confirm the new conversation shows the correct vehicle and message once.
2. Repeat with **General question** and no vehicle. Confirm the question works without creating a booking or changing a vehicle record.
3. Type a longer message. Scroll the form and conversation, use **Hide keyboard**, and confirm the send button remains reachable. Browser inspection covers layout only; native keyboard testing remains below.
4. Attach a JPEG, PNG or WebP sample photo. Open it, check the whole image is visible, then close the photo viewer and return to the conversation.
5. Open a workshop reply and check its text and photo. The sender initially sees **Sent**. Once the recipient has the latest messages visible, the sender should see **Read** with its recorded time.
6. Scroll up through a longer conversation. New messages should not pull you away from older text. Select **Latest messages** to return to the latest reply.
7. In a controlled offline test, try sending a message. Confirm the text remains available for retry. Restore the connection and retry without changing the text. Confirm there is one saved message, not a duplicate. Repeat a photo retry with the same pending photo.

## Workshop inspection

1. Confirm the customer's new conversation appears under **Active**, identifies the demo customer and vehicle, and shows the incoming unread count.
2. Open it and read the latest messages. Confirm the unread state clears and the customer's sent message receives its read time.
3. Select **Assign to me**. Confirm it changes to **Assigned to you**. Reply once and confirm the customer receives the reply in the same conversation.
4. Set **Waiting for customer**, then send another customer message. Confirm the conversation returns to **Needs PSI reply** with an unread count.
5. **Close** the conversation. Return to the list and locate it under **Closed**. Open and **Reopen** it. Confirm existing messages and photos remain intact.
6. Use **Back to workshop**, return to Messages, and confirm the list refreshes. Switch away and return to the app to check foreground refresh.
7. Sign out of the sandbox staff account. Confirm private messages disappear. A customer account must not open the workshop inbox. A failed access check should offer a connection retry without showing a previous staff session's data.

## Remaining device and delivery checks

These require private iOS and Android builds and suitable test devices. A compiled bundle or browser preview does not establish that they pass.

1. Test long messages, small screens, larger system text, keyboard scrolling, keyboard dismissal and the composer on both platforms.
2. Test photo permission denial and approval, limited photo access, picker cancellation, common camera formats and full photo viewing. HEIC and HEIF preparation now converts supported device photos to JPEG before upload; verify conversion, orientation and image quality on an actual iPhone and Android device. This native check remains pending.
3. With isolated test devices and notifications explicitly enabled, test incoming push alerts, banner, sound, badge behaviour and opening the correct conversation. Cover foreground, background and a fully closed app. Repeat with alerts disabled and with the device's notification permission denied.
4. Verify read times do not advance while the recipient app is backgrounded, while viewing an enlarged photo or while reading older messages away from the latest content.
5. Test connection loss, reconnection and duplicate prevention for text, photo and new conversation retries. Confirm pending failures remain understandable and recoverable.
6. Confirm staff access through the normal authenticator workflow in an appropriate private environment. The isolated store review identity has its existing review rules; testing that identity alone does not replace staff MFA testing.
7. Confirm account isolation and account deletion using disposable sandbox data only. Keep the owner account and all live records protected.

Microsoft 365 email delivery remains disabled. The fallback queue is prepared, but sender permissions, approved mailbox configuration, the authorised assistant banner, scheduler and a specifically authorised test delivery must be verified before enabling it. No other email provider is substituted. Sandbox account login names do not authorise accessing their mailboxes.

## Privacy declaration draft for review

This wording is a preparation draft. It has not been submitted to Apple or Google and is not a completed store declaration.

Ask PSI lets a signed in customer send private messages and optional photos to the PSI workshop. Conversations are linked to the customer's account and may be linked to a selected vehicle or booking. The service stores message content, photo attachments, participant identifiers, message times, read times and conversation status to deliver support and maintain the conversation history.

Authorised PSI staff can access the relevant workshop conversations. Another customer cannot read them. Photos use private storage and temporary authorised viewing links. The existing account deletion flow includes messaging records and private chat photos; the final privacy notice must accurately describe the approved retention and deletion process.

The implementation uses the existing Supabase backend and existing push notification service. Microsoft 365 is the intended optional workshop email fallback and remains disabled. Any enabled fallback should alert the workshop to a waiting conversation without copying the private message content into email.

Boost is currently the interface character for direct workshop messaging. No AI provider receives these conversations and no automated AI response service is enabled. Introducing an AI provider later requires a separate review of consent, data handling, disclosures and permitted responses.

Before release, reconcile the final implementation with Apple App Privacy and Google Data Safety entries for account linked messages, photos, identifiers and notification processing. Review the complete app's declarations, including its existing services, before changing any tracking or sharing answers. Matt must inspect and approve the release scope first.

## Release boundary and rollback

Ask PSI remains private. Public feature flags stay disabled, and the local preview must use only the isolated review sandbox. This inspection does not authorise a public website change, production database migration, OTA update, store submission or customer announcement.

The earlier private baseline is checkpoint `a238bc7`. If these inspection changes need to be removed, prepare a reviewed forward revert of the relevant Ask PSI changes towards that baseline. Preserve unrelated work added afterwards. Do not reset the branch, overwrite the working tree or automatically deploy the baseline.

Retain the additive sandbox schema and sandbox records during rollback. Disabling or reverting the private interface does not require dropping tables or deleting photos. Any schema reversal or data removal requires its own reviewed plan. Production remains separate and must not be changed to perform this rollback.
