/* =================================================================
   CONTOUR — recommendations.js
   Pure rules engine for the "Quick wins" section. Maps findings
   (measurements + scores + skin + face shape) and the optional profile
   to a short, prioritized, de-duplicated list of step-by-step items,
   each tied to the observation that triggered it. Hair is NOT here —
   it has its own section (styling.hairPlan).

   Rule = { ref (content id), priority, when(ctx) -> false | becauseString }
   ctx  = { measurements, scores, skin, faceShape, profile?, lensAdvisory? }
   Item = { id, category, categoryLabel, title, body, steps, priority, because }
   ================================================================= */

(function (root) {
  'use strict';

  var C = (typeof require !== 'undefined')
    ? require('./content.js')
    : root.ContourContent;
  var S = (typeof require !== 'undefined')
    ? require('./styling.js')
    : root.ContourStyling;

  var CAP = 8;          // a short list people will actually read

  function featScore(ctx, key) {
    return ctx.scores && ctx.scores.features && ctx.scores.features[key]
      ? ctx.scores.features[key].score : null;
  }

  var RULES = [
    { ref: 'under-eye', priority: 9, when: function (c) {
        return c.skin && c.skin.underEye && c.skin.underEye.flagged
          ? 'your under-eye area reads darker than your cheeks in this photo' : false; } },
    { ref: 'redness', priority: 9, when: function (c) {
        return c.skin && c.skin.redness && c.skin.redness.flagged
          ? 'your cheeks read redder than the rest of your face in this photo' : false; } },
    { ref: 'sym-habits', priority: 6, when: function (c) {
        var s = featScore(c, 'symmetry');
        return (s !== null && s < 70)
          ? 'your left and right sides differ a little more than typical' : false; } },
    { ref: 'photos', priority: 5, when: function (c) {
        var s = featScore(c, 'symmetry');
        if (c.lensAdvisory) return 'this photo was taken close up, which enlarges the nose and forehead';
        return (s !== null && s < 78) ? 'camera angle can exaggerate a small left/right difference' : false; } },
    { ref: 'lower-face', priority: 4, when: function (c) {
        var round = c.faceShape && c.faceShape.shape === 'round';
        var lowF = featScore(c, 'fwhr');
        return (round || (lowF !== null && lowF < 55))
          ? 'your lower face reads fuller, which everyday habits influence' : false; } }
  ];

  function generate(ctx) {
    var out = [], seen = {};

    function pushItem(item, priority, because) {
      if (!item || seen[item.id]) return;
      seen[item.id] = true;
      out.push({
        id: item.id, category: item.category,
        categoryLabel: C.CATEGORIES[item.category] || item.category,
        title: item.title, body: item.body, steps: (item.steps || []).slice(),
        priority: priority, because: because || null
      });
    }

    // 1) findings
    for (var i = 0; i < RULES.length; i++) {
      var res = RULES[i].when(ctx);
      if (res) pushItem(C.CONTENT[RULES[i].ref], RULES[i].priority, res);
    }
    // 2) tailored grooming (skin routine, beard, glasses, brows)
    var wins = S ? S.quickWins(ctx) : [];
    for (var w = 0; w < wins.length; w++) pushItem(wins[w], wins[w].priority, wins[w].because);
    // 3) always-useful extras, lowest priority
    pushItem(C.CONTENT.photos, 2, null);
    pushItem(C.CONTENT.basics, 1, null);

    out.sort(function (a, b) { return b.priority - a.priority; });
    // keep the basics card even when the list is long
    var capped = out.slice(0, CAP);
    if (!capped.some(function (x) { return x.id === 'basics'; })) capped[capped.length - 1] = out.filter(function (x) { return x.id === 'basics'; })[0];
    return capped;
  }

  /* Group a generated list by category (kept for callers/tests). */
  function groupByCategory(list) {
    var groups = {}, order = [];
    for (var i = 0; i < list.length; i++) {
      var cat = list[i].category;
      if (!groups[cat]) { groups[cat] = { label: list[i].categoryLabel, items: [] }; order.push(cat); }
      groups[cat].items.push(list[i]);
    }
    return order.map(function (cat) { return { category: cat, label: groups[cat].label, items: groups[cat].items }; });
  }

  var api = { RULES: RULES, CAP: CAP, generate: generate, groupByCategory: groupByCategory };
  root.ContourRecommendations = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

})(typeof window !== 'undefined' ? window : this);
