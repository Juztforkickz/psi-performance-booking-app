export const CUSTOMER_ACCOUNT_CAPABILITIES = {
  version: 1,
  enabled: false,
  registration: "disabled",
  plannedRegistration: "invite_only",
  authentication: "not_configured",
  signInMethod: "passwordless_email_link",
  identityProvider: null,
  passwordStorage: "none",
  profileStore: "cloudflare_d1",
} as const;

export const CUSTOMER_ACCOUNTS_DISABLED_ERROR = {
  error: {
    code: "CUSTOMER_ACCOUNTS_DISABLED",
    message:
      "Customer accounts are not enabled. No sign-in, registration or profile change was accepted.",
  },
} as const;

export const ACCOUNT_RESPONSE_HEADERS = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
} as const;

export function customerAccountsDisabledResponse() {
  return Response.json(CUSTOMER_ACCOUNTS_DISABLED_ERROR, {
    status: 503,
    headers: ACCOUNT_RESPONSE_HEADERS,
  });
}
