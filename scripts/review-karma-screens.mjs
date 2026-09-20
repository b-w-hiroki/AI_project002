import { chromium } from '../games/karma-quest/node_modules/playwright/index.mjs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Run against the local Vite server. Capture the actual canvas at compact-phone size.
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 320, height: 568 }, deviceScaleFactor: 1 });
  await page.route(/\/src\/main\.ts(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `${await response.text()}\nwindow.__qaGame = game;` });
  });
  await page.goto('http://localhost:15177');
  await page.waitForFunction(() => window.__qaGame?.scene.getScene('GameScene')?.textures.exists('kq-bg-capital-home-v3'));
  const capture = async name => {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.locator('canvas').screenshot({ path: resolve(`docs/review/karma-compact-${name}.png`) });
  };
  await page.evaluate(async () => { window.__qaGame.scene.getScene('GameScene').homeRequest = { id: 'mage_stone', faction: 'mage', text: '魔法の研究に魔石がほしいのです…', karmaDelta: 5 }; });
  await page.waitForFunction(() => window.__qaGame.scene.getScene('GameScene').textures.exists('kq-dialogue-mage-v1'));
  await capture('home');
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForFunction(() => document.querySelector('canvas').width === 800);
  await capture('home-landscape');
  await page.setViewportSize({ width: 320, height: 568 });
  await page.waitForFunction(() => document.querySelector('canvas').width === 450);
  await page.evaluate(async () => {
    const scene = window.__qaGame.scene.getScene('GameScene');
    await scene.startRun();
    scene.currentRequest = { id: 'mage_stone', faction: 'mage', text: '魔法の研究に魔石がほしいのです…', karmaDelta: 5 };
  });
  // Wait for the existing stage-introduction overlay to finish.
  await page.waitForFunction(() => !window.__qaGame.scene.getScene('GameScene').children.list.some(child => child.depth >= 2000 && child.depth <= 2002));
  await capture('choice');
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForFunction(() => document.querySelector('canvas').width === 800);
  await capture('choice-landscape');
  await page.setViewportSize({ width: 320, height: 568 });
  await page.waitForFunction(() => document.querySelector('canvas').width === 450);
  await page.evaluate(() => window.__qaGame.scene.getScene('GameScene').onKarmaChoice(true));
  await capture('reaction');
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForFunction(() => document.querySelector('canvas').width === 800);
  await capture('reaction-landscape');
  await page.setViewportSize({ width: 320, height: 568 });
  await page.waitForFunction(() => document.querySelector('canvas').width === 450);
  await page.evaluate(() => window.__qaGame.scene.getScene('GameScene').showFinal());
  await capture('chronicle');
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForFunction(() => document.querySelector('canvas').width === 800);
  await capture('chronicle-landscape');

  const data = async (path, mime = 'image/png') => `data:${mime};base64,${(await readFile(resolve(path))).toString('base64')}`;
  const mock = await data('docs/review/karma-visual-mock.jpg', 'image/jpeg');
  const names = ['home', 'choice', 'reaction', 'chronicle'];
  const labels = ['王都ホーム', '選択', '世界の反応', '年代記'];
  const current = await Promise.all(names.map(name => data(`docs/review/karma-compact-${name}.png`)));
  const sheet = await browser.newPage({ viewport: { width: 1336, height: 1370 }, deviceScaleFactor: 1 });
  await sheet.setContent(`<style>
    *{box-sizing:border-box}body{margin:0;padding:16px;background:#091724;color:#f7e4bb;font:18px sans-serif}
    main{display:flex;gap:16px}section{width:314px}h1{font-size:23px;margin:0 0 8px}h2{font-size:20px;margin:12px 0}
    p{font-size:16px;margin:0 0 12px}.ref{width:314px;height:638px;overflow:hidden;position:relative}
    .ref img{position:absolute;width:1280px;max-width:none;top:-202px}.actual{display:block;width:314px}
  </style><h1>Karma Quest — 正式モックとスマホ実画面</h1><p>上：モックの画面部分　下：320 × 568での実表示（キャンバス幅314px）。画像は縦横比を保持。</p>
  <main>${names.map((name, i) => `<section><h2>${labels[i]}</h2><div class="ref"><img src="${mock}" style="left:-${[8, 330, 644, 964][i]}px"></div><h2>現在の実装</h2><img class="actual" src="${current[i]}"></section>`).join('')}</main>`);
  await sheet.locator('img').evaluateAll(images => Promise.all(images.map(img => img.decode())));
  await sheet.screenshot({ path: resolve('docs/review/karma-four-screen-comparison.png'), fullPage: true });
  const factions = ['warrior', 'merchant', 'outlaw', 'mage'];
  const ids = ['warrior_iron', 'merchant_monster', 'outlaw_gold', 'mage_stone'];
  const factionLabels = ['戦士 · 鍛冶場', '商人 · 市場', '荒くれ者 · 中庭', '魔術師 · 研究室'];
  await page.setViewportSize({ width: 320, height: 568 });
  await page.waitForFunction(() => document.querySelector('canvas').width === 450);
  for (const [i, faction] of factions.entries()) {
    await page.evaluate(({ faction, id }) => {
      const scene = window.__qaGame.scene.getScene('GameScene');
      scene.phase = 'karma';
      scene.currentRequest = { id, faction, text: '', karmaDelta: 5 };
      return scene.onKarmaChoice(true);
    }, { faction, id: ids[i] });
    await capture(`result-${faction}`);
  }
  const patterns = await Promise.all(factions.map(faction => data(`docs/review/karma-compact-result-${faction}.png`)));
  await sheet.setViewportSize({ width: 1336, height: 630 });
  await sheet.setContent(`<style>body{margin:0;padding:16px;background:#091724;color:#f7e4bb;font:18px sans-serif}main{display:flex;gap:16px}section{width:314px}h2{font-size:20px;margin:0 0 12px}img{width:314px;display:block}</style><main>${patterns.map((src, i) => `<section><h2>${factionLabels[i]}</h2><img src="${src}"></section>`).join('')}</main>`);
  await sheet.locator('img').evaluateAll(images => Promise.all(images.map(img => img.decode())));
  await sheet.screenshot({ path: resolve('docs/review/karma-faction-patterns.png') });
  const requests = await page.evaluate(async () => (await import('/src/logic/karma.ts')).KARMA_REQUESTS);
  for (const faction of factions) {
    await page.evaluate(request => {
      const scene = window.__qaGame.scene.getScene('GameScene');
      scene.phase = 'karma'; scene.currentRequest = request;
    }, requests.find(request => request.faction === faction));
    await capture(`dialogue-${faction}`);
    if (faction === 'warrior') {
      await page.setViewportSize({ width: 800, height: 360 });
      await page.waitForFunction(() => document.querySelector('canvas').width === 800);
      await capture('dialogue-warrior-landscape');
      await page.setViewportSize({ width: 320, height: 568 });
      await page.waitForFunction(() => document.querySelector('canvas').width === 450);
    }
  }
  const portraits = await Promise.all(factions.map(faction => data(`docs/review/karma-compact-dialogue-${faction}.png`)));
  await sheet.setContent(`<style>body{margin:0;padding:16px;background:#091724;color:#f7e4bb;font:18px sans-serif}main{display:flex;gap:16px}section{width:314px}h2{font-size:20px;margin:0 0 12px}img{width:314px;display:block}</style><main>${portraits.map((src, i) => `<section><h2>${['戦士','商人','荒くれ者','魔術師'][i]}</h2><img src="${src}"></section>`).join('')}</main>`);
  await sheet.locator('img').evaluateAll(images => Promise.all(images.map(img => img.decode())));
  await sheet.screenshot({ path: resolve('docs/review/karma-dialogue-patterns.png') });
  for (const accepted of [true, false]) {
    const branch = accepted ? 'accept' : 'decline';
    const shots = [];
    for (const request of requests) {
      await page.evaluate(({ request, accepted }) => {
        const scene = window.__qaGame.scene.getScene('GameScene');
        scene.phase = 'karma'; scene.currentRequest = request;
        return scene.onKarmaChoice(accepted);
      }, { request, accepted });
      await capture(`${request.id}-${branch}`);
      shots.push(await data(`docs/review/karma-compact-${request.id}-${branch}.png`));
    }
    await sheet.setViewportSize({ width: 1336, height: 1228 });
    await sheet.setContent(`<style>body{margin:0;padding:16px;background:#091724;color:#f7e4bb;font:16px sans-serif}main{display:grid;grid-template-columns:repeat(4,314px);gap:16px}h2{font-size:17px;margin:0 0 8px}img{width:314px;display:block}</style><main>${shots.map((src, i) => `<section><h2>${requests[i].id} · ${accepted ? '承諾' : '見送り'}</h2><img src="${src}"></section>`).join('')}</main>`);
    await sheet.locator('img').evaluateAll(images => Promise.all(images.map(img => img.decode())));
    await sheet.screenshot({ path: resolve(`docs/review/karma-outcomes-${branch}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 800, height: 360 });
  await page.waitForFunction(() => document.querySelector('canvas').width === 800);
  await page.evaluate(async () => { const scene = window.__qaGame.scene.getScene('GameScene'); scene.deeds = [{ id: 'request', label: '魔術師の派閥に力を貸した', quality: 4, tag: 'wisdom' }]; });
  await page.evaluate(() => window.__qaGame.scene.getScene('GameScene').showEncounterPhase());
  await capture('encounter-landscape');
  await page.evaluate(() => window.__qaGame.scene.getScene('GameScene').onEncounterChoice('A'));
  await capture('battle-landscape');
  await page.waitForFunction(() => window.__qaGame.scene.getScene('GameScene').phase === 'report');
  await capture('report-landscape');
} finally { await browser.close(); }
