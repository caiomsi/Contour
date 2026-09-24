/* =================================================================
   CONTOUR — content.js
   The "quick wins" content pack (data only — no logic). Every item is a
   short, practical checklist: one line on what it does, then concrete
   steps a person can actually do this week. Lifestyle and grooming
   only — no medical or surgical claims, no "bone restructuring"
   pseudoscience. Supportive, body-neutral tone: habits that help how
   you look and feel, not fixes for "flaws".

   Item = { id, category, title, body (one sentence), steps: [..] }
   ================================================================= */

(function (root) {
  'use strict';

  var CATEGORIES = {
    skin: 'Skin',
    eyes: 'Eyes & brows',
    grooming: 'Grooming',
    habits: 'Habits',
    photo: 'Photos',
    basics: 'Everyday basics',
    hair: 'Hair'
  };

  var CONTENT = {
    'under-eye': {
      id: 'under-eye', category: 'eyes',
      title: 'Brighten tired-looking under-eyes',
      body: 'Under-eye shadows mostly respond to sleep, fluid balance and sun — small changes show within 1–2 weeks.',
      steps: [
        'Keep a regular 7–9 hour sleep window; if you wake up puffy, add a second pillow to raise your head slightly.',
        'In the morning, hold something cold on the area for 2–5 minutes (a cold compress or chilled spoons).',
        'Go easy on salty food and alcohol in the evening, and drink water steadily through the day.',
        'Wear SPF and sunglasses outdoors — sun darkens the thin skin under the eyes.',
        'Don’t rub your eyes. If they itch often, a pharmacist can suggest allergy options.',
        'If you wear makeup: a peach or orange colour corrector under concealer cancels blue-grey shadows.'
      ]
    },
    'redness': {
      id: 'redness', category: 'skin',
      title: 'Calm visible redness',
      body: 'Redness is often reactive — a simpler routine and fewer triggers calm it more than new products do.',
      steps: [
        'For 2–4 weeks, use only a fragrance-free gentle cleanser and a plain moisturiser.',
        'Wash with lukewarm (not hot) water, pat dry, and skip scrubs and harsh toners.',
        'Wear a mineral sunscreen (zinc oxide) every morning — sun both causes and worsens redness.',
        'Notice your flush triggers (hot drinks, spicy food, alcohol, heat, exercise) and cut back on the worst ones.',
        'If redness stays for weeks or comes with bumps, a dermatologist can check whether it’s rosacea.'
      ]
    },
    'sym-habits': {
      id: 'sym-habits', category: 'habits',
      title: 'Even out one-sided habits',
      body: 'Everyone is asymmetric; these habits just avoid nudging it further and change how balanced you look day to day.',
      steps: [
        'Alternate the side you sleep on, or sleep on your back.',
        'Chew on both sides of your mouth.',
        'Raise your screen to eye level and check you’re not habitually tilting your head.',
        'Carry bags on alternating shoulders.'
      ]
    },
    'photos': {
      id: 'photos', category: 'photo',
      title: 'Take more flattering photos',
      body: 'Lens distance, angle and light change how a face looks in photos more than most people expect.',
      steps: [
        'Stand 1.5–2 m (5–6 ft) away and zoom in 2×, or use the rear camera — close selfies enlarge the nose and forehead.',
        'Hold the camera at eye level or slightly above.',
        'Face a window; avoid overhead lights, which cast shadows under the eyes.',
        'Push your forehead slightly forward and your chin a little down — it defines the jawline.',
        'Take a burst and try both sides; most people have a side they prefer.'
      ]
    },
    'lower-face': {
      id: 'lower-face', category: 'habits',
      title: 'Support a more defined jawline',
      body: 'Soft-tissue fullness follows overall health and fluid balance. Jaw exercises and “mewing” don’t reshape bone.',
      steps: [
        'Keep evening salt and alcohol low — puffiness shows in the face first.',
        'Aim for regular movement and 7–9 hours of sleep; overall body composition is what changes facial fullness.',
        'Stand and sit tall with your head level; slouching softens the jaw line.',
        'If you grow facial hair, a short, well-shaped beard or stubble outlines the jaw.'
      ]
    },
    'brows': {
      id: 'brows', category: 'eyes',
      title: 'Groom your brows to frame your eyes',
      body: 'Neat brows are the quickest way to make eyes look more open and balanced — no reshaping needed.',
      steps: [
        'Brush your brows upward with clear brow gel (or a spoolie and a little soap) for an instantly tidier shape.',
        'After brushing up, trim only the hairs that stick out above the top line, using small scissors.',
        'Tweeze stray hairs below the brow and between the brows. The brow should start roughly above the inner corner of your eye.',
        'Leave the tails full — over-thinned brows make the face look tired.'
      ]
    },
    'basics': {
      id: 'basics', category: 'basics',
      title: 'The everyday basics',
      body: 'Not glamorous, but these do more for how your face looks than anything else here.',
      steps: [
        'Sleep 7–9 hours at roughly the same times.',
        'Drink water through the day, and eat plenty of whole foods.',
        'Keep alcohol moderate, and don’t smoke — both age skin visibly.',
        'Move every day; sit and stand tall with your screen at eye level.'
      ]
    }
  };

  var api = { CATEGORIES: CATEGORIES, CONTENT: CONTENT };
  root.ContourContent = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

})(typeof window !== 'undefined' ? window : this);
