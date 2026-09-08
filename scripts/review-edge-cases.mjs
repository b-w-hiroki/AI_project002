// Run after building all six games and serving the repository on localhost:8765.
// QA only: intercept the application bundle to observe Phaser scene state; never shipped.
import { createRequire } from "node:module";
import fs from "node:fs";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const { chromium } = require(
  process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES
    ? process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES + "/playwright"
    : "../games/side-scroller/node_modules/@playwright/test",
);
const browser = await chromium.launch({
  executablePath: process.env.GAME_CHROMIUM ?? "/usr/bin/google-chrome",
  headless: true,
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--no-zygote",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
  env: { ...process.env },
});
const report = [];
const output = "docs/review";
fs.mkdirSync(output, { recursive: true });
async function open(game, width = 450, height = 800) {
  const page = await browser.newPage({
    viewport: { width, height },
    locale: "ja-JP",
    deviceScaleFactor: 1,
  });
  page.on("pageerror", (e) => report.push({ game, error: e.stack }));
  await page.route("**/assets/index-*.js", async (route) => {
    const response = await route.fetch();
    let body = await response.text();
    const before = body;
    body = body.replace(/new ([\w$]+)\.Game\(/, "window.__game = new $1.Game(");
    assert.notEqual(body, before, "Phaser inspection hook");
    await route.fulfill({ response, body });
  });
  await page.goto(`http://127.0.0.1:8765/games/${game}/dist/`);
  await page.waitForFunction(() => window.__game?.isBooted);
  await page.waitForTimeout(850);
  return page;
}
const scene = (page, name = "GameScene") =>
  page.evaluate((name) => {
    const s = window.__game.scene.getScene(name);
    return { phase: s.phase, view: s.view, step: s.run?.step };
  }, name);
async function click(page, x, y) {
  await page.waitForFunction(() => !window.__game?.scene.keys.ExpeditionScene?.busy);
  await page.mouse.click(x, y);
  await page.waitForTimeout(450);
  await page.waitForFunction(() => !window.__game?.scene.keys.ExpeditionScene?.busy);
}
async function shot(page, name) {
  await page.screenshot({ path: `${output}/${name}.png` });
  report.push({ screenshot: name });
}
try {
  let p = await open("sangoku-tap");
  await click(p, 225, 470);
  await click(p, 225, 692);
  await p.evaluate(() => {
    const s = window.__game.scene.getScene("ExpeditionScene");
    s.run = { ...s.run, step: 9, hp: 1, loot: 101 };
    s.run.troop.guard = 0;
    s.run.troop.power = 0;
    s.random = () => 0.99;
    s.render();
  });
  await p.waitForTimeout(100); // Allow Phaser to register rebuilt input targets.
  await click(p, 225, 660);
  assert.equal(
    await p.evaluate(
      () => window.__game.scene.getScene("ExpeditionScene").run.status,
    ),
    "defeat",
  );
  assert.equal(
    await p.evaluate(() =>
      Number(localStorage.getItem("sangoku_tap_currency_v1")),
    ),
    50,
  );
  await shot(p, "sangoku-defeat");
  await p.evaluate(() => window.__game.scene.start("GameScene"));
  await p.waitForTimeout(500);
  await p.evaluate(() =>
    localStorage.setItem("sangoku_tap_currency_v1", "1000"),
  );
  await click(p, 225, 600);
  await click(p, 225, 590);
  let inventory = await p.evaluate(() =>
    JSON.parse(localStorage.getItem("sangoku_tap_equipment_inventory_v1")),
  );
  assert.equal(inventory.Common, 1);
  const money = await p.evaluate(() =>
    localStorage.getItem("sangoku_tap_currency_v1"),
  );
  await click(p, 225, 590);
  assert.equal(
    await p.evaluate(() => localStorage.getItem("sangoku_tap_currency_v1")),
    money,
  );
  await shot(p, "sangoku-breeding");
  await click(p, 225, 655);
  await click(p, 225, 470);
  await click(p, 225, 692);
  await p.evaluate(() => {
    const s = window.__game.scene.getScene("ExpeditionScene");
    s.run = { ...s.run, step: 9, hp: 100, loot: 101 };
    s.random = () => 0;
    s.render();
  });
  await p.waitForTimeout(100); // Allow Phaser to register rebuilt input targets.
  await click(p, 225, 660);
  assert.equal(
    await p.evaluate(
      () => window.__game.scene.getScene("ExpeditionScene").run.status,
    ),
    "clear",
  );
  await shot(p, "sangoku-clear");
  await p.close();
  p = await open("sangoku-tap", 390, 844);
  await p.evaluate(() => window.__game.scene.start("ExpeditionScene"));
  await p.waitForTimeout(400);
  await shot(p, "sangoku-mobile");
  await p.close();
  p = await open("potion-workshop", 800, 760);
  await shot(p, "potion-initial");
  await p.evaluate(() => {
    const s = window.__game.scene.getScene("idle");
    s.state.potions = 2000;
    s.state.counts.apprentice = 8;
    s.state.counts.cauldron = 2;
    s.state.counts.garden = 1;
  });
  await p.waitForTimeout(100);
  await shot(p, "potion-grown");
  await click(p, 660, 715);
  await shot(p, "potion-orders");
  await click(p, 400, 322);
  await shot(p, "potion-delivered");
  await click(p, 400, 564);
  await click(p, 760, 26);
  await click(p, 660, 715);
  await shot(p, "potion-orders-en");
  await p.close();
  p = await open("color-match");
  await click(p, 225, 670);
  const target = await p.evaluate(() => {
    const s = window.__game.scene.getScene("GameScene");
    const box = s.targetBoxes.find(
      (b) => b.colorId === s.currentRound.correctColorId,
    );
    return { x: box.container.x, y: box.container.y };
  });
  await p.mouse.move(225, 260);
  await p.mouse.down();
  await p.mouse.move(target.x, target.y, { steps: 12 });
  await p.mouse.up();
  await p.waitForTimeout(100);
  assert.equal(
    await p.evaluate(
      () => window.__game.scene.getScene("GameScene").results[0].correct,
    ),
    true,
  );
  await p.evaluate(() => {
    window.__game.scene.getScene("GameScene").sessionRemaining = 20;
  });
  await p.waitForTimeout(400);
  assert.equal((await scene(p)).phase, "result");
  await shot(p, "color-result");
  await p.close();
  p = await open("side-scroller", 800, 600);
  await p.evaluate(() => window.__game.scene.start("GameScene"));
  await p.waitForTimeout(300);
  await shot(p, "sword-style");
  await click(p, 235, 320);
  const before = await p.evaluate(
    () => window.__game.scene.getScene("GameScene").player.x,
  );
  await p.keyboard.down("ArrowRight");
  await p.waitForTimeout(350);
  await p.keyboard.up("ArrowRight");
  assert.ok(
    (await p.evaluate(
      () => window.__game.scene.getScene("GameScene").player.x,
    )) > before,
  );
  await shot(p, "sword-chain");
  await p.close();
} catch (e) {
  report.push({ failure: e.stack });
  throw e;
} finally {
  fs.writeFileSync(
    `${output}/edge-results.json`,
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
assert.equal(report.filter((r) => r.error).length, 0, JSON.stringify(report));
console.log("Edge cases passed:", report.length);
