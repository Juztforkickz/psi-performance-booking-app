# Content and asset sources

This build uses publicly available PSI Performance Garage information and owner-published brand media gathered on 20 August 2026.

## Public sources

- Website: https://psiperformance.com.au/
- Current contact/booking page: https://psiperformance.com.au/pages/contact
- Privacy policy: https://psiperformance.com.au/policies/privacy-policy
- Parts catalogue: https://psiperformance.com.au/collections/all
- PSI Performance Gift Card: https://psiperformance.com.au/products/psiperformance-gift-card
- Facebook: https://www.facebook.com/psiperformancegarage/
- Instagram: https://www.instagram.com/psiperformancegarage/

## Customer feedback provenance

The five-star customer stories attributed to Cale Pearson, Harry Beith, Shaun Ward, Emre Ozkan and Fiona Hewson are verbatim excerpts from the **Our Happy Clients** section on PSI Performance's official website. The live page labels the original testimonials with five stars but does not publish review dates. Their included wording and attribution are preserved, excerpts are identified as such, and the interface links back to that source.

No reliable PSI Pakenham customer review literally rating the business “10/10” was identified on 21 August 2026. The interface therefore uses **10/10 care** only as an explicitly labelled PSI service commitment, never as an invented customer score or aggregate rating.

The public business details used in the interface are:

- PSI Performance Garage
- 21 Exchange Drive, Pakenham VIC 3810
- 0433 431 781
- info@psiperformance.com.au
- Monday–Friday, 8:30am–5pm; Saturday by appointment
- Australian and European performance, servicing, diagnostics and dyno-tuning themes

Social audience counts were intentionally not embedded because they change frequently. The owner-supplied consumer booking guides are shown as **Service & Report from $423.50 including GST** and **Dyno Tuning from $649 including GST**; they are guides rather than quotes. The owner-set booking deposits are **$100 AUD for Service & Report** and **$300 AUD for Dyno Tuning**. Guaranteed power outcomes and instant availability are intentionally omitted.

## Supplied/public brand assets

The PSI logo, workshop/vehicle photography, favicon and type asset under `public/` were copied from PSI's public website for this PSI-owned product. Confirm final usage and licensing with the business owner before distributing the app through third-party stores.

The VF GTSR/Porsche media pair uses PSI-published source photography: the existing `public/psi-dyno.jpg` VF GTSR photograph and the Porsche 911 GT3 RS photograph published in PSI's live homepage hero. The Porsche source was retrieved on 21 August 2026 from `https://psiperformance.com.au/cdn/shop/files/hero-2_3fde8d49-ed74-4981-ad05-2f60d2f05c3f.jpg?v=1750591973&width=1780` with SHA-256 `3A9DDE503C78EAFDB062FE72B0BBB41465830CB8FC60228A8E29B92389961B0D`. The displayed desktop and mobile composites are `public/psi-gtsr-porsche-clean.jpg` (SHA-256 `E4A73CCB15B596029AED609F2625E15151F9BFE58680B0A883A17D4E47DBA39E`) and `public/psi-gtsr-porsche-mobile-clean.jpg` (SHA-256 `41A5C8D0A0CC2A7D0B507247B7D2AA91D6816BD8703A1603E6512B1BFC66150B`), with byte-identical native-app copies under `mobile/assets/images/`. On 21 August 2026, an AI-assisted background-only retouch removed the left-edge obstruction, yellow wall square and warning placards; the vehicles, framing and workshop setting were intentionally preserved.

The square PWA icons were composed locally from the PSI wordmark on a black background. `public/og.png` is the single generated campaign asset used for link previews.

### Illustrated mobile-dashboard assets

The seven 960×1200 JPEG dashboard illustrations under `mobile/assets/images/dashboard/` were created with the built-in ImageGen tool on **21 August 2026** from the documented automotive prompts and an owner-supplied mobile tile screenshot used as a layout, mood and quality reference. The screenshot was not imported into the app or used as a runtime asset. The prompts requested generic automotive subjects and instructed the generator to avoid third-party logos, wordmarks, watermarks and embedded interface wording. The finished files were visually reviewed and no obvious third-party wordmarks or baked-in tile labels were observed. Because that review is not legal or trade-mark clearance, final distribution remains subject to PSI owner and legal review.

