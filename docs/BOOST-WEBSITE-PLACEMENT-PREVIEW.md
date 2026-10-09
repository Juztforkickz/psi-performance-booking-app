# Boost website placement preview

Created 9 October 2026 for Matt to inspect Boost and the conversation popup together on a representation of the current PSI website. This is a local preview, not an installed Shopify feature.

## Open the preview

Run the existing private server from the repository root:

```powershell
node operations/boost-website-test/serve-preview.mjs
```

Open `http://127.0.0.1:8780/website.html` on this laptop. The original conversation test remains at `/index.html`. Both pages are local only. A phone cannot reach this loopback address remotely.

The preview uses the current website logo, Ethnocentric font, navigation, first homepage hero artwork and workshop introduction, inspected on 9 October 2026. It reproduces the relevant homepage sections for checking placement, rather than copying Shopify checkout, account access, forms, catalogue or live scripts. Background navigation stays within the preview and cannot create a booking or order.

## Inspect the interaction

Boost has a transparent background and sits at the bottom right. The conversation popup sits above him, clear of its message controls. Closing the popup leaves Boost visible. Clicking him reopens the conversation. Scrolling the website content keeps him and the popup anchored in the corner. On narrow screens the popup fits inside the page gutters. While composing on a narrow screen, Boost hides and the popup uses the available space above the keyboard. The standalone preview responds to visual viewport height changes; a real phone keyboard still needs testing before integration.

The popup starts open to make its appearance immediately visible. Servicing, Dyno tuning and EV & Hybrid buttons use the existing offline engine. Visitors can write replies, continue collecting enquiry details and choose Message PSI. Matt’s test inbox in the preview toolbar shows the simulated handoff and allows a test reply. Returning to the visitor view marks that reply as read. The toolbar, Preview indicator and Local test labels are deliberately visible during this review. The test inbox is not a proposed public customer control and is not a Shopify Inbox connection.

The initial placement preview reused the existing replies. The 9 October follow up makes servicing and routine booking guidance specific to website visitors: use Book an appointment on the website or Message PSI in this chat. The app is not required to send a website enquiry. Existing booking changes and confirmations still need PSI review. Message text stays in page memory and disappears after refresh. Only open state, selected view, intent and the fact of a test handoff may be retained by the inline preview host. Message text is not persisted or sent to an external service.

The follow up also keeps the narrow screen popup stationary when focus moves from its message field to Send, Reply or another chat control. Moving the popup during that focus change could otherwise interrupt the button tap. Boost remains hidden while the chat controls have focus and returns when focus leaves the popup or it is closed.

## Assets and isolation

`operations/boost-website-test/assets/homepage-hero.webp` is the observed public homepage asset bundled from:

`https://psiperformance.com.au/cdn/shop/files/hero-1_280036d8-39d2-4c0c-a680-cee36f16a3d0.jpg?v=1750590677&width=1780`

`boost-display.webp` is a small, lossless WebP display derivative of the approved transparent Boost PNG, sized for the launcher. The character design is unchanged and the original PNG is preserved. `prepare-display-assets.py` regenerates this display packaging using Pillow. The original PNG SHA256 is `cad94613b982797e02c407caeba748f2cab1746b8c6eb35af5aa525249ef0ea2`.

Both previews embed their assets. The server permits only the three explicit page paths, binds only to 127.0.0.1 and rejects foreign hosts, origins, cross site requests and POST requests. Its browser policy blocks outbound connections and form actions. No production credentials, customer data, real messages, emails, push notifications, bookings, payments or database writes are used.

Generate the inline website preview:

```powershell
node operations/boost-website-test/build-website-preview.mjs
```

Run the targeted checks:

```powershell
node --test operations/boost-website-test/engine.test.cjs operations/boost-website-test/isolation.test.mjs
```

The placement preview and the engine pass 22 automated checks, including website booking guidance, enquiries without the app, continued quote intake and preservation of booking and account review requirements. Browser review covers visitor follow up messages, confirmed handoff, Matt’s test reply and read time, closing and reopening, scrolling, narrow screen layout and typing clearance. Native phone keyboard behaviour and live Shopify delivery remain unverified by this simulation.

No Shopify theme, app source, Expo configuration, OTA channel, native build, store listing, owner entitlement or public integration is changed. Boost remains unpublished. Preserve unrelated edits in the shared working directory when committing these preview files.
