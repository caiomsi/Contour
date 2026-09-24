# CLAUDE.md

This file provides guidance to Claude Code when working in this repository.

## What this is

Contour — an **in-browser facial-proportion analysis tool** with a lifestyle
recommendation engine. A QOVES-style idea, built responsibly: it maps facial
landmarks on-device, scores classic proportion ratios against tunable reference
ranges, and turns the observations into a lifestyle-only action plan.

**Not a marketing site** — this is a side project / personal tool, and (like
`pac-game`) it has a real test suite + CI. Changes to the analysis logic should pass
`node test/*.test.js` before pushing. See the root `../CLAUDE.md` for shared
conventions.

**Ethics are load-bearing, not decoration.** Keep them intact when editing copy:
proportion "ideals" are culture-bound (neoclassical, Eurocentric) heuristics, not
objective beauty; use "observation", never "flaw"; recommendations stay lifestyle-only
(no medical/surgical advice, no "mewing rebuilds bone" pseudoscience); it's for
adults; and the photo never leaves the device.

## How it runs

Plain static HTML/CSS/JS, no build step — **but** it needs to be served over HTTP
(ES module + wasm won't load from `file://`). Locally: `python3 -m http.server` from
this folder, open `http://localhost:8000`. Add `?debug=1` for the landmark-index
overlay + JSON export + a raw pose/gate dump.

The **only** ES module is `js/landmarker.js` — it imports the pinned MediaPipe
Tasks-Vision bundle from jsdelivr and exposes `window.ContourEngine`. Everything else
is plain `<script>` (window globals), per workspace convention.

## Structure

```
index.html              single page, view state-machine: landing → capture → analyzing → report
css/style.css           clinical-dark tokens (cyan accent), + @media print
js/landmarker.js        ONLY ES module — MediaPipe glue → window.ContourEngine
js/geometry.js          pure: vec math, roll-correction, yaw frontalization, Euler-from-matrix (COLUMN-major)
js/analysis.js          pure: landmarks → measurements (LM index map lives here)
js/faceshape.js         pure: soft prototype classifier (population z-scores) → shape + secondary + probs
js/scoring.js           pure: BANDS + WEIGHTS tables → 0–100 + composite
js/skin.js              pure: pixel sampling → under-eye/redness signals + detectHairlineY
js/gates.js             pure: quality gates + confidence (THRESH table)
js/content.js           quick-win checklists (data only): under-eye, redness, habits, photos, jawline, brows, basics
js/hairstyles.js        library of ~28 named cuts: texture, length, goal fit, "ask for" barber script, steps, products, upkeep + pick()
js/styling.js           pure: hairPlan() (goal, avoid, 3 picks, care, fringe, thinning) + quickWins() (skin routine, beard, glasses, brows)
js/recommendations.js   pure rules engine: findings + quickWins → ≤8 prioritized step-by-step "Quick wins" 
js/history.js           pure: local progress history (scores only, injected storage)
js/profile.js           pure: "Tailor your plan" answers (hair texture etc.), localStorage only, injected storage
js/landmarks-agg.js     pure: camera burst → medoid + similarity-align + per-landmark median
js/deepreport.js        opt-in AI deep report: pure payload builder + response sanitizer + safe renderer
js/main.js              plain IIFE: capture + live camera hints, gates, overlays, report, debug
vendor/mediapipe/       vendored tasks-vision runtime (bundle + wasm) — no runtime CDN
vendor/heic2any.min.js  vendored HEIC decoder, lazy-loaded only for .heic/.heif uploads
models/face_landmarker.task   vendored model (~3.6MB, loaded same-origin)
test/*.test.js          zero-dep Node tests (+ fixtures/)
```

Every pure module ends with `if (typeof module !== 'undefined' && module.exports)…`
**and** attaches to `window`, so the Node tests `require()` them while the browser
uses them as globals. `smoke.test.js` loads them through a `vm` sandbox (the browser
path) to prove that wiring.

## Pipeline (main.js runPipeline)

`ContourEngine.detect(canvas)` (or, for camera captures, the burst aggregate — see
below) → **gates** (face count, size, pose, expression, exposure, burst steadiness;
shared with the live camera hints via `evaluateGates`) → if blocked, show retake and
stop → else `analysis.analyze` (roll-corrected, **yaw-frontalized**, IPD-normalized)
→ **auto-hairline** (`skin.detectHairlineY`, two passes — see below; null →
heuristic default) → `skin.compute` → `scoring.score` → `faceshape.classify` →
`recommendations.generate` (with the local profile) → render + **record history**
(`history.js`, localStorage, scores only — never photos/landmarks). The annotated
canvas is drawn roll-corrected; overlays use `measurements.corrected` coordinates.
The hairline handle stays draggable and live-recomputes thirds (and patches the
history entry on release).

**Accuracy layer (v1.3):**
- **Yaw frontalization** (`geometry.estimateYawRad`/`unYawAll`, used in `analyze`):
  head yaw is read from the landmarks' OWN depth (mirrored pairs sit at equal z on a
  frontal face), then points are rotated back to frontal before measuring. It doesn't
  depend on the transform-matrix sign convention. Only applied for 0.25°–20°. On 58
  real portraits this cut median asymmetry from 0.118 to 0.042 (the old number put
  nearly everyone outside the symmetry band just from a 3–6° turn).
