/* faceshape.js — soft prototype classification on constructed inputs.
   Inputs are built in population z-units (FS.POP) so the tests track
   the calibration rather than hard-coded raw ratios. */
'use strict';

var FS = require('../js/faceshape.js');
var t = require('../test/_assert.js').suite('FACESHAPE');

// z-scores -> a raw shapeInput (cheekW fixed at 100)
function input(zf, zj, zl, zjaw, extra) {
  var P = FS.POP, cheek = 100;
  var lw = P.lw.m + zl * P.lw.s;
  var o = {
    foreheadW: cheek * (P.fC.m + zf * P.fC.s),
    cheekW: cheek,
    jawW: cheek * (P.jC.m + zj * P.jC.s),
    faceLen: cheek * lw, lenToWidth: lw
  };
  if (zjaw !== null) o.jawAngle = P.jaw.m + zjaw * P.jaw.s;
  return Object.assign(o, extra || {});
}

// each prototype classifies as itself
FS.SHAPES.forEach(function (s) {
  var p = FS.PROTOS[s];
  t.eq(FS.classify(input(p[0], p[1], p[2], p[3])).shape, s, 'prototype ' + s + ' -> ' + s);
});

// characteristic (exaggerated) faces
t.eq(FS.classify(input(0, 0.3, 2.5, 0)).shape, 'oblong', 'very long -> oblong');
t.eq(FS.classify(input(0, 0, -2.2, 1.5)).shape, 'round', 'short + soft jaw -> round');
t.eq(FS.classify(input(0.8, 2.0, -1, -2)).shape, 'square', 'broad angular jaw -> square');
t.eq(FS.classify(input(2, -2, 0, 0.5)).shape, 'heart', 'wide forehead, narrow jaw -> heart');
t.eq(FS.classify(input(-2, -1.5, 0.2, 0)).shape, 'diamond', 'narrow forehead + jaw -> diamond');
t.eq(FS.classify(input(0, 0, 0, 0)).shape, 'oval', 'population-average face -> oval');

// probabilities are a distribution
var r = FS.classify(input(0.2, -0.1, 0.4, 0.2));
var sum = FS.SHAPES.reduce(function (a, s) { return a + r.probs[s]; }, 0);
t.near(sum, 1, 1e-9, 'probs sum to 1');
t.ok(r.confidence > 0 && r.confidence <= 1, 'confidence in (0,1]');
t.ok(r.secondary && r.secondary !== r.shape, 'has a distinct secondary shape');
t.ok(typeof r.note === 'string' && r.note.length > 10, 'has descriptive note');
t.ok(r.ratios && typeof r.ratios.lenToWidth === 'number', 'exposes ratios');

// near-boundary face (halfway oval<->round) reads as leaning
var mid = FS.classify(input(0, -0.15, -0.55, 0.65));
t.ok(mid.leaning, 'halfway oval/round -> leaning (' + FS.describe(mid) + ')');
t.ok(/leaning/.test(FS.describe(mid)), 'describe() mentions leaning');
t.ok(!FS.classify(input(0, 0.3, 2.5, 0)).leaning, 'clear oblong -> not leaning');

// unknown hairline: length counts for less and confidence drops
var known = FS.classify(input(0, 0.3, 1.6, -0.3));
var unknown = FS.classify(input(0, 0.3, 1.6, -0.3, { hairlineKnown: false }));
t.ok(unknown.confidence < known.confidence, 'default hairline lowers confidence');

// jaw angle optional (older callers / tests) — still classifies
t.eq(FS.classify(input(0, 0.3, 2.5, null)).shape, 'oblong', 'works without jawAngle');

// real-world scale regression: v1.2 called every real face diamond. The
// calibration-set mean must NOT come out diamond.
t.ok(FS.classify({ foreheadW: 83.3, cheekW: 100, jawW: 81.7, lenToWidth: 1.39, jawAngle: 132.7 }).shape !== 'diamond',
  'average real face is not labelled diamond');

t.done();
