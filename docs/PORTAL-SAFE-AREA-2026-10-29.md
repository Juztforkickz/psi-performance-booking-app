# Portal popup controls

Matt reported that Invoice review overlapped the iPhone status bar and its Close button could not be pressed. Native modal windows were using safe area context inherited from the underlying navigation screen. A SafeAreaView alone did not establish measurements for the new modal window.

## Change

The shared StaffModal component places a new SafeAreaProvider inside each native Modal, followed by one SafeAreaView protecting all four edges. It measures the current window on every presentation rather than reusing launch time metrics. Existing modal visibility, animation, transparency and hardware back callbacks pass through unchanged.

Applied to Invoice review, searchable portal selections, history month and year selection, vehicle photo viewing, record draft confirmation and the shared unsaved changes dialog. The ordinary portal pages retain their existing safe area layout. Invoice review keeps its fixed header and scrolling body, with a wrapping heading and a Close target that does not shrink below 48 points. Searchable selections avoid the keyboard and let the option list shrink. The month and year menu Close target is now 48 points.

Customer identities, invoice state, invitations, publishing, payments, records, backend calls, authentication and access protections are unchanged. Busy operations still prevent premature closure, and unsaved changes still require the existing discard decision. No real customer data was used for the new tests.

## Validation

111 relevant tests passed, zero failures or skips. They include actual component opening, Close and Android back callbacks for imported invoices, dropdown search and selection, record draft protection, existing invoice and booking mutation guards, Home preferences, Android updater behaviour, startup artwork and coordinated release safety.

Yoga layout checks use the actual invoice header and button styles at 320, 360, 390 and 393 pixel phone widths, landscape with side cutouts, and text sizes up to 200 percent. Close stays outside the status area, inside the window and separate from the heading. Mobile TypeScript and targeted lint for all seven changed app files passed.

These are automated component and layout checks. Local browser access was disabled, and no physical phone verification is claimed. A real iPhone or Android opening the updated portal is a separate observation.

## OTA compatibility record

The previous native safety record predated the completed loading screen store release. Its explicit update is based on reviewed source 584585d850a13ee47fc8cac163d3d6517c64b3d4, live Apple 1.0.3 build 22 and live Android 1.0.3 build 10. Both downloaded store packages were hash checked again. Every current native input matches that exact store source. Native APIs, permissions, channels and runtimes are unchanged; the earlier native change was launch artwork and the displayed version. The prior approved source is retained in the record. The guard remains active and regression tests still reject unexpected native changes.

The portal fix uses the existing safe area dependency. It needs no native build, new store submission, database migration, credential, billing change or Wallet activation. Release through the existing direct coordinated publisher to app-store-release and android-play-internal, preserving their installed runtimes. Verify the complete delivered bundle and asset bytes for both platforms before declaring the rollout complete. Phone installation is not established by feed verification.

Continuation and release receipts: work/portal-safe-area-2026-10-29/RESUME.md.
