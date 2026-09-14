import { layoutSignature, resolveViewportLayout, type LayoutOptions, type ViewportLayout } from "./layout";
import {
  applyViewportCss,
  ensureResponsiveStyles,
  ensureViewportFitCover,
  readSafeAreaInsets,
  viewportSize,
} from "./safeArea";

export const MOBILE_LAYOUT_EVENT = "mobile-layout";
export const MOBILE_LAYOUT_REGISTRY_KEY = "mobileViewportLayout";

type EventHandler = (...args: unknown[]) => void;

type EventEmitterLike = {
  on(event: string, handler: EventHandler, context?: unknown): unknown;
  off(event: string, handler: EventHandler, context?: unknown): unknown;
  once?(event: string, handler: EventHandler, context?: unknown): unknown;
  emit?(event: string, ...args: unknown[]): unknown;
};

type RegistryLike = {
  get(key: string): unknown;
  set(key: string, value: unknown): unknown;
};

type ScaleLike = {
  resize(width: number, height: number): unknown;
  gameSize?: { width: number; height: number };
  canvas?: HTMLCanvasElement;
  baseSize?: { width: number; height: number };
  canvasBounds?: { width: number; height: number };
  displayScale?: { set(x: number, y: number): unknown };
  updateBounds?(): unknown;
};

export type ResponsiveGameLike = {
  events: EventEmitterLike;
  registry: RegistryLike;
  scale?: ScaleLike;
};

export type ResponsiveSceneLike = {
  game: ResponsiveGameLike;
  events: EventEmitterLike;
};

export type SurfaceSize = { width: number; height: number };
export type ResponsiveGameOptions = LayoutOptions & {
  surface?: {
    portrait: SurfaceSize;
    landscape: SurfaceSize;
  };
};

export type ResponsiveController = {
  refresh(): ViewportLayout | null;
  current(): ViewportLayout | null;
  destroy(): void;
};

function canUseDom(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function applySurface(game: ResponsiveGameLike, layout: ViewportLayout, options: ResponsiveGameOptions): void {
  if (!game.scale) return;
  const current = game.scale.gameSize;
  const target = options.surface
    ? (layout.isPortrait ? options.surface.portrait : options.surface.landscape)
    : game.scale.canvas
      ? { width: game.scale.canvas.width, height: game.scale.canvas.height }
      : current ?? game.scale.baseSize;
  if (!target) return;
  // Phaser Size objects are mutable and may be updated by its own resize
  // listener while this handler runs, so snapshot both dimensions first.
  const targetWidth = target.width;
  const targetHeight = target.height;
  if (options.surface && (current?.width !== targetWidth || current.height !== targetHeight)) {
    game.scale.resize(targetWidth, targetHeight);
  }
  // Phaser's resize() can retain the previous orientation's display size.
  // Recalculate both CSS dimensions from one scale factor so artwork is never
  // stretched independently on either axis.
  if (game.scale.canvas) {
    const availableWidth = Math.max(1, layout.contentWidth - 18);
    const availableHeight = Math.max(1, layout.contentHeight - (layout.isPortrait ? 82 : 8));
    const fit = Math.min(availableWidth / targetWidth, availableHeight / targetHeight);
    const canvasWidth = `${Math.floor(targetWidth * fit)}px`;
    const canvasHeight = `${Math.floor(targetHeight * fit)}px`;
    document.documentElement.style.setProperty("--game-canvas-width", canvasWidth);
    document.documentElement.style.setProperty("--game-canvas-height", canvasHeight);
    game.scale.canvas.style.setProperty("width", canvasWidth, "important");
    game.scale.canvas.style.setProperty("height", canvasHeight, "important");
    game.scale.canvas.style.setProperty("margin", "0 auto", "important");
    game.scale.updateBounds?.();
    if (game.scale.baseSize && game.scale.canvasBounds && game.scale.displayScale) {
      game.scale.displayScale.set(
        game.scale.baseSize.width / game.scale.canvasBounds.width,
        game.scale.baseSize.height / game.scale.canvasBounds.height,
      );
    }
  }
}

export function installResponsiveGame(
  game: ResponsiveGameLike,
  options: ResponsiveGameOptions,
): ResponsiveController {
  let currentLayout: ViewportLayout | null = null;
  let currentSignature = "";
  let raf = 0;
  let destroyed = false;

  const publish = (): ViewportLayout | null => {
    if (destroyed || !canUseDom()) return currentLayout;

    const size = viewportSize(window);
    const layout = resolveViewportLayout(
      {
        width: size.width,
        height: size.height,
        safeArea: readSafeAreaInsets(document),
      },
      options,
    );
    const signature = layoutSignature(layout);

    currentLayout = layout;
    game.registry.set(MOBILE_LAYOUT_REGISTRY_KEY, layout);
    applyViewportCss(layout, document);
    applySurface(game, layout, options);

    if (signature !== currentSignature) {
      currentSignature = signature;
      game.events.emit?.(MOBILE_LAYOUT_EVENT, layout);
    }
    return layout;
  };

  const schedule = (): void => {
    if (destroyed || !canUseDom()) return;
    if (raf) window.cancelAnimationFrame(raf);
    raf = window.requestAnimationFrame(() => {
      raf = 0;
      publish();
      // iOS can report an intermediate viewport while rotating. A second frame
      // catches the settled safe-area and visualViewport values without reload.
      window.requestAnimationFrame(() => publish());
    });
  };

  const onVisibility = (): void => {
    if (!document.hidden) schedule();
  };

  const destroy = (): void => {
    if (destroyed) return;
    destroyed = true;
    if (!canUseDom()) return;
    if (raf) window.cancelAnimationFrame(raf);
    window.removeEventListener("resize", schedule);
    window.removeEventListener("orientationchange", schedule);
    window.visualViewport?.removeEventListener("resize", schedule);
    window.visualViewport?.removeEventListener("scroll", schedule);
    document.removeEventListener("visibilitychange", onVisibility);
  };

  if (canUseDom()) {
    ensureViewportFitCover(document);
    ensureResponsiveStyles(document);
    window.addEventListener("resize", schedule, { passive: true });
    window.addEventListener("orientationchange", schedule, { passive: true });
    window.visualViewport?.addEventListener("resize", schedule, { passive: true });
    window.visualViewport?.addEventListener("scroll", schedule, { passive: true });
    document.addEventListener("visibilitychange", onVisibility, { passive: true });
    game.events.once?.("destroy", destroy);
    publish();
  }

  return {
    refresh: publish,
    current: () => currentLayout,
    destroy,
  };
}

export function getResponsiveLayout(source: ResponsiveGameLike | ResponsiveSceneLike): ViewportLayout | null {
  const game = "game" in source ? source.game : source;
  const value = game.registry.get(MOBILE_LAYOUT_REGISTRY_KEY);
  return value && typeof value === "object" ? (value as ViewportLayout) : null;
}

export function bindResponsiveScene(
  scene: ResponsiveSceneLike,
  apply: (layout: ViewportLayout) => void,
): () => void {
  const handler: EventHandler = (layout) => {
    if (layout && typeof layout === "object") apply(layout as ViewportLayout);
  };
  const cleanup = (): void => {
    scene.game.events.off(MOBILE_LAYOUT_EVENT, handler);
  };

  scene.game.events.on(MOBILE_LAYOUT_EVENT, handler);
  scene.events.once?.("shutdown", cleanup);
  scene.events.once?.("destroy", cleanup);

  const current = getResponsiveLayout(scene);
  if (current) apply(current);
  return cleanup;
}
