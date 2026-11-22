// Pure helpers for the scroll story. Progress `p` runs 0..1 across the whole pinned section.

export const SCENES = 5;
export const SCENE_NAMES = ['Begin', 'Discover', 'Learn', 'Build', 'Achieve'];

export const clamp01 = (v) => Math.min(1, Math.max(0, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => { const x = clamp01(t); return x * x * (3 - 2 * x); };
export const easeInOut = (t) => { const x = clamp01(t); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };

// 0..1 across [a, b], smoothed.
export const span = (p, a, b) => smooth((p - a) / (b - a));

// Which scene (0-4) a progress value falls in.
export const sceneAt = (p) => Math.min(SCENES - 1, Math.floor(clamp01(p) * SCENES));

// How visible a scene's copy is: fades in after its window opens and out before it closes, leaving a short
// empty beat at each boundary while the background and cards transform. The first scene starts fully visible,
// the last stays visible to the end.
export function copyVisibility(p, i) {
  const a = i / SCENES;
  const b = (i + 1) / SCENES;
  const fade = 0.035;
  const inn = i === 0 ? 1 : smooth((p - (a + 0.008)) / fade);
  const out = i === SCENES - 1 ? 1 : smooth((b - 0.008 - p) / fade);
  return Math.min(inn, out);
}

// Vertical drift of a scene's copy while it enters (from below) and leaves (upward), in px.
export function copyShift(p, i, vis) {
  const mid = (i + 0.5) / SCENES;
  return (p < mid ? 1 : -1) * (1 - vis) * 56;
}

// Piecewise interpolation through [[p, ...values]] keyframes, eased between each pair.
export function sample(frames, p) {
  if (p <= frames[0][0]) return frames[0].slice(1);
  for (let i = 1; i < frames.length; i += 1) {
    if (p <= frames[i][0]) {
      const [p0, ...v0] = frames[i - 1];
      const [p1, ...v1] = frames[i];
      const t = easeInOut((p - p0) / (p1 - p0));
      return v0.map((v, k) => lerp(v, v1[k], t));
    }
  }
  return frames[frames.length - 1].slice(1);
}

// ── Background and ink colours (the stage turns from forest to cream for the learning scene and back) ──
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const FOREST = hex('#102E26');
const FOREST_MID = hex('#16382D');
const CREAM = hex('#F5F0E6');
const DEEP = hex('#0B211B');
// [p, background rgb, ink rgb]
const COLOR_STOPS = [
  [0, FOREST, CREAM],
  [0.3, FOREST_MID, CREAM],
  [0.37, FOREST_MID, CREAM],
  [0.43, CREAM, FOREST],
  [0.57, CREAM, FOREST],
  [0.63, FOREST, CREAM],
  [0.8, FOREST, CREAM],
  [1, DEEP, CREAM],
];

export function colorsAt(p) {
  let i = 1;
  while (i < COLOR_STOPS.length - 1 && p > COLOR_STOPS[i][0]) i += 1;
  const [p0, bg0, ink0] = COLOR_STOPS[i - 1];
  const [p1, bg1, ink1] = COLOR_STOPS[i];
  const t = smooth((p - p0) / (p1 - p0));
  const mix = (a, b) => `rgb(${a.map((v, k) => Math.round(lerp(v, b[k], t))).join(',')})`;
  return { bg: mix(bg0, bg1), ink: mix(ink0, ink1) };
}

// ── The shared card deck. Three cards travel through every scene. [p, x%, y%, rotate°, scale, opacity] ──
export const DECK_DESKTOP = [
  [
    [0, 62, 20, -6, 0.95, 1],
    [0.2, 62, 24, -5, 1, 1],
    [0.4, 66, 30, -3, 1, 1],
    [0.6, 62, 70, -3, 0.95, 1],
    [0.8, 60, 70, -3, 0.9, 1],
    [0.87, 50, 50, 0, 0.6, 0],
  ],
  [
    [0, 84, 38, 6, 0.9, 1],
    [0.2, 84, 44, 5, 0.95, 1],
    [0.4, 74, 50, 2, 1, 1],
    [0.6, 75, 48, 0, 0.95, 1],
    [0.8, 74, 48, 0, 0.9, 1],
    [0.87, 50, 50, 0, 0.6, 0],
  ],
  [
    [0, 90, 73, 3, 0.85, 1],
    [0.2, 88, 72, 4, 0.9, 1],
    [0.4, 82, 72, 6, 1, 1],
    [0.6, 88, 26, 3, 0.95, 1],
    [0.8, 88, 26, 3, 0.9, 1],
    [0.87, 50, 50, 0, 0.6, 0],
  ],
];

// Phone layout: the copy owns the top of the screen, so the cards live in the lower half. Each scene has its own
// formation (a pair and a single card, a falling staircase, a rising staircase) and none of them overlap.
export const DECK_MOBILE = [
  [
    [0, 27, 53, -6, 0.7, 1],
    [0.3, 27, 60, -4, 0.7, 1],
    [0.5, 24, 56, -2, 0.7, 1],
    [0.7, 24, 78, -3, 0.68, 1],
    [0.87, 50, 62, 0, 0.4, 0],
  ],
  [
    [0, 73, 56, 6, 0.7, 1],
    [0.3, 73, 64, 4, 0.7, 1],
    [0.5, 50, 68, 1, 0.7, 1],
    [0.7, 50, 66, 0, 0.68, 1],
    [0.87, 50, 62, 0, 0.4, 0],
  ],
  [
    [0, 50, 65, 2, 0.7, 1],
    [0.3, 50, 80, 2, 0.7, 1],
    [0.5, 76, 80, 2, 0.7, 1],
    [0.7, 76, 54, 3, 0.68, 1],
    [0.87, 50, 62, 0, 0.4, 0],
  ],
];

// The sun/glow behind everything. [p, x%, y%, scale, opacity]
export const GLOW = [
  [0, 70, 52, 1, 0.6],
  [0.2, 74, 40, 1, 0.38],
  [0.4, 70, 50, 0.8, 0.0],
  [0.6, 70, 50, 0.9, 0.26],
  [0.8, 50, 98, 1.1, 0.55],
  [1, 50, 78, 1.5, 0.95],
];

// How a card face shows through: trapezoid over [a, a+f] .. [b-f, b].
export const faceVisibility = (p, a, b, f = 0.05) => Math.min(smooth((p - a) / f), smooth((b - p) / f));
