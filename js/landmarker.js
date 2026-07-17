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
   network call that carries image data. (Verify: DevTools → Network.)
   ================================================================= */

import {
  FaceLandmarker,
  FilesetResolver
} from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/vision_bundle.mjs';

var WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
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

async function init() {
  try {
    landmarker = await build('GPU');
    usedDelegate = 'GPU';
  } catch (e) {
    // Some machines/headless contexts have no WebGL — fall back to CPU wasm.
    landmarker = await build('CPU');
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
