const { REVIEW_URL, REVIEW_PUBLIC_KEY, REVIEW_CHANNEL, REVIEW_PROJECT_REF } = require('./review-environment.cjs');
const QA_PROFILE = 'ask-psi-device-test';
const QA_RUNTIME = '1.0.0-ask-psi-device-test-1';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function resolveAskPsiDeviceQa(input) {
  if (!['', 'false', 'true'].includes(input.flag ?? '')) throw new Error('INVALID_ASK_PSI_DEVICE_QA_FLAG');
  if (input.flag !== 'true') return Object.freeze({ enabled: false, userIds: [] });
  const userIds = (input.users ?? '').split(',').map(value => value.trim()).filter(Boolean);
  if (input.review !== 'true' || input.googleReview !== 'false' || input.privatePreview !== 'true'
    || input.url !== REVIEW_URL || input.key !== REVIEW_PUBLIC_KEY || input.channel !== REVIEW_CHANNEL
    || input.auth !== 'true' || input.booking !== 'true' || input.registration !== 'false'
    || input.demo !== 'false' || input.purchaseTest !== 'false'
    || !userIds.length || userIds.length > 4 || userIds.some(value => !UUID.test(value))
    || new Set(userIds).size !== userIds.length) throw new Error('ASK_PSI_DEVICE_QA_CONFIGURATION_MISMATCH');
  return Object.freeze({ enabled: true, userIds: Object.freeze(userIds), projectRef: REVIEW_PROJECT_REF });
}
module.exports = { QA_PROFILE, QA_RUNTIME, resolveAskPsiDeviceQa };
