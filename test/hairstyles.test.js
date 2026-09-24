/* hairstyles.js — every style is complete and practical; every
   face-shape goal × texture × length preference gets real options. */
'use strict';

var HS = require('../js/hairstyles.js');
var S = require('../js/styling.js');
var t = require('../test/_assert.js').suite('HAIRSTYLES');

var TEX = S.TEXTURES, GOALS = Object.keys(HS.GOAL_BENEFIT);
var PREFS = ['short', 'medium', 'long', 'open'];

// ---- every style entry is complete ----
var ids = {}, incomplete = [];
HS.STYLES.forEach(function (s) {
  if (ids[s.id]) incomplete.push(s.id + ' (duplicate id)');
  ids[s.id] = true;
  var ok = s.name && s.does && s.ask && s.ask.length > 40 && Array.isArray(s.steps) && s.steps.length >= 2 &&
    s.products && s.upkeep && HS.LENGTHS.indexOf(s.length) >= 0 &&
    s.textures.length && s.textures.every(function (x) { return TEX.indexOf(x) >= 0; }) &&
    GOALS.every(function (g) { return typeof s.fit[g] === 'number'; });
  if (!ok) incomplete.push(s.id);
});
t.eq(incomplete.length, 0, HS.STYLES.length + ' styles complete (ask/steps/products/upkeep/fit) ' + incomplete.join(','));
t.ok(HS.STYLES.length >= 24, 'a real library (' + HS.STYLES.length + ' styles)');

// ---- practical: barber scripts carry concrete specs ----
var concrete = HS.STYLES.filter(function (s) { return /#\d|\d\s?(in|cm|mm)|\binch|length|DevaCut|braids|twists|locs|trim/i.test(s.ask); }).length;
t.eq(concrete, HS.STYLES.length, 'every "ask for" script has concrete lengths/guards/technique');

// ---- every texture has styles at every length ----
TEX.forEach(function (x) {
  HS.LENGTHS.forEach(function (l) {
    var n = HS.STYLES.filter(function (s) { return s.textures.indexOf(x) >= 0 && s.length === l; }).length;
    t.ok(n >= 1, x + ' has ' + l + ' styles (' + n + ')');
  });
});

// ---- every goal x texture x preference returns >= 2 distinct picks ----
var gaps = [];
GOALS.forEach(function (g) {
  TEX.forEach(function (x) {
    PREFS.forEach(function (pref) {
      var picks = HS.pick(x, { primary: g }, pref, 3);
      var uniq = {}; picks.forEach(function (p) { uniq[p.id] = 1; });
      if (picks.length < 2 || Object.keys(uniq).length !== picks.length) gaps.push(g + '/' + x + '/' + pref + ':' + picks.length);
      picks.forEach(function (p) {
        if (p.textures.indexOf(x) < 0) gaps.push('wrong texture ' + p.id);
        if ((p.fit[g] || 0) < 1) gaps.push('poor fit ' + p.id + ' for ' + g);
      });
    });
  });
});
t.eq(gaps.length, 0, 'all 6 goals x 4 textures x 4 length prefs -> >=2 good picks ' + gaps.slice(0, 4).join(' '));

// ---- length preference is honoured when possible ----
var shortPicks = HS.pick('straight', { primary: 'height' }, 'short', 3);
t.ok(shortPicks[0].length === 'short', 'short preference -> short style first (' + shortPicks[0].name + ')');
var openPicks = HS.pick('wavy', { primary: 'flexible' }, 'open', 3);
var lens = {}; openPicks.forEach(function (p) { lens[p.length] = 1; });
t.ok(Object.keys(lens).length >= 2, 'open preference -> a spread of lengths');

// ---- goal changes the answer ----
t.eq(HS.pick('straight', { primary: 'height' }, 'short', 1)[0].id, 'quiff', 'round face + straight + short -> quiff');
t.ok(HS.pick('straight', { primary: 'width' }, 'short', 1)[0].fit.width === 2, 'long face + short -> a width-adding cut');
t.ok(HS.pick('coily', { primary: 'height' }, 'short', 1)[0].fit.height === 2, 'round face + coily + short -> a height cut');

// ---- why sentence explains the fit ----
t.ok(/lengthens|length/.test(shortPicks[0].why), 'why explains the benefit for the face');

// ---- thinning prefers short cuts ----
t.eq(HS.pick('straight', { primary: 'flexible' }, 'open', 1, { preferShort: true })[0].length, 'short', 'thinning -> short cut first');

// ---- every goal has things to skip ----
GOALS.forEach(function (g) { t.ok(HS.AVOID[g] && HS.AVOID[g].length >= 2, g + ' has an avoid list'); });

t.done();
