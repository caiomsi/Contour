/* Synthetic landmark fixtures for Contour tests.
   Builds a 478-point normalized landmark array with full control over
   geometry, so expected measurements are analytically known. All
   coordinates normalized [0,1]; y grows downward (image convention). */

'use strict';

var N = 478;

/* A perfectly balanced, symmetric canonical face. Symmetric index
   pairs are mirrored about x=0.5 and midline points sit on x=0.5, so
   the symmetry index computes ~0. Vertical thirds are equal. */
function balancedFace() {
  var p = new Array(N);
  for (var i = 0; i < N; i++) p[i] = { x: 0.5, y: 0.5, z: 0 };

  function set(idx, x, y, z) { p[idx] = { x: x, y: y, z: z || 0 }; }
  // mirror pair: right index gets 0.5-dx, left gets 0.5+dx
  function pair(rIdx, lIdx, dx, y, z) { set(rIdx, 0.5 - dx, y, z); set(lIdx, 0.5 + dx, y, z); }

  // --- vertical midline anchors (equal thirds: 0.10 / 0.3667 / 0.6333 / 0.90) ---
  set(10, 0.5, 0.10);    // forehead top (hairline default)
  set(168, 0.5, 0.345);  // nasion
  set(8, 0.5, 0.35);
  set(6, 0.5, 0.38);
  set(9, 0.5, 0.3667);   // glabella
  set(1, 0.5, 0.52);     // nose tip
  set(2, 0.5, 0.6333);   // subnasale
  set(0, 0.5, 0.66);     // upper-lip top
  set(13, 0.5, 0.68);    // inner upper lip
  set(14, 0.5, 0.71);    // inner lower lip
  set(17, 0.5, 0.743);   // lower-lip bottom
  set(152, 0.5, 0.90);   // menton

  // --- eyes (iris + corners level => canthal tilt 0) ---
  var eyeY = 0.42;
  pair(468, 473, 0.12, eyeY);          // iris centers -> IPD 0.24
  set(33, 0.5 - 0.18, eyeY); set(133, 0.5 - 0.06, eyeY);  // right eye outer/inner
  set(362, 0.5 + 0.06, eyeY); set(263, 0.5 + 0.18, eyeY); // left eye inner/outer
  pair(159, 386, 0.12, eyeY - 0.02);   // upper lids
  pair(145, 374, 0.12, eyeY + 0.02);   // lower lids

  // --- brows ---
  pair(105, 334, 0.11, 0.35);
  pair(70, 300, 0.17, 0.35);
  pair(46, 276, 0.19, 0.355);
  pair(63, 293, 0.13, 0.345);

  // --- nose ala ---
  pair(48, 278, 0.055, 0.58);          // alar width 0.11
  pair(187, 411, 0.09, 0.55);

  // --- mouth ---
  pair(61, 291, 0.0825, 0.70);         // mouth width 0.165

  // --- face oval / cheeks / jaw (mirrored) ---
  pair(234, 454, 0.20, 0.50);          // face width 0.40
  pair(116, 345, 0.17, 0.47);          // cheeks
  pair(205, 425, 0.10, 0.55);
  pair(123, 352, 0.15, 0.50);
  pair(132, 361, 0.19, 0.55);
  pair(50, 280, 0.13, 0.52);
  pair(54, 284, 0.17, 0.20);           // frontotemporale (forehead width 0.34)
  pair(172, 397, 0.15, 0.75);          // jaw (width 0.30)
  pair(58, 288, 0.17, 0.70);
  pair(136, 365, 0.14, 0.80);
  pair(150, 379, 0.10, 0.86);
  pair(93, 323, 0.21, 0.55);
  pair(127, 356, 0.22, 0.42);

  return p;
}

/* Deep-clone so mutations in one test don't leak into another. */
function clone(p) { return p.map(function (q) { return { x: q.x, y: q.y, z: q.z }; }); }

/* Rotate the whole face by deg about (0.5,0.5) — used to prove roll
   correction removes tilt. */
function rotated(p, deg) {
  var a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  return p.map(function (q) {
    var dx = q.x - 0.5, dy = q.y - 0.5;
    return { x: 0.5 + dx * c - dy * s, y: 0.5 + dx * s + dy * c, z: q.z };
  });
}

/* Build an ImageData-shaped object filled with a base skin tone, with
   optional darker under-eye patches and redder cheeks for skin tests. */
function makeImage(w, h, opts) {
  opts = opts || {};
  var base = opts.base || { r: 205, g: 172, b: 152 };
  var data = new Uint8ClampedArray(w * h * 4);
  for (var i = 0; i < w * h; i++) {
    data[i * 4] = base.r; data[i * 4 + 1] = base.g; data[i * 4 + 2] = base.b; data[i * 4 + 3] = 255;
  }
  function fillRect(cx, cy, rad, col) {
    for (var y = Math.max(0, cy - rad); y <= Math.min(h - 1, cy + rad); y++) {
      for (var x = Math.max(0, cx - rad); x <= Math.min(w - 1, cx + rad); x++) {
        var idx = (y * w + x) * 4;
        data[idx] = col.r; data[idx + 1] = col.g; data[idx + 2] = col.b; data[idx + 3] = 255;
      }
    }
  }
  return { data: data, width: w, height: h, fillRect: fillRect };
}

module.exports = { N: N, balancedFace: balancedFace, clone: clone, rotated: rotated, makeImage: makeImage };
