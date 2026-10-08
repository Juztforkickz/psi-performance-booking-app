const { REVIEW_URL, REVIEW_PUBLIC_KEY, REVIEW_PROJECT_REF } = require('./review-environment.cjs');

const BOOST_PREVIEW_PROFILE = 'boost-preview';
const BOOST_PREVIEW_RUNTIME = '1.0.0-boost-preview-1';
const BOOST_PREVIEW_BUNDLE = 'au.com.psiperformance.garage.boostpreview';
const BOOST_PREVIEW_SCHEME = 'psiboostpreview';

// This opt-in is shared by native configuration and client runtime checks.
function resolveBoostPreview(input) {
  const flag = input.flag ?? '';
  if (!['', 'false', 'true'].includes(flag)) throw new Error('INVALID_BOOST_PREVIEW_FLAG');
  if (flag !== 'true') {
    if (input.channel === BOOST_PREVIEW_PROFILE) throw new Error('BOOST_PREVIEW_FLAG_REQUIRED');
    return Object.freeze({ enabled: false, projectRef: null });
  }
  if (input.channel !== BOOST_PREVIEW_PROFILE || input.url !== REVIEW_URL || input.key !== REVIEW_PUBLIC_KEY
    || input.review !== 'true' || input.googleReview !== 'false' || input.privatePreview !== 'true'
    || input.auth !== 'true' || input.booking !== 'true' || input.registration !== 'false'
    || input.demo !== 'false' || input.purchaseTest !== 'false' || input.deviceQa !== 'false'
    || input.applePurchaseKey !== 'disabled' || input.googlePurchaseKey !== 'disabled') {
    throw new Error('BOOST_PREVIEW_SANDBOX_REQUIRED');
  }
  return Object.freeze({ enabled: true, projectRef: REVIEW_PROJECT_REF });
}

module.exports = { resolveBoostPreview, BOOST_PREVIEW_PROFILE, BOOST_PREVIEW_RUNTIME, BOOST_PREVIEW_BUNDLE, BOOST_PREVIEW_SCHEME };