| File | AI-generated subject | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| `tile-my-garage.jpg` | Performance vehicle and key for the customer's garage | 80,932 | `3688DD6EBDD01BDA5E759FEFA2B3EFADD7276082D8D334F63D82AB30D5A08EAE` |
| `tile-my-bookings.jpg` | Workshop booking calendar and service tool | 70,209 | `4E3B7BA0BAB22015543BA3D290BFA05852EEB4207A48914E8E80858D67018C01` |
| `tile-book-ahead.jpg` | Forward booking calendar with restrained gold direction cue | 101,946 | `C53BCC52D350A22A1B4B15A41A13DA525E83CBF1B6BBCB02E9C3A8D962E1D8D8` |
| `tile-alerts.jpg` | Customer reminder bell with a red notification indicator | 66,025 | `DBB35D388AB6BD73AB7000D3C3B3C1525AA0E49806CB023D50304EEE5B6C23C4` |
| `tile-hub-dyno.jpg` | Graphite performance sedan secured to a hub dyno, with the rear wheels removed and the rear hubs visibly connected to dyno adapters | 82,856 | `56809F2652FA497323EE27A9B2B2FE72DFB795025AEDCBAA53FEA827A44058B2` |
| `tile-vehicle-reports.jpg` | Diagnostic tablet and vehicle-report display | 79,267 | `31F584860E6ADD2772BD02F0956E1B8E2C538FE742635C866247D9CFEB9F53C1` |
| `tile-plan-build.jpg` | Engine, turbocharger, workshop tool and build-plan drawing | 160,715 | `7A648EBA45F7EA6A800BF50427BE6150E5FA21EFD937B8526AD011C329AD5CA1` |

On **23 August 2026**, the active My Bookings and Dyno Tuning tiles received owner-directed refinement passes using the built-in ImageGen tool. The bookings replacement removes the calendar and separate icon treatment in favour of one full-colour workshop task clipboard. The dyno replacement used the earlier generated hub-dyno tile plus an owner-supplied real hub-dyno photograph as mechanical references; its prompt specifically required both rear wheels removed and supported dyno pods connected to the opposing rear hubs through visible adapter shafts. The owner photograph remains a generation reference only and is not shipped in the app.

| Active replacement | AI-generated subject | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| `tile-my-bookings-v2.jpg` | Full-colour graphite, steel and ivory workshop task clipboard with checklist and service tool | 76,699 | `063203B1BC2D0C2BF4A1A0460618801F6D550F66015E98903B8F27C4A84282ED` |
| `tile-hub-dyno-v2.jpg` | Graphite performance sedan with both rear wheels removed and two floor-supported hub-dyno pods connected through visible axle-height adapters | 89,548 | `359F9AE75F9EC5B044F756E5F4E0006B76784AA4E08ADB05D2E52C3618FB9907` |

Prompt direction: premium, realistic automotive product illustration on carbon-black and graphite studio backgrounds, restrained champagne-gold accents, generous lower label space, and avoidance of embedded text, people, watermarks, racing clichés and unrelated branding. The hub-dyno image received a focused refinement pass so its engineering setup communicates the requested rear-wheel-off, hub-connected configuration. These statements describe the generation instructions and visual review, not a guarantee that AI output is source-free or legally cleared.

### Scrolling brand-rail assets

The manufacturer and tuning-platform marks used by PSI's scrolling homepage banner were retrieved from PSI Performance's official Shopify CDN on **21 August 2026**. The app keeps the sharp 300 px transparent PNG renditions under `public/brands/`, with byte-identical native-app copies under `mobile/assets/images/brands/`. Every imported file is 300×300 px, 32-bit ARGB and contains transparent pixels.

