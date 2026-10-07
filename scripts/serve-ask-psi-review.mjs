// Local inspection only. No listener on the network and no credentials on disk.
import http from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const exportRoot = await realpath(path.join(repoRoot, 'artifacts', 'ask-psi-private-review', 'web'));
const port = 8773;
const origin = `http://127.0.0.1:${port}`;
// Separate origins keep Supabase auth broadcasts from crossing between roles.
const staffPort = 8774;
const staffOrigin = `http://127.0.0.1:${staffPort}`;
const reviewOrigins = new Set([origin, staffOrigin]);
const sandboxUrl = 'https://jwikoldibbpxyhbdrsow.supabase.co';
const key = 'sb_publishable_ehO9_cXAkXQ6fffoDmzvZA_c8erSaqP';
const config = JSON.parse(await readFile(path.join(exportRoot, '..', 'review-build.json'), 'utf8'));
const refinedHomeCss = await readFile(path.join(repoRoot, 'output', 'refined-black-home-preview', 'refined.css'), 'utf8');
if (config.project !== 'jwikoldibbpxyhbdrsow' || config.privatePreview !== true) throw new Error('Verified private sandbox export required');
let input = '';
for await (const chunk of process.stdin) input += chunk;
const accounts = JSON.parse(input);
input = '';
const approvedIdentities = { Customer: 'psiappreview@gmail.com', Staff: 'psiappreview+staff@gmail.com' };
if (!Array.isArray(accounts) || accounts.length !== 2 || accounts.some((account) =>
  account.Project !== 'jwikoldibbpxyhbdrsow' || !['Customer', 'Staff'].includes(account.Role)
  || account.Email !== approvedIdentities[account.Role] || typeof account.Password !== 'string')) {
  throw new Error('Only the existing fictional sandbox accounts are accepted');
}
const types = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2', '.json': 'application/json' };
function html(response, body, status = 200) {
  response.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'same-origin', 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY' });
  response.end(body);
}
const landing = `<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ask PSI private inspection</title>
<style>body{margin:0;background:#080b0d;color:#fff;font:17px/1.6 Arial,sans-serif}main{max-width:850px;margin:7vh auto;padding:28px}h1{font-size:clamp(30px,6vw,52px);line-height:1.1}p{color:#b9c5cb}.tag{color:#63d4f7;letter-spacing:2px;font-weight:bold}img{width:200px;float:right;max-width:35%}.cards{display:flex;flex-wrap:wrap;gap:20px;clear:both;padding-top:18px}form{background:#12191d;border:1px solid #40545c;flex:1;min-width:235px;padding:24px;border-radius:16px}button{background:#60cff2;color:#001018;border:0;padding:16px 20px;font-size:16px;font-weight:bold;border-radius:8px;cursor:pointer}small{color:#a4b7c0}a{color:#63d4f7}</style>
<main><img alt="Boost, the Ask PSI assistant" src="/__review/boost.png"><div class="tag">PRIVATE INSPECTION</div><h1>Meet Boost.<br>Try Ask PSI.</h1><p>This is the actual app connected to fictional accounts in the isolated PSI review sandbox.</p>
<div class="cards"><form action="${origin}/__review/customer" method="post"><h2>Customer view</h2><p>Ask a question, select a demo vehicle, attach a photo and view the reply.</p><button>Open customer chat</button></form>
<form action="${staffOrigin}/__review/staff" method="post"><h2>PSI inbox</h2><p>Open the question, reply, check read times and close or reopen the conversation.</p><button>Open workshop inbox</button></form></div>
<p>Open this review page in two tabs, then choose a different view in each. Send a message in one and view the reply in the other. Use fictional information only.</p><small>Public Ask PSI remains disabled. This preview is available only on this computer. Phone push notifications, banners, sounds and native keyboard behaviour still require a private device test. Email delivery is disabled.</small></main></html>`;

