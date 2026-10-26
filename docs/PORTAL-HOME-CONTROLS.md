# Portal and Home controls

Updated 27 October 2026.

Home starts with all twelve tiles selected. Customise controls both Your shortcuts and Workshop. Unchecking a tile hides it from Home; its existing feature routes remain available. Reset default restores all twelve. Choices are saved on that device. Recognisable older defaults migrate once, while identifiable custom selections remain selected. The old preference is retained for recovery. A save failure shows a retry action.

Imports and drafts uses an Invoice queue dropdown with Needs action, Awaiting account and Imported counts. A searchable customer or invoice dropdown opens one invoice in a separate review sheet. Choose action shows only the relevant form. New workshop customers have their own action. The submit button stays outside the form scroll area, and unfinished edits require a discard decision before closing.

Moving an invoice to Awaiting account leaves the queue selection unchanged and shows a confirmation with an optional View awaiting accounts action. Moving it does not send an invitation. The existing verified contact invitation action remains separate. Unpublished drafts are available through their own searchable selector.

The five staff navigation tabs, booking stages, owner security checks, invoice inspection, customer and vehicle ownership checks, parts only handling and backend procedures are preserved. List scroll positions are remembered within the mounted staff workspace. No database migration or customer data change is required.

Validation includes preference migration, every tile toggle, empty selection, reset, restart, rapid taps, late hydration, save failures and retry. Portal regression coverage includes fresh invoice inspection, failed inspection, automatic and manually confirmed waiting matches, new workshop customers, verified invitations, action switching, preview isolation, owner guards and booking deposit separation. Phone browser checks use fictional data with writes disabled.

This is a JavaScript interface change for the existing Apple and Android OTA channels. Native compatibility must pass before release. Delivery receipts are retained privately under work/portal-home-2026-10-27.
