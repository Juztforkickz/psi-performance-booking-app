const DELETION_ERROR_MESSAGES = {
  authentication_required: 'Sign in again, verify your authenticator and retry this deletion request.',
  invalid_session: 'Your sign-in has expired. Sign in again, verify your authenticator and retry this deletion request.',
  owner_aal2_required: 'Open the portal with the PSI owner account and verify your authenticator before retrying.',
  staff_identity_cannot_be_deleted: 'This account has staff access and cannot be deleted through customer account deletion.',
  retention_review_required: 'Confirm the retention review before permanently deleting this account.',
  confirmation_email_mismatch: 'Type the customer email exactly as shown before continuing.',
  customer_identity_not_found: 'The customer sign-in could not be found. Refresh the deletion requests to check the account status before continuing.',
  active_deletion_request_required: 'This account no longer has an active deletion request. Refresh the list to check its current status.',
  invalid_customer_id: 'This deletion request could not be identified. Refresh the list and reopen the customer request.',
  deletion_lock_failed: 'The account could not be locked for deletion. No cleanup started on this attempt. Refresh and retry this same request; contact PSI support if it continues.',
  private_storage_cleanup_failed: 'Private file cleanup did not finish. Customer access remains locked. Refresh and retry this same deletion request to finish cleanup.',
  customer_data_cleanup_failed: 'Customer record cleanup did not finish. Customer access remains locked. Refresh and retry this same deletion request to finish cleanup.',
  auth_identity_cleanup_failed: 'Sign-in removal did not finish. Customer access remains locked. Refresh and retry this same deletion request to finish cleanup.',
  server_configuration_unavailable: 'Account deletion is temporarily unavailable. No cleanup started on this attempt. Contact PSI support before retrying.',
  staff_verification_unavailable: 'Owner access could not be verified. No cleanup started on this attempt. Refresh the portal and retry.',
  deletion_verification_unavailable: 'The customer deletion request could not be verified. No cleanup started on this attempt. Refresh and retry this same request.',
  invalid_json: 'The deletion request could not be read. Refresh the portal and retry this same request.',
  method_not_allowed: 'The deletion request could not be sent correctly. Refresh the portal and retry this same request.',
  CONFIRMATION_EMAIL_INVALID: 'Type the customer email exactly as shown before continuing.',
  RETENTION_REVIEW_REQUIRED: 'Confirm the retention review before permanently deleting this account.',
  STAFF_SESSION_REQUIRED: 'Sign in again, verify your authenticator and retry this deletion request.',
  STAFF_OWNER_AAL2_REQUIRED: 'Open the portal with the PSI owner account and verify your authenticator before retrying.',
} as const;

type AccountDeletionErrorCode = keyof typeof DELETION_ERROR_MESSAGES;
const UNKNOWN_CODE = 'ACCOUNT_DELETION_UNCONFIRMED';

function knownCode(value: unknown): AccountDeletionErrorCode | null {
  return typeof value === 'string' && Object.hasOwn(DELETION_ERROR_MESSAGES, value)
    ? value as AccountDeletionErrorCode
    : null;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : null;
}

export class AccountDeletionError extends Error {
  readonly code: AccountDeletionErrorCode | typeof UNKNOWN_CODE;

  constructor(code: unknown) {
    const safeCode = knownCode(code) ?? UNKNOWN_CODE;
    super(safeCode);
    this.name = 'AccountDeletionError';
    this.code = safeCode;
  }
}

// FunctionsHttpError keeps the Edge response in context. Read only its allowlisted
// error code; provider messages and response details must never reach the UI.
export async function parseAccountDeletionError(error: unknown): Promise<AccountDeletionError> {
  const details = record(error);
  const localCode = knownCode(details?.code) ?? knownCode(details?.message);
  if (localCode) return new AccountDeletionError(localCode);

  const context = record(details?.context);
  if (context && typeof context.json === 'function') {
    try {
      const response = typeof context.clone === 'function' ? context.clone() : context;
      const body = record(await response.json());
      const code = knownCode(body?.error);
      if (code) return new AccountDeletionError(code);
    } catch {
      // Network/proxy responses may not be JSON. Preserve an uncertain outcome.
    }
  }
  if (context?.status === 401) return new AccountDeletionError('invalid_session');
  return new AccountDeletionError(UNKNOWN_CODE);
}

export function accountDeletionErrorMessage(error: unknown): string {
  const details = record(error);
  const code = knownCode(details?.code) ?? knownCode(details?.message);
  return code
    ? DELETION_ERROR_MESSAGES[code]
    : 'Deletion could not be confirmed. Refresh the deletion requests to check the account status, then retry this same request if it is still awaiting completion.';
}
