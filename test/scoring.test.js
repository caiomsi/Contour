/* scoring.js — plateau shape, bounds, monotonicity, composite weights. */
'use strict';

var S = require('../js/scoring.js');
var A = require('../js/analysis.js');
var F = require('./fixtures/face.js');
var t = require('../test/_assert.js').suite('SCORING');

// ---- plateau() shape on a target-range band ----
var band = { a: 0.72, b: 0.90, c: 1.10, d: 1.30 };
t.near(S.plateau(1.00, band), 100, 1e-9, 'inside ideal band -> 100');
t.near(S.plateau(0.90, band), 100, 1e-9, 'lower ideal edge -> 100');
t.near(S.plateau(1.10, band), 100, 1e-9, 'upper ideal edge -> 100');
t.near(S.plateau(0.72, band), 0, 1e-9, 'lower falloff end -> 0');
t.near(S.plateau(1.30, band), 0, 1e-9, 'upper falloff end -> 0');
t.near(S.plateau(0.81, band), 50, 0.5, 'halfway up ramp -> ~50');
t.near(S.plateau(1.20, band), 50, 0.5, 'halfway down ramp -> ~50');
t.near(S.plateau(0.5, band), 0, 1e-9, 'far below -> 0');
t.near(S.plateau(2.0, band), 0, 1e-9, 'far above -> 0');

// ---- lower-is-better band (b=-Infinity) ----
var low = S.BANDS.symmetry;
t.near(S.plateau(0.0, low), 100, 1e-9, 'zero deviation -> 100');
t.near(S.plateau(low.c, low), 100, 1e-9, 'at ideal edge -> 100');
t.near(S.plateau(low.d, low), 0, 1e-9, 'at falloff end -> 0');
t.ok(S.plateau(0.09, low) < 100 && S.plateau(0.09, low) > 0, 'mid falloff strictly between');

// ---- monotonic falloff away from ideal ----
t.ok(S.plateau(1.0, band) >= S.plateau(1.15, band), 'monotone: 1.0 >= 1.15');
t.ok(S.plateau(1.15, band) >= S.plateau(1.25, band), 'monotone: 1.15 >= 1.25');

// ---- weights sum to 1 ----
var sum = 0;
for (var k in S.WEIGHTS) sum += S.WEIGHTS[k];
t.near(sum, 1.0, 1e-9, 'composite weights sum to 1.0');

// ---- score() bounds + structure on a real measurement object ----
var m = A.analyze(F.balancedFace(), 1000, 1000);
var sc = S.score(m, { score: 90, confidence: 'low' }, 'high');
t.ok(sc.composite >= 0 && sc.composite <= 100, 'composite in [0,100], got ' + sc.composite);
var allBounded = true, allTiered = true;
for (var f in sc.features) {
  var fs = sc.features[f];
  if (fs.score < 0 || fs.score > 100) allBounded = false;
  if (['typical', 'slightly', 'outside'].indexOf(fs.tier) < 0) allTiered = false;
}
t.ok(allBounded, 'every feature score within [0,100]');
t.ok(allTiered, 'every feature has a valid tier');
t.ok('skin' in sc.features, 'skin feature scored when provided');
t.eq(sc.confidence, 'high', 'confidence passthrough');

// ---- skin absent -> weight redistributes, still valid composite ----
var sc2 = S.score(m, null, 'medium');
t.ok(!('skin' in sc2.features), 'no skin feature when skin omitted');
t.ok(sc2.composite >= 0 && sc2.composite <= 100, 'composite valid without skin');

// ---- a clearly-off metric scores lower than a centered one ----
var off = A.analyze(F.balancedFace(), 1000, 1000);
off.interocular.ratio = 1.6;              // far wide-set
var scoreOff = S.plateau(off.interocular.ratio, S.BANDS.interocular);
t.eq(scoreOff, 0, 'extreme eye spacing -> 0 on that feature');

t.done();
