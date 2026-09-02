# PSI App Privacy Policy on Shopify

Status: owner-approved and published on 2 September 2026.

## Published structure

The App policy is published beneath the existing online-shop policy under the
clear heading **PSI Performance App Privacy Policy**. Both policies use the
existing public footer link:

`https://psiperformance.com.au/policies/privacy-policy`

This keeps one authoritative privacy address for the website, App, TestFlight
and store metadata. The existing Shopify policy was preserved, and the custom
App sections were added after it. Shopify's automated-policy setting was turned
off because a custom combined policy cannot remain automatically generated.

Future changes to Shopify's template or store settings must therefore be
reviewed manually alongside changes to the App, providers and data handling.
The public page was reloaded after saving and verified to show the App heading,
all 17 App sections and the **PSI PERFORMANCE PTY LTD** sign-off.

## App Store Connect after publication

Changing the policy content does not invalidate the current TestFlight build or
tester records. Use the confirmed public page for Apple and Google metadata:

`https://psiperformance.com.au/policies/privacy-policy`

In **App Store Connect → App Privacy → Privacy Policy**, enter:

- Privacy Policy URL: the combined PSI website and App privacy page
- User Privacy Choices URL: the final public PSI account-deletion page

Also update TestFlight's Test Information privacy URL if it is displayed there.
Apple permits privacy responses and URLs to be maintained in App Store Connect;
the final metadata must accurately match the submitted App and its providers.

## Repository/app follow-up

After any future policy change:

1. Confirm the App's `contact.privacy` URL still points to the published page.
2. Align the in-App privacy summary with the approved full policy.
3. Keep the short collection notices in `PRIVACY-COLLECTION-NOTICES.md`
   consistent with the policy.
4. Run lint, type checking, web export and signed-native acceptance when App
   wording or behaviour changes.
5. Update Apple App Privacy and Google Play Data safety answers from the final
   signed binary.
6. Create and push a checkpoint before shipping the metadata or App update.

## Publication safety boundary

Publishing changes the live PSI website and remains a separate external action.
Do not change the policy, its footer link or App Store Connect metadata without
owner review and explicit approval for that live action.
