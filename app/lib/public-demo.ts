export const PUBLIC_DEMO_CONFIG = {
  enabled: true,
  submissionsDisabled: true,
  label: "Public demo",
  notice:
    "Explore the web and mobile booking experience. Booking submissions are disabled, so no details are sent to or saved by PSI.",
  submissionMessage:
    "This is a public demo. Booking submissions are disabled, and no details were sent or saved.",
} as const;

export const PUBLIC_DEMO_SUBMISSIONS_DISABLED_ERROR = {
  error: {
    code: "PUBLIC_DEMO_SUBMISSIONS_DISABLED",
    message: PUBLIC_DEMO_CONFIG.submissionMessage,
  },
} as const;
