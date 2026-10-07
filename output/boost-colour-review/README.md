# Boost colour review

Private comparison assets prepared on 8 October 2026 with the built in image generation tool. Neither colour replaces the existing app asset until Matt chooses one. Both PNG files retain a transparent alpha background.

Original edit target: `mobile/assets/images/boost-assistant.png`.

Purple output: `boost-purple.png`.

Green output: `boost-green.png`.

## Shared edit prompt

Use case: precise-object-edit. Edit target: the supplied transparent Boost turbo robot mascot. Preserve EXACTLY the same character, silhouette, proportions, waving pose, eye shape, friendly smile, black cast turbo housing, silver metal rings, arms and feet, frontal camera angle and framing. Change ONLY all cyan/blue accent lighting, eyes, rim lighting, smile, seams and turbine pipe lighting to COLOR. Keep photoreal polished mechanical materials. Full body with all edges and feet visible and similar margins. Actual transparent alpha background, no circle, backdrop, plate, text or new elements. Colour should stand out clearly on a black app background; use bright matching highlights within the chosen deep colour, avoiding dull nearly black eyes.

Purple COLOR: rich deep royal purple with luminous amethyst and violet highlights, no blue or cyan.

Green COLOR: rich dark emerald green reminiscent of a glossy forest green Porsche GT3 wrap, with luminous emerald highlights, no blue or cyan.

## Placement

Boost occupies his own 80 point space above the persistent bottom navigation. Page content ends above this space, preventing the character or his touch target from covering page controls. This space disappears when the keyboard opens, on messaging and staff routes, and in public builds where Ask PSI is disabled.

Validated with the existing messaging tests, TypeScript, lint, private web export and visible phone layout inspection. Native phone inspection remains separate. No public feature activation or OTA publication is included.
