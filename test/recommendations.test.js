/* recommendations.js — quick wins: findings fire, tailored items merge,
   every item is a checklist, dedupe, cap, basics always present. */
'use strict';

var R = require('../js/recommendations.js');
var t = require('../test/_assert.js').suite('RECOMMENDATIONS');

function has(list, id) { return list.some(function (x) { return x.id === id; }); }
function get(list, id) { return list.filter(function (x) { return x.id === id; })[0]; }

function ctx(over) {
  var base = {
    measurements: {},
    scores: { features: { symmetry: { score: 90 }, canthal: { score: 90 }, interocular: { score: 90 }, fwhr: { score: 90 } } },
    skin: { underEye: { flagged: false, delta: 0.05 }, redness: { flagged: false, index: 0.02 } },
    faceShape: { shape: 'oval', secondary: 'round', leaning: false }
  };
  return Object.assign(base, over || {});
}

// ---- nothing notable -> a short, useful default list ----
var l0 = R.generate(ctx());
t.ok(has(l0, 'skin-routine') && has(l0, 'brows') && has(l0, 'photos') && has(l0, 'basics'), 'defaults: skin routine, brows, photos, basics');
t.ok(!has(l0, 'under-eye') && !has(l0, 'redness') && !has(l0, 'sym-habits'), 'no findings -> no finding items');
t.ok(l0.every(function (x) { return x.steps.length >= 3 && x.title && x.body; }), 'every item is a checklist (>=3 steps)');

// ---- findings fire with a because ----
var l1 = R.generate(ctx({ skin: { underEye: { flagged: true, delta: 0.25 }, redness: { flagged: true, index: 0.12 } } }));
t.ok(has(l1, 'under-eye') && get(l1, 'under-eye').because.length > 10, 'under-eye flag -> checklist tied to finding');
t.ok(has(l1, 'redness'), 'redness flag -> calm-redness checklist');
t.eq(l1[0].priority, 9, 'findings come first');

var l2 = R.generate(ctx({ scores: { features: { symmetry: { score: 60 }, fwhr: { score: 90 } } } }));
t.ok(has(l2, 'sym-habits') && get(l2, 'photos').because, 'low symmetry -> habits + photo tips with reason');
t.ok(get(R.generate(ctx({ lensAdvisory: true })), 'photos').because.indexOf('close up') >= 0, 'close-up photo -> photo tips explain lens distortion');
t.ok(has(R.generate(ctx({ faceShape: { shape: 'round' } })), 'lower-face'), 'round face -> jawline habits');

// ---- profile items merge in ----
var lp = R.generate(ctx({ profile: { facialHair: 'full', glasses: 'yes', skinType: 'dry' } }));
t.ok(has(lp, 'beard') && has(lp, 'eyewear'), 'profile -> beard + glasses items');
t.ok(/dry/.test(get(lp, 'skin-routine').title), 'skin routine tailored to skin type');
t.ok(!lp.some(function (x) { return x.category === 'hair'; }), 'hair is its own section, not a quick win');

// ---- dedupe + cap + basics survives ----
var busy = R.generate(ctx({
  skin: { underEye: { flagged: true, delta: 0.3 }, redness: { flagged: true, index: 0.3 } },
  scores: { features: { symmetry: { score: 40 }, fwhr: { score: 40 } } },
  faceShape: { shape: 'round' }, lensAdvisory: true,
  profile: { facialHair: 'full', glasses: 'yes', skinType: 'oily' },
  measurements: { interocular: { ratio: 1.5 } }
}));
t.ok(busy.length <= R.CAP, 'capped at ' + R.CAP + ' (got ' + busy.length + ')');
var ids = {}, dup = false; busy.forEach(function (x) { if (ids[x.id]) dup = true; ids[x.id] = 1; });
t.ok(!dup, 'no duplicate ids');
t.ok(has(busy, 'basics'), 'basics card kept even in a busy plan');
t.ok(has(busy, 'under-eye') && has(busy, 'redness'), 'findings survive the cap');

// ---- grouping helper still works ----
var g = R.groupByCategory(busy);
t.eq(g.reduce(function (n, x) { return n + x.items.length; }, 0), busy.length, 'grouping preserves all items');

t.done();