| Normalized file | Exact PSI-published 300 px source | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| `audi.png` | `https://psiperformance.com.au/cdn/shop/files/audi-logo.png?v=1750333597&width=300` | 67,413 | `815CACFE1C811A4E3DE2367C328EC71A129333CD436B5A197ED37889E274D467` |
| `holden.png` | `https://psiperformance.com.au/cdn/shop/files/holden-logo.png?v=1750333620&width=300` | 65,170 | `71B290EA1C210AAAA5A76FF5599443BA0BCFEB37B085B6F7328424A26551CAA8` |
| `ford.png` | `https://psiperformance.com.au/cdn/shop/files/ford-logo.png?v=1750333672&width=300` | 53,830 | `1BD741AECD2F9A7C47A99DF4A1214B90A913D2175ACE638B125EC6397F0EABA2` |
| `mercedes-benz.png` | `https://psiperformance.com.au/cdn/shop/files/mercedes-logo.png?v=1750333685&width=300` | 27,662 | `92B0CC2A1CD2C15873C407ACD35D33F2907F28A47465AA33966C95536815C799` |
| `porsche.png` | `https://psiperformance.com.au/cdn/shop/files/porche-logo.png?v=1750333703&width=300` | 87,390 | `51F19CCF4A56D972A93B398B1A2C95B51443FA21DAEA8B2B1865E187067710C5` |
| `lamborghini.png` | `https://psiperformance.com.au/cdn/shop/files/lambo-logo.png?v=1750333716&width=300` | 100,369 | `8BCF9EC1AE3E2518F0CA900ADDD6619E25F797A1F4607931B5535F5762B5A943` |
| `skoda.png` | `https://psiperformance.com.au/cdn/shop/files/skoda-logo.png?v=1750333730&width=300` | 72,472 | `FC02B467AA103C86ABDE9F866D76B2377B2A837EBB5E7DD8597635F4B37E37A4` |
| `volkswagen.png` | `https://psiperformance.com.au/cdn/shop/files/volkswagen-logo.png?v=1750333743&width=300` | 105,605 | `FB1423499CBF9D697D3260B0CF7CE3853C432ED96306AA5D082F5426CA099ABE` |
| `bmw.png` | `https://psiperformance.com.au/cdn/shop/files/bmw-logo.png?v=1750333755&width=300` | 66,706 | `BBA094AA657CD545C2602971214F709550B34747FCCC5CAC02937261BA11B69B` |
| `haltech.png` | `https://psiperformance.com.au/cdn/shop/files/haltech-logo.png?v=1750333767&width=300` | 37,555 | `5D9DECE927DAC760D36D5BC1D61812795B5B62673DCD0260C504564E9D9436A8` |
| `fueltech.png` | `https://psiperformance.com.au/cdn/shop/files/fueltech_a4ad7488-e9d4-461e-9605-bea9631a83c6.png?v=1750333779&width=300` | 22,822 | `E5652075AE69C2FCA680BD237029847E160BBCCE3B8BAE8CFAEF990788F49CFD` |
| `hp-tuners.png` | `https://psiperformance.com.au/cdn/shop/files/hptuners.png?v=1750333796&width=300` | 10,273 | `DC3536D6B033C685C322E02E4A431594ADC7012D53E9599EE2E2B5B95C16708F` |

These third-party marks are used nominatively to identify vehicle manufacturers PSI services and tuning platforms PSI works with. Their inclusion does not imply endorsement, sponsorship, partnership or affiliation by the respective trade mark owners, and the marks must not be presented as PSI-owned branding.

## Product brand system

The web booking experience, staff queue and native mobile app use one restrained, high-end performance system:

- official white PSI Performance Garage wordmark on carbon black;
- carbon black `#050505`, graphite `#111111` and warm ivory `#F3F0E8` surfaces;
- champagne gold `#D9B35B` with a restrained metallic highlight for key actions;
- PSI's Ethnocentric display face for major web headings, paired with a clean system sans serif for readable form content;
- PSI workshop and vehicle photography with controlled dark overlays, fine rules and compact technical labels;
- square PSI-branded PWA, iOS and Android icons.

The direction intentionally avoids flames, chequered flags, speed streaks and generic racing graphics. The performance character comes from the real cars, PSI's wordmark, precise typography and measured use of metallic gold.

### App-store identity pack

