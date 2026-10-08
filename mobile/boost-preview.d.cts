export const BOOST_PREVIEW_PROFILE: string;
export const BOOST_PREVIEW_RUNTIME: string;
export const BOOST_PREVIEW_BUNDLE: string;
export const BOOST_PREVIEW_SCHEME: string;
export function resolveBoostPreview(input: {
  flag?: string; channel?: string; url?: string; key?: string; review?: string;
  googleReview?: string; privatePreview?: string; auth?: string; booking?: string;
  registration?: string; demo?: string; purchaseTest?: string; deviceQa?: string;
  applePurchaseKey?: string; googlePurchaseKey?: string;
}): Readonly<{ enabled: boolean; projectRef: string | null }>;
