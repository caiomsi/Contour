/* history.js — storage stub round-trips, cap, corruption, deltas. */
'use strict';

var H = require('../js/history.js');
var t = require('../test/_assert.js').suite('HISTORY');

function stub(initial) {
  var m = {};
  if (initial !== undefined) m[H.KEY] = initial;
  return {
    getItem: function (k) { return k in m ? m[k] : null; },
    setItem: function (k, v) { m[k] = String(v); },
    removeItem: function (k) { delete m[k]; },
    _m: m
  };
}

// ---- empty + corrupt storage -> [] ----
t.eq(H.load(stub()).length, 0, 'empty storage -> []');
t.eq(H.load(stub('not json{{{')).length, 0, 'corrupt JSON -> []');
t.eq(H.load(stub('{"a":1}')).length, 0, 'non-array JSON -> []');
t.eq(H.load(stub('[{"bogus":true},null]')).length, 0, 'malformed entries filtered out');

// ---- push stores an entry with id + timestamp ----
var s = stub();
var e1 = H.push(s, { composite: 78, confidence: 'high', features: { symmetry: 100 } });
t.ok(e1.id && typeof e1.id === 'string', 'entry gets an id');
t.ok(!isNaN(Date.parse(e1.t)), 'entry gets a valid ISO timestamp');
var list1 = H.load(s);
t.eq(list1.length, 1, 'one entry stored');
t.eq(list1[0].composite, 78, 'composite round-trips');
t.eq(list1[0].features.symmetry, 100, 'features round-trip');

// ---- update patches by id ----
var patched = H.update(s, e1.id, { composite: 82 });
t.eq(patched.composite, 82, 'update returns patched entry');
t.eq(H.load(s)[0].composite, 82, 'update persists');
t.eq(H.update(s, 'nope', { composite: 1 }), null, 'unknown id -> null');

// ---- cap keeps newest CAP entries ----
var s2 = stub();
for (var i = 0; i < H.CAP + 7; i++) H.push(s2, { composite: i });
var capped = H.load(s2);
t.eq(capped.length, H.CAP, 'capped at ' + H.CAP);
t.eq(capped[capped.length - 1].composite, H.CAP + 6, 'newest entry kept');
t.eq(capped[0].composite, 7, 'oldest overflow dropped');

// ---- deltas ----
var s3 = stub();
H.push(s3, { composite: 70 });
H.push(s3, { composite: 75 });
H.push(s3, { composite: 72 });
var d = H.withDeltas(H.load(s3));
t.eq(d[0].delta, null, 'first entry has no delta');
t.eq(d[1].delta, 5, 'delta +5');
t.eq(d[2].delta, -3, 'delta -3');

// ---- clear ----
H.clear(s3);
t.eq(H.load(s3).length, 0, 'clear empties history');

t.done();
