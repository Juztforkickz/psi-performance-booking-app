import type { XeroInvoice } from './xero-invoice-match.ts';

const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const API = 'https://api.xero.com/api.xro/2.0/Invoices/';

/** Server-only adapter. Caller supplies a securely refreshed token, never a URL
 * from a webhook. Read-only API operations; errors omit provider bodies/tokens.
 */
export function xeroInvoiceReader(accessToken: string, tenantId: string, request: typeof fetch = fetch) {
  if (!accessToken || /[\r\n]/.test(accessToken) || !isUuid(tenantId)) throw new Error('xero_configuration_required');
  async function read(invoiceId: string, accept: string, limit: number) {
    if (!isUuid(invoiceId)) throw new Error('invalid_invoice_id');
    const response = await request(API + encodeURIComponent(invoiceId), {
      method: 'GET', redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${accessToken}`, 'xero-tenant-id': tenantId, Accept: accept },
    });
    if (!response.ok) {
      await response.body?.cancel();
      if (response.status === 401) throw new Error('xero_reauthorisation_required');
      if (response.status === 403) throw new Error('xero_invoice_permission_required');
      if (response.status === 429) throw new Error('xero_rate_limited_retry_later');
      if (response.status === 404) throw new Error('xero_invoice_unavailable_review_required');
      throw new Error('xero_temporarily_unavailable');
    }
    if (response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== accept) {
      await response.body?.cancel();
      throw new Error('xero_unexpected_file_type');
    }
    if (Number(response.headers.get('content-length')) > limit) {
      await response.body?.cancel(); throw new Error('xero_response_too_large');
    }
    if (!response.body) throw new Error('xero_empty_response');
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = []; let size = 0;
    try {
      while (true) {
        const part = await reader.read(); if (part.done) break;
        size += part.value.byteLength;
        if (size > limit) { await reader.cancel(); throw new Error('xero_response_too_large'); }
        chunks.push(part.value);
      }
    } finally { reader.releaseLock(); }
    if (!size) throw new Error('xero_empty_response');
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return bytes;
  }
  return {
    async invoice(invoiceId: string): Promise<XeroInvoice> {
      const bytes = await read(invoiceId, 'application/json', 2 * 1024 * 1024);
      let body;
      try { body = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new Error('xero_invalid_invoice_response'); }
      if (!Array.isArray(body?.Invoices) || body.Invoices.length !== 1 || body.Invoices[0]?.InvoiceID !== invoiceId) throw new Error('xero_invoice_identity_mismatch');
      return body.Invoices[0];
    },
    async pdf(invoiceId: string) {
      const bytes = await read(invoiceId, 'application/pdf', 20 * 1024 * 1024);
      if (new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') throw new Error('xero_invalid_pdf');
      return bytes;
    },
  };
}
