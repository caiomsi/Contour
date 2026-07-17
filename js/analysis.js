/* =================================================================
   CONTOUR — analysis.js
   Pure geometry → facial measurements. No DOM, no MediaPipe calls —
   it takes an already-detected landmark array and returns a plain
   measurements object. Loaded as a <script> (window.ContourAnalysis)
   and require()'d by the Node tests.

   Every measurement is roll-corrected (eyes levelled) and, where a
   ratio is reported, normalized so it is independent of image scale.
   Absolute lengths are in pixels of the corrected frame.

   Landmark indices are the canonical MediaPipe 478-point ("refine
   landmarks") mesh. Indices marked (verify) are confirmed visually
   with ?debug=1 before their formula is trusted — see README.
   ================================================================= */

(function (root) {
  'use strict';

  var G = (typeof require !== 'undefined')
    ? require('./geometry.js')
    : root.ContourGeometry;

  /* ---- named landmark indices (canonical 478 mesh) ---- */
  var LM = {
    IRIS_R: 468, IRIS_L: 473,          // iris centers (478 model only)
    FOREHEAD_TOP: 10,                  // top of forehead (hairline proxy)
    GLABELLA: 9,                       // between brows (verify)
    NASION: 168,                       // bridge root
    SUBNASALE: 2,                      // base of nose midline (verify)
    NOSE_TIP: 1,                       // (verify: 1 vs 4)
    MENTON: 152,                       // chin bottom
    EYE_R_OUT: 33, EYE_R_IN: 133,      // subject's right eye (image side varies)
    EYE_L_IN: 362, EYE_L_OUT: 263,     // subject's left eye
    EYE_R_UPPER: 159, EYE_R_LOWER: 145,
    EYE_L_UPPER: 386, EYE_L_LOWER: 374,
    ALAR_R: 48, ALAR_L: 278,           // nostril outer edges (verify)
    MOUTH_R: 61, MOUTH_L: 291,         // mouth corners
    LIP_TOP: 0, LIP_IN_UP: 13, LIP_IN_LO: 14, LIP_BOT: 17,
    FACE_R: 234, FACE_L: 454,          // face-oval widest (verify)
    BROW_R: 105, BROW_L: 334,
    FOREHEAD_R: 54, FOREHEAD_L: 284,   // frontotemporale (verify)
    CHEEK_R: 116, CHEEK_L: 345,
    JAW_R: 172, JAW_L: 397,            // gonion-ish (verify)
    GONION_R: 58, GONION_L: 288
  };

  /* Central-axis indices used to locate the vertical midline. */
  var MIDLINE_IDX = [10, 168, 8, 9, 6, 1, 2, 0, 13, 14, 17, 152];

  /* Reliable left/right mirror pairs for the symmetry index. */
  var SYMMETRIC_PAIRS = [
    [33, 263], [133, 362], [159, 386], [145, 374], [46, 276],
    [105, 334], [70, 300], [63, 293], [61, 291], [48, 278],
    [50, 280], [187, 411], [234, 454], [116, 345], [205, 425],
    [123, 352], [132, 361], [58, 288], [172, 397], [136, 365],
    [150, 379], [93, 323], [127, 356]
  ];

  function rms(arr) {
    if (!arr.length) return 0;
    var s = 0;
    for (var i = 0; i < arr.length; i++) s += arr[i] * arr[i];
    return Math.sqrt(s / arr.length);
  }

  /* Canthal tilt of one eye: + degrees means the lateral (outer)
     canthus sits higher than the medial (inner) one. Sign is made
     independent of which side the eye is on by measuring the outer
     corner's rise relative to the inner corner over the horizontal
     span. (screen y grows downward, so higher = smaller y) */
  function canthalTilt(medial, lateral) {
    var rise = medial.y - lateral.y;           // + when outer is higher
    var run = Math.abs(lateral.x - medial.x) || 1e-6;
    return Math.atan2(rise, run) * G.DEG;
  }

  /* Landmark-based head-pose proxy, independent of the transform
     matrix layout. Ratios are ~0 when frontal; scaled to rough
     degrees. Used to cross-check / back up geometry.eulerFromMatrix. */
  function headPoseProxy(p) {
    var nose = p[LM.NOSE_TIP], fr = p[LM.FACE_R], fl = p[LM.FACE_L];
    var left = Math.abs(nose.x - fr.x), right = Math.abs(fl.x - nose.x);
    var yawRatio = (left - right) / ((left + right) || 1e-6);
    // z (depth) cross-check for yaw: which cheek is farther.
    var yawZ = (fl.z - fr.z);
    var faceH = Math.abs(p[LM.MENTON].y - p[LM.FOREHEAD_TOP].y) || 1e-6;
    var pitchZ = (p[LM.MENTON].z - p[LM.FOREHEAD_TOP].z) / faceH;
    return {
      yawRatio: yawRatio,
      yawDegApprox: yawRatio * 60,
      yawZ: yawZ,
      pitchZ: pitchZ,
      pitchDegApprox: pitchZ * 90
    };
  }

  /* Main entry. rawLandmarks = faceLandmarks[0] from MediaPipe.
     opts.hairlineY (pixels, corrected frame) overrides the hairline
     prior for facial-thirds. Returns a measurements object plus the
     corrected point array and drawing anchors for the overlay. */
  function analyze(rawLandmarks, imgW, imgH, opts) {
    opts = opts || {};
    var px = G.toPixels(rawLandmarks, imgW, imgH);

    // Roll correction: level the two iris centers to horizontal.
    var irisA = px[LM.IRIS_R], irisB = px[LM.IRIS_L];
    // order by x so roll sign is orientation-agnostic
    var loEye = irisA.x <= irisB.x ? irisA : irisB;
    var hiEye = irisA.x <= irisB.x ? irisB : irisA;
    var rollRad = G.rollAngleRad(loEye, hiEye);
    var center = G.centroid(px, [LM.IRIS_R, LM.IRIS_L, LM.MENTON, LM.FOREHEAD_TOP]);
    var p = G.rotateAll(px, -rollRad, center);

    // Reference lengths
    var ipd = G.dist(p[LM.IRIS_R], p[LM.IRIS_L]) || 1e-6;
    var faceWidth = G.dist(p[LM.FACE_R], p[LM.FACE_L]);
    var faceHeight = Math.abs(p[LM.MENTON].y - p[LM.FOREHEAD_TOP].y);

    // ---- vertical thirds ----
    var glabellaY = p[LM.GLABELLA].y;
    var subnasaleY = p[LM.SUBNASALE].y;
    var mentonY = p[LM.MENTON].y;
    var hairlineY = (typeof opts.hairlineY === 'number')
      ? opts.hairlineY
      : p[LM.FOREHEAD_TOP].y - 0.085 * faceHeight;  // draggable; default lifts toward the trichion (hairline isn't in the mesh)
    var upper = glabellaY - hairlineY;
    var middle = subnasaleY - glabellaY;
    var lower = mentonY - subnasaleY;
    var totalV = upper + middle + lower || 1e-6;
    var t = { upper: upper / totalV, middle: middle / totalV, lower: lower / totalV };
    t.maxDev = Math.max(
      Math.abs(t.upper - 1 / 3), Math.abs(t.middle - 1 / 3), Math.abs(t.lower - 1 / 3)
    );

    // ---- horizontal fifths (at eye level) ----
    var xs = [LM.FACE_R, LM.EYE_R_OUT, LM.EYE_R_IN, LM.EYE_L_IN, LM.EYE_L_OUT, LM.FACE_L]
      .map(function (i) { return p[i].x; })
      .sort(function (a, b) { return a - b; });
    var segs = [], totalH = xs[5] - xs[0] || 1e-6;
    for (var i = 0; i < 5; i++) segs.push((xs[i + 1] - xs[i]) / totalH);
    var fifthsDev = rms(segs.map(function (s) { return s - 0.2; }));

    // ---- symmetry index ----
    var midlineX = 0;
    for (var m = 0; m < MIDLINE_IDX.length; m++) midlineX += p[MIDLINE_IDX[m]].x;
    midlineX /= MIDLINE_IDX.length;
    var devs = [];
    for (var s2 = 0; s2 < SYMMETRIC_PAIRS.length; s2++) {
      var L = p[SYMMETRIC_PAIRS[s2][0]], R = p[SYMMETRIC_PAIRS[s2][1]];
      if (!L || !R) continue;
      var Lref = G.reflectX(L, midlineX);
      devs.push(G.dist(Lref, R));
    }
    var asymNorm = rms(devs) / ipd;         // 0 = perfectly symmetric

    // ---- canthal tilt ----
    var tiltR = canthalTilt(p[LM.EYE_R_IN], p[LM.EYE_R_OUT]);
    var tiltL = canthalTilt(p[LM.EYE_L_IN], p[LM.EYE_L_OUT]);

    // ---- interocular / eye ratio ----
    var intercanthal = G.dist(p[LM.EYE_R_IN], p[LM.EYE_L_IN]);
    var eyeWidthR = G.dist(p[LM.EYE_R_OUT], p[LM.EYE_R_IN]);
    var eyeWidthL = G.dist(p[LM.EYE_L_OUT], p[LM.EYE_L_IN]);
    var eyeWidth = (eyeWidthR + eyeWidthL) / 2;
    var interRatio = intercanthal / (eyeWidth || 1e-6);

    // ---- fWHR (bizygomatic width / upper-lip-to-eyelid height) ----
    var fwhrWidth = faceWidth;
    var browLineY = (p[LM.EYE_R_UPPER].y + p[LM.EYE_L_UPPER].y) / 2;
    var fwhrHeight = Math.abs(p[LM.LIP_TOP].y - browLineY) || 1e-6;
    var fwhr = fwhrWidth / fwhrHeight;

    // ---- nose ----
    var alar = G.dist(p[LM.ALAR_R], p[LM.ALAR_L]);
    var mouthWidth = G.dist(p[LM.MOUTH_R], p[LM.MOUTH_L]);
    var noseToInter = alar / (intercanthal || 1e-6);
    var mouthToNose = mouthWidth / (alar || 1e-6);

    // ---- lips ----
    var upperLip = G.dist(p[LM.LIP_TOP], p[LM.LIP_IN_UP]);
    var lowerLip = G.dist(p[LM.LIP_IN_LO], p[LM.LIP_BOT]);
    var lipRatio = upperLip / (lowerLip || 1e-6);   // <1 => fuller lower lip

    // ---- midface ----
    var midPupil = G.mid(p[LM.IRIS_R], p[LM.IRIS_L]);
    var mouthCenter = G.mid(p[LM.LIP_TOP], p[LM.LIP_BOT]);
    var midfaceH = Math.abs(mouthCenter.y - midPupil.y);
    var midfaceRatio = midfaceH / (faceWidth || 1e-6);

    // ---- face-shape inputs ----
    var foreheadW = G.dist(p[LM.FOREHEAD_R], p[LM.FOREHEAD_L]);
    var cheekW = faceWidth;
    var jawW = G.dist(p[LM.JAW_R], p[LM.JAW_L]);
    var faceLen = Math.abs(mentonY - hairlineY);

    return {
      ref: { ipd: ipd, faceWidth: faceWidth, faceHeight: faceHeight, rollDeg: rollRad * G.DEG },
      thirds: t,
      fifths: { segs: segs, rmsDev: fifthsDev },
      symmetry: { asymNorm: asymNorm, midlineX: midlineX },
      canthal: { right: tiltR, left: tiltL, avg: (tiltR + tiltL) / 2 },
      interocular: { intercanthal: intercanthal, eyeWidth: eyeWidth, ratio: interRatio },
      fwhr: { width: fwhrWidth, height: fwhrHeight, ratio: fwhr },
      nose: { alar: alar, toIntercanthal: noseToInter, toMouth: alar / (mouthWidth || 1e-6) },
      lips: { upper: upperLip, lower: lowerLip, ratio: lipRatio, mouthToNose: mouthToNose },
      midface: { height: midfaceH, ratio: midfaceRatio },
      shapeInput: {
        foreheadW: foreheadW, cheekW: cheekW, jawW: jawW, faceLen: faceLen,
        lenToWidth: faceLen / (cheekW || 1e-6)
      },
      pose: headPoseProxy(p),
      // for the overlay renderer:
      corrected: p,
      pxOriginal: px,            // un-rotated pixels — skin.js samples on these
      rollRad: rollRad,
      rollCenter: center,
      hairlineY: hairlineY
    };
  }

  var api = {
    LM: LM, MIDLINE_IDX: MIDLINE_IDX, SYMMETRIC_PAIRS: SYMMETRIC_PAIRS,
    canthalTilt: canthalTilt, headPoseProxy: headPoseProxy, analyze: analyze, rms: rms
  };
  root.ContourAnalysis = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

})(typeof window !== 'undefined' ? window : this);
