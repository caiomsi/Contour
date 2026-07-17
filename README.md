# Contour

**Measured, not judged.** In-browser facial-proportion analysis with a practical,
lifestyle-only action plan. Your photo never leaves your device.

→ Live: https://caiomsi.github.io/Contour/

Contour is a QOVES-style facial analysis app built responsibly. Upload a photo (or
use your camera) and it:

1. Detects your facial landmarks **entirely in your browser** with Google's MediaPipe
   Face Landmarker (478 points).
2. Levels your eyes, normalizes by the distance between your pupils, and measures a
   set of classic proportion ratios — thirds, fifths, symmetry, canthal tilt, eye
   spacing, nose/lip/mouth ratios, midface, fWHR — plus a light read of under-eye and
   redness signals.
3. Scores each against common reference ranges and blends them into a single
   "harmony" composite (one lens, **not** a verdict).
4. Turns the observations into a personalized, **lifestyle-only** plan — sleep, skin
   & sun, hydration, habits & posture, and styling for your face shape.

## Your photo never leaves your device

There is no server and no upload. The MediaPipe model is bundled with the site and
loads from the same origin; all detection and math run locally in JavaScript/WASM.

You can verify it: open DevTools → **Network**, run an analysis, and confirm that
every request is a `GET` (page, styles, scripts, fonts, the MediaPipe library, and
the local model) and that **no request carries your image**. Nothing is posted
anywhere.

## Running locally

It's static, but it must be served over HTTP (ES modules + WASM don't load from
`file://`):

```bash
python3 -m http.server        # from this folder
# then open http://localhost:8000
```

Add `?debug=1` to the URL for a landmark-index overlay, a "download landmarks JSON"
button, and a raw pose/gate dump.

## Tests

Zero-dependency Node scripts — no framework, no install:

```bash
node test/analysis.test.js
node test/scoring.test.js
node test/faceshape.test.js
node test/skin.test.js
node test/recommendations.test.js
node test/smoke.test.js
```

CI (`.github/workflows/ci.yml`) runs them all on every push and PR.

## Honesty & limits

- **Not a beauty score.** The reference ranges come from "neoclassical" proportion
  canons that are culture-bound and historically Eurocentric. They describe one
  narrow notion of proportion — not attractiveness, health, or worth. Admired faces
  fall outside them all the time.
- **Not medical advice.** Contour is for adults, for curiosity and self-care. It
  diagnoses nothing, and every recommendation is a general lifestyle habit.
- **Photo quality matters.** Angle, lens distance (close selfies enlarge the nose),
  lighting, and expression all move the numbers. Contour gates the worst cases and
  shows a confidence level, but a straight-on, neutral, evenly-lit photo at arm's
  length is always most reliable.
- The scores are built on tunable, literature-informed heuristics (see
  `js/scoring.js`), not objective truths.

## Tech

Plain HTML/CSS/vanilla JS, no build step. Face landmarks via
[`@mediapipe/tasks-vision`](https://www.npmjs.com/package/@mediapipe/tasks-vision)
`0.10.35` (pinned), model vendored in `models/`. A [Caio·MSI](https://caiomsi.com)
side project.
