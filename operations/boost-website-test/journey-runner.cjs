const assert = require('node:assert/strict');
const engine = require('./engine.cjs');
function runJourney(journey) {
  const state = engine.createSession(1000);
  for (const [index, step] of journey.steps.entries()) {
    const label = `${journey.title}, step ${index + 1}: ${step.say || step.view || step.reply}`;
    if (step.say) assert.equal(engine.send(state, step.say, 2000 + index * 1000).ok, true, label);
    if (step.view) engine.view(state, step.view, 2000 + index * 1000);
    if (step.reply) assert.equal(engine.reply(state, step.reply, 2000 + index * 1000).ok, true, label);
    const last = state.messages.at(-1);
    for (const text of step.includes || []) assert.ok(last.text.toLowerCase().includes(text.toLowerCase()), label + '\n' + last.text);
    for (const text of step.excludes || []) assert.ok(!last.text.toLowerCase().includes(text.toLowerCase()), label + '\n' + last.text);
    for (const key of ['pending','work','year']) if (step[key]) assert.equal(state.intake[key], step[key], label);
    if (step.queued !== undefined) assert.equal(state.queued, step.queued, label);
    if (step.visitorLast) assert.equal(last.role, 'visitor', label);
    if (step.links) assert.deepEqual(last.links, step.links, label);
    if (step.noStoreLinks) assert.ok(!last.links.some(link => ['apple','android'].includes(link)), label);
    if (step.staffRead) assert.ok(state.messages.filter(m => m.role === 'matt').every(m => m.readAt !== null), label);
    if (step.summary) {
      const summary = engine.handoffSummary ? JSON.stringify(engine.handoffSummary(state)) : '';
      for (const value of step.summary) assert.ok(summary.includes(value), label + '\nSummary missing ' + value);
    }
  }
  return state;
}
module.exports = { runJourney };
