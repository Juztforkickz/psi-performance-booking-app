// Owner requested these two registration test profiles be hidden from normal
// customer lists. Keep their accounts and deletion administration unchanged.
const hiddenRegistrationTests = new Set([
  'info+public-registration-20260925-1234@psiperformance.com.au',
  'info+registration-check-3e09a0c@psiperformance.com.au',
]);

export function isVisibleStaffCustomer(customer: { email: string | null }): boolean {
  return !hiddenRegistrationTests.has((customer.email ?? '').trim().toLowerCase());
}
