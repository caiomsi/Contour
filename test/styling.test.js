/* styling.js — full coverage of shape × texture × length, profile-driven
   selection, measurement-driven fringe, and an ethics lint over ALL copy. */
'use strict';

var S = require('../js/styling.js');
var C = require('../js/content.js');
var P = require('../js/profile.js');
var t = require('../test/_assert.js').suite('STYLING');

var SHAPES = ['oval', 'round', 'square', 'oblong', 'heart', 'diamond'];
var LENGTHS = ['short', 'medium', 'long'];

function has(list, id) { return list.some(function (x) { return x.id === id; }); }
function get(list, id) { return list.filter(function (x) { return x.id === id; })[0]; }
function shape(s, extra) { return Object.assign({ shape: s, secondary: 'oval', leaning: false }, extra || {}); }

// ---- every shape x texture x length has real cut text ----
var missing = 0;
SHAPES.forEach(function (sh) {
  var g = S.SHAPE_GOALS[sh];
  if (!g || !S.CUTS[g.goal]) { missing++; return; }
  S.TEXTURES.forEach(function (tx) {
    LENGTHS.forEach(function (l) {
      var c = S.CUTS[g.goal][tx] && S.CUTS[g.goal][tx][l];
      if (!c || c.length < 12) missing++;
    });
  });
});
t.eq(missing, 0, 'all 6 shapes x 4 textures x 3 lengths have cut text');
t.eq(S.TEXTURES.length, P.FIELDS.hairTexture.options.length, 'styling textures match profile options');
S.TEXTURES.forEach(function (tx) { t.ok(S.CARE[tx] && S.FRINGE_ON[tx] && S.FRINGE_OFF[tx], tx + ' has care + fringe text'); });
SHAPES.forEach(function (sh) { t.ok(S.BEARD[sh] && S.EYEWEAR[sh], sh + ' has beard + eyewear text'); });

// ---- no profile -> nothing ----
t.eq(S.recsFor({ faceShape: shape('round'), profile: {} }).length, 0, 'empty profile -> no styling recs');

// ---- texture + length -> a specific cut for that texture ----
var r1 = S.recsFor({ faceShape: shape('round'), profile: { hairTexture: 'coily', lengthPref: 'short' } });
var cut = get(r1, 'hair-cut');
t.ok(cut, 'texture -> cut rec');
t.ok(cut.body.indexOf(S.CUTS.height.coily.short) >= 0, 'round + coily + short -> the coily short height cut');
t.ok(/coily/.test(cut.because) && /round/.test(cut.because), 'because cites shape and texture');
t.ok(has(r1, 'hair-care') && /LOC/.test(get(r1, 'hair-care').body), 'coily -> moisture/LOC care routine');

// open length -> all three lengths offered
var r2 = S.recsFor({ faceShape: shape('oblong'), profile: { hairTexture: 'straight', lengthPref: 'open' } });
var b2 = get(r2, 'hair-cut').body;
t.ok(/Short:/.test(b2) && /Medium:/.test(b2) && /Long:/.test(b2), 'open length -> short/medium/long options');

// leaning shape folds in the secondary goal
var r3 = S.recsFor({ faceShape: shape('oval', { leaning: true, secondary: 'round' }), profile: { hairTexture: 'wavy' } });
t.ok(/leaning round/.test(get(r3, 'hair-cut').because), 'leaning shape named in because');
t.ok(/also lean round/.test(get(r3, 'hair-cut').body), 'secondary shape goal added to advice');

// thickness modifies care
var r4 = S.recsFor({ faceShape: shape('oval'), profile: { hairTexture: 'straight', hairThickness: 'fine' } });
t.ok(/Fine strands/.test(get(r4, 'hair-care').body) && /fine, straight/.test(get(r4, 'hair-care').title), 'fine thickness tailors care');

