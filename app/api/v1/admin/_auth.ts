import { env } from "cloudflare:workers";

type RuntimeEnv = typeof env & { PSI_ADMIN_KEY?: string };

export function adminError(
  status: number,
  code: string,
  message: string,
  extraHeaders?: HeadersInit,
) {
  const headers = new Headers(extraHeaders);
  headers.set("Cache-Control", "no-store");
  return Response.json({ error: { code, message } }, { status, headers });
}
export function adminJson(body: unknown, status = 200, extraHeaders?: HeadersInit) {
  const headers = new Headers(extraHeaders);
  headers.set("Cache-Control", "no-store");
  return Response.json(body, { status, headers });
}

async function digest(value: string) {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  );
}

async function constantTimeEqual(left: string, right: string) {
  const [leftHash, rightHash] = await Promise.all([digest(left), digest(right)]);
  let difference = 0;
  for (let index = 0; index < leftHash.length; index += 1) {
    difference |= leftHash[index] ^ rightHash[index];
  }
  return difference === 0;
}

export async function authorizeAdmin(request: Request) {
  const configuredKey = (env as RuntimeEnv).PSI_ADMIN_KEY;
  if (!configuredKey || configuredKey.length < 32) {
    return adminError(503, "ADMIN_API_UNAVAILABLE", "The staff booking queue is not configured.");
  }
  const authorization = request.headers.get("authorization") ?? "";
  const match = /^Bearer ([A-Za-z0-9._~-]{32,256})$/u.exec(authorization);
  if (!match || !(await constantTimeEqual(match[1], configuredKey))) {
    return adminError(401, "UNAUTHORIZED", "A valid staff credential is required.", {
      "WWW-Authenticate": "Bearer",
    });
  }
  return null;
}

export async function sha256(value: string) {
  const bytes = await digest(value);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function readAdminIdempotencyKey(request: Request) {
  const value = request.headers.get("idempotency-key") ?? "";
  return value.length >= 16 && value.length <= 128 && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(value)
    ? value
    : null;
}

export async function readJsonObject(request: Request, maxBytes: number) {
  if (!(request.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) {
    return { body: null, error: adminError(415, "UNSUPPORTED_MEDIA_TYPE", "Send JSON data.") };
  }
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    return { body: null, error: adminError(413, "REQUEST_TOO_LARGE", "The request is too large.") };
  }
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > maxBytes) {
      return { body: null, error: adminError(413, "REQUEST_TOO_LARGE", "The request is too large.") };
    }
    const body: unknown = JSON.parse(raw);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return { body: null, error: adminError(400, "INVALID_REQUEST", "The request must be a JSON object.") };
    }
    return { body: body as Record<string, unknown>, error: null };
  } catch {
    return { body: null, error: adminError(400, "INVALID_JSON", "The request body is not valid JSON.") };
  }
}
