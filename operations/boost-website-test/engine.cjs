'use strict';

// A deterministic, offline test. This module has no network or account access.
(function (root) {
  const MAX_MESSAGE = 1500;
  const MAX_MESSAGES = 60;
  const GREETING = 'Hi, I’m Boost. What can PSI help you with?';
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
    const result = (intent, reply, handoff = false, collect = null) => ({ intent, reply, handoff, collect });
    if (/\b(ignore|system prompt|instructions|api key|password|secret|bypass)\b/.test(q)) {
      return result('privacy', 'I cannot share private information or change account access. PSI needs to handle this. Your test conversation is in Matt’s inbox.', true);
    }
    if (/\b(invoice|account|refund|subscription|payment|my records|customer|registration)\b/.test(q)) {
      return result('account', 'PSI needs to verify your account before helping with that. Your test conversation is in Matt’s inbox.', true);
    }
    if (/\b(smoke|smoking|sparks|fire|shock|safe to|high voltage|battery pack|rebuild|unsafe|burning)\b/.test(q)) {
      return result('workshop-review', 'That needs PSI’s direct review. I cannot assess vehicle safety or offer battery pack rebuilding. Your test conversation is in Matt’s inbox.', true);
    }
    if (/\b(matt|person|human|someone|message psi|speak|talk)\b/.test(q)) {
      return result('human', 'Sent to Matt’s test inbox. You can add details here while waiting for his reply.', true);
    }
    if (/\b(guarantee|power gain|horsepower|kw|intermittent|fault)\b/.test(q)) {
      return result('quote-or-diagnosis', 'PSI needs to assess the car before confirming a diagnosis, price or power result. Your test conversation is in Matt’s inbox.', true);
    }
    if (/\b(price|cost|how much|quote)\b/.test(q)) {
      return result('quote-or-diagnosis', 'PSI will confirm the price. What work do you need?', false, 'quote');
    }
    const appRequired = /\b(need|require|required|have to|must|without)\b.*\bapp\b/.test(q);
    const bookingGuide = /\b(how|where)\b.*\b(book|booking|appointment|enquire|enquiry)\b/.test(q)
      || /\b(book|enquire)\b.*\b(website|online)\b/.test(q) || appRequired;
    const bookingAction = /\b(confirm|cancel|reschedule|change|my booking|tomorrow|today|deposit)\b/.test(q);
    if (bookingGuide && !bookingAction) {
      return result('booking-guide', appRequired
        ? 'You can enquire on this website without downloading the app. Use Book an appointment, or choose Message PSI here.'
        : 'Use Book an appointment on this website, or choose Message PSI here. PSI will review the work and preferred date before confirming.');
    }
    if (/\b(booking|book|appointment|tomorrow|date|deposit|cancel|reschedule)\b/.test(q) && !/\b(service|servicing|dyno|tuning)\b/.test(q)) {
      return result('booking', 'PSI must confirm or change the booking. Your test conversation is in Matt’s inbox.', true);
    }
    if (/\b(ev|electric|hybrid|hev|phev|bev|tesla|byd|charging)\b/.test(q)) {
      return result('ev', 'Yes, PSI services electric and hybrid vehicles. What car and year is it?', false, 'ev');
    }
    if (/\b(dyno|tuning|tune)\b/.test(q)) {
      return result('dyno', 'PSI can review your setup for dyno tuning. What car and year is it?', false, 'dyno');
    }
    if (/\b(service|servicing|maintenance|inspection)\b/.test(q)) {
      return result('service', 'Use Book an appointment on this website, or choose Message PSI here. Include your vehicle, work needed and preferred date. PSI will confirm availability.');
    }
    if (/\b(address|where|location|pakenham)\b/.test(q)) {
      return result('location', '21 Exchange Drive, Pakenham VIC 3810. Call PSI on 0433 431 781.');
    }
    if (/^(hi|hello|hey|good morning|good afternoon|good evening)\b/.test(q)) return result('welcome', GREETING);
    if (/^(thanks|thank you|cheers)\b/.test(q)) return result('thanks', 'You’re welcome. Anything else I can help with?');
    return result('needs-review', 'PSI needs to answer that. Your test conversation is in Matt’s inbox.', true);
  }
  function newIntake() {
    return { active: false, work: null, vehicle: null, year: null, mileage: null, details: null, pending: null };
  }
  function collectDetails(intake, text) {
    const q = normalise(text);
    const year = q.match(/\b((?:19|20)\d{2})\b/);
    const make = q.match(/\b(audi|bmw|ford|holden|honda|hyundai|kia|mazda|mercedes(?: benz)?|mitsubishi|nissan|porsche|skoda|subaru|suzuki|tesla|toyota|volkswagen|vw|volvo|byd|mg|gwm|lexus|isuzu|jeep|land rover|peugeot|renault|ferrari|lamborghini)\b/);
    const mileage = text.toLowerCase().match(/\b(\d[\d,]*(?:\.\d+)?)\s*(km|kms|kilometres|kilometers|k)\b/);
    if (year) intake.year = year[1];
    if (make) intake.vehicle = text;
    if (mileage) intake.mileage = mileage[0];
    if (/\b(service|servicing|maintenance)\b/.test(q)) intake.work = 'service';
    else if (/\b(dyno|tuning|tune)\b/.test(q)) intake.work = 'dyno';
    else if (!intake.work && /\b(ev|electric|hybrid|hev|phev|bev|charging)\b/.test(q)) intake.work = 'ev';
  }
  function intakePrompt(intake) {
    if (!intake.work) { intake.pending = 'work'; return 'What work would you like quoted?'; }
    if (!intake.vehicle) { intake.pending = 'vehicle'; return 'What car and year is it?'; }
    if (!intake.year) { intake.pending = 'year'; return 'What year is the car?'; }
    if (intake.work === 'service' && !intake.mileage) { intake.pending = 'mileage'; return 'What’s the odometer reading?'; }
    if (intake.work !== 'service' && !intake.details) {
      intake.pending = 'details';
      return intake.work === 'dyno' ? 'What’s the current setup and tuning goal?' : 'What would you like checked or done?';
    }
    intake.pending = 'confirm';
    return 'Thanks. PSI can review these details. Send them to Matt’s test inbox?';
  }
  function continueIntake(state, text, now) {
    const intake = state.intake;
    const q = normalise(text);
    if (intake.pending === 'confirm' && /^(?:(?:yes|yep|yeah|sure|ok|okay)(?: (?:please|send it|send them|go ahead|thanks|thank you))*|send it|send them|please do|go ahead)$/.test(q)) return handoff(state, now);
    if (intake.pending === 'confirm' && /^(no|no thanks|not yet)$/.test(q)) {
      intake.active = false;
      append(state, 'boost', 'No problem. Nothing sent to the test inbox. What else can I help with?', now);
      return { ok: true };
    }
    if (/^(not sure|dont know|i dont know|skip|skip this)$/.test(q)) {
      intake.pending = 'confirm';
      append(state, 'boost', 'No problem. Send the details you have to Matt’s test inbox?', now);
      return { ok: true };
    }
    collectDetails(intake, text);
    if (intake.pending === 'work' && !intake.work) intake.work = text;
    if (intake.pending === 'vehicle' && !intake.vehicle && !text.includes('?')) intake.vehicle = text;
    if (intake.pending === 'mileage' && /^\d[\d,]*$/.test(text)) intake.mileage = text + ' km';
    if (intake.pending === 'details') intake.details = text;
    append(state, 'boost', intakePrompt(intake), now);
    return { ok: true };
  }
  function createSession(now = Date.now()) {
    return { version: 2, mode: 'customer', open: true, ticket: 'PREVIEW 001', queued: false, closed: false, intent: 'welcome', intake: newIntake(), notice: '', messages: [{ id: 1, role: 'boost', text: GREETING, at: now, readAt: null }] };
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
      state.notice = 'Added to Matt’s test inbox. Waiting for PSI to reply.';
      return { ok: true };
    }
    const response = answer(message);
    // Explicit safety, account and human requests always take priority over intake.
    const directQuestion = message.includes('?') || /^(what|where|how|do|does|can|is|are|when)\b/.test(normalise(message));
    if (state.intake.active && !['privacy', 'account', 'workshop-review', 'human', 'booking', 'quote-or-diagnosis'].includes(response.intent)) {
      if (!directQuestion) return continueIntake(state, message, now + 1);
      if (response.intent === 'needs-review') {
        const earlier = JSON.stringify(state.intake);
        collectDetails(state.intake, message);
        if (JSON.stringify(state.intake) !== earlier) return continueIntake(state, message, now + 1);
        append(state, 'boost', 'PSI needs to confirm that. Choose Message PSI to ask Matt.', now + 1);
        return { ok: true };
      }
    }
    if (response.collect) {
      if (!state.intake.active) state.intake = newIntake();
      state.intake.active = true;
      collectDetails(state.intake, message);
      if (response.collect !== 'quote') state.intake.work = response.collect;
      state.intent = response.intent;
      const intro = response.collect === 'quote' ? 'PSI will confirm the price. ' : response.collect === 'ev' ? 'Yes, PSI services electric and hybrid vehicles. ' : 'PSI can review your setup for dyno tuning. ';
      append(state, 'boost', intro + intakePrompt(state.intake), now + 1);
      return { ok: true };
    }
    state.intent = response.intent;
    state.queued = response.handoff;
    if (response.handoff) state.intake.active = false;
    append(state, 'boost', response.reply, now + 1);
    if (response.handoff) state.notice = 'Waiting for PSI to reply in the test inbox.';
    return { ok: true };
  }
  function handoff(state, now = Date.now()) {
    if (state.closed) return { ok: false, error: 'Reopen this test conversation first.' };
    if (state.queued) return { ok: true };
    state.queued = true;
    state.intake.active = false;
    state.intent = 'human';
    append(state, 'boost', 'Sent to Matt’s test inbox. You can add details here while waiting for his reply.', now);
    state.notice = 'Waiting for PSI to reply in the test inbox.';
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
