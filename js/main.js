/* =================================================================
   CONTOUR — main.js
   App orchestration: capture (upload/camera) → quality gates →
   analysis pipeline → annotated report. Plain DOM, no modules. Guards
   every lookup. Consumes the pure modules (window.Contour*) and the ES
   module engine (window.ContourEngine).
   ================================================================= */

(function () {
  'use strict';

  var G = window.ContourGeometry, A = window.ContourAnalysis, FS = window.ContourFaceShape,
      SC = window.ContourScoring, SK = window.ContourSkin, GT = window.ContourGates,
      CT = window.ContourContent, RC = window.ContourRecommendations, H = window.ContourHistory,
      DR = window.ContourDeepReport, PR = window.ContourProfile, ST = window.ContourStyling, AG = window.ContourLandmarksAgg;

  function $(s, r) { return (r || document).querySelector(s); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  var DEBUG = /[?&]debug=1/.test(location.search);
  var MAXDIM = 1024;

  var state = {
    work: null,          // { canvas, w, h, imageData }
    result: null,        // MediaPipe result
    m: null, scores: null, skin: null, shape: null, recs: null, gates: null, pose: null,
    hairlineY: undefined, hairlineAuto: false, hairlineDragged: false, historyId: null,
    burst: null,         // { frames, spread } for camera multi-frame captures
    profile: loadProfile(),
    overlays: { thirds: true, fifths: false, symmetry: false, canthal: false, shape: false, indices: false },
    drag: false
  };

  /* "Tailor your plan" answers — local only (see profile.js). */
  function loadProfile() {
    try { return PR && typeof localStorage !== 'undefined' ? PR.load(localStorage) : {}; } catch (e) { return {}; }
  }

  /* ---------------- view router ---------------- */
  function setView(name) {
    var views = document.querySelectorAll('.view');
    for (var i = 0; i < views.length; i++) views[i].classList.toggle('is-active', views[i].id === 'view-' + name);
    document.body.setAttribute('data-view', name);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---------------- engine status ---------------- */
  var statusEl = $('#engine-status');
  var engineReady = false;
  window.addEventListener('contour:ready', function () {
    engineReady = true;
    if (statusEl) { statusEl.textContent = 'Model ready · running on-device (' + (window.ContourEngine.delegate || 'CPU') + ')'; statusEl.className = 'engine-status ready'; }
  });
  window.addEventListener('contour:error', function () {
    if (statusEl) { statusEl.textContent = 'Could not load the model. Check your connection and reload.'; statusEl.className = 'engine-status err'; }
  });
  function whenReady() {
    if (window.ContourEngine && window.ContourEngine.ready) return window.ContourEngine.ready;
    return new Promise(function (res, rej) {
      var tries = 0;
      (function poll() {
        if (window.ContourEngine && window.ContourEngine.ready) return window.ContourEngine.ready.then(res, rej);
        if (++tries > 400) return rej(new Error('engine timeout'));
        setTimeout(poll, 30);
      })();
    });
  }

  /* ---------------- capture: entry points ---------------- */
  var fileInput = $('#file-input');
  $('#cta-upload') && $('#cta-upload').addEventListener('click', function () { setView('capture'); showPanel('upload'); });
  $('#cta-camera') && $('#cta-camera').addEventListener('click', function () { setView('capture'); startCamera(); });
  document.querySelectorAll('[data-goto]').forEach(function (b) {
    b.addEventListener('click', function () { var t = b.getAttribute('data-goto'); if (t === 'capture') showPanel('upload'); setView(t); });
  });
  document.querySelectorAll('[data-nav="methodology"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      if (document.body.getAttribute('data-view') !== 'report') {
        e.preventDefault();
        setView('landing');
        var strip = $('.ethics-strip');
        if (strip) { strip.classList.add('flash'); setTimeout(function () { strip.classList.remove('flash'); }, 1800); }
        if (statusEl && !statusEl.classList.contains('err')) {
          statusEl.textContent = 'Run an analysis to read the full methodology in your report.';
        }
      }
    });
  });

  function showPanel(which) {
    var up = $('#panel-upload'), cam = $('#panel-camera');
    if (up) up.hidden = which !== 'upload';
    if (cam) cam.hidden = which !== 'camera';
    if (which !== 'camera') stopCamera();
  }

  /* ---------------- upload ---------------- */
  var dropzone = $('#dropzone');
  if (fileInput) fileInput.addEventListener('change', function () {
    var f = fileInput.files && fileInput.files[0];
    // Reset so choosing the SAME photo again (e.g. after a retake) still fires 'change'.
    fileInput.value = '';
    if (f) handleFile(f);
  });
  if (dropzone) {
    ['dragenter', 'dragover'].forEach(function (ev) { dropzone.addEventListener(ev, function (e) { e.preventDefault(); dropzone.classList.add('drag'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { dropzone.addEventListener(ev, function (e) { e.preventDefault(); dropzone.classList.remove('drag'); }); });
    dropzone.addEventListener('drop', function (e) { var f = e.dataTransfer && e.dataTransfer.files[0]; if (f) handleFile(f); });
  }
  // A photo dropped just outside the zone would otherwise open in the tab and leave the app.
  ['dragover', 'drop'].forEach(function (ev) {
    window.addEventListener(ev, function (e) {
      if (!e.dataTransfer || (dropzone && dropzone.contains(e.target))) return;
      e.preventDefault();
      if (ev === 'drop' && document.body.getAttribute('data-view') === 'capture' && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    });
  });

  var HEIC_RE = /\.hei[cf]$/i;
  function isHeicFile(file) {
    return file.type === 'image/heic' || file.type === 'image/heif' || HEIC_RE.test(file.name || '');
  }

  function handleFile(file) {
    // HEIC often arrives with an empty MIME type outside Safari — accept by extension too.
    if (!/^image\//.test(file.type) && !isHeicFile(file)) {
      showRetake([{ message: 'That file is not an image. Use a PNG, JPG, WebP or HEIC photo.' }]); return;
    }
    setView('analyzing'); setAnalyzing('Reading your photo…');
    decodeFile(file)
      .catch(function (err) { err.stage = 'decode'; throw err; })
      .then(function (bmp) {
        toWorkCanvas(bmp);
        return waitForEngine().then(function () { return runPipeline(); });
      })
      .catch(function (err) {
        console.error(err);
        if (err && err.stage === 'engine') {
          showRetake([{ message: 'The face model couldn’t finish loading, so nothing was analysed (your photo was not uploaded). Check your connection and reload the page, then try again.' }]);
        } else if (err && err.stage === 'decode') {
          showRetake([{ message: 'Could not open that image. Try a JPG or PNG — or, on iPhone, set Camera → Formats to “Most Compatible”.' }]);
        } else {
          showRetake([{ message: 'Something went wrong while analysing that photo. Please try again.' }]);
        }
      });
  }

  /* The model (~7 MB with its runtime) downloads once on the first visit.
     If a photo arrives before it's ready, say so instead of looking frozen,
     and tag failures so the user isn't told their photo is the problem. */
  var ENGINE_TIMEOUT = 120000;
  function waitForEngine() {
    if (engineReady) return Promise.resolve();
    setAnalyzing('Loading the face model — first visit only (about 7 MB)…');
    var t0 = Date.now();
    var ticker = setInterval(function () {
      var s = Math.round((Date.now() - t0) / 1000);
      if (s >= 12) setAnalyzing('Still loading the face model (' + s + 's) — slow connection? It only downloads once.');
    }, 1000);
    return new Promise(function (res, rej) {
      var timer = setTimeout(function () { var e = new Error('engine timeout'); e.stage = 'engine'; rej(e); }, ENGINE_TIMEOUT);
      whenReady().then(function () { clearTimeout(timer); res(); },
                       function (err) { clearTimeout(timer); err = err || new Error('engine failed'); err.stage = 'engine'; rej(err); });
    }).then(function (v) { clearInterval(ticker); return v; }, function (e) { clearInterval(ticker); throw e; });
  }

  function decodeFile(file) {
    var native = ('createImageBitmap' in window)
      ? createImageBitmap(file, { imageOrientation: 'from-image' }).catch(function () { return createImageBitmap(file); })
      : loadViaImg(file);
    if (!isHeicFile(file)) return native;
    // HEIC: Safari decodes natively; elsewhere fall back to the vendored
    // on-device wasm decoder (lazy-loaded, same-origin — nothing uploaded).
    return native.catch(function () {
      setAnalyzing('Converting iPhone photo (HEIC)…');
      return loadHeicDecoder().then(function (heic2any) {
        return heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
      }).then(function (out) {
        var blob = Array.isArray(out) ? out[0] : out;
        return ('createImageBitmap' in window) ? createImageBitmap(blob) : loadViaImg(blob);
      });
    });
  }

  var heicLoader = null;
  function loadHeicDecoder() {
    if (window.heic2any) return Promise.resolve(window.heic2any);
    if (heicLoader) return heicLoader;
    heicLoader = new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = 'vendor/heic2any.min.js';
      s.onload = function () { window.heic2any ? res(window.heic2any) : rej(new Error('heic2any missing')); };
      s.onerror = function () { heicLoader = null; rej(new Error('failed to load HEIC decoder')); };
      document.head.appendChild(s);
    });
    return heicLoader;
  }

  function loadViaImg(file) {
    return new Promise(function (res, rej) {
      var img = new Image(); img.onload = function () { res(img); }; img.onerror = rej;
      img.src = URL.createObjectURL(file);
    });
  }

  /* ---------------- camera + live guidance ---------------- */
  var stream = null, video = $('#camera-video');
  var hintTimer = null, frameCv = null;

  function startCamera() {
    showPanel('camera');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { showRetake([{ message: 'This browser has no camera access. Use the upload option.' }]); showPanel('upload'); return; }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 1280 } }, audio: false })
      .then(function (s) {
        stream = s;
        if (video) { video.srcObject = s; video.play(); }
        whenReady().then(startHintLoop).catch(function () {});
      })
      .catch(function () { showRetake([{ message: 'Camera permission was denied. You can still upload a photo.' }]); showPanel('upload'); });
  }
  function stopCamera() {
    stopHintLoop();
    if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
  }

  /* Live pre-capture hints: run the same detector + the same pure
     quality gates on a video frame ~2.5x/sec and translate the gate
     ids into short directions. One source of truth for thresholds. */
  var HINT_TEXT = {
    'no-face': 'No face in view', 'multi-face': 'Only you in frame',
    'too-small': 'Come closer', 'off-angle': 'Face the camera straight-on',
    'off-angle-mild': 'Straighten up a little', 'expression': 'Relax — neutral face',
    'expression-mild': 'Soften the expression', 'eyes-closed': 'Open both eyes',
    'too-dark': 'Find more light', 'too-bright': 'Too bright — turn from the light',
    'lighting': 'Even out the light', 'lens-distortion': 'Hold a bit farther away'
  };
  function startHintLoop() {
    if (hintTimer || !stream) return;
    if (!frameCv) frameCv = document.createElement('canvas');
    hintTimer = setInterval(tickHints, 400);
  }
  function stopHintLoop() {
    if (hintTimer) { clearInterval(hintTimer); hintTimer = null; }
    renderHints(null);
  }
  function tickHints() {
    if (!video || !video.videoWidth || !engineReady) return;
    frameCv.width = video.videoWidth; frameCv.height = video.videoHeight;
    var fctx = frameCv.getContext('2d', { willReadFrequently: true });
    fctx.drawImage(video, 0, 0);
    try {
      var result = window.ContourEngine.detect(frameCv);
      var imageData = fctx.getImageData(0, 0, frameCv.width, frameCv.height);
      var ev = evaluateGates(result, imageData, frameCv.width, frameCv.height);
      renderHints(ev.gates);
    } catch (e) { /* transient frame failure — keep last hint */ }
  }
  function renderHints(gates) {
    var ul = $('#camera-hints'); if (!ul) return;
    if (!gates) { ul.innerHTML = ''; ul.className = 'camera-hints'; return; }
    var msgs = [];
    gates.issues.forEach(function (i) { if (HINT_TEXT[i.id]) msgs.push({ t: HINT_TEXT[i.id], block: i.severity === 'block' }); });
    gates.advisories.forEach(function (a2) { if (HINT_TEXT[a2.id]) msgs.push({ t: HINT_TEXT[a2.id], block: false }); });
    if (!msgs.length) {
      ul.className = 'camera-hints ready';
      ul.innerHTML = '<li class="hint ok">Looking good — capture when ready</li>';
      return;
    }
    ul.className = 'camera-hints';
    ul.innerHTML = msgs.slice(0, 2).map(function (m2) {
      return '<li class="hint' + (m2.block ? ' block' : '') + '">' + m2.t + '</li>';
    }).join('');
  }

  /* Capture: a short burst of frames (≈0.7s), keep the ones that pass
     the gates, align + median their landmarks (landmarks-agg.js) and
     analyse the aggregate on the most central frame's pixels. Falls
     back to a single frame if fewer than two frames are usable. */
  var BURST_N = 6, BURST_GAP = 120;
  $('#camera-shoot') && $('#camera-shoot').addEventListener('click', function () {
    if (!video || !video.videoWidth) return;
    setView('analyzing'); setAnalyzing('Hold still — capturing…');
    stopHintLoop();
    whenReady().then(captureBurst).then(function (pre) {
      stopCamera();
      return runPipeline(pre);
    }).catch(function (e) { stopCamera(); console.error(e); showRetake([{ message: 'Something went wrong. Try again.' }]); });
  });
  function captureBurst() {
    var shots = [], budget = BURST_N + 3;   // a few extra tries for rejected frames
    return new Promise(function (res) {
      (function next() {
        if (!video || !video.videoWidth) return res(null);
        toWorkCanvas(video);
        var work = state.work;
        try {
          var r = window.ContourEngine.detect(work.canvas);
          var ev = evaluateGates(r, work.imageData, work.w, work.h);
          if (ev.gates.pass) shots.push({ work: work, result: r });
        } catch (e) { /* transient frame failure — skip */ }
        if (shots.length >= BURST_N || --budget <= 0) return res(combine(shots));
        setTimeout(next, BURST_GAP);
      })();
    });
  }
  function combine(shots) {
    if (!shots.length) return null;      // nothing usable: runPipeline re-detects & shows the retake reason
    if (shots.length < 2 || !AG) { state.work = shots[shots.length - 1].work; return { result: shots[shots.length - 1].result, burst: null }; }
    var w = shots[0].work.w, h = shots[0].work.h;
    var agg = AG.aggregate(shots.map(function (s2) { return s2.result.faceLandmarks[0]; }), w, h);
    var ref = shots[agg.refIndex];
    state.work = ref.work;
    // keep the reference frame's matrix/blendshapes; swap in the aggregate landmarks
    var result = Object.assign({}, ref.result, { faceLandmarks: [agg.landmarks] });
    return { result: result, burst: { frames: agg.frames, spread: agg.spread } };
  }
  $('#camera-cancel') && $('#camera-cancel').addEventListener('click', function () { stopCamera(); showPanel('upload'); });

  /* ---------------- source -> working canvas (resized) ---------------- */
  function toWorkCanvas(src) {
    var sw = src.videoWidth || src.naturalWidth || src.width;
    var sh = src.videoHeight || src.naturalHeight || src.height;
    if (!sw || !sh) { var e = new Error('empty image'); e.stage = 'decode'; throw e; }
    var scale = Math.min(1, MAXDIM / Math.max(sw, sh));
    var w = Math.round(sw * scale), h = Math.round(sh * scale);
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(src, 0, 0, w, h);
    state.work = { canvas: c, w: w, h: h, imageData: ctx.getImageData(0, 0, w, h) };
  }

  /* ---------------- the pipeline ---------------- */
  /* Shared by the analysis pipeline and the live camera hints: build a
     gate context from a detection result and run the pure gate checks. */
  function evaluateGates(result, imageData, w, h, burst) {
    var faces = (result && result.faceLandmarks) || [];
    var raw = faces[0];
    var ipd = 0, fill = 0, pose = null, blend = {}, exposure = null;
    if (raw) {
      var pxTmp = G.toPixels(raw, w, h);
      ipd = G.dist(pxTmp[A.LM.IRIS_R], pxTmp[A.LM.IRIS_L]);
      var bb = bbox(pxTmp); fill = (bb.maxX - bb.minX) / w;
      pose = poseFrom(result, pxTmp);
      blend = blendMap(result);
      exposure = imageData ? exposureStats(imageData, bb) : null;
    }
    var gctx = { faceCount: faces.length, ipdPx: ipd, faceFillRatio: fill, pose: pose, blend: blend, exposure: exposure, burst: burst || null };
    return { gates: GT.check(gctx), pose: pose };
  }

  /* pre (optional) = { result, burst } from a camera burst — skips re-detection. */
  function runPipeline(pre) {
    state.hairlineY = undefined;
    state.hairlineAuto = false;
    state.hairlineDragged = false;
    state.burst = pre && pre.burst ? pre.burst : null;
    return whenReady().then(function () {
      setAnalyzing('Detecting facial landmarks…');
      var w = state.work.w, h = state.work.h;
      var result = pre && pre.result ? pre.result : window.ContourEngine.detect(state.work.canvas);
      state.result = result;
      var ev = evaluateGates(result, state.work.imageData, w, h, state.burst);
      state.gates = ev.gates; state.pose = ev.pose;

      if (!ev.gates.pass) { showRetake(ev.gates.blocks); return; }

      setAnalyzing('Measuring proportions…');
      computeAll();               // measurements → scores → recs (uses state.result)
      autoHairline();             // pixel-detect the hairline; re-measure if found
      state.historyId = recordHistory();
      renderReport();
      setView('report');
    });
  }

  /* Pixel-based hairline estimate. Falls back silently to the heuristic
     default (and the draggable handle) when no confident transition. */
  function autoHairline() {
    if (!state.m || !SK.detectHairlineY) return;
    var m = state.m, p = m.corrected;
    var auto = SK.detectHairlineY(state.work.imageData, {
      midlineX: m.symmetry.midlineX,
      yStart: p[A.LM.FOREHEAD_TOP].y,
      faceHeight: m.ref.faceHeight,
      ipd: m.ref.ipd,
      faceWidth: m.ref.faceWidth,       // enables the bald-scalp/backdrop check
      // corrected frame -> original image coords (undo the roll correction)
      mapFn: function (pt) { return G.rotate(pt, m.rollRad, m.rollCenter); }
    });
    if (auto !== null) { state.hairlineAuto = true; state.hairlineY = auto; computeAll(); }
  }

  function recordHistory() {
    if (!H || typeof localStorage === 'undefined') return null;
    var feats = {};
    for (var k in state.scores.features) feats[k] = state.scores.features[k].score;
    var e = H.push(localStorage, {
      composite: state.scores.composite,
      confidence: state.scores.confidence,
      features: feats
    });
    return e ? e.id : null;
  }

  // Recompute everything downstream of detection (used on hairline drag too).
  function computeAll() {
    var raw = state.result.faceLandmarks[0];
    var w = state.work.w, h = state.work.h;
    var known = state.hairlineAuto || state.hairlineDragged;
    state.m = A.analyze(raw, w, h, { hairlineY: state.hairlineY, hairlineKnown: known });
    if (state.hairlineY === undefined) state.hairlineY = state.m.hairlineY;
    state.skin = SK.compute(state.work.imageData, state.m.pxOriginal);
    state.scores = SC.score(state.m, state.skin, state.gates.confidence);
    state.shape = FS.classify(state.m.shapeInput);
    generateRecs();
  }
  function generateRecs() {
    var known = state.hairlineAuto || state.hairlineDragged;
    var lens = !!(state.gates && state.gates.advisories && state.gates.advisories.some(function (a) { return a.id === 'lens-distortion'; }));
    state.recs = RC.generate({
      measurements: state.m, scores: state.scores, skin: state.skin, faceShape: state.shape,
      profile: state.profile, hairlineKnown: known, lensAdvisory: lens
    });
    state.hair = ST.hairPlan({ measurements: state.m, faceShape: state.shape, profile: state.profile, hairlineKnown: known });
  }

  /* ---------------- gate helpers ---------------- */
  function bbox(px) {
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (var i = 0; i < px.length; i++) { var p = px[i]; if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x; if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y; }
    return { minX: minX, minY: minY, maxX: maxX, maxY: maxY };
  }
  function poseFrom(result, px) {
    var mats = result.facialTransformationMatrixes;
    if (mats && mats[0]) { var e = G.eulerFromMatrix(mats[0]); if (e) return e; }
    var proxy = A.headPoseProxy(px);   // fallback
    return { yaw: proxy.yawDegApprox, pitch: proxy.pitchDegApprox, roll: 0 };
  }
  function blendMap(result) {
    var out = {}; var b = result.faceBlendshapes;
    if (b && b[0] && b[0].categories) b[0].categories.forEach(function (c) { out[c.categoryName] = c.score; });
    return out;
  }
  function exposureStats(img, bb) {
    var x0 = Math.max(0, bb.minX | 0), x1 = Math.min(img.width - 1, bb.maxX | 0);
    var y0 = Math.max(0, bb.minY | 0), y1 = Math.min(img.height - 1, bb.maxY | 0);
    var sum = 0, n = 0, lo = 0, hi = 0, step = Math.max(1, ((x1 - x0) / 120) | 0);
    for (var y = y0; y <= y1; y += step) for (var x = x0; x <= x1; x += step) {
      var i = (y * img.width + x) * 4;
      var l = 0.2126 * img.data[i] + 0.7152 * img.data[i + 1] + 0.0722 * img.data[i + 2];
      sum += l; n++; if (l < 16) lo++; if (l > 240) hi++;
    }
    return n ? { mean: sum / n, clipLow: lo / n, clipHigh: hi / n } : null;
  }

  /* ---------------- retake ---------------- */
  function showRetake(issues) {
    showPanel('upload'); setView('capture');
    var box = $('#retake'); if (!box) return;
    var items = (issues && issues.length ? issues : [{ message: 'Try a clearer, front-facing photo.' }])
      .map(function (i) { return '<li>' + i.message + '</li>'; }).join('');
    box.innerHTML = '<strong>Let’s try that again.</strong><ul>' + items + '</ul>';
    box.hidden = false;
  }
  function setAnalyzing(txt) { var t = $('#analyzing-text'); if (t) t.textContent = txt; }

  /* ---------------- report render ---------------- */
  function renderReport() {
    var box = $('#retake'); if (box) box.hidden = true;
    // composite
    var ring = $('#composite-ring'); if (ring) ring.style.setProperty('--pct', state.scores.composite);
    var num = $('#composite-num'); if (num) num.textContent = state.scores.composite;
    var conf = $('#confidence-badge'); if (conf) conf.textContent = 'Confidence: ' + state.scores.confidence;
    var rid = $('#rm-id');
    if (rid) {
      var now = new Date(), pad = function (n) { return (n < 10 ? '0' : '') + n; };
      rid.textContent = 'No. ' + pad(now.getMonth() + 1) + pad(now.getDate()) + '-' + pad(now.getHours()) + pad(now.getMinutes()) +
        ' · ' + now.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    }

    var hint = $('#hairline-hint');
    if (hint) hint.textContent = state.hairlineAuto
      ? 'Hairline auto-detected — drag the dashed line if it looks off.'
      : 'Drag the dashed line to your hairline to refine the thirds.';

    renderToggles(); drawAll();
    renderShapeCard(); renderSummary(); renderHair(); renderPlan(); renderFeatures(); renderMethodology();
    renderHistoryCard(); resetDeepReport(); renderDebug();
  }

  /* ---- opt-in AI deep report ----
     Nothing is sent anywhere until the user presses the button; each
     new analysis resets the card back to the consent state. */
  function resetDeepReport() {
    var intro = $('#dr-intro'), status = $('#dr-status'), body = $('#dr-body'), btn = $('#dr-generate');
    if (intro) intro.hidden = false;
    if (btn) btn.disabled = false;
    if (status) { status.hidden = true; status.textContent = ''; }
    if (body) { body.hidden = true; body.textContent = ''; }
  }

  function generateDeepReport() {
    if (!DR || !state.work || !state.scores) return;
    var btn = $('#dr-generate'), status = $('#dr-status'), body = $('#dr-body');
    if (btn) btn.disabled = true;
    if (status) {
      status.hidden = false;
      status.className = 'dr-status working';
      status.textContent = 'Sending the photo and waiting for the AI — about half a minute…';
    }

    var payload = {
      image: state.work.canvas.toDataURL('image/jpeg', 0.85),
      metrics: DR.buildDeepPayload(state.m, state.scores, state.shape, state.skin)
    };

    fetch(DR.ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          return { status: res.status, data: data };
        });
      })
      .then(function (r) {
        if (r.status === 200 && r.data && r.data.ok) {
          var clean = DR.sanitizeReport(r.data.report);
          if (clean) {
            if (status) { status.hidden = true; }
            var intro = $('#dr-intro'); if (intro) intro.hidden = true;
            if (body) { body.hidden = false; DR.renderDeepReport(body, clean); }
            return;
          }
        }
        if (status) {
          status.className = 'dr-status error';
          status.textContent = DR.errorMessage(r.status, r.data);
        }
        if (btn) btn.disabled = false;
      })
      .catch(function () {
        if (status) {
          status.className = 'dr-status error';
          status.textContent = 'No connection to the report service. Your local report above is unaffected.';
        }
        if (btn) btn.disabled = false;
      });
  }
  $('#dr-generate') && $('#dr-generate').addEventListener('click', generateDeepReport);

  /* ---- progress history card (numbers only, stored locally) ---- */
  function renderHistoryCard() {
    var card = $('#history-card'); if (!card || !H || typeof localStorage === 'undefined') return;
    var list = H.load(localStorage);
    if (!list.length) { card.hidden = true; return; }
    card.hidden = false;
    var rows = H.withDeltas(list).slice(-6).reverse().map(function (r) {
      var d = new Date(r.entry.t);
      var when = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
        ' · ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
      var delta = r.delta === null ? '' :
        ' <span class="h-delta ' + (r.delta >= 0 ? 'up' : 'down') + '">' + (r.delta >= 0 ? '+' : '') + r.delta + '</span>';
      return '<li><span class="h-when">' + when + '</span><span class="h-score">' + r.entry.composite + delta + '</span></li>';
    }).join('');
    card.innerHTML = '<h4>Progress on this device</h4>' +
      sparkline(list.map(function (e) { return e.composite; })) +
      '<ul class="h-list">' + rows + '</ul>' +
      '<p class="h-note">' + list.length + ' ' + (list.length === 1 ? 'analysis' : 'analyses') +
      ' stored locally — scores only, never photos.</p>' +
      '<button class="btn btn-ghost h-clear" id="h-clear" type="button">Clear history</button>';
    var btn = $('#h-clear');
    if (btn) btn.addEventListener('click', function () {
      if (btn.dataset.arm) { H.clear(localStorage); state.historyId = null; renderHistoryCard(); return; }
      btn.dataset.arm = '1'; btn.textContent = 'Tap again to clear';
      setTimeout(function () {
        var b = $('#h-clear');
        if (b && b.dataset.arm) { delete b.dataset.arm; b.textContent = 'Clear history'; }
      }, 2600);
    });
  }
  function sparkline(vals) {
    if (vals.length < 2) return '';
    var w = 220, hgt = 36, pts = [];
    for (var i = 0; i < vals.length; i++) {
      var x = (i / (vals.length - 1)) * (w - 4) + 2;
      var y = hgt - 3 - (vals[i] / 100) * (hgt - 6);
      pts.push(x.toFixed(1) + ',' + y.toFixed(1));
    }
    return '<svg class="h-spark" viewBox="0 0 ' + w + ' ' + hgt + '" preserveAspectRatio="none" aria-hidden="true">' +
      '<polyline points="' + pts.join(' ') + '" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
  }

  /* ---- overlay toggle chips ---- */
  function layerList() {
    var L = [
      { id: 'thirds', label: 'Thirds' }, { id: 'fifths', label: 'Fifths' },
      { id: 'symmetry', label: 'Symmetry' }, { id: 'canthal', label: 'Canthal tilt' },
      { id: 'shape', label: 'Face shape' }
    ];
    if (DEBUG) L.push({ id: 'indices', label: 'Indices' });
    return L;
  }
  function renderToggles() {
    var wrap = $('#overlay-toggles'); if (!wrap) return; wrap.innerHTML = '';
    layerList().forEach(function (L) {
      var b = el('button', 'otoggle' + (state.overlays[L.id] ? ' on' : ''), '<span class="sw"></span>' + L.label);
      b.setAttribute('aria-pressed', !!state.overlays[L.id]);
      b.addEventListener('click', function () { state.overlays[L.id] = !state.overlays[L.id]; b.classList.toggle('on', state.overlays[L.id]); b.setAttribute('aria-pressed', state.overlays[L.id]); drawAll(); });
      wrap.appendChild(b);
    });
    var hint = $('#hairline-hint'); if (hint) hint.style.display = state.overlays.thirds ? '' : 'none';
  }

  /* ---- annotated canvas ---- */
  function drawAll() {
    var cv = $('#annot-canvas'); if (!cv || !state.work) return;
    var w = state.work.w, h = state.work.h;
    cv.width = w; cv.height = h;
    var ctx = cv.getContext('2d');
    // base image, roll-corrected about the roll center
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    var c = state.m.rollCenter;
    ctx.translate(c.x, c.y); ctx.rotate(-state.m.rollRad); ctx.translate(-c.x, -c.y);
    ctx.drawImage(state.work.canvas, 0, 0);
    ctx.restore();
    // overlays (corrected coords, no rotation)
    var p = state.m.corrected;
    if (state.overlays.indices) drawIndices(ctx, p);
    if (state.overlays.shape) drawShapeOverlay(ctx, p);
    if (state.overlays.fifths) drawFifths(ctx, p);
    if (state.overlays.symmetry) drawSymmetry(ctx, p);
    if (state.overlays.canthal) drawCanthal(ctx, p);
    if (state.overlays.thirds) drawThirds(ctx, p);
  }

  function line(ctx, x1, y1, x2, y2, opt) {
    opt = opt || {}; ctx.save();
    ctx.strokeStyle = opt.color || 'rgba(255,98,52,.9)';
    ctx.lineWidth = opt.w || 1.2;
    if (opt.dash) ctx.setLineDash(opt.dash);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore();
  }
  function label(ctx, txt, x, y, align) {
    ctx.save(); ctx.font = '600 13px "IBM Plex Mono", monospace';
    ctx.fillStyle = 'rgba(255,244,236,.95)'; ctx.textAlign = align || 'left';
    ctx.shadowColor = 'rgba(0,0,0,.8)'; ctx.shadowBlur = 4;
    ctx.fillText(txt, x, y); ctx.restore();
  }
  function faceSpanX(p) { return { l: Math.min(p[A.LM.FACE_R].x, p[A.LM.FACE_L].x), r: Math.max(p[A.LM.FACE_R].x, p[A.LM.FACE_L].x) }; }

  function drawThirds(ctx, p) {
    var sx = faceSpanX(p); var pad = (sx.r - sx.l) * 0.06;
    var x0 = sx.l - pad, x1 = sx.r + pad;
    var ys = [state.hairlineY, p[A.LM.GLABELLA].y, p[A.LM.SUBNASALE].y, p[A.LM.MENTON].y];
    var names = ['UPPER', 'MIDDLE', 'LOWER'];
    for (var i = 0; i < ys.length; i++) {
      var dash = (i === 0) ? [7, 5] : null;                  // hairline dashed = draggable
      line(ctx, x0, ys[i], x1, ys[i], { dash: dash, color: i === 0 ? 'rgba(255,244,236,.95)' : 'rgba(255,98,52,.65)' });
    }
    for (var j = 0; j < 3; j++) {
      var pct = Math.round(state.m.thirds[['upper', 'middle', 'lower'][j]] * 100);
      label(ctx, names[j] + ' ' + pct + '%', x1 + 6, (ys[j] + ys[j + 1]) / 2 + 4);
    }
    // hairline handle
    ctx.save(); ctx.fillStyle = 'rgba(255,244,236,1)';
    ctx.beginPath(); ctx.arc(x0, ys[0], 5, 0, 7); ctx.fill(); ctx.restore();
  }
  function drawFifths(ctx, p) {
    var xs = [A.LM.FACE_R, A.LM.EYE_R_OUT, A.LM.EYE_R_IN, A.LM.EYE_L_IN, A.LM.EYE_L_OUT, A.LM.FACE_L]
      .map(function (i) { return p[i].x; }).sort(function (a, b) { return a - b; });
    var yTop = p[A.LM.FOREHEAD_TOP].y, yBot = p[A.LM.MENTON].y, eyeY = p[A.LM.IRIS_R].y;
    for (var i = 0; i < xs.length; i++) line(ctx, xs[i], yTop, xs[i], yBot, { color: 'rgba(255,98,52,.5)', w: 1 });
    for (var s = 0; s < 5; s++) label(ctx, Math.round(state.m.fifths.segs[s] * 100) + '%', (xs[s] + xs[s + 1]) / 2, eyeY - 8, 'center');
  }
  function drawSymmetry(ctx, p) {
    var x = state.m.symmetry.midlineX, yTop = p[A.LM.FOREHEAD_TOP].y, yBot = p[A.LM.MENTON].y;
    line(ctx, x, yTop, x, yBot, { color: 'rgba(255,244,236,.9)', dash: [4, 4] });
    label(ctx, 'MIDLINE', x + 6, yTop + 14);
    A.SYMMETRIC_PAIRS.forEach(function (pr) {
      dot(ctx, p[pr[0]]); dot(ctx, p[pr[1]]);
    });
  }
  function dot(ctx, pt) { if (!pt) return; ctx.save(); ctx.fillStyle = 'rgba(255,98,52,.6)'; ctx.beginPath(); ctx.arc(pt.x, pt.y, 1.6, 0, 7); ctx.fill(); ctx.restore(); }
  function drawCanthal(ctx, p) {
    seg(ctx, p[A.LM.EYE_R_IN], p[A.LM.EYE_R_OUT], state.m.canthal.right);
    seg(ctx, p[A.LM.EYE_L_IN], p[A.LM.EYE_L_OUT], state.m.canthal.left);
    function seg(ctx, m, l, deg) {
      line(ctx, m.x, m.y, l.x, l.y, { color: 'rgba(255,244,236,.95)', w: 1.4 });
      line(ctx, m.x, m.y, l.x, m.y, { color: 'rgba(255,98,52,.4)', w: 1, dash: [3, 3] });
      label(ctx, (deg >= 0 ? '+' : '') + deg.toFixed(1) + '°', l.x + 4, l.y - 4);
    }
  }
  function drawShapeOverlay(ctx, p) {
    var pairs = [[A.LM.FOREHEAD_R, A.LM.FOREHEAD_L], [A.LM.FACE_R, A.LM.FACE_L], [A.LM.JAW_R, A.LM.JAW_L]];
    pairs.forEach(function (pr) { line(ctx, p[pr[0]].x, p[pr[0]].y, p[pr[1]].x, p[pr[1]].y, { color: 'rgba(255,98,52,.6)', w: 1 }); });
    line(ctx, (p[A.LM.FACE_R].x + p[A.LM.FACE_L].x) / 2, state.hairlineY, (p[A.LM.FACE_R].x + p[A.LM.FACE_L].x) / 2, p[A.LM.MENTON].y, { color: 'rgba(255,98,52,.5)', w: 1, dash: [5, 4] });
    label(ctx, state.shape.shape.toUpperCase(), p[A.LM.FACE_L].x + 6, p[A.LM.FACE_L].y);
  }
  function drawIndices(ctx, p) {
    ctx.save(); ctx.font = '8px "IBM Plex Mono", monospace';
    for (var i = 0; i < p.length; i++) {
      ctx.fillStyle = 'rgba(255,98,52,.5)'; ctx.beginPath(); ctx.arc(p[i].x, p[i].y, 1, 0, 7); ctx.fill();
      if (i % 2 === 0) { ctx.fillStyle = 'rgba(255,240,230,.5)'; ctx.fillText(i, p[i].x + 2, p[i].y - 2); }
    }
    ctx.restore();
  }

  /* ---- hairline drag (updates thirds live) ---- */
  (function () {
    var cv = $('#annot-canvas'); if (!cv) return;
    function toCanvasY(e) { var r = cv.getBoundingClientRect(); return (e.clientY - r.top) * (cv.height / r.height); }
    // Grab zone sized in DISPLAY pixels (~18px) so the handle stays
    // draggable when the canvas is scaled down on small screens.
    function grabThreshold() {
      var r = cv.getBoundingClientRect();
      return Math.max(14, 18 * (cv.height / Math.max(1, r.height)));
    }
    function nearHairline(canvasY) {
      return state.m && Math.abs(canvasY - state.hairlineY) < grabThreshold();
    }
    cv.addEventListener('pointerdown', function (e) {
      if (!state.overlays.thirds || !state.m) return;
      if (nearHairline(toCanvasY(e))) { state.drag = true; cv.setPointerCapture(e.pointerId); }
    });
    // Block touch-scroll only when the touch starts on the handle.
    cv.addEventListener('touchstart', function (e) {
      if (!state.overlays.thirds || !state.m || !e.touches || !e.touches.length) return;
      var r = cv.getBoundingClientRect();
      var y = (e.touches[0].clientY - r.top) * (cv.height / r.height);
      if (nearHairline(y)) e.preventDefault();
    }, { passive: false });
    cv.addEventListener('pointermove', function (e) {
      if (!state.drag) return;
      state.hairlineY = Math.max(2, Math.min(cv.height - 2, toCanvasY(e)));
      state.hairlineAuto = false;
      state.hairlineDragged = true;
      // live recompute thirds/score without re-detecting
      computeAll(); drawAll();
      var num = $('#composite-num'); if (num) num.textContent = state.scores.composite;
      var ring = $('#composite-ring'); if (ring) ring.style.setProperty('--pct', state.scores.composite);
    });
    cv.addEventListener('pointerup', function () {
      if (!state.drag) return;
      state.drag = false; renderFeatures(); renderShapeCard(); renderSummary(); renderHair(); renderPlan();
      if (state.historyId && H && typeof localStorage !== 'undefined') {
        var feats = {};
        for (var k in state.scores.features) feats[k] = state.scores.features[k].score;
        H.update(localStorage, state.historyId, { composite: state.scores.composite, features: feats });
        renderHistoryCard();
      }
    });
  })();

  /* ---- side cards ---- */
  function renderShapeCard() {
    var c = $('#shape-card'); if (!c) return;
    var sh = state.shape, hp = state.hair;
    c.innerHTML = '';
    c.appendChild(el('p', 'kicker-sm', 'Your face shape'));
    var name = el('p', 'shape-line');
    name.appendChild(el('span', 'shape-name', sh.shape));
    if (sh.leaning) name.appendChild(el('span', 'shape-lean', 'leaning ' + sh.secondary));
    c.appendChild(name);
    c.appendChild(el('p', 'shape-aim', hp ? hp.aim : sh.note));
    if (!(state.hairlineAuto || state.hairlineDragged)) {
      c.appendChild(el('p', 'shape-caveat', 'Hairline estimated — drag the dashed line on your photo for a surer read.'));
    }
  }
  function renderSummary() {
    var c = $('#summary-card'); if (!c) return;
    var f = state.scores.features, off = [];
    Object.keys(f).forEach(function (k) { if (f[k].tier !== 'typical' && k !== 'skin') off.push(PLAIN[k] ? PLAIN[k].label.toLowerCase() : k); });
    var items = [];
    items.push(off.length ? 'Most proportions are in the typical range. A little outside: <strong>' + off.slice(0, 3).join(', ') + '</strong>.'
                          : 'All your proportions are in the typical range.');
    var top = state.recs && state.recs[0];
    if (top) items.push('Top quick win: <strong>' + top.title.toLowerCase() + '</strong>.');
    items.push(state.hair && state.hair.needsTexture ? 'Tell Contour your hair type below to get 3 cuts picked for you.'
                                                      : 'Your 3 best cuts are below, with what to ask your barber or stylist.');
    c.innerHTML = '<p class="kicker-sm">In short</p><ul class="short-list"><li>' + items.join('</li><li>') + '</li></ul>';
  }

  /* ---- measurements (compact, plain-English list) ---- */
  var PLAIN = {
    symmetry: { label: 'Symmetry', def: 'How closely your left and right sides mirror each other.', fmt: function (v) { return (v * 100).toFixed(1) + '% offset'; }, ideal: 'under 5%' },
    thirds: { label: 'Face thirds', def: 'Forehead, middle and lower face — are the three heights even?', fmt: function (v) { return (v * 100).toFixed(1) + '% off even'; }, ideal: 'under 3.5%' },
    fifths: { label: 'Face width balance', def: 'Does your face divide into five even eye-widths across?', fmt: function (v) { return (v * 100).toFixed(1) + '% off even'; }, ideal: 'under 3%' },
    canthal: { label: 'Eye tilt', def: 'The angle from the inner to the outer corner of each eye.', fmt: function (v) { return (v >= 0 ? '+' : '') + v.toFixed(1) + '°'; }, ideal: '+1° to +10°' },
    interocular: { label: 'Eye spacing', def: 'The gap between your eyes compared with the width of one eye.', fmt: function (v) { return v.toFixed(2) + '×'; }, ideal: '1.10–1.42×' },
    nose: { label: 'Nose width', def: 'Nose width compared with the gap between your eyes.', fmt: function (v) { return v.toFixed(2) + '×'; }, ideal: '0.90–1.25×' },
    mouthNose: { label: 'Mouth width', def: 'Mouth width compared with nose width.', fmt: function (v) { return v.toFixed(2) + '×'; }, ideal: '1.30–1.65×' },
    lips: { label: 'Lip balance', def: 'Upper-lip height compared with the lower lip.', fmt: function (v) { return v.toFixed(2) + '×'; }, ideal: '0.45–0.72×' },
    midface: { label: 'Midface length', def: 'Eyes-to-mouth height compared with face width.', fmt: function (v) { return v.toFixed(2) + '×'; }, ideal: '0.48–0.60×' },
    fwhr: { label: 'Face width-to-height', def: 'Cheekbone width compared with upper-face height (a contested measure).', fmt: function (v) { return v.toFixed(2) + '×'; }, ideal: '1.75–2.20×' },
    skin: { label: 'Skin (from photo)', def: 'Under-eye and redness signals — depends heavily on lighting.', fmt: function (v) { return Math.round(v) + '/100'; }, ideal: 'lighting-dependent' }
  };
  var DEFS = PLAIN;   // methodology glossary uses the same wording
  var TIER_TEXT = { typical: 'Typical', slightly: 'Slightly outside', outside: 'Outside typical' };
  function renderFeatures() {
    var list = $('#feature-grid'); if (!list) return; list.innerHTML = '';
    var f = state.scores.features;
    Object.keys(f).forEach(function (k) {
      var fs = f[k], d = PLAIN[k] || { label: fs.label, def: '', fmt: function (v) { return v; }, ideal: '' };
      var row = el('details', 'mrow');
      var sum = el('summary', 'mrow-sum');
      sum.appendChild(el('span', 'mrow-name', d.label));
      sum.appendChild(el('span', 'mrow-val', d.fmt(fs.value)));
      sum.appendChild(el('span', 'pill t-' + fs.tier, TIER_TEXT[fs.tier]));
      row.appendChild(sum);
      row.appendChild(el('p', 'mrow-def', d.def + ' Typical range: ' + d.ideal + '. Score ' + fs.score + '/100.' +
        (k === 'skin' ? ' Treat this as a soft hint, not a measurement.' : '')));
      list.appendChild(row);
    });
  }

  /* ---- "Your hair" + profile questions ----
     Hair texture can't be read from one photo, so we ask (profile.js,
     stored only in this browser). Tapping a selected option clears it. */
  function chipGroup(field, opts) {
    opts = opts || {};
    var f = PR.FIELDS[field], p = state.profile || {};
    var grp = el('div', 'q-group' + (opts.big ? ' q-big' : ''));
    grp.setAttribute('role', 'group');
    var lab = el('p', 'q-label'); lab.textContent = opts.label || f.label; lab.id = 'tl-' + field;
    grp.setAttribute('aria-labelledby', lab.id);
    grp.appendChild(lab);
    var chips = el('div', 'chips');
    f.options.forEach(function (o) {
      var b = el('button', 'chip'); b.type = 'button';
      var on = p[field] === o[0];
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      if (on) b.classList.add('on');
      var t = el('span', 'chip-t'); t.textContent = o[1]; b.appendChild(t);
      if (opts.big && o[2]) { var h = el('span', 'chip-h'); h.textContent = o[2]; b.appendChild(h); }
      b.addEventListener('click', function () {
        var next = Object.assign({}, state.profile);
        if (next[field] === o[0]) delete next[field]; else next[field] = o[0];
        setProfile(next, field);
      });
      chips.appendChild(b);
    });
    grp.appendChild(chips);
    return grp;
  }
  function stepsList(steps, cls) {
    var ol = el('ol', cls || 'steps');
    steps.forEach(function (s2) { var li = document.createElement('li'); li.textContent = s2; ol.appendChild(li); });
    return ol;
  }
  function renderHair() {
    var wrap = $('#hair'); if (!wrap || !state.hair) return;
    var hp = state.hair; wrap.innerHTML = '';

    // 1) the goal, in one readable sentence
    var lead = el('div', 'hair-lead');
    var h = el('p', 'hair-goal'); h.textContent = hp.aim; lead.appendChild(h);
    if (hp.alsoAim) { var a2 = el('p', 'hair-also'); a2.textContent = hp.alsoAim; lead.appendChild(a2); }
    wrap.appendChild(lead);

    // 2) questions: texture + length up front, the rest tucked away
    var qs = el('div', 'questions' + (hp.needsTexture ? ' needs-answer' : ''));
    if (hp.needsTexture) qs.appendChild(el('p', 'q-title', 'What’s your hair like? Pick one to see 3 cuts chosen for you.'));
    qs.appendChild(chipGroup('hairTexture', { big: hp.needsTexture, label: 'Hair type' }));
    qs.appendChild(chipGroup('lengthPref', { label: 'Length you want' }));
    var more = el('details', 'more-q');
    var ms = el('summary', null, 'More about you <span class="muted">— improves beard, skin and glasses tips</span>');
    more.appendChild(ms);
    var mg = el('div', 'more-grid');
    ['hairThickness', 'facialHair', 'skinType', 'glasses', 'hairConcern'].forEach(function (fld) { mg.appendChild(chipGroup(fld)); });
    more.appendChild(mg);
    if (openMore) more.open = true;
    more.addEventListener('toggle', function () { openMore = more.open; });
    qs.appendChild(more);
    var foot = el('div', 'q-foot');
    foot.appendChild(el('span', 'muted', 'Your answers stay in this browser only.'));
    if (!PR.isEmpty(state.profile)) {
      var forget = el('button', 'link-btn', 'Forget my answers'); forget.type = 'button';
      forget.addEventListener('click', function () { setProfile({}, null, true); });
      foot.appendChild(forget);
    }
    qs.appendChild(foot);
    wrap.appendChild(qs);

    // 3) the picks
    if (hp.styles.length) {
      var grid = el('div', 'styles');
      hp.styles.forEach(function (st, i) {
        var c = el('article', 'style-card');
        var top = el('div', 'style-top');
        top.appendChild(el('span', 'style-rank', i === 0 ? 'Best match' : 'Also great'));
        top.appendChild(el('span', 'style-len', st.length));
        c.appendChild(top);
        c.appendChild(el('h4', 'style-name', st.name));
        var why = el('p', 'style-why'); why.textContent = st.why; c.appendChild(why);
        var askHead = el('div', 'ask-head');
        askHead.appendChild(el('span', 'mini-label', 'Ask for'));
        var copy = el('button', 'copy-btn', 'Copy'); copy.type = 'button';
        copy.setAttribute('aria-label', 'Copy what to ask for ' + st.name);
        copy.addEventListener('click', function () {
          var txt = st.name + ': ' + st.ask;
          var done = function () { copy.textContent = 'Copied'; setTimeout(function () { copy.textContent = 'Copy'; }, 1500); };
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, function () {});
        });
        askHead.appendChild(copy);
        c.appendChild(askHead);
        var ask = el('blockquote', 'ask'); ask.textContent = st.ask; c.appendChild(ask);
        c.appendChild(el('span', 'mini-label', 'Style it'));
        c.appendChild(stepsList(st.steps));
        var meta = el('dl', 'style-meta');
        meta.innerHTML = '<div><dt>Products</dt><dd></dd></div><div><dt>Upkeep</dt><dd></dd></div>';
        meta.querySelectorAll('dd')[0].textContent = st.products;
        meta.querySelectorAll('dd')[1].textContent = st.upkeep;
        c.appendChild(meta);
        grid.appendChild(c);
      });
      wrap.appendChild(grid);
    }

    // 4) care, fringe, thinning, avoid
    var row = el('div', 'hair-extras');
    if (hp.care) row.appendChild(winCard({ title: hp.care.title, steps: hp.care.steps }));
    if (hp.fringe) row.appendChild(winCard({ title: hp.fringe.title, because: hp.fringe.because, body: hp.fringe.body, steps: [] }));
    if (hp.thinning) row.appendChild(winCard({ title: hp.thinning.title, steps: hp.thinning.steps }));
    var av = el('div', 'win avoid');
    av.appendChild(el('h4', 'win-title', 'Skip these for your face shape'));
    var ul = el('ul', 'avoid-list');
    hp.avoid.forEach(function (x) { var li = document.createElement('li'); li.textContent = x; ul.appendChild(li); });
    av.appendChild(ul);
    row.appendChild(av);
    wrap.appendChild(row);
  }
  var openMore = false;
  function setProfile(next, focusField, forget) {
    if (forget) { try { PR.clear(localStorage); } catch (e) {} state.profile = {}; }
    else { try { state.profile = PR.save(localStorage, next); } catch (e) { state.profile = PR.validate(next); } }
    generateRecs(); renderShapeCard(); renderSummary(); renderHair(); renderPlan();
    if (focusField) {
      var g = document.querySelector('[aria-labelledby="tl-' + focusField + '"] .chip.on') ||
              document.querySelector('[aria-labelledby="tl-' + focusField + '"] .chip');
      if (g) g.focus({ preventScroll: true });
    }
  }

  /* ---- quick wins ---- */
  function winCard(r) {
    var card = el('article', 'win');
    card.appendChild(el('h4', 'win-title', r.title));
    if (r.because) { var b = el('p', 'win-because'); b.textContent = 'Because ' + r.because.replace(/^Your/, 'your').replace(/\.$/, '') + '.'; card.appendChild(b); }
    if (r.body) { var p = el('p', 'win-body'); p.textContent = r.body; card.appendChild(p); }
    if (r.steps && r.steps.length) card.appendChild(stepsList(r.steps, 'checks'));
    return card;
  }
  function renderPlan() {
    var wrap = $('#plan'); if (!wrap) return; wrap.innerHTML = '';
    state.recs.forEach(function (r) { wrap.appendChild(winCard(r)); });
  }

  /* ---- methodology ---- */
  function renderMethodology() {
    var wrap = $('#methodology-body'); if (!wrap) return;
    var defs = Object.keys(DEFS).map(function (k) { return '<dt>' + DEFS[k].label + '</dt><dd>' + DEFS[k].def + ' Typical ' + DEFS[k].ideal + '.</dd>'; }).join('');
    wrap.innerHTML =
      acc('How Contour works',
        '<p>A face-landmark model runs entirely in your browser and returns hundreds of points. Contour levels your eyes to horizontal, scales everything by the distance between your pupils (so image size doesn’t matter), then compares a set of classic proportion ratios to common reference ranges. Each score is a simple, traceable distance from an “ideal” band.</p>') +
      acc('Why this is not a beauty score',
        '<p>The reference ranges come from “neoclassical” canons that are culture-bound and historically Eurocentric. They describe one narrow idea of proportion — not objective attractiveness, health, or worth. Real, admired faces sit outside these ranges constantly. Read the composite as a curiosity, not a verdict.</p>') +
      acc('Not medical advice',
        '<p>Contour is for adults, for self-care and curiosity. It does not diagnose anything, and every recommendation is a general lifestyle habit. For skin, sleep, or health concerns, talk to a qualified professional.</p>') +
      acc('What affects accuracy',
        '<p>Camera angle, lens distance (close selfies enlarge the nose and forehead), lighting, expression, hair, and glasses all shift the numbers. Contour gates the worst cases and shows a confidence level, but a straight-on, neutral, evenly-lit photo at arm’s length is always most reliable.</p>') +
      acc('Your hair & skin answers',
        '<p>Hair texture can’t be read reliably from a single front-facing photo, so Contour asks. Your answers in the “Your hair” section are saved only in this browser, are never sent anywhere (including the optional AI report), and are used only to choose which cut, care and grooming suggestions to show. “Forget my answers” deletes them.</p>') +
      acc('How accuracy is protected',
        '<p>Small head turns are corrected with the landmark model’s depth estimate before measuring, so a slightly angled photo doesn’t read as asymmetry. Camera captures combine several frames to cancel jitter. Face shape is compared against the spread of real measured faces and shown as a closest match, or as “leaning” when you sit between two shapes.</p>') +
      acc('What each measurement means', '<dl>' + defs + '</dl>');
  }
  function acc(title, body) { return '<details><summary>' + title + '</summary><div class="acc-body">' + body + '</div></details>'; }

  /* ---- debug ---- */
  function renderDebug() {
    var panel = $('#debug-panel'); if (!panel) return; panel.hidden = !DEBUG; if (!DEBUG) return;
    var dump = { delegate: window.ContourEngine && window.ContourEngine.delegate, pose: state.pose, gates: state.gates,
      faceFill: state.m && state.m.pxOriginal ? 'ok' : '-', skin: state.skin, composite: state.scores.composite,
      yawDeg: state.m && state.m.ref.yawDeg, frontalized: state.m && state.m.ref.frontalized,
      burst: state.burst, hairline: { y: state.hairlineY, auto: state.hairlineAuto, dragged: state.hairlineDragged },
      shape: state.shape && { shape: state.shape.shape, secondary: state.shape.secondary, leaning: state.shape.leaning, probs: state.shape.probs, z: state.shape.z },
      profile: state.profile };
    var pre = $('#debug-dump'); if (pre) pre.textContent = JSON.stringify(dump, null, 2);
    var exp = $('#dbg-export');
    if (exp) exp.onclick = function () {
      var data = JSON.stringify(state.result.faceLandmarks[0]);
      var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
      a.download = 'contour-landmarks.json'; a.click();
    };
    var idx = $('#dbg-indices'); if (idx) idx.onclick = function () { state.overlays.indices = !state.overlays.indices; drawAll(); renderToggles(); };
  }

  /* ---- print ---- */
  $('#btn-print') && $('#btn-print').addEventListener('click', function () { window.print(); });

  // warm the engine on load
  whenReady().catch(function () {});
})();
