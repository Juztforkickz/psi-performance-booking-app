# Customer photo selection

The garage and profile photo buttons previously requested broad photo library
access before opening the system picker. Customers who denied that access could
not select their own image. Both buttons now open the system picker directly,
granting access to the selected image. Library selection uses the modern picker
without native editing. Garage framing remains available. Taking a new picture
still requires camera permission. Ask PSI attachments use the same direct picker.

Six component regression cases cover garage and profile selection on Android,
iOS and web with broad library permission unavailable, and confirm that denied
camera permission still prevents camera launch. Nine messaging tests also pass.
Native device interaction remains to be confirmed by customers after updating.

Publication uses the existing Android internal and Apple public OTA channels,
with unchanged runtimes and production environment. Web refresh uses the existing
GitHub Pages pipeline. Release identifiers will be recorded after verification.
