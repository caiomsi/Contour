/* =================================================================
   CONTOUR — recommendations.js
   Pure rules engine. Maps findings (measurements + scores + skin +
   face shape) to a prioritized, de-duplicated, capped list of
   lifestyle recommendations, each tied to the specific observation
   that triggered it. Pure module.

   Rule = { ref (content id), priority, when(ctx) -> false | becauseString }
   ctx  = { measurements, scores, skin, faceShape }
   ================================================================= */

(function (root) {
  'use strict';

  var C = (typeof require !== 'undefined')
    ? require('./content.js')
    : root.ContourContent;

  var CAP = 10;         // never show more than this
  var TARGET_MIN = 6;   // top up with baselines below this

  function featScore(ctx, key) {
    return ctx.scores && ctx.scores.features && ctx.scores.features[key]
      ? ctx.scores.features[key].score : null;
  }

  var RULES = [
    // ---- under-eye darkness (skin) ----
    { ref: 'underEye-sleep', priority: 9, when: function (c) {
        return c.skin && c.skin.underEye && c.skin.underEye.flagged
          ? 'your under-eye area reads noticeably darker than your cheeks in this photo' : false; } },
    { ref: 'underEye-hydration', priority: 8, when: function (c) {
        return c.skin && c.skin.underEye && c.skin.underEye.flagged
          ? 'the same under-eye shadowing that fluid balance can influence' : false; } },
    { ref: 'underEye-allergy', priority: 6, when: function (c) {
        return c.skin && c.skin.underEye && c.skin.underEye.delta > 0.24
          ? 'pronounced under-eye shadowing, which irritation can add to' : false; } },

    // ---- redness (skin) ----
    { ref: 'redness-skincare', priority: 9, when: function (c) {
        return c.skin && c.skin.redness && c.skin.redness.flagged
          ? 'your cheeks show elevated redness in this photo' : false; } },
    { ref: 'redness-spf', priority: 8, when: function (c) {
        return c.skin && c.skin.redness && c.skin.redness.flagged
          ? 'visible redness, which sun exposure both drives and worsens' : false; } },
    { ref: 'redness-triggers', priority: 6, when: function (c) {
        return c.skin && c.skin.redness && c.skin.redness.index > 0.22
          ? 'pronounced facial redness that often tracks with flush triggers' : false; } },

    // ---- symmetry (habits/posture) ----
    { ref: 'asymmetry-sleep', priority: 7, when: function (c) {
        var s = featScore(c, 'symmetry');
        return (s !== null && s < 70)
          ? 'your left and right sides differ a little more than the typical range' : false; } },
    { ref: 'asymmetry-posture', priority: 6, when: function (c) {
        var s = featScore(c, 'symmetry');
        return (s !== null && s < 70)
          ? 'the same side-to-side difference, which posture influences' : false; } },
    { ref: 'asymmetry-photo', priority: 5, when: function (c) {
        var s = featScore(c, 'symmetry');
        return (s !== null && s < 78)
          ? 'a mild left/right difference that photo angle can exaggerate' : false; } },

    // ---- lower-face fullness (body-neutral, habits) ----
    { ref: 'lowerface-body', priority: 5, when: function (c) {
        var round = c.faceShape && (c.faceShape.shape === 'round');
        var lowF = featScore(c, 'fwhr');
        return (round || (lowF !== null && lowF < 55))
          ? 'a fuller-reading lower face, which soft-tissue habits can support' : false; } },

    // ---- eye framing via brows (grooming) ----
    { ref: 'brow-styling', priority: 4, when: function (c) {
        var canth = featScore(c, 'canthal'), inter = featScore(c, 'interocular');
        return ((canth !== null && canth < 60) || (inter !== null && inter < 60))
          ? 'your eye framing, which brow shaping can visually balance' : false; } }
  ];

  /* ctx must include measurements, scores; skin and faceShape optional. */
  function generate(ctx) {
    var out = [];
    var seen = {};

    function pushItem(item, priority, because) {
      if (!item || seen[item.id]) return;
      seen[item.id] = true;
      out.push({
        id: item.id, category: item.category,
        categoryLabel: C.CATEGORIES[item.category] || item.category,
        title: item.title, body: item.body, why: item.why,
        priority: priority, because: because || null
      });
    }

    // 1) fire finding-driven rules
    for (var i = 0; i < RULES.length; i++) {
      var r = RULES[i];
      var res = r.when(ctx);
      if (res) pushItem(C.CONTENT[r.ref], r.priority, res);
    }

    // 2) face-shape grooming (always, if we have a shape)
    if (ctx.faceShape && ctx.faceShape.shape) {
      var styling = C.FACE_SHAPE_STYLING[ctx.faceShape.shape];
      if (styling) {
        pushItem({
          id: 'grooming-' + ctx.faceShape.shape, category: 'grooming',
          title: 'Styling for a ' + ctx.faceShape.shape + '-leaning face',
          body: styling,
          why: 'Cut, beard, brow and eyewear choices can visually balance your proportions with nothing permanent.'
        }, 6, 'your face reads closest to a ' + ctx.faceShape.shape + ' shape');
      }
    }

    // 3) top up with baselines to TARGET_MIN, and always ensure SPF + sleep
    var ensure = ['base-spf', 'base-sleep'];
    for (var e = 0; e < ensure.length; e++) pushItem(C.CONTENT[ensure[e]], 3);
    for (var b = 0; b < C.BASELINE_IDS.length && out.length < TARGET_MIN; b++) {
      pushItem(C.CONTENT[C.BASELINE_IDS[b]], 2);
    }

    // 4) sort by priority (desc), then category for stable grouping; cap
    out.sort(function (a, b2) {
      if (b2.priority !== a.priority) return b2.priority - a.priority;
      return a.category < b2.category ? -1 : a.category > b2.category ? 1 : 0;
    });
    return out.slice(0, CAP);
  }

  /* Group a generated list by category for the report UI. */
  function groupByCategory(list) {
    var groups = {};
    var order = [];
    for (var i = 0; i < list.length; i++) {
      var cat = list[i].category;
      if (!groups[cat]) { groups[cat] = { label: list[i].categoryLabel, items: [] }; order.push(cat); }
      groups[cat].items.push(list[i]);
    }
    return order.map(function (cat) { return { category: cat, label: groups[cat].label, items: groups[cat].items }; });
  }

  var api = { RULES: RULES, CAP: CAP, TARGET_MIN: TARGET_MIN, generate: generate, groupByCategory: groupByCategory };
  root.ContourRecommendations = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

})(typeof window !== 'undefined' ? window : this);
