import { chromium } from '../games/karma-quest/node_modules/playwright/index.mjs';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const label = process.argv[2] ?? 'current';
const networkMbps = Number(process.argv[3] ?? 0);
const baseUrl = process.argv[4] ?? 'http://localhost:15177';
if (!Number.isFinite(networkMbps) || networkMbps < 0) throw new Error('Invalid network speed');
if (!/^[a-z-]+$/.test(label)) throw new Error('Use a simple report label');
const browser = await chromium.launch();
const runs = [];
try {
  for (let run = 0; run < 3; run++) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await page.route(/(?:\/src\/main\.ts(?:\?.*)?|\/assets\/index-[^/]+\.js)$/, async route => {
      const response = await route.fetch();
      let body = await response.text();
      if (route.request().url().includes('/assets/')) {
        const constructors = body.match(/new [\w$]+\.Game\(/g) ?? [];
        if (constructors.length !== 1) throw new Error('Cannot instrument compiled game constructor');
        body = body.replace(/new ([\w$]+)\.Game\(/, 'window.__qaGame = new $1.Game(');
      } else body += '\nwindow.__qaGame = game;';
      await route.fulfill({ response, body });
    });
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    if (networkMbps) await cdp.send('Network.emulateNetworkConditions', {
      offline: false, latency: 100, downloadThroughput: networkMbps * 125000,
      uploadThroughput: networkMbps * 125000,
    });
    await page.goto(baseUrl, { timeout: 180000 });
    await page.waitForFunction(() => window.__qaGame?.scene.getScene('GameScene').sys.isActive(), null, { timeout: 180000 });
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
  const report = { environment: 'Desktop Chromium, 390x844, cache disabled; not a physical-device benchmark', baseUrl, build: baseUrl.endsWith(':15178') ? 'production preview' : 'development Vite', network: networkMbps ? { simulatedMbps: networkMbps, latencyMs: 100 } : 'unthrottled local', runs };
  await writeFile(resolve(`docs/review/karma-performance-${label}.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(runs.map(({ images, ...metrics }) => metrics)));
} finally { await browser.close(); }
