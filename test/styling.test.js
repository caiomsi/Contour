/* styling.js — hair plan (goal, avoid, picks, care, fringe, thinning),
   tailored quick wins (skin, beard, glasses, brows), and an ethics lint
   over ALL user-facing copy. */
'use strict';

var S = require('../js/styling.js');
var HS = require('../js/hairstyles.js');
var C = require('../js/content.js');
var P = require('../js/profile.js');
var t = require('../test/_assert.js').suite('STYLING');

var SHAPES = ['oval', 'round', 'square', 'oblong', 'heart', 'diamond'];
function shape(s, extra) { return Object.assign({ shape: s, secondary: 'oval', leaning: false }, extra || {}); }
function get(list, id) { return list.filter(function (x) { return x.id === id; })[0]; }
function thirds(u) { return { thirds: { upper: u, middle: (1 - u) / 2, lower: (1 - u) / 2 } }; }

t.eq(S.TEXTURES.length, P.FIELDS.hairTexture.options.length, 'textures match profile options');

// ---- no texture: goal + avoid, asks for texture, no picks ----
var p0 = S.hairPlan({ faceShape: shape('round'), profile: {} });
t.ok(p0.needsTexture && p0.styles.length === 0, 'no texture -> asks for it, no picks yet');
t.ok(p0.aim && p0.avoid.length >= 2, 'no texture -> still gives the shape goal + what to skip');
t.eq(p0.goal, 'height', 'round -> height goal');

// ---- every shape x texture -> 3 picks + care ----
var bad = [];
SHAPES.forEach(function (sh) {
  S.TEXTURES.forEach(function (tx) {
    var pl = S.hairPlan({ faceShape: shape(sh), profile: { hairTexture: tx } });
    if (pl.styles.length < 2 || !pl.care || pl.care.steps.length < 4) bad.push(sh + '/' + tx);
    pl.styles.forEach(function (st) { if (st.textures.indexOf(tx) < 0) bad.push('texture mismatch ' + st.id); });
  });
});
t.eq(bad.length, 0, 'every shape x texture -> picks + care ' + bad.join(','));

// ---- specific answers ----
var pr = S.hairPlan({ faceShape: shape('round'), profile: { hairTexture: 'coily', lengthPref: 'short' } });
t.ok(pr.styles[0].fit.height === 2 && pr.styles[0].length === 'short', 'round + coily + short -> a short height cut first (' + pr.styles[0].name + ')');
t.ok(pr.styles.every(function (s) { return s.ask && s.steps.length && s.why; }), 'picks carry ask-for, steps and why');
t.ok(/LOC/.test(pr.care.steps.join(' ')), 'coily care uses the LOC method');

var pf = S.hairPlan({ faceShape: shape('oval'), profile: { hairTexture: 'straight', hairThickness: 'fine' } });
t.ok(/fine, straight/.test(pf.care.title) && /Fine strands/.test(pf.care.steps.join(' ')), 'fine thickness tailors care');

// leaning shape adds the secondary aim
var pl2 = S.hairPlan({ faceShape: shape('oval', { leaning: true, secondary: 'round' }), profile: { hairTexture: 'wavy' } });
t.ok(/also lean round/.test(pl2.alsoAim), 'leaning shape -> secondary aim');
t.eq(pl2.shapeLabel, 'oval, leaning round', 'shape label mentions leaning');

// ---- fringe from measured thirds ----
var tall = S.hairPlan({ faceShape: shape('oval'), measurements: thirds(0.39), profile: { hairTexture: 'curly' } });
t.ok(tall.fringe && /curly fringe/.test(tall.fringe.body) && /39%/.test(tall.fringe.because), 'tall forehead -> texture-matched fringe with measurement');
var low = S.hairPlan({ faceShape: shape('oval'), measurements: thirds(0.27), profile: { hairTexture: 'straight' } });
t.ok(low.fringe && /open/i.test(low.fringe.title), 'short forehead -> keep it open');
t.eq(S.hairPlan({ faceShape: shape('oval'), measurements: thirds(0.333), profile: { hairTexture: 'straight' } }).fringe, null, 'even thirds -> no fringe advice');
t.eq(S.hairPlan({ faceShape: shape('oval'), measurements: thirds(0.39), hairlineKnown: false, profile: { hairTexture: 'curly' } }).fringe, null, 'guessed hairline -> no fringe advice');

