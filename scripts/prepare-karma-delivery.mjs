// Technical WebP re-encoding only: keep source dimensions, alpha and originals.
import { chromium } from '../games/karma-quest/node_modules/playwright/index.mjs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve('games/karma-quest/public/images');
const report = JSON.parse(await readFile('docs/review/karma-performance-after.json', 'utf8'));
const names = report.runs[0].images.map(item => item.name).filter(name => name.endsWith('.webp'));
names.push(...['mage_stone', 'merchant_monster', 'outlaw_gold'].map(id => `kq-outcome-${id}-accept-v2.webp`));
await mkdir(resolve(root, 'delivery'), { recursive: true });
const browser = await chromium.launch();
const results = [];
try {
  const page = await browser.newPage();
  for (const name of names) {
    const source = await readFile(resolve(root, name));
    const result = await page.evaluate(async base64 => {
      const original = new Image(); original.src = `data:image/webp;base64,${base64}`; await original.decode();
      const canvas = document.createElement('canvas'); canvas.width = original.width; canvas.height = original.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.drawImage(original, 0, 0);
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      for (const quality of [0.9, 0.94, 0.97, 1]) {
        ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(original, 0, 0);
        const data = canvas.toDataURL('image/webp', quality);
        const encoded = new Image(); encoded.src = data; await encoded.decode();
        ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(encoded, 0, 0);
        const actual = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let squared = 0, count = 0, alphaChanges = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          if (pixels[i + 3] !== actual[i + 3]) alphaChanges++;
          if (pixels[i + 3] < 250) continue;
          for (let c = 0; c < 3; c++) { squared += (pixels[i + c] - actual[i + c]) ** 2; count++; }
        }
        const psnr = squared ? 10 * Math.log10(255 ** 2 / (squared / count)) : 100;
        if (alphaChanges) throw new Error('Alpha changed');
        if (psnr >= 36) return { data: data.split(',')[1], quality, psnr, width: canvas.width, height: canvas.height, alphaChanges };
      }
      throw new Error('Quality threshold not met');
    }, source.toString('base64'));
    const output = Buffer.from(result.data, 'base64');
    const useSource = output.length >= source.length;
    await writeFile(resolve(root, 'delivery', name), useSource ? source : output);
    const { data, ...metrics } = result;
    results.push({ name, ...metrics, originalBytes: source.length, deliveredBytes: useSource ? source.length : output.length, usedOriginal: useSource });
    console.log(`${name}: ${source.length} -> ${results.at(-1).deliveredBytes}, PSNR ${result.psnr.toFixed(1)} dB`);
  }
  await writeFile('docs/review/karma-delivery-encoding.json', JSON.stringify({ method: 'Chromium WebP re-encoding; unchanged dimensions and alpha; opaque RGB PSNR >= 36 dB, visual review additionally required', results }, null, 2));
} finally { await browser.close(); }
