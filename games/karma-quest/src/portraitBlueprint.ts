export type UiRect = Readonly<{ x: number; y: number; width: number; height: number }>;

export const PORTRAIT_CANVAS = { width: 450, height: 800 } as const;

export const PORTRAIT_BLUEPRINT = {
  title: {
    hud: { x: 15, y: 11, width: 420, height: 64 },
    rail: { x: 12, y: 104, width: 54, height: 354 },
    notice: { x: 29, y: 571, width: 274, height: 38 },
    request: { x: 18, y: 600, width: 414, height: 112 },
    navigation: { x: 8, y: 724, width: 434, height: 68 },
  },
  choice: {
    hud: { x: 15, y: 9, width: 420, height: 60 },
    request: { x: 138, y: 81, width: 304, height: 188 },
    playerPortrait: { x: 0, y: 328, width: 202, height: 229 },
    npcPortrait: { x: 170, y: 275, width: 270, height: 270 },
    accept: { x: 34, y: 558, width: 382, height: 80 },
    decline: { x: 34, y: 654, width: 382, height: 80 },
    tagline: { x: 34, y: 750, width: 382, height: 32 },
  },
  reaction: {
    heading: { x: 18, y: 13, width: 414, height: 72 },
    result: { x: 21, y: 442, width: 408, height: 348 },
    effects: { x: 62, y: 576, width: 326, height: 118 },
    next: { x: 61, y: 710, width: 328, height: 80 },
  },
  final: {
    parchment: { x: 14, y: 22, width: 422, height: 756 },
    heading: { x: 28, y: 26, width: 394, height: 80 },
    event: { x: 31, y: 118, width: 388, height: 182 },
    locked: { x: 31, y: 306, width: 388, height: 98 },
    city: { x: 34, y: 412, width: 382, height: 108 },
    growth: { x: 40, y: 535, width: 370, height: 114 },
    replay: { x: 45, y: 672, width: 360, height: 72 },
  },
} as const;

export function rectGap(a: UiRect, b: UiRect): { horizontal: number; vertical: number } {
  return {
    horizontal: Math.max(b.x - (a.x + a.width), a.x - (b.x + b.width)),
    vertical: Math.max(b.y - (a.y + a.height), a.y - (b.y + b.height)),
  };
}

export function overlaps(a: UiRect, b: UiRect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}
