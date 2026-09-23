export const RESPONSIVE_VIEWPORTS = [
  // Existing phone/tablet coverage.
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 800, height: 360 },
  { width: 844, height: 390 },
  { width: 932, height: 430 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },

  // CrazyGames high-traffic iframe/fullscreen sizes (2026-09 requirements).
  { width: 907, height: 510 },
  { width: 1216, height: 684 },
  { width: 1077, height: 606 },
  { width: 821, height: 462 },
  { width: 1366, height: 768 },
  { width: 1920, height: 1080 },
  { width: 1536, height: 864 },
  { width: 1280, height: 720 },
  { width: 800, height: 450 },
  { width: 1080, height: 607 },
] as const;

interface CanvasBox { x: number; y: number; width: number; height: number }
interface CanvasLocator {
  boundingBox(): Promise<CanvasBox | null>;
  evaluate<Result>(callback: (node: Element) => Result): Promise<Result>;
}
interface CanvasPage {
  setViewportSize(viewport: { width: number; height: number }): Promise<void>;
  locator(selector: string): CanvasLocator;
  waitForTimeout(milliseconds: number): Promise<void>;
}

export async function expectResponsiveCanvas(page: CanvasPage): Promise<void> {
  for (const viewport of RESPONSIVE_VIEWPORTS) {
    await page.setViewportSize(viewport);
    let valid = false;
    let diagnostic = "canvas unavailable";
    for (let attempt = 0; attempt < 20 && !valid; attempt += 1) {
      const canvas = page.locator("canvas");
      const box = await canvas.boundingBox();
      if (box && box.width > 0 && box.height > 0) {
        const intrinsic = await canvas.evaluate(node => ({
          width: (node as HTMLCanvasElement).width,
          height: (node as HTMLCanvasElement).height,
          cssWidth: getComputedStyle(node).width,
          cssHeight: getComputedStyle(node).height,
          inlineStyle: (node as HTMLCanvasElement).getAttribute("style"),
        }));
        const insideViewport = box.x >= -1 && box.y >= -1
          && box.x + box.width <= viewport.width + 1
          && box.y + box.height <= viewport.height + 1;
        const aspectError = Math.abs(box.width / box.height - intrinsic.width / intrinsic.height);
        diagnostic = `box=${JSON.stringify(box)} intrinsic=${intrinsic.width}x${intrinsic.height} css=${intrinsic.cssWidth}x${intrinsic.cssHeight} style=${intrinsic.inlineStyle} aspectError=${aspectError}`;
        valid = insideViewport && aspectError < 0.02;
      }
      if (!valid) await page.waitForTimeout(100);
    }
    if (!valid) throw new Error(`canvas did not fit ${viewport.width}x${viewport.height} without stretching: ${diagnostic}`);
  }
}
