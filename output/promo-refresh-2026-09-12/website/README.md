# PSI website app promotion

This is a prepared Shopify installation package. Nothing has been changed in Shopify, the existing website section, app source or public stores.

## Files

- `psi-app-launch.liquid` — complete Shopify section with editable artwork/video, the Performance+ feature, trusted-team logos, car-listing feature and guarded store buttons.
- `psi-v3-app-aside-preview.liquid` — optional compact replacement for the existing “Coming Soon” aside, using its existing styling.
- `validate-section.mjs` — local structure/schema and release-guard checks; does not contact Shopify.

## Install the complete section

1. In Shopify, open **Online Store → Themes**. Duplicate the current theme for a recoverable preview.
2. In that duplicate, open **Edit code** and create `sections/psi-app-launch.liquid`. Paste the complete matching file from this folder. Do not paste it into a Custom Liquid block: its schema is a theme-section definition.
3. Open **Customize** for the duplicate theme. Add **PSI app launch** where the app promotion should appear, for example directly below the booking section.
4. Keep **Enable public launch mode** off. The initial headline is **MEET THE PSI APP** and the working call to action is **Explore the preview**. No store buttons are shown by default.
5. Under **Preview media**, select a preview-safe image or uploaded Shopify video. Use a version saying “Meet the PSI app” or without a launch claim. The generated `psi-app-arrived-hero.png` is a launch edition: select it under **Launch media**, never under Preview media. Separate selections prevent it being displayed before launch.
6. The video takes precedence over the image in the same mode; the image becomes its poster. Videos use visible controls and do not autoplay. The adjacent written benefits and the expandable video description explain the promotional visuals.
7. Add the approved logo to each of the ten **Trusted team** blocks. Use the original JPGs under `mobile/assets/images/partners/`. Keep all business lettering visible. Martini Racing Products and Fab Car Audio can retain their white backgrounds; the section uses `object-fit: contain`.
8. Check the duplicated theme at mobile and desktop sizes, keyboard navigation and browser zoom. Check every link. Publish only the intended theme changes once reviewed.

The section is self-contained: no third-party scripts, tracking, external font or CDN dependency, no customer data, no changes to existing forms. Styles are scoped to its unique Shopify section ID. Links stay in the same tab, so the browser Back button works normally.

## Replace the existing “Coming Soon” area

The exact old block in the repository is in `shopify/psi-website-version-3-section.liquid`, currently lines 163–174. Locate it by this opening tag rather than relying on line numbers:

```liquid
<aside class="psi-v3__app" aria-labelledby="psi-v3-app-title">
```

It contains **PSI App · Coming Soon** and ends at its matching `</aside>` immediately before the layout's closing `</div>`.

**Smallest change:** replace only that complete aside with `psi-v3-app-aside-preview.liquid`. Leave the contact form, closing layout tags, existing CSS and script untouched. This gives the booking area a truthful preview link and new feature copy while retaining its current layout. Add the complete new launch section separately if a larger visual promotion is wanted.

**Single full-width promotion:** install the complete new section separately and remove only the old aside from the duplicated theme. In that same old section's CSS, change only `.psi-v3__layout`'s desktop grid from `grid-template-columns:minmax(0,1fr) minmax(300px,.35fr)` to `grid-template-columns:minmax(0,1fr)`. This prevents an empty column beside the booking form. Do not remove `.psi-v3__workspace`, the contact form, its field logic, or the whole booking section.

Do not insert a nested `{% section %}` inside the existing aside: Shopify sections are installed and positioned through the theme template/editor.

## When the stores are actually live

1. Open the public App Store and/or Google Play listing while signed out and confirm it belongs to PSI Performance and offers installation to the intended Australian customers. An app ID, review page, internal test or TestFlight invite alone is not a public release.
2. Paste the real public URL into its platform setting. Both fields are intentionally blank by default. Check the platform's **listing is live and checked** switch only after verifying it.
3. Enable **public launch mode**. The headline becomes **IT’S ARRIVED** only when at least one verified HTTPS store link is configured. Only configured and verified platforms get download buttons; a still-testing platform is not advertised as publicly available.
4. Select the launch image/video. If neither launch asset is selected, the section keeps its preview artwork. A configured launch image replaces the preview video; a launch video uses the launch image as its poster.
5. Confirm the paid Performance+ products are available and the subscription information matches the stores before promoting paid activation. This section includes no purchase/checkout button and makes no price claim.

The code checks an exact `https://apps.apple.com/` or `https://play.google.com/` prefix, the separate platform verification switch and the overall launch switch. It cannot determine store availability itself. Do not tick verification merely to preview “It’s arrived” on the live theme; use the duplicated unpublished theme for that review.

## Content boundaries

- PSI Free includes the everyday garage, booking, reminder and current-result experience.
- Performance+ is an optional paid subscription for PSI-published private vehicle records. It does not include physical workshop work, parts, guaranteed historic records or unlimited uploads.
- Customer Cars for Sale is an owner-approved listing enquiry feature. It does not publish private garage records automatically. The live list may be empty.
- The “Explore” links intentionally open the existing sample preview routes, including after launch, and are labelled accordingly. Store buttons are the actual installation route.

## Local validation

From this folder, run `node validate-section.mjs`. This checks JSON schema, settings, Liquid block balance, plain HTML structure and release-switch scenarios. A Shopify theme preview remains required to confirm Shopify's own Liquid renderer, uploaded media and the installed theme's appearance.

Shopify references used: [section schema](https://shopify.dev/docs/storefronts/themes/architecture/sections/section-schema), [input settings](https://shopify.dev/docs/storefronts/themes/architecture/settings/input-settings), [video_tag](https://shopify.dev/docs/api/liquid/filters/video_tag).
