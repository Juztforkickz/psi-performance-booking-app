const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('./engine.cjs');
const last = s => s.messages.at(-1);
const send = (s, ...messages) => messages.forEach(message => assert.equal(engine.send(s, message).ok, true));

test('technical communication is not a human request, while explicit requests still hand off', () => {
  for (const q of ['Can the ECU talk to the transmission?', 'Does the ECU communicate with the gearbox?']) {
    const s = engine.createSession(); send(s, q);
    assert.equal(s.queued, false); assert.equal(s.intent, 'controller-communication');
  }
  for (const q of ['Speak to Matt', 'Can I talk to a mechanic?', 'Message PSI', 'I need a real person', 'Human please']) {
    const s = engine.createSession(); send(s, q); assert.equal(s.queued, true, q);
  }
  assert.equal(engine.answer('How can I contact PSI?').intent, 'contact');
});

test('a partial dyno answer collects only the missing facts and permits unknowns', () => {
  const s = engine.createSession(); send(s, 'Tune quote for my 2015 Holden Commodore?');
  send(s, '98 fuel'); assert.equal(s.intake.pending, 'setup:transmission');
  send(s, 'Manual'); assert.equal(s.intake.pending, 'setup:modifications');
  send(s, 'Not sure'); assert.equal(s.intake.pending, 'setup:goal'); assert.equal(s.queued, false);
  send(s, 'Better response for weekend driving'); assert.equal(s.intake.pending, 'confirm');
  const draft = engine.enquiryText(s);
  for (const value of ['98 fuel', 'manual', 'Not known, PSI to discuss', 'weekend driving']) assert.ok(draft.includes(value), value);
  assert.equal(s.queued, false); send(s, 'Yes, send it'); assert.equal(s.queued, true);
});

test('known setup is not asked again and future parts or fuel are not treated as fitted', () => {
  const s = engine.createSession();
  send(s, 'Tune quote for my 2015 Holden Commodore?', 'Manual, standard engine, 98 fuel, weekend use');
  assert.equal(s.intake.pending, 'confirm');
  const u = engine.createSession(); send(u, 'Upgrades', 'OTR intake', '2015 Holden Commodore', 'Manual');
  assert.equal(u.intake.pending, 'setup:fuel'); assert.equal(u.intake.setup.modifications, undefined);
  send(u, 'I want to switch to E85'); assert.equal(u.intake.pending, 'setup:fuel');
  assert.equal(u.intake.setup.fuel, undefined);
  send(u, '98'); assert.equal(u.intake.pending, 'setup:modifications');
  send(u, 'I want to add an exhaust'); assert.equal(u.intake.pending, 'setup:modifications');
  send(u, 'Standard'); assert.equal(u.intake.pending, 'goal');
});

test('unlisted gearbox and modification descriptions remain usable without guessing future parts', () => {
  const s = engine.createSession(); send(s, 'Tune quote for my 2015 Holden Commodore?', '98 fuel', 'Tremec TR6060');
  assert.equal(s.intake.pending, 'setup:modifications'); assert.match(s.intake.setup.transmission, /TR6060/);
  send(s, 'Forged pistons, ported heads'); assert.equal(s.intake.pending, 'setup:goal');
  send(s, 'Weekend driving'); assert.equal(s.intake.pending, 'confirm');
  assert.match(engine.enquiryText(s), /Forged pistons/);
  const u = engine.createSession(); send(u, 'Tune quote for my 2015 Holden Commodore?', '98 fuel', 'I want a manual conversion');
  assert.equal(u.intake.pending, 'setup:transmission'); assert.equal(u.intake.setup.transmission, undefined);
  send(u, 'Automatic', "I'd like an exhaust");
  assert.equal(u.intake.pending, 'setup:modifications'); assert.equal(u.intake.setup.modifications, undefined);
  send(u, 'None'); assert.equal(u.intake.pending, 'setup:goal'); assert.equal(u.intake.setup.modifications, 'None');
});

