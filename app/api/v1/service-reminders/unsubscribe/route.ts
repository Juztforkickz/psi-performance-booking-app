import { getBookingD1 } from "../../../../../db";

const RATE_LIMIT_WINDOW_SECONDS = 15 * 60;
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_RETENTION_WINDOWS = 8;
const RATE_LIMIT_PRUNE_BATCH = 200;
const MAX_UNSUBSCRIBE_REQUEST_BYTES = 2_048;

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function html(body: string, status = 200) {
  return new Response(
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PSI service reminders</title><body style="margin:0;background:#050505;color:#f5f1e8;font:16px system-ui"><main style="max-width:36rem;margin:10vh auto;padding:2rem"><h1 style="color:#c7a65b">PSI Performance</h1>${body}</main></body></html>`,
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/html; charset=utf-8",
        "X-Robots-Tag": "noindex, nofollow",
      },
    },
  );
}

function clientIdentity(request: Request) {
  const value = request.headers.get("cf-connecting-ip")?.trim() ?? "";
  return value && value.length <= 64 && /^[0-9a-f:.]+$/iu.test(value)
    ? value.toLowerCase()
    : "unavailable";
}

async function readBoundedBody(request: Request) {
  const declaredLength = request.headers.get("content-length")?.trim() ?? "";
  if (
    /^\d+$/u.test(declaredLength) &&
    Number(declaredLength) > MAX_UNSUBSCRIBE_REQUEST_BYTES
  ) {
    return null;
  }

  if (!request.body) return "";

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let body = "";
  let byteLength = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > MAX_UNSUBSCRIBE_REQUEST_BYTES) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      body += decoder.decode(value, { stream: true });
    }
    return body + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

async function rateLimit(database: Awaited<ReturnType<typeof getBookingD1>>, request: Request) {
  const now = Math.floor(Date.now() / 1_000);
  const windowStart = Math.floor(now / RATE_LIMIT_WINDOW_SECONDS) * RATE_LIMIT_WINDOW_SECONDS;
  const ipHash = await sha256(`psi-service-unsubscribe-v1:${clientIdentity(request)}`);

  // Keep cleanup work bounded so an unsubscribe request cannot trigger a large delete.
  await database
    .prepare(
      `DELETE FROM booking_rate_limits
       WHERE rowid IN (
         SELECT rowid FROM booking_rate_limits
         WHERE window_start < ?
         ORDER BY window_start ASC
         LIMIT ?
       )`,
    )
    .bind(
      windowStart - RATE_LIMIT_WINDOW_SECONDS * RATE_LIMIT_RETENTION_WINDOWS,
      RATE_LIMIT_PRUNE_BATCH,
    )
    .run();

  const row = await database
    .prepare(
      `INSERT INTO booking_rate_limits (ip_hash, window_start, request_count)
       VALUES (?, ?, 1)
       ON CONFLICT (ip_hash, window_start)
       DO UPDATE SET request_count = request_count + 1
       RETURNING request_count AS requestCount`,
    )
    .bind(ipHash, windowStart)
    .first<{ requestCount: number }>();
  return Boolean(row && row.requestCount <= RATE_LIMIT_MAX);
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!/^[a-f0-9]{64}$/u.test(token)) {
    return html("<p>This unsubscribe link is invalid. Contact info@psiperformance.com.au if you need help.</p>", 400);
  }
  return html(
    `<p>Stop future six- and twelve-month PSI service reminders for this email address?</p><form method="post" action="/api/v1/service-reminders/unsubscribe"><input type="hidden" name="token" value="${token}"><button style="background:#c7a65b;border:0;border-radius:.4rem;padding:.8rem 1.1rem;font-weight:700" type="submit">Unsubscribe from service reminders</button></form><p>This does not affect messages about an active booking.</p>`,
  );
}

export async function POST(request: Request) {
  let token = "";
  try {
    const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
    const body = await readBoundedBody(request);
    if (body === null) {
      return html("<p>The unsubscribe request was too large.</p>", 413);
    }
    if (contentType.includes("application/json")) {
      const value: unknown = JSON.parse(body);
      if (value && typeof value === "object" && !Array.isArray(value)) {
        const candidate = (value as Record<string, unknown>).token;
        token = typeof candidate === "string" ? candidate.trim() : "";
      }
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      token = new URLSearchParams(body).get("token")?.trim() ?? "";
    } else {
      return html("<p>The unsubscribe request format was not supported.</p>", 415);
    }
  } catch {
    return html("<p>The unsubscribe request could not be read.</p>", 400);
  }
  if (!/^[a-f0-9]{64}$/u.test(token)) {
    return html("<p>This unsubscribe link is invalid.</p>", 400);
  }

  try {
    const database = await getBookingD1();
    if (!(await rateLimit(database, request))) {
      return html("<p>Too many requests were received. Please wait and try again.</p>", 429);
    }
    const tokenHash = await sha256(token);
    const job = await database
      .prepare(
        `SELECT recipient_email_hash AS recipientEmailHash
         FROM service_reminder_jobs
         WHERE unsubscribe_token_hash = ?`,
      )
      .bind(tokenHash)
      .first<{ recipientEmailHash: string | null }>();
    if (job?.recipientEmailHash) {
      await database.batch([
        database
          .prepare(
            `INSERT OR IGNORE INTO service_reminder_suppressions (
               recipient_email_hash, reason
             ) VALUES (?, 'customer_unsubscribe')`,
          )
          .bind(job.recipientEmailHash),
        database
          .prepare(
            `UPDATE service_reminder_jobs
             SET state = 'unsubscribed', unsubscribed_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE recipient_email_hash = ? AND state IN ('scheduled', 'processing')`,
          )
          .bind(job.recipientEmailHash),
        database
          .prepare(
            `UPDATE integration_outbox
                SET state = 'dead_letter', last_error_code = 'CUSTOMER_UNSUBSCRIBED',
                    updated_at = CURRENT_TIMESTAMP
              WHERE kind = 'service_reminder.customer_email'
                AND aggregate_id IN (
                  SELECT id FROM service_reminder_jobs
                   WHERE recipient_email_hash = ?
                )
                AND state IN ('pending', 'processing', 'failed')`,
          )
          .bind(job.recipientEmailHash),
      ]);
    }
    return html(
      "<p>Your service-reminder preference has been updated. You will still receive essential messages about any active booking.</p>",
    );
  } catch {
    console.error("Service reminder unsubscribe failed.");
    return html("<p>We could not update the preference right now. Please try again or contact info@psiperformance.com.au.</p>", 503);
  }
}
