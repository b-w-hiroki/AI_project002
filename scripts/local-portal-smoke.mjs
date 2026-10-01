import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("../games/side-scroller/node_modules/@playwright/test");

const baseUrl = process.env.LOCAL_PORTAL_URL ?? "http://127.0.0.1:18765/";
const games = [
  "potion-workshop",
  "side-scroller",
  "sangoku-tap",
  "fist-legend",
  "karma-quest",
  "color-match",
];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, locale: "ja-JP" });
const errors = [];
page.on("pageerror", error => errors.push(error.message));
page.on("console", message => {
  if (message.type() === "error") errors.push(`console: ${message.text()}`);
});
page.on("requestfailed", request => errors.push(`request: ${request.url()} ${request.failure()?.errorText ?? "failed"}`));
page.on("response", response => {
  if (response.status() >= 400) errors.push(`response: ${response.status()} ${response.url()}`);
});

const report = [];
try {
  await page.goto(baseUrl);
  await page.screenshot({ path: "docs/review/local-six-game-portal.png", fullPage: true });

  for (const game of games) {
    const href = `./${game}/`;
    await page.locator(`a[href="${href}"]`).first().click();
    await page.waitForURL(new RegExp(`/${game}/(?:index\\.html)?$`));
    await page.locator("canvas").waitFor({ state: "visible" });
    await page.waitForTimeout(500);

    const imageState = await page.locator("img").evaluateAll(images => images.map(image => ({
      src: image.currentSrc || image.src,
      complete: image.complete,
      width: image.naturalWidth,
    })));
    assert.equal(imageState.every(image => image.complete && image.width > 0), true, `${game}: broken image`);
    const imageResources = await page.evaluate(() => performance.getEntriesByType("resource")
      .map(entry => entry.name)
      .filter(name => /\.(?:avif|gif|jpe?g|png|webp)(?:\?|$)/i.test(name)));
    assert.ok(imageResources.length > 0, `${game}: no game image resource loaded`);

    await page.evaluate(gameName => localStorage.setItem("local_portal_smoke", gameName), game);
    await page.goBack();
    await page.locator(`a[href="${href}"]`).first().waitFor({ state: "visible" });
    await page.locator(`a[href="${href}"]`).first().click();
    await page.locator("canvas").waitFor({ state: "visible" });
    assert.equal(await page.evaluate(() => localStorage.getItem("local_portal_smoke")), game);
    report.push({ game, images: imageState.length + imageResources.length, portalReturn: true, storage: true });
    await page.goBack();
  }

  assert.deepEqual(errors, []);
  fs.writeFileSync("docs/review/local-six-game-portal.json", `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
