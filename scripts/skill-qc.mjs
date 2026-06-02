#!/usr/bin/env node
/**
 * Dynamic skill quality checks for authored levels.
 *
 * This is intentionally narrower than a full solver. It verifies failure modes
 * the static verifier cannot see, starting with Basher passages:
 * - find the first wall a right-walking puffin reaches
 * - simulate the basher's terrain mask through that obstruction
 * - fail if unsupported/residual terrain remains above the carved tunnel
 * - fail if the crowd cannot walk to the exit after the tunnel is opened
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const GRID_W = 400;
const GRID_H = 220;
const PUFFIN_W = 8;
const PUFFIN_H = 12;
const PUFFIN_CENTER_X = PUFFIN_W / 2;
const PUFFIN_CENTER_Y = PUFFIN_H / 2;
const MAX_STEP = 6;
const FALL_DEATH_DIST = 70;
const SAND_THEMES = new Set(['desert', 'sandstone', 'mud', 'toxic_sludge']);

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

const MASK_BASH = [];
for (let y = -7; y <= 6; y++) {
  for (let x = -4; x <= 5; x++) {
    if (x === 5 && (y < -4 || y > 4)) continue;
    if (x === 4 && (y < -5 || y > 5)) continue;
    MASK_BASH.push({ x, y });
  }
}

function decodeRLE(rle) {
  const grid = new Uint8Array(GRID_W * GRID_H);
  if (!Array.isArray(rle)) return grid;
  let offset = 0;
  for (const pair of rle) {
    if (!Array.isArray(pair) || pair.length < 2) continue;
    const val = Number(pair[0]) || 0;
    const count = Number(pair[1]) || 0;
    for (let i = 0; i < count && offset < grid.length; i++) {
      grid[offset++] = val;
    }
  }
  return grid;
}

function stampObjects(grid, objects) {
  if (!Array.isArray(objects)) return;
  for (const obj of objects) {
    const piece = TERRAIN_PIECES[obj.type];
    if (!piece) continue;
    for (let y = 0; y < piece.h; y++) {
      for (let x = 0; x < piece.w; x++) {
        const tx = obj.x + x;
        const ty = obj.y + y;
        if (tx >= 0 && tx < GRID_W && ty >= 0 && ty < GRID_H) {
          grid[ty * GRID_W + tx] = piece.val;
        }
      }
    }
  }
}

function isSolid(grid, x, y) {
  x = Math.floor(x);
  y = Math.floor(y);
  if (x < 0 || x >= GRID_W || y < 0 || y >= GRID_H) return false;
  return grid[y * GRID_W + x] !== 0;
}

function canDigAt(grid, x, y, dir) {
  x = Math.floor(x);
  y = Math.floor(y);
  if (x < 0 || x >= GRID_W || y < 0 || y >= GRID_H) return false;
  const val = grid[y * GRID_W + x];
  if (val === 1) return true;
  if (val === 11) return dir > 0;
  if (val === 12) return dir < 0;
  return false;
}

function setTerrain(grid, x, y, val) {
  x = Math.floor(x);
  y = Math.floor(y);
  if (x < 0 || x >= GRID_W || y < 0 || y >= GRID_H) return;
  grid[y * GRID_W + x] = val;
}

function landPuffinTop(grid, startX, startY) {
  let topY = Math.floor(startY);
  let fall = 0;
  while (topY + PUFFIN_H + 1 < GRID_H && !isSolid(grid, startX, topY + PUFFIN_H + 1)) {
    topY++;
    fall++;
  }
  return { x: Math.floor(startX), y: topY, fall };
}

function stepWalker(grid, state) {
  let { x, y, vx } = state;
  if (!isSolid(grid, Math.floor(x + PUFFIN_CENTER_X), Math.floor(y + PUFFIN_H + 1))) {
    let fall = 0;
    while (y + PUFFIN_H + 1 < GRID_H && !isSolid(grid, Math.floor(x + PUFFIN_CENTER_X), Math.floor(y + PUFFIN_H + 1))) {
      y++;
      fall++;
      if (fall > FALL_DEATH_DIST) return { ...state, dead: true };
    }
    return { x, y, vx };
  }

  const nextX = x + vx;
  if (nextX < 0 || nextX > GRID_W - PUFFIN_W) return { x, y, vx: -vx };

  const centerX = Math.floor(nextX + PUFFIN_CENTER_X);
  const currentFootY = Math.floor(y + PUFFIN_H);
  let isWall = false;
  for (let dy = MAX_STEP + 1; dy <= PUFFIN_H - 1; dy++) {
    if (isSolid(grid, centerX, currentFootY - dy)) {
      isWall = true;
      break;
    }
  }
  if (isWall) return { x, y, vx, wall: true };

  let stepY = null;
  for (let dy = MAX_STEP; dy >= 0; dy--) {
    if (isSolid(grid, centerX, currentFootY - dy)) {
      stepY = currentFootY - dy;
      break;
    }
  }

  x = nextX;
  if (stepY !== null) {
    y = stepY - PUFFIN_H - 1;
  } else if (!isSolid(grid, centerX, currentFootY + 1)) {
    let fall = 0;
    while (y + PUFFIN_H + 1 < GRID_H && !isSolid(grid, centerX, y + PUFFIN_H + 1)) {
      y++;
      fall++;
      if (fall > FALL_DEATH_DIST) return { x, y, vx, dead: true };
    }
  }
  return { x, y, vx };
}

function findFirstWall(grid, level) {
  let state = { ...landPuffinTop(grid, level.entrance.x, level.entrance.y), vx: 1 };
  for (let i = 0; i < 1200; i++) {
    const next = stepWalker(grid, state);
    if (next.dead) return null;
    if (next.wall) return state;
    state = next;
  }
  return null;
}

function simulateBasher(grid, startState) {
  const dir = startState.vx;
  let x = startState.x;
  const y = startState.y;
  const cleared = [];
  let carvedAny = false;

  for (let step = 0; step < 220; step++) {
    x += dir;
    let carved = false;
    const cx = Math.floor(x + (dir > 0 ? PUFFIN_W : 0));
    const cy = Math.floor(y + PUFFIN_CENTER_Y);

    for (const pt of MASK_BASH) {
      const tx = cx + pt.x * dir;
      const ty = cy + pt.y;
      if (canDigAt(grid, tx, ty, dir)) {
        setTerrain(grid, tx, ty, 0);
        cleared.push({ x: tx, y: ty });
        carved = true;
        carvedAny = true;
      }
    }

    if (!carved && carvedAny) {
      return { endState: { x, y, vx: dir }, cleared };
    }
  }

  return { endState: { x, y, vx: dir }, cleared };
}

function findOverheadRisks(grid, cleared) {
  const risks = new Set();
  for (const cell of cleared) {
    for (let y = cell.y - 1; y >= Math.max(0, cell.y - 4); y--) {
      if (isSolid(grid, cell.x, y)) {
        risks.add(`${cell.x},${y}`);
      }
    }
  }
  return [...risks].map(key => {
    const [x, y] = key.split(',').map(Number);
    return { x, y };
  });
}

function crowdCanReachExit(grid, level) {
  const start = landPuffinTop(grid, level.entrance.x, level.entrance.y);
  const queue = [{ x: start.x, y: start.y, vx: 1 }];
  const visited = new Set([`${start.x},${start.y},1`]);
  const exit = level.exit;
  let lastWall = null;

  for (let i = 0; queue.length > 0 && i < 80000; i++) {
    const state = queue.shift();
    if (
      state.x + PUFFIN_CENTER_X >= exit.x &&
      state.x + PUFFIN_CENTER_X < exit.x + exit.w &&
      state.y + PUFFIN_CENTER_Y >= exit.y &&
      state.y + PUFFIN_CENTER_Y < exit.y + exit.h
    ) {
      return { reachable: true, lastWall };
    }

    const next = stepWalker(grid, state);
    if (next.wall) lastWall = { x: Math.round(state.x), y: Math.round(state.y), vx: state.vx };
    const candidates = next.wall
      ? [{ x: state.x, y: state.y, vx: -state.vx }]
      : [next];
    for (const c of candidates) {
      if (c.dead) continue;
      const key = `${Math.round(c.x)},${Math.round(c.y)},${c.vx}`;
      if (!visited.has(key)) {
        visited.add(key);
        queue.push(c);
      }
    }
  }
  return { reachable: false, lastWall };
}

function analyzeBasher(level, grid) {
  const errors = [];
  const start = findFirstWall(grid, level);
  if (!start) {
    errors.push('No reachable wall found for the first right-walking basher.');
    return errors;
  }

  const { cleared } = simulateBasher(grid, start);
  if (cleared.length === 0) {
    errors.push('Basher did not clear any terrain at the first wall.');
    return errors;
  }

  const overheadRisks = SAND_THEMES.has(level.theme) ? findOverheadRisks(grid, cleared) : [];
  if (overheadRisks.length > 0) {
    const sample = overheadRisks.slice(0, 8).map(p => `(${p.x},${p.y})`).join(', ');
    errors.push(`Residual terrain remains above the bashed tunnel: ${sample}${overheadRisks.length > 8 ? '...' : ''}`);
  }

  const crowdRoute = crowdCanReachExit(grid, level);
  if (!crowdRoute.reachable) {
    const wallNote = crowdRoute.lastWall
      ? ` Last wall contact after bashing: (${crowdRoute.lastWall.x},${crowdRoute.lastWall.y}), dir ${crowdRoute.lastWall.vx}.`
      : '';
    errors.push(`Crowd route to exit is still blocked after simulated basher tunnel.${wallNote}`);
  }

  return errors;
}

function main() {
  const args = process.argv.slice(2);
  const fileIdx = args.indexOf('--file');
  const skillIdx = args.indexOf('--skill');
  if (fileIdx === -1) {
    console.error('Usage: node scripts/skill-qc.mjs --file levels/level_005.json --skill basher');
    process.exit(1);
  }
  const skill = skillIdx === -1 ? 'basher' : args[skillIdx + 1];
  if (skill !== 'basher') {
    console.error(`Unsupported skill QC: ${skill}`);
    process.exit(1);
  }

  const filePath = resolve(ROOT, args[fileIdx + 1]);
  const level = JSON.parse(readFileSync(filePath, 'utf8'));
  const grid = decodeRLE(level.terrain);
  stampObjects(grid, level.objects);

  const errors = analyzeBasher(level, grid);
  console.log(`Skill QC: ${level.name}`);
  console.log(`Skill: ${skill}`);
  if (errors.length > 0) {
    console.log('\x1b[31m[FAIL]\x1b[0m dynamic skill route');
    for (const error of errors) console.log(`       - ${error}`);
    process.exit(1);
  }
  console.log('\x1b[32m[PASS]\x1b[0m dynamic skill route');
}

main();
