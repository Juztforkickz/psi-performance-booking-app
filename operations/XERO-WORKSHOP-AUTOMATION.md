# Xero and workshop record flow

## Confirmed app customer

1. PSI approves the date and the customer completes the booking deposit step.
2. The confirmed booking creates one workshop job automatically.
3. Copy the exact `PSI-…` job reference from **Booking details → Workshop actions** into the Xero invoice Reference field.
4. Xero may import the issued invoice PDF once the contact, app customer, vehicle and exact job reference are verified. The invoice does not need to be marked paid first.
5. When Xero later reports the invoice as paid, the portal updates the Xero completion suggestion status. Xero payment or bank reconciliation never closes the workshop job by itself.
6. PSI opens **Complete service**, checks the prefilled invoice date and line descriptions against the real job, adds the odometer or corrections, and completes the service. That staff action creates the permanent PSI history and schedules any consented six- and twelve-month reminders from the actual completion date.

## Customer without the app

The invoice remains in Xero. If its webhook appears in the PSI import review list, choose **Keep in Xero only**. No customer account, vehicle vault or app history is created.

## Workshop photos and PDFs

1. Download the booking's **PC folder file** from the staff portal.
2. On the workshop PC, choose **Add a confirmed job folder** from the PSI Workshop Uploads shortcut.
3. Put camera images into `before`, `progress` or `after`. Their filenames can stay as the camera created them.
4. Save the Mainline result as PDF into `dyno`; put locally saved invoice PDFs into `invoices`; put other repair paperwork into `documents`.
5. Start **Upload once** or **Keep watching for new files**. The verified manifest, rather than a filename guess, links every file to the correct app customer, vehicle and job.

The portal and PC tool do not infer identity from names, registrations embedded in filenames, OCR or folder titles. That protects against a photo or invoice being attached to the wrong customer.
