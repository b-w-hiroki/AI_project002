export type LayoutMode =
  | "phone-portrait"
  | "phone-landscape"
  | "tablet-portrait"
  | "tablet-landscape";

export type SafeAreaInsets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type ViewportLayout = {
  mode: LayoutMode;
  width: number;
  height: number;
  contentWidth: number;
  contentHeight: number;
  safeTop: number;
  safeRight: number;
  safeBottom: number;
  safeLeft: number;
  uiScale: number;
  isPortrait: boolean;
  isTablet: boolean;
};

export type LayoutOptions = {
  baseWidth: number;
  baseHeight: number;
  minUiScale?: number;
  maxUiScale?: number;
  tabletThreshold?: number;
};

export type ViewportInput = {
  width: number;
  height: number;
  safeArea?: Partial<SafeAreaInsets>;
};

export const EMPTY_SAFE_AREA: SafeAreaInsets = {
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function finiteOrZero(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(0, value ?? 0) : 0;
}

export function resolveViewportLayout(input: ViewportInput, options: LayoutOptions): ViewportLayout {
  const width = Math.max(1, finiteOrZero(input.width));
  const height = Math.max(1, finiteOrZero(input.height));
  const safeArea: SafeAreaInsets = {
    top: finiteOrZero(input.safeArea?.top),
    right: finiteOrZero(input.safeArea?.right),
    bottom: finiteOrZero(input.safeArea?.bottom),
    left: finiteOrZero(input.safeArea?.left),
  };

  const contentWidth = Math.max(1, width - safeArea.left - safeArea.right);
  const contentHeight = Math.max(1, height - safeArea.top - safeArea.bottom);
  const isPortrait = height >= width;
  const tabletThreshold = options.tabletThreshold ?? 600;
  const isTablet = Math.min(width, height) >= tabletThreshold;
  const mode: LayoutMode = `${isTablet ? "tablet" : "phone"}-${isPortrait ? "portrait" : "landscape"}`;

  const baseWidth = Math.max(1, options.baseWidth);
  const baseHeight = Math.max(1, options.baseHeight);
  const minUiScale = options.minUiScale ?? 0.82;
  const maxUiScale = options.maxUiScale ?? 1.18;
  const rawScale = Math.min(contentWidth / baseWidth, contentHeight / baseHeight);
  const uiScale = clamp(rawScale, minUiScale, maxUiScale);

  return {
    mode,
    width,
    height,
    contentWidth,
    contentHeight,
    safeTop: safeArea.top,
    safeRight: safeArea.right,
    safeBottom: safeArea.bottom,
    safeLeft: safeArea.left,
    uiScale,
    isPortrait,
    isTablet,
  };
}

export function layoutSignature(layout: ViewportLayout): string {
  return [
    layout.mode,
    layout.width,
    layout.height,
    layout.safeTop,
    layout.safeRight,
    layout.safeBottom,
    layout.safeLeft,
    layout.uiScale.toFixed(4),
  ].join(":");
}
