/* skin.js — pixel-region signals on synthetic images. */
'use strict';

var SK = require('../js/skin.js');
var A = require('../js/analysis.js');
var F = require('./fixtures/face.js');
var t = require('../test/_assert.js').suite('SKIN');

var LM = A.LM;

// Minimal pixel-landmark set (only the indices skin.compute reads).
function px() {
  var p = [];
  p[LM.EYE_R_OUT] = { x: 60, y: 80 };
  p[LM.EYE_R_IN] = { x: 90, y: 80 };     // eyeW = 30
  p[LM.EYE_R_LOWER] = { x: 75, y: 88 };
  p[LM.EYE_L_LOWER] = { x: 125, y: 88 };
  p[LM.MIDCHEEK_R] = { x: 75, y: 115 };
  p[LM.MIDCHEEK_L] = { x: 125, y: 115 };
  p[LM.GLABELLA] = { x: 100, y: 62 };    // forehead patch samples above this
  p[LM.MENTON] = { x: 100, y: 185 };     // chin patch samples above this
  return p;
}

// ---- clean image: no flags, high score ----
var clean = F.makeImage(200, 200, { base: { r: 200, g: 180, b: 172 } });
var r1 = SK.compute(clean, px());
t.ok(r1 !== null, 'compute returns a result');
t.ok(!r1.underEye.flagged, 'uniform image -> under-eye not flagged');
t.ok(!r1.redness.flagged, 'uniform image -> redness not flagged (' + r1.redness.index.toFixed(3) + ')');
t.ok(r1.score >= 85, 'clean skin scores high, got ' + r1.score);
t.eq(r1.confidence, 'low', 'skin confidence always low (photo-dependent)');

// ---- dark under-eye patches -> flagged ----
var dark = F.makeImage(200, 200, { base: { r: 200, g: 180, b: 172 } });
var pd = px();
dark.fillRect(pd[LM.EYE_R_LOWER].x, pd[LM.EYE_R_LOWER].y + 13, 9, { r: 120, g: 100, b: 95 });
dark.fillRect(pd[LM.EYE_L_LOWER].x, pd[LM.EYE_L_LOWER].y + 13, 9, { r: 120, g: 100, b: 95 });
var r2 = SK.compute(dark, pd);
t.ok(r2.underEye.delta > 0.16, 'dark patches -> delta > 0.16 (' + r2.underEye.delta.toFixed(3) + ')');
t.ok(r2.underEye.flagged, 'dark under-eye flagged');
t.ok(r2.score < r1.score, 'darker under-eye lowers score');

// ---- red cheeks (vs the person's own forehead/chin baseline) -> flagged ----
var red = F.makeImage(200, 200, { base: { r: 200, g: 180, b: 172 } });
var pr = px();
red.fillRect(pr[LM.MIDCHEEK_R].x, pr[LM.MIDCHEEK_R].y, 9, { r: 232, g: 140, b: 130 });
red.fillRect(pr[LM.MIDCHEEK_L].x, pr[LM.MIDCHEEK_L].y, 9, { r: 232, g: 140, b: 130 });
var r3 = SK.compute(red, pr);
t.ok(r3.redness.index > 0.17, 'red cheeks -> redness excess high (' + r3.redness.index.toFixed(3) + ')');
t.ok(r3.redness.flagged, 'redness flagged');

// ---- uniformly warm skin tone -> NOT flagged (self-referenced) ----
var warm = F.makeImage(200, 200, { base: { r: 190, g: 130, b: 110 } });
var r3b = SK.compute(warm, px());
t.ok(!r3b.redness.flagged, 'uniformly warm skin tone is not "redness" (' + r3b.redness.index.toFixed(3) + ')');
t.ok(r3b.score >= 85, 'warm skin tone scores clean, got ' + r3b.score);

// ---- out-of-bounds regions -> null (graceful) ----
var tiny = F.makeImage(10, 10, {});
t.eq(SK.compute(tiny, px()), null, 'regions outside image -> null');

// ---- hairline detection ----
// 200x300 canvas: bright skin everywhere, dark hair band above y=80.
var hairOpts = { midlineX: 100, yStart: 120, faceHeight: 200, ipd: 60 };
// fillRect is radius-based (square around a center): centers y=30 r=50
// give a band spanning y in [-20, 80] — hair above y=80, skin below.
var withHair = F.makeImage(200, 300, { base: { r: 205, g: 172, b: 152 } });
[30, 100, 170].forEach(function (cx) { withHair.fillRect(cx, 30, 50, { r: 55, g: 45, b: 40 }); });
var hl = SK.detectHairlineY(withHair, hairOpts);
t.ok(hl !== null, 'dark hair band -> hairline detected');
t.ok(Math.abs(hl - 80) <= 6, 'hairline near the band edge (got ' + hl + ', expected ~80)');

// uniform (bald/very light hair) -> null, caller falls back to heuristic
var noHair = F.makeImage(200, 300, { base: { r: 205, g: 172, b: 152 } });
t.eq(SK.detectHairlineY(noHair, hairOpts), null, 'no transition -> null (fallback)');

// transition at the very start (< 2% of face height) is ignored
var lowBand = F.makeImage(200, 300, { base: { r: 205, g: 172, b: 152 } });
[30, 100, 170].forEach(function (cx) { lowBand.fillRect(cx, 59, 60, { r: 55, g: 45, b: 40 }); });
t.eq(SK.detectHairlineY(lowBand, hairOpts), null, 'transition at start -> null');

// too-dark forehead (can't reference) -> null
var darkFace = F.makeImage(200, 300, { base: { r: 30, g: 28, b: 26 } });
t.eq(SK.detectHairlineY(darkFace, hairOpts), null, 'unreadably dark forehead -> null');

// mapFn is honored (shift sampling; identity face shifted by +30px in x)
var shifted = F.makeImage(260, 300, { base: { r: 205, g: 172, b: 152 } });
shifted.fillRect(130, 30, 50, { r: 55, g: 45, b: 40 });   // y in [-20,80], x in [80,180]
var hlShift = SK.detectHairlineY(shifted, {
  midlineX: 70, yStart: 120, faceHeight: 200, ipd: 60,
  mapFn: function (pt) { return { x: pt.x + 30, y: pt.y }; }
});
t.ok(hlShift !== null && Math.abs(hlShift - 80) <= 6, 'mapFn applied to sampling (got ' + hlShift + ')');

t.done();