- **Face shape** is a softmax over distances to 6 prototypes in z-space against
  `faceshape.POP` (calibration set). The v1.2 fixed cut-offs assumed width ratios
  near 1.0; real MediaPipe ratios are ~0.83/0.82, so every real face came out
  diamond/oblong. Jaw-corner angle (`shapeInput.jawAngle`) separates square from
  round. `hairlineKnown: false` (heuristic hairline) down-weights the length term.
- **Hairline**: pass 1 = sustained darker-than-forehead run (best for dark/brown hair
  on any skin tone); pass 2 (only if 1 finds nothing or is rejected) = sharp local
  step in a colour+chroma+texture difference score (finds white/grey/blonde hair).
  Both reject an edge whose above-region matches the backdrop beside the head (bald
  scalp top). Tunables in `skin.HAIR`. Known limit: some bald heads against busy or
  gradient backdrops still read the scalp top — the draggable handle covers it.
- **Camera burst**: Capture takes ~6 frames (~0.7s), keeps gate-passing ones, and
  `landmarks-agg.aggregate` aligns them (similarity fit on stable anchors) to the
  medoid frame and takes per-landmark medians; pixels come from the medoid frame.
  `burst.spread` > `gates.THRESH.JITTER_WARN` adds an "unsteady" warning.

**Calibration set (v1.3):** 58 public-domain US Congress official portraits
(Wikimedia Commons), processed locally through the real pipeline in headless Chrome
— kept OUT of the repo. It skews middle-aged; widening it (younger faces, more skin
tones, more hair types) is the most valuable next calibration step.

**Camera** runs a live-hint loop pre-capture: ~2.5×/s it detects on a video frame,
runs the same pure gates, and maps gate ids to short directions (HINT_TEXT).
**HEIC uploads**: Safari decodes natively; elsewhere `decodeFile` lazy-loads
`vendor/heic2any.min.js` and converts on-device.

## Report layout & advice (v1.4)

The report reads top-down as a guide: header (score, photo, face-shape card with the
styling aim, "In short") → **01 Your hair** → **02 Quick wins** → **03 Your
measurements** (compact plain-English rows, `PLAIN` map in main.js, tap for details)
→ 04 AI deep report → 05 Methodology.

**Your hair** (`renderHair`): the face-shape aim in one sentence, then the question
"What's your hair like?" (texture + length up front; thickness, facial hair, skin
type, glasses, thinning under "More about you" — `profile.FIELDS`, localStorage
only, never in the deep-report payload). Once a texture is chosen,
`styling.hairPlan` → `hairstyles.pick` returns the **3 best named cuts** for
shape goal × texture × length (secondary shape folded in when "leaning"; thinning
prefers short cuts). Each card: why it suits you, an **"Ask for" barber/stylist
script with guard numbers and lengths (with a Copy button)**, numbered styling
steps, products, upkeep. Below: texture care routine (+ thickness), measured-thirds
fringe advice (skipped when the hairline is only guessed), thinning habits, and a
"Skip these" list for the shape. Length preference — not gender — selects cuts.

