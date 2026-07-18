/* =================================================================
   CONTOUR — history.js
   Local, privacy-preserving progress history. Stores ONLY numbers —
   composite, per-feature scores, confidence, timestamp. Never the
   photo, never landmarks. Pure module: the storage object is injected
   ({getItem,setItem,removeItem}, i.e. localStorage in the browser) so
   Node tests can pass a stub.
   ================================================================= */

(function (root) {
  'use strict';

  var KEY = 'contour.history.v1';
  var CAP = 50;                 // newest CAP entries are kept

  function load(storage) {
    try {
      var raw = storage.getItem(KEY);
      if (!raw) return [];
      var list = JSON.parse(raw);
      if (!Array.isArray(list)) return [];
      return list.filter(function (e) {
        return e && typeof e.composite === 'number' && typeof e.t === 'string';
      });
    } catch (err) {
      return [];                // corrupt storage -> start fresh
    }
  }

  function save(storage, list) {
    try { storage.setItem(KEY, JSON.stringify(list)); } catch (err) { /* quota — ignore */ }
  }

  /* Append an entry {composite, confidence, features:{k:score}}.
     Returns the stored entry (with id + t). */
  function push(storage, entry) {
    var list = load(storage);
    var stored = {
      id: 'h' + Date.now() + '-' + Math.floor(Math.random() * 1e4),
      t: new Date().toISOString(),
      composite: entry.composite,
      confidence: entry.confidence || null,
      features: entry.features || {}
    };
    list.push(stored);
    if (list.length > CAP) list = list.slice(list.length - CAP);
    save(storage, list);
    return stored;
  }

  /* Patch an existing entry by id (e.g. after a hairline drag re-scores). */
  function update(storage, id, patch) {
    var list = load(storage);
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) {
        for (var k in patch) list[i][k] = patch[k];
        save(storage, list);
        return list[i];
      }
    }
    return null;
  }

  function clear(storage) {
    try { storage.removeItem(KEY); } catch (err) { /* ignore */ }
  }

  /* Delta of each entry's composite vs the previous entry (chronological).
     Returns array of {entry, delta|null}. */
  function withDeltas(list) {
    return list.map(function (e, i) {
      return { entry: e, delta: i > 0 ? e.composite - list[i - 1].composite : null };
    });
  }

  var api = { KEY: KEY, CAP: CAP, load: load, push: push, update: update, clear: clear, withDeltas: withDeltas };
  root.ContourHistory = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

})(typeof window !== 'undefined' ? window : this);