// ---- fringe from measured thirds ----
function thirds(u) { return { thirds: { upper: u, middle: (1 - u) / 2, lower: (1 - u) / 2 } }; }
var tall = S.recsFor({ faceShape: shape('oval'), measurements: thirds(0.39), profile: { hairTexture: 'curly' } });
t.ok(has(tall, 'hair-fringe') && /curly fringe/.test(get(tall, 'hair-fringe').body), 'tall upper third -> texture-matched fringe');
t.ok(/39%/.test(get(tall, 'hair-fringe').because), 'fringe because cites the measurement');
var short = S.recsFor({ faceShape: shape('oval'), measurements: thirds(0.27), profile: { hairTexture: 'straight' } });
t.ok(/open/i.test(get(short, 'hair-fringe').title), 'short upper third -> keep forehead open');
var even = S.recsFor({ faceShape: shape('oval'), measurements: thirds(0.333), profile: { hairTexture: 'straight' } });
t.ok(!has(even, 'hair-fringe'), 'even thirds -> no fringe rec');
var guess = S.recsFor({ faceShape: shape('oval'), measurements: thirds(0.39), hairlineKnown: false, profile: { hairTexture: 'curly' } });
t.ok(!has(guess, 'hair-fringe'), 'guessed hairline -> no fringe advice (not measured)');

// ---- beard / eyewear / skin / thinning ----
var r5 = S.recsFor({ faceShape: shape('square'), profile: { facialHair: 'full', glasses: 'yes', skinType: 'oily', hairConcern: 'thinning' } });
t.ok(has(r5, 'beard') && get(r5, 'beard').body === S.BEARD.square, 'full beard -> shape-specific beard');
t.ok(has(r5, 'eyewear') && get(r5, 'eyewear').body === S.EYEWEAR.square, 'glasses -> shape-specific frames');
t.ok(has(r5, 'skin-type') && /oil-free/.test(get(r5, 'skin-type').body), 'oily skin -> oil-free routine');
t.ok(has(r5, 'hair-thinning') && /dermatologist/.test(get(r5, 'hair-thinning').body), 'thinning -> habits + dermatologist');
t.ok(!has(r5, 'hair-cut'), 'no texture -> no cut rec');
var r6 = S.recsFor({ faceShape: shape('round'), profile: { facialHair: 'patchy' } });
t.ok(/stubble/.test(get(r6, 'beard').body), 'patchy -> stubble-first advice');
t.ok(!has(S.recsFor({ faceShape: shape('round'), profile: { facialHair: 'none', glasses: 'no' } }), 'beard'), 'no facial hair -> no beard rec');

// ---- ethics lint over every string we can show ----
var BANNED = /\bflaw|\bfix your|surgery|surgical|filler|botox|minoxidil|finasteride|dutasteride|rogaine|mewing (works|reshapes|rebuilds)|ugly|unattractive/i;
var texts = [];
(function walk(o) {
  if (typeof o === 'string') texts.push(o);
  else if (o && typeof o === 'object') Object.keys(o).forEach(function (k) { walk(o[k]); });
})([S.SHAPE_GOALS, S.CUTS, S.CARE, S.THICKNESS_NOTE, S.BEARD, S.BEARD_PATCHY, S.EYEWEAR, S.SKIN_TYPE, S.FRINGE_ON, S.FRINGE_OFF, S.THINNING, C.CONTENT, C.FACE_SHAPE_STYLING]);
var bad = texts.filter(function (x) { return BANNED.test(x); });
t.eq(bad.length, 0, 'ethics lint: no banned wording in ' + texts.length + ' strings' + (bad.length ? ' -> ' + bad[0] : ''));
// every generated rec is tied to a reason and in a known category
var all = S.recsFor({ faceShape: shape('heart', { leaning: true, secondary: 'oval' }), measurements: thirds(0.38),
  profile: { hairTexture: 'wavy', hairThickness: 'coarse', lengthPref: 'medium', facialHair: 'full', skinType: 'sensitive', glasses: 'yes', hairConcern: 'thinning' } });
t.ok(all.every(function (x) { return x.because && C.CATEGORIES[x.category] && !BANNED.test(x.body); }), 'every styling rec has a because + known category');

t.done();
