/* =================================================================
   CONTOUR — landmarks-agg.js
   Burst aggregation for camera captures. A single video frame carries
   landmark jitter (a few % of eye spacing) straight into the scores;
   taking several frames and combining them removes most of it. Pure
   module: no DOM, no MediaPipe — plain landmark arrays in, one out.

   Method:
     1. pick the reference frame = the medoid (closest to all others),
     2. align every frame to it with a 2D similarity transform (scale +
        rotation + translation, least-squares / Procrustes) fitted on
        stable anchor points, so small head movement between frames
        doesn't blur the result,
     3. take the per-landmark MEDIAN of the aligned frames (robust to a
        single bad frame, e.g. a blink).
   Returns the aggregate in the same normalized [0,1] space, the index
   of the reference frame (whose pixels the caller should keep), and a
   jitter "spread" in IPD units for the quality gates.
   ================================================================= */

(function (root) {
  'use strict';

  // Eye corners, iris centres, nose bridge/base, chin, cheek edges —
  // points the model tracks steadily and that don't move with expression.
  var ANCHORS = [33, 133, 362, 263, 468, 473, 168, 6, 2, 152, 234, 454];
  var IRIS_R = 468, IRIS_L = 473;

  function toPx(lm, w, h) {
    return lm.map(function (q) { return { x: q.x * w, y: q.y * h, z: (q.z || 0) * w }; });
  }

  /* Least-squares similarity mapping src anchors onto dst anchors.
     Returns f(point) -> point (z scaled by the same factor). */
  function fitSimilarity(src, dst, idx) {
    var n = idx.length, sx = 0, sy = 0, dx = 0, dy = 0;
    for (var i = 0; i < n; i++) { sx += src[idx[i]].x; sy += src[idx[i]].y; dx += dst[idx[i]].x; dy += dst[idx[i]].y; }
    sx /= n; sy /= n; dx /= n; dy /= n;
    var num1 = 0, num2 = 0, den = 0;
    for (var j = 0; j < n; j++) {
      var ax = src[idx[j]].x - sx, ay = src[idx[j]].y - sy;
      var bx = dst[idx[j]].x - dx, by = dst[idx[j]].y - dy;
      num1 += ax * bx + ay * by;
      num2 += ax * by - ay * bx;
      den += ax * ax + ay * ay;
    }
    var p = den ? num1 / den : 1, q = den ? num2 / den : 0;   // s·cosθ, s·sinθ
    var s = Math.sqrt(p * p + q * q);
    return function (pt) {
      var x = pt.x - sx, y = pt.y - sy;
      return { x: dx + p * x - q * y, y: dy + q * x + p * y, z: (pt.z || 0) * s };
    };
  }

  function median(arr) {
    var a = arr.slice().sort(function (m, n) { return m - n; });
    var k = a.length >> 1;
    return a.length % 2 ? a[k] : (a[k - 1] + a[k]) / 2;
  }

  function anchorDist(a, b) {
    var s = 0;
    for (var i = 0; i < ANCHORS.length; i++) {
      var p = a[ANCHORS[i]], q = b[ANCHORS[i]];
      s += (p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y);
    }
    return s;
  }

  /* frames: array of normalized landmark arrays (faceLandmarks[0] per
     frame). w,h: frame size in px (identical for all frames).
     Returns { landmarks, refIndex, spread, frames } or null. */
  function aggregate(frames, w, h) {
    frames = (frames || []).filter(function (f) { return f && f.length > IRIS_L; });
    if (!frames.length) return null;
    if (frames.length === 1) return { landmarks: frames[0], refIndex: 0, spread: 0, frames: 1 };

    var px = frames.map(function (f) { return toPx(f, w, h); });

    // 1) medoid reference
    var refIndex = 0, best = Infinity;
    for (var i = 0; i < px.length; i++) {
      var tot = 0;
      for (var j = 0; j < px.length; j++) if (i !== j) tot += anchorDist(px[i], px[j]);
      if (tot < best) { best = tot; refIndex = i; }
    }
    var ref = px[refIndex];

    // 2) align every frame to the reference
    var aligned = px.map(function (f, k) {
      if (k === refIndex) return f;
      var T = fitSimilarity(f, ref, ANCHORS);
      return f.map(T);
    });

    // 3) per-landmark median
    var N = ref.length, out = new Array(N);
    for (var li = 0; li < N; li++) {
      var xs = [], ys = [], zs = [];
      for (var fi = 0; fi < aligned.length; fi++) {
        xs.push(aligned[fi][li].x); ys.push(aligned[fi][li].y); zs.push(aligned[fi][li].z);
      }
      out[li] = { x: median(xs), y: median(ys), z: median(zs) };
    }

    // jitter: RMS distance of aligned frames from the median, in IPD units
    var ipd = Math.hypot(out[IRIS_R].x - out[IRIS_L].x, out[IRIS_R].y - out[IRIS_L].y) || 1e-6;
    var ss = 0, cnt = 0;
    for (var a = 0; a < aligned.length; a++) {
      for (var b = 0; b < N; b++) {
        var ddx = aligned[a][b].x - out[b].x, ddy = aligned[a][b].y - out[b].y;
        ss += ddx * ddx + ddy * ddy; cnt++;
      }
    }
    var spread = Math.sqrt(ss / cnt) / ipd;

    return {
      landmarks: out.map(function (q) { return { x: q.x / w, y: q.y / h, z: q.z / w }; }),
      refIndex: refIndex,
      spread: spread,
      frames: frames.length
    };
  }

  var api = { ANCHORS: ANCHORS, fitSimilarity: fitSimilarity, median: median, aggregate: aggregate };
  root.ContourLandmarksAgg = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

})(typeof window !== 'undefined' ? window : this);
