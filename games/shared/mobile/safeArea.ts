import type { SafeAreaInsets, ViewportLayout } from "./layout";

const PROBE_ID = "ai-project002-safe-area-probe";

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
