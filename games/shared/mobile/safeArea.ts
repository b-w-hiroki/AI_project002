import type { SafeAreaInsets, ViewportLayout } from "./layout";

const PROBE_ID = "ai-project002-safe-area-probe";
const STYLE_ID = "ai-project002-mobile-foundation";

function px(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

export function ensureViewportFitCover(doc: Document = document): void {
  const existing = doc.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  if (!existing) {
    const meta = doc.createElement("meta");
    meta.name = "viewport";
    meta.content = "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover";
    doc.head.appendChild(meta);
    return;
  }

  const parts = existing.content
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (!parts.some((part) => part.startsWith("viewport-fit="))) {
    parts.push("viewport-fit=cover");
    existing.content = parts.join(", ");
  }
}

export function ensureResponsiveStyles(doc: Document = document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    html, body {
      width: 100%;
      min-height: 100%;
      min-height: 100dvh;
      overscroll-behavior: none;
    }
    #game {
      max-width: calc(var(--mobile-content-width, 100vw));
      max-height: calc(var(--mobile-content-height, 100vh));
    }
    #game canvas {
      touch-action: none;
      -webkit-user-select: none;
      user-select: none;
    }
    html[data-layout-mode="phone-portrait"] .hub-return,
    html[data-layout-mode="phone-landscape"] .hub-return {
      min-width: 44px;
      min-height: 44px;
      justify-content: center;
    }
    html[data-layout-mode="phone-portrait"] .game-rail--bottom {
      bottom: calc(6px + env(safe-area-inset-bottom));
      max-width: calc(100vw - 16px);
    }
    html[data-layout-mode="phone-landscape"] .game-rail--bottom {
      display: none;
    }
    html[data-layout-mode="phone-landscape"] .game-rail--top {
      top: calc(4px + env(safe-area-inset-top));
    }
    html[data-layout-mode="phone-landscape"] #game canvas {
      max-height: calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 8px) !important;
      max-width: calc(100dvw - env(safe-area-inset-left) - env(safe-area-inset-right) - 8px) !important;
    }
    @media (pointer: coarse) {
      button, [role="button"], a {
        -webkit-tap-highlight-color: transparent;
      }
    }
  `;
  doc.head.appendChild(style);
}

export function readSafeAreaInsets(doc: Document = document): SafeAreaInsets {
  const root = doc.body ?? doc.documentElement;
  let probe = doc.getElementById(PROBE_ID) as HTMLDivElement | null;
  const owned = !probe;

  if (!probe) {
    probe = doc.createElement("div");
    probe.id = PROBE_ID;
    probe.setAttribute("aria-hidden", "true");
    probe.style.cssText = [
      "position:fixed",
      "pointer-events:none",
      "visibility:hidden",
      "z-index:-1",
      "inset:0",
      "padding-top:env(safe-area-inset-top)",
      "padding-right:env(safe-area-inset-right)",
      "padding-bottom:env(safe-area-inset-bottom)",
      "padding-left:env(safe-area-inset-left)",
    ].join(";");
    root.appendChild(probe);
  }

  const style = doc.defaultView?.getComputedStyle(probe);
  const result: SafeAreaInsets = {
    top: px(style?.paddingTop ?? "0"),
    right: px(style?.paddingRight ?? "0"),
    bottom: px(style?.paddingBottom ?? "0"),
    left: px(style?.paddingLeft ?? "0"),
  };

  if (owned) probe.remove();
  return result;
}

export function viewportSize(win: Window = window): { width: number; height: number } {
  const viewport = win.visualViewport;
  return {
    width: Math.max(1, Math.round(viewport?.width ?? win.innerWidth)),
    height: Math.max(1, Math.round(viewport?.height ?? win.innerHeight)),
  };
}

export function applyViewportCss(layout: ViewportLayout, doc: Document = document): void {
  const style = doc.documentElement.style;
  style.setProperty("--mobile-safe-top", `${layout.safeTop}px`);
  style.setProperty("--mobile-safe-right", `${layout.safeRight}px`);
  style.setProperty("--mobile-safe-bottom", `${layout.safeBottom}px`);
  style.setProperty("--mobile-safe-left", `${layout.safeLeft}px`);
  style.setProperty("--mobile-ui-scale", String(layout.uiScale));
  style.setProperty("--mobile-content-width", `${layout.contentWidth}px`);
  style.setProperty("--mobile-content-height", `${layout.contentHeight}px`);

  doc.documentElement.dataset.layoutMode = layout.mode;
  doc.documentElement.dataset.orientation = layout.isPortrait ? "portrait" : "landscape";
  if (doc.body) {
    doc.body.dataset.layoutMode = layout.mode;
    doc.body.dataset.orientation = layout.isPortrait ? "portrait" : "landscape";
  }
}
