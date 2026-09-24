/* =================================================================
   CONTOUR — styling.js
   Turns { faceShape, measurements, profile } into practical, specific
   advice:
     hairPlan(ctx)  -> the "Your hair" section: goal for the face shape,
                       what to skip, the 3 best named cuts (from
                       hairstyles.js) with barber scripts, a care routine
                       for the texture, and measured-thirds fringe advice.
     quickWins(ctx) -> step-by-step grooming items tailored by profile
                       and measurements: skin routine by skin type,
                       beard, glasses, brows.

   Principles (same ethics as content.js):
   - Work WITH the person's natural texture — never "fix" it.
   - Styling only balances proportions visually; nothing claims to
     change the face. No medical/drug advice: thinning hair gets gentle
     habits + "a dermatologist can find the cause", nothing more.
   - Length preference, not gender, decides which cuts are offered.
   ================================================================= */

(function (root) {
  'use strict';

  var HS = (typeof require !== 'undefined')
    ? require('./hairstyles.js')
    : root.ContourHairstyles;

  var TEXTURES = ['straight', 'wavy', 'curly', 'coily'];

  // What styling aims to do for each face shape.
  var SHAPE_GOALS = {
    oval:    { goal: 'flexible',  aim: 'Your proportions are balanced, so most cuts work — choose for your texture and lifestyle.' },
    round:   { goal: 'height',    aim: 'Add height on top and keep the sides closer, to lengthen the face.' },
    oblong:  { goal: 'width',     aim: 'Add width at the sides and keep height down, so the face reads less long.' },
    square:  { goal: 'soften',    aim: 'Add softness and movement to balance a strong jaw and forehead.' },
    heart:   { goal: 'weightLow', aim: 'Keep the top light and add fullness around the jaw to balance a wider forehead.' },
    diamond: { goal: 'fillEnds',  aim: 'Add fullness at the forehead and jaw so the cheekbones aren’t the only wide point.' }
  };

  // Hair care routine by texture (numbered steps).
  var CARE = {
    straight: [
      'Wash every 1–3 days — as often as your roots get oily — with a gentle shampoo.',
      'Condition from mid-length to the ends only, not the roots.',
      'Use heat protectant before blow-drying or straightening, and keep tools on medium heat.',
      'Between washes, a little dry shampoo at the roots adds volume.'
    ],
    wavy: [
      'Wash 2–3 times a week and condition every time.',
      'Apply a light mousse, gel or sea-salt spray to damp hair and scrunch upward.',
      'Air-dry or diffuse on low. Don’t brush waves once dry — use your fingers.',
      'Refresh second-day waves with a mist of water and a quick scrunch.'
    ],
    curly: [
      'Wash 1–2 times a week with a sulfate-free shampoo; use a co-wash (conditioner-only wash) in between if needed.',
      'Detangle only when wet and full of conditioner, with fingers or a wide-tooth comb.',
      'On soaking-wet hair: leave-in, then curl cream or gel, scrunched upward.',
      'Diffuse on low or air-dry without touching; scrunch out any crunch once dry.',
      'Sleep on a satin or silk pillowcase, in a bonnet, or with curls in a loose high “pineapple”.'
    ],
    coily: [
      'Wash every 1–2 weeks and deep-condition every time.',
      'Seal moisture in with the LOC order: liquid or leave-in, then oil, then cream.',
      'Detangle in sections, from the ends up, with fingers or a wide-tooth comb.',
      'Use low-manipulation and protective styles (twists, braids) to cut breakage.',
      'Cover hair at night with a satin bonnet or durag, or use a satin pillowcase.'
    ]
  };
  var THICKNESS_STEP = {
    fine: 'Fine strands: use light products (mousse, sprays), keep oils to the very ends, and go easy on conditioner.',
    coarse: 'Coarse strands: richer creams, butters and oils work well, and less heat keeps them healthier.'
  };

  var FRINGE_ON = {
    straight: 'a soft side-swept or curtain fringe',
    wavy: 'curtain bangs that follow your wave',
    curly: 'a curly fringe, cut dry so it sits where it will land',
    coily: 'a front section of twists or curls brought forward'
  };
  var FRINGE_OFF = {
    straight: 'Brush it back or to the side',
    wavy: 'Push your waves back from your face',
    curly: 'Sweep your curls up and back from the hairline',
    coily: 'Keep a clean edge with the front styled up or back'
  };

  var THINNING = [
    'Shorter textured cuts (a crop, crew cut or buzz) make thinner areas look fuller than growing hair long to cover them.',
    'Use matte products, not shiny gels — shine shows more scalp.',
    'Avoid tight ponytails, braids or buns that pull at the hairline, and handle wet hair gently.',
    'Eat enough protein and iron.',
    'Thinning has many possible causes; a dermatologist can find yours.'
  ];

  // Beard shape that balances each face shape (full growth).
  var BEARD = {
    oval: 'Most shapes suit you — a short, even boxed beard or neat stubble keeps the balance.',
    round: 'Keep the cheeks short and let the chin grow a little longer (a short pointed or anchor shape) to lengthen the face.',
    oblong: 'Keep fullness at the sides and the chin short — an even-length full beard adds width.',
    square: 'Round off the corners: slightly longer at the chin, tapered short at the jaw angles.',
    heart: 'Go fuller at the chin and along the jaw (a short full beard) to add weight lower down.',
    diamond: 'Keep fullness at the chin and along the jaw; keep the cheeks tidy.'
  };

  // Frames that balance each face shape.
  var EYEWEAR = {
    oval: 'Most frames suit you — pick a shape about as wide as the widest part of your face.',
    round: 'Angular or rectangular frames, slightly wider than they are tall, add structure.',
    oblong: 'Deeper (taller) frames with a strong top line break up length; avoid small, narrow frames.',
    square: 'Round, oval or softly curved frames balance a strong jaw; avoid very boxy shapes.',
    heart: 'Frames that are wider at the bottom, round or rimless styles, and lighter colours balance a wider forehead.',
    diamond: 'Oval, cat-eye or frames with detail along the top widen the brow line.'
  };

  var SKIN = {
    oily:        { cleanser: 'a gel or foaming cleanser', moist: 'a light, oil-free gel moisturiser', spf: 'a fluid or gel SPF 30+ labelled non-comedogenic', active: 'a salicylic-acid (BHA) product 2–3 nights a week for shine and clogged pores' },
    dry:         { cleanser: 'a cream or milky cleanser (or just rinse with water in the morning)', moist: 'a rich cream with ceramides or glycerin, on slightly damp skin', spf: 'a moisturising cream SPF 30+', active: 'a gentle retinol 2 nights a week, over moisturiser, for texture — build up slowly' },
    combination: { cleanser: 'a gentle gel cleanser', moist: 'a light lotion, with extra cream only on dry patches', spf: 'a fluid SPF 30+', active: 'a gentle retinol or mild exfoliating acid 2–3 nights a week, introduced slowly' },
    sensitive:   { cleanser: 'a fragrance-free, gentle cream cleanser', moist: 'a plain, fragrance-free moisturiser', spf: 'a mineral SPF 30+ (zinc oxide or titanium dioxide)', active: null },
    unsure:      { cleanser: 'a gentle, fragrance-free cleanser', moist: 'a light, fragrance-free moisturiser', spf: 'a broad-spectrum SPF 30+', active: 'one active (a gentle retinol or mild exfoliating acid) 2–3 nights a week, introduced slowly' }
  };

  function lowerFirst(s) { return s.charAt(0).toLowerCase() + s.slice(1); }
  function shapeLabel(fs) {
    if (!fs || !fs.shape) return null;
    return fs.leaning && fs.secondary ? fs.shape + ', leaning ' + fs.secondary : fs.shape;
  }

  /* ---- the "Your hair" section ----
     ctx = { faceShape, measurements?, profile?, hairlineKnown? } */
  function hairPlan(ctx) {
    var p = ctx.profile || {}, fs = ctx.faceShape || {};
    var shape = SHAPE_GOALS[fs.shape] ? fs.shape : 'oval';
    var g = SHAPE_GOALS[shape];
    var secShape = fs.leaning && SHAPE_GOALS[fs.secondary] ? fs.secondary : null;
    var secGoal = secShape && SHAPE_GOALS[secShape].goal !== g.goal ? SHAPE_GOALS[secShape].goal : null;
    var tex = TEXTURES.indexOf(p.hairTexture) >= 0 ? p.hairTexture : null;
    var thinning = p.hairConcern === 'thinning';

    var plan = {
      shape: shape, shapeLabel: shapeLabel(fs) || shape, goal: g.goal, aim: g.aim,
      alsoAim: secGoal ? 'You also lean ' + secShape + ': ' + lowerFirst(SHAPE_GOALS[secShape].aim) : null,
      avoid: HS.AVOID[g.goal].slice(),
      needsTexture: !tex, texture: tex, lengthPref: p.lengthPref || 'open',
      styles: [], care: null, fringe: null, thinning: null
    };
    if (!tex) return plan;

    plan.styles = HS.pick(tex, { primary: g.goal, secondary: secGoal }, p.lengthPref || 'open', 3, { preferShort: thinning });

    var th = p.hairThickness;
    plan.care = {
      title: 'Care routine for ' + (th && th !== 'medium' ? th + ', ' : '') + tex + ' hair',
      steps: CARE[tex].concat(THICKNESS_STEP[th] ? [THICKNESS_STEP[th]] : [])
    };

    var t3 = ctx.measurements && ctx.measurements.thirds;
    if (t3 && typeof t3.upper === 'number' && ctx.hairlineKnown !== false) {
      var pct = Math.round(t3.upper * 100);
      if (t3.upper > 0.36) {
        plan.fringe = { title: 'A fringe would balance your forehead',
          body: 'Try ' + FRINGE_ON[tex] + '. It shortens the forehead section so your face reads more evenly top to bottom.',
          because: 'Your forehead is ' + pct + '% of your face height (about 33% is even).' };
      } else if (t3.upper < 0.30) {
        plan.fringe = { title: 'Keep your forehead open',
          body: FRINGE_OFF[tex] + '. Showing more forehead evens out your proportions; a heavy fringe would shorten it further.',
          because: 'Your forehead is ' + pct + '% of your face height (about 33% is even).' };
      }
    }
    if (thinning) plan.thinning = { title: 'If your hair is thinning', steps: THINNING.slice() };
    return plan;
  }

  /* ---- step-by-step grooming wins tailored by profile + measurements ----
     Items: { id, category, title, body, steps, priority, because } */
  function quickWins(ctx) {
    var p = ctx.profile || {}, fs = ctx.faceShape || {}, m = ctx.measurements || {}, out = [];
    var shape = BEARD[fs.shape] ? fs.shape : null;
    var label = shapeLabel(fs);

    // skin routine — always; tailored when the skin type is known
    var st = SKIN[p.skinType] ? p.skinType : 'unsure';
    var k = SKIN[st];
    var steps = [
      'Morning: wash with ' + k.cleanser + '.',
      'Morning: apply ' + k.moist + '.',
      'Morning: finish with ' + k.spf + ' — about two finger-lengths for face and neck. Reapply if you’re outside for hours.',
      'Evening: cleanse (if you wore sunscreen or makeup, massage in a cleansing balm or oil first), then moisturise.'
    ];
    steps.push(k.active
      ? 'Once that’s a habit (2–3 weeks), you can add ' + k.active + '. Patch-test first.'
      : 'Skip strong actives for now; add any new product one at a time, patch-testing on your jaw first.');
    out.push({
      id: 'skin-routine', category: 'skin', priority: 6,
      title: st === 'unsure' ? 'A simple daily skin routine' : 'Daily routine for ' + st + ' skin',
      body: 'Five minutes a day. Daily sunscreen is the single biggest thing you can do for your skin’s tone and texture.',
      steps: steps,
      because: st === 'unsure' ? null : 'you told Contour your skin is ' + st
    });

    // beard
    if (shape && (p.facialHair === 'full' || p.facialHair === 'patchy')) {
      var patchy = p.facialHair === 'patchy';
      out.push({
        id: 'beard', category: 'grooming', priority: 5,
        title: patchy ? 'Make light facial hair look intentional' : 'Shape your beard for your face',
        body: patchy
          ? 'Short and even beats long and patchy. Clean lines make any length look deliberate.'
          : BEARD[shape],
        steps: patchy ? [
          'Let it grow 4–6 weeks without trimming before you judge how it fills in.',
          'If it’s still patchy, keep it at even stubble — a #1–2 guard (3–6 mm) makes gaps disappear.',
          'Shave a clean neckline 1–2 finger-widths above your Adam’s apple, curving up to just behind the jaw corner.',
          'Tidy stray cheek hairs, but keep your natural cheek line — lowering it makes the face look wider.',
          'If your moustache and chin fill in best, a goatee or moustache-and-chin shape is a good alternative.'
        ] : [
          'Trim once a week with a guarded trimmer — a #2–4 guard (6–13 mm) for a short beard.',
          'Shave a clean neckline 1–2 finger-widths above your Adam’s apple, curving up to just behind the jaw corner.',
          'Keep your natural cheek line and only remove strays — lowering it makes the face look wider.',
          'Use a few drops of beard oil or balm daily, and wash the beard 2–3 times a week.'
        ],
        because: 'your face reads ' + label + ' and your facial hair grows ' + (patchy ? 'patchy or light' : 'in full')
      });
    }

    // glasses
    if (shape && p.glasses === 'yes') {
      out.push({
        id: 'eyewear', category: 'grooming', priority: 4,
        title: 'Choose frames that fit your face',
        body: EYEWEAR[shape],
        steps: [
          'Width: the frame should be about as wide as your face at the temples — no gap at the sides and no overhang.',
          'Height: the top of the frame should follow your brows, not cover them or sit far below.',
          'Your eyes should sit near the centre of each lens.',
          'If they slide down, ask the optician to adjust the nose pads or arms — it’s usually free.'
        ],
        because: 'you wear glasses and your face reads ' + label
      });
    }

    // brows — always useful; tailored to measured eye spacing / tilt
    var extra = [], reasons = [];
    var ratio = m.interocular && m.interocular.ratio;
    if (typeof ratio === 'number' && ratio > 1.40) {
      extra.push('Your eyes are set a little wider apart than average: keep the inner ends of your brows full, and fill slightly toward your nose with a brow pencil or tinted gel if you like.');
      reasons.push('your eye spacing measured ' + ratio.toFixed(2) + '× your eye width');
    } else if (typeof ratio === 'number' && ratio < 1.13) {
      extra.push('Your eyes are set a little closer than average: tidy the inner ends so each brow starts right above the inner corner of your eye — it opens up the space between them.');
      reasons.push('your eye spacing measured ' + ratio.toFixed(2) + '× your eye width');
    }
    var tilt = m.canthal && m.canthal.avg;
    if (typeof tilt === 'number' && tilt < -1) {
      extra.push('Your outer eye corners sit slightly lower than the inner ones: keep the brow tail level or slightly lifted, and trim long hairs that pull it downward.');
      reasons.push('your eye tilt measured ' + tilt.toFixed(1) + '°');
    }
    out.push({
      id: 'brows', category: 'eyes', priority: extra.length ? 5 : 3,
      title: 'Groom your brows to frame your eyes',
      body: 'Neat brows are the quickest way to make eyes look more open and balanced — no reshaping needed.',
      steps: [
        'Brush your brows upward with clear brow gel (or a spoolie and a little soap).',
        'After brushing up, trim only the hairs that stick out above the top line, with small scissors.',
        'Tweeze strays below the brow and between the brows. Each brow should start roughly above the inner corner of your eye.'
      ].concat(extra).concat(['Leave the tails full — over-thinned brows make the face look tired.']),
      because: reasons.length ? reasons.join(' and ') : null
    });

    return out;
  }

  var api = {
    TEXTURES: TEXTURES, SHAPE_GOALS: SHAPE_GOALS, CARE: CARE, THICKNESS_STEP: THICKNESS_STEP,
    FRINGE_ON: FRINGE_ON, FRINGE_OFF: FRINGE_OFF, THINNING: THINNING, BEARD: BEARD, EYEWEAR: EYEWEAR,
    SKIN: SKIN, hairPlan: hairPlan, quickWins: quickWins, shapeLabel: shapeLabel
  };
  root.ContourStyling = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

})(typeof window !== 'undefined' ? window : this);
