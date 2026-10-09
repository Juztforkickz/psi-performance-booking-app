import http from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { buildFragment } from './build-preview.mjs';
import { buildWebsiteFragment } from './build-website-preview.mjs';
import { buildReviewDocument } from './build-review.mjs';

const HOST = '127.0.0.1';
const PORT = 8780;
export async function createPreviewServer() {
  const [fragment, websiteFragment] = await Promise.all([buildFragment(), buildWebsiteFragment()]);
  const document = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>PSI Boost private website test</title><style>html{color-scheme:dark}body{margin:0;padding:12px;background:#101419}button,summary{cursor:pointer}*{box-sizing:border-box}</style></head><body>${fragment}</body></html>`;
  const websiteDocument = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>PSI website with Boost, private preview</title><style>button,a{cursor:pointer}</style></head><body class="boost-website-standalone">${websiteFragment}</body></html>`;
  const server = http.createServer((request, response) => {
  const authority = `${HOST}:${server.address().port}`;
  const origin = `http://${authority}`;
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; form-action 'none'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'");
  const originAllowed = !request.headers.origin || request.headers.origin === origin;
  const localNavigation = !request.headers['sec-fetch-site'] || ['same-origin', 'none'].includes(request.headers['sec-fetch-site']);
  if (request.headers.host !== authority || !originAllowed || !localNavigation) { response.writeHead(403); response.end('Local test only.'); return; }
  if (request.method !== 'GET' || !['/', '/index.html', '/website.html', '/review.html'].includes(request.url)) { response.writeHead(404); response.end('No test endpoint here.'); return; }
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.end(request.url === '/review.html' ? buildReviewDocument() : request.url === '/website.html' ? websiteDocument : document);
  });
  return server;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = await createPreviewServer();
  server.listen(PORT, HOST, () => console.log(`Private Boost test: http://${HOST}:${PORT}. Offline replies, simulated inbox, no external connections.`));
}
