# Refined black Home preview

Open `http://127.0.0.1:8773/__review/home` while the existing private review server is running.

The phone frame displays the actual private app export at 390 by 844 CSS pixels. Current and Refined black controls switch between the existing screen and a local CSS colour overlay. The screen can be scrolled and its existing controls inspected.

The proposed palette keeps a nearly black page, raises card surfaces to charcoal, improves secondary text brightness, softens tile borders and slightly brightens the existing tile artwork. It changes neither the layout nor the original image files.

The overlay is loaded only by the local review server when the customer HTML request includes `home-look=refined`. No mobile source imports this stylesheet, and no public build, OTA, store submission or production setting is changed. Preview screenshots show the private web rendering, not a native device test. The review banner is specific to the isolated sandbox.
