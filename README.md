# Contour

**Measured, not judged.** In-browser facial-proportion analysis with a practical,
lifestyle-only action plan. Your photo never leaves your device.

→ Live: https://caiomsi.github.io/Contour/

Contour is a QOVES-style facial analysis app built responsibly. Upload a photo —
PNG, JPG, WebP or iPhone HEIC — or use your camera (with live framing hints), and it:

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

## Your photo never leaves your device (with one explicit exception)

The analysis itself has no server and no upload. The MediaPipe runtime, the face
model, and the HEIC decoder are all bundled with the site and load from the same
origin; every piece of detection and math runs locally in JavaScript/WASM. The
only external requests are Google Fonts.

You can verify it: open DevTools → **Network**, run an analysis, and confirm that
every request is a same-origin `GET` (plus fonts) and that **no request carries
your image**. Nothing is posted anywhere.

The one exception is the **optional AI deep report** (below): if — and only if —
you press its clearly-labeled button, that photo and your measurements are sent
once to Contour's server, which forwards them to Anthropic's Claude API and
returns the report. The image is not stored or logged anywhere along the way.

## AI deep report (optional)

At the bottom of every report there's an opt-in extra: a personal narrative
report written by Claude (Anthropic's AI) from your photo and your measurements.
It follows the same rules as the rest of Contour — lifestyle-only suggestions,
dysmorphia-safe language, no medical or surgical advice, adults only — enforced
server-side, with the response validated and rendered as plain text. It's
rate-limited (a small number of free reports per day) because each one costs
real money to generate.

## Progress over time

Each successful analysis stores its **scores only** — composite, per-feature
numbers, confidence, date — in your browser's local storage (never the photo,
never landmarks). The report shows your recent runs with a sparkline so lifestyle
changes can actually be tracked across weeks. One button clears it; nothing syncs.

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
  `js/scoring.js`), not objective truths. The bands were deliberately **widened
  against a small, diverse set of reference faces** so ordinary variation scores
  well — the raw neoclassical "ideals" punished normal eye spacing and nose
  proportions, and the redness signal is measured against your own
  forehead/chin baseline so warmer skin tones aren't misread as "redness."

## Tech

Plain HTML/CSS/vanilla JS, no build step. Face landmarks via
[`@mediapipe/tasks-vision`](https://www.npmjs.com/package/@mediapipe/tasks-vision)
`0.10.35` — runtime + wasm vendored in `vendor/mediapipe/`, model in `models/`,
so the app has zero runtime CDN dependencies. HEIC decoding via a vendored
[heic2any](https://github.com/alexcorvi/heic2any) (lazy-loaded only when a HEIC
file is chosen; Safari decodes natively). A [Caio·MSI](https://caiomsi.com) side
project.
