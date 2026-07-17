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
  p[LM.CHEEK_R] = { x: 55, y: 120 };
  p[LM.CHEEK_L] = { x: 145, y: 120 };
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

// ---- red cheeks -> flagged ----
var red = F.makeImage(200, 200, { base: { r: 200, g: 180, b: 172 } });
var pr = px();
red.fillRect(pr[LM.CHEEK_R].x, pr[LM.CHEEK_R].y, 9, { r: 232, g: 140, b: 130 });
red.fillRect(pr[LM.CHEEK_L].x, pr[LM.CHEEK_L].y, 9, { r: 232, g: 140, b: 130 });
var r3 = SK.compute(red, pr);
t.ok(r3.redness.index > 0.17, 'red cheeks -> redness index high (' + r3.redness.index.toFixed(3) + ')');
t.ok(r3.redness.flagged, 'redness flagged');

// ---- out-of-bounds regions -> null (graceful) ----
var tiny = F.makeImage(10, 10, {});
t.eq(SK.compute(tiny, px()), null, 'regions outside image -> null');

t.done();
