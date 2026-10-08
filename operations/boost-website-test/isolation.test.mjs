import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { buildFragment } from './build-preview.mjs';
import { createPreviewServer } from './serve-preview.mjs';

test('the self contained preview has no external resources or message endpoints', async () => {
  const fragment = await buildFragment();
  assert.ok(Buffer.byteLength(fragment) < 1_000_000);
  assert.match(fragment, /src="data:image\/png;base64,/);
  assert.doesNotMatch(fragment, /\b(?:fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|Notification\s*\()/);
  assert.doesNotMatch(fragment, /(?:src|href|action)="https?:/);
  assert.doesNotMatch(fragment, /<!doctype\s|<\s*(?:html|head|body)(?:\s|>)/i);
});

function request(port, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, method: 'GET', path: '/', ...options }, res => {
      let body = ''; res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject); req.end();
  });
}
test('the local server blocks connections, writes, filesystem routes and foreign origins', async t => {
  const server = await createPreviewServer();
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const port = server.address().port;
  const page = await request(port);
  assert.equal(page.status, 200);
  assert.match(page.headers['content-security-policy'], /connect-src 'none'/);
  assert.match(page.headers['content-security-policy'], /form-action 'none'/);
  assert.equal(page.headers['cache-control'], 'no-store');
  assert.match(page.body, /Simulated Shopify handoff/);
  assert.equal((await request(port, { method: 'POST' })).status, 404);
  assert.equal((await request(port, { path: '/.env' })).status, 404);
  assert.equal((await request(port, { path: '/../mobile/app.json' })).status, 404);
  assert.equal((await request(port, { headers: { host: 'shopify.example' } })).status, 403);
  assert.equal((await request(port, { headers: { origin: 'https://unrelated.example' } })).status, 403);
  assert.equal((await request(port, { headers: { 'sec-fetch-site': 'cross-site' } })).status, 403);
});
