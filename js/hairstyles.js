/* =================================================================
   CONTOUR — hairstyles.js
   A library of real, named hairstyles with the practical detail a
   person needs to actually get and wear them: what to ask the barber
   or stylist (clipper guards, lengths, techniques), how to style it
   day to day, which products, and how often to trim.

   Each style lists the hair textures it works for, its length, and
   how well it serves each face-shape "goal" (0 = not a fit, 1 = works,
   2 = a strong fit). styling.js picks the best 3 for a person.

   Clipper guard reference used in the copy: #1 = 3 mm, #2 = 6 mm,
   #3 = 10 mm, #4 = 13 mm. 1 inch ≈ 2.5 cm.
   ================================================================= */

(function (root) {
  'use strict';

  // What each goal does for the face, used to explain "why it suits you".
  var GOAL_BENEFIT = {
    flexible: 'suits your balanced proportions without fighting them',
    height: 'adds length, so a round face reads longer and more defined',
    width: 'adds width at the sides, so a longer face reads more balanced',
    soften: 'adds movement that softens a strong, angular jaw and forehead',
    weightLow: 'keeps the top light and adds fullness lower down, balancing a wider forehead',
    fillEnds: 'fills out the forehead and jaw area, balancing wide cheekbones'
  };

  // Cuts that usually work against each goal.
  var AVOID = {
    flexible: ['Very heavy fringes that hide your whole forehead', 'Extreme volume on one side only'],
    height: ['Flat, one-length cuts that end right at the chin', 'Lots of volume at the sides (widens the face)', 'Heavy blunt fringes cut straight across'],
    width: ['Tall styles with height on top (quiffs, high buns)', 'Very short sides with a long top', 'Long, flat, one-length hair with a centre part'],
    soften: ['Boxy, geometric cuts with hard lines at the jaw', 'Blunt one-length bobs ending at the jawline', 'Slicked-flat styles that expose every angle'],
    weightLow: ['Big volume or height at the crown', 'Very short, tight crops that expose a wide forehead', 'Sleek hair pulled tightly back'],
    fillEnds: ['Height on top with tight, short sides', 'Hair slicked back off the forehead', 'Long, flat hair parted in the centre']
  };

  var S = [
    /* ---------------- straight / wavy — short ---------------- */
    { id: 'textured-crop', name: 'Textured crop (French crop)', textures: ['straight', 'wavy'], length: 'short',
      does: 'brings hair forward into a short fringe with texture on top',
      fit: { flexible: 2, height: 0, width: 2, soften: 1, weightLow: 1, fillEnds: 2 },
      ask: 'Skin or #1 fade on the sides into a #2–3, about 1–1.5 in (3–4 cm) on top, point-cut for texture, with a short fringe that stops mid-forehead.',
      steps: ['Towel-dry until damp — not soaking.', 'Rub a pea-sized amount of matte clay between your palms and work it in from the back forward.', 'Push the fringe forward and break it up with your fingertips so it looks piecey, not flat.'],
      products: 'Matte clay or paste', upkeep: 'Trim every 3–4 weeks' },
    { id: 'quiff', name: 'Textured quiff', textures: ['straight', 'wavy'], length: 'short',
      does: 'keeps the sides short and lifts the front up and back',
      fit: { flexible: 2, height: 2, width: 0, soften: 1, weightLow: 0, fillEnds: 0 },
      ask: 'Tapered sides, #2 into #3, and 3–4 in (7–10 cm) on top, longest at the front. Texturise the top so it holds shape without looking stiff.',
      steps: ['Spray a sea-salt spray or pre-styler into damp hair.', 'Blow-dry the front up and back using your fingers or a round brush.', 'Finish with a small amount of matte paste, pushing the front up and slightly to one side.'],
      products: 'Sea-salt spray or pre-styler, matte paste', upkeep: 'Trim every 3–4 weeks' },
    { id: 'side-part', name: 'Classic side part with a soft taper', textures: ['straight', 'wavy'], length: 'short',
      does: 'keeps some fullness at the sides with a clean, low-height top',
      fit: { flexible: 2, height: 1, width: 2, soften: 1, weightLow: 2, fillEnds: 1 },
      ask: 'Scissor-over-comb taper on the sides (or #3–4 if clippers), 2–3 in (5–7 cm) on top, a natural side part — no shaved line.',
      steps: ['Work a little light cream or pomade through damp hair.', 'Comb the part on the side where your hair naturally falls.', 'Brush the top across and slightly back; let the sides sit naturally.'],
      products: 'Light styling cream or low-shine pomade', upkeep: 'Trim every 4–5 weeks' },
    { id: 'crew-cut', name: 'Crew cut', textures: ['straight', 'wavy', 'curly', 'coily'], length: 'short',
      does: 'is short and even, so your natural face shape shows cleanly',
      fit: { flexible: 2, height: 1, width: 0, soften: 0, weightLow: 0, fillEnds: 0 },
      ask: '#2 on the sides tapering to #1 at the neck, and a #4 or scissor-cut 1 in (2.5 cm) on top, slightly longer at the front.',
      steps: ['Needs almost nothing — wash and towel-dry.', 'Optional: a tiny dab of matte paste to push the front up a little.'],
      products: 'None needed; matte paste optional', upkeep: 'Trim every 2–3 weeks to keep it sharp' },
    { id: 'caesar', name: 'Caesar cut', textures: ['straight', 'wavy', 'coily'], length: 'short',
      does: 'lays a short, straight fringe forward with even length all round',
      fit: { flexible: 1, height: 0, width: 2, soften: 0, weightLow: 1, fillEnds: 2 },
      ask: 'Even #3–4 all over (or 1 in / 2.5 cm scissor-cut on top) with a short, straight fringe brushed forward and a low taper at the neck.',
      steps: ['Brush everything forward from the crown while damp.', 'For coily hair, brush daily with a soft brush to keep the pattern even.', 'A light cream or pomade keeps it neat.'],
      products: 'Light cream or pomade, soft brush', upkeep: 'Trim every 2–3 weeks' },

    /* ---------------- straight / wavy — medium ---------------- */
    { id: 'curtains', name: 'Curtain fringe (middle-parted, medium length)', textures: ['straight', 'wavy'], length: 'medium',
      does: 'frames the face with a centre-parted fringe that sweeps to both sides',
      fit: { flexible: 2, height: 0, width: 2, soften: 2, weightLow: 2, fillEnds: 2 },
      ask: 'Keep 4–6 in (10–15 cm) through the top. Cut a centre-parted fringe that hits around the cheekbones, with light layers so it falls to each side. Sides and back scissor-cut to around the ears or collar.',
      steps: ['Part in the centre while wet and blow-dry the fringe back and out to each side.', 'Add a light sea-salt spray or texturising spray for grip.', 'Tuck behind the ears or let it fall; don’t flatten it with heavy product.'],
      products: 'Texturising or sea-salt spray, light cream', upkeep: 'Trim the fringe every 4–6 weeks, full cut every 8–10' },
    { id: 'layered-shag', name: 'Layered shag', textures: ['straight', 'wavy', 'curly'], length: 'medium',
      does: 'uses lots of layers for movement and softness around the face',
      fit: { flexible: 2, height: 1, width: 2, soften: 2, weightLow: 1, fillEnds: 2 },
      ask: 'Shoulder or collar length with lots of choppy layers, shorter layers around the face starting at cheekbone level, and a wispy or curtain fringe. Ask them to cut into the texture (point-cutting or razor), not blunt lines.',
      steps: ['Apply a light mousse or texturising spray to damp hair.', 'Rough-dry with your fingers (or a diffuser for waves and curls), lifting at the roots.', 'Twist a few front pieces away from your face and leave the rest undone.'],
      products: 'Light mousse or texturising spray', upkeep: 'Trim every 6–8 weeks' },
    { id: 'lob', name: 'Long bob (lob) past the chin', textures: ['straight', 'wavy'], length: 'medium',
      does: 'ends below the chin, drawing the eye down and lengthening the face',
      fit: { flexible: 2, height: 2, width: 1, soften: 2, weightLow: 2, fillEnds: 1 },
      ask: 'A lob ending at the collarbone — 1–2 in (3–5 cm) below the chin — with soft, invisible layers at the ends. Side part, and no blunt line exactly at the jaw.',
      steps: ['Blow-dry with a round brush, turning the ends slightly under or out.', 'For waves: scrunch in mousse and diffuse instead.', 'A side part adds a little height and angle.'],
      products: 'Heat protectant, light mousse or smoothing cream', upkeep: 'Trim every 6–8 weeks' },
    { id: 'chin-bob', name: 'Chin-length bob with a side fringe', textures: ['straight', 'wavy'], length: 'medium',
      does: 'adds width and weight around the jaw and cheeks',
      fit: { flexible: 1, height: 0, width: 2, soften: 0, weightLow: 2, fillEnds: 2 },
      ask: 'A bob with the ends landing at chin level (about 1 in / 2.5 cm below the earlobe), soft rounded ends rather than a hard geometric line, plus a side-swept fringe that reaches the cheekbone.',
      steps: ['Blow-dry smooth with a round brush, turning the ends under.', 'Sweep the fringe to one side while drying.', 'Finish with a drop of serum on the ends.'],
      products: 'Heat protectant, smoothing serum', upkeep: 'Trim every 5–6 weeks' },
    { id: 'flow', name: 'Swept-back flow', textures: ['straight', 'wavy'], length: 'medium',
      does: 'lets medium-length hair sweep back and fall behind the ears',
      fit: { flexible: 2, height: 1, width: 0, soften: 1, weightLow: 0, fillEnds: 0 },
      ask: 'Grow the top to 5–6 in (12–15 cm) and the sides to cover the ears; ask for light layers so it tucks behind the ears and the back sits just above the collar.',
      steps: ['Apply a light cream to damp hair.', 'Push everything back with your fingers and blow-dry back.', 'Let the sides tuck behind your ears.'],
      products: 'Light styling cream or sea-salt spray', upkeep: 'Clean up the neck every 6 weeks' },

    /* ---------------- straight / wavy — long ---------------- */
    { id: 'long-layers', name: 'Long layers with face-framing pieces', textures: ['straight', 'wavy'], length: 'long',
      does: 'keeps length while face-framing layers start below the cheekbones',
      fit: { flexible: 2, height: 2, width: 1, soften: 2, weightLow: 1, fillEnds: 1 },
      ask: 'Keep the length, add long layers, and start the face-framing pieces at or below the chin. Take a little weight out of the ends so it moves.',
      steps: ['Rough-dry to 80%, then use a round brush on the front pieces, directing them away from your face.', 'For waves: scrunch in a light gel and diffuse or air-dry.', 'A side part adds lift at the crown.'],
      products: 'Heat protectant, light mousse or wave gel', upkeep: 'Trim every 8–12 weeks' },
    { id: 'long-curtain', name: 'Long hair with curtain bangs', textures: ['straight', 'wavy'], length: 'long',
      does: 'adds a curtain fringe that shortens the forehead and widens the eye line',
      fit: { flexible: 2, height: 0, width: 2, soften: 2, weightLow: 2, fillEnds: 2 },
      ask: 'Keep the length with light layers, plus curtain bangs that start at the brows and blend into the layers around the cheekbones.',
      steps: ['Blow-dry the bangs first while wet — part in the centre and brush each side out and away.', 'Use a round brush or big Velcro roller on the bangs for bend.', 'Leave the lengths natural or loosely waved.'],
      products: 'Heat protectant, dry shampoo for the fringe', upkeep: 'Bangs every 4–6 weeks, full cut every 10–12' },
    { id: 'long-waves', name: 'Long, loose waves', textures: ['wavy', 'straight'], length: 'long',
      does: 'puts soft volume at the sides from the cheekbones down',
      fit: { flexible: 2, height: 0, width: 2, soften: 2, weightLow: 2, fillEnds: 2 },
      ask: 'Keep at least 2 in (5 cm) past the shoulders, with long layers cut to support a wave and the shortest layer at the jaw. Ask them not to thin out the ends heavily.',
      steps: ['Wavy: scrunch mousse or gel into soaking-wet hair, then diffuse or air-dry without touching.', 'Straight: add loose waves with a 32 mm (1.25 in) curling iron, alternating directions, then brush through with fingers.', 'Scrunch out any crunch once dry.'],
      products: 'Mousse or wave gel (or heat protectant + curling iron)', upkeep: 'Trim every 8–12 weeks' },

    /* ---------------- curly ---------------- */
    { id: 'curly-taper', name: 'Curly top with a taper fade', textures: ['curly', 'wavy'], length: 'short',
      does: 'keeps the sides tight and stacks curls on top for height',
      fit: { flexible: 2, height: 2, width: 0, soften: 1, weightLow: 0, fillEnds: 0 },
      ask: 'Low or mid taper fade, #1 into #3 on the sides, with 2–4 in (5–10 cm) of curls left on top. Ask them to cut the top dry, curl by curl, so it sits evenly.',
      steps: ['Apply a curl cream or light gel to soaking-wet hair.', 'Scrunch the top upward and don’t touch it while it dries (air or diffuser).', 'Once fully dry, fluff at the roots with your fingers for extra height.'],
      products: 'Curl cream or light gel', upkeep: 'Fade every 2–3 weeks, top every 6 weeks' },
    { id: 'curly-crop', name: 'Curly crop with a fringe', textures: ['curly', 'wavy'], length: 'short',
      does: 'brings curls forward over the forehead with even width',
      fit: { flexible: 2, height: 0, width: 2, soften: 1, weightLow: 1, fillEnds: 2 },
      ask: 'Short sides (#2–3 or scissor-cut), 2–3 in (5–7 cm) of curls on top falling forward into a curly fringe. Cut dry so the curls sit where they’ll land.',
      steps: ['Scrunch curl cream into wet hair and push the curls forward.', 'Air-dry or diffuse on low without touching.', 'Separate a few curls at the front with your fingertips once dry.'],
      products: 'Curl cream, light-hold gel', upkeep: 'Trim every 4–5 weeks' },
    { id: 'rounded-curls', name: 'Rounded curly cut (cut dry, curl by curl)', textures: ['curly'], length: 'medium',
      does: 'shapes curls into a rounded outline that’s fuller at the sides',
      fit: { flexible: 2, height: 1, width: 2, soften: 2, weightLow: 1, fillEnds: 2 },
      ask: 'A dry, curl-by-curl cut (often called a DevaCut or Rezo-style cut) into a rounded shape around chin-to-shoulder length. Look for a stylist who specialises in curly hair.',
      steps: ['Wash with a sulfate-free shampoo, condition, and detangle with fingers while conditioner is in.', 'On soaking-wet hair: leave-in, then curl cream or gel, scrunched upward.', 'Diffuse on low or air-dry, then scrunch out the crunch (sometimes called the "cast").'],
      products: 'Leave-in conditioner, curl cream, gel', upkeep: 'Reshape every 8–12 weeks' },
    { id: 'curly-shag', name: 'Curly shag with a curtain fringe', textures: ['curly', 'wavy'], length: 'medium',
      does: 'puts volume at the cheeks and jaw with a fringe that softens the forehead',
      fit: { flexible: 2, height: 0, width: 2, soften: 2, weightLow: 2, fillEnds: 2 },
      ask: 'A curly shag cut dry: 3–4 in (7–10 cm) layers at the crown, the longest pieces at the shoulders, and a curly curtain fringe that sits at the cheekbones.',
      steps: ['Style soaking wet: leave-in, then mousse or gel, scrunched up.', 'Clip the roots at the crown if you want lift, and diffuse.', 'Pull the fringe curls apart gently once dry.'],
      products: 'Leave-in, curl mousse or gel, root clips', upkeep: 'Trim every 8–10 weeks' },
    { id: 'long-curls', name: 'Long layered curls', textures: ['curly'], length: 'long',
      does: 'keeps length while layers stop curls from going triangle-shaped',
      fit: { flexible: 2, height: 2, width: 1, soften: 2, weightLow: 1, fillEnds: 1 },
      ask: 'Long curly layers cut dry: keep the length, make the shortest layer land at the chin, and add a few 4–5 in (10–12 cm) layers at the crown for lift, so it doesn’t go flat on top and wide at the bottom.',
      steps: ['Detangle only in the shower with conditioner in.', 'Rake leave-in and gel through soaking-wet hair and scrunch.', 'For more height, flip your head upside down while diffusing, or wear a high "pineapple" (loose high ponytail) overnight.'],
      products: 'Leave-in, curl cream, strong-hold gel, satin scrunchie', upkeep: 'Trim every 10–12 weeks' },

    /* ---------------- coily ---------------- */
    { id: 'fade-sponge', name: 'Fade with twists or sponge curls on top', textures: ['coily'], length: 'short',
      does: 'keeps the sides low and gives the top defined texture and height',
      fit: { flexible: 2, height: 2, width: 0, soften: 1, weightLow: 0, fillEnds: 0 },
      ask: 'Low or mid fade, bald or #0.5 into #2, with 1.5–2.5 in (4–6 cm) on top and a soft line-up that follows your natural hairline (not pushed back).',
      steps: ['Spray the top with water or a leave-in so it’s damp.', 'Rub a twist sponge in small circles to form coils.', 'Finish with a light oil or twisting cream for shine.'],
      products: 'Leave-in spray, twisting cream, twist sponge', upkeep: 'Fade every 2 weeks' },
    { id: 'high-top', name: 'Tapered afro (taller on top)', textures: ['coily'], length: 'short',
      does: 'is shaped taller than it is wide, adding length to the face',
      fit: { flexible: 2, height: 2, width: 0, soften: 1, weightLow: 0, fillEnds: 0 },
      ask: 'Taper on the sides and back (#1–2), with the top left 2–4 in (5–10 cm) and shaped taller than it is wide.',
      steps: ['Moisturise with leave-in and a cream.', 'Pick the top up and out from the roots with an afro pick.', 'Pat to shape with your palms.'],
      products: 'Leave-in, moisturising cream, afro pick', upkeep: 'Shape every 3–4 weeks' },
    { id: 'waves-caesar', name: 'Low Caesar with 360 waves', textures: ['coily'], length: 'short',
      does: 'keeps an even, low shape with no extra height',
      fit: { flexible: 2, height: 0, width: 1, soften: 0, weightLow: 1, fillEnds: 1 },
      ask: 'Even #1–2 all over with a low taper at the neck and a natural line-up. Tell them you’re training waves so they cut with the grain.',
      steps: ['Brush in your wave pattern with a medium brush daily, starting at the crown.', 'Use a little pomade or wave cream.', 'Sleep in a durag to lay the pattern down.'],
      products: 'Wave pomade or cream, 360 brush, durag', upkeep: 'Cut every 2–3 weeks' },
    { id: 'rounded-afro', name: 'Rounded afro or twist-out', textures: ['coily'], length: 'medium',
      does: 'is shaped rounder and wider rather than tall',
      fit: { flexible: 2, height: 0, width: 2, soften: 2, weightLow: 2, fillEnds: 2 },
      ask: 'A rounded shape-up of the afro, even all the way round, trimming split ends. Mention you want it wider than tall.',
      steps: ['On damp hair: leave-in, oil, then cream (the "LOC" order) to seal in moisture.', 'For a twist-out: two-strand twist in sections, let it dry fully, then unravel and separate.', 'Pick at the roots, not the ends, for fullness without frizz.'],
      products: 'Leave-in, oil, twisting cream, pick', upkeep: 'Shape every 8–12 weeks' },
    { id: 'twists', name: 'Two-strand twists', textures: ['coily', 'curly'], length: 'medium',
      does: 'gives defined, low-maintenance texture that frames the face',
      fit: { flexible: 2, height: 1, width: 1, soften: 2, weightLow: 1, fillEnds: 1 },
      ask: 'Two-strand twists on your natural hair, medium-sized parts. If you go to a braider, ask for no tension at the edges.',
      steps: ['Twist on clean, damp, moisturised hair with a twisting cream.', 'Refresh with a water/leave-in spray every few days.', 'Sleep with a satin bonnet or durag to keep them neat.'],
      products: 'Twisting cream, leave-in spray, satin bonnet', upkeep: 'Redo every 1–3 weeks' },
    { id: 'locs', name: 'Locs', textures: ['coily', 'curly'], length: 'long',
      does: 'is a long-term, low-manipulation style you can wear up, down or to the side',
      fit: { flexible: 2, height: 1, width: 1, soften: 2, weightLow: 1, fillEnds: 1 },
      ask: 'Starter locs (comb coils or two-strand twists) with evenly sized parts. Ask your loctician how often to retwist — usually every 4–8 weeks.',
      steps: ['Wash every 1–2 weeks with a residue-free shampoo and dry fully so they don’t smell musty.', 'Moisturise with a light spray, not heavy butters that build up.', 'Wear up in a high bun for height, or down and to the sides for width.'],
      products: 'Residue-free shampoo, light moisturising spray', upkeep: 'Retwist every 4–8 weeks' },
    { id: 'braids', name: 'Knotless box braids', textures: ['coily', 'curly'], length: 'long',
      does: 'is a protective style that can be worn up for height or down for width',
      fit: { flexible: 2, height: 1, width: 2, soften: 2, weightLow: 2, fillEnds: 1 },
      ask: 'Knotless box braids, medium size, at a length that suits you. Ask for no tension at the hairline and edges.',
      steps: ['Keep the scalp clean with a diluted shampoo or scalp spray.', 'Oil the scalp lightly and sleep in a satin bonnet.', 'Take them out after 6–8 weeks to protect your edges.'],
      products: 'Scalp spray, light oil, satin bonnet', upkeep: 'Keep in 6–8 weeks max' },
    { id: 'short-twa', name: 'Short natural afro (TWA)', textures: ['coily'], length: 'short',
      does: 'is short and even all round, showing your natural shape',
      fit: { flexible: 2, height: 1, width: 1, soften: 1, weightLow: 1, fillEnds: 1 },
      ask: 'An even, rounded cut about 1–2 in (2.5–5 cm) all over, shaped slightly fuller where you want balance.',
      steps: ['Wash, then apply leave-in and a curl cream to wet hair.', 'Shake or finger-coil for definition.', 'Let it dry and fluff gently with a pick.'],
      products: 'Leave-in, curl cream or custard', upkeep: 'Shape every 4–6 weeks' },
    { id: 'coily-high-puff', name: 'High puff or top bun', textures: ['coily', 'curly'], length: 'long',
      does: 'gathers volume on top of the head for extra height',
      fit: { flexible: 2, height: 2, width: 0, soften: 1, weightLow: 0, fillEnds: 0 },
      ask: 'This is a style, not a cut — ask for a trim to remove split ends and keep your length even.',
      steps: ['Moisturise, then gather hair loosely at the crown with a satin scrunchie or stretchy band (never tight).', 'Smooth the edges gently with a soft brush and a little edge gel.', 'Fluff the puff with a pick.'],
      products: 'Moisturising cream, satin scrunchie, soft brush', upkeep: 'Trim every 10–12 weeks' }
  ];

  var LENGTHS = ['short', 'medium', 'long'];
  var ADJACENT = { short: ['medium'], medium: ['short', 'long'], long: ['medium'] };

  /* Pick the best styles for a texture + goals + length preference.
     goals: { primary, secondary? } ; lengthPref: short|medium|long|open.
     Returns up to n styles, best first, each with a `why` sentence. */
  function pick(texture, goals, lengthPref, n, opts) {
    n = n || 3; opts = opts || {};
    var pool = S.filter(function (s) { return s.textures.indexOf(texture) >= 0; });
    function score(s) {
      var v = 2 * (s.fit[goals.primary] || 0);
      if (goals.secondary) v += (s.fit[goals.secondary] || 0);
      if (opts.preferShort && s.length === 'short') v += 1.5;
      return v;
    }
    function ranked(list) {
      return list.filter(function (s) { return (s.fit[goals.primary] || 0) > 0; })
        .sort(function (a, b) { return score(b) - score(a) || S.indexOf(a) - S.indexOf(b); });
    }
    var out;
    if (lengthPref && lengthPref !== 'open') {
      out = ranked(pool.filter(function (s) { return s.length === lengthPref; }));
      if (out.length < 2) {                       // widen to neighbouring lengths
        var more = ranked(pool.filter(function (s) { return ADJACENT[lengthPref].indexOf(s.length) >= 0; }));
        out = out.concat(more);
      }
    } else {
      // "open": best of each length first, so the options differ
      out = [];
      LENGTHS.forEach(function (l) {
        var best = ranked(pool.filter(function (s) { return s.length === l; }))[0];
        if (best) out.push(best);
      });
      out.sort(function (a, b) { return score(b) - score(a); });
    }
    return out.slice(0, n).map(function (s) {
      return Object.assign({}, s, { why: 'It ' + s.does + ', which ' + GOAL_BENEFIT[goals.primary] + '.' });
    });
  }

  var api = { STYLES: S, GOAL_BENEFIT: GOAL_BENEFIT, AVOID: AVOID, LENGTHS: LENGTHS, pick: pick };
  root.ContourHairstyles = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

})(typeof window !== 'undefined' ? window : this);
