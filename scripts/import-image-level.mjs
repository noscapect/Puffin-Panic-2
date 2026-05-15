#!/usr/bin/env node
/**
 * Convert a PNG image into a Puffin Panic 2 level terrain map.
 *
 * Transparent pixels → empty (0), opaque pixels → solid (1).
 * Uses area-averaging so the full source image region for each
 * grid cell votes on solid/empty — much cleaner than nearest-neighbour
 * when downscaling a large illustration (e.g. 2784×1536 → 400×220).
 *
 * Usage:
 *   node scripts/import-image-level.mjs \
 *     --input  img/levels/level_30.png \
 *     --output levels/level_030.json \
 *     [--alpha 64]        alpha threshold 0-255 (default 64)
 *     [--name  "30: ..."] level name
 */

import { createReadStream, writeFileSync } from 'fs';
import { resolve, dirname, relative } from 'path';
import { fileURLToPath } from 'url';
import { PNG } from 'pngjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, '..');

const GRID_W = 400;
const GRID_H = 220;

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, v, i, a) => {
    if (v.startsWith('--')) acc.push([v.slice(2), a[i + 1] ?? true]);
    return acc;
  }, [])
);

const inputPath  = resolve(ROOT, args.input  ?? 'img/levels/level_30.png');
const outputPath = resolve(ROOT, args.output ?? 'levels/level_030.json');
const levelName  = args.name ?? '30: Forest (imported)';

// ── Decode PNG ────────────────────────────────────────────────────────────────
console.log(`Reading ${inputPath} …`);
const png = await new Promise((res, rej) =>
  createReadStream(inputPath)
    .pipe(new PNG({ filterType: 4 }))
    .on('parsed', function () { res(this); })
    .on('error', rej)
);

const { width: srcW, height: srcH, data } = png;
console.log(`Source: ${srcW}×${srcH}  →  Grid: ${GRID_W}×${GRID_H}`);

// ── Background detection ──────────────────────────────────────────────────────
// The PNG was exported with Photoshop's transparency checkerboard baked in:
//   dark tile ≈ (188,188,188)  light tile ≈ (254,254,254)
// Both are near-perfectly grayscale (saturation < 12) and either bright-white
// or mid-gray.  Real terrain (brown bark, coloured mushrooms, etc.) will be
// outside these very tight bands.
function isBackground(r, g, b) {
  const sat = Math.max(r, g, b) - Math.min(r, g, b);
  const bright = (r + g + b) / 3;
  if (sat > 18) return false;                      // has real colour → terrain
  if (bright > 240) return true;                   // near-white tile
  if (bright >= 175 && bright <= 210) return true;
  if (bright < 40 && sat < 20) return true; // AI background // dark-gray tile
  return false;
}

// ── Area-average downsample ───────────────────────────────────────────────────
// For each grid cell, count the fraction of source pixels that are NOT
// background (= solid terrain).  If the majority is solid, the cell is solid.
const cells = new Uint8Array(GRID_W * GRID_H);

for (let gy = 0; gy < GRID_H; gy++) {
  const y0 = (gy     / GRID_H * srcH) | 0;
  const y1 = Math.min(((gy + 1) / GRID_H * srcH + 0.5) | 0, srcH);

  for (let gx = 0; gx < GRID_W; gx++) {
    const x0 = (gx     / GRID_W * srcW) | 0;
    const x1 = Math.min(((gx + 1) / GRID_W * srcW + 0.5) | 0, srcW);

    let solid = 0, total = 0;
    for (let py = y0; py < y1; py++) {
      for (let px = x0; px < x1; px++) {
        const idx = (py * srcW + px) * 4;
        if (!isBackground(data[idx], data[idx + 1], data[idx + 2])) solid++;
        total++;
      }
    }
    // Use a 40% threshold: if >40% of source pixels are terrain, cell is solid.
    // This handles anti-aliased/blended edges gracefully.
    cells[gy * GRID_W + gx] = (total > 0 && solid / total > 0.40) ? 1 : 0;
  }
}

const solidCount = cells.reduce((s, v) => s + v, 0);
console.log(`Solid cells: ${solidCount} / ${GRID_W * GRID_H} (${(solidCount / (GRID_W * GRID_H) * 100).toFixed(1)}%)`);

// ── RLE encode ────────────────────────────────────────────────────────────────
const terrain = [];
let cur = cells[0], run = 1;
for (let i = 1; i < cells.length; i++) {
  if (cells[i] === cur) { run++; }
  else { terrain.push([cur, run]); cur = cells[i]; run = 1; }
}
terrain.push([cur, run]);

// ── Build level JSON ──────────────────────────────────────────────────────────
// imageSource is a web-root-relative path so the browser can fetch it
const imageSource = relative(ROOT, inputPath).replace(/\\/g, '/');

const level = {
  version: 1,
  name:     levelName,
  imageSource,
  total:    20,
  required: 18,
  spawnRate: 75,
  time:     9600,
  entrance: { x: 10, y: 10 },
  exit:     { x: 370, y: 200, w: 20, h: 12 },
  theme:    'fungus_glow',
  skills: {
    floater:   2,
    bomber:    2,
    blocker:   2,
    builder:   4,
    basher:    4,
    digger:    2,
    climber:   2,
    miner:     2,
    platformer: 0,
  },
  terrain,
};

writeFileSync(outputPath, JSON.stringify(level, null, 2));
console.log(`Written ${terrain.length} RLE pairs → ${outputPath}`);
console.log('Open the level editor and load the file to preview.');
