export const REVIEW_PROJECT_REF: string;
export const REVIEW_URL: string;
export const REVIEW_PUBLIC_KEY: string;
export const REVIEW_CHANNEL: string;
export const REVIEW_RUNTIME: string;
export function resolveReviewEnvironment(input: {
  flag?: string; url?: string; key?: string; registration?: string;
  auth?: string; booking?: string; channel?: string;
}): Readonly<{ enabled: boolean; projectRef: string | null }>;
