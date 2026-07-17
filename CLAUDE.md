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
js/geometry.js          pure: vec math, roll-correction, Euler-from-matrix (COLUMN-major)
js/analysis.js          pure: landmarks → measurements (LM index map lives here)
js/faceshape.js         pure: measurements → oval/round/square/heart/diamond/oblong
js/scoring.js           pure: BANDS + WEIGHTS tables → 0–100 + composite
js/skin.js              pure: pixel-region sampling → under-eye / redness signals
js/gates.js             pure: quality gates + confidence (THRESH table)
js/content.js           recommendation content pack (data only)
js/recommendations.js   pure rules engine: findings → prioritized, deduped, capped recs
js/main.js              plain IIFE: capture, gates, canvas overlays, report render, debug
models/face_landmarker.task   vendored model (~3.6MB, loaded same-origin)
test/*.test.js          zero-dep Node tests (+ fixtures/)
```

Every pure module ends with `if (typeof module !== 'undefined' && module.exports)…`
**and** attaches to `window`, so the Node tests `require()` them while the browser
uses them as globals. `smoke.test.js` loads them through a `vm` sandbox (the browser
path) to prove that wiring.

## Pipeline (main.js runPipeline)

`ContourEngine.detect(canvas)` → **gates** (face count, size, pose, expression,
exposure) → if blocked, show retake and stop → else `analysis.analyze` (roll-corrected,
IPD-normalized) → `skin.compute` → `scoring.score` → `faceshape.classify` →
`recommendations.generate` → render. The annotated canvas is drawn roll-corrected;
overlays use `measurements.corrected` coordinates. The hairline handle is draggable
(trichion isn't in the mesh) and live-recomputes the thirds.

## Scoring & tuning

`scoring.js` holds the **only** place to tune: `BANDS` (per-metric ideal/falloff via
a piecewise-linear plateau) and `WEIGHTS` (composite, sums to 1). These are
literature-informed heuristics, **not truths** — say so if surfacing them. They were
lightly calibrated against real faces during verification: notably the `midface` band
(a normal face is ~0.5×, not ~0.9×) and the default hairline, which lifts ~8.5% of
face-height above landmark 10 toward the real trichion. Recalibrating against more
faces is welcome; keep the plateau shape.

## Pose / MediaPipe notes

`geometry.eulerFromMatrix` treats `facialTransformationMatrixes[0]` as **column-major**
(translation in `data[12..14]`) — verified empirically: a frontal face reads
~0°/0°/0°. If you ever swap the model/version, re-verify with `?debug=1`. Model +
version are pinned in `landmarker.js` (`@mediapipe/tasks-vision@0.10.35`); the model
is vendored in `models/` so analysis doesn't depend on Google Storage uptime.
`numFaces: 2` so the gate can detect "more than one face".

GitHub Pages can't send COOP/COEP headers, so wasm threads are unavailable — the GPU
delegate + single-thread wasm is used (fast enough for one still image).

## Privacy (a real, testable guarantee)

The photo never leaves the browser. Verified in DevTools → Network: every request is
a GET, the model loads same-origin, and running an analysis triggers **no** request
carrying image data. Don't add any endpoint that uploads the image; if a
waitlist/feedback CTA is ever added, it must send only the fields the user typed
(reuse the MSI-Forms pattern), never the photo.

## Tests & CI

`node test/analysis.test.js` (and scoring/faceshape/skin/recommendations/smoke).
Zero dependencies, each prints `PASS`/`FAIL` and exits non-zero on failure.
`.github/workflows/ci.yml` runs them all on push to `master` + PRs.
