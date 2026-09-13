export type LayoutMode = "phone-portrait" | "phone-landscape" | "wide";

export type SafeInsets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type LayoutContext = {
  mode: LayoutMode;
  width: number;
  height: number;
  safe: SafeInsets;
  uiScale: number;
  compact: boolean;
};

type LayoutListener = (context: LayoutContext) => void;

const listeners = new Set<LayoutListener>();
let current: LayoutContext = {
  mode: "wide",
  width: 1280,
  height: 720,
  safe: { top: 0, right: 0, bottom: 0, left: 0 },
  uiScale: 1,
  compact: false,
};
let installed = false;
let queued = 0;

export function classifyLayout(width: number, height: number): LayoutMode {
  if (height > width * 1.15) return "phone-portrait";
  if (width > height * 1.15 && Math.min(width, height) <= 600) return "phone-landscape";
  return "wide";
}

function px(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function safeInsets(): SafeInsets {
  if (typeof document === "undefined" || !document.body) return { top: 0, right: 0, bottom: 0, left: 0 };
  const style = getComputedStyle(document.body);
  return {
    top: px(style.paddingTop),
    right: px(style.paddingRight),
    bottom: px(style.paddingBottom),
    left: px(style.paddingLeft),
  };
}

function measure(): LayoutContext {
  if (typeof window === "undefined") return current;
  const viewport = window.visualViewport;
  const width = Math.max(1, Math.round(viewport?.width ?? window.innerWidth));
  const height = Math.max(1, Math.round(viewport?.height ?? window.innerHeight));
  const mode = classifyLayout(width, height);
  const base = mode === "phone-portrait" ? Math.min(width / 390, height / 844) : mode === "phone-landscape" ? Math.min(width / 844, height / 390) : 1;
  return {
    mode,
    width,
    height,
    safe: safeInsets(),
    uiScale: Math.min(1.16, Math.max(0.84, base)),
    compact: Math.min(width, height) < 390,
  };
}

function apply(context: LayoutContext): void {
  current = context;
  if (typeof document !== "undefined") {
    const root = document.documentElement;
    root.dataset.layout = context.mode;
    root.style.setProperty("--game-vw", `${context.width}px`);
    root.style.setProperty("--game-vh", `${context.height}px`);
    root.style.setProperty("--game-ui-scale", String(context.uiScale));
  }
  listeners.forEach((listener) => listener(context));
}

function scheduleMeasure(): void {
  if (typeof window === "undefined") return;
  window.clearTimeout(queued);
  queued = window.setTimeout(() => apply(measure()), 120);
}

function injectCss(): void {
  if (typeof document === "undefined" || document.getElementById("responsive-game-foundation")) return;
  const style = document.createElement("style");
  style.id = "responsive-game-foundation";
  style.textContent = `
    html, body { width: 100%; min-height: 100%; min-height: 100dvh; }
    #game { max-width: calc(var(--game-vw, 100vw) - env(safe-area-inset-left) - env(safe-area-inset-right)); max-height: calc(var(--game-vh, 100vh) - env(safe-area-inset-top) - env(safe-area-inset-bottom)); }
    #game canvas { touch-action: none; }
    html[data-layout="phone-portrait"] .hub-return,
    html[data-layout="phone-landscape"] .hub-return { min-width: 44px; min-height: 44px; justify-content: center; }
    html[data-layout="phone-portrait"] .game-rail--bottom { bottom: calc(6px + env(safe-area-inset-bottom)); max-width: calc(100vw - 16px); }
    html[data-layout="phone-landscape"] .game-rail--bottom { display: none; }
    html[data-layout="phone-landscape"] .game-rail--top { top: calc(4px + env(safe-area-inset-top)); }
    html[data-layout="phone-landscape"] #game canvas { max-height: calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 8px) !important; max-width: calc(100dvw - env(safe-area-inset-left) - env(safe-area-inset-right) - 8px) !important; }
    @media (pointer: coarse) {
      button, [role="button"], a { -webkit-tap-highlight-color: transparent; }
    }
  `;
  document.head.appendChild(style);
}

export function installResponsiveViewport(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  injectCss();
  apply(measure());
  window.addEventListener("resize", scheduleMeasure, { passive: true });
  window.addEventListener("orientationchange", scheduleMeasure, { passive: true });
  window.visualViewport?.addEventListener("resize", scheduleMeasure, { passive: true });
}

export function getLayoutContext(): LayoutContext {
  return current;
}

export function onLayoutChange(listener: LayoutListener): () => void {
  listeners.add(listener);
  listener(current);
  return () => listeners.delete(listener);
}
