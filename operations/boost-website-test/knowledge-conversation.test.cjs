const test = require('node:test');
const assert = require('node:assert/strict');
const knowledge = require('./knowledge.cjs');
const match = message => knowledge.match(knowledge.normalise(message));

test('plain language upgrade questions answer the topic without becoming package quotes', () => {
  const questions = {
    'otr-explained': ['What is an OTR?', 'What does OTR mean?', 'Explain OTR'],
    'cam-explained': ['What does a cam upgrade change?', 'What is a camshaft?', 'How does a cam affect idle?', 'Can a cam have a smooth idle?'],
    'dod-explained': ['What is DOD?', 'What does AFM do?', 'Explain active fuel management'],
    'transmission-explained': ['Why might transmission tuning be needed?', 'Do I need transmission tuning?', 'What does a trans tune do?'],
    'controller-communication': ['Can the ECU talk to the transmission?', 'Does the TCM communicate with the ECU?', 'Can the ECU and gearbox talk to each other?'],
    'tune-preparation': ['How should I prepare for a dyno tune?', 'What should I bring before tuning?', 'Before my dyno tune what do I need?'],
  };
  for (const [id, messages] of Object.entries(questions)) {
    for (const message of messages) {
      assert.equal(match(message)?.id, id, message);
      assert.doesNotMatch(match(message).reply, /AUD|\$|\d+\s*(?:kw|hp)/i, message);
    }
  }
});

test('OTR and cam comparisons ask about the combination without claiming one universal first step', () => {
  for (const message of ['OTR or cam first?', 'Should I start with a cam or OTR?', 'Cam vs OTR', 'Compare an intake and cam upgrade', 'Which is better a cam or intake?']) {
    const result = match(message);
    assert.equal(result?.id, 'upgrade-comparison', message);
    assert.match(result.reply, /starting point and goals/);
    assert.match(result.reply, /car, engine, transmission and existing modifications/);
    assert.doesNotMatch(result.reply, /AUD|\$|always|guarantee/i);
  }
});

test('definition matching preserves existing price and mandatory scope paths', () => {
  for (const message of ['What does an OTR and tune cost?', 'What does a cam cost?', 'How much is a DOD delete?', 'What does transmission tuning cost?']) {
    assert.equal(match(message), null, message);
  }
  assert.equal(match('Does a cam upgrade need a DOD delete?')?.id, 'dod-delete');
  assert.equal(match('What does the cam package include?')?.id, 'cam-inclusions');
  assert.equal(match('What details do I need for tuning?')?.id, 'dyno-details');
});

test('technical definitions retain primary attribution and bounded preparation guidance', () => {
  for (const id of ['otr-explained','cam-explained','dod-explained','controller-communication','transmission-explained','upgrade-comparison','tune-preparation']) {
    const item = knowledge.BY_ID[id];
    assert.ok(item.sources.every(source => knowledge.SOURCES[source]), id);
  }
  for (const source of ['otrDefinition','camDefinition','afmDefinition','controllerDefinition']) {
    assert.match(knowledge.SOURCES[source], /https:\/\//, source);
  }
  const prep = knowledge.BY_ID['tune-preparation'].reply;
  assert.match(prep, /warning lights, running problems or recent repairs/);
  assert.match(prep, /PSI to confirm the preparation/);
  assert.doesNotMatch(prep, /full tank|half tank|98 RON|fuel level|disconnect|clear.*codes/i);
});
