/* =================================================================
   CONTOUR — profile.js
   The optional "Tailor your plan" answers: hair texture and thickness,
   preferred length, facial hair, skin type, glasses, hair concern.
   Hair texture can't be read reliably from one frontal photo, so the
   person tells us. Stored ONLY in this browser (localStorage), never
   sent anywhere — the AI deep report payload does not include it.

   Pure module: storage is injected ({getItem,setItem,removeItem}), the
   same pattern as history.js, so Node tests can pass a stub.
   ================================================================= */

(function (root) {
  'use strict';

  var KEY = 'contour.profile.v1';

  // Field -> { label, options: [[value, label, hint?]] }. Order = UI order.
  var FIELDS = {
    hairTexture: { label: 'Hair texture', options: [
      ['straight', 'Straight', 'lies flat, little to no bend'],
      ['wavy', 'Wavy', 'loose S-shaped bends'],
      ['curly', 'Curly', 'defined springy curls'],
      ['coily', 'Coily', 'tight coils or zig-zags'] ] },
    hairThickness: { label: 'Strand thickness', options: [
      ['fine', 'Fine'], ['medium', 'Medium'], ['coarse', 'Coarse'] ] },
    lengthPref: { label: 'Length you like', options: [
      ['short', 'Short'], ['medium', 'Medium'], ['long', 'Long'], ['open', 'Open to anything'] ] },
    facialHair: { label: 'Facial hair', options: [
      ['none', 'None / not for me'], ['full', 'Grows in full'], ['patchy', 'Grows patchy or light'] ] },
    skinType: { label: 'Skin type', options: [
      ['oily', 'Oily'], ['dry', 'Dry'], ['combination', 'Combination'], ['sensitive', 'Sensitive'], ['unsure', 'Not sure'] ] },
    glasses: { label: 'Glasses', options: [
      ['yes', 'I wear them'], ['no', 'No'] ] },
    hairConcern: { label: 'Hair concern', options: [
      ['none', 'None'], ['thinning', 'Thinning or receding'] ] }
  };
  var ORDER = ['hairTexture', 'hairThickness', 'lengthPref', 'facialHair', 'skinType', 'glasses', 'hairConcern'];

  function isValid(field, value) {
    var f = FIELDS[field];
    if (!f) return false;
    for (var i = 0; i < f.options.length; i++) if (f.options[i][0] === value) return true;
    return false;
  }

  /* Keep only known fields with known values. */
  function validate(p) {
    var out = {};
    if (!p || typeof p !== 'object') return out;
    for (var i = 0; i < ORDER.length; i++) {
      var k = ORDER[i];
      if (isValid(k, p[k])) out[k] = p[k];
    }
    return out;
  }

  function load(storage) {
    try {
      var raw = storage.getItem(KEY);
      return raw ? validate(JSON.parse(raw)) : {};
    } catch (err) {
      return {};                  // corrupt / blocked storage -> empty profile
    }
  }

  function save(storage, p) {
    var clean = validate(p);
    try { storage.setItem(KEY, JSON.stringify(clean)); } catch (err) { /* quota/blocked — ignore */ }
    return clean;
  }

  function clear(storage) {
    try { storage.removeItem(KEY); } catch (err) { /* ignore */ }
  }

  function isEmpty(p) { return !p || Object.keys(validate(p)).length === 0; }

  function optionLabel(field, value) {
    var f = FIELDS[field];
    if (!f) return value;
    for (var i = 0; i < f.options.length; i++) if (f.options[i][0] === value) return f.options[i][1];
    return value;
  }

  /* One-line summary for the collapsed card, e.g. "Curly · Fine · Long". */
  function summary(p) {
    var v = validate(p), parts = [];
    ['hairTexture', 'hairThickness', 'lengthPref'].forEach(function (k) {
      if (v[k] && v[k] !== 'open') parts.push(optionLabel(k, v[k]));
    });
    if (v.facialHair && v.facialHair !== 'none') parts.push('beard: ' + optionLabel('facialHair', v.facialHair).toLowerCase());
    if (v.skinType && v.skinType !== 'unsure') parts.push(optionLabel('skinType', v.skinType) + ' skin');
    if (v.glasses === 'yes') parts.push('glasses');
    return parts.join(' · ');
  }

  var api = {
    KEY: KEY, FIELDS: FIELDS, ORDER: ORDER,
    isValid: isValid, validate: validate, load: load, save: save, clear: clear,
    isEmpty: isEmpty, optionLabel: optionLabel, summary: summary
  };
  root.ContourProfile = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

})(typeof window !== 'undefined' ? window : this);
