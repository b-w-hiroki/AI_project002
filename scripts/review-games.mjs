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
  page.on("pageerror", (e) => report.push({ game, error: e.message }));
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
  // The three-region campaign is exercised by review-sangoku-campaign.mjs.
  let p = await open("fist-legend", 800, 600);
  await shot(p, "fist-title");
  await click(p, 300, 410);
  await shot(p, "fist-battle");
  for (let i = 0; i < 12; i++) {
    const state = await p.evaluate(() => {
      const s = window.__game.scene.getScene("GameScene");
      return { phase: s.phase, next: s.nextEnemyMove, accepting: s.accepting };
    });
    if (state.phase !== "battle") break;
    if (!state.accepting) {
      await p.waitForTimeout(300);
      continue;
    }
    await p.evaluate(() => {
      const s = window.__game.scene.getScene("GameScene");
      s.onPlayerMove(
        { punch: "kick", kick: "ki", ki: "punch" }[s.nextEnemyMove],
      );
    });
    await p.waitForTimeout(500);
  }
  await p.waitForTimeout(450);
  assert.equal((await scene(p)).phase, "result");
  await shot(p, "fist-result");
  await p.close();
  p = await open("karma-quest");
  await shot(p, "karma-title");
  await click(p, 225, 650);
  await shot(p, "karma-growth");
  for (let year = 1; year <= 12; year++) {
    await click(p, 225, 500);
    if ((await scene(p)).phase === "encounter") await click(p, 225, 460);
    await click(p, 225, 560);
    if (year === 1) await shot(p, "karma-battle");
    await p.waitForFunction(
      () => window.__game.scene.getScene("GameScene").phase === "report",
    );
    await click(p, 225, 291);
    await click(p, 225, 365);
    await click(p, 225, 439);
    assert.equal(
      await p.evaluate(
        () =>
          window.__game.scene
            .getScene("GameScene")
            .highlightRows.filter((r) => r.selected).length,
      ),
      2,
    );
    await click(p, 323, 213);
    if (year === 1) await shot(p, "karma-report");
    await p.mouse.dblclick(225, 680, { delay: 50 });
    await p.waitForTimeout(650);
    assert.equal(
      await p.evaluate(
        () => window.__game.scene.getScene("GameScene").chronicle.length,
      ),
      year,
    );
  }
  assert.equal((await scene(p)).phase, "final");
  await shot(p, "karma-final");
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
  await p.waitForTimeout(120);
  await shot(p, "potion-grown");
  await click(p, 660, 715);
  await shot(p, "potion-orders");
  await click(p, 400, 322);
  assert.equal(
    await p.evaluate(
      () => window.__game.scene.getScene("idle").state.reputation,
    ),
    1,
  );
  await click(p, 400, 322);
  assert.equal(
    await p.evaluate(
      () => window.__game.scene.getScene("idle").state.reputation,
    ),
    1,
  );
  await shot(p, "potion-delivered");
  await p.close();
  p = await open("color-match");
  await shot(p, "color-title");
  await click(p, 225, 670);
  await shot(p, "color-playing");
  // Move the timer near a boundary to check the real update loop without waiting 60 seconds.
  await p.evaluate(() => {
    const s = window.__game.scene.getScene("GameScene");
    s.sessionRemaining = 46000;
  });
  await p.waitForTimeout(100);
  await shot(p, "color-switch");
  await p.evaluate(() => {
    const s = window.__game.scene.getScene("GameScene");
    s.sessionRemaining = 40;
  });
  await p.waitForTimeout(600);
  assert.equal((await scene(p)).phase, "result");
  await shot(p, "color-result");
  await click(p, 225, 510);
  assert.equal((await scene(p)).phase, "playing");
  await p.waitForTimeout(500);
  assert.equal(
    await p.evaluate(
      () => window.__game.scene.getScene("GameScene").roundIndex,
    ),
    1,
  );
  await p.close();
  p = await open("side-scroller", 800, 600);
  await shot(p, "sword-loadout");
  await p.evaluate(() => window.__game.scene.start("GameScene"));
  await p.waitForTimeout(500);
  await shot(p, "sword-style");
  assert.equal(
    await p.evaluate(
      () => window.__game.scene.getScene("GameScene").styleChoosing,
    ),
    true,
  );
  await click(p, 565, 320);
  await shot(p, "sword-playing");
  await p.evaluate(() => {
    const s = window.__game.scene.getScene("GameScene");
    for (const e of s.enemies) {
      e.state.alive = false;
      e.sprite.destroy();
    }
    s.enemies = [];
    s.wave = 5;
    s.spawnWave(5);
    const boss = s.enemies.find((e) => e.boss);
    boss.sprite.x = s.player.x + 180;
    boss.bornAt = s.time.now;
  });
  await p.waitForTimeout(200);
  await shot(p, "sword-boss-tell");
  await p.close();
} catch (e) {
  report.push({ failure: e.stack });
  throw e;
} finally {
  fs.writeFileSync(
    `${output}/browser-results.json`,
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
assert.equal(
  report.filter((r) => r.error).length,
  0,
  JSON.stringify(report.filter((r) => r.error)),
);
console.log("Browser checks passed. Screenshots:", report.length);
