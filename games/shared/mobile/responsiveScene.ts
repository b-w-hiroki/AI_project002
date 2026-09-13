import { layoutSignature, resolveViewportLayout, type LayoutOptions, type ViewportLayout } from "./layout";
import { applyViewportCss, ensureViewportFitCover, readSafeAreaInsets, viewportSize } from "./safeArea";

export const MOBILE_LAYOUT_EVENT = "mobile-layout";
export const MOBILE_LAYOUT_REGISTRY_KEY = "mobileViewportLayout";

type EventHandler = (...args: unknown[]) => void;

type EventEmitterLike = {
  on(event: string, handler: EventHandler, context?: unknown): unknown;
  off(event: string, handler: EventHandler, context?: unknown): unknown;
  once?(event: string, handler: EventHandler, context?: unknown): unknown;
};

type RegistryLike = {
  get(key: string): unknown;
  set(key: string, value: unknown): unknown;
};

export type ResponsiveGameLike = {
  events: EventEmitterLike;
  registry: RegistryLike;
};

export type ResponsiveSceneLike = {
  game: ResponsiveGameLike;
  events: EventEmitterLike;
};

export type ResponsiveController = {
  refresh(): ViewportLayout | null;
  current(): ViewportLayout | null;
  destroy(): void;
};

function canUseDom(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

export function installResponsiveGame(
  game: ResponsiveGameLike,
  options: LayoutOptions,
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
