/* deepreport.js — payload builder + report sanitizer. */
'use strict';

var DR = require('../js/deepreport.js');
var A = require('../js/analysis.js');
var SC = require('../js/scoring.js');
var FS = require('../js/faceshape.js');
var F = require('./fixtures/face.js');
var t = require('../test/_assert.js').suite('DEEPREPORT');

// ---- payload builder on a real pipeline result ----
var m = A.analyze(F.balancedFace(), 1000, 1000);
var scores = SC.score(m, { score: 90, confidence: 'low', underEye: { delta: 0.05, flagged: false }, redness: { index: 0.01, flagged: false } }, 'high');
var shape = FS.classify(m.shapeInput);
var skin = { underEye: { delta: 0.05, flagged: false }, redness: { index: 0.01, flagged: false }, score: 90 };

var payload = DR.buildDeepPayload(m, scores, shape, skin);
t.ok(payload.composite >= 0 && payload.composite <= 100, 'payload carries composite');
t.eq(payload.confidence, 'high', 'payload carries confidence');
t.ok(payload.features && payload.features.symmetry && typeof payload.features.symmetry.score === 'number', 'per-feature scores present');
t.ok(payload.faceShape && payload.faceShape.shape, 'face shape present');
t.ok(payload.skin && typeof payload.skin.underEyeDelta === 'number', 'skin signals present');
t.near(payload.thirds.upper + payload.thirds.middle + payload.thirds.lower, 1, 0.01, 'thirds sum ~1');
var size = JSON.stringify(payload).length;
t.ok(size < 4000, 'payload stays compact (' + size + ' bytes)');
// no raw landmark/pixel data leaks into the payload
t.ok(!('corrected' in payload) && !('pxOriginal' in payload), 'no landmark arrays in payload');

// ---- graceful with missing pieces ----
var sparse = DR.buildDeepPayload(m, scores, null, null);
t.eq(sparse.faceShape, null, 'null face shape tolerated');
t.eq(sparse.skin, null, 'null skin tolerated');

// ---- sanitizer: valid report passes through trimmed ----
var good = DR.sanitizeReport({
  analyzable: true, reason: '',
  headline: '  A balanced, open face. ',
  summary: 'Nice summary.',
  observations: [{ area: 'Eyes', note: 'Level and symmetric.' }, { area: '', note: 'dropped' }],
  plan: [{ title: 'Daily SPF', why: 'Sun exposure', how: 'Broad-spectrum 30+ each morning.' }],
  disclaimer: 'Not medical advice.'
});
t.ok(good !== null, 'valid report accepted');
t.eq(good.headline, 'A balanced, open face.', 'strings trimmed');
t.eq(good.observations.length, 1, 'malformed observation rows dropped');
t.eq(good.plan.length, 1, 'plan preserved');

// ---- sanitizer: junk rejected ----
t.eq(DR.sanitizeReport(null), null, 'null rejected');
t.eq(DR.sanitizeReport('nope'), null, 'string rejected');
t.eq(DR.sanitizeReport({}), null, 'empty object rejected');
t.eq(DR.sanitizeReport({ headline: 'x', summary: 'y', observations: [], plan: [] }), null,
  'no observations AND no plan -> rejected');

// ---- sanitizer: oversize input capped ----
var long = new Array(500).join('word ');
var many = [];
for (var i = 0; i < 20; i++) many.push({ area: 'A' + i, note: 'n' + i });
var capped = DR.sanitizeReport({
  headline: long, summary: long,
  observations: many,
  plan: [{ title: long, why: long, how: long }],
  disclaimer: long
});
t.ok(capped.headline.length <= 220, 'headline capped');
t.ok(capped.summary.length <= 1200, 'summary capped');
t.eq(capped.observations.length, 6, 'observations capped at 6');
t.ok(capped.plan[0].how.length <= 800, 'plan how capped');

// ---- sanitizer: non-string fields dropped, not crashed ----
var weird = DR.sanitizeReport({
  headline: 42, summary: { a: 1 },
  observations: [{ area: 'Skin', note: 'Even tone.' }],
  plan: [{ title: 'T', why: null, how: 'Do it.' }, 'garbage', { title: 7, how: 9 }],
  disclaimer: []
});
t.ok(weird !== null, 'mixed-type report still usable');
t.eq(weird.headline, '', 'non-string headline -> empty');
t.eq(weird.plan.length, 1, 'malformed plan rows dropped');

// ---- error messages ----
t.ok(/isn’t switched on|isn't switched on/.test(DR.errorMessage(503, { error: 'not-configured' })), '503 friendly');
t.ok(/tomorrow/.test(DR.errorMessage(429, { error: 'daily-limit' })), 'daily cap friendly');
t.ok(DR.errorMessage(500, {}).length > 10, 'generic fallback');
t.ok(/^https:\/\/forms\.caiomsi\.com/.test(DR.ENDPOINT), 'endpoint pinned to forms backend');

t.done();
