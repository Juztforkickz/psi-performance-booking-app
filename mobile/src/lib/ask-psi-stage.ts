import { REVIEW_ENVIRONMENT } from '@/lib/review-environment';

const privatePreviewRequested = process.env.EXPO_PUBLIC_ASK_PSI_PRIVATE_PREVIEW === 'true';

export const ASK_PSI_STAGE = Object.freeze({
  privatePreviewEnabled: privatePreviewRequested && (__DEV__ || REVIEW_ENVIRONMENT.enabled),
});
