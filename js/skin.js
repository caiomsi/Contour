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
    // Cheek reference (mid-cheek, well below the eye).
    var cheekR = { x: px[LM.CHEEK_R].x, y: px[LM.CHEEK_R].y };
    var cheekL = { x: px[LM.CHEEK_L].x, y: px[LM.CHEEK_L].y };

    var sUR = sampleAround(img, underR.x, underR.y, rad);
    var sUL = sampleAround(img, underL.x, underL.y, rad);
    var sCR = sampleAround(img, cheekR.x, cheekR.y, rad);
    var sCL = sampleAround(img, cheekL.x, cheekL.y, rad);
    if (!sUR || !sUL || !sCR || !sCL) return null;

    // Under-eye darkness: cheek brighter than under-eye => positive.
    var cheekLum = (sCR.lum + sCL.lum) / 2 || 1e-6;
    var underLum = (sUR.lum + sUL.lum) / 2;
    var underEyeDelta = (cheekLum - underLum) / cheekLum;   // ~0 none, .25+ notable

    // Redness index over cheeks (0..~0.4). Normalized to 0..1 by /255.
    function redness(s) { return (s.r - (s.g + s.b) / 2) / 255; }
    var rednessIdx = (redness(sCR) + redness(sCL)) / 2;

    // Map signals to a capped 0-100 "skin" score (higher = fewer flags).
    // Deliberately gentle: only pronounced signals move it much.
    var penUnder = clamp01((underEyeDelta - 0.08) / 0.30) * 45;   // up to -45
    var penRed = clamp01((rednessIdx - 0.10) / 0.22) * 35;        // up to -35
    var score = Math.round(clamp(100 - penUnder - penRed, 0, 100));

    return {
      underEye: { delta: underEyeDelta, flagged: underEyeDelta > 0.16 },
      redness: { index: rednessIdx, flagged: rednessIdx > 0.17 },
      score: score,
      confidence: 'low',      // always: pixel signals are photo-dependent
      samples: { underR: sUR, underL: sUL, cheekR: sCR, cheekL: sCL }
    };
  }

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function clamp01(v) { return clamp(v, 0, 1); }

  var api = { compute: compute, sampleAround: sampleAround, luminance: luminance };
  root.ContourSkin = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

})(typeof window !== 'undefined' ? window : this);
