# PSI app visual refresh, 22 October 2026

Matt authorised rollout of the approved rounded app preview while preserving all existing links, features and customer information.

## Presentation changes

- Home displays the approved PSI, Tori, Holden and Porsche artwork above the existing content. Only the hero region is visible; the collections remain real interactive app controls.
- All Home collection tiles, including Rewards, have rounded ice blue illuminated borders. Rewards continues to display the account's real balance.
- Customer pages use subtle garage, diagnostic tablet or workbench imagery with readable translucent panels. The car hero appears only on Home.
- Shared cards, inputs, buttons, pickers and customer forms have rounded corners. The bottom navigation has an inset rounded frame, remains in normal layout flow and retains keyboard hiding and safe area handling.
- Each retained Stack and Tabs scene has its own opaque backing. Translucent panels cannot reveal another page, and navigation does not discard form state.

## Preserved boundaries

No database, storage, ownership, authentication, API, booking, payment, invoice, notification or reward calculation changes. No customer records were changed or removed. Existing route destinations, form actions and access gates remain in place. Native Apple/Google sheets and externally hosted payment pages retain their provider appearance.

The existing release channels and native runtime versions remain unchanged. The deployment uses the established GitHub Pages workflow and Expo update channels, with no dependency or native permission changes.

## Validation

- TypeScript passed.
- 74 targeted regression checks passed for theme contrast, owner controls, payment contracts, customer photo selection, vehicle artwork, customer access, diagnostics bookings and rewards.
- 22 review/demo environment isolation checks passed.
- The retained-scene regression verifies actual Stack/Tabs wrapper wiring, opaque backing, child identity and route-specific artwork across web, iOS and Android theme modes.
- A source comparison preserved all 689 existing event, navigation and form-control attributes across the changed screens/components.
- Browser checks covered 320 px and 390 px phone widths, 1440 px desktop width, dark/bright appearances, Home collections, tab navigation, profile access gates and the fictional demonstration booking choices. The browser checks exposed and corrected image sizing and retained-page transparency before release.
- Live signed-in customer purchases, uploads and physical-device installation were not exercised as part of this appearance-only update. No live test booking or payment was created.

Native bundles must be exported after the final scene-isolation edit and verified against the published Expo feed before reporting the rollout complete. Release output and verification receipts are saved locally under `work/rounded-design-2026-10-22/`.
