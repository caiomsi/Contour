/* =================================================================
   CONTOUR — styling.js
   Hair-type-aware styling + care knowledge pack (data) and the pure
   selectors that turn { faceShape, measurements, profile } into plan
   items. Consumed by recommendations.js.

   Principles (same ethics as content.js):
   - Work WITH the person's natural texture — never "fix" it. Every
     texture gets real options at every length.
   - Styling only balances proportions visually; nothing here claims to
     change the face. No medical/drug advice: hair thinning gets gentle
     habits + "a dermatologist can find the cause", nothing more.
   - Length preference, not gender, decides which cuts are offered.
   ================================================================= */

(function (root) {
  'use strict';

  var TEXTURES = ['straight', 'wavy', 'curly', 'coily'];

  // What styling aims to do for each face shape.
  var SHAPE_GOALS = {
    oval:    { goal: 'flexible', aim: 'Your proportions are balanced, so almost any cut works — choose for lifestyle and texture.' },
    round:   { goal: 'height',   aim: 'Add height and a little angle on top, keep the sides closer, to lengthen the face.' },
    oblong:  { goal: 'width',    aim: 'Add width at the sides and keep height down, so length doesn’t read as extra length.' },
    square:  { goal: 'soften',   aim: 'Add softness and movement to offset a strong jaw and forehead; avoid very boxy lines.' },
    heart:   { goal: 'weightLow', aim: 'Keep the top lighter and put fullness around the jaw and chin to balance a wider forehead.' },
    diamond: { goal: 'fillEnds', aim: 'Add fullness at the forehead and jaw so the cheekbones aren’t the only wide point.' }
  };

  // CUTS[goal][texture] = { short, medium, long }
  var CUTS = {
    flexible: {
      straight: { short: 'a textured crop or classic side part', medium: 'a layered cut at collar or chin length', long: 'long layers or a blunt one-length cut' },
      wavy:     { short: 'a short textured cut that leaves the wave on top', medium: 'a shag or shoulder-length layers that let the wave move', long: 'long face-framing layers' },
      curly:    { short: 'a tapered cut with defined curls on top', medium: 'a rounded curly shape cut dry, curl by curl', long: 'long layered curls with shape kept all round' },
      coily:    { short: 'a tapered cut, low fade or a close crop', medium: 'a shaped afro, twist-out or two-strand twists', long: 'twists, locs, braids or a full picked-out afro' }
    },
    height: {
      straight: { short: 'a textured quiff or short pompadour with tighter sides', medium: 'a side part with lift at the crown and a longer top', long: 'long layers starting below the chin with volume at the crown; skip a centre part that sits flat' },
      wavy:     { short: 'a short cut with length on top, waves pushed up and back', medium: 'a layered shag with lift at the roots and closer sides', long: 'long layers with crown lift; let waves start below the cheekbones' },
      curly:    { short: 'a curly top with a taper or fade at the sides', medium: 'curls stacked higher on top, trimmed closer at the sides', long: 'long curls with height at the crown — a pineapple or high half-up style works well' },
      coily:    { short: 'a high-top, sponge-twisted top or tapered afro with low sides', medium: 'a tapered afro that is taller than it is wide', long: 'a high puff, top bun, or twists/locs styled up' }
    },
    width: {
      straight: { short: 'a side-parted cut with some fullness at the sides; keep the top low', medium: 'a chin-length bob or layered cut that sits wide at the cheekbones', long: 'long layers with a fringe or curtain bangs, and waves or volume at the sides' },
      wavy:     { short: 'a textured cut with the wave pushed out to the sides, not up', medium: 'a shoulder-length shag with fullness at cheek level', long: 'waves that sit wide from the cheekbones down, with a fringe to shorten length' },
      curly:    { short: 'a rounded curly crop, even length all round rather than tall', medium: 'a rounded curly shape that is wider than it is tall', long: 'volume at the sides with curtain bangs; avoid piling height on top' },
      coily:    { short: 'an even rounded crop or low taper without extra height', medium: 'a rounded afro or twist-out shaped wide rather than tall', long: 'side-parted twists or braids, or a wide afro; skip high buns' }
    },
    soften: {
      straight: { short: 'a textured, slightly messy crop or a soft side-swept fringe', medium: 'a layered cut with soft, longer pieces around the jaw', long: 'long layers with face-framing pieces and a side part' },
      wavy:     { short: 'a short cut with loose, textured movement on top', medium: 'a soft shag or wavy bob that ends below the jaw', long: 'long, loose waves with face-framing layers' },
      curly:    { short: 'curls kept loose and a little longer on top, softly tapered', medium: 'a rounded curly cut that frames the face', long: 'long layered curls; avoid a sharp one-length line at the jaw' },
      coily:    { short: 'a tapered cut with a rounded, not squared-off, shape up', medium: 'a rounded twist-out or soft afro', long: 'twists or locs worn down to soften angles, or a side-swept style' }
    },
    weightLow: {
      straight: { short: 'a side-swept fringe with a longer, textured top; avoid lots of volume up top', medium: 'a chin-to-collar length cut that is fuller at the ends', long: 'long layers that start at the chin, with side-swept bangs' },
      wavy:     { short: 'a short cut with a soft fringe falling to one side', medium: 'a lob or shoulder-length cut with waves fullest around the jaw', long: 'long waves that start at the jaw, lighter at the crown' },
      curly:    { short: 'curls kept lighter on top with a soft fringe', medium: 'a curly cut shaped fullest at chin level (an inverted-triangle shape)', long: 'long curls with most volume from the jaw down' },
      coily:    { short: 'a close, even crop that keeps the top low', medium: 'a twist-out or afro shaped fuller at the sides and bottom', long: 'twists or braids worn down, or a low bun at the nape' }
    },
    fillEnds: {
      straight: { short: 'a fringe or textured top that covers part of the forehead, with some fullness at the sides', medium: 'a chin-length cut with a fringe', long: 'long layers with a fringe and fullness from the jaw down' },
      wavy:     { short: 'a short wavy cut with a fringe falling forward', medium: 'a wavy bob or shag with bangs', long: 'long waves with curtain bangs and volume at jaw level' },
      curly:    { short: 'curls worn forward with a curly fringe', medium: 'a curly shape with a fringe and fullness at the chin', long: 'long curls with a curly fringe; keep the sides from sitting flat' },
      coily:    { short: 'a rounded crop with some forward-brushed fullness', medium: 'a rounded afro or twist-out with fullness at forehead and jaw level', long: 'twists or locs with a front section brought forward, or a full rounded afro' }
    }
  };

  // Care by texture, adjusted for thickness.
  var CARE = {
    straight: 'Wash every 1–3 days if it gets oily at the roots, using a gentle shampoo; condition from mid-length to ends only. Use heat protectant before blow-drying or straightening, and keep tools on medium heat.',
    wavy: 'Wash 2–3 times a week and use a light conditioner every time. Apply a light mousse, gel or sea-salt spray to damp hair, scrunch upward, then air-dry or use a diffuser. Brushing dry waves breaks them up; use fingers or a wide-tooth comb in the shower.',
    curly: 'Wash 1–2 times a week with a sulfate-free shampoo (or a co-wash between washes) and condition generously every time. Detangle only when hair is wet and full of conditioner. Apply a leave-in plus a curl cream or gel to soaking-wet hair, then diffuse or air-dry without touching. Sleep on a satin/silk pillowcase or in a bonnet or pineapple.',
    coily: 'Keep it moisturised: wash every 1–2 weeks, deep-condition every time, and use the LOC/LCO order (liquid or leave-in, then oil and cream) to lock water in. Detangle in sections with fingers or a wide-tooth comb, from the ends up. Low-manipulation and protective styles (twists, braids) reduce breakage. Cover hair at night with satin or silk.'
  };
  var THICKNESS_NOTE = {
    fine: 'Fine strands get weighed down easily: choose lightweight products (mousse, light sprays), keep oils to the very ends, and don’t use too much conditioner.',
    medium: '',
    coarse: 'Coarse strands can take richer products — creams, butters and oils — and usually need more moisture and less heat.'
  };

  // Beard shapes that balance each face shape (full growth).
  var BEARD = {
    oval: 'Most beard styles suit you; a short, even boxed beard or neat stubble keeps the balance.',
    round: 'Keep the cheeks shorter and the chin longer — a goatee, anchor or short pointed boxed beard lengthens the face.',
    oblong: 'Keep fullness at the sides and the chin short: a full, even-length beard or mutton-chop-style sides adds width.',
    square: 'Round the corners: a short beard that is a little longer at the chin and tapered at the jaw angles softens a strong jaw.',
    heart: 'A fuller beard at the chin and jaw (a short full beard or a chin-strap with a goatee) adds weight lower down.',
    diamond: 'Keep fullness at the chin and along the jaw to add width there; keep the cheeks tidy.'
  };
  var BEARD_PATCHY = 'With patchy or light growth, short even stubble (about 3–5 mm) or a neat goatee/moustache usually looks fuller than growing it out. A beard trimmer with guards and a clean neckline do most of the work.';

  // Eyewear frames that balance each face shape.
  var EYEWEAR = {
    oval: 'Most frames suit you; pick ones about as wide as the widest part of your face, with a top line that follows your brows.',
    round: 'Angular, rectangular or geometric frames that are slightly wider than tall add structure.',
    oblong: 'Deeper (taller) frames with decorative temples or a strong brow line break up length; avoid small narrow frames.',
    square: 'Round, oval or softly curved frames balance a strong jaw; avoid very boxy shapes.',
    heart: 'Frames that are wider at the bottom, round or rimless styles, and light colours balance a wider forehead.',
    diamond: 'Cat-eye, oval or frames with detail along the top widen the forehead line; rimless styles work too.'
  };

  // Skin-type tweaks to the daily routine.
  var SKIN_TYPE = {
    oily: 'Use a gel or foaming cleanser and a lightweight, oil-free gel moisturiser; choose a fluid or gel sunscreen labelled non-comedogenic. Blotting papers work better during the day than washing again.',
    dry: 'Use a cream or milky cleanser and a richer moisturiser (ceramides, glycerin), applied to slightly damp skin. Keep showers warm, not hot, and pick a moisturising cream sunscreen.',
    combination: 'Cleanse gently, use a light lotion all over and a little extra moisturiser only where you’re dry. A fluid sunscreen suits most combination skin.',
    sensitive: 'Keep the routine short and fragrance-free: a gentle cleanser, a plain moisturiser, and a mineral sunscreen (zinc oxide/titanium dioxide). Add any new product one at a time and patch-test first.'
  };

  // Fringe / forehead styling by texture (used with measured thirds).
  var FRINGE_ON = {
    straight: 'a soft side-swept or curtain fringe',
    wavy: 'curtain bangs that follow your wave',
    curly: 'a curly fringe, cut dry so it sits where it will land',
    coily: 'a front section of twists or curls brought forward'
  };
  var FRINGE_OFF = {
    straight: 'brushed back or off the face with a side part',
    wavy: 'waves pushed back from the face',
    curly: 'curls swept up and back from the hairline',
    coily: 'a clean edge with the front kept up or back'
  };

  var THINNING = 'Choose shorter, textured cuts: they make thinner areas look fuller more reliably than growing hair long to cover them. Avoid tight ponytails, braids or buns that pull at the hairline, handle wet hair gently, and eat enough protein and iron. Thinning has many possible causes, so a dermatologist is the right person to find yours.';

  /* Pure selector: plan items for a profile. Returns [] without one.
     ctx = { faceShape (classify() result), measurements?, profile } */
  function recsFor(ctx) {
    var p = ctx.profile || {}, fs = ctx.faceShape, out = [];
    if (!p || !Object.keys(p).length) return out;
    var shape = fs && fs.shape, second = fs && fs.leaning ? fs.secondary : null;
    var shapeDesc = shape ? (second ? shape + ', leaning ' + second : shape) : null;
    var tex = p.hairTexture, len = p.lengthPref;

    // ---- cut for shape × texture × length ----
    if (tex && shape && SHAPE_GOALS[shape]) {
      var g = SHAPE_GOALS[shape], cuts = CUTS[g.goal][tex];
      var lens = (len && len !== 'open') ? [len] : ['short', 'medium', 'long'];
      var list = lens.map(function (l) { return (lens.length > 1 ? cap(l) + ': ' : '') + cuts[l] + '.'; });
      var body = g.aim + ' ' + (lens.length > 1 ? 'Options for ' + tex + ' hair — ' + list.join(' ') : 'For ' + tex + ' hair at ' + len + ' length: ' + list[0]);
      if (second && SHAPE_GOALS[second] && SHAPE_GOALS[second].goal !== g.goal) {
        body += ' Because you also lean ' + second + ', ' + lowerFirst(SHAPE_GOALS[second].aim);
      }
      out.push({
        id: 'hair-cut', category: 'hair', priority: 7,
        title: 'A cut for your face shape and ' + tex + ' hair',
        body: body,
        why: 'Where a cut adds or removes volume changes how proportions read. Working with your natural texture means less daily styling and less heat.',
        because: 'your face reads ' + shapeDesc + ' and you told Contour your hair is ' + tex
      });
    }

    // ---- care routine for texture (+ thickness) ----
    if (tex) {
      var th = p.hairThickness, note = th ? THICKNESS_NOTE[th] : '';
      out.push({
        id: 'hair-care', category: 'hair', priority: 6,
        title: 'Care routine for ' + (th && th !== 'medium' ? th + ', ' : '') + tex + ' hair',
        body: CARE[tex] + (note ? ' ' + note : ''),
        why: 'Each texture holds moisture and oil differently. A routine that suits yours keeps it healthier and makes any cut look better.',
        because: 'you told Contour your hair is ' + (th ? th + ' and ' : '') + tex
      });
    }

    // ---- fringe / forehead, driven by the measured upper third ----
    var th3 = ctx.measurements && ctx.measurements.thirds;
    if (tex && th3 && typeof th3.upper === 'number' && ctx.hairlineKnown !== false) {
      if (th3.upper > 0.36) {
        out.push({
          id: 'hair-fringe', category: 'hair', priority: 5,
          title: 'Consider a fringe',
          body: 'Your upper third (hairline to brows) measures a little taller than the other two, so a fringe can balance it: ' + FRINGE_ON[tex] + ' works with your texture.',
          why: 'A fringe visually shortens the forehead section, evening out the three vertical thirds.',
          because: 'your forehead section measured ' + Math.round(th3.upper * 100) + '% of face height (about 33% is even)'
        });
      } else if (th3.upper < 0.30) {
        out.push({
          id: 'hair-fringe', category: 'hair', priority: 4,
          title: 'Keep your forehead open',
          body: 'Your upper third measures a little shorter than the other two, so wearing hair ' + FRINGE_OFF[tex] + ' shows more of it. A heavy fringe would shorten it further.',
          why: 'Showing more forehead lengthens the upper third, evening out the vertical proportions.',
          because: 'your forehead section measured ' + Math.round(th3.upper * 100) + '% of face height (about 33% is even)'
        });
      }
    }

    // ---- beard ----
    if (shape && (p.facialHair === 'full' || p.facialHair === 'patchy')) {
      out.push({
        id: 'beard', category: 'grooming', priority: 5,
        title: p.facialHair === 'patchy' ? 'Make light facial hair look intentional' : 'A beard shape for your face',
        body: p.facialHair === 'patchy' ? BEARD_PATCHY + ' If you grow it longer: ' + lowerFirst(BEARD[shape]) : BEARD[shape],
        why: 'A beard changes the outline of the lower face, so its shape can balance your proportions.',
        because: 'your face reads ' + shapeDesc + ' and your facial hair grows ' + (p.facialHair === 'patchy' ? 'patchy or light' : 'in full')
      });
    }

    // ---- eyewear ----
    if (shape && p.glasses === 'yes') {
      out.push({
        id: 'eyewear', category: 'grooming', priority: 4,
        title: 'Glasses frames for your face shape',
        body: EYEWEAR[shape],
        why: 'Frames sit right on the face’s centre line, so their shape noticeably shifts how proportions read.',
        because: 'you wear glasses and your face reads ' + shapeDesc
      });
    }

    // ---- skin type ----
    if (p.skinType && SKIN_TYPE[p.skinType]) {
      out.push({
        id: 'skin-type', category: 'skin', priority: 6,
        title: 'Match your routine to ' + p.skinType + ' skin',
        body: SKIN_TYPE[p.skinType],
        why: 'The right texture of cleanser, moisturiser and sunscreen for your skin type makes a daily routine easier to stick to.',
        because: 'you told Contour your skin is ' + p.skinType
      });
    }

    // ---- thinning (lifestyle-only) ----
    if (p.hairConcern === 'thinning') {
      out.push({
        id: 'hair-thinning', category: 'hair', priority: 6,
        title: 'Styling and habits for thinning hair',
        body: THINNING,
        why: 'Gentle handling prevents avoidable breakage, and a dermatologist can tell whether something treatable is behind it.',
        because: 'you mentioned thinning or a receding hairline'
      });
    }
    return out;
  }

  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function lowerFirst(s) { return s.charAt(0).toLowerCase() + s.slice(1); }

  var api = {
    TEXTURES: TEXTURES, SHAPE_GOALS: SHAPE_GOALS, CUTS: CUTS, CARE: CARE, THICKNESS_NOTE: THICKNESS_NOTE,
    BEARD: BEARD, BEARD_PATCHY: BEARD_PATCHY, EYEWEAR: EYEWEAR, SKIN_TYPE: SKIN_TYPE,
    FRINGE_ON: FRINGE_ON, FRINGE_OFF: FRINGE_OFF, THINNING: THINNING, recsFor: recsFor
  };
  root.ContourStyling = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

})(typeof window !== 'undefined' ? window : this);
