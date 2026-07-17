/* =================================================================
   CONTOUR — content.js
   The recommendation content pack (data only — no logic). Every item
   is lifestyle-only and evidence-informed. Deliberately avoids medical
   or surgical claims and any "bone restructuring" pseudoscience. Tone
   is supportive and body-neutral: these are habits that help how you
   look and feel, not fixes for "flaws".
   ================================================================= */

(function (root) {
  'use strict';

  var CATEGORIES = {
    sleep: 'Sleep & Recovery',
    skin: 'Skin & Sun',
    nutrition: 'Hydration & Nutrition',
    habits: 'Habits & Posture',
    grooming: 'Grooming & Styling'
  };

  // Each: { id, category, title, body, why }
  var CONTENT = {
    'underEye-sleep': {
      id: 'underEye-sleep', category: 'sleep',
      title: 'Protect a consistent 7–9h sleep window',
      body: 'Aim for the same sleep and wake times most days, and 7–9 hours in bed. Under-eye shadowing commonly tracks with sleep debt and irregular schedules.',
      why: 'Regular, sufficient sleep is one of the most reliable ways to reduce under-eye darkness and puffiness over a few weeks.'
    },
    'underEye-hydration': {
      id: 'underEye-hydration', category: 'nutrition',
      title: 'Ease evening salt and alcohol',
      body: 'Keep water intake steady through the day and go lighter on salty food and alcohol in the evening. Both pull fluid around the eyes and can deepen shadows the next morning.',
      why: 'Fluid balance strongly affects the under-eye area; small evening changes often show up quickly.'
    },
    'underEye-allergy': {
      id: 'underEye-allergy', category: 'habits',
      title: 'Rule out everyday irritants',
      body: 'If your eyes often feel itchy or you rub them, consider common triggers like dust, pollen, or a pet, and try not to rub. Persistent allergic shadowing is worth a chat with a pharmacist or GP.',
      why: 'Rubbing and low-grade allergy are frequent, fixable contributors to darker under-eyes.'
    },
    'redness-skincare': {
      id: 'redness-skincare', category: 'skin',
      title: 'Simplify to a gentle routine',
      body: 'Use a non-stripping, fragrance-free cleanser and a plain moisturizer twice a day. Introduce any active (like an acid or retinoid) slowly and patch-test first.',
      why: 'A minimal, gentle routine calms visible redness far more often than adding more products.'
    },
    'redness-spf': {
      id: 'redness-spf', category: 'skin',
      title: 'Wear broad-spectrum SPF daily',
      body: 'Apply a broad-spectrum SPF 30+ every morning, even indoors near windows. UV both drives and worsens facial redness and long-term uneven tone.',
      why: 'Daily sun protection is the single highest-impact skin habit for tone, redness, and aging.'
    },
    'redness-triggers': {
      id: 'redness-triggers', category: 'nutrition',
      title: 'Notice your flush triggers',
      body: 'Heat, spicy food, alcohol, and sudden temperature changes are common flush triggers. Track which ones affect you and moderate the strongest offenders.',
      why: 'Redness is often reactive; identifying personal triggers reduces how often your skin flushes.'
    },
    'asymmetry-sleep': {
      id: 'asymmetry-sleep', category: 'habits',
      title: 'Vary your sleep side and chewing side',
      body: 'If you always sleep on one side or chew mainly on one side, try to balance both. Everyone is asymmetric — this just avoids nudging it further over time.',
      why: 'Consistent one-sided pressure and muscle use can subtly reinforce left/right differences.'
    },
    'asymmetry-posture': {
      id: 'asymmetry-posture', category: 'habits',
      title: 'Level your posture and screens',
      body: 'Raise your screen to eye level and take posture breaks. A habitual head tilt or forward-head position changes how balanced your face looks day to day.',
      why: 'Neck and head posture visibly affect facial balance and are very responsive to small habit changes.'
    },
    'asymmetry-photo': {
      id: 'asymmetry-photo', category: 'habits',
      title: 'Blame the lens before the face',
      body: 'Much of what looks asymmetric in a photo is camera angle and lens distortion, not your face. Shoot at eye level, straight-on, arm’s length or further, in even light.',
      why: 'Angle and lens choice change apparent symmetry more than most people expect.'
    },
    'lowerface-body': {
      id: 'lowerface-body', category: 'habits',
      title: 'Support definition through overall health',
      body: 'If sharper lower-face definition is a personal goal, it follows overall body composition, hydration, and lower evening sodium — not jaw exercises or “mewing”, which do not reshape bone. Prioritize sleep, steady hydration, and regular movement.',
      why: 'Soft-tissue fullness responds to genuine lifestyle levers; nothing non-surgical restructures the jawbone.'
    },
    'brow-styling': {
      id: 'brow-styling', category: 'grooming',
      title: 'Let brow shape frame your eyes',
      body: 'A well-kept brow shape is the fastest way to adjust how your eyes read — spacing, tilt, and openness. A one-off professional shape you then maintain is a good starting point.',
      why: 'Brows frame the eyes and can visually balance eye spacing and tilt without changing anything permanent.'
    },
    // ---- baseline universals (always safe to show) ----
    'base-spf': {
      id: 'base-spf', category: 'skin',
      title: 'Daily SPF is the highest-impact habit',
      body: 'A broad-spectrum SPF 30+ every morning protects tone, texture, and long-term skin health more than any other single step.',
      why: 'Sun exposure is the largest controllable factor in how skin ages.'
    },
    'base-sleep': {
      id: 'base-sleep', category: 'sleep',
      title: 'Aim for 7–9 hours, regularly',
      body: 'Consistent, sufficient sleep improves under-eye appearance, skin recovery, and how rested your whole face looks.',
      why: 'Sleep is foundational to skin repair and facial freshness.'
    },
    'base-hydration': {
      id: 'base-hydration', category: 'nutrition',
      title: 'Keep hydration steady',
      body: 'Drink water consistently through the day and eat plenty of whole foods. Steady hydration supports skin plumpness and reduces puffiness.',
      why: 'Hydration and nutrition underpin skin quality and facial fullness.'
    },
    'base-alcohol': {
      id: 'base-alcohol', category: 'nutrition',
      title: 'Go easy on alcohol and don’t smoke',
      body: 'Both dehydrate skin, worsen under-eye shadows, and accelerate visible aging. Reducing them pays off in the mirror as well as in health.',
      why: 'Alcohol and smoking are among the clearest lifestyle drivers of tired, aged-looking skin.'
    },
    'base-posture': {
      id: 'base-posture', category: 'habits',
      title: 'Stand and sit tall',
      body: 'Good posture and a level head position improve how balanced and confident your face and jawline read — no equipment required.',
      why: 'Posture changes apparent jawline and facial balance immediately and for free.'
    }
  };

  var BASELINE_IDS = ['base-spf', 'base-sleep', 'base-hydration', 'base-alcohol', 'base-posture'];

  // Grooming/styling guidance per face shape (Grooming & Styling).
  var FACE_SHAPE_STYLING = {
    oval: 'Most cuts and frames suit an oval face. Keep some forehead visible and avoid hiding the face behind heavy fringe or oversized frames.',
    round: 'Add height and angle: volume on top with shorter sides, angular glasses, and a defined chin/beard line to lengthen and sharpen.',
    square: 'Soften the strong jaw: textured, slightly tousled styles, rounded or oval glasses, and a short rounded beard rather than a boxy one.',
    heart: 'Balance a wider forehead with a narrower chin: medium length with fullness lower down, lighter volume on top, and bottom-weighted or rounded frames.',
    diamond: 'Add apparent width at forehead and jaw: brow-skimming fringe or fuller top, a fuller beard, and frames with detail on top; avoid very tight sides.',
    oblong: 'Avoid adding height: keep it shorter on top with width at the sides, a fuller beard for balance, and wider frames to break up length.'
  };

  var api = {
    CATEGORIES: CATEGORIES, CONTENT: CONTENT,
    BASELINE_IDS: BASELINE_IDS, FACE_SHAPE_STYLING: FACE_SHAPE_STYLING
  };
  root.ContourContent = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

})(typeof window !== 'undefined' ? window : this);
