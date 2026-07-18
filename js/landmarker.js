/* =================================================================
   CONTOUR — landmarker.js  (the ONLY ES module in this project)
   Isolates the MediaPipe dependency. Imports the pinned Tasks-Vision
   bundle from a CDN, loads the vendored face-landmarker model
   (same-origin, so analysis never depends on Google Storage uptime),
   and exposes a tiny global API the plain-script app consumes:

     window.ContourEngine = {
       ready: Promise<void>,          // resolves when the model is loaded
       detect(imageSource): result,   // MediaPipe FaceLandmarkerResult
       delegate: 'GPU' | 'CPU'
     }

   Everything the photo touches stays in the browser — there is no
   network call that carries image data, and since the MediaPipe
   runtime is vendored, the only external requests left are Google
   Fonts. (Verify: DevTools → Network.)
   ================================================================= */

// Vendored @mediapipe/tasks-vision@0.10.35 (bundle + wasm live in
// vendor/mediapipe/) — the app has zero runtime CDN dependencies.
import {
  FaceLandmarker,
  FilesetResolver
} from '../vendor/mediapipe/vision_bundle.mjs';

var WASM = 'vendor/mediapipe/wasm';
var MODEL = 'models/face_landmarker.task';

var landmarker = null;
var usedDelegate = 'GPU';

async function build(delegate) {
  var vision = await FilesetResolver.forVisionTasks(WASM);
  return FaceLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: MODEL, delegate: delegate },
    runningMode: 'IMAGE',
    numFaces: 2,                              // detect 2 so we can gate on "more than one face"
    minFaceDetectionConfidence: 0.4,
    minFacePresenceConfidence: 0.4,
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: true
  });
}

/* The GPU delegate can construct successfully and still blow up on the
   first detect() when the WebGL context is unusable (headless, some
   drivers) — so smoke-test it before trusting it. */
function smokeDetect(lm) {
  var c = document.createElement('canvas');
  c.width = 8; c.height = 8;
  c.getContext('2d').fillRect(0, 0, 8, 8);
  lm.detect(c);            // result irrelevant — only that it doesn't throw
}

async function init() {
  try {
    landmarker = await build('GPU');
    smokeDetect(landmarker);
    usedDelegate = 'GPU';
  } catch (e) {
    landmarker = await build('CPU');
    smokeDetect(landmarker);
    usedDelegate = 'CPU';
  }
  window.ContourEngine.delegate = usedDelegate;
}

var readyPromise = init().then(function () {
  window.dispatchEvent(new CustomEvent('contour:ready'));
}).catch(function (err) {
  window.dispatchEvent(new CustomEvent('contour:error', { detail: err }));
  throw err;
});

window.ContourEngine = {
  ready: readyPromise,
  delegate: usedDelegate,
  detect: function (imageSource) {
    if (!landmarker) throw new Error('Engine not ready');
    return landmarker.detect(imageSource);
  }
};