function createReviewServer(listenPort) {
return http.createServer(async (request, response) => {
  try {
    if (request.headers.host !== `127.0.0.1:${listenPort}` || (request.headers.origin && !reviewOrigins.has(request.headers.origin))) return html(response, 'Local review access only.', 403);
    const requestUrl = new URL(request.url, origin);
    const pathname = decodeURIComponent(requestUrl.pathname);
    if (pathname === '/__review' || pathname === '/__review/') return html(response, landing);
    if (pathname === '/__review/home' && request.method === 'GET' && listenPort === port) {
      return html(response, `<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PSI Home, Refined black preview</title><style>body{margin:0;background:#10161C;color:#F4F7FA;font:15px/1.5 Arial,sans-serif}header{text-align:center;padding:18px 12px}h1{font-size:22px;margin:0 0 6px}p{margin:0 0 14px;color:#CAD2D8}button{font:inherit;padding:10px 16px;border:1px solid #879AA8;background:#252B31;color:white;margin:0 4px 8px;min-height:44px}button[aria-pressed=true]{border-color:#65CFF8;color:#65CFF8}iframe{display:block;width:390px;height:844px;max-width:calc(100% - 24px);margin:0 auto 24px;border:1px solid #687B89;background:#090B0E}a{color:#65CFF8}</style><header><h1>Home, Refined black</h1><p>Actual app layout, private colour preview. 390 × 844 phone proportions.</p><button type="button" aria-pressed="false" data-view="/">Current</button><button type="button" aria-pressed="true" data-view="/?home-look=refined">Refined black</button><br><a href="/?home-look=refined">Open full size</a></header><iframe title="PSI Home colour preview" src="/?home-look=refined"></iframe><script>const frame=document.querySelector('iframe');document.querySelectorAll('button[data-view]').forEach(button=>button.addEventListener('click',()=>{frame.src=button.dataset.view;document.querySelectorAll('button[data-view]').forEach(other=>other.setAttribute('aria-pressed',String(other===button)));}));</script></html>`);
    }
    if (pathname === '/__review/phone' && request.method === 'GET') {
      const route = listenPort === staffPort ? '/staff-messages' : '/messages';
      return html(response, `<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ask PSI phone layout</title><style>body{margin:0;background:#091116;color:white;font:15px/1.5 Arial,sans-serif}header{text-align:center;padding:16px}a{color:#63d4f7}iframe{display:block;width:390px;height:844px;max-width:100%;margin:0 auto 24px;border:1px solid #365563;border-radius:16px;background:black}</style><header>Private ${listenPort === staffPort ? 'workshop' : 'customer'} inspection. Phone layout, not a native device test.<br><a href="${route}">Open full browser view</a> · <a href="/__review">Switch inspection view</a></header><iframe title="Ask PSI phone layout" src="${route}"></iframe></html>`);
    }
    if (pathname === '/__review/customer' || pathname === '/__review/staff') {
      if (request.method !== 'POST' || !reviewOrigins.has(request.headers.origin)) return html(response, 'Open a review view from the local inspection page.', 403);
      const role = pathname.endsWith('staff') ? 'Staff' : 'Customer';
      if (listenPort !== (role === 'Staff' ? staffPort : port)) return html(response, 'Open the matching view from the inspection page.', 403);
      const account = accounts.find((item) => item.Role === role);
      const login = await fetch(`${sandboxUrl}/auth/v1/token?grant_type=password`, {
        method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: account.Email, password: account.Password }), signal: AbortSignal.timeout(15000),
      });
      if (!login.ok) return html(response, 'Sandbox sign in could not complete. Return to the inspection page and try again.', 502);
      const session = await login.json();
      if (session.user?.email !== account.Email || !session.access_token) throw new Error('Unexpected review identity');
      const payload = JSON.stringify(JSON.stringify(session)).replace(/</g, '\\u003c');
      return html(response, `<!doctype html><title>Opening private review</title><script>sessionStorage.setItem('sb-jwikoldibbpxyhbdrsow-auth-token',${payload});location.replace('/__review/phone');</script>`);
    }
    if (!['GET', 'HEAD'].includes(request.method)) return html(response, 'Method not supported.', 405);
    let target = pathname === '/__review/boost.png'
      ? path.join(repoRoot, 'mobile', 'assets', 'images', 'boost-assistant.png')
      : path.resolve(exportRoot, `.${pathname}`);
    if (pathname !== '/__review/boost.png' && !target.startsWith(`${exportRoot}${path.sep}`) && target !== exportRoot) return html(response, 'Not found.', 404);
    let info = await stat(target).catch(() => null);
    if (!info?.isFile()) {
      const routeFile = `${target}.html`;
      info = await stat(routeFile).catch(() => null);
      target = info?.isFile() ? routeFile : path.join(exportRoot, 'index.html');
    }
    target = await realpath(target);
    if (pathname !== '/__review/boost.png' && !target.startsWith(`${exportRoot}${path.sep}`)) return html(response, 'Not found.', 404);
    response.writeHead(200, { 'Content-Type': types[path.extname(target)] ?? 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    if (request.method === 'HEAD') return response.end();
    const content = await readFile(target);
    if (path.extname(target) === '.html' && listenPort === port && requestUrl.searchParams.get('home-look') === 'refined') {
      return response.end(content.toString('utf8').replace('</head>', `<style id="psi-refined-home-preview">${refinedHomeCss}</style></head>`));
    }
    response.end(content);
  } catch {
    if (!response.headersSent) html(response, 'The local review could not load. Restart the private review launcher.', 500);
    else response.end();
  }
});
}
createReviewServer(port).listen(port, '127.0.0.1', () => console.log(`Private Ask PSI inspection ready: ${origin}/__review`));
createReviewServer(staffPort).listen(staffPort, '127.0.0.1', () => console.log(`Private workshop view ready: ${staffOrigin}/__review`));
