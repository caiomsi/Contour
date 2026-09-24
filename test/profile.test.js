/* profile.js — validation, storage round-trip, corruption, summary. */
'use strict';

var P = require('../js/profile.js');
var t = require('../test/_assert.js').suite('PROFILE');

function stub(initial) {
  var m = {};
  if (initial !== undefined) m[P.KEY] = initial;
  return {
    getItem: function (k) { return k in m ? m[k] : null; },
    setItem: function (k, v) { m[k] = String(v); },
    removeItem: function (k) { delete m[k]; },
    _m: m
  };
}
function throwing() {
  return {
    getItem: function () { throw new Error('blocked'); },
    setItem: function () { throw new Error('blocked'); },
    removeItem: function () { throw new Error('blocked'); }
  };
}

// ---- empty / corrupt / blocked storage -> {} ----
t.eq(Object.keys(P.load(stub())).length, 0, 'empty storage -> {}');
t.eq(Object.keys(P.load(stub('{{nope'))).length, 0, 'corrupt JSON -> {}');
t.eq(Object.keys(P.load(throwing())).length, 0, 'blocked storage -> {}');
t.ok(P.isEmpty(P.load(stub())), 'isEmpty on empty');

// ---- validate drops unknown fields and values ----
var v = P.validate({ hairTexture: 'curly', hairThickness: 'huge', photo: 'data:...', lengthPref: 'long', skinType: 42 });
t.eq(v.hairTexture, 'curly', 'keeps valid texture');
t.eq(v.lengthPref, 'long', 'keeps valid length');
t.ok(!('hairThickness' in v), 'drops unknown value');
t.ok(!('photo' in v), 'drops unknown field (never stores anything else)');
t.ok(!('skinType' in v), 'drops wrong-typed value');

// ---- round trip ----
var s = stub();
var saved = P.save(s, { hairTexture: 'coily', hairThickness: 'fine', facialHair: 'patchy', glasses: 'yes', bogus: 1 });
t.eq(saved.hairTexture, 'coily', 'save returns cleaned profile');
var back = P.load(s);
t.eq(back.hairTexture, 'coily', 'load round-trips texture');
t.eq(back.glasses, 'yes', 'load round-trips glasses');
t.ok(!('bogus' in JSON.parse(s._m[P.KEY])), 'stored JSON holds only known fields');
t.ok(!P.isEmpty(back), 'not empty after save');

// ---- clear ----
P.clear(s);
t.ok(P.isEmpty(P.load(s)), 'clear forgets the answers');
P.save(throwing(), { hairTexture: 'wavy' });   // must not throw
P.clear(throwing());
t.ok(true, 'blocked storage never throws');

// ---- every field has options with labels; ORDER covers FIELDS ----
t.eq(P.ORDER.length, Object.keys(P.FIELDS).length, 'ORDER lists every field');
P.ORDER.forEach(function (k) {
  t.ok(P.FIELDS[k].options.length >= 2 && P.FIELDS[k].label, k + ' has label + options');
});

// ---- summary ----
t.eq(P.summary({ hairTexture: 'curly', hairThickness: 'fine', lengthPref: 'long' }), 'Curly · Fine · Long', 'summary joins hair answers');
t.ok(/glasses/.test(P.summary({ glasses: 'yes' })), 'summary mentions glasses');
t.eq(P.summary({ lengthPref: 'open', skinType: 'unsure' }), '', 'non-committal answers add nothing');

t.done();
