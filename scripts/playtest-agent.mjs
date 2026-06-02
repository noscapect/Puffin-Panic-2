#!/usr/bin/env node
/**
 * Puffin Panic 2 AI playtester.
 *
 * This is a deterministic geometry agent, not a full browser/runtime bot. It
 * materializes level terrain, explores walking/falling states, applies a small
 * set of skill templates at reachable moments, and reports whether it can find
 * a plausible crowd route to the exit.
 *
 * Usage:
 *   node scripts/playtest-agent.mjs --campaign
 *   node scripts/playtest-agent.mjs --file levels/level_005.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const GRID_W = 400;
const GRID_H = 220;
const PUFFIN_W = 8;
const PUFFIN_H = 12;
const CENTER_X = PUFFIN_W / 2;
const CENTER_Y = PUFFIN_H / 2;
const MAX_STEP = 6;
const FALL_DEATH_DIST = 70;

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

const MASK_DIG = [];
for (let y = 0; y <= 3; y++) {
  for (let x = -4; x <= 4; x++) {
    if (Math.abs(x) === 4 && y === 3) continue;
    MASK_DIG.push({ x, y });
  }
}

const MASK_MINE = [];
for (let y = 0; y <= 4; y++) {
  for (let x = 0; x <= 5; x++) {
    if (x === 5 && (y === 0 || y === 4)) continue;
    MASK_MINE.push({ x, y });
  }
}

const MASK_CRATER = [];
for (let y = -18; y <= 18; y++) {
  for (let x = -18; x <= 18; x++) {
    if (x * x + y * y <= 18 * 18) MASK_CRATER.push({ x, y });
  }
}

function main() {
  const args = process.argv.slice(2);
  const fileIdx = args.indexOf('--file');
  const campaign = args.includes('--campaign') || fileIdx === -1;
  const verbose = args.includes('--verbose');
  const files = campaign ? campaignFiles() : [args[fileIdx + 1]];

  let failed = 0;
  console.log('AI Playtester');
  for (const relFile of files) {
    const result = playtestFile(relFile, { verbose });
    const mark = result.pass ? '\x1b[32m[PASS]\x1b[0m' : '\x1b[31m[FAIL]\x1b[0m';
    console.log(`${mark} ${path.basename(relFile)} - ${result.level.name}`);
    console.log(`       ${result.reason}`);
    if (result.plan.length) {
      console.log(`       plan: ${result.plan.map(formatStep).join(' -> ')}`);
    }
    if (result.notes.length) {
      for (const note of result.notes) console.log(`       note: ${note}`);
    }
    if (!result.pass) failed++;
  }

  if (failed) {
    console.log(`\n${failed} level(s) need human review or stronger playtester templates.`);
    process.exit(1);
  }
  console.log('\nAll tested levels produced plausible AI playtest routes.');
}

function campaignFiles() {
  const manifestPath = path.join(ROOT, 'levels', 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  return manifest.levels.map(file => path.join('levels', file));
}

function playtestFile(relFile, options) {
  const filePath = path.resolve(ROOT, relFile);
  const level = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const baseGrid = materializeLevel(level);
  const notes = [];

  const direct = crowdCanReachExit(baseGrid, level, { floater: false, initialDirs: [1] });
  if (direct.reachable) {
    return pass(level, 'standard walking/falling reaches the exit', [], notes);
  }

  if ((level.skills?.floater || 0) >= level.required) {
    const floaterRoute = crowdCanReachExit(baseGrid, level, { floater: true, initialDirs: [1] });
    if (floaterRoute.reachable) {
      return pass(level, 'floater-assisted crowd route reaches the exit', [{ skill: 'floater', x: level.entrance.x, y: level.entrance.y }], notes);
    }
  }

  if ((level.skills?.blocker || 0) > 0) {
    const blockerRoute = crowdCanReachExit(baseGrid, level, { floater: false, initialDirs: [1, -1] });
    if (blockerRoute.reachable) {
      const p = landing(baseGrid, level.entrance.x, level.entrance.y);
      return pass(level, 'blocker-style direction control creates a crowd route', [{ skill: 'blocker', x: p.x, y: p.y }], notes);
    }
  }

  const diggerTemplate = tryVerticalDigger(baseGrid, level, options, notes);
  if (diggerTemplate) {
    return pass(level, 'vertical digger template opens a crowd route', diggerTemplate.plan, notes);
  }

  const basherTemplate = tryFirstWallBasher(baseGrid, level);
  if (basherTemplate) {
    return pass(level, 'first-wall basher template opens a crowd route', basherTemplate.plan, notes);
  }

  const bomberTemplate = tryFirstObstacleBomber(baseGrid, level);
  if (bomberTemplate) {
    return pass(level, 'first-obstacle bomber template opens a crowd route', bomberTemplate.plan, notes);
  }

  const builderTemplate = tryFirstGapBuilder(baseGrid, level);
  if (builderTemplate) {
    return pass(level, 'first-gap builder template opens a crowd route', builderTemplate.plan, notes);
  }

  const diggerBasherTemplate = tryDiggerThenBasher(baseGrid, level);
  if (diggerBasherTemplate) {
    return pass(level, 'digger-then-basher template opens a crowd route', diggerBasherTemplate.plan, notes);
  }

  const search = searchSkillPlan(baseGrid, level, options);
  if (search) {
    return pass(level, `skill plan reaches exit within ${search.plan.length} action(s)`, search.plan, notes);
  }

  notes.push('The current agent is template-based; a failure may be a tooling gap, not proof the level is unsolvable.');
  return { pass: false, level, reason: 'no plausible route found by AI playtester', plan: [], notes };
}

function tryDiggerThenBasher(baseGrid, level) {
  if ((level.skills?.digger || 0) <= 0 || (level.skills?.basher || 0) <= 0) return null;
  const diggerStates = reachableStates(baseGrid, level, { floater: false, initialDirs: [1, -1], limit: 3000 });
  for (const dig of diggerStates) {
    if (!hasDiggableBelow(baseGrid, dig)) continue;
    const gridAfterDig = baseGrid.slice();
    const digApplied = carveUsableDiggerShaft(gridAfterDig, dig);
    if (!digApplied.changed) continue;
    const drop = landing(gridAfterDig, dig.x, dig.y, false);
    if (drop.dead) continue;
    const wallStates = reachableStatesFrom(gridAfterDig, drop, { floater: false, initialDirs: [1, -1], limit: 3000 });
    for (const wall of wallStates) {
      if (!hasWallAhead(gridAfterDig, wall)) continue;
      const grid = gridAfterDig.slice();
      const bashApplied = simulateBasher(grid, wall);
      if (!bashApplied.changed) continue;
      const route = crowdCanReachExitFrom(grid, level, drop, { floater: false, initialDirs: [1, -1] });
      if (route.reachable) {
        return {
          plan: [
            { skill: 'digger', x: Math.round(dig.x), y: Math.round(dig.y), vx: dig.vx || 1 },
            { skill: 'basher', x: Math.round(wall.x), y: Math.round(wall.y), vx: wall.vx || 1 },
          ],
          grid,
        };
      }
    }
  }
  return null;
}

function tryFirstObstacleBomber(baseGrid, level) {
  if ((level.skills?.bomber || 0) <= 0) return null;
  const states = reachableStates(baseGrid, level, { floater: false, initialDirs: [1], limit: 3000 });
  for (const state of states) {
    if (!nearObstacle(baseGrid, state)) continue;
    const grid = baseGrid.slice();
    const applied = simulateBomber(grid, state);
    if (!applied.changed) continue;
    const route = crowdCanReachExit(grid, level, { floater: false, initialDirs: [1, -1] });
    if (route.reachable) {
      return { plan: [{ skill: 'bomber', x: Math.round(state.x), y: Math.round(state.y), vx: state.vx || 1 }], grid };
    }
  }
  return null;
}

function tryFirstGapBuilder(baseGrid, level) {
  if ((level.skills?.builder || 0) <= 0) return null;
  const states = reachableStates(baseGrid, level, { floater: false, initialDirs: [1], limit: 3000 });
  for (const state of states) {
    if (!hasGapAhead(baseGrid, state)) continue;
    const grid = baseGrid.slice();
    const applied = simulateBuilder(grid, state);
    if (!applied.changed) continue;
    const route = crowdCanReachExit(grid, level, { floater: false, initialDirs: [1, -1] });
    if (route.reachable) {
      return { plan: [{ skill: 'builder', x: Math.round(state.x), y: Math.round(state.y), vx: state.vx || 1 }], grid };
    }
  }
  return null;
}

function tryVerticalDigger(baseGrid, level, options = {}, notes = []) {
  if ((level.skills?.digger || 0) <= 0) return null;
  const states = reachableStates(baseGrid, level, { floater: false, initialDirs: [1, -1], limit: 3000 });
  let candidates = 0;
  let best = null;
  for (const state of states) {
    if (!hasDiggableBelow(baseGrid, state)) continue;
    candidates++;
    const grid = baseGrid.slice();
    const applied = carveUsableDiggerShaft(grid, state);
    if (!applied.changed) continue;
    const drop = landing(grid, state.x, state.y, false);
    const route = crowdCanReachExitFrom(grid, level, drop, { floater: false, initialDirs: [1, -1] });
    if (route.reachable) {
      return { plan: [{ skill: 'digger', x: Math.round(state.x), y: Math.round(state.y), vx: state.vx || 1 }], grid };
    }
    const score = route.bestDistance ?? 9999;
    if (!best || score < best.score) best = { score, state, drop };
  }
  if (options.verbose) {
    notes.push(`digger template considered ${candidates} candidate positions from ${states.length} reachable states.`);
    if (best) {
      const fallNote = best.drop.dead ? ` fatal fall ${best.drop.fall}px` : ` fall ${best.drop.fall ?? 0}px`;
      notes.push(`best digger miss: skill@(${Math.round(best.state.x)},${Math.round(best.state.y)}) drop@(${Math.round(best.drop.x)},${Math.round(best.drop.y)})${fallNote}, distance ${best.score.toFixed(1)}.`);
    }
  }
  return null;
}

function carveUsableDiggerShaft(grid, state) {
  let changed = false;
  const cx = Math.floor(state.x + CENTER_X);
  const startY = Math.floor(state.y + PUFFIN_H + 1);
  let seenAirBelow = false;
  for (let y = startY; y < GRID_H - 1; y++) {
    let rowChanged = false;
    for (let dx = -5; dx <= 5; dx++) {
      if (clearDiggable(grid, cx + dx, y, state.vx)) {
        rowChanged = true;
        changed = true;
      }
    }
    if (!rowChanged) seenAirBelow = true;
    if (seenAirBelow && floorRunAt(grid, cx, y + 1, 14)) break;
  }
  return { changed };
}

function pass(level, reason, plan, notes) {
  const losses = estimatedLosses(level, plan);
  const budget = level.total - level.required;
  if (losses > budget) {
    return {
      pass: false,
      level,
      reason: `found a route shape, but estimated losses ${losses} exceed allowed losses ${budget}`,
      plan,
      notes,
    };
  }
  return { pass: true, level, reason, plan, notes };
}

function searchSkillPlan(baseGrid, level, options) {
  const maxDepth = Number(options.maxDepth || 5);
  const start = {
    grid: baseGrid,
    plan: [],
    skills: { ...level.skills },
  };
  let frontier = [start];
  const seen = new Set();

  for (let depth = 0; depth < maxDepth; depth++) {
    const nextFrontier = [];
    for (const node of frontier) {
      const candidates = skillCandidates(node.grid, level, node.skills);
      for (const cand of candidates) {
        const key = `${cand.skill}:${Math.round(cand.x / 4) * 4},${Math.round(cand.y / 4) * 4},${cand.vx || 1}:${terrainSignature(node.grid)}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const grid = node.grid.slice();
        const applied = applySkill(grid, cand);
        if (!applied.changed) continue;

        const skills = { ...node.skills, [cand.skill]: (node.skills[cand.skill] || 0) - 1 };
        const plan = [...node.plan, { skill: cand.skill, x: Math.round(cand.x), y: Math.round(cand.y), vx: cand.vx || 1 }];
        const route = crowdCanReachExit(grid, level, { floater: (skills.floater || 0) >= level.required, initialDirs: [1, -1] });
        if (route.reachable) return { plan, grid };

        if (plan.length < maxDepth) nextFrontier.push({ grid, plan, skills });
      }
    }
    frontier = nextFrontier
      .sort((a, b) => scoreNode(b, level) - scoreNode(a, level))
      .slice(0, 180);
  }

  return null;
}

function tryFirstWallBasher(baseGrid, level) {
  if ((level.skills?.basher || 0) <= 0) return null;
  const states = reachableStates(baseGrid, level, { floater: false, initialDirs: [1], limit: 2000 });
  for (const state of states) {
    if (!hasWallAhead(baseGrid, state)) continue;
    const grid = baseGrid.slice();
    const applied = simulateBasher(grid, state);
    if (!applied.changed) continue;
    const route = crowdCanReachExit(grid, level, { floater: false, initialDirs: [1, -1] });
    if (route.reachable) {
      return { plan: [{ skill: 'basher', x: Math.round(state.x), y: Math.round(state.y), vx: state.vx || 1 }], grid };
    }
  }
  return null;
}

function skillCandidates(grid, level, skills) {
  const states = reachableStates(grid, level, { floater: (skills.floater || 0) > 0, initialDirs: [1, -1], limit: 140 });
  const out = [];
  const spaced = [];
  for (const state of states) {
    if (spaced.some(s => Math.abs(s.x - state.x) < 10 && Math.abs(s.y - state.y) < 8 && s.vx === state.vx)) continue;
    spaced.push(state);
  }

  for (const state of spaced) {
    if ((skills.digger || 0) > 0 && hasDiggableBelow(grid, state)) out.push({ skill: 'digger', ...state });
    if ((skills.miner || 0) > 0 && hasDiggableDiagonal(grid, state)) out.push({ skill: 'miner', ...state });
    if ((skills.builder || 0) > 0 && hasGapAhead(grid, state)) out.push({ skill: 'builder', ...state });
    if ((skills.basher || 0) > 0 && hasWallAhead(grid, state)) out.push({ skill: 'basher', ...state });
    if ((skills.bomber || 0) > 0 && nearObstacle(grid, state)) out.push({ skill: 'bomber', ...state });
  }

  return out.slice(0, 160);
}

function scoreNode(node, level) {
  const states = reachableStates(node.grid, level, { floater: (node.skills.floater || 0) > 0, initialDirs: [1, -1], limit: 1200 });
  if (!states.length) return -9999;
  const exitCenterX = level.exit.x + level.exit.w / 2;
  const exitCenterY = level.exit.y + level.exit.h / 2;
  let best = -9999;
  for (const state of states) {
    const dx = Math.abs((state.x + CENTER_X) - exitCenterX);
    const dy = Math.abs((state.y + CENTER_Y) - exitCenterY);
    best = Math.max(best, 1000 - dx - dy * 0.65 - node.plan.length * 12);
  }
  return best;
}

function applySkill(grid, action) {
  if (action.skill === 'digger') return simulateDigger(grid, action);
  if (action.skill === 'miner') return simulateMiner(grid, action);
  if (action.skill === 'basher') return simulateBasher(grid, action);
  if (action.skill === 'builder') return simulateBuilder(grid, action);
  if (action.skill === 'bomber') return simulateBomber(grid, action);
  return { changed: false };
}

function simulateDigger(grid, state) {
  let changed = false;
  let x = state.x;
  let y = state.y;
  for (let step = 0; step < 95; step++) {
    y += 1;
    const cx = Math.floor(x + CENTER_X);
    const cy = Math.floor(y + PUFFIN_H);
    let carved = false;
    for (const pt of MASK_DIG) {
      if (clearDiggable(grid, cx + pt.x, cy + pt.y, state.vx)) {
        carved = true;
        changed = true;
      }
    }
    if (!carved && !solid(grid, cx, cy + 1)) break;
  }
  return { changed };
}

function simulateMiner(grid, state) {
  let changed = false;
  let x = state.x;
  let y = state.y;
  const vx = state.vx || 1;
  for (let step = 0; step < 140; step++) {
    y += 1;
    x += vx * 0.5;
    const cx = Math.floor(x + CENTER_X + (vx > 0 ? 2 : -2));
    const cy = Math.floor(y + PUFFIN_H);
    let carved = false;
    for (const pt of MASK_MINE) {
      if (clearDiggable(grid, cx + pt.x * vx, cy + pt.y, vx)) {
        carved = true;
        changed = true;
      }
    }
    if (!carved && !solid(grid, Math.floor(x + CENTER_X), Math.floor(y + PUFFIN_H + 1))) break;
  }
  return { changed };
}

function simulateBasher(grid, state) {
  let changed = false;
  let x = state.x;
  const y = state.y;
  const vx = state.vx || 1;
  let carvedOnce = false;
  for (let step = 0; step < 220; step++) {
    x += vx;
    const cx = Math.floor(x + (vx > 0 ? PUFFIN_W : 0));
    const cy = Math.floor(y + CENTER_Y);
    let carved = false;
    for (const pt of MASK_BASH) {
      if (clearDiggable(grid, cx + pt.x * vx, cy + pt.y, vx)) {
        carved = true;
        changed = true;
        carvedOnce = true;
      }
    }
    if (!carved && carvedOnce) break;
  }
  return { changed };
}

function simulateBuilder(grid, state) {
  let changed = false;
  let x = state.x;
  let y = state.y;
  const vx = state.vx || 1;
  for (let brick = 0; brick < 12; brick++) {
    const bx = Math.floor(x + vx * 4);
    const by = Math.floor(y + PUFFIN_H);
    const checkX = Math.floor(x + vx * 4);
    const checkY = Math.floor(y - 1 + CENTER_Y);
    const leadX = bx + vx * 3;
    if (solid(grid, checkX, checkY) || solid(grid, leadX, by) || solid(grid, leadX, by - 1)) break;
    for (let i = 0; i < 4; i++) {
      setCell(grid, bx + vx * i, by, 1);
      setCell(grid, bx + vx * i, by - 1, 1);
      changed = true;
    }
    x += vx * 2;
    y -= 1;
  }
  return { changed };
}

function simulateBomber(grid, state) {
  let changed = false;
  const cx = Math.floor(state.x + CENTER_X);
  const cy = Math.floor(state.y + CENTER_Y);
  for (const pt of MASK_CRATER) {
    const x = cx + pt.x;
    const y = cy + pt.y;
    if (diggable(grid, x, y, state.vx)) {
      setCell(grid, x, y, 0);
      changed = true;
    }
  }
  return { changed };
}

function crowdCanReachExit(grid, level, opts) {
  const states = reachableStates(grid, level, opts);
  return routeContainsExit(states, level);
}

function crowdCanReachExitFrom(grid, level, start, opts = {}) {
  if (!start || start.dead) return { reachable: false };
  const initialDirs = opts.initialDirs || [1];
  const queue = initialDirs.map(vx => ({ x: start.x, y: start.y, vx }));
  const visited = new Set(queue.map(s => stateKey(s)));
  const states = [];
  const limit = opts.limit || 80000;
  for (let i = 0; queue.length && i < limit; i++) {
    const state = queue.shift();
    states.push(state);
    const next = stepWalk(grid, state, opts);
    const candidates = next.wall
      ? [{ x: state.x, y: state.y, vx: -state.vx }]
      : [next];
    for (const c of candidates) {
      if (c.dead) continue;
      const key = stateKey(c);
      if (!visited.has(key)) {
        visited.add(key);
        queue.push(c);
      }
    }
  }
  return routeContainsExit(states, level);
}

function reachableStatesFrom(grid, start, opts = {}) {
  if (!start || start.dead) return [];
  const initialDirs = opts.initialDirs || [1];
  const queue = initialDirs.map(vx => ({ x: start.x, y: start.y, vx }));
  const visited = new Set(queue.map(s => stateKey(s)));
  const states = [];
  const limit = opts.limit || 80000;
  for (let i = 0; queue.length && i < limit; i++) {
    const state = queue.shift();
    states.push(state);
    const next = stepWalk(grid, state, opts);
    const candidates = next.wall
      ? [{ x: state.x, y: state.y, vx: -state.vx }]
      : [next];
    for (const c of candidates) {
      if (c.dead) continue;
      const key = stateKey(c);
      if (!visited.has(key)) {
        visited.add(key);
        queue.push(c);
      }
    }
  }
  return states;
}

function routeContainsExit(states, level) {
  const exit = level.exit;
  let bestDistance = 9999;
  for (const state of states) {
    const x = state.x + CENTER_X;
    const y = state.y + CENTER_Y;
    const dx = Math.max(exit.x - x, 0, x - (exit.x + exit.w));
    const dy = Math.max(exit.y - y, 0, y - (exit.y + exit.h));
    bestDistance = Math.min(bestDistance, Math.hypot(dx, dy));
    if (x >= exit.x && x < exit.x + exit.w && y >= exit.y && y < exit.y + exit.h) {
      return { reachable: true, state };
    }
  }
  return { reachable: false, bestDistance };
}

function reachableStates(grid, level, opts = {}) {
  const initialDirs = opts.initialDirs || [1];
  const start = landing(grid, level.entrance.x, level.entrance.y, opts.floater);
  if (start.dead) return [];
  const queue = initialDirs.map(vx => ({ x: start.x, y: start.y, vx }));
  const visited = new Set(queue.map(s => stateKey(s)));
  const out = [];
  const limit = opts.limit || 80000;

  for (let i = 0; queue.length && i < limit; i++) {
    const state = queue.shift();
    out.push(state);
    const next = stepWalk(grid, state, opts);
    const candidates = next.wall
      ? [{ x: state.x, y: state.y, vx: -state.vx }]
      : [next];

    for (const c of candidates) {
      if (c.dead) continue;
      const key = stateKey(c);
      if (!visited.has(key)) {
        visited.add(key);
        queue.push(c);
      }
    }
  }
  return out;
}

function stepWalk(grid, state, opts = {}) {
  let { x, y, vx } = state;
  if (!solid(grid, Math.floor(x + CENTER_X), Math.floor(y + PUFFIN_H + 1))) {
    let fall = 0;
    while (y + PUFFIN_H + 1 < GRID_H && !solid(grid, Math.floor(x + CENTER_X), Math.floor(y + PUFFIN_H + 1))) {
      y++;
      fall++;
      if (fall > FALL_DEATH_DIST && !opts.floater) return { x, y, vx, dead: true };
    }
    return { x, y, vx };
  }

  const nextX = x + vx;
  if (nextX < 0 || nextX > GRID_W - PUFFIN_W) return { x, y, vx: -vx };

  const centerX = Math.floor(nextX + CENTER_X);
  const footY = Math.floor(y + PUFFIN_H);
  for (let dy = MAX_STEP + 1; dy <= PUFFIN_H - 1; dy++) {
    if (solid(grid, centerX, footY - dy)) return { x, y, vx, wall: true };
  }

  let stepY = null;
  for (let dy = MAX_STEP; dy >= 0; dy--) {
    if (solid(grid, centerX, footY - dy)) {
      stepY = footY - dy;
      break;
    }
  }

  x = nextX;
  if (stepY !== null) {
    y = stepY - PUFFIN_H - 1;
  } else {
    let fall = 0;
    while (y + PUFFIN_H + 1 < GRID_H && !solid(grid, centerX, Math.floor(y + PUFFIN_H + 1))) {
      y++;
      fall++;
      if (fall > FALL_DEATH_DIST && !opts.floater) return { x, y, vx, dead: true };
    }
  }
  return { x, y, vx };
}

function landing(grid, startX, startY, floater = false) {
  let y = Math.floor(startY);
  let fall = Math.max(0, -y);
  const x = Math.floor(startX);
  if (y < 0) y = 0;
  while (y + PUFFIN_H + 1 < GRID_H && !solid(grid, Math.floor(x + CENTER_X), Math.floor(y + PUFFIN_H + 1))) {
    y++;
    fall++;
    if (fall > FALL_DEATH_DIST && !floater) return { x, y, dead: true };
  }
  return { x, y, fall };
}

function materializeLevel(level) {
  const grid = decodeRLE(level.terrain);
  stampObjects(grid, level.objects);
  return grid;
}

function decodeRLE(rle) {
  const grid = new Uint8Array(GRID_W * GRID_H);
  if (!Array.isArray(rle)) return grid;
  let offset = 0;
  for (const pair of rle) {
    if (!Array.isArray(pair) || pair.length < 2) continue;
    const val = Number(pair[0]) || 0;
    const count = Number(pair[1]) || 0;
    for (let i = 0; i < count && offset < grid.length; i++) grid[offset++] = val;
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
        setCell(grid, obj.x + x, obj.y + y, piece.val);
      }
    }
  }
}

function solid(grid, x, y) {
  x = Math.floor(x);
  y = Math.floor(y);
  if (x < 0 || x >= GRID_W || y < 0 || y >= GRID_H) return false;
  return grid[y * GRID_W + x] !== 0;
}

function diggable(grid, x, y, dir) {
  x = Math.floor(x);
  y = Math.floor(y);
  if (x < 0 || x >= GRID_W || y < 0 || y >= GRID_H) return false;
  const val = grid[y * GRID_W + x];
  if (val === 1) return true;
  if (val === 11) return dir > 0;
  if (val === 12) return dir < 0;
  return false;
}

function clearDiggable(grid, x, y, dir) {
  if (!diggable(grid, x, y, dir)) return false;
  setCell(grid, x, y, 0);
  return true;
}

function setCell(grid, x, y, val) {
  x = Math.floor(x);
  y = Math.floor(y);
  if (x < 0 || x >= GRID_W || y < 0 || y >= GRID_H) return;
  grid[y * GRID_W + x] = val;
}

function hasDiggableBelow(grid, state) {
  const cx = Math.floor(state.x + CENTER_X);
  const cy = Math.floor(state.y + PUFFIN_H + 1);
  for (let dx = -4; dx <= 4; dx++) if (diggable(grid, cx + dx, cy, state.vx)) return true;
  return false;
}

function floorRunAt(grid, centerX, y, width) {
  let hits = 0;
  const half = Math.floor(width / 2);
  for (let dx = -half; dx <= half; dx++) {
    if (solid(grid, centerX + dx, y)) hits++;
  }
  return hits >= Math.ceil(width * 0.6);
}

function hasDiggableDiagonal(grid, state) {
  const vx = state.vx || 1;
  const cx = Math.floor(state.x + CENTER_X + vx * 4);
  const cy = Math.floor(state.y + PUFFIN_H + 3);
  for (const pt of MASK_MINE) if (diggable(grid, cx + pt.x * vx, cy + pt.y, vx)) return true;
  return false;
}

function hasWallAhead(grid, state) {
  const vx = state.vx || 1;
  const x = Math.floor(state.x + (vx > 0 ? PUFFIN_W + 1 : -1));
  const top = Math.floor(state.y + 2);
  const bottom = Math.floor(state.y + PUFFIN_H - 2);
  let hits = 0;
  for (let y = top; y <= bottom; y++) if (diggable(grid, x, y, vx)) hits++;
  return hits >= 3;
}

function hasGapAhead(grid, state) {
  const vx = state.vx || 1;
  const startX = Math.floor(state.x + CENTER_X);
  const footY = Math.floor(state.y + PUFFIN_H + 1);
  let solidNow = solid(grid, startX, footY);
  let gap = 0;
  for (let d = 8; d <= 72; d += 4) {
    const x = startX + vx * d;
    if (!solid(grid, x, footY)) gap++;
    else if (solidNow && gap >= 2) return true;
  }
  return gap >= 3;
}

function nearObstacle(grid, state) {
  return hasWallAhead(grid, state) || hasGapAhead(grid, state) || hasDiggableBelow(grid, state);
}

function stateKey(state) {
  return `${Math.round(state.x)},${Math.round(state.y)},${state.vx}`;
}

function terrainSignature(grid) {
  let hash = 2166136261;
  for (let i = 0; i < grid.length; i += 97) {
    hash ^= grid[i];
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function estimatedLosses(level, plan) {
  let losses = 0;
  for (const step of plan) {
    if (step.skill === 'bomber' || step.skill === 'blocker') losses++;
  }
  return losses;
}

function formatStep(step) {
  const dir = step.vx < 0 ? 'left' : 'right';
  return `${step.skill}@(${step.x},${step.y},${dir})`;
}

main();
