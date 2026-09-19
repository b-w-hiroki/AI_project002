import { chromium } from '../games/karma-quest/node_modules/playwright/index.mjs';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.route(/\/src\/main\.ts(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `${await response.text()}\nwindow.__qaGame = game;` });
  });
  await page.goto('http://localhost:15177');
  await page.waitForFunction(() => window.__qaGame?.scene.getScene('GameScene').sys.isActive());
  const cdp = await page.context().newCDPSession(page);
  const phase = () => page.evaluate(() => window.__qaGame.scene.getScene('GameScene').phase);
  const wait = name => page.waitForFunction(name => window.__qaGame.scene.getScene('GameScene').phase === name, name);
  const tap = async (x, y) => {
    const canvas = page.locator('canvas'), box = await canvas.boundingBox();
    const size = await canvas.evaluate(c => ({ width: c.width, height: c.height }));
    await page.touchscreen.tap(box.x + x * box.width / size.width, box.y + y * box.height / size.height);
  };
  const samples = [], started = Date.now();
  await tap(225, 660);
  for (let cycle = 0; cycle < 3; cycle++) {
    for (let year = 1; year <= 12; year++) {
      await wait('karma');
      assert.equal(await page.evaluate(() => window.__qaGame.scene.getScene('GameScene').stage), year);
      const wide = year % 2 === 0;
      await page.setViewportSize(wide ? { width: 800, height: 360 } : { width: 320, height: 568 });
      await page.waitForFunction(wide => document.querySelector('canvas').width === (wide ? 800 : 450), wide);
      await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
      await tap(wide ? 591 : 225, wide ? 301 : 598);
      await wait('reaction');
      await tap(wide ? 579 : 225, wide ? 376 : 750);
      await page.waitForFunction(() => ['encounter', 'battle'].includes(window.__qaGame.scene.getScene('GameScene').phase));
      if (await phase() === 'encounter') await tap(wide ? 591 : 225, wide ? 322 : 460);
      await wait('battle'); await tap(wide ? 591 : 225, wide ? 396 : 560);
      await wait('report');
      await tap(wide ? 215 : 225, wide ? 150 : 291);
      await tap(wide ? 609 : 225, wide ? 405 : 680);
    }
    await wait('final');
    await cdp.send('HeapProfiler.collectGarbage');
    const heap = await cdp.send('Runtime.getHeapUsage');
    const state = await page.evaluate(() => {
      const scene = window.__qaGame.scene.getScene('GameScene');
      let objects = 0;
      const visit = node => { objects++; if (Array.isArray(node.list)) node.list.forEach(visit); };
      scene.children.list.forEach(visit);
      return { objects, textures: Object.keys(scene.textures.list).length, history: scene.choiceHistory.length };
    });
    assert.equal(state.history, 12);
    samples.push({ cycle: cycle + 1, elapsedMs: Date.now() - started, ...state, jsHeapAfterGC: heap.usedSize });
    console.log(JSON.stringify(samples.at(-1)));
    if (cycle < 2) { await tap(591, 397); await wait('karma'); }
  }
  await writeFile('docs/review/karma-soak-current.json', JSON.stringify({ environment: 'One desktop Chromium page, three real twelve-year journeys with rotation and replay; not an hours-long or physical-device test', samples, errors }, null, 2));
  assert.deepEqual(errors, []);
  // Counts vary with random content. Preserve measurements for review;
  // three short journeys cannot establish a memory-leak pass/fail threshold.
} finally { await browser.close(); }
