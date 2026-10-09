const test = require('node:test');
const { runJourney } = require('./journey-runner.cjs');
const journeys = require('./journeys.cjs');
for (const journey of journeys) test('journey: ' + journey.title, () => { runJourney(journey); });