On **23 August 2026**, the app-store identity pack under `artifacts/PSI APP/` was prepared from the approved PSI artwork. The launcher icon uses the PSI letterform alone on solid carbon black so it remains legible at small sizes; the `PERFORMANCE GARAGE` subtitle remains in the native splash and store feature artwork. The active Expo icon, Android adaptive foreground and splash configuration were updated from the same deterministic source artwork by `scripts/Generate-PsiStoreAssets.ps1`.

The Google Play feature-graphic background was generated with the built-in ImageGen tool from a text-only prompt requesting a generic black performance sedan in a dark premium workshop, with no text, people, logos, numberplate or manufacturer badge. The approved PSI logo and final tagline were composited locally afterward. The generated car/background is marketing artwork rather than PSI workshop photography and remains subject to owner and ordinary legal/store review.

| File | Use | SHA-256 |
| --- | --- | --- |
| `psi-app-icon-1024.png` | Apple/native/web icon master | `36B36811C433C280A5EFEA69E200FB70633F9AA6E3F2D0CF21737A2F68737C9F` |
| `psi-splash-logo-1200x500.png` | Transparent approved PSI splash artwork | `07DB3AA50F70B71F9A5F3B93B496CA2FC708834420B827B05DA47CD9B2EDB300` |
| `google-play-feature-graphic-1024x500.png` | Google Play marketing feature graphic | `8CFF4A0C2E6D2D67AAA0B238C9100BC1667F8E9115422DC39AC4B22472054C6C` |

## Social-card generation record

Mode: built-in image generation, using `public/psi-hero.jpg` and `public/psi-logo.png` as references.

Final prompt:

> Use case: ads-marketing
>
> Asset type: 1200x630 landscape social sharing card for the PSI Performance online booking site
>
> Primary request: Create a complete, polished social card for an Australian performance workshop booking experience.
>
> Input images: Image 1 is the approved PSI vehicle/hero photography and should guide the vehicle subject and premium photographic finish. Image 2 is the exact PSI Performance Garage logo reference; reproduce that supplied wordmark faithfully and clearly.
>
> Scene/backdrop: deep black and steel-grey automotive setting with restrained industrial texture and a subtle amber/gold highlight.
>
> Subject: a premium white performance car, visually grounded and believable, with the approved PSI wordmark.
>
> Style/medium: high-end performance automotive campaign photography with sharp editorial typography.
>
> Composition/framing: wide landscape, vehicle weighted to the right, strong readable headline area to the left, generous safe margins for link-unfurl crops.
>
> Lighting/mood: dramatic controlled workshop lighting, confident and precise, not flashy.
>
> Color palette: black, white, steel grey and PSI amber/gold.
>
> Text (verbatim): "BOOK YOUR CAR" and "SERVICE • DYNO TUNING" and "PAKENHAM, VIC"
>
> Constraints: render each text line exactly once; preserve the PSI logo wording and proportions; large legible typography; cohesive finished card; no prices, power figures, claims or extra copy; no unrelated logos; no watermark.
>
> Avoid: generic racing clichés, flames, speed streaks, fake sponsor decals, small unreadable text, distorted wheels, invented workshop details.

## Two-car composite generation record

Mode: built-in image editing/compositing, using the PSI-published VF GTSR and Porsche 911 GT3 RS photographs as references.

Final desktop prompt:

> Create one photorealistic 16:9 automotive photograph in which the exact black VF GTSR and exact grey Porsche 911 GT3 RS are parked side by side outside the PSI workshop. Preserve both vehicle identities, body shapes, colours and wheels. Match the ground plane, camera height, daylight, colour temperature, reflections and contact shadows so the photograph appears to have been taken together. Keep both complete cars inside the central responsive safe area. No people, extra cars, text, watermark, invented signage or visible number plates.

Final mobile prompt:

> Reframe the approved two-car composite into a mobile-friendly near-square photograph. Keep both complete cars side by side, move them slightly closer, and extend the workshop wall and concrete foreground rather than cropping either vehicle. Preserve the exact cars, lighting, perspective, shadows and photographic finish. No people, extra cars, text, watermark, invented signage or visible number plates.
