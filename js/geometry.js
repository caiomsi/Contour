/* =================================================================
   CONTOUR — geometry.js
   Pure 2D/3D vector math used by the analysis pipeline. No DOM, no
   dependencies. Loaded as a plain <script> in the browser (attaches
   to window.ContourGeometry) and require()'d directly by the Node
   tests (CommonJS export at the bottom).

   Coordinate conventions
   ----------------------
   MediaPipe returns normalized landmarks: x,y in [0,1] relative to the
   image width/height, z a depth estimate on roughly the same scale as
   x. Distances/angles are only meaningful in PIXEL space, so callers
   convert with toPixels(landmarks, w, h) first. After that, every
   helper here works on {x, y, z} pixel points.
   ================================================================= */

(function (root) {
  'use strict';

  var DEG = 180 / Math.PI;

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  /* ---- basic vector ops (operate on {x,y} or {x,y,z}) ---- */
  function sub(a, b) { return { x: a.x - b.x, y: a.y - b.y, z: (a.z || 0) - (b.z || 0) }; }
  function add(a, b) { return { x: a.x + b.x, y: a.y + b.y, z: (a.z || 0) + (b.z || 0) }; }
  function scale(a, s) { return { x: a.x * s, y: a.y * s, z: (a.z || 0) * s }; }
  function mid(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: ((a.z || 0) + (b.z || 0)) / 2 }; }

  /* 2D distance — the workhorse; z is intentionally ignored so results
     match on-screen measurement. */
  function dist(a, b) {
    var dx = a.x - b.x, dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
  function dist3(a, b) {
    var dx = a.x - b.x, dy = a.y - b.y, dz = (a.z || 0) - (b.z || 0);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /* Signed angle (degrees) of the vector a->b measured from the +x
     axis, y pointing DOWN (image coords). Positive = clockwise on
     screen. */
  function angleDeg(a, b) {
    return Math.atan2(b.y - a.y, b.x - a.x) * DEG;
  }

  /* Rotate a point around a center by angleRad (screen space). */
  function rotate(p, angleRad, center) {
    var c = Math.cos(angleRad), s = Math.sin(angleRad);
    var dx = p.x - center.x, dy = p.y - center.y;
    return {
      x: center.x + dx * c - dy * s,
      y: center.y + dx * s + dy * c,
      z: p.z || 0
    };
  }

  /* Convert a MediaPipe normalized landmark list to pixel points.
     z is scaled by width to keep it on the same footing as x (this is
     how MediaPipe defines the depth scale). */
  function toPixels(landmarks, w, h) {
    var out = new Array(landmarks.length);
    for (var i = 0; i < landmarks.length; i++) {
      var l = landmarks[i];
      out[i] = { x: l.x * w, y: l.y * h, z: (l.z || 0) * w, v: l.visibility };
    }
    return out;
  }

  /* Roll angle (radians) of the line joining two points — used to
     level the eyes to horizontal before measuring. */
  function rollAngleRad(leftPt, rightPt) {
    return Math.atan2(rightPt.y - leftPt.y, rightPt.x - leftPt.x);
  }

  /* Rotate an entire point array about a center. */
  function rotateAll(pts, angleRad, center) {
    var out = new Array(pts.length);
    for (var i = 0; i < pts.length; i++) {
      out[i] = rotate(pts[i], angleRad, center);
      out[i].v = pts[i].v;
    }
    return out;
  }

  /* Centroid of selected indices (or all points if idx omitted). */
  function centroid(pts, idx) {
    var sx = 0, sy = 0, n = idx ? idx.length : pts.length;
    for (var i = 0; i < n; i++) {
      var p = idx ? pts[idx[i]] : pts[i];
      sx += p.x; sy += p.y;
    }
    return { x: sx / n, y: sy / n };
  }

  /* Reflect a point across the vertical line x = axisX. */
  function reflectX(p, axisX) {
    return { x: 2 * axisX - p.x, y: p.y, z: p.z || 0 };
  }

  /* ---- head pose from MediaPipe's 4x4 facial transformation matrix ----
     mat = { rows:4, columns:4, data:[16] }. The upper-left 3x3 is the
     rotation. Row/column ordering of `data` is not guaranteed by the
     API, so this assumes row-major and is cross-checked against a
     frontal reference (should read ~0,0,0) during verification. A
     landmark-based estimate (see analysis.headPoseProxy) is used as an
     independent fallback so the quality gate never relies on this alone.

     Returns Euler angles in degrees: yaw (turn L/R), pitch (nod), roll
     (tilt). */
  function eulerFromMatrix(mat) {
    if (!mat || !mat.data || mat.data.length < 16) return null;
    var d = mat.data;
    // MediaPipe's matrix is COLUMN-MAJOR (translation in d[12..14]),
    // verified empirically. r[row][col] = d[col*4 + row].
    var r00 = d[0], r01 = d[4], r02 = d[8];
    var r10 = d[1], r11 = d[5], r12 = d[9];
    var r20 = d[2], r21 = d[6], r22 = d[10];

    var sy = Math.sqrt(r00 * r00 + r10 * r10);
    var singular = sy < 1e-6;
    var pitch, yaw, roll;
    if (!singular) {
      pitch = Math.atan2(r21, r22);
      yaw = Math.atan2(-r20, sy);
      roll = Math.atan2(r10, r00);
    } else {
      pitch = Math.atan2(-r12, r11);
      yaw = Math.atan2(-r20, sy);
      roll = 0;
    }
    return { pitch: pitch * DEG, yaw: yaw * DEG, roll: roll * DEG };
  }

  var api = {
    DEG: DEG,
    clamp: clamp, lerp: lerp,
    sub: sub, add: add, scale: scale, mid: mid,
    dist: dist, dist3: dist3, angleDeg: angleDeg,
    rotate: rotate, rotateAll: rotateAll, rollAngleRad: rollAngleRad,
    toPixels: toPixels, centroid: centroid, reflectX: reflectX,
    eulerFromMatrix: eulerFromMatrix
  };

  root.ContourGeometry = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

})(typeof window !== 'undefined' ? window : this);
