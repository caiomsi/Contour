/* =================================================================
   CONTOUR — scoring.js
   Turns raw measurements into explainable 0–100 feature scores and a
   weighted composite. Pure module.

   Method: each feature scores with a piecewise-linear PLATEAU — full
   100 inside an "ideal" band [b,c], linear falloff to zero at the
   outer edges [a,d]. This is deliberately simple and legible: every
   number a reader sees can be traced to one row of the BANDS table.

   IMPORTANT: the numbers in BANDS and WEIGHTS are tunable,
   literature-informed heuristics — NOT objective truths about faces.
   They encode common "neoclassical" proportion targets, which are
   culture-bound. This is the single place to adjust them.
   ================================================================= */

(function (root) {
  'use strict';

  // a: falloff start (score 0), b: ideal start (score 100),
  // c: ideal end (score 100), d: falloff end (score 0).
  // Use -Infinity / Infinity for "lower/higher is simply better".
  var NINF = -Infinity, PINF = Infinity;

  // Bands were re-centered against a small, deliberately diverse set of
  // frontal reference faces (see CLAUDE.md "Scoring & tuning"): the raw
  // neoclassical targets scored ordinary, symmetric faces poorly —
  // especially eye spacing and nose width, whose canonical "ideals" are
  // Eurocentric-tight and don't match MediaPipe's landmark placement.
  // Plateaus are wide on purpose: low scores are reserved for genuinely
  // large deviations, not everyday variation.
  var BANDS = {
    // lower-is-better deviation metrics
    thirds:      { a: NINF, b: NINF, c: 0.035, d: 0.14,  dir: 'low',  fmt: 'dev' },
    fifths:      { a: NINF, b: NINF, c: 0.03,  d: 0.11,  dir: 'low',  fmt: 'dev' },
    symmetry:    { a: NINF, b: NINF, c: 0.05,  d: 0.16,  dir: 'low',  fmt: 'dev' },
    // target-range metrics
    canthal:     { a: -6,   b: 1,    c: 10,    d: 18,    dir: 'mid',  fmt: 'deg' },
    interocular: { a: 0.95, b: 1.10, c: 1.42,  d: 1.60,  dir: 'mid',  fmt: 'ratio' },
    nose:        { a: 0.75, b: 0.90, c: 1.25,  d: 1.55,  dir: 'mid',  fmt: 'ratio' },
    mouthNose:   { a: 1.10, b: 1.30, c: 1.65,  d: 1.95,  dir: 'mid',  fmt: 'ratio' },
    lips:        { a: 0.30, b: 0.45, c: 0.72,  d: 1.05,  dir: 'mid',  fmt: 'ratio' },
    midface:     { a: 0.40, b: 0.48, c: 0.60,  d: 0.72,  dir: 'mid',  fmt: 'ratio' },
    fwhr:        { a: 1.55, b: 1.75, c: 2.20,  d: 2.55,  dir: 'mid',  fmt: 'ratio' },
    skin:        { a: 0,    b: 55,   c: 100,   d: 100,   dir: 'high', fmt: 'score' }
  };

  var WEIGHTS = {
    symmetry: 0.18, thirds: 0.12, fifths: 0.10, canthal: 0.10,
    interocular: 0.08, nose: 0.10, mouthNose: 0.05, lips: 0.07,
    midface: 0.07, fwhr: 0.05, skin: 0.08
  };

  // Human labels for each scored feature.
  var LABELS = {
    symmetry: 'Facial symmetry', thirds: 'Vertical thirds', fifths: 'Horizontal fifths',
    canthal: 'Canthal tilt', interocular: 'Eye spacing', nose: 'Nose width',
    mouthNose: 'Mouth-to-nose width', lips: 'Lip proportion', midface: 'Midface ratio',
    fwhr: 'Facial width-to-height', skin: 'Skin signals'
  };

  function plateau(v, band) {
    var a = band.a, b = band.b, c = band.c, d = band.d;
    if (v <= a) return 0;
    if (v < b) return 100 * (v - a) / (b - a);
    if (v <= c) return 100;
    if (v < d) return 100 * (d - v) / (d - c);
    return 0;
  }

  function tier(score) {
    if (score >= 80) return 'typical';        // within the common range
    if (score >= 55) return 'slightly';       // slightly outside
    return 'outside';                         // noticeably outside
  }

  /* measurements = output of analysis.analyze(); skin = optional
     { score, confidence } from skin.js (may be null if not measured).
     Returns { features, composite, confidence, weightsUsed }. */
  function score(measurements, skin, gateConfidence) {
    var raw = {
      symmetry: measurements.symmetry.asymNorm,
      thirds: measurements.thirds.maxDev,
      fifths: measurements.fifths.rmsDev,
      canthal: measurements.canthal.avg,
      interocular: measurements.interocular.ratio,
      nose: measurements.nose.toIntercanthal,
      mouthNose: measurements.lips.mouthToNose,
      lips: measurements.lips.ratio,
      midface: measurements.midface.ratio,
      fwhr: measurements.fwhr.ratio
    };
    if (skin && typeof skin.score === 'number') raw.skin = skin.score;

    var features = {};
    var sumW = 0, acc = 0;
    for (var key in BANDS) {
      if (!(key in raw)) continue;               // e.g. skin absent
      var s = plateau(raw[key], BANDS[key]);
      s = Math.round(s);
      features[key] = {
        label: LABELS[key], value: raw[key], score: s,
        tier: tier(s), band: BANDS[key], weight: WEIGHTS[key]
      };
      var w = WEIGHTS[key];
      sumW += w; acc += w * s;
    }
    var composite = sumW ? Math.round(acc / sumW) : 0;

    return {
      features: features,
      composite: composite,
      confidence: gateConfidence || 'medium',
      weightsUsed: sumW
    };
  }

  var api = {
    BANDS: BANDS, WEIGHTS: WEIGHTS, LABELS: LABELS,
    plateau: plateau, tier: tier, score: score
  };
  root.ContourScoring = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

})(typeof window !== 'undefined' ? window : this);
