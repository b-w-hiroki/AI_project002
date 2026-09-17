import { chromium } from '../games/karma-quest/node_modules/playwright/index.mjs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const data = async (path, mime = 'image/png') => `data:${mime};base64,${(await readFile(resolve(path))).toString('base64')}`;
const mock = await data('docs/review/karma-visual-mock.jpg', 'image/jpeg');
const current = await data('games/karma-quest/e2e/game.spec.ts-snapshots/karma-title-mock-win32.png');
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 940, height: 1060 }, deviceScaleFactor: 1 });
  await page.setContent(`<style>
    *{box-sizing:border-box}body{margin:0;background:#091724;color:#f7e4bb;font:18px sans-serif;padding:12px}
    main{display:flex;gap:16px}section{width:450px}h2{font-size:20px;margin:8px 0 16px}
    .reference{width:450px;height:945px;overflow:hidden;position:relative}
    .reference img{position:absolute;width:1894px;max-width:none;left:-12px;top:-300px}
    .actual{width:450px;display:block}p{font-size:14px;color:#ded8c8;line-height:1.6}
  </style><main><section><h2>正式モック：王都ホーム</h2><div class="reference"><img src="${mock}"></div></section>
  <section><h2>実装：450 × 800</h2><img class="actual" src="${current}"><p>同じ画面幅で比較。縦横比は各画像のまま保持。<br>人物を左手前、主文を右上に配置。HUDと依頼カードを整理。</p></section></main>`);
  await page.locator('img').evaluateAll(images => Promise.all(images.map(img => img.decode())));
  await page.screenshot({ path: resolve('docs/review/karma-home-comparison.png') });
} finally { await browser.close(); }
