/* landmarks-agg.js — burst alignment + median beats a single noisy frame. */
'use strict';

var AG = require('../js/landmarks-agg.js');
var A = require('../js/analysis.js');
var F = require('./fixtures/face.js');
var t = require('../test/_assert.js').suite('LANDMARKS-AGG');

var W = 1000, H = 1000;

// deterministic PRNG so the test is stable
var seed = 12345;
function rand() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
function gauss() { return Math.sqrt(-2 * Math.log(rand() + 1e-12)) * Math.cos(2 * Math.PI * rand()); }

var truth = F.balancedFace();

// a frame = the true face, slightly moved (shift/scale/roll) + per-point jitter
function frame(shiftX, shiftY, scale, rollDeg, noise) {
  var a = rollDeg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  return truth.map(function (q) {
    var dx = (q.x - 0.5) * scale, dy = (q.y - 0.5) * scale;
    return {
      x: 0.5 + shiftX + dx * c - dy * s + gauss() * noise,
      y: 0.5 + shiftY + dx * s + dy * c + gauss() * noise,
      z: q.z || 0
    };
  });
}

// ---- single frame passes straight through ----
var one = AG.aggregate([truth], W, H);
t.eq(one.frames, 1, 'single frame -> frames 1');
t.eq(one.spread, 0, 'single frame -> spread 0');

// ---- empty / bad input ----
t.eq(AG.aggregate([], W, H), null, 'no frames -> null');

// ---- similarity fit recovers a pure transform exactly ----
var moved = frame(0.02, -0.01, 1.05, 3, 0);
var T = AG.fitSimilarity(F.clone(moved).map(function (q) { return { x: q.x * W, y: q.y * H }; }),
  truth.map(function (q) { return { x: q.x * W, y: q.y * H }; }), AG.ANCHORS);
var back = T({ x: moved[152].x * W, y: moved[152].y * H });
t.near(back.x, truth[152].x * W, 0.5, 'similarity fit maps chin back (x)');
t.near(back.y, truth[152].y * H, 0.5, 'similarity fit maps chin back (y)');

// ---- median of 6 jittered, slightly moving frames beats one frame ----
var NOISE = 0.0025;   // ~1% of IPD per point, typical live-video jitter
var frames = [];
for (var i = 0; i < 6; i++) frames.push(frame((rand() - 0.5) * 0.01, (rand() - 0.5) * 0.01, 1 + (rand() - 0.5) * 0.02, (rand() - 0.5) * 2, NOISE));
var agg = AG.aggregate(frames, W, H);
t.eq(agg.frames, 6, 'aggregates all 6 frames');
t.ok(agg.refIndex >= 0 && agg.refIndex < 6, 'reference frame index in range');

var truthM = A.analyze(truth, W, H, { hairlineY: 100 });
function err(lm) {
  var m = A.analyze(lm, W, H, { hairlineY: 100 });
  return Math.abs(m.symmetry.asymNorm - truthM.symmetry.asymNorm) +
         Math.abs(m.fifths.rmsDev - truthM.fifths.rmsDev) +
         Math.abs(m.interocular.ratio - truthM.interocular.ratio) / 10 +
         Math.abs(m.canthal.avg - truthM.canthal.avg) / 100;
}
var singleErr = frames.reduce(function (acc, f) { return acc + err(f); }, 0) / frames.length;
var aggErr = err(agg.landmarks);
t.ok(aggErr < singleErr * 0.7, 'aggregate error ' + aggErr.toFixed(4) + ' < 70% of mean single-frame ' + singleErr.toFixed(4));

// ---- spread reflects jitter ----
t.ok(agg.spread > 0 && agg.spread < 0.03, 'steady burst -> small spread (' + agg.spread.toFixed(4) + ')');
var shaky = [];
for (var k = 0; k < 6; k++) shaky.push(frame(0, 0, 1, 0, 0.02));
t.ok(AG.aggregate(shaky, W, H).spread > 0.03, 'shaky burst -> large spread');

// ---- robust to one bad frame (median) ----
var withBad = frames.slice(0, 5).concat([frame(0, 0, 1, 0, 0.05)]);
t.ok(err(AG.aggregate(withBad, W, H).landmarks) < singleErr, 'one wild frame does not wreck the aggregate');

t.done();
