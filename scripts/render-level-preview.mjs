#!/usr/bin/env node
/**
 * Render a fast static PNG preview of a level JSON.
 *
 * This is a composition tool, not a runtime screenshot. It helps level design
 * review spacing, silhouettes, props, entrances, exits, and obvious clutter
 * without opening the browser.
 *
 * Usage:
 *   node scripts/render-level-preview.mjs --file levels/level_012.json
 *   node scripts/render-level-preview.mjs --campaign
 */

import fs from 'fs';
import path from 'path';
import { PNG } from 'pngjs';

const W = 400;
const H = 220;
const SCALE = 3;

const TERRAIN_PIECES = {
  dirt_tiny: { w: 8, h: 8, val: 1 },
  dirt_small: { w: 16, h: 16, val: 1 },
  dirt_block: { w: 32, h: 32, val: 1 },
  dirt_slab: { w: 64, h: 16, val: 1 },
  dirt_slab_long: { w: 128, h: 16, val: 1 },
  dirt_pillar: { w: 16, h: 64, val: 1 },
  dirt_column: { w: 32, h: 128, val: 1 },
  dirt_huge: { w: 128, h: 128, val: 1 },
  dirt_floor: { w: 420, h: 32, val: 1 },
  step_small: { w: 16, h: 8, val: 1 },
  step_large: { w: 32, h: 16, val: 1 },
  steel_plate: { w: 16, h: 32, val: 10 },
  steel_plate_h: { w: 32, h: 16, val: 10 },
  steel_block: { w: 32, h: 32, val: 10 },
  steel_pillar: { w: 16, h: 64, val: 10 },
  steel_column: { w: 32, h: 128, val: 10 },
  steel_huge: { w: 64, h: 64, val: 10 },
  steel_floor: { w: 420, h: 16, val: 10 },
  bridge_wood: { w: 48, h: 8, val: 1 },
};

const THEMES = {
  grass: { sky: [33, 49, 56], terrain: [112, 82, 48], surface: [88, 154, 72], accent: [125, 211, 92] },
  mossy_ruin: { sky: [22, 34, 32], terrain: [82, 92, 82], surface: [92, 132, 84], accent: [133, 203, 120] },
  fungus_glow: { sky: [20, 27, 36], terrain: [64, 92, 78], surface: [106, 178, 138], accent: [91, 245, 190] },
  rock: { sky: [30, 34, 42], terrain: [70, 70, 72], surface: [138, 138, 140], accent: [205, 212, 220] },
  cave: { sky: [18, 20, 25], terrain: [45, 45, 50], surface: [92, 92, 100], accent: [117, 220, 255] },
  ice: { sky: [18, 38, 58], terrain: [70, 130, 180], surface: [173, 216, 230], accent: [225, 250, 255] },
  crystal: { sky: [35, 28, 48], terrain: [148, 103, 189], surface: [224, 176, 255], accent: [111, 239, 255] },
  mud: { sky: [26, 28, 25], terrain: [60, 45, 25], surface: [90, 70, 40], accent: [158, 124, 72] },
  snow: { sky: [35, 45, 58], terrain: [112, 128, 144], surface: [255, 250, 250], accent: [190, 230, 255] },
};

function main() {
  const args = process.argv.slice(2);
  const fileIdx = args.indexOf('--file');
  const campaign = args.includes('--campaign') || fileIdx === -1;
  const files = campaign ? campaignFiles() : [args[fileIdx + 1]];
  for (const rel of files) renderPreview(rel);
}

function campaignFiles() {
  const manifest = JSON.parse(fs.readFileSync('levels/manifest.json', 'utf8'));
  return manifest.levels.map(file => path.join('levels', file));
}

