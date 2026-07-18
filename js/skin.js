/* =================================================================
   CONTOUR — skin.js
   Light, honest skin-surface signals sampled from image pixels inside
   landmark-defined regions. Pure module: it takes a plain
   { data, width, height } (an ImageData-shaped object) and the
   ORIGINAL (un-rotated) pixel landmarks, and returns signal values +
   a capped, low-confidence score.

   These signals are strongly lighting/white-balance dependent — they
   are surfaced with wide bands and explicit caveats, never as
   clinical findings. They flag "worth a look," not diagnoses.
   ================================================================= */

(function (root) {
  'use strict';

  var G = (typeof require !== 'undefined')
    ? require('./geometry.js')
    : root.ContourGeometry;
  var A = (typeof require !== 'undefined')
    ? require('./analysis.js')
    : root.ContourAnalysis;

  function luminance(r, g, b) { return 0.2126 * r + 0.7152 * g + 0.0722 * b; }

  /* Average RGBA over a square neighborhood around a pixel point.
     Clamps to image bounds; ignores nothing (returns 0-sample flag). */
  function sampleAround(img, cx, cy, radius) {
    var x0 = Math.max(0, Math.round(cx - radius));
    var x1 = Math.min(img.width - 1, Math.round(cx + radius));
    var y0 = Math.max(0, Math.round(cy - radius));
    var y1 = Math.min(img.height - 1, Math.round(cy + radius));
    var r = 0, g = 0, b = 0, n = 0;
    for (var y = y0; y <= y1; y++) {
      for (var x = x0; x <= x1; x++) {
        var i = (y * img.width + x) * 4;
        r += img.data[i]; g += img.data[i + 1]; b += img.data[i + 2]; n++;
      }
    }
    if (!n) return null;
    return { r: r / n, g: g / n, b: b / n, lum: luminance(r / n, g / n, b / n), n: n };
  }

  /* Compute skin signals. px = original pixel landmarks (from
     analysis.pxOriginal). Returns null if regions fall outside the
     image (e.g. tightly cropped photo). */
  function compute(img, px) {
    if (!img || !img.data || !px) return null;
    var LM = A.LM;
    var eyeW = G.dist(px[LM.EYE_R_OUT], px[LM.EYE_R_IN]) || 1;
    var rad = Math.max(2, Math.round(eyeW * 0.18));

    // Under-eye samples: a bit below each lower lid.
    var drop = eyeW * 0.45;
    var underR = { x: px[LM.EYE_R_LOWER].x, y: px[LM.EYE_R_LOWER].y + drop };
    var underL = { x: px[LM.EYE_L_LOWER].x, y: px[LM.EYE_L_LOWER].y + drop };
    // Cheek reference: frontal-lit mid-cheek (the outer-cheek points sit
    // near the face edge, where curvature shading skews the reference).
    var cheekR = { x: px[LM.MIDCHEEK_R].x, y: px[LM.MIDCHEEK_R].y };
    var cheekL = { x: px[LM.MIDCHEEK_L].x, y: px[LM.MIDCHEEK_L].y };
    // Self-reference patches for redness: mid-forehead + upper chin.
    var forehead = { x: px[LM.GLABELLA].x, y: px[LM.GLABELLA].y - eyeW * 0.9 };
    var chin = { x: px[LM.MENTON].x, y: px[LM.MENTON].y - eyeW * 0.5 };

    var sUR = sampleAround(img, underR.x, underR.y, rad);
    var sUL = sampleAround(img, underL.x, underL.y, rad);
    var sCR = sampleAround(img, cheekR.x, cheekR.y, rad);
    var sCL = sampleAround(img, cheekL.x, cheekL.y, rad);
    var sFH = sampleAround(img, forehead.x, forehead.y, rad);
    var sCH = sampleAround(img, chin.x, chin.y, rad);
    if (!sUR || !sUL || !sCR || !sCL || !sFH || !sCH) return null;

    // Under-eye darkness: cheek brighter than under-eye => positive.
    var cheekLum = (sCR.lum + sCL.lum) / 2 || 1e-6;
    var underLum = (sUR.lum + sUL.lum) / 2;
    var underEyeDelta = (cheekLum - underLum) / cheekLum;   // ~0 none, .25+ notable

    // Redness: cheek redness RELATIVE to the person's own forehead/chin
    // baseline. An absolute R-vs-GB index reads warmer skin tones as
    // "red" across the whole face — self-referencing removes that bias
    // and isolates localized cheek flushing.
    function redness(s) { return (s.r - (s.g + s.b) / 2) / 255; }
    var cheekRed = (redness(sCR) + redness(sCL)) / 2;
    var baseRed = (redness(sFH) + redness(sCH)) / 2;
    var rednessIdx = cheekRed - baseRed;                     // localized excess

    // Map signals to a capped 0-100 "skin" score (higher = fewer flags).
    // Deliberately gentle: only pronounced signals move it much.
    var penUnder = clamp01((underEyeDelta - 0.08) / 0.30) * 45;   // up to -45
    var penRed = clamp01((rednessIdx - 0.04) / 0.18) * 35;        // up to -35
    var score = Math.round(clamp(100 - penUnder - penRed, 0, 100));

    return {
      underEye: { delta: underEyeDelta, flagged: underEyeDelta > 0.16 },
      redness: { index: rednessIdx, flagged: rednessIdx > 0.07 },
      score: score,
      confidence: 'low',      // always: pixel signals are photo-dependent
      samples: { underR: sUR, underL: sUL, cheekR: sCR, cheekL: sCL, forehead: sFH, chin: sCH }
    };
  }

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function clamp01(v) { return clamp(v, 0, 1); }

  /* ---- automatic hairline (trichion) estimate ----
     Walks upward from the forehead-top landmark along the facial
     midline, comparing row luminance to a forehead-skin reference. A
     sustained dark transition (hair) marks the hairline. Conservative
     by design: returns null (caller keeps the heuristic default +
     draggable handle) when no confident transition exists — bald,
     very light hair, or hats all land there.

     o = { midlineX, yStart, faceHeight, ipd, mapFn? }
     Coordinates are in the caller's (roll-corrected) frame; mapFn
     maps a corrected point {x,y} back to original-image coords for
     sampling (identity when omitted). Returns corrected-frame y. */
  function detectHairlineY(img, o) {
    if (!img || !img.data || !o || !o.faceHeight) return null;
    var step = 2;
    var span = Math.max(3, Math.round((o.ipd || 60) * 0.10));  // half-width of row sample
    var rad = 1;
    var minLift = 0.02 * o.faceHeight;    // ignore transitions basically at the start
    var maxLift = 0.32 * o.faceHeight;    // beyond this, distrust (hat/shadow)
    var DARK = 0.62;                      // row lum below ref*DARK => hair candidate
    var SUSTAIN = 3;                      // consecutive dark rows required

    function rowLum(yCorr) {
      var s = 0, n = 0;
      for (var dx = -2; dx <= 2; dx++) {
        var pt = { x: o.midlineX + dx * (span / 2), y: yCorr };
        if (o.mapFn) pt = o.mapFn(pt);
        var smp = sampleAround(img, pt.x, pt.y, rad);
        if (smp) { s += smp.lum; n++; }
      }
      return n ? s / n : null;
    }

    // Forehead-skin reference: a few rows just below the start point.
    var ref = 0, rn = 0;
    for (var yr = o.yStart + 2; yr <= o.yStart + 12; yr += step) {
      var l = rowLum(yr);
      if (l !== null) { ref += l; rn++; }
    }
    if (!rn) return null;
    ref /= rn;
    if (ref < 45) return null;            // forehead itself too dark to compare

    var darkRun = 0, transitionY = null;
    for (var y = o.yStart - 2; y >= o.yStart - maxLift; y -= step) {
      var lum = rowLum(y);
      if (lum === null) break;
      if (lum < ref * DARK) {
        darkRun++;
        if (transitionY === null) transitionY = y;
        if (darkRun >= SUSTAIN) {
          var lift = o.yStart - transitionY;
          if (lift < minLift) return null;   // transition too close to start
          return transitionY + step;         // hairline = just below the hair
        }
      } else {
        darkRun = 0; transitionY = null;
      }
    }
    return null;
  }

  var api = { compute: compute, sampleAround: sampleAround, luminance: luminance, detectHairlineY: detectHairlineY };
  root.ContourSkin = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

})(typeof window !== 'undefined' ? window : this);
