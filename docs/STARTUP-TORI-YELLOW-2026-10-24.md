# Full screen loading artwork, 24 October 2026

Matt requested the existing garage loading-screen background with Tori above the cars, yellow Porsche wheels and an image that reaches the display edges.

The new bundled public portrait artwork is `mobile/assets/images/psi-startup-tori-yellow.png`. It was edited with the built-in image generation tool using the existing loading wallpaper and approved Tori Home artwork. The original assets remain unchanged. The edit preserves the Performance+ wording, phone logo, garage, black Holden and grey Porsche, adds the existing Tori identity above the vehicles and changes the Porsche wheel rims to yellow. It is illustrative app artwork, not mechanical evidence.

`GarageStartupScreen` now draws with cover scaling and no safe-area padding. The background extends behind the status bar and home indicator, with no artificial startup delay. Landscape retains the existing landscape Performance+ artwork and also uses cover scaling. The installed native logo shown before JavaScript starts is unchanged, since that requires a new store binary.

No account, customer data, subscription, Rewards calculation, balance, backend or authentication changes.

Validation: mobile TypeScript and targeted ESLint passed. The actual component was rendered through React Native Web at 393 by 852 and 320 by 568. Both screenshots show full edge coverage and visible key subjects and wording; document dimensions match viewport dimensions with no scrolling. Physical iPhone installation and display are not claimed by browser verification.

Publication receipts are retained under `work/startup-tori-yellow-2026-10-24/`. Native distribution must match final export hashes before being reported as published.
