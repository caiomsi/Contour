/* =================================================================
   CONTOUR — faceshape.js
   Classifies overall face shape from the width/length/jaw inputs
   produced by analysis.js. Descriptive only — it is NOT scored; it
   drives the grooming/styling recommendations. Pure module.

   Shapes: oval, round, square, heart, diamond, oblong.

   Method (v1.3): soft prototype matching. Each input is expressed as a
   z-score against POP — the spread of real MediaPipe measurements on a
   calibration set of 58 real frontal portraits (adults, mixed sex,
   skin tone and hair; see CLAUDE.md). Face shape is a RELATIVE idea
   ("wider jaw than most"), and raw landmark ratios vary by only ~2%
   between people, so fixed cut-offs misfire; v1.2's thresholds labeled
   every real face diamond/oblong. Each shape is a prototype point in
   z-space; a softmax over distances gives a probability per shape, so
   near-boundary faces read as "oval, leaning round" instead of
   flipping.
   ================================================================= */

(function (root) {
  'use strict';

  // Population mean / spread of each input (calibration set, v1.3).
  var POP = {
    fC:  { m: 0.833, s: 0.022 },   // forehead width / cheek width
    jC:  { m: 0.817, s: 0.018 },   // jaw width / cheek width
    lw:  { m: 1.390, s: 0.090 },   // face length / cheek width
    jaw: { m: 132.7, s: 3.5 }      // jaw-corner angle (deg): lower = squarer
  };

  // Prototypes in z-units: [fC, jC, lw, jaw].
  var PROTOS = {
    oval:    [0.0, -0.3, 0.3, 0.3],   // balanced, a little longer than wide, soft jaw
    round:   [0.0, 0.0, -1.4, 1.0],   // short for its width, soft rounded jaw
    square:  [0.6, 1.3, -0.9, -1.3],  // broad jaw and forehead, angular jaw corner
    oblong:  [0.0, 0.3, 1.6, -0.3],   // clearly long for its width
    heart:   [1.2, -1.3, 0.2, 0.6],   // broad forehead tapering to a narrow jaw
    diamond: [-1.3, -1.0, 0.2, 0.0]   // cheekbones widest, narrower forehead and jaw
  };
  var SHAPES = ['oval', 'round', 'square', 'oblong', 'heart', 'diamond'];
  var TEMP = 1.0;                 // softmax temperature (z²/2 units)
  var LEAN_MARGIN = 0.15;         // top-2 closer than this => "leaning"

  function z(v, k) { return (v - POP[k].m) / POP[k].s; }

  /* input = measurements.shapeInput:
       { foreheadW, cheekW, jawW, faceLen, lenToWidth, jawAngle?, hairlineKnown? }
     Returns { shape, secondary, leaning, probs, confidence (0-1), ratios, note }. */
  function classify(input) {
    var cheek = input.cheekW || 1e-6;
    var fC = input.foreheadW / cheek;
    var jC = input.jawW / cheek;
    var lw = input.lenToWidth;
    var hasJaw = typeof input.jawAngle === 'number' && isFinite(input.jawAngle);
    var ratios = { foreheadToCheek: fC, jawToCheek: jC, lenToWidth: lw };
    if (hasJaw) ratios.jawAngle = input.jawAngle;

    var v = [z(fC, 'fC'), z(jC, 'jC'), z(lw, 'lw'), hasJaw ? z(input.jawAngle, 'jaw') : 0];
    // Face length depends on the hairline; when it's only the heuristic
    // default, trust the length term less. No jaw angle => drop that term.
    var w = [1, 1, input.hairlineKnown === false ? 0.4 : 1, hasJaw ? 0.8 : 0];

    var logits = {}, maxL = -Infinity;
    SHAPES.forEach(function (s) {
      var p = PROTOS[s], d2 = 0;
      for (var i = 0; i < 4; i++) d2 += w[i] * (v[i] - p[i]) * (v[i] - p[i]);
      logits[s] = -d2 / (2 * TEMP);
      if (logits[s] > maxL) maxL = logits[s];
    });
    var sum = 0, probs = {};
    SHAPES.forEach(function (s) { probs[s] = Math.exp(logits[s] - maxL); sum += probs[s]; });
    SHAPES.forEach(function (s) { probs[s] = probs[s] / sum; });

    var ranked = SHAPES.slice().sort(function (a, b) { return probs[b] - probs[a]; });
    var shape = ranked[0], secondary = ranked[1];
    var leaning = probs[shape] - probs[secondary] < LEAN_MARGIN;
    var conf = probs[shape];
    if (input.hairlineKnown === false) conf *= 0.85;

    return {
      shape: shape,
      secondary: secondary,
      leaning: leaning,
      probs: probs,
      confidence: Math.round(conf * 100) / 100,
      ratios: ratios,
      z: { fC: v[0], jC: v[1], lw: v[2], jaw: hasJaw ? v[3] : null },
      note: NOTES[shape]
    };
  }

  /* "oval" or "oval, leaning round" — for the shape card / because-text. */
  function describe(res) {
    if (!res) return '';
    return res.leaning ? res.shape + ', leaning ' + res.secondary : res.shape;
  }

  var NOTES = {
    oval: 'Length a little greater than width, with a gently rounded jaw — the most flexible shape for styling.',
    round: 'Width and length are similar with soft angles; styling that adds vertical length tends to flatter.',
    square: 'Strong, even jaw and forehead width; softening angles and adding a little height balances it.',
    heart: 'Wider forehead tapering to a narrower chin; balance by adding visual weight lower down.',
    diamond: 'Cheekbones the widest point with a narrower forehead and jaw; widening the forehead/jaw visually balances it.',
    oblong: 'Noticeably longer than wide; styling that adds width and avoids extra height is balancing.'
  };

  var api = { classify: classify, describe: describe, NOTES: NOTES, POP: POP, PROTOS: PROTOS, SHAPES: SHAPES };
  root.ContourFaceShape = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

})(typeof window !== 'undefined' ? window : this);
