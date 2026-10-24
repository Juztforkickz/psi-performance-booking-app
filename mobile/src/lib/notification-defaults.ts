/** Live accounts start with device alerts enabled; explicit choices take priority. */
export function shouldAutomaticallyRegisterPush(
  accountChoice: string | null,
  defaultEnabled: boolean,
  legacyEnabled: string | null,
  storedToken: string | null,
) {
  if (accountChoice === 'false') return false;
  if (accountChoice === 'true') return true;
  return defaultEnabled || legacyEnabled === 'true' || Boolean(storedToken);
}

/** Ask on first setup only. A declined phone permission needs a customer action. */
export function shouldRequestInitialPushPermission(status: string, canAskAgain: boolean) {
  return status === 'undetermined' && canAskAgain;
}

