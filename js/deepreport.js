/* =================================================================
   CONTOUR — deepreport.js
   Client side of the opt-in AI deep report. This is the ONLY feature
   that sends the photo off-device, and it does so exclusively after
   an explicit button press. Pure, Node-testable pieces (payload
   builder + response sanitizer) live here alongside a DOM renderer
   that treats the AI's text as untrusted (textContent only).
   ================================================================= */

(function (root) {
  'use strict';

  var ENDPOINT = 'https://forms.caiomsi.com/api/contour-report';

  function r3(v) { return Math.round(v * 1000) / 1000; }

  /* Compact, rounded metrics summary for the AI — numbers only, no
     pixels/landmarks, small enough to keep the request light. */
  function buildDeepPayload(measurements, scores, faceShape, skin) {
    var m = measurements || {};
    var feats = {};
    if (scores && scores.features) {
      for (var k in scores.features) {
        var f = scores.features[k];
        feats[k] = { score: f.score, value: r3(f.value), tier: f.tier };
      }
    }
    return {
      composite: scores ? scores.composite : null,
      confidence: scores ? scores.confidence : null,
      features: feats,
      thirds: m.thirds ? { upper: r3(m.thirds.upper), middle: r3(m.thirds.middle), lower: r3(m.thirds.lower) } : null,
      canthalDeg: m.canthal ? { right: r3(m.canthal.right), left: r3(m.canthal.left) } : null,
      faceShape: faceShape ? { shape: faceShape.shape, confidence: r3(faceShape.confidence) } : null,
      skin: skin ? {
        underEyeDelta: r3(skin.underEye.delta), underEyeFlagged: skin.underEye.flagged,
        rednessExcess: r3(skin.redness.index), rednessFlagged: skin.redness.flagged
      } : null,
      note: 'Scores are 0-100 vs wide, culture-bound reference bands; tier "typical" means inside the band.'
    };
  }

  /* Validate + trim the AI's report before rendering. Returns a clean
     object or null. Caps lengths and list sizes; drops malformed rows. */
  function sanitizeReport(raw) {
    if (!raw || typeof raw !== 'object') return null;
    function str(v, cap) { return typeof v === 'string' ? v.trim().slice(0, cap) : ''; }

    var out = {
      headline: str(raw.headline, 220),
      summary: str(raw.summary, 1200),
      observations: [],
      plan: [],
      disclaimer: str(raw.disclaimer, 350)
    };
    if (Array.isArray(raw.observations)) {
      for (var i = 0; i < raw.observations.length && out.observations.length < 6; i++) {
        var o = raw.observations[i];
        if (!o || typeof o !== 'object') continue;
        var area = str(o.area, 90), note = str(o.note, 600);
        if (area && note) out.observations.push({ area: area, note: note });
      }
    }
    if (Array.isArray(raw.plan)) {
      for (var j = 0; j < raw.plan.length && out.plan.length < 6; j++) {
        var p = raw.plan[j];
        if (!p || typeof p !== 'object') continue;
        var title = str(p.title, 140), why = str(p.why, 600), how = str(p.how, 800);
        if (title && how) out.plan.push({ title: title, why: why, how: how });
      }
    }
    // A usable deep report needs at least one concrete item; prose-only
    // (or fully mangled) responses are rejected and surfaced as an error.
    if (!out.observations.length && !out.plan.length) return null;
    return out;
  }

  /* Render into a container. All AI text goes through textContent —
     never innerHTML — so the model can't inject markup. */
  function renderDeepReport(container, report) {
    if (!container || !report) return;
    container.textContent = '';
    function el(tag, cls, text) {
      var e = document.createElement(tag);
      if (cls) e.className = cls;
      if (text) e.textContent = text;
      return e;
    }
    if (report.headline) container.appendChild(el('p', 'dr-headline', report.headline));
    if (report.summary) container.appendChild(el('p', 'dr-summary', report.summary));

    if (report.observations.length) {
      container.appendChild(el('p', 'dr-label', 'What the AI noticed'));
      var obsWrap = el('div', 'dr-obs');
      report.observations.forEach(function (o) {
        var card = el('div', 'dr-obs-item');
        card.appendChild(el('span', 'dr-obs-area', o.area));
        card.appendChild(el('p', 'dr-obs-note', o.note));
        obsWrap.appendChild(card);
      });
      container.appendChild(obsWrap);
    }

    if (report.plan.length) {
      container.appendChild(el('p', 'dr-label', 'Personal suggestions'));
      var planWrap = el('div', 'dr-plan');
      report.plan.forEach(function (p) {
        var card = el('div', 'dr-plan-item');
        card.appendChild(el('h4', 'dr-plan-title', p.title));
        if (p.why) card.appendChild(el('p', 'dr-plan-why', p.why));
        card.appendChild(el('p', 'dr-plan-how', p.how));
        planWrap.appendChild(card);
      });
      container.appendChild(planWrap);
    }

    if (report.disclaimer) container.appendChild(el('p', 'dr-disclaimer', report.disclaimer));
  }

  /* Map an error response to friendly copy. */
  function errorMessage(status, body) {
    var code = body && body.error;
    if (code === 'not-configured') return 'The AI deep report isn’t switched on yet — check back soon.';
    if (code === 'daily-limit') return 'Today’s free AI reports are used up. Try again tomorrow.';
    if (code === 'personal-daily-limit') return 'You’ve used today’s AI reports on this connection. Try again tomorrow.';
    if (status === 429) return 'A little too fast — wait a minute and try again.';
    if (status === 422) return code || 'This photo couldn’t be analyzed — try a clearer, front-facing photo.';
    if (status === 413) return 'The photo is too large to send.';
    return 'The AI report couldn’t be generated right now. Your local report above is unaffected.';
  }

  var api = {
    ENDPOINT: ENDPOINT,
    buildDeepPayload: buildDeepPayload,
    sanitizeReport: sanitizeReport,
    renderDeepReport: renderDeepReport,
    errorMessage: errorMessage
  };
  root.ContourDeepReport = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

})(typeof window !== 'undefined' ? window : this);
