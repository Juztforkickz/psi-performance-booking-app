'use strict';
// Deterministic private rehearsal. No network, account access or external writes.
(function (root) {
  const knowledge = typeof module === 'object' && module.exports ? require('./knowledge.cjs') : root.BoostKnowledge;
  const { normalise } = knowledge;
  const MAX_MESSAGE = 1500, MAX_MESSAGES = 60;
  const GREETING = 'Hi, I’m Boost. I can help with PSI services, the app or a booking request. What do you need?';
  const HELP = 'Try /service, /dyno, /ev, /app, /signup, /booking, /quote, /hard, /human or /reset. Messages and read times are simulated.';
  const SAMPLES = Object.freeze({
    '/service': 'What does Service & Report cover?', '/dyno': 'What details do I need for tuning?',
    '/ev': 'Do you service electric and hybrid cars?', '/app': 'Where can I download the PSI app?',
    '/signup': 'Guide me through account setup', '/booking': 'Guide me through a booking',
    '/quote': 'I need a quote', '/hard': 'Can you guarantee the fix, price and power gain?',
  });
  const GUIDES = Object.freeze({
    signup: [
      'Open PSI Performance Garage on your phone, then open Account. Need the app first? Use the store link below.',
      'Enter your email and tap Email my sign-in code. Use the same email if you already have a PSI account.',
      'Open your email, then enter the newest six digit code in the PSI app. Tap Verify and sign in. Never paste your code into this chat.',
      'For a new account, add your first and last name, mobile, registration, vehicle year, make and model. The vehicle photo is optional.',
      'Tap Save account details, then Open My Garage. Your app will show whether it saved successfully. You can now start a booking request.',
    ],
    booking: [
      'Sign in to the PSI app and save your vehicle. Then open Bookings and tap Book ahead.',
      'Choose Service & Report for servicing, repairs or diagnostics, or Dyno Tuning for tuning. Select your saved vehicle.',
      'Complete Job and Setup. For servicing, select your powertrain and relevant work. Describe your concern. If you do not know the modifications, choose the PSI inspection option.',
      'Check Contact, then complete Timing. Choose your preferred date or I’m flexible, and request any arrival arrangement you need.',
      'Review the details and tap Submit request for PSI review in the app. This sends a request, not a confirmed booking. Follow PSI’s reply and any approved deposit instructions.',
    ],
  });
  const result = (intent, reply, extra = {}) => ({ intent, reply, handoff: false, prompts: [], links: [], sources: [], ...extra });
  const toFAQ = item => result(item.id, item.reply, { prompts: item.prompts, links: item.links, sources: item.sources });
  function answer(text) {
    const q = normalise(text);
    // General account help is public. Private access and actions need PSI.
    if (/\b(ignore.*instructions|system prompt|api key|secret key|bypass|other customers|all customers|database|access token)\b/.test(q)) return result('privacy', 'I cannot disclose private information or change access. PSI must review this. The conversation is in Matt’s test inbox.', { handoff: true });
    if (/\b(smoking|sparks|on fire|burning smell|electric shock|safe to (?:drive|charge)|is it safe|brakes (?:failed|not working)|brake failure|overheating)\b/.test(q) || /\b(how|tell me how|steps)\b.*\b(open|isolate|disconnect|repair)\b.*\b(high voltage|hv battery|battery pack)\b/.test(q)) return result('workshop-review', 'I cannot assess safety remotely. Do not drive, charge or work on a vehicle you suspect is unsafe. If there is immediate danger, move away and call 000. This test cannot alert PSI or emergency services.', { handoff: true });
    const recordsGuide = /\b(where|how)\b.*\b(find|see|view|open)\b.*\b(invoice|records|photos|history)\b/.test(q);
    if ((!recordsGuide && /\b(show|send|get|open|download|find|check)\b.*\b(invoice|my records|customer record|account balance)\b/.test(q)) || /\b(refund|charged twice|paid twice|cant access my email|cannot access my email|my.*(?:record|invoice|vehicle).*missing|change my (?:account|email)|delete my account|verify my (?:payment|transfer)|mark.*paid|link.*account)\b/.test(q)) return result('account', 'PSI needs to verify the account and vehicle before checking that. The conversation is in Matt’s test inbox. Do not share passwords, sign in codes or card details here.', { handoff: true });
    if (/\b(are you a real person|are you.*bot|who are you|what can you do)\b/.test(q)) return toFAQ(knowledge.BY_ID.bot);
    if (/\b(want|need|speak to|talk to)\b.*\b(real person)\b/.test(q)) return result('human', 'Sent to Matt’s test inbox. You can add details here while waiting for his test reply.', { handoff: true });
    if (/\b(message psi|speak to|talk to|talk with|human|speak with|contact matt|message matt)\b/.test(q) || /^matt$/.test(q)) return result('human', 'Sent to Matt’s test inbox. You can add details here while waiting for his test reply.', { handoff: true });
    if (/\b(confirm|cancel|reschedule|change)\b.*\b(my booking|my appointment|booking date|booking for|appointment for)\b/.test(q) || /\b(cancel|reschedule|change)\b.*\b(booking|appointment)\b/.test(q) || /\b(can you confirm|is my booking confirmed)\b/.test(q)) return result('booking-action', 'PSI must check or change the actual booking. The conversation is in Matt’s test inbox. No booking has been changed by this preview.', { handoff: true });
    if (/\b(guarantee|guaranteed|promise)\b/.test(q)) return result('assessment', 'PSI needs to assess the car before confirming a diagnosis, price or expected result. Boost cannot guarantee a fix or power gain.', { prompts: ['I need a quote', 'Message PSI'] });
    if (/\b(guide me|step by step|walk me through)\b.*\b(account|sign up|signup)\b/.test(q)) return result('signup', '', { guide: 'signup' });
    if (/\b(guide me|step by step|walk me through)\b.*\b(book|booking)\b/.test(q)) return result('booking', '', { guide: 'booking' });
    const item = knowledge.match(q);
    if (item) return toFAQ(item);
    if (knowledge.isPricing(q)) return result('quote', quoteIntro(workFrom(text)), { collect: true });
    if (/^(hi|hello|hey|good morning|good afternoon|good evening)\b/.test(q)) return result('welcome', GREETING, { prompts: ['How do I book?', 'I need a quote', 'Where can I download the PSI app?'] });
    if (/^(thanks|thank you|cheers)\b/.test(q)) return result('thanks', 'You’re welcome. Anything else I can help with?');
    return result('needs-review', 'I do not have a verified answer for that yet. Choose Message PSI to ask Matt, or tell me whether it is about a vehicle, the app or a booking.', { prompts: ['Message PSI', 'How do I book?', 'I need a quote'] });
  }
  function newIntake() { return { active: false, work: null, vehicle: null, year: null, mileage: null, details: null, pending: null }; }
  function quoteIntro(work) { return knowledge.PRICE_GUIDES[work] || 'PSI will confirm the price.'; }
  function workFrom(text) {
    const q = normalise(text);
    for (const [work, pattern] of [
      ['coding', /\b(coding|carplay|mbux)\b/], ['cam', /\b(cam|camshaft|lifters|dod|afm)\b/],
      ['engine build', /\b(engine build|engine rebuild|stroker)\b/], ['cooling upgrade', /\b(interchiller|water meth|water methanol)\b/],
      ['forced induction', /\b(supercharger|turbo kit|turbo upgrade|whipple|harrop)\b/], ['exhaust', /\b(exhaust|headers|varex|cat back|downpipe)\b/],
      ['brakes or suspension', /\b(brakes|suspension|alignment|coilovers|tyres)\b/], ['parts', /\b(parts|part|intake|otr)\b/],
      ['specific tuning', /\b(ecu|tcu|tcm|transmission tun\w*|gearbox tun\w*|power runs?|health check)\b/],
      ['service', /\b(service|servicing|maintenance|logbook)\b/], ['dyno', /\b(dyno|tuning|tune)\b/],
      ['EV check', /\b(ev|electric|hybrid|charging|hev|phev|bev)\b/], ['diagnostics', /\b(diagnostics|fault|warning|misfire)\b/],
    ]) if (pattern.test(q)) return work;
    return null;
  }
  const topicWork = { service: 'service', logbook: 'service', 'service-inclusions': 'service', dyno: 'dyno', 'dyno-details': 'dyno', 'ecu-tcu': 'specific tuning', ev: 'EV check', 'ev-scope': 'EV check', charging: 'EV check', cam: 'cam', exhaust: 'exhaust', 'forced-induction': 'forced induction', interchiller: 'cooling upgrade', 'engine-build': 'engine build', coding: 'coding', brakes: 'brakes or suspension', fitment: 'parts', diagnostics: 'diagnostics' };
  function collectDetails(intake, text) {
    const q = normalise(text), year = q.match(/\b((?:19|20)\d{2})\b/);
    const make = q.match(/\b(audi|bmw|ford|holden|honda|hyundai|kia|mazda|mercedes(?: benz)?|mitsubishi|nissan|porsche|skoda|subaru|suzuki|tesla|toyota|volkswagen|vw|volvo|byd|mg|gwm|lexus|isuzu|jeep|land rover|peugeot|renault|ferrari|lamborghini|polestar|cupra|chery|mini)\b/);
    const mileage = text.toLowerCase().match(/\b(\d[\d,]*(?:\.\d+)?)\s*(km|kms|kilometres|kilometers|k)\b/);
    if (year) intake.year = year[1];
    if (make) intake.vehicle = text;
    if (mileage) intake.mileage = mileage[0];
    if (!intake.work) intake.work = workFrom(text);
  }
  function intakePrompt(intake) {
    if (!intake.work) { intake.pending = 'work'; return 'What work would you like quoted?'; }
    if (!intake.vehicle) { intake.pending = 'vehicle'; return 'What car, engine and year is it?'; }
    if (!intake.year) { intake.pending = 'year'; return 'What year is the car?'; }
    if (intake.work === 'service' && !intake.mileage) { intake.pending = 'mileage'; return 'What’s the odometer reading?'; }
    if (!intake.details) {
      intake.pending = 'details';
      return ({ service: 'Which service is due, or is there a particular concern?',
        dyno: 'What’s the current setup, transmission, fuel and tuning goal? Include whether you want engine tuning, transmission tuning or both.',
        'specific tuning': 'What exact tuning or testing work do you need, and what engine, transmission, fuel and modifications does the car have?',
        cam: 'What engine, transmission and current setup do you have, and what driving result are you after?',
        exhaust: 'Do you want a rear section, headers or a full system, and supply only or fitted? Include any product link and whether tuning is needed.',
        parts: 'Which product or part number do you need, and is it supply only or fitted?',
        coding: 'Which exact feature do you want enabled or changed?',
        'brakes or suspension': 'Is it a repair or upgrade? Include the symptom or proposed parts and whether you need fitting and alignment.',
        'engine build': 'What is the current engine condition and setup, intended use and goal?',
        'forced induction': 'What engine, transmission, fuel and current setup do you have, and is there a kit or goal in mind?',
        'cooling upgrade': 'What blower or turbo and cooling setup do you have, and do you need supply only or a complete installation?',
        diagnostics: 'What happens, when does it happen, and what has already been checked or replaced?',
        'EV check': 'What would you like checked? Include any warning message or what happens while charging.',
      })[intake.work] || 'What would you like done, and what is the current setup or concern?';
    }
    intake.pending = 'confirm';
    return 'Thanks. PSI has enough context to review the request, but no price or date is confirmed. Send these details to Matt’s test inbox?';
  }
  function append(state, role, text, now, meta = {}) {
    state.messages.push({ id: state.messages.length ? state.messages.at(-1).id + 1 : 1, role, text, at: now, readAt: null,
      prompts: role === 'boost' ? [...(meta.prompts || [])].slice(0, 3) : [],
      links: role === 'boost' ? (meta.links || []).filter(key => Object.hasOwn(knowledge.LINKS, key)) : [],
      sources: role === 'boost' ? (meta.sources || []).filter(key => Object.hasOwn(knowledge.SOURCES, key)) : [] });
    state.messages = state.messages.slice(-MAX_MESSAGES);
  }
  function promptIntake(state, now, intro = '') {
    append(state, 'boost', intro + intakePrompt(state.intake), now, { prompts: state.intake.pending === 'confirm' ? ['Yes, send it', 'Not yet'] : ['Not sure', 'Message PSI'] });
  }
  function continueIntake(state, text, now) {
    const intake = state.intake, q = normalise(text);
    if (intake.pending === 'confirm' && /^(?:(?:yes|yep|yeah|sure|ok|okay)(?: (?:please|send it|send them|go ahead|thanks|thank you))*|send it|send them|please do|go ahead)$/.test(q)) return handoff(state, now);
    if (intake.pending === 'confirm' && /^(no|no thanks|not yet)$/.test(q)) {
      intake.active = false; append(state, 'boost', 'No problem. Nothing sent to the test inbox. What else can I help with?', now); return { ok: true };
    }
    if (/^(not sure|dont know|i dont know|skip|skip this)$/.test(q)) {
      intake.pending = 'confirm'; append(state, 'boost', 'No problem. Send the details you have to Matt’s test inbox?', now, { prompts: ['Yes, send it', 'Not yet'] }); return { ok: true };
    }
    collectDetails(intake, text);
    if (intake.pending === 'work' && !intake.work) intake.work = text;
    if (intake.pending === 'vehicle' && !intake.vehicle && !text.includes('?')) intake.vehicle = text;
    if (intake.pending === 'mileage' && /^\d[\d,]*$/.test(text)) intake.mileage = text + ' km';
    if (intake.pending === 'details') intake.details = text;
    promptIntake(state, now); return { ok: true };
  }
  function showGuide(state, now) {
    const { topic, step } = state.guide, steps = GUIDES[topic], last = step === steps.length - 1;
    append(state, 'boost', `Step ${step + 1} of ${steps.length}\n${steps[step]}`, now, {
      prompts: last ? ['Finish guide', 'Previous step'] : step ? ['Next step', 'Previous step', 'Stop guide'] : ['Next step', 'Stop guide'],
      links: topic === 'signup' && step === 0 ? ['apple', 'android'] : [], sources: [topic === 'signup' ? 'account' : 'booking'],
    });
  }
  function createSession(now = Date.now()) {
    const state = { version: 3, mode: 'customer', open: true, ticket: 'PREVIEW 001', queued: false, closed: false, intent: 'welcome', topic: null, guide: null, intake: newIntake(), notice: '', messages: [] };
    append(state, 'boost', GREETING, now); return state;
  }
  function send(state, raw, now = Date.now()) {
    const text = String(raw).trim();
    if (!text) return { ok: false, error: 'Write a test message first.' };
    if (text.length > MAX_MESSAGE) return { ok: false, error: `Keep this test message within ${MAX_MESSAGE} characters.` };
    if (text.toLowerCase() === '/reset') return { ok: true, reset: true, state: createSession(now) };
    if (state.closed) return { ok: false, error: 'Reopen this test conversation before sending.' };
    if (text.toLowerCase() === '/help') { append(state, 'boost', HELP, now); return { ok: true }; }
    if (text.startsWith('/') && text.toLowerCase() !== '/human' && !SAMPLES[text.toLowerCase()]) { append(state, 'boost', 'That test command is not recognised. ' + HELP, now); return { ok: true }; }
    const message = text.toLowerCase() === '/human' ? 'Message PSI' : (SAMPLES[text.toLowerCase()] || text), q = normalise(message);
    append(state, 'visitor', message, now);
    if (state.queued) { state.notice = 'Added to Matt’s test inbox. Waiting for PSI to reply.'; return { ok: true }; }
    let response = answer(message);
    if (response.collect && ['plus','plus-price','trial'].includes(state.topic) && /^(how much|what does it cost|what is the price|price)$/.test(q)) response = toFAQ(knowledge.BY_ID['plus-price']);
    if (response.handoff) {
      state.queued = true; state.intake.active = false; state.guide = null; state.intent = response.intent;
      append(state, 'boost', response.reply, now + 1, response); state.notice = 'Waiting for PSI to reply in the test inbox.'; return { ok: true };
    }
    if (/^(stop guide|finish guide|stop quote|start over)$/.test(q)) {
      state.guide = null; state.intake = newIntake(); append(state, 'boost', 'We’ve stopped the guide. Nothing was submitted here. What else can I help with?', now + 1, { prompts: ['How do I book?', 'I need a quote'] }); return { ok: true };
    }
    if (q === 'resume quote' && state.intake.active) { promptIntake(state, now + 1); return { ok: true }; }
    if (q === 'resume guide' && state.guide) { showGuide(state, now + 1); return { ok: true }; }
    if (state.guide && /^(next|next step|done|continue|previous|previous step|back)$/.test(q)) {
      const backwards = /^(previous|previous step|back)$/.test(q);
      state.guide.step = Math.max(0, Math.min(GUIDES[state.guide.topic].length - 1, state.guide.step + (backwards ? -1 : 1))); showGuide(state, now + 1); return { ok: true };
    }
    if (response.guide) { state.guide = { topic: response.guide, step: 0 }; state.intake.active = false; state.intent = response.intent; showGuide(state, now + 1); return { ok: true }; }
    const directQuestion = message.includes('?') || /^(what|where|how|do|does|can|is|are|when|will|why)\b/.test(q);
    const helpStatement = ['welcome','thanks','download','iphone','android','installed','signup','signin','password','code-help','free','plus','plus-price','trial','restore','subscription-manage','records-guide','website-enquiry','location','hours','contact','bot','message-delivery'].includes(response.intent);
    if (state.intake.active && !response.collect && !directQuestion && !helpStatement) return continueIntake(state, message, now + 1);
    if (response.collect) {
      if (!state.intake.active) state.intake = newIntake();
      state.intake.active = true; collectDetails(state.intake, message);
      if (!state.intake.work) state.intake.work = topicWork[state.topic] || null;
      state.intent = 'quote'; state.guide = null; promptIntake(state, now + 1, quoteIntro(state.intake.work) + ' '); return { ok: true };
    }
    state.intent = response.intent;
    if (knowledge.BY_ID[response.intent]) state.topic = response.intent;
    const meta = { ...response };
    if (state.intake.active) meta.prompts = ['Resume quote', 'Message PSI'];
    else if (state.guide) meta.prompts = ['Resume guide', 'Stop guide'];
    append(state, 'boost', response.reply, now + 1, meta); return { ok: true };
  }
  function handoff(state, now = Date.now()) {
    if (state.closed) return { ok: false, error: 'Reopen this test conversation first.' };
    if (state.queued) return { ok: true };
    state.queued = true; state.intake.active = false; state.guide = null; state.intent = 'human';
    append(state, 'boost', 'Sent to Matt’s test inbox. You can add details here while waiting for his test reply.', now);
    state.notice = 'Waiting for PSI to reply in the test inbox.'; return { ok: true };
  }
  function view(state, mode, now = Date.now()) {
    if (!['customer', 'inbox'].includes(mode)) return;
    state.mode = mode;
    if (mode === 'inbox' && state.queued) state.messages.filter(m => m.role === 'visitor' && m.readAt === null).forEach(m => { m.readAt = now; });
    if (mode === 'customer') state.messages.filter(m => m.role === 'matt' && m.readAt === null).forEach(m => { m.readAt = now; });
    state.notice = '';
  }
  function reply(state, raw, now = Date.now()) {
    const text = String(raw).trim();
    if (!state.queued || state.mode !== 'inbox' || state.closed) return { ok: false, error: 'Open an active test handoff in Matt’s inbox first.' };
    if (!text || text.length > MAX_MESSAGE) return { ok: false, error: `Write a reply within ${MAX_MESSAGE} characters.` };
    append(state, 'matt', text, now); state.notice = 'Test reply ready for the visitor. No real alert or email sent.'; return { ok: true };
  }
  const api = Object.freeze({ MAX_MESSAGE, MAX_MESSAGES, GREETING, HELP, SAMPLES, GUIDES, answer, createSession, send, handoff, view, reply });
  if (typeof module === 'object' && module.exports) module.exports = api; else root.BoostWebsiteTest = api;
})(typeof window === 'object' ? window : globalThis);
