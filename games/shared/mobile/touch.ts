import type { ViewportLayout } from "./layout";

export const MIN_TOUCH_TARGET = 44;
export const PRIMARY_TOUCH_TARGET = 52;
export const EDGE_GUTTER = 12;

export type TouchTarget = {
  width: number;
  height: number;
};

export function resolveTouchTarget(
  width: number,
  height: number,
  layout: Pick<ViewportLayout, "uiScale">,
  primary = false,
): TouchTarget {
  const minimum = primary ? PRIMARY_TOUCH_TARGET : MIN_TOUCH_TARGET;
  const scale = Math.max(0.01, layout.uiScale);
  return {
    width: Math.max(width, minimum / scale),
    height: Math.max(height, minimum / scale),
  };
}

export function clampToSafeViewport(
  x: number,
  y: number,
  layout: ViewportLayout,
  gutter = EDGE_GUTTER,
): { x: number; y: number } {
  const minX = layout.safeLeft + gutter;
  const maxX = Math.max(minX, layout.width - layout.safeRight - gutter);
  const minY = layout.safeTop + gutter;
  const maxY = Math.max(minY, layout.height - layout.safeBottom - gutter);
  return {
    x: Math.min(maxX, Math.max(minX, x)),
    y: Math.min(maxY, Math.max(minY, y)),
  };
}

export function pressedScale(pressed: boolean): number {
  return pressed ? 0.96 : 1;
}