**Quick wins**: every item is `{title, because?, body, steps[]}` rendered as a
checklist. Findings (under-eye, redness, symmetry, lens distortion, lower face) come
first; then `styling.quickWins` (skin routine by skin type — always; beard & glasses
from the profile; brows always, with extra steps when measured eye spacing/tilt is
notable); then photos + one "everyday basics" card (kept even when capped).

Tests: `hairstyles.test.js` checks every style is complete and every goal × texture
× length preference yields ≥2 good picks; `styling.test.js` covers the plan/wins and
runs an **ethics lint** over all copy (no flaw/surgery/filler/drug names/mewing claims).

## Scoring & tuning

`scoring.js` holds the **only** place to tune: `BANDS` (per-metric ideal/falloff via
a piecewise-linear plateau) and `WEIGHTS` (composite, sums to 1). These are
literature-informed heuristics, **not truths** — say so if surfacing them.

**Calibration provenance (v1.1):** bands were re-centered against a small,
deliberately diverse set of synthetic frontal reference faces after the raw
neoclassical targets scored ordinary faces badly — eye spacing measured 1.17–1.42
on every normal face (canonical "1.0" doesn't match MediaPipe landmark placement)
and nose/mouth ratios sat outside their canonical bands. Plateaus are wide on
purpose: low scores are reserved for genuinely large deviations. The redness skin
signal is **self-referenced** (cheeks vs the person's own forehead/chin baseline)
because an absolute R-vs-GB index misreads warmer skin tones as "redness."
Recalibrating against more faces is welcome; keep the plateau shape, keep
`interocular.d ≤ 1.6` (a test pins it), and keep weights summing to 1.

## Pose / MediaPipe notes

`geometry.eulerFromMatrix` treats `facialTransformationMatrixes[0]` as **column-major**
(translation in `data[12..14]`) — verified empirically: a frontal face reads
~0°/0°/0°. If you ever swap the model/version, re-verify with `?debug=1`. Model +
version are pinned in `landmarker.js` (`@mediapipe/tasks-vision@0.10.35`); the model
is vendored in `models/` so analysis doesn't depend on Google Storage uptime.
`numFaces: 2` so the gate can detect "more than one face".

GitHub Pages can't send COOP/COEP headers, so wasm threads are unavailable — the GPU
delegate + single-thread wasm is used (fast enough for one still image).

## Privacy (a real, testable guarantee — with ONE explicit exception)

The analysis never sends the photo anywhere. Verified in DevTools → Network: every
request is a GET, the model loads same-origin, and running an analysis triggers
**no** request carrying image data.

The single exception is the **AI deep report** (`js/deepreport.js` + the
`#deep-report` card): a POST of the downscaled photo + compact metrics to
`https://forms.caiomsi.com/api/contour-report` (lives in `../MSI-Forms`), fired
ONLY by an explicit button press whose label says it sends the photo. Keep that
consent contract intact: never auto-trigger it, never widen what it sends (the
payload builder sends rounded numbers only — no landmarks/pixels), and always
render the AI's text via `textContent` (see `renderDeepReport`). The endpoint
returns 503 `not-configured` until `ANTHROPIC_API_KEY` is set on the MSI-Forms
Vercel project, and the card degrades gracefully. Don't add any other endpoint
that uploads the image.

## Tests & CI

`node test/analysis.test.js` (and scoring/faceshape/skin/hairstyles/styling/recommendations/
profile/landmarks-agg/history/deepreport/smoke) — or `for f in test/*.test.js; do node $f; done`.
Zero dependencies, each prints `PASS`/`FAIL` and exits non-zero on failure.
`.github/workflows/ci.yml` runs them all on push to `master` + PRs.
