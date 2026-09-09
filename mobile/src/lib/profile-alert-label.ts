/** A compact personal inbox label, without exposing an email address as a fallback. */
export function profileAlertLabel(firstName: unknown): string {
  if (typeof firstName !== 'string') return 'Account';
  const name = firstName.trim().replace(/\s+/gu, ' ');
  return name && !name.includes('@') ? name : 'Account';
}
