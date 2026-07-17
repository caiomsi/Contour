/* recommendations.js — rule firing, ties-to-finding, dedupe, cap, baseline. */
'use strict';

var R = require('../js/recommendations.js');
var t = require('../test/_assert.js').suite('RECOMMENDATIONS');

function has(list, id) { return list.some(function (x) { return x.id === id; }); }
function get(list, id) { return list.filter(function (x) { return x.id === id; })[0]; }

// context builder with sensible "all good" defaults
function ctx(over) {
  var base = {
    measurements: {},
    scores: { features: {
      symmetry: { score: 90 }, canthal: { score: 90 }, interocular: { score: 90 }, fwhr: { score: 90 }
    } },
    skin: { underEye: { flagged: false, delta: 0.05 }, redness: { flagged: false, index: 0.10 } },
    faceShape: { shape: 'oval' }
  };
  return Object.assign(base, over || {});
}

// ---- flagged under-eye -> sleep/hydration recs, with a "because" ----
var c1 = ctx({ skin: { underEye: { flagged: true, delta: 0.2 }, redness: { flagged: false, index: 0.1 } } });
var l1 = R.generate(c1);
t.ok(has(l1, 'underEye-sleep'), 'under-eye flag -> sleep rec');
t.ok(has(l1, 'underEye-hydration'), 'under-eye flag -> hydration rec');
t.ok(get(l1, 'underEye-sleep').because && get(l1, 'underEye-sleep').because.length > 5, 'rec tied to a finding');

// ---- flagged redness -> skincare/spf recs ----
var c2 = ctx({ skin: { underEye: { flagged: false, delta: 0.05 }, redness: { flagged: true, index: 0.24 } } });
var l2 = R.generate(c2);
t.ok(has(l2, 'redness-skincare'), 'redness -> skincare rec');
t.ok(has(l2, 'redness-spf'), 'redness -> spf rec');
t.ok(has(l2, 'redness-triggers'), 'strong redness -> triggers rec');

// ---- low symmetry score -> asymmetry recs ----
var c3 = ctx({ scores: { features: { symmetry: { score: 60 }, canthal: { score: 90 }, interocular: { score: 90 }, fwhr: { score: 90 } } } });
var l3 = R.generate(c3);
t.ok(has(l3, 'asymmetry-sleep'), 'low symmetry -> asymmetry sleep/chewing rec');
t.ok(has(l3, 'asymmetry-posture'), 'low symmetry -> posture rec');

// ---- face shape -> grooming rec present ----
var l4 = R.generate(ctx({ faceShape: { shape: 'round' } }));
t.ok(has(l4, 'grooming-round'), 'round shape -> grooming-round');
t.ok(get(l4, 'grooming-round').category === 'grooming', 'grooming rec categorized');

// ---- everything good -> still returns baselines incl SPF + sleep ----
var l5 = R.generate(ctx());
t.ok(has(l5, 'base-spf'), 'always ensures SPF baseline');
t.ok(has(l5, 'base-sleep'), 'always ensures sleep baseline');
t.ok(l5.length >= 3, 'returns a usable minimum, got ' + l5.length);

// ---- dedupe: no duplicate ids ----
var ids = {}, dup = false;
l1.forEach(function (x) { if (ids[x.id]) dup = true; ids[x.id] = true; });
t.ok(!dup, 'no duplicate recommendation ids');

// ---- cap: fire everything, never exceed CAP ----
var cAll = ctx({
  skin: { underEye: { flagged: true, delta: 0.3 }, redness: { flagged: true, index: 0.3 } },
  scores: { features: { symmetry: { score: 40 }, canthal: { score: 40 }, interocular: { score: 40 }, fwhr: { score: 40 } } },
  faceShape: { shape: 'round' }
});
var lAll = R.generate(cAll);
t.ok(lAll.length <= R.CAP, 'capped at ' + R.CAP + ', got ' + lAll.length);
t.ok(lAll.length > 6, 'many findings -> a full plan');

// ---- sorted by priority (descending) ----
var sorted = true;
for (var i = 1; i < lAll.length; i++) if (lAll[i].priority > lAll[i - 1].priority) sorted = false;
t.ok(sorted, 'recommendations sorted by priority desc');

// ---- grouping helper ----
var groups = R.groupByCategory(lAll);
t.ok(groups.length > 0 && groups[0].items.length > 0, 'groupByCategory returns non-empty groups');
var totalGrouped = groups.reduce(function (n, g) { return n + g.items.length; }, 0);
t.eq(totalGrouped, lAll.length, 'grouping preserves all items');

t.done();
