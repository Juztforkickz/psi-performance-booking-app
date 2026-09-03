// Shared by Expo config, the app and regression tests. No credentials belong here.
const REVIEW_PROJECT_REF = 'jwikoldibbpxyhbdrsow';
const REVIEW_URL = `https://${REVIEW_PROJECT_REF}.supabase.co`;
const REVIEW_PUBLIC_KEY = 'sb_publishable_ehO9_cXAkXQ6fffoDmzvZA_c8erSaqP';
const REVIEW_CHANNEL = 'apple-review';
const REVIEW_RUNTIME = '1.0.0-apple-review-1';

function resolveReviewEnvironment(input) {
  const flag = input.flag?.trim() ?? '';
  const url = input.url?.trim() ?? '';
  const key = input.key?.trim() ?? '';
  const enabled = flag === 'true';
  if (flag && flag !== 'true' && flag !== 'false') throw new Error('INVALID_REVIEW_FLAG');
  if (enabled) {
    if (url !== REVIEW_URL || key !== REVIEW_PUBLIC_KEY) throw new Error('REVIEW_BACKEND_MISMATCH');
    if (input.registration !== 'false') throw new Error('REVIEW_REGISTRATION_MUST_BE_DISABLED');
    if (input.auth !== 'true' || input.booking !== 'true') throw new Error('REVIEW_FEATURES_MUST_BE_ENABLED');
    if (input.channel !== REVIEW_CHANNEL) throw new Error('REVIEW_CHANNEL_MISMATCH');
  } else if (url.includes(REVIEW_PROJECT_REF) || key === REVIEW_PUBLIC_KEY || input.channel === REVIEW_CHANNEL) {
    throw new Error('SANDBOX_REQUIRES_EXPLICIT_REVIEW_MODE');
  }
  return Object.freeze({ enabled, projectRef: enabled ? REVIEW_PROJECT_REF : null });
}

module.exports = { resolveReviewEnvironment, REVIEW_PROJECT_REF, REVIEW_URL, REVIEW_PUBLIC_KEY, REVIEW_CHANNEL, REVIEW_RUNTIME };
