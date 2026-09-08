// Build sangoku-tap and serve this repo on port 8765. QA-only response hook.
import { createRequire } from "node:module";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
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
const out = fileURLToPath(
    new URL("../docs/review/sangoku-campaign", import.meta.url),
  ),
  errors = [],
  shots = [];
fs.mkdirSync(out, { recursive: true });
async function open(
  width = 450,
  height = 800,
  missingArt = false,
  record = false,
) {
  const p = await browser.newPage({
    viewport: { width, height },
    locale: "ja-JP",
    ...(record ? { recordVideo: { dir: out, size: { width, height } } } : {}),
  });
  p.on("pageerror", (e) => errors.push(e.stack));
  if (missingArt)
    await p.route(
      /st-(boss-gatekeeper|general-kohei|general-ashigaru)\.png$/,
      (route) => route.abort(),
    );
  await p.route("**/assets/index-*.js", async (route) => {
    const response = await route.fetch(),
      before = await response.text();
    const body = before.replace(
      /new ([\w$]+)\.Game\(/,
      "window.__game = new $1.Game(",
    );
    assert.notEqual(body, before);
    await route.fulfill({ response, body });
  });
  await p.goto("http://127.0.0.1:8765/games/sangoku-tap/dist/");
  await p.waitForFunction(() => window.__game?.isBooted);
  await p.waitForTimeout(700);
  return p;
}
const state = (p) =>
  p.evaluate(() => {
    const s = window.__game.scene.getScene("ExpeditionScene");
    return {
      view: s.view,
      run: s.run,
      campaign: s.campaign,
      selected: s.selectedRegion,
      busy: s.busy,
    };
  });
async function click(p, x, y) {
  await p.waitForFunction(() => !window.__game.scene.getScene("ExpeditionScene").busy);
  await p.mouse.click(x, y);
  await p.waitForTimeout(450);
  await p.waitForFunction(
    () => !window.__game.scene.getScene("ExpeditionScene").busy,
  );
}
async function shot(p, name) {
  await p.waitForTimeout(200);
  await p.screenshot({ path: `${out}/${name}.png` });
  shots.push(name);
}
try {
  let p = await open();
  await shot(p, "title");
  await click(p, 225, 470);
  await shot(p, "map-initial");
  const rosterPage = await open();
  await rosterPage.evaluate(() => {
    localStorage.setItem(
      "sangoku_tap_owned_generals_v1",
      JSON.stringify({ gen_soujin: 1, gen_kohei: 1, gen_ashigaru: 1 }),
    );
    window.__game.scene.getScene("GameScene").showRoster();
  });
  await shot(rosterPage, "roster-art");
  await rosterPage.evaluate(() => {
    const s = window.__game.scene.getScene("GameScene");
    s.showTitle();
    s.showGacha();
    s.renderGachaArt({ id: "gen_kohei", name: "小兵", rarity: "N", atk: 20 });
  });
  await shot(rosterPage, "gacha-art");
  await rosterPage.close();
  await click(p, 363, 177);
  assert.equal((await state(p)).selected, "plains");
  await click(p, 337, 608);
  assert.equal((await state(p)).campaign.training, 0);
  await click(p, 113, 608);
  assert.equal((await state(p)).view, "formation");
  await shot(p, "formation");
  await click(p, 225, 686);
  assert.equal((await state(p)).view, "camp");
  for (const [index, region] of ["plains", "pass", "citadel"].entries()) {
    assert.equal((await state(p)).selected, region);
    await click(p, 225, 692);
    assert.equal((await state(p)).run.regionId, region);
    await p.evaluate(
      () => (window.__game.scene.getScene("ExpeditionScene").random = () => 0),
    );
    await shot(p, `${region}-road`);
    assert.equal(
      await p.evaluate(
        () =>
          window.__game.scene
            .getScene("ExpeditionScene")
            .root.getAll("name", "common-enemy").length,
      ),
      2,
    );
    for (let i = 1; i <= 10; i++) {
      await click(p, 225, 660);
      const s = await state(p);
      assert.equal(s.run.step, i);
      if (i === 3 || i === 7) {
        if (index === 0 && i === 3) {
          await shot(p, "fork");
          await p.reload();
          await p.waitForTimeout(750);
          await click(p, 225, 470);
          assert.equal((await state(p)).run.step, 3);
          assert.equal((await state(p)).run.regionId, "plains");
          await p.evaluate(
            () =>
              (window.__game.scene.getScene("ExpeditionScene").random = () =>
                0),
          );
        }
        await click(p, 124, 660);
      }
      if (i === 9) {
        assert.equal(
          await p.evaluate(
            () =>
              window.__game.scene
                .getScene("ExpeditionScene")
                .root.getByName("gatekeeper-boss").displayHeight,
          ),
          375,
        );
        await shot(p, `${region}-gate`);
      }
    }
    const result = await state(p);
    assert.equal(result.view, "result");
    assert.equal(result.run.status, "clear");
    assert.equal(result.campaign.cleared.length, index + 1);
    await shot(p, `${region}-clear`);
    await p.evaluate(() =>
      window.__game.scene.getScene("ExpeditionScene").settle(),
    );
    assert.deepEqual((await state(p)).campaign, result.campaign);
    await click(p, 225, 607);
    await shot(p, `${region}-map-cleared`);
    const before = await state(p);
    await click(p, 337, 608);
    const after = await state(p);
    assert.equal(after.campaign.training, before.campaign.training + 1);
    assert.ok(after.campaign.merit < before.campaign.merit);
  }
  await shot(p, "map-completed");
  await p.reload();
  await p.waitForTimeout(700);
  await click(p, 225, 470);
  assert.equal((await state(p)).campaign.cleared.length, 3);
  assert.equal((await state(p)).campaign.training, 3);
  await click(p, 83, 285);
  await click(p, 225, 692);
  await p.evaluate(() => {
    const s = window.__game.scene.getScene("ExpeditionScene");
    s.run = { ...s.run, step: 6, hp: 1, loot: 101 };
    s.random = () => 0.5;
    s.render();
  });
  await p.waitForTimeout(150);
  await click(p, 225, 660);
  // Force a defeat deterministically at a mandatory gate.
  if ((await state(p)).view !== "result") {
    await p.evaluate(() => {
      const s = window.__game.scene.getScene("ExpeditionScene");
      s.run = { ...s.run, step: 9, hp: 1, fork: false };
      s.random = () => 0.99;
      s.render();
    });
    await p.waitForTimeout(150);
    await click(p, 225, 660);
  }
  assert.equal((await state(p)).run.status, "defeat");
  await shot(p, "defeat");
  await p.close();
  p = await open(390, 844);
  await click(p, 195, 482); // FIT canvas has a centered vertical letterbox.
  if ((await state(p)).view !== "camp")
    await p.evaluate(() => window.__game.scene.start("ExpeditionScene"));
  await p.waitForTimeout(400);
  await shot(p, "mobile-map");
  await p.close();
  p = await open(450, 800, true);
  await click(p, 225, 470);
  await click(p, 225, 692);
  await p.evaluate(() => {
    const s = window.__game.scene.getScene("ExpeditionScene");
    s.run = { ...s.run, step: 9 };
    s.random = () => 0;
    s.render();
  });
  await p.waitForTimeout(200);
  await shot(p, "missing-art-fallback");
  assert.equal(
    await p.evaluate(() => window.__game.textures.exists("st-boss-gatekeeper")),
    false,
  );
  await click(p, 225, 660);
  assert.equal((await state(p)).run.status, "clear");
  await p.close();
  // Record an actual entrance and attack, and interrupt a second attack with reload.
  p = await open(450, 800, false, true);
  await click(p, 225, 470);
  await click(p, 225, 692);
  await p.evaluate(() => {
    const s = window.__game.scene.getScene("ExpeditionScene");
    s.run = { ...s.run, step: 8, hp: 100 };
    s.random = () => 0;
    s.render();
  });
  await p.waitForTimeout(300);
  await p.mouse.click(225, 676);
  await p.waitForTimeout(150);
  assert.equal((await state(p)).busy, true);
  await shot(p, "boss-entrance");
  await p.mouse.click(225, 676);
  assert.equal((await state(p)).run.step, 9);
  await p.waitForFunction(
    () => !window.__game.scene.getScene("ExpeditionScene").busy,
  );
  await p.waitForTimeout(300);
  await p.mouse.click(225, 676);
  await p.waitForTimeout(300);
  await shot(p, "boss-strike");
  const credited = await p.evaluate(() =>
    localStorage.getItem("sangoku_tap_currency_v1"),
  );
  await p.waitForFunction(
    () => !window.__game.scene.getScene("ExpeditionScene").busy,
  );
  await p.waitForTimeout(700);
  await p.reload();
  await p.waitForTimeout(900);
  await click(p, 225, 470);
  assert.equal(
    await p.evaluate(() => localStorage.getItem("sangoku_tap_currency_v1")),
    credited,
  );
  const video = p.video();
  await p.close();
  await video.saveAs(`${out}/boss-cinematic.webm`);
  fs.unlinkSync(await video.path());
  // Reload in the middle of the resolution: rewards have already been credited exactly once.
  p = await open();
  await click(p, 225, 470);
  await click(p, 225, 692);
  await p.evaluate(() => {
    const s = window.__game.scene.getScene("ExpeditionScene");
    s.run = { ...s.run, step: 9 };
    s.random = () => 0;
    s.render();
  });
  await p.waitForFunction(
    () => !window.__game.scene.getScene("ExpeditionScene").busy,
  );
  await p.mouse.click(225, 676);
  await p.waitForTimeout(100);
  const interrupted = await p.evaluate(() =>
    localStorage.getItem("sangoku_tap_currency_v1"),
  );
  await p.reload();
  await p.waitForTimeout(800);
  await click(p, 225, 470);
  assert.equal((await state(p)).view, "camp");
  assert.equal(
    await p.evaluate(() => localStorage.getItem("sangoku_tap_currency_v1")),
    interrupted,
  );
  await p.close();
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    `${out}/results.json`,
    JSON.stringify(
      {
        shots,
        errors,
        checks: [
          "three chapter clear/unlock",
          "locked selection",
          "training costs/persistence",
          "formation navigation",
          "save resume at fork",
          "single settlement",
          "defeat",
          "390px viewport",
        ],
      },
      null,
      2,
    ),
  );
  console.log(`Campaign checks passed; ${shots.length} screenshots`);
} finally {
  await browser.close();
}
