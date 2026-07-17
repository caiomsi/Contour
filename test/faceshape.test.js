/* faceshape.js — classification on constructed width/length inputs. */
'use strict';

var FS = require('../js/faceshape.js');
var t = require('../test/_assert.js').suite('FACESHAPE');

function input(foreheadW, cheekW, jawW, lenToWidth) {
  return {
    foreheadW: foreheadW, cheekW: cheekW, jawW: jawW,
    faceLen: cheekW * lenToWidth, lenToWidth: lenToWidth
  };
}

// cheekW fixed at 100 for readability.
t.eq(FS.classify(input(98, 100, 98, 1.6)).shape, 'oblong', 'long + even widths -> oblong');
t.eq(FS.classify(input(100, 100, 98, 1.05)).shape, 'square', 'short + even + strong jaw -> square');
t.eq(FS.classify(input(80, 100, 78, 1.05)).shape, 'round', 'short + tapered widths -> round');
t.eq(FS.classify(input(95, 100, 94, 1.30)).shape, 'oval', 'balanced longish -> oval');
t.eq(FS.classify(input(105, 100, 80, 1.30)).shape, 'heart', 'wide forehead, narrow jaw -> heart');
t.eq(FS.classify(input(85, 100, 85, 1.30)).shape, 'diamond', 'wide cheeks, narrow ends -> diamond');

// every result carries confidence + a note
var r = FS.classify(input(95, 100, 94, 1.3));
t.ok(r.confidence > 0 && r.confidence <= 0.9, 'confidence in (0,0.9]');
t.ok(typeof r.note === 'string' && r.note.length > 10, 'has descriptive note');
t.ok(r.ratios && typeof r.ratios.lenToWidth === 'number', 'exposes ratios');

t.done();