test('a driving goal starts an upgrade discussion without requiring a package choice', () => {
  const s = engine.createSession(); send(s, 'I want better response but still a smooth idle');
  assert.equal(s.intake.work, 'upgrades'); assert.equal(s.intake.pending, 'vehicle');
  assert.match(s.intake.goal, /smooth idle/); assert.doesNotMatch(last(s).text, /\$\d|verified answer/);
  send(s, '2015 Holden Commodore', 'Standard engine, manual, 98 fuel');
  assert.equal(s.intake.pending, 'confirm'); assert.equal(s.queued, false);
  send(s, 'What does a cam upgrade change?'); assert.match(last(s).text, /valves/);
  assert.equal(s.intake.pending, 'confirm');
});

test('timing and budget are optional preferences without booking or quote authority', () => {
  const s = engine.createSession(); send(s, 'Service quote for my 2020 Toyota Corolla with 60000 km?', 'Annual service');
  send(s, 'Review my request'); assert.equal(last(s).copyEnquiry, true);
  send(s, 'Add timing or budget', 'Just researching', 'Skip');
  assert.equal(s.intake.pending, 'confirm'); assert.equal(s.queued, false);
  assert.match(engine.enquiryText(s), /Timing preference: Just researching/);
  assert.match(engine.enquiryText(s), /Not supplied, optional/);
  send(s, 'Add timing or budget', 'Next month', 'AUD 1000');
  assert.match(engine.enquiryText(s), /AUD 1000/); assert.match(engine.enquiryText(s), /not a quote, booking/);
  assert.equal(s.queued, false);
});

test('answered inclusions do not clutter review questions; genuinely unresolved parts remain', () => {
  const s = engine.createSession(); send(s, 'How much is a service? Does it include spark plugs?');
  assert.deepEqual(s.reviewQuestions, []);
  send(s, 'Does the service price cover every EV?');
  assert.deepEqual(s.reviewQuestions, ['Does the service price cover every EV?']);
  send(s, 'What is an OTR?');
  assert.equal(s.reviewQuestions.length, 1);
  const u = engine.createSession(); send(u, 'Can you explain the thing I mentioned earlier?');
  assert.equal(u.reviewQuestions.length, 1);
  send(u, 'I meant what is an OTR?'); assert.match(last(u).text, /Did that answer your earlier question/);
  send(u, 'Yes, that answers it'); assert.deepEqual(u.reviewQuestions, []); assert.equal(u.queued, false);
});

test('copyable draft excludes unrelated conversation, retains needed details and does not hand off', () => {
  const s = engine.createSession(); assert.equal(engine.enquiryText(s), null);
  send(s, 'Hello random conversation marker', 'Service quote for my 2019 Mazda 3 with 70000 km?', 'Annual service');
  send(s, '/summary');
  assert.equal(last(s).copyEnquiry, true); assert.equal(s.queued, false);
  assert.doesNotMatch(engine.enquiryText(s), /random conversation marker/);
  assert.match(engine.enquiryText(s), /2019 Mazda 3|Annual service/);
  const reset = engine.send(s, '/reset').state;
  assert.equal(engine.enquiryText(reset), null);
});

test('unknown individual fields do not immediately force a handoff or loop forever', () => {
  const s = engine.createSession(); send(s, 'Service quote', 'Toyota Corolla', 'Not sure');
  assert.equal(s.intake.pending, 'mileage'); assert.equal(s.queued, false);
  send(s, 'Not sure'); assert.equal(s.intake.pending, 'details');
  send(s, 'Not sure'); assert.equal(s.intake.pending, 'confirm'); assert.equal(s.queued, false);
  const t = engine.createSession(); send(t, 'Tune quote for my 2015 Holden Commodore?', '98 fuel', 'What should I do before bringing it in for a tune?');
  assert.match(last(t).text, /preparation|prepare/i); assert.equal(t.intake.pending, 'setup:transmission');
  send(t, 'My brakes failed'); assert.equal(t.queued, true); assert.equal(t.intent, 'workshop-review');
});
