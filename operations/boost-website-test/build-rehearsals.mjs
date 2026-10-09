import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const require = createRequire(import.meta.url);
const journeys = require('./journeys.cjs');
const { runJourney } = require('./journey-runner.cjs');
const engine = require('./engine.cjs');
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
export function buildRehearsalsDocument() {
  const results = journeys.map(journey => {
    try { return { journey, state: runJourney(journey) }; }
    catch (error) { return { journey, error: error.message }; }
  });
  const passed = results.filter(result => !result.error).length;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Boost conversation rehearsals</title><style>
*{box-sizing:border-box}body{margin:0;background:#111820;color:#edf4f8;font:16px/1.55 system-ui,sans-serif}main{max-width:960px;margin:auto;padding:30px 22px}h1{font-size:clamp(28px,5vw,42px);line-height:1.15}h2{font-size:20px;color:#82daff}a{color:#82daff}nav{display:flex;gap:20px;flex-wrap:wrap}.intro{background:#202f3d;border-left:3px solid #69cef5;padding:18px;margin:24px 0}.card{border:1px solid #405666;padding:16px;border-radius:10px;margin:14px 0}summary{cursor:pointer;min-height:38px;font-weight:700}.pass{color:#b2ead5}.fail{color:#ffbfaf}.message{padding:12px 16px;margin:14px 0;white-space:pre-wrap;overflow-wrap:anywhere;border-radius:10px;background:#263848}.visitor{background:#142731;margin-left:24px}.matt{border-left:3px solid #69cef5}.who{font-size:12px;color:#82daff;font-weight:700;display:block;margin-bottom:5px}.message p{margin:0}.summary{padding:14px;border:1px solid #69cef5;overflow-wrap:anywhere}.summary p{white-space:pre-wrap}small{color:#b6c8d6}button{font:inherit}#results{margin-top:26px}
</style></head><body><main><small>PSI Performance · Private rehearsal · 9 October 2026</small><h1>20 customer conversations</h1><nav><a href="/website.html">Try Boost</a><a href="/review.html">Pricing and FAQ review</a></nav><div class="intro"><strong>${passed} of ${results.length} conversations passed their checks.</strong><p>These fictional conversations run through the current private engine. Expand one to see exactly how Boost responds. Messages, consent, replies and read times are simulated. Nothing is sent to customers, Shopify or the PSI app.</p><p>Earlier baseline: 4 of 20 met every check. Gaps included short follow ups, remembered vehicle details, phone and website preferences, combined questions and the missing inbox summary.</p></div><section id="results">${results.map(({journey,state,error}, index) => `<details class="card"><summary><span class="${error ? 'fail' : 'pass'}">${error ? 'Needs work' : 'Passed'}</span> · ${index + 1}. ${escape(journey.title)}</summary>${error ? `<p>${escape(error)}</p>` : state.messages.map(message=>`<article class="message ${message.role}"><span class="who">${message.role === 'visitor' ? 'Test customer' : message.role === 'matt' ? 'Matt, test reply' : 'Boost'}</span><p>${escape(message.text)}</p>${message.links.length ? `<small>Links offered: ${message.links.map(key=>escape(key)).join(', ')}</small>` : ''}</article>`).join('')}${state && state.queued ? `<div class="summary"><h2>What Matt receives in the test inbox</h2>${Object.entries(engine.handoffSummary(state)).map(([key,value])=>`<p><strong>${escape(({vehicle:'Vehicle as supplied',year:'Year',work:'Requested work',mileage:'Odometer',details:'Setup and request',needsReview:'Questions for PSI to review',recentMessages:'Recent visitor messages',reason:'Reason',status:'Status'})[key])}</strong><br>${escape(Array.isArray(value) ? value.join('\n') || 'None recorded' : value)}</p>`).join('')}</div>` : ''}</details>`).join('')}</section><h2>What still needs Matt’s input</h2><p>Matt’s service inclusions, scan and labour rates, engine tuning scope, conditional cam guide and business policies are now applied. Supplementary prices, fitting boundaries, listed LS engines, DOD requirements, lubrication and the full service report are now confirmed. Exact entry cam contents and EV pricing remain for individual review. Real Shopify Inbox routing, alerts and launch remain separate work.</p><p>These checks cover the scripted journeys shown here. They do not guarantee every possible phrase, physical phone keyboard behaviour or live delivery.</p></main></body></html>`;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const destination = path.resolve('artifacts/boost-website-test/Boost-conversation-rehearsals.html');
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, buildRehearsalsDocument());
  console.log(JSON.stringify({ path: destination, conversations: journeys.length }));
}
