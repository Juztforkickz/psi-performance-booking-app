# Booking payment functions

These functions implement the signed mobile-app deposit boundary:

- `create-booking-payment` requires an authenticated customer who owns a
  `date_approved` booking. It creates Stripe-hosted Checkout or returns an
  ordinary bank-transfer reference and instructions.
- `stripe-booking-webhook` accepts no customer JWT. It verifies Stripe's raw
  request signature and confirms only a paid, amount-matched AUD session.
- `confirm-bank-transfer` requires active PSI staff with AAL2 MFA and records a
  cleared business-bank-statement match.

Required encrypted Edge Function secrets (never `EXPO_PUBLIC_*`):

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_LIVE_MODE` (`false` during acceptance; deliberately change with the
  matching key and webhook only after sign-off)
- `PSI_PAYMENT_RETURN_ORIGIN` (for example `https://psiperformance.com.au`)
- `PSI_BANK_TRANSFER_ACCOUNT_NAME`
- `PSI_BANK_TRANSFER_BSB`
- `PSI_BANK_TRANSFER_ACCOUNT_NUMBER`

Stripe Dashboard setup must enable cards, Apple Pay, Google Pay and Australian
BECS Direct Debit where the PSI account is eligible. Configure a webhook for:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`

The destination is the deployed `stripe-booking-webhook` function. Start with
Stripe test mode and synthetic bookings. Never paste secret keys into source,
screenshots, GitHub, Expo variables or the mobile app.
