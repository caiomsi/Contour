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
     midline looking for where forehead skin gives way to hair. Two
     passes, calibrated on a diverse set of real portraits:

     1. DARK pass — a sustained run of rows clearly darker than the
        person's own forehead. Most precise for dark/brown hair on any
        skin tone, and it ignores the gentle shading where the forehead
        curves away from the light.
     2. EDGE pass (only if 1 finds nothing) — a sharp local step in a
        colour + texture difference score, with the region above staying
        unlike the forehead. This is what finds white, grey, blonde and
        other hair that isn't darker than the skin.

     Either result is rejected when the region above looks like the
     backdrop beside the head (the top of a bald/shaved scalp, not a
     hairline). Conservative by design: null (caller keeps the heuristic
     default + draggable handle) whenever no confident transition exists.

     o = { midlineX, yStart, faceHeight, ipd, faceWidth?, mapFn?, trace? }
     Coordinates are in the caller's (roll-corrected) frame; mapFn maps
     a corrected point {x,y} back to original-image coords for sampling
     (identity when omitted). o.trace (array) collects per-row debug
     info. Returns corrected-frame y. */
  var HAIR = {
    STEP: 2,            // px between sampled rows
    MIN_LIFT: 0.02,     // × faceHeight — ignore transitions at the very start
    MAX_LIFT: 0.32,     // × faceHeight — beyond this, distrust (hat/shadow)
    SUSTAIN: 3,         // rows that must agree
    DARK: 0.62,         // dark pass: row lum below forehead × this => hair
    GAP: 0.02,          // edge pass: × faceHeight half-window for the local step
    T_STEP: 0.22,       // edge pass: above-vs-below contrast that counts as an edge
    T_REGION: 0.30,     // edge pass: above-edge rows must differ from forehead by this
    W_DARK: 1.35,       // difference weights: darker than,
    W_LIGHT: 0.55,      //   lighter than (highlights are common — weaker),
    W_CHROMA: 7.5,      //   rg-chromaticity distance (white/grey hair vs skin),
    W_TEXTURE: 2.2,     //   texture beyond the forehead's own
    SKIN_DC: 0.022,     // "still skin": chroma distance under this,
    SKIN_SD: 6,         //   texture ≤ forehead ×1.4 + this,
    SKIN_LUM: 0.6,      //   and not much darker
    BG_SIMILAR: 0.30    // above-edge vs backdrop difference below this => bald scalp edge
  };

  function chroma(s) {
    var sum = s.r + s.g + s.b || 1e-6;
    return { r: s.r / sum, g: s.g / sum };
  }

  function detectHairlineY(img, o) {
    if (!img || !img.data || !o || !o.faceHeight) return null;
    var step = HAIR.STEP;

    // Row sample centred on cx (default: midline): mean colour +
    // luminance spread across `pts` points spanning ±halfW.
    function row(yCorr, cx, halfW, pts) {
      var r = 0, g = 0, b = 0, lums = [];
      for (var k = 0; k < pts; k++) {
        var pt = { x: (cx === undefined ? o.midlineX : cx) + (k / (pts - 1) * 2 - 1) * halfW, y: yCorr };
        if (o.mapFn) pt = o.mapFn(pt);
        var smp = sampleAround(img, pt.x, pt.y, 1);
        if (!smp) continue;
        r += smp.r; g += smp.g; b += smp.b; lums.push(smp.lum);
      }
      var n = lums.length;
      if (!n || n < pts - 2) return null;
      var mean = 0; for (var i = 0; i < n; i++) mean += lums[i]; mean /= n;
      var v = 0; for (var j = 0; j < n; j++) v += (lums[j] - mean) * (lums[j] - mean);
      var col = { r: r / n, g: g / n, b: b / n };
      return { r: col.r, g: col.g, b: col.b, lum: mean, sd: Math.sqrt(v / n), c: chroma(col) };
    }
    function reference(halfW, pts) {
      var acc = { r: 0, g: 0, b: 0, lum: 0, sd: 0 }, rn = 0;
      for (var yr = o.yStart + 2; yr <= o.yStart + 12; yr += step) {
        var rs = row(yr, undefined, halfW, pts);
        if (rs) { acc.r += rs.r; acc.g += rs.g; acc.b += rs.b; acc.lum += rs.lum; acc.sd += rs.sd; rn++; }
      }
      if (!rn) return null;
      var ref = { r: acc.r / rn, g: acc.g / rn, b: acc.b / rn, lum: acc.lum / rn, sd: acc.sd / rn };
      ref.c = chroma(ref);
      return ref;
    }
    function diff(a, ref) {
      var refLum = Math.max(ref.lum, 20);
      var dl = (a.lum - refLum) / refLum;
      var dc = Math.sqrt(Math.pow(a.c.r - ref.c.r, 2) + Math.pow(a.c.g - ref.c.g, 2));
      var tx = Math.max(0, a.sd - ref.sd * 1.5 - 2) / refLum;
      return (dl < 0 ? -dl * HAIR.W_DARK : dl * HAIR.W_LIGHT) + dc * HAIR.W_CHROMA + tx * HAIR.W_TEXTURE;
    }
    var minLift = HAIR.MIN_LIFT * o.faceHeight, maxLift = HAIR.MAX_LIFT * o.faceHeight;
    var wide = Math.max(4, Math.round((o.ipd || 60) * 0.25));

    // The region above the edge vs the backdrop beside the head at the
    // same height (well outside the face). Near-identical => it's the
    // background above a bare scalp, not hair.
    function looksLikeBackdrop(edgeY) {
      if (!o.faceWidth) return false;
      var yAbove = edgeY - 0.04 * o.faceHeight;
      var above = row(yAbove, undefined, wide, 9);
      if (!above) return false;
      var off = 0.8 * o.faceWidth;
      var sides = [row(yAbove, o.midlineX - off, wide, 9), row(yAbove, o.midlineX + off, wide, 9)];
      for (var i = 0; i < sides.length; i++) {
        if (!sides[i]) continue;
        if (diff(above, sides[i]) < HAIR.BG_SIMILAR && diff(sides[i], above) < HAIR.BG_SIMILAR) return true;
      }
      return false;
    }
    function accept(edgeY, pass) {
      if (o.yStart - edgeY < minLift) return null;       // transition too close to start
      if (looksLikeBackdrop(edgeY)) return null;        // bald/shaved scalp edge
      if (o.trace) o.trace.push({ pass: pass, y: edgeY });
      return edgeY;
    }

    /* ---- pass 1: sustained darker-than-forehead run ---- */
    function darkPass() {
      var narrow = Math.max(3, Math.round((o.ipd || 60) * 0.10));
      var ref = reference(narrow, 5);
      if (!ref || ref.lum < 20) return undefined;           // forehead unreadable
      var run = 0, transitionY = null;
      for (var y = o.yStart - 2; y >= o.yStart - maxLift; y -= step) {
        var rw = row(y, undefined, narrow, 5);
        if (!rw) break;
        if (rw.lum < ref.lum * HAIR.DARK) {
          run++;
          if (transitionY === null) transitionY = y;
          if (run >= HAIR.SUSTAIN) return transitionY + step;  // hairline = just below the hair
        } else {
          run = 0; transitionY = null;
        }
      }
      return undefined;
    }

    /* ---- pass 2: colour + texture step edge ---- */
    function edgePass() {
      var ref = reference(wide, 9);
      if (!ref || ref.lum < 12) return undefined;
      function skinLike(a) {
        var dc = Math.sqrt(Math.pow(a.c.r - ref.c.r, 2) + Math.pow(a.c.g - ref.c.g, 2));
        return dc < HAIR.SKIN_DC && a.sd < ref.sd * 1.4 + HAIR.SKIN_SD && a.lum > ref.lum * HAIR.SKIN_LUM;
      }
      var gap = Math.max(step, Math.round(HAIR.GAP * o.faceHeight / step) * step);
      var k = gap / step;                               // rows per gap
      var rows = [];
      for (var y = o.yStart - 2; y >= o.yStart - maxLift - 3 * gap; y -= step) {
        var rw = row(y, undefined, wide, 9);
        if (!rw) break;
        rw.y = y; rw.d = diff(rw, ref);
        rows.push(rw);
      }
      function stepAt(i) {                              // contrast above vs below row i
        if (i - k < 0 || i + k >= rows.length) return 0;
        return Math.min(diff(rows[i + k], rows[i - k]), diff(rows[i - k], rows[i + k]));
      }
      for (var i = 0; i < rows.length; i++) {
        if (o.yStart - rows[i].y > maxLift) break;
        var st = stepAt(i);
        if (o.trace) o.trace.push({ y: rows[i].y, d: +rows[i].d.toFixed(3), step: +st.toFixed(3), lum: Math.round(rows[i].lum), sd: +rows[i].sd.toFixed(1) });
        if (st < HAIR.T_STEP) continue;
        var ok = true, skinRows = 0;
        for (var j = i + k; j <= i + k + HAIR.SUSTAIN; j++) {
          if (j >= rows.length || rows[j].d < HAIR.T_REGION) { ok = false; break; }
          if (skinLike(rows[j])) skinRows++;
        }
        if (!ok || skinRows > HAIR.SUSTAIN / 2) continue;
        var best = i, bestSt = st;                      // refine: sharpest step within one gap above
        for (var r2 = i + 1; r2 <= i + k && r2 < rows.length; r2++) {
          var s2 = stepAt(r2); if (s2 > bestSt) { bestSt = s2; best = r2; }
        }
        return rows[best].y;
      }
      return undefined;
    }

    var dark = darkPass(), got = null;
    if (dark !== undefined) got = accept(dark, 'dark');
    if (got === null) {                  // nothing darker (or it was a scalp edge)
      var edge = edgePass();
      if (edge !== undefined) got = accept(edge, 'edge');
    }
    return got;
  }

  var api = { compute: compute, sampleAround: sampleAround, luminance: luminance, detectHairlineY: detectHairlineY, HAIR: HAIR };
  root.ContourSkin = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

})(typeof window !== 'undefined' ? window : this);
