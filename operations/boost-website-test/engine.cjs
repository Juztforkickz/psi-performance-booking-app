'use strict';

// A deterministic, offline test. This module has no network or account access.
(function (root) {
  const MAX_MESSAGE = 1500;
  const MAX_MESSAGES = 60;
  const GREETING = "Hi, I’m Boost, PSI’s workshop helper. Ask about servicing or dyno tuning, or choose Message PSI to try a conversation with Matt.";
  const HELP = 'Test commands: /service, /dyno, /ev, /booking, /hard, /human, /help and /reset. Replies are draft FAQ wording. Messages and read times are simulated.';
  const SAMPLES = Object.freeze({
    '/service': 'What happens when I book a service?',
    '/dyno': 'What do you need to know before dyno tuning?',
    '/ev': 'Do you service electric and hybrid cars?',
    '/booking': 'Can you confirm my booking for tomorrow?',
    '/hard': 'My modified car has an intermittent fault. Can you guarantee the fix, price and power gain?',
  });
  function normalise(value) {
    return value.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9/\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function answer(text) {
    const q = normalise(text);
    const result = (intent, reply, handoff = false) => ({ intent, reply, handoff });
    if (/\b(ignore|system prompt|instructions|api key|password|secret|bypass)\b/.test(q)) {
      return result('privacy', 'I cannot reveal private information, change account access or bypass workshop checks. Choose Message PSI for a question about your own account.', true);
    }
    if (/\b(invoice|account|refund|subscription|payment|my records|customer|registration)\b/.test(q)) {
      return result('account', 'PSI needs to verify your identity before discussing account details, invoices or payments. This test cannot access any customer records. I can put a test message in Matt’s simulated inbox.', true);
    }
    if (/\b(smoke|smoking|sparks|fire|shock|safe to|high voltage|battery pack|rebuild|unsafe|burning)\b/.test(q)) {
      return result('workshop-review', 'PSI needs to review that directly. I cannot diagnose a fault remotely, confirm that a vehicle is safe to drive or charge, or promise battery pack rebuilding. Choose Message PSI to try a workshop handoff.', true);
    }
    if (/\b(matt|person|human|someone|message psi|speak|talk)\b/.test(q)) {
      return result('human', 'I’ve placed this conversation in the simulated PSI inbox. Switch to Matt’s test inbox to see it and send a test reply. No real message or alert has been sent.', true);
    }
    if (/\b(price|cost|how much|quote|guarantee|power gain|horsepower|kw|intermittent|fault|modified)\b/.test(q)) {
      return result('quote-or-diagnosis', 'The right scope and price depend on your vehicle, current setup and what you need. PSI must review those details before confirming a quote or outcome. What car do you have, and what would you like checked or changed?', true);
    }
    if (/\b(booking|book|appointment|tomorrow|date|deposit|cancel|reschedule)\b/.test(q) && !/\b(service|servicing|dyno|tuning)\b/.test(q)) {
      return result('booking', 'PSI reviews preferred dates before confirming a booking or requesting a deposit. Boost cannot confirm or change a booking in this test. Tell me the vehicle and preferred date, and try a message to PSI.', true);
    }
    if (/\b(ev|electric|hybrid|hev|phev|bev|tesla|byd|charging)\b/.test(q)) {
      return result('ev', 'PSI’s EV and Hybrid options include servicing, diagnostics, inspections, brakes, suspension, tyres, cooling, 12V electrical work and vehicle charging concerns. Tell PSI your vehicle and what you need checked. Battery pack rebuilding is outside this initial offering.');
    }
    if (/\b(dyno|tuning|tune)\b/.test(q)) {
      return result('dyno', 'For a dyno enquiry, start with your car, engine, current modifications, fuel and goal. PSI reviews the setup before confirming the work and preferred date. I cannot promise a power figure or quote from chat alone.');
    }
    if (/\b(service|servicing|maintenance|inspection)\b/.test(q)) {
      return result('service', 'Choose Service & Report, select your vehicle and powertrain, then the relevant service options and preferred date. PSI reviews the request before confirming the work or asking for a deposit.');
    }
    if (/\b(address|where|location|pakenham)\b/.test(q)) {
      return result('location', 'PSI Performance is at 21 Exchange Drive, Pakenham VIC 3810. Workshop contact: 0433 431 781.');
    }
    return result('needs-review', 'That needs a reply from PSI rather than a guessed answer. Tell me your vehicle and what you would like help with, or choose Message PSI to try the handoff.', true);
  }
  function createSession(now = Date.now()) {
    return { version: 1, mode: 'customer', open: true, ticket: 'PREVIEW 001', queued: false, closed: false, intent: 'welcome', notice: '', messages: [{ id: 1, role: 'boost', text: GREETING, at: now, readAt: null }] };
  }
  function append(state, role, text, now) {
    state.messages.push({ id: state.messages.length ? state.messages[state.messages.length - 1].id + 1 : 1, role, text, at: now, readAt: null });
    state.messages = state.messages.slice(-MAX_MESSAGES);
  }
  function send(state, raw, now = Date.now()) {
    const text = String(raw).trim();
    if (!text) return { ok: false, error: 'Write a test message first.' };
    if (text.length > MAX_MESSAGE) return { ok: false, error: `Keep this test message within ${MAX_MESSAGE} characters.` };
    if (text.toLowerCase() === '/reset') return { ok: true, reset: true, state: createSession(now) };
    if (state.closed) return { ok: false, error: 'Reopen this test conversation before sending.' };
    if (text.toLowerCase() === '/help') {
      append(state, 'boost', HELP, now);
      return { ok: true };
    }
    if (text.startsWith('/') && text.toLowerCase() !== '/human' && !SAMPLES[text.toLowerCase()]) {
      append(state, 'boost', 'That test command is not recognised. ' + HELP, now);
      return { ok: true };
    }
    const message = text.toLowerCase() === '/human' ? 'I would like to message PSI.' : (SAMPLES[text.toLowerCase()] || text);
    append(state, 'visitor', message, now);
    // Once handed to a person, additional visitor messages do not restart automatic replies.
    if (state.queued) {
      state.intent = 'human';
      state.notice = 'New test message in Matt’s inbox. No real alert sent.';
      return { ok: true };
    }
    const response = answer(message);
    state.intent = response.intent;
    state.queued = response.handoff;
    append(state, 'boost', response.reply, now + 1);
    if (response.handoff) state.notice = 'Test handoff ready in Matt’s inbox. No real alert sent.';
    return { ok: true };
  }
  function handoff(state, now = Date.now()) {
    if (state.closed) return { ok: false, error: 'Reopen this test conversation first.' };
    if (state.queued) return { ok: true };
    state.queued = true;
    state.intent = 'human';
    append(state, 'boost', 'This conversation is now in the simulated PSI inbox. Matt can reply from the test inbox view. No real message or alert has been sent.', now);
    state.notice = 'Test handoff ready in Matt’s inbox. No real alert sent.';
    return { ok: true };
  }
  function view(state, mode, now = Date.now()) {
    if (!['customer', 'inbox'].includes(mode)) return;
    state.mode = mode;
    if (mode === 'inbox' && state.queued) {
      state.messages.filter(m => m.role === 'visitor' && m.readAt === null).forEach(m => { m.readAt = now; });
    }
    if (mode === 'customer') {
      state.messages.filter(m => m.role === 'matt' && m.readAt === null).forEach(m => { m.readAt = now; });
    }
    state.notice = '';
  }
  function reply(state, raw, now = Date.now()) {
    const text = String(raw).trim();
    if (!state.queued || state.mode !== 'inbox' || state.closed) return { ok: false, error: 'Open an active test handoff in Matt’s inbox first.' };
    if (!text || text.length > MAX_MESSAGE) return { ok: false, error: `Write a reply within ${MAX_MESSAGE} characters.` };
    append(state, 'matt', text, now);
    state.notice = 'Test reply ready for the visitor. No real alert or email sent.';
    return { ok: true };
  }
  const api = Object.freeze({ MAX_MESSAGE, MAX_MESSAGES, GREETING, HELP, SAMPLES, answer, createSession, send, handoff, view, reply });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BoostWebsiteTest = api;
})(typeof window === 'object' ? window : globalThis);
