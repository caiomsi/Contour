/* =================================================================
   CONTOUR — faceshape.js
   Classifies overall face shape from the width/length inputs produced
   by analysis.js. Descriptive only — it is NOT scored; it drives the
   grooming/styling recommendations. Pure module.

   Shapes: oval, round, square, heart, diamond, oblong.
   ================================================================= */

(function (root) {
  'use strict';

  /* input = measurements.shapeInput:
       { foreheadW, cheekW, jawW, faceLen, lenToWidth }
     Returns { shape, confidence (0-1), ratios, note }. */
  function classify(input) {
    var cheek = input.cheekW || 1e-6;
    var fC = input.foreheadW / cheek;      // forehead vs cheek
    var jC = input.jawW / cheek;           // jaw vs cheek
    var lw = input.lenToWidth;             // length vs cheek width
    var ratios = { foreheadToCheek: fC, jawToCheek: jC, lenToWidth: lw };

    // How "equal" the three widths are (square/round cue).
    var widthsEven = Math.abs(fC - 1) < 0.12 && Math.abs(jC - 1) < 0.12;

    var shape, conf;

    if (lw >= 1.45) {
      // Clearly longer than wide.
      if (input.foreheadW > input.cheekW && jC < 0.9) { shape = 'heart'; conf = 0.55; }
      else { shape = 'oblong'; conf = clampConf(lw - 1.45, 0.6); }
    } else if (lw <= 1.15) {
      // About as wide as long.
      if (widthsEven && jC > 0.9) { shape = 'square'; conf = 0.6; }
      else { shape = 'round'; conf = clampConf(1.15 - lw, 0.55); }
    } else {
      // Balanced, slightly longer than wide (1.15–1.45): the "ideal" band.
      if (input.foreheadW >= input.cheekW && jC < 0.88) {
        shape = 'heart'; conf = 0.55;
      } else if (fC < 0.92 && jC < 0.92) {
        shape = 'diamond'; conf = 0.5;
      } else {
        shape = 'oval'; conf = 0.7;
      }
    }

    return { shape: shape, confidence: conf, ratios: ratios, note: NOTES[shape] };
  }

  function clampConf(x, base) {
    var c = base + x;
    return c > 0.9 ? 0.9 : c < 0.4 ? 0.4 : c;
  }

  var NOTES = {
    oval: 'Length a little greater than width, with a gently rounded jaw — the most flexible shape for styling.',
    round: 'Width and length are similar with soft angles; styling that adds vertical length tends to flatter.',
    square: 'Strong, even jaw and forehead width; softening angles and adding a little height balances it.',
    heart: 'Wider forehead tapering to a narrower chin; balance by adding visual weight lower down.',
    diamond: 'Cheekbones the widest point with a narrower forehead and jaw; widening the forehead/jaw visually balances it.',
    oblong: 'Noticeably longer than wide; styling that adds width and avoids extra height is balancing.'
  };

  var api = { classify: classify, NOTES: NOTES };
  root.ContourFaceShape = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

})(typeof window !== 'undefined' ? window : this);