// ---- thinning ----
var th = S.hairPlan({ faceShape: shape('oval'), profile: { hairTexture: 'straight', hairConcern: 'thinning' } });
t.ok(th.thinning && /dermatologist/.test(th.thinning.steps.join(' ')), 'thinning -> habits + dermatologist');
t.eq(th.styles[0].length, 'short', 'thinning -> short cut first');

// ---- quick wins ----
var q0 = S.quickWins({ faceShape: shape('square'), profile: {}, measurements: {} });
t.ok(get(q0, 'skin-routine') && get(q0, 'brows'), 'always: skin routine + brows');
t.ok(!get(q0, 'beard') && !get(q0, 'eyewear'), 'no profile -> no beard / glasses');
t.ok(/SPF 30\+/.test(get(q0, 'skin-routine').steps.join(' ')), 'skin routine includes daily SPF');

var q1 = S.quickWins({ faceShape: shape('square'), profile: { facialHair: 'full', glasses: 'yes', skinType: 'oily' }, measurements: {} });
t.ok(get(q1, 'beard').body === S.BEARD.square && /neckline/.test(get(q1, 'beard').steps.join(' ')), 'full beard -> shape + neckline how-to');
t.ok(get(q1, 'eyewear').body === S.EYEWEAR.square && /temples/.test(get(q1, 'eyewear').steps.join(' ')), 'glasses -> shape + fit rules');
t.ok(/oil-free/.test(get(q1, 'skin-routine').steps.join(' ')) && /oily/.test(get(q1, 'skin-routine').title), 'oily skin -> oil-free routine');
var qs = S.quickWins({ faceShape: shape('oval'), profile: { skinType: 'sensitive' } });
t.ok(/Skip strong actives/.test(get(qs, 'skin-routine').steps.join(' ')) && /mineral/.test(get(qs, 'skin-routine').steps.join(' ')), 'sensitive skin -> no actives, mineral SPF');
var qp = S.quickWins({ faceShape: shape('round'), profile: { facialHair: 'patchy' } });
t.ok(/stubble/.test(get(qp, 'beard').steps.join(' ')), 'patchy -> stubble-first');

// brows tailored by measurement
var wide = S.quickWins({ faceShape: shape('oval'), measurements: { interocular: { ratio: 1.46 }, canthal: { avg: 3 } } });
t.ok(/wider apart/.test(get(wide, 'brows').steps.join(' ')) && /1\.46/.test(get(wide, 'brows').because), 'wide-set eyes -> brow tip with measurement');
var close = S.quickWins({ faceShape: shape('oval'), measurements: { interocular: { ratio: 1.08 }, canthal: { avg: -2.5 } } });
var cb = get(close, 'brows').steps.join(' ');
t.ok(/closer than average/.test(cb) && /tail/.test(cb), 'close-set + downward tilt -> both brow tips');
var avg = S.quickWins({ faceShape: shape('oval'), measurements: { interocular: { ratio: 1.28 }, canthal: { avg: 4 } } });
t.eq(get(avg, 'brows').because, null, 'typical eyes -> generic brow grooming, no because');

// ---- ethics lint over every user-facing string ----
var BANNED = /\bflaw|\bfix your|surgery|surgical|filler|botox|minoxidil|finasteride|dutasteride|rogaine|mewing (works|reshapes|rebuilds)|\bugly|unattractive/i;
var texts = [];
(function walk(o) {
  if (typeof o === 'string') texts.push(o);
  else if (o && typeof o === 'object') Object.keys(o).forEach(function (k) { walk(o[k]); });
})([S.SHAPE_GOALS, S.CARE, S.THICKNESS_STEP, S.FRINGE_ON, S.FRINGE_OFF, S.THINNING, S.BEARD, S.EYEWEAR, S.SKIN,
    HS.STYLES, HS.AVOID, HS.GOAL_BENEFIT, C.CONTENT, q1, qp, wide, close]);
var hits = texts.filter(function (x) { return BANNED.test(x); });
t.eq(hits.length, 0, 'ethics lint: no banned wording in ' + texts.length + ' strings' + (hits.length ? ' -> ' + hits[0] : ''));

t.done();
