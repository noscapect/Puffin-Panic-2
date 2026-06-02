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
function isBackground(r, g, b, a) {
  if (a < 128) return true; // Master rule: use PNG alpha if available
  
  const sat = Math.max(r, g, b) - Math.min(r, g, b);
  const bright = (r + g + b) / 3;
  
  // High saturation = likely terrain (green vines, brown bark, etc.)
  if (sat > 25) return false;
  
  // Narrower, more conservative background bands
  if (sat < 15) {
    if (bright > 235) return true; // Near-white
    if (bright < 35) return true;  // Near-black
    if (bright >= 175 && bright <= 210) return true; // Common light-gray checkerboard
  }
  
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
        if (!isBackground(data[idx], data[idx + 1], data[idx + 2], data[idx + 3])) solid++;
        total++;
      }
    }
    // Conservative threshold: if 35% is solid, treat cell as solid. Prevents holes.
    cells[gy * GRID_W + gx] = (total > 0 && solid / total > 0.35) ? 1 : 0;
  }
}

// ── Refinement Passes ─────────────────────────────────────────────────────────
const cleanCells = new Uint8Array(cells);

// Pass 1: Filling Pass (close small holes in floors/walls)
for (let y = 1; y < GRID_H - 1; y++) {
  for (let x = 1; x < GRID_W - 1; x++) {
    if (cells[y * GRID_W + x] === 0) {
      let neighbors = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (cells[(y + dy) * GRID_W + (x + dx)] === 1) neighbors++;
        }
      }
      // If 6/8 neighbors are solid, this is likely a hole in a wall/floor. Fill it.
      if (neighbors >= 6) cleanCells[y * GRID_W + x] = 1;
    }
  }
}

// Pass 2: Denoise Pass (remove small floating specks in the air)
const finalCells = new Uint8Array(cleanCells);
for (let y = 1; y < GRID_H - 1; y++) {
  for (let x = 1; x < GRID_W - 1; x++) {
    if (cleanCells[y * GRID_W + x] === 1) {
      let neighbors = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (cleanCells[(y + dy) * GRID_W + (x + dx)] === 1) neighbors++;
        }
      }
      if (neighbors < 3) finalCells[y * GRID_W + x] = 0;
    }
  }
}

const solidCount = cells.reduce((s, v) => s + v, 0);
console.log(`Solid cells: ${solidCount} / ${GRID_W * GRID_H} (${(solidCount / (GRID_W * GRID_H) * 100).toFixed(1)}%)`);

// ── RLE encode ────────────────────────────────────────────────────────────────
const terrain = [];
let cur = finalCells[0], run = 1;
for (let i = 1; i < finalCells.length; i++) {
  if (finalCells[i] === cur) { run++; }
  else { terrain.push([cur, run]); cur = finalCells[i]; run = 1; }
}
terrain.push([cur, run]);

// ── Build level JSON ──────────────────────────────────────────────────────────
// imageSource is a web-root-relative path so the browser can fetch it
const imageSource = relative(ROOT, inputPath).replace(/\\/g, '/');

// ── Auto-Detect Entrance and Exit ───────────────────────────────────────────────
let entX = 30, entY = 50;
let extX = 350, extY = 150;

// Find entrance: scan left side (x=20..150), top to bottom, looking for a flat landing spot
let foundEnt = false;
for (let y = 10; y < GRID_H - 20 && !foundEnt; y++) {
  for (let x = 20; x < 150; x++) {
    if (finalCells[y * GRID_W + x] === 1) {
      // Check if there is air above
      let airAbove = true;
      for (let dy = 1; dy <= 20; dy++) {
         if (finalCells[(y - dy) * GRID_W + x] === 1) airAbove = false;
      }
      if (airAbove) {
         entX = x;
         entY = y - 20; // drop puffins from 20px above
         foundEnt = true;
         break;
      }
    }
  }
}

// Find exit: scan right side (x=250..370), bottom to top, looking for 20px flat ground
let foundExt = false;
for (let y = GRID_H - 5; y >= 20 && !foundExt; y--) {
  for (let x = 370; x >= 250; x--) {
    if (finalCells[y * GRID_W + x] === 1) {
       // Check for 20px flat ground
       let flat = true;
       for (let dx = 0; dx < 20; dx++) {
          if (finalCells[y * GRID_W + (x + dx)] === 0) flat = false;
          // check air above
          for(let dy=1; dy<=12; dy++) {
             if (finalCells[(y - dy) * GRID_W + (x + dx)] === 1) flat = false;
          }
       }
       if (flat) {
          extX = x;
          extY = y - 12; // exit stands on the floor
          foundExt = true;
          break;
       }
    }
  }
}

const level = {
  version: 1,
  name:     levelName,
  imageSource,
  total:    20,
  required: 18,
  spawnRate: 75,
  time:     9600,
  entrance: { x: entX, y: entY },
  exit:     { x: extX, y: extY, w: 20, h: 12 },
  theme:    'fungus_glow',
  skills: {
    floater:   5,
    bomber:    5,
    blocker:   5,
    builder:   10,
    basher:    10,
    digger:    5,
    climber:   5,
    miner:     5,
    platformer: 5,
  },
  terrain,
};

writeFileSync(outputPath, JSON.stringify(level, null, 2));
console.log(`Written ${terrain.length} RLE pairs → ${outputPath}`);
console.log('Open the level editor and load the file to preview.');
