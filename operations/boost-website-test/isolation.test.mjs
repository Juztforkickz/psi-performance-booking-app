import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { buildFragment } from './build-preview.mjs';
import { createPreviewServer } from './serve-preview.mjs';
import { buildWebsiteFragment } from './build-website-preview.mjs';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

test('the self contained preview has no external resources or message endpoints', async () => {
  const fragment = await buildFragment();
  assert.ok(Buffer.byteLength(fragment) < 1_000_000);
  assert.match(fragment, /src="data:image\/webp;base64,/);
  assert.doesNotMatch(fragment, /\b(?:fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|Notification\s*\()/);
  assert.doesNotMatch(fragment, /(?:src|href|action)="https?:/);
  assert.doesNotMatch(fragment, /<!doctype\s|<\s*(?:html|head|body)(?:\s|>)/i);
});

test('website placement reuses the offline engine with embedded artwork and no live actions', async () => {
  const fragment = await buildWebsiteFragment();
  assert.ok(Buffer.byteLength(fragment) < 1_000_000);
  assert.match(fragment, /id="psi-boost-website-placement"/);
  assert.match(fragment, /src="data:image\/webp;base64,/);
  assert.match(fragment, /PREVIEW/);
  assert.match(fragment, /Messages stay in this test/);
  assert.doesNotMatch(fragment, /\b(?:fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|Notification\s*\(|localStorage|sessionStorage)/);
  assert.doesNotMatch(fragment, /(?:src|href|action)="https?:/);
  assert.doesNotMatch(fragment, /<!doctype\s|<\s*(?:html|head|body)(?:\s|>)/i);
  assert.doesNotMatch(fragment, /innerHTML\s*=/);
  const view = await readFile(new URL('./website-view.js', import.meta.url), 'utf8');
  for (const id of [...view.matchAll(/el\('([^']+)'\)/g)].map(match => match[1])) {
    assert.ok(fragment.includes(`id="${id}"`), `Missing ${id}`);
  }
  const original = await readFile(new URL('../../mobile/assets/images/boost-assistant.png', import.meta.url));
  assert.equal(createHash('sha256').update(original).digest('hex'), 'cad94613b982797e02c407caeba748f2cab1746b8c6eb35af5aa525249ef0ea2');
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
  const website = await request(port, { path: '/website.html' });
  assert.equal(website.status, 200);
  assert.match(website.body, /boost-website-standalone/);
  assert.match(website.headers['content-security-policy'], /connect-src 'none'/);
  assert.equal((await request(port, { path: '/website.html', method: 'POST' })).status, 404);
  const review = await request(port, { path: '/review.html' });
  assert.equal(review.status, 200);
  assert.match(review.body, /2 remaining clarifications for Matt/);
  assert.match(review.headers['content-security-policy'], /connect-src 'none'/);
  assert.equal((await request(port, { path: '/review.html', method: 'POST' })).status, 404);
  const rehearsals = await request(port, { path: '/rehearsals.html' });
  assert.equal(rehearsals.status, 200);
  assert.match(rehearsals.body, /20 of 20 conversations passed/);
  assert.match(rehearsals.headers['content-security-policy'], /connect-src 'none'/);
  assert.equal((await request(port, { path: '/rehearsals.html', method: 'POST' })).status, 404);
  assert.equal((await request(port, { method: 'POST' })).status, 404);
  assert.equal((await request(port, { path: '/.env' })).status, 404);
  assert.equal((await request(port, { path: '/../mobile/app.json' })).status, 404);
  assert.equal((await request(port, { headers: { host: 'shopify.example' } })).status, 403);
  assert.equal((await request(port, { headers: { origin: 'https://unrelated.example' } })).status, 403);
  assert.equal((await request(port, { headers: { 'sec-fetch-site': 'cross-site' } })).status, 403);
});
