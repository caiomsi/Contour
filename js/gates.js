/* =================================================================
   CONTOUR — gates.js
   Pre-analysis quality gates. Pure module: takes a plain context of
   already-extracted signals and returns pass/block/warn results plus a
   confidence level for the report. Keeping it pure means the whole
   gate matrix is unit-testable without a browser.

   ctx = {
     faceCount,                      // number of faces detected
     ipdPx,                          // interpupillary distance, pixels
     faceFillRatio,                  // faceWidthPx / imageWidth (0..1)
     pose: { yaw, pitch },           // degrees (matrix Euler or proxy)
     blend: { jawOpen, mouthSmileLeft, ... },  // blendshape name->score
     exposure: { mean, clipLow, clipHigh }     // face-region, 0..255 / 0..1
   }
   ================================================================= */

(function (root) {
  'use strict';

  var THRESH = {
    MIN_IPD: 60,             // px — below this, geometry gets noisy
    POSE_BLOCK: 12,          // deg — |yaw|/|pitch| beyond => block
    POSE_WARN: 7,            // deg — beyond => warn + lower confidence
    POSE_SOFT: 4,            // deg — beyond => lower confidence
    JAW_BLOCK: 0.35, JAW_WARN: 0.20,
    SMILE_BLOCK: 0.50, SMILE_WARN: 0.30,
    BLINK_WARN: 0.55,
    EXP_DARK_BLOCK: 40, EXP_DARK_WARN: 55,
    EXP_BRIGHT_BLOCK: 225, EXP_BRIGHT_WARN: 210,
    CLIP_WARN: 0.22,
    SELFIE_FILL: 0.72        // face fills > this frac of width => advisory
  };

  function g(blend, k) { return (blend && typeof blend[k] === 'number') ? blend[k] : 0; }

  function check(ctx) {
    var issues = [];      // {id, severity:'block'|'warn', message}
    var advisories = [];

    // 1) exactly one face
    if (!ctx.faceCount) {
      issues.push({ id: 'no-face', severity: 'block',
        message: 'No face detected. Use a clear, front-facing photo with your whole face visible.' });
    } else if (ctx.faceCount > 1) {
      issues.push({ id: 'multi-face', severity: 'block',
        message: 'More than one face detected. Use a photo with just you in it.' });
    }

    // 2) minimum face size
    if (ctx.faceCount === 1 && ctx.ipdPx < THRESH.MIN_IPD) {
      issues.push({ id: 'too-small', severity: 'block',
        message: 'Your face is too small or low-resolution to measure reliably. Move closer or use a sharper photo.' });
    }

    // 3) head pose
    if (ctx.pose) {
      var y = Math.abs(ctx.pose.yaw), p = Math.abs(ctx.pose.pitch);
      if (y > THRESH.POSE_BLOCK || p > THRESH.POSE_BLOCK) {
        issues.push({ id: 'off-angle', severity: 'block',
          message: 'Your head is turned or tilted too far. Face the camera straight-on, eyes level, for accurate measurements.' });
      } else if (y > THRESH.POSE_WARN || p > THRESH.POSE_WARN) {
        issues.push({ id: 'off-angle-mild', severity: 'warn',
          message: 'Your head is turned or tilted slightly — a straight-on angle would improve accuracy.' });
      }
    }

    // 4) neutral expression
    var jaw = g(ctx.blend, 'jawOpen');
    var smile = Math.max(g(ctx.blend, 'mouthSmileLeft'), g(ctx.blend, 'mouthSmileRight'));
    var blink = Math.max(g(ctx.blend, 'eyeBlinkLeft'), g(ctx.blend, 'eyeBlinkRight'));
    if (jaw > THRESH.JAW_BLOCK || smile > THRESH.SMILE_BLOCK) {
      issues.push({ id: 'expression', severity: 'block',
        message: 'Relax into a neutral expression — an open mouth or big smile shifts the measurements.' });
    } else if (jaw > THRESH.JAW_WARN || smile > THRESH.SMILE_WARN) {
      issues.push({ id: 'expression-mild', severity: 'warn',
        message: 'A softer, more neutral expression would improve accuracy.' });
    }
    if (blink > THRESH.BLINK_WARN) {
      issues.push({ id: 'eyes-closed', severity: 'warn',
        message: 'Keep both eyes open and looking at the camera.' });
    }

    // 5) exposure
    if (ctx.exposure) {
      var mean = ctx.exposure.mean;
      if (mean < THRESH.EXP_DARK_BLOCK) {
        issues.push({ id: 'too-dark', severity: 'block',
          message: 'The photo is too dark to read skin and edges. Use even, front-facing light.' });
      } else if (mean > THRESH.EXP_BRIGHT_BLOCK) {
        issues.push({ id: 'too-bright', severity: 'block',
          message: 'The photo is overexposed. Reduce brightness or avoid direct light on your face.' });
      } else if (mean < THRESH.EXP_DARK_WARN || mean > THRESH.EXP_BRIGHT_WARN
                 || (ctx.exposure.clipHigh || 0) > THRESH.CLIP_WARN) {
        issues.push({ id: 'lighting', severity: 'warn',
          message: 'Lighting is uneven — flat, front-facing light gives the most reliable read (avoid backlight).' });
      }
    }

    // 6) selfie-distortion advisory (never blocks)
    if (ctx.faceFillRatio && ctx.faceFillRatio > THRESH.SELFIE_FILL) {
      advisories.push({ id: 'lens-distortion',
        message: 'Close-up front-camera shots exaggerate nose and forehead size. For the most accurate proportions, use arm’s length or the rear camera.' });
    }

    var blocks = issues.filter(function (i) { return i.severity === 'block'; });
    var warns = issues.filter(function (i) { return i.severity === 'warn'; });
    var pass = blocks.length === 0;

    // confidence (only meaningful when pass === true)
    var confidence = 'high';
    var softPose = ctx.pose && (Math.abs(ctx.pose.yaw) > THRESH.POSE_SOFT
                                || Math.abs(ctx.pose.pitch) > THRESH.POSE_SOFT);
    var demerits = warns.length + (softPose ? 1 : 0) + (advisories.length ? 0.5 : 0);
    if (demerits >= 2) confidence = 'low';
    else if (demerits >= 1) confidence = 'medium';

    return { pass: pass, blocks: blocks, warns: warns, advisories: advisories,
             issues: issues, confidence: confidence };
  }

  var api = { THRESH: THRESH, check: check };
  root.ContourGates = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

})(typeof window !== 'undefined' ? window : this);
