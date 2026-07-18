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
      CT = window.ContourContent, RC = window.ContourRecommendations, H = window.ContourHistory;

  function $(s, r) { return (r || document).querySelector(s); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  var DEBUG = /[?&]debug=1/.test(location.search);
  var MAXDIM = 1024;

  var state = {
    work: null,          // { canvas, w, h, imageData }
    result: null,        // MediaPipe result
    m: null, scores: null, skin: null, shape: null, recs: null, gates: null, pose: null,
    hairlineY: undefined, hairlineAuto: false, historyId: null,
    overlays: { thirds: true, fifths: false, symmetry: false, canthal: false, shape: false, indices: false },
    drag: false
  };

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
  if (fileInput) fileInput.addEventListener('change', function () { if (fileInput.files && fileInput.files[0]) handleFile(fileInput.files[0]); });
  if (dropzone) {
    ['dragenter', 'dragover'].forEach(function (ev) { dropzone.addEventListener(ev, function (e) { e.preventDefault(); dropzone.classList.add('drag'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { dropzone.addEventListener(ev, function (e) { e.preventDefault(); dropzone.classList.remove('drag'); }); });
    dropzone.addEventListener('drop', function (e) { var f = e.dataTransfer && e.dataTransfer.files[0]; if (f) handleFile(f); });
  }

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
      .then(function (bmp) { toWorkCanvas(bmp); return runPipeline(); })
      .catch(function (err) { console.error(err); showRetake([{ message: 'Could not read that image. Try another photo.' }]); });
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

  $('#camera-shoot') && $('#camera-shoot').addEventListener('click', function () {
    if (!video || !video.videoWidth) return;
    setView('analyzing'); setAnalyzing('Capturing…');
    toWorkCanvas(video); stopCamera(); runPipeline().catch(function (e) { console.error(e); showRetake([{ message: 'Something went wrong. Try again.' }]); });
  });
  $('#camera-cancel') && $('#camera-cancel').addEventListener('click', function () { stopCamera(); showPanel('upload'); });

  /* ---------------- source -> working canvas (resized) ---------------- */
  function toWorkCanvas(src) {
    var sw = src.videoWidth || src.naturalWidth || src.width;
    var sh = src.videoHeight || src.naturalHeight || src.height;
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
  function evaluateGates(result, imageData, w, h) {
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
    var gctx = { faceCount: faces.length, ipdPx: ipd, faceFillRatio: fill, pose: pose, blend: blend, exposure: exposure };
    return { gates: GT.check(gctx), pose: pose };
  }

  function runPipeline() {
    state.hairlineY = undefined;
    state.hairlineAuto = false;
    return whenReady().then(function () {
      setAnalyzing('Detecting facial landmarks…');
      var w = state.work.w, h = state.work.h;
      var result = window.ContourEngine.detect(state.work.canvas);
      state.result = result;
      var ev = evaluateGates(result, state.work.imageData, w, h);
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
    state.m = A.analyze(raw, w, h, { hairlineY: state.hairlineY });
    if (state.hairlineY === undefined) state.hairlineY = state.m.hairlineY;
    state.skin = SK.compute(state.work.imageData, state.m.pxOriginal);
    state.scores = SC.score(state.m, state.skin, state.gates.confidence);
    state.shape = FS.classify(state.m.shapeInput);
    state.recs = RC.generate({ measurements: state.m, scores: state.scores, skin: state.skin, faceShape: state.shape });
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

    var hint = $('#hairline-hint');
    if (hint) hint.textContent = state.hairlineAuto
      ? 'Hairline auto-detected — drag the dashed line if it looks off.'
      : 'Drag the dashed line to your hairline to refine the thirds.';

    renderToggles(); drawAll();
    renderShapeCard(); renderSummary(); renderFeatures(); renderPlan(); renderMethodology();
    renderHistoryCard(); renderDebug();
  }

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
    ctx.strokeStyle = opt.color || 'rgba(90,209,230,.9)';
    ctx.lineWidth = opt.w || 1.2;
    if (opt.dash) ctx.setLineDash(opt.dash);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore();
  }
  function label(ctx, txt, x, y, align) {
    ctx.save(); ctx.font = '600 13px "Space Mono", monospace';
    ctx.fillStyle = 'rgba(147,231,244,.95)'; ctx.textAlign = align || 'left';
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
      line(ctx, x0, ys[i], x1, ys[i], { dash: dash, color: i === 0 ? 'rgba(147,231,244,.95)' : 'rgba(90,209,230,.65)' });
    }
    for (var j = 0; j < 3; j++) {
      var pct = Math.round(state.m.thirds[['upper', 'middle', 'lower'][j]] * 100);
      label(ctx, names[j] + ' ' + pct + '%', x1 + 6, (ys[j] + ys[j + 1]) / 2 + 4);
    }
    // hairline handle
    ctx.save(); ctx.fillStyle = 'rgba(147,231,244,1)';
    ctx.beginPath(); ctx.arc(x0, ys[0], 5, 0, 7); ctx.fill(); ctx.restore();
  }
  function drawFifths(ctx, p) {
    var xs = [A.LM.FACE_R, A.LM.EYE_R_OUT, A.LM.EYE_R_IN, A.LM.EYE_L_IN, A.LM.EYE_L_OUT, A.LM.FACE_L]
      .map(function (i) { return p[i].x; }).sort(function (a, b) { return a - b; });
    var yTop = p[A.LM.FOREHEAD_TOP].y, yBot = p[A.LM.MENTON].y, eyeY = p[A.LM.IRIS_R].y;
    for (var i = 0; i < xs.length; i++) line(ctx, xs[i], yTop, xs[i], yBot, { color: 'rgba(90,209,230,.5)', w: 1 });
    for (var s = 0; s < 5; s++) label(ctx, Math.round(state.m.fifths.segs[s] * 100) + '%', (xs[s] + xs[s + 1]) / 2, eyeY - 8, 'center');
  }
  function drawSymmetry(ctx, p) {
    var x = state.m.symmetry.midlineX, yTop = p[A.LM.FOREHEAD_TOP].y, yBot = p[A.LM.MENTON].y;
    line(ctx, x, yTop, x, yBot, { color: 'rgba(147,231,244,.9)', dash: [4, 4] });
    label(ctx, 'MIDLINE', x + 6, yTop + 14);
    A.SYMMETRIC_PAIRS.forEach(function (pr) {
      dot(ctx, p[pr[0]]); dot(ctx, p[pr[1]]);
    });
  }
  function dot(ctx, pt) { if (!pt) return; ctx.save(); ctx.fillStyle = 'rgba(90,209,230,.6)'; ctx.beginPath(); ctx.arc(pt.x, pt.y, 1.6, 0, 7); ctx.fill(); ctx.restore(); }
  function drawCanthal(ctx, p) {
    seg(ctx, p[A.LM.EYE_R_IN], p[A.LM.EYE_R_OUT], state.m.canthal.right);
    seg(ctx, p[A.LM.EYE_L_IN], p[A.LM.EYE_L_OUT], state.m.canthal.left);
    function seg(ctx, m, l, deg) {
      line(ctx, m.x, m.y, l.x, l.y, { color: 'rgba(147,231,244,.95)', w: 1.4 });
      line(ctx, m.x, m.y, l.x, m.y, { color: 'rgba(90,209,230,.4)', w: 1, dash: [3, 3] });
      label(ctx, (deg >= 0 ? '+' : '') + deg.toFixed(1) + '°', l.x + 4, l.y - 4);
    }
  }
  function drawShapeOverlay(ctx, p) {
    var pairs = [[A.LM.FOREHEAD_R, A.LM.FOREHEAD_L], [A.LM.FACE_R, A.LM.FACE_L], [A.LM.JAW_R, A.LM.JAW_L]];
    pairs.forEach(function (pr) { line(ctx, p[pr[0]].x, p[pr[0]].y, p[pr[1]].x, p[pr[1]].y, { color: 'rgba(90,209,230,.6)', w: 1 }); });
    line(ctx, (p[A.LM.FACE_R].x + p[A.LM.FACE_L].x) / 2, state.hairlineY, (p[A.LM.FACE_R].x + p[A.LM.FACE_L].x) / 2, p[A.LM.MENTON].y, { color: 'rgba(90,209,230,.5)', w: 1, dash: [5, 4] });
    label(ctx, state.shape.shape.toUpperCase(), p[A.LM.FACE_L].x + 6, p[A.LM.FACE_L].y);
  }
  function drawIndices(ctx, p) {
    ctx.save(); ctx.font = '8px "Space Mono", monospace';
    for (var i = 0; i < p.length; i++) {
      ctx.fillStyle = 'rgba(90,209,230,.5)'; ctx.beginPath(); ctx.arc(p[i].x, p[i].y, 1, 0, 7); ctx.fill();
      if (i % 2 === 0) { ctx.fillStyle = 'rgba(200,230,235,.5)'; ctx.fillText(i, p[i].x + 2, p[i].y - 2); }
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
      // live recompute thirds/score without re-detecting
      computeAll(); drawAll();
      var num = $('#composite-num'); if (num) num.textContent = state.scores.composite;
      var ring = $('#composite-ring'); if (ring) ring.style.setProperty('--pct', state.scores.composite);
    });
    cv.addEventListener('pointerup', function () {
      if (!state.drag) return;
      state.drag = false; renderFeatures();
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
    c.innerHTML = '<h4>Face shape</h4><p><span class="shape-name">' + state.shape.shape + '</span>' +
      '<span class="shape-conf">~' + Math.round(state.shape.confidence * 100) + '% match</span></p>' +
      '<p>' + state.shape.note + '</p>';
  }
  function renderSummary() {
    var c = $('#summary-card'); if (!c) return;
    var f = state.scores.features, items = [];
    var lowest = 100;
    for (var lk in f) if (f[lk].score < lowest) lowest = f[lk].score;
    var strong = topFeatures(f, true), soft = topFeatures(f, false);
    if (lowest >= 90) {
      items.push('Everything measured sits within or near the typical ranges.');
    } else {
      if (strong) items.push('Closest to typical ranges: <strong>' + strong + '</strong>.');
      if (soft) items.push('Furthest from typical: <strong>' + soft + '</strong>.');
    }
    items.push('This is one descriptive lens — see Methodology for what the numbers do and don’t mean.');
    c.innerHTML = '<h4>In short</h4><ul><li>' + items.join('</li><li>') + '</li></ul>';
  }
  function topFeatures(f, high) {
    var arr = Object.keys(f).map(function (k) { return { k: k, s: f[k].score, l: f[k].label }; });
    arr.sort(function (a, b) { return high ? b.s - a.s : a.s - b.s; });
    return arr.slice(0, 2).map(function (x) { return x.l.toLowerCase(); }).join(' and ');
  }

  /* ---- feature cards ---- */
  var DEFS = {
    symmetry: { def: 'How closely your left and right sides mirror each other.', fmt: function (v) { return (v * 100).toFixed(1) + '% avg offset'; }, ideal: 'under 5%' },
    thirds: { def: 'Balance of forehead, midface and lower-face heights.', fmt: function (v) { return (v * 100).toFixed(1) + '% max deviation'; }, ideal: 'under 3.5%' },
    fifths: { def: 'Whether the face divides into five even eye-widths across.', fmt: function (v) { return (v * 100).toFixed(1) + '% deviation'; }, ideal: 'under 3%' },
    canthal: { def: 'Tilt of each eye from inner to outer corner.', fmt: function (v) { return (v >= 0 ? '+' : '') + v.toFixed(1) + '°'; }, ideal: '+1° to +10°' },
    interocular: { def: 'Spacing between the eyes relative to eye width.', fmt: function (v) { return v.toFixed(2) + '×'; }, ideal: '1.10–1.42×' },
    nose: { def: 'Nose width relative to the inner-eye distance.', fmt: function (v) { return v.toFixed(2) + '×'; }, ideal: '0.90–1.25×' },
    mouthNose: { def: 'Mouth width relative to nose width.', fmt: function (v) { return v.toFixed(2) + '×'; }, ideal: '1.30–1.65×' },
    lips: { def: 'Upper-lip height relative to lower lip.', fmt: function (v) { return v.toFixed(2) + '×'; }, ideal: '0.45–0.72×' },
    midface: { def: 'Midface height relative to face width.', fmt: function (v) { return v.toFixed(2) + '×'; }, ideal: '0.48–0.60×' },
    fwhr: { def: 'Facial width-to-height (cheekbones vs upper face).', fmt: function (v) { return v.toFixed(2) + '×'; }, ideal: '1.75–2.20× · contested' },
    skin: { def: 'Under-eye and redness signals from the photo (lighting-dependent).', fmt: function (v) { return Math.round(v) + '/100'; }, ideal: 'photo-dependent' }
  };
  function tierPhrase(t) { return t === 'typical' ? 'within the typical range' : t === 'slightly' ? 'a little outside the typical range' : 'outside the typical range'; }
  function renderFeatures() {
    var grid = $('#feature-grid'); if (!grid) return; grid.innerHTML = '';
    var f = state.scores.features;
    Object.keys(f).forEach(function (k) {
      var fs = f[k], d = DEFS[k] || { def: '', fmt: function (v) { return v; }, ideal: '' };
      var card = el('div', 'feature');
      card.innerHTML =
        '<div class="feature-top"><span class="feature-name">' + fs.label + '</span>' +
        '<span class="feature-score t-' + fs.tier + '">' + fs.score + '</span></div>' +
        '<div class="gauge"><span class="gauge-band" style="left:80%;width:20%"></span>' +
        '<span class="gauge-fill t-' + fs.tier + '" style="width:' + fs.score + '%"></span></div>' +
        '<div class="feature-val">' + d.fmt(fs.value) + ' · typical ' + d.ideal + '</div>' +
        '<p class="feature-note">' + d.def + ' Here it reads ' + tierPhrase(fs.tier) + '.' +
        (k === 'skin' ? ' Treat this as a soft hint, not a measurement.' : '') + '</p>';
      grid.appendChild(card);
    });
  }

  /* ---- plan ---- */
  function renderPlan() {
    var wrap = $('#plan'); if (!wrap) return; wrap.innerHTML = '';
    var groups = RC.groupByCategory(state.recs);
    groups.forEach(function (g) {
      var block = el('div', 'plan-group');
      block.appendChild(el('p', 'plan-group-label', g.label));
      var items = el('div', 'plan-items');
      g.items.forEach(function (r) {
        var card = el('div', 'rec');
        card.innerHTML = '<h4 class="rec-title">' + r.title + '</h4>' +
          (r.because ? '<p class="rec-because">Because ' + r.because + '.</p>' : '') +
          '<p class="rec-body">' + r.body + '</p>' +
          '<p class="rec-why">' + r.why + '</p>';
        items.appendChild(card);
      });
      block.appendChild(items); wrap.appendChild(block);
    });
  }

  /* ---- methodology ---- */
  function renderMethodology() {
    var wrap = $('#methodology-body'); if (!wrap) return;
    var defs = Object.keys(DEFS).map(function (k) { return '<dt>' + (SC.LABELS[k] || k) + '</dt><dd>' + DEFS[k].def + ' Typical ' + DEFS[k].ideal + '.</dd>'; }).join('');
    wrap.innerHTML =
      acc('How Contour works',
        '<p>A face-landmark model runs entirely in your browser and returns hundreds of points. Contour levels your eyes to horizontal, scales everything by the distance between your pupils (so image size doesn’t matter), then compares a set of classic proportion ratios to common reference ranges. Each score is a simple, traceable distance from an “ideal” band.</p>') +
      acc('Why this is not a beauty score',
        '<p>The reference ranges come from “neoclassical” canons that are culture-bound and historically Eurocentric. They describe one narrow idea of proportion — not objective attractiveness, health, or worth. Real, admired faces sit outside these ranges constantly. Read the composite as a curiosity, not a verdict.</p>') +
      acc('Not medical advice',
        '<p>Contour is for adults, for self-care and curiosity. It does not diagnose anything, and every recommendation is a general lifestyle habit. For skin, sleep, or health concerns, talk to a qualified professional.</p>') +
      acc('What affects accuracy',
        '<p>Camera angle, lens distance (close selfies enlarge the nose and forehead), lighting, expression, hair, and glasses all shift the numbers. Contour gates the worst cases and shows a confidence level, but a straight-on, neutral, evenly-lit photo at arm’s length is always most reliable.</p>') +
      acc('What each measurement means', '<dl>' + defs + '</dl>');
  }
  function acc(title, body) { return '<details><summary>' + title + '</summary><div class="acc-body">' + body + '</div></details>'; }

  /* ---- debug ---- */
  function renderDebug() {
    var panel = $('#debug-panel'); if (!panel) return; panel.hidden = !DEBUG; if (!DEBUG) return;
    var dump = { delegate: window.ContourEngine && window.ContourEngine.delegate, pose: state.pose, gates: state.gates,
      faceFill: state.m && state.m.pxOriginal ? 'ok' : '-', skin: state.skin, composite: state.scores.composite };
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