function renderPreview(relFile) {
  const level = JSON.parse(fs.readFileSync(relFile, 'utf8'));
  const outDir = path.join('docs', 'level-previews');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${path.basename(relFile, '.json')}.png`);

  const grid = materialize(level);
  const theme = THEMES[level.theme] || THEMES.grass;
  const png = new PNG({ width: W * SCALE, height: H * SCALE });

  drawBackground(png, theme);
  drawTerrain(png, grid, theme);
  drawProps(png, level.props || [], theme);
  drawEntrance(png, level.entrance);
  drawExit(png, level.exit);
  drawBorder(png, [255, 255, 255, 36]);

  fs.writeFileSync(outFile, PNG.sync.write(png));
  console.log(`Rendered ${outFile}`);
}

function materialize(level) {
  const grid = decodeRLE(level.terrain);
  for (const obj of level.objects || []) {
    const piece = TERRAIN_PIECES[obj.type];
    if (!piece) continue;
    for (let y = 0; y < piece.h; y++) {
      for (let x = 0; x < piece.w; x++) {
        setCell(grid, obj.x + x, obj.y + y, piece.val);
      }
    }
  }
  return grid;
}

function decodeRLE(rle) {
  const grid = new Uint8Array(W * H);
  if (!Array.isArray(rle)) return grid;
  let offset = 0;
  for (const pair of rle) {
    const val = Number(pair?.[0]) || 0;
    const count = Number(pair?.[1]) || 0;
    for (let i = 0; i < count && offset < grid.length; i++) grid[offset++] = val;
  }
  return grid;
}

function drawBackground(png, theme) {
  for (let y = 0; y < H; y++) {
    const t = y / H;
    const r = lerp(theme.sky[0], 8, t * 0.45);
    const g = lerp(theme.sky[1], 14, t * 0.45);
    const b = lerp(theme.sky[2], 18, t * 0.45);
    fillRect(png, 0, y, W, 1, [r, g, b, 255]);
  }
  for (let x = 0; x < W; x += 24) {
    const h = 28 + ((x * 17) % 42);
    fillRect(png, x, H - h, 8, h, [theme.sky[0] + 4, theme.sky[1] + 8, theme.sky[2] + 5, 70]);
  }
}

function drawTerrain(png, grid, theme) {
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v = grid[y * W + x];
      if (!v) continue;
      const top = y === 0 || grid[(y - 1) * W + x] === 0;
      const left = x === 0 || grid[y * W + x - 1] === 0;
      const right = x === W - 1 || grid[y * W + x + 1] === 0;
      let color = v === 10 ? [124, 100, 82] : theme.terrain;
      if (top) color = v === 10 ? [174, 150, 122] : theme.surface;
      else if (left || right) color = mix(color, [0, 0, 0], 0.18);
      if (((x * 13 + y * 7) % 29) === 0) color = mix(color, [255, 255, 255], 0.06);
      setScaled(png, x, y, [...color, 255]);
    }
  }
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      if (grid[y * W + x] && !grid[(y - 1) * W + x]) {
        setScaled(png, x, y - 1, [...theme.accent, 110]);
      }
    }
  }
}

function drawProps(png, props, theme) {
  for (const prop of props) {
    if (prop.type === 'rope') {
      line(png, prop.x1, prop.y1 - 3, (prop.x1 + prop.x2) / 2, Math.max(prop.y1, prop.y2) + (prop.sag || 8), [120, 92, 54, 220]);
      line(png, (prop.x1 + prop.x2) / 2, Math.max(prop.y1, prop.y2) + (prop.sag || 8), prop.x2, prop.y2 - 3, [120, 92, 54, 220]);
    } else if (prop.type === 'lantern') {
      circle(png, prop.x, prop.y - 18, prop.radius || 12, [255, 210, 92, 48]);
      fillRect(png, prop.x - 2, prop.y - 18, 4, 7, [240, 184, 78, 255]);
    } else if (prop.type === 'mushroomCluster') {
      const count = prop.count || 3;
      for (let i = 0; i < count; i++) {
        const x = prop.x + i * 5;
        const y = prop.y - 5 - (i % 2) * 3;
        fillRect(png, x, y, 2, 7, [212, 206, 184, 230]);
        circle(png, x + 1, y - 1, 4, prop.glow ? theme.accent : [188, 92, 126, 220]);
      }
    } else if (prop.type === 'grassPatch' || prop.type === 'reeds') {
      const count = prop.count || 5;
      const c = prop.color ? hex(prop.color) : theme.accent;
      for (let i = 0; i < count; i++) {
        const x = prop.x + i * 4;
        line(png, x, prop.y, x + ((i % 3) - 1) * 2, prop.y - 8 - (i % 4), [...c, 210]);
      }
    } else if (prop.type === 'crystalCluster') {
      const scale = prop.scale || 1;
      const c = prop.color === 'violet' ? [204, 146, 255] : prop.color === 'cyan' ? [115, 235, 255] : theme.accent;
      for (let i = 0; i < 4; i++) {
        const x = prop.x + i * 5 * scale;
        const h = (10 + (i % 3) * 5) * scale;
        line(png, x, prop.y, x + 2 * scale, prop.y - h, [...c, 220]);
        line(png, x + 4 * scale, prop.y, x + 2 * scale, prop.y - h, [...c, 220]);
        line(png, x, prop.y, x + 4 * scale, prop.y, [...c, 170]);
      }
    }
  }
}

function drawEntrance(png, entrance) {
  fillRect(png, entrance.x - 9, entrance.y - 14, 18, 14, [48, 64, 86, 255]);
  fillRect(png, entrance.x - 6, entrance.y - 10, 12, 8, [125, 220, 255, 220]);
}

function drawExit(png, exit) {
  fillRect(png, exit.x - 2, exit.y - 6, exit.w + 4, exit.h + 6, [64, 86, 58, 255]);
  fillRect(png, exit.x + 2, exit.y - 2, exit.w - 4, exit.h, [128, 255, 150, 230]);
}

function drawBorder(png, color) {
  fillRect(png, 0, 0, W, 1, color);
  fillRect(png, 0, H - 1, W, 1, color);
  fillRect(png, 0, 0, 1, H, color);
  fillRect(png, W - 1, 0, 1, H, color);
}

function setCell(grid, x, y, val) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  grid[y * W + x] = val;
}

function fillRect(png, x, y, w, h, color) {
  for (let yy = Math.floor(y); yy < Math.floor(y + h); yy++) {
    for (let xx = Math.floor(x); xx < Math.floor(x + w); xx++) setScaled(png, xx, yy, color);
  }
}

function circle(png, cx, cy, r, color) {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r * r) setScaled(png, x, y, color);
    }
  }
}

function line(png, x1, y1, x2, y2, color) {
  const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1), 1);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    setScaled(png, Math.round(lerp(x1, x2, t)), Math.round(lerp(y1, y2, t)), color);
  }
}

function setScaled(png, x, y, color) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  for (let yy = 0; yy < SCALE; yy++) {
    for (let xx = 0; xx < SCALE; xx++) {
      const px = x * SCALE + xx;
      const py = y * SCALE + yy;
      const idx = (py * png.width + px) * 4;
      const a = (color[3] ?? 255) / 255;
      png.data[idx] = Math.round(color[0] * a + png.data[idx] * (1 - a));
      png.data[idx + 1] = Math.round(color[1] * a + png.data[idx + 1] * (1 - a));
      png.data[idx + 2] = Math.round(color[2] * a + png.data[idx + 2] * (1 - a));
      png.data[idx + 3] = 255;
    }
  }
}

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function mix(a, b, t) {
  return [
    lerp(a[0], b[0], t),
    lerp(a[1], b[1], t),
    lerp(a[2], b[2], t),
  ];
}

function hex(value) {
  const m = /^#?([0-9a-f]{6})$/i.exec(value || '');
  if (!m) return [120, 190, 100];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

main();
