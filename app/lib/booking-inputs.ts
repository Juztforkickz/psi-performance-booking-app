const EMAIL_MAX_LENGTH = 254;

export function isValidBookingEmail(rawValue: string) {
  const value = rawValue.trim();
  if (value.length === 0 || value.length > EMAIL_MAX_LENGTH) return false;

  const separator = value.indexOf("@");
  if (separator <= 0 || separator !== value.lastIndexOf("@")) return false;

  const localPart = value.slice(0, separator);
  const domain = value.slice(separator + 1);
  if (
    localPart.length > 64 ||
    localPart.startsWith(".") ||
    localPart.endsWith(".") ||
    localPart.includes("..") ||
    !/^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/iu.test(localPart)
  ) {
    return false;
  }

  const labels = domain.split(".");
  if (domain.length > 253 || labels.length < 2) return false;

  const validLabel = /^[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?$/iu;
  if (labels.some((label) => !validLabel.test(label))) return false;

  const topLevelDomain = labels.at(-1) ?? "";
  return /^[A-Z]{2,63}$/iu.test(topLevelDomain) || /^XN--[A-Z0-9-]{2,59}$/iu.test(topLevelDomain);
}

export function isValidBookingMobile(rawValue: string) {
  const value = rawValue.trim();
  const digits = value.replace(/\D/gu, "");
  return /^\+?[\d() .-]+$/u.test(value) && digits.length >= 8 && digits.length <= 15;
}

export function isValidVehicleRegistration(rawValue: string) {
  return /^[A-Z0-9][A-Z0-9 .-]*$/u.test(rawValue.trim().toUpperCase());
}

export function isValidVin(rawValue: string) {
  return /^[A-HJ-NPR-Z0-9]{17}$/u.test(rawValue.trim().toUpperCase());
}
