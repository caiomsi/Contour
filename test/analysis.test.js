/* analysis.js — measurement correctness on synthetic faces. */
'use strict';

var A = require('../js/analysis.js');
var F = require('./fixtures/face.js');
var t = require('../test/_assert.js').suite('ANALYSIS');

var W = 1000, H = 1000;

// ---- balanced face: known measurements ----
// hairlineY pinned to the forehead-top pixel so the three thirds are equal
// (the default hairline intentionally lifts toward the trichion).
var m = A.analyze(F.balancedFace(), W, H, { hairlineY: 100 });

t.near(m.ref.ipd, 240, 0.6, 'IPD = 0.24*width');
t.near(m.thirds.upper, 1 / 3, 0.003, 'upper third ~1/3');
t.near(m.thirds.middle, 1 / 3, 0.003, 'middle third ~1/3');
t.near(m.thirds.lower, 1 / 3, 0.003, 'lower third ~1/3');
t.near(m.thirds.maxDev, 0, 0.003, 'thirds maxDev ~0');
t.near(m.symmetry.asymNorm, 0, 0.01, 'symmetric face -> asymNorm ~0');
t.near(m.symmetry.midlineX, 500, 0.5, 'midline at image center');
t.near(m.canthal.avg, 0, 0.5, 'level eyes -> canthal tilt ~0');
t.near(m.interocular.ratio, 1.0, 0.02, 'intercanthal == eye width -> ratio 1');
t.near(m.nose.toIntercanthal, 0.11 / 0.12, 0.02, 'nose/intercanthal ratio');
t.ok(m.fwhr.ratio > 1.0 && m.fwhr.ratio < 3.0, 'fwhr in plausible range');
t.ok(m.shapeInput.faceLen > 0 && m.shapeInput.cheekW > 0, 'shape inputs positive');

// ---- roll correction: tilt the whole face, measurements unchanged ----
var mDef = A.analyze(F.balancedFace(), W, H);          // default hairline, no roll
var mr = A.analyze(F.rotated(F.balancedFace(), 8), W, H);
t.near(Math.abs(mr.ref.rollDeg), 8, 0.6, 'detected roll ~8deg');
t.near(mr.thirds.maxDev, mDef.thirds.maxDev, 0.02, 'thirds invariant to roll');
t.near(mr.symmetry.asymNorm, m.symmetry.asymNorm, 0.02, 'symmetry invariant to roll');
t.near(mr.interocular.ratio, m.interocular.ratio, 0.03, 'eye ratio invariant to roll');
t.near(mr.canthal.avg, 0, 1.0, 'canthal ~0 after roll correction');

// ---- canthal tilt sign: raise outer corners -> positive ----
var up = F.clone(F.balancedFace());
up[33].y = 0.40; up[263].y = 0.40;      // outer corners higher (smaller y)
var mu = A.analyze(up, W, H);
t.ok(mu.canthal.avg > 2, 'raised outer canthi -> positive tilt, got ' + mu.canthal.avg.toFixed(2));

var dn = F.clone(F.balancedFace());
dn[33].y = 0.44; dn[263].y = 0.44;      // outer corners lower
var md = A.analyze(dn, W, H);
t.ok(md.canthal.avg < -2, 'lowered outer canthi -> negative tilt, got ' + md.canthal.avg.toFixed(2));

// ---- asymmetry: shift one eye, asymNorm rises ----
var asy = F.clone(F.balancedFace());
asy[362].x += 0.03; asy[263].x += 0.03;  // push left eye outward
var ma = A.analyze(asy, W, H);
t.ok(ma.symmetry.asymNorm > m.symmetry.asymNorm + 0.02,
  'shifted eye raises asymNorm (' + ma.symmetry.asymNorm.toFixed(3) + ' > ' + m.symmetry.asymNorm.toFixed(3) + ')');

// ---- head-pose proxy: frontal ~0, turned -> nonzero yaw ----
t.near(m.pose.yawRatio, 0, 0.05, 'frontal face -> yaw proxy ~0');
var turn = F.clone(F.balancedFace());
turn[1].x = 0.44;                         // nose tip off-center (turned)
var mt = A.analyze(turn, W, H);
t.ok(Math.abs(mt.pose.yawRatio) > 0.1, 'off-center nose -> yaw proxy nonzero');

t.done();
