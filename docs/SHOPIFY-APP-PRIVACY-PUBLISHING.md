# Publish the PSI App Privacy Policy on Shopify

Status: owner-action checklist, 2 September 2026. Do not publish until the
policy's pre-publication decisions and legal review are complete.

## Recommended structure

Keep the existing Shopify-generated **Privacy policy** for the website and
online shop. Create a separate Shopify page named **PSI Performance App Privacy
Policy** for the customer app. This prevents website cookie, advertising,
Shopify-account and payment wording from being incorrectly presented as the
App's behaviour.

Suggested final URL:

`https://psiperformance.com.au/pages/app-privacy`

The exact Shopify handle may differ. Confirm the public URL after saving.

## Shopify steps

1. In Shopify Admin, open **Online Store → Pages**.
2. Choose **Add page**.
3. Set the title to **PSI Performance App Privacy Policy**.
4. Copy only the public policy text from `APP-PRIVACY-POLICY.md`, beginning at
   **Privacy Policy** and ending after **Changes to this policy**. Do not publish
   the status note, pre-publication decisions or source list.
5. Preserve headings, bullet lists, email, phone number and the OAIC link.
6. Set the search-engine description to:
   **How PSI Performance collects, uses, protects and deletes customer
   information in the PSI Performance App.**
7. Save as hidden or draft first and inspect it on mobile.
8. Add **App Privacy Policy** to the website footer near the existing Privacy
   policy link.
9. Add one sentence near the beginning or end of the existing Shopify policy:
   **Using the PSI Performance App? Read the separate PSI Performance App
   Privacy Policy.** Link that wording to the new page.
10. Obtain final owner approval immediately before making the page visible.

## App Store Connect after publication

Changing the policy page does not invalidate the current TestFlight build or
tester records. Before public App Store submission—and preferably before the
external TestFlight review—change the privacy URL to the confirmed new page:

`https://psiperformance.com.au/pages/app-privacy`

In **App Store Connect → App Privacy → Privacy Policy**, enter:

- Privacy Policy URL: the final PSI App Privacy Policy page
- User Privacy Choices URL: the final public PSI account-deletion page

Also update TestFlight's Test Information privacy URL if it is displayed there.
Apple permits privacy responses and URLs to be maintained in App Store Connect;
the final metadata must accurately match the submitted App and its providers.

## Repository/app follow-up

After the public Shopify URL is approved:

1. Update the App's `contact.privacy` URL to the dedicated page.
2. Align the in-App privacy summary with the approved full policy.
3. Add the short collection notices in `PRIVACY-COLLECTION-NOTICES.md`.
4. Run lint, type checking, web export and signed-native acceptance.
5. Update Apple App Privacy and Google Play Data safety answers from the final
   signed binary.
6. Create and push a checkpoint before shipping the metadata or App update.

## Publication safety boundary

Publishing changes the live PSI website and is a separate external action. Do
not publish, change the footer or alter App Store Connect until Matt has
reviewed the final copy and explicitly approved that live action.

