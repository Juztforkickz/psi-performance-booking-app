# Single loading design

Matt supplied an iPhone recording on 28 October 2026 showing the native white PSI logo on black, followed by the approved car and Tori artwork, then Home. The native logo is embedded in the installed store binary. An OTA update cannot replace that first image.

The native launch configuration now uses the unchanged approved portrait artwork on iPhone, with full screen aspect fill matching the existing React loading component. Android uses a transparent vector for its system launch icon, removing the separate plain PSI logo before the existing car and Tori loading view. Android still owns its brief system launch transition.

The application icon is unchanged. The current portrait has black Porsche wheels and yellow brake calipers. The rejected yellow wheel artwork is not used. The public app launch design does not include private garage artwork.

The existing GarageStartupGate remains unchanged. It keeps navigation mounted for notification links, hides Home while the account artwork selection is hydrating, and retains the car and Tori view until that selection is ready. The private artwork cache, account isolation, updater startup deadline and customer data are unchanged. No artificial loading delay is added.

This native change requires new store builds. iPhone marketing version becomes 1.0.3, while Android remains 1.0.3 with a new version code. Existing package identifiers, backend settings, release channels and compatible runtime values are preserved. The OTA native baseline must not be silently overwritten to publish this candidate before the reviewed store builds are ready.

Tests exercise the installed Expo config plugin's generated iPhone storyboard and Android drawable, unchanged native settings outside the launch design and version, the real hidden Home startup gate, and existing artwork cache and update lifecycles. Store binaries and physical phone startup must still be verified before claiming installation success. Private build and release receipts are under work/startup-single-2026-10-28.

References: [Expo SDK 57 splash configuration](https://docs.expo.dev/versions/v57.0.0/sdk/splash-screen/) and [Android launch screen behaviour](https://developer.android.com/develop/ui/views/launch/splash-screen). Installed plugin source is the implementation reference for this candidate.
