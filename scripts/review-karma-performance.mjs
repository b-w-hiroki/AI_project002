import { chromium } from '../games/karma-quest/node_modules/playwright/index.mjs';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const label = process.argv[2] ?? 'current';
if (!/^[a-z-]+$/.test(label)) throw new Error('Use a simple report label');
const browser = await chromium.launch();
const runs = [];
try {
  for (let run = 0; run < 3; run++) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await page.route(/\/src\/main\.ts(?:\?.*)?$/, async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: `${await response.text()}\nwindow.__qaGame = game;` });
    });
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await page.goto('http://localhost:15177');
    await page.waitForFunction(() => window.__qaGame?.scene.getScene('GameScene').sys.isActive());
    runs.push(await page.evaluate(() => {
      const resources = performance.getEntriesByType('resource').filter(r => r.name.includes('/images/'));
      const textures = Object.values(window.__qaGame.textures.list).map(texture => {
        const source = texture.getSourceImage();
        return { key: texture.key, width: source.width, height: source.height };
      });
      return {
        readyObservedMs: Math.round(performance.now()), imageRequests: resources.length,
        imageEncodedBytes: resources.reduce((n, r) => n + r.encodedBodySize, 0),
        estimatedTextureRGBABytes: textures.reduce((n, t) => n + (t.width * t.height * 4 || 0), 0),
        images: resources.map(r => ({ name: r.name.split('/').at(-1), bytes: r.encodedBodySize })),
      };
    }));
    await context.close();
  }
  const report = { environment: 'Local Vite, desktop Chromium, 390x844, cache disabled; not mobile/network benchmark', runs };
  await writeFile(resolve(`docs/review/karma-performance-${label}.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(runs.map(({ images, ...metrics }) => metrics)));
} finally { await browser.close(); }
