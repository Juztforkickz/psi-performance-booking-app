/** A navigation link only. Checkout still requires the customer's own session. */
export function bookingEmailAction(kind: string) {
  if (kind === "notify_customer_date_approved") {
    return { label: "Pay booking deposit", url: "https://juztforkickz.github.io/psi-performance-booking-app/bookings" };
  }
  if (kind === "notify_customer_date_proposed") {
    return { label: "View proposed date", url: "https://juztforkickz.github.io/psi-performance-booking-app/bookings" };
  }
  return null;
}
