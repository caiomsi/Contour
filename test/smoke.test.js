/* smoke.test.js — full pipeline through the BROWSER load path.
   Loads every pure module into a vm sandbox exactly as the browser
   would (plain <script>, window globals, no require), then drives one
   fixture end-to-end: analyze -> faceshape -> skin -> score ->
   recommendations, plus the quality gates. Asserts zero errors. */
'use strict';

var fs = require('fs');
var vm = require('vm');
var path = require('path');
var F = require('./fixtures/face.js');
var t = require('../test/_assert.js').suite('SMOKE');

// ---- build a browser-like sandbox (window === global self) ----
var sandbox = { console: console };
sandbox.window = sandbox;
vm.createContext(sandbox);

var MODULES = ['geometry', 'analysis', 'faceshape', 'scoring', 'skin', 'gates', 'content', 'hairstyles', 'styling', 'recommendations', 'history', 'profile', 'landmarks-agg', 'deepreport'];
var loadedOk = true;
MODULES.forEach(function (name) {
  try {
    var src = fs.readFileSync(path.join(__dirname, '..', 'js', name + '.js'), 'utf8');
    vm.runInContext(src, sandbox, { filename: 'js/' + name + '.js' });
  } catch (e) {
    loadedOk = false;
    console.error('  ✗ failed to load js/' + name + '.js: ' + e.message);
  }
});
t.ok(loadedOk, 'all pure modules load as browser globals');
t.ok(sandbox.ContourGeometry && sandbox.ContourAnalysis && sandbox.ContourScoring
  && sandbox.ContourFaceShape && sandbox.ContourSkin && sandbox.ContourGates
  && sandbox.ContourContent && sandbox.ContourRecommendations && sandbox.ContourHistory
  && sandbox.ContourDeepReport && sandbox.ContourStyling && sandbox.ContourProfile
  && sandbox.ContourLandmarksAgg && sandbox.ContourHairstyles,
  'all namespaces attached to window');

// ---- drive the full pipeline (via the window globals) ----
var errors = 0, out = null, outP = null;
try {
  var A = sandbox.ContourAnalysis, S = sandbox.ContourScoring, FSh = sandbox.ContourFaceShape,
      SK = sandbox.ContourSkin, REC = sandbox.ContourRecommendations;

  var m = A.analyze(F.balancedFace(), 1000, 1000);
  var shape = FSh.classify(m.shapeInput);
  var img = F.makeImage(1000, 1000, { base: { r: 200, g: 180, b: 172 } });
  var skin = SK.compute(img, m.pxOriginal);           // real skin sampling
  var sc = S.score(m, skin, 'high');
  out = REC.generate({ measurements: m, scores: sc, skin: skin, faceShape: shape });
  outP = sandbox.ContourStyling.hairPlan({ measurements: m, faceShape: shape,
    profile: sandbox.ContourProfile.validate({ hairTexture: 'wavy', lengthPref: 'medium', glasses: 'yes' }) });
} catch (e) {
  errors++;
  console.error('  ✗ pipeline threw: ' + e.message + '\n' + e.stack);
}
t.eq(errors, 0, 'end-to-end pipeline runs without throwing');
t.ok(out && out.length >= 1 && out.length <= 12, 'produced 1..12 recommendations');
t.ok(outP && outP.styles.length >= 2 && outP.styles[0].ask, 'profile flows through to named cuts (browser path)');
if (out) {
  var wellFormed = out.every(function (r) { return r.title && r.body && r.categoryLabel; });
  t.ok(wellFormed, 'every recommendation is well-formed (title/body/category)');
}

// ---- gates: a good frontal/neutral context passes with confidence ----
var GT = sandbox.ContourGates;
var goodCtx = {
  faceCount: 1, ipdPx: 220, faceFillRatio: 0.45,
  pose: { yaw: 1.5, pitch: -1.0 },
  blend: { jawOpen: 0.03, mouthSmileLeft: 0.05, mouthSmileRight: 0.05, eyeBlinkLeft: 0.02, eyeBlinkRight: 0.02 },
  exposure: { mean: 150, clipLow: 0.01, clipHigh: 0.02 }
};
var gg = GT.check(goodCtx);
t.ok(gg.pass, 'clean frontal photo passes gates');
t.eq(gg.confidence, 'high', 'clean photo -> high confidence');

// ---- gates: blocking conditions ----
t.ok(!GT.check({ faceCount: 0 }).pass, 'no face -> blocked');
t.ok(!GT.check(Object.assign({}, goodCtx, { faceCount: 2 })).pass, 'two faces -> blocked');
t.ok(!GT.check(Object.assign({}, goodCtx, { pose: { yaw: 20, pitch: 0 } })).pass, 'turned head -> blocked');
t.ok(!GT.check(Object.assign({}, goodCtx, { blend: { jawOpen: 0.6 } })).pass, 'open mouth -> blocked');
t.ok(!GT.check(Object.assign({}, goodCtx, { ipdPx: 30 })).pass, 'tiny face -> blocked');
t.ok(!GT.check(Object.assign({}, goodCtx, { exposure: { mean: 20 } })).pass, 'too dark -> blocked');

// ---- gates: mild issues pass but lower confidence + selfie advisory ----
var mild = GT.check(Object.assign({}, goodCtx, {
  blend: { mouthSmileLeft: 0.35, mouthSmileRight: 0.35 }, faceFillRatio: 0.8
}));
t.ok(mild.pass, 'mild smile still passes');
t.ok(mild.confidence !== 'high', 'mild smile lowers confidence');
t.ok(mild.advisories.length >= 1, 'large face -> selfie-distortion advisory');

// ---- gates: camera burst steadiness ----
var steady = GT.check(Object.assign({}, goodCtx, { burst: { frames: 6, spread: 0.01 } }));
t.eq(steady.confidence, 'high', 'steady burst keeps high confidence');
var shaky = GT.check(Object.assign({}, goodCtx, { burst: { frames: 6, spread: 0.06 } }));
t.ok(shaky.pass && shaky.warns.some(function (w) { return w.id === 'unsteady'; }), 'shaky burst -> unsteady warning');
t.ok(shaky.confidence !== 'high', 'shaky burst lowers confidence');

t.done();
