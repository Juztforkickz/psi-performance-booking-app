import { env } from "cloudflare:workers";

export type PaymentRuntimeEnv = typeof env & {
  PSI_PAYMENT_PROVIDER_NAME?: string;
  PSI_PAYMENT_WEBHOOK_SECRET?: string;
  PSI_EMAIL_OUTBOX_ENABLED?: string;
  PSI_EMAIL_PROVIDER_NAME?: string;
  PSI_GOOGLE_CALENDAR_ID?: string;
  PSI_PAYMENT_CHECKOUT_ORIGINS?: string;
  PSI_PAYMENT_RECEIPT_ORIGINS?: string;
};

export function integrationError(status: number, code: string, message: string) {
  return Response.json(
    { error: { code, message } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function constantTimeHexEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export function integrationsReady() {
  const runtime = env as PaymentRuntimeEnv;
  const calendarId = runtime.PSI_GOOGLE_CALENDAR_ID?.trim() ?? "";
  return (
    paymentVerificationReady() &&
    allowedOrigins(runtime.PSI_PAYMENT_CHECKOUT_ORIGINS).length > 0 &&
    runtime.PSI_EMAIL_OUTBOX_ENABLED === "true" &&
    Boolean(runtime.PSI_EMAIL_PROVIDER_NAME?.trim()) &&
    Boolean(calendarId) &&
    calendarId.toLowerCase() !== "primary"
  );
}

export function paymentVerificationReady() {
  const runtime = env as PaymentRuntimeEnv;
  return (
    Boolean(runtime.PSI_PAYMENT_PROVIDER_NAME?.trim()) &&
    Boolean(runtime.PSI_PAYMENT_WEBHOOK_SECRET && runtime.PSI_PAYMENT_WEBHOOK_SECRET.length >= 32)
  );
}

function allowedOrigins(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => /^https:\/\/[^/?#]+$/u.test(item));
}

export function isAllowedProviderUrl(
  value: string,
  kind: "checkout" | "receipt",
) {
  const runtime = env as PaymentRuntimeEnv;
  const origins = allowedOrigins(
    kind === "checkout"
      ? runtime.PSI_PAYMENT_CHECKOUT_ORIGINS
      : runtime.PSI_PAYMENT_RECEIPT_ORIGINS,
  );
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.hash &&
      origins.includes(url.origin)
    );
  } catch {
    return false;
  }
}

export async function verifySignedProviderRequest(request: Request, rawBody: string) {
  const runtime = env as PaymentRuntimeEnv;
  if (!paymentVerificationReady()) {
    return {
      error: integrationError(
        503,
        "INTEGRATIONS_NOT_CONFIGURED",
        "Payment verification is unavailable until the signed payment-provider secret is configured.",
      ),
      provider: null,
    };
  }
  const timestamp = request.headers.get("x-psi-timestamp") ?? "";
  const signature = request.headers.get("x-psi-signature") ?? "";
  if (!/^\d{10}$/u.test(timestamp) || !/^sha256=[a-f0-9]{64}$/u.test(signature)) {
    return { error: integrationError(401, "INVALID_SIGNATURE", "A valid provider signature is required."), provider: null };
  }
  const timestampSeconds = Number(timestamp);
  if (Math.abs(Math.floor(Date.now() / 1_000) - timestampSeconds) > 5 * 60) {
    return { error: integrationError(401, "STALE_SIGNATURE", "The provider signature has expired."), provider: null };
  }
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(runtime.PSI_PAYMENT_WEBHOOK_SECRET!),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${rawBody}`),
  );
  const expected = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  if (!constantTimeHexEqual(signature.slice(7), expected)) {
    return { error: integrationError(401, "INVALID_SIGNATURE", "A valid provider signature is required."), provider: null };
  }
  return { error: null, provider: runtime.PSI_PAYMENT_PROVIDER_NAME!.trim() };
}
