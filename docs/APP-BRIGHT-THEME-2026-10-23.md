# PSI bright workshop appearance, 23 October 2026

Matt authorised the bright workshop concept with softer backgrounds behind text, preserving the approved dark appearance and existing features.

## Changes

Dedicated daylight workshop photographs replace the washed out dark photographs in bright mode. Garage, Home and Settings use a silver toolbox scene. Reports use a diagnostic tablet and paperwork scene. Bookings, account prompts and checkout forms use a workbench and tools scene. The existing route selector applies these through the shared retained screen backing, including nested account routes. The decorative layers cannot receive touches or accessibility focus.

A soft white tint and the existing nearly opaque light panel surfaces protect text contrast. Bright borders use blue grey rather than black. The vehicle selector uses a pearl white surface with charcoal text in bright mode. Existing Home hero and collection artwork, rounded controls and navigation remain intact.

The three added JPEGs total less than 600 KB. Original dark artwork remains byte identical. No backend, customer, authentication, notification, payment, invoice, reward, ownership or route changes are included.

## Platform boundary

iOS uses the existing dynamic colour pairs. Web uses the existing CSS variables. Android retains its established legacy palette boundary: Home, Events, customer sales, Trusted Partners and Messages support bright colours; other legacy native Android screens remain dark to preserve contrast. This update does not put a bright photograph behind white text on those screens. Expanding legacy Android colour support is separate work and must not be described as completed by this release. Automatic theme preference and stored user choices remain unchanged.

## Asset creation

Built in image generation was used, followed only by JPEG encoding at quality 86. The asset prompts requested portrait daylight white and silver automotive workshop photographs, no app interface, people, cars, text or logos, with quiet central space for dark text and modest equipment near the edges.

* `bright-garage.jpg`: white shutter wall, high windows, brushed aluminium rolling cabinets, small petrol blue details and pale polished concrete.
* `bright-reports.jpg`: the same daylight setting, with a diagnostic tablet, checklist and torque wrench on a silver bench near the lower right edge.
* `bright-forms.jpg`: the same daylight setting, with a silver drawer unit and neatly arranged spanners and sockets near the left edge.

These are decorative concept photographs, not evidence of PSI's actual workshop or completed work. The generated mockup remains a visual reference rather than a pixel exact promise of native layout.

## Verification

93 targeted checks passed, including screen isolation, dark artwork selection and opacity, theme contrast wiring, booking requirements and deposits, customer photo selection, owner controls, access and rewards. TypeScript and targeted ESLint passed. A separate comparison against the previous release verified identical dark palette values, existing dark web variables, all existing dark brand colour values, the four original artwork files and all garage event and form attributes.

Release receipts and browser observations are recorded under `work/bright-theme-2026-10-23/`. Physical device installation requires the installed app to receive its existing channel update. No real customer booking, purchase or upload is created for this appearance check.
