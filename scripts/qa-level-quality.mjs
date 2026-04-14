#!/usr/bin/env node
/**
 * qa-level-quality.mjs — Automated Level Quality Auditor
 *
 * Analyses every campaign level for professional-quality puzzle design metrics:
 *
 *  1. Free-walk test: Can the level be solved with ZERO skills? (bad if yes)
 *  2. Skill surplus ratio: What fraction of given skills are actually used?
 *  3. Solution depth: How many distinct skill actions are required?
 *  4. Terrain complexity: Architectural richness of the RLE terrain
 *  5. Red herring detection: Are there skills given that can't/shouldn't be used?
 *  6. Difficulty tier placement: Does the level fit its position in the campaign?
 *  7. Multi-layer score: Does the solution require sequential dependent steps?
 *
 * Usage:
 *   node scripts/qa-level-quality.mjs [--verbose] [--gate] [--tier]
 *
 * Output: reports/level-quality-audit.json + console summary table
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root  = join(__dir, '..');

const W = 400, H = 220;
const PUFFIN_H = 12;
const FALL_DEATH_DIST = 70;
const VERBOSE = process.argv.includes('--verbose');
const GATE    = process.argv.includes('--gate');
const TIER    = process.argv.includes('--tier');

// ── Terrain helpers (shared with route-analyze) ──────────────────────────────

function decodeTerrain(rle) {
  const data = new Uint8Array(W * H);
  let idx = 0;
  if (!Array.isArray(rle)) return data;
  for (const run of rle) {
    if (!Array.isArray(run) || run.length < 2) continue;
    const [val, count] = run;
    for (let i = 0; i < count && idx < data.length; i++) data[idx++] = val;
  }
  return data;
}

function isSolid(t, x, y) {
  if (x < 0 || x >= W || y < 0 || y >= H) return false;
  return t[y * W + x] !== 0;
}

function isSteel(t, x, y) {
  if (x < 0 || x >= W || y < 0 || y >= H) return false;
  return t[y * W + x] === 10;
}

function key(x, y) { return `${x},${y}`; }

function isTopSurface(data, x, y) {
  return isSolid(data, x, y) && !isSolid(data, x, y - 1);
}

function getTopPoints(data) {
  const points = [];
  const pointByKey = new Map();
  for (let y = 1; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (isTopSurface(data, x, y)) {
        const p = { id: points.length, x, y };
        points.push(p);
        pointByKey.set(key(x, y), p);
      }
    }
  }
  return { points, pointByKey };
}

function nearestTopPoint(points, tx, ty, radius = 140) {
  let best = null, bestD = Infinity;
  for (const p of points) {
    const dx = p.x - tx, dy = p.y - ty;
    const d = Math.abs(dx) + Math.abs(dy) * 1.5;
    if (Math.abs(dx) <= radius && Math.abs(dy) <= radius && d < bestD) {
      best = p; bestD = d;
    }
  }
  return best;
}

// ── Minimal route solver (inline, supports zero-budget mode) ─────────────────
// Stripped-down A* from route-analyze.mjs, returns {ok, used, actions, steps}

function findStepNeighbor(pointByKey, x, y, dir) {
  const nx = x + dir;
  for (const dy of [0, -1, 1]) {
    const p = pointByKey.get(key(nx, y + dy));
    if (p) return p;
  }
  return null;
}

function findFallLanding(pointByKey, data, x, y) {
  for (let ny = y + 1; ny < H; ny++) {
    for (const dx of [0, -1, 1]) {
      const p = pointByKey.get(key(x + dx, ny));
      if (p) return p;
    }
    if (ny - y > 130) break;
  }
  return null;
}

function hasWallAtBody(data, x, y, dir) {
  const cx = x + dir;
  const bodyY = Math.max(1, y - Math.floor(PUFFIN_H / 2));
  return isSolid(data, cx, bodyY);
}

function isDiggable(data, x, y, dir) {
  if (x < 0 || x >= W || y < 0 || y >= H) return false;
  const val = data[y * W + x];
  if (val === 1) return true;
  if (val === 11) return dir > 0;
  if (val === 12) return dir < 0;
  return false;
}

function findDiggerCandidate(pointByKey, points, data, from) {
  const cx = from.x;
  let hasDiggable = false;
  for (let dy = 0; dy <= 3 && !hasDiggable; dy++)
    for (let dx = -3; dx <= 3; dx++)
      if (isDiggable(data, cx + dx, from.y + dy, 0)) { hasDiggable = true; break; }
  if (!hasDiggable) return null;

  let n = 0;
  while (n < H - from.y - 4) {
    let any = false;
    for (let dy = 0; dy <= 3 && !any; dy++)
      for (let dx = -3; dx <= 3; dx++)
        if (isDiggable(data, cx + dx, from.y + n + dy, 0)) { any = true; break; }
    if (!any) break;
    n++;
  }
  if (n < 3) return null;
  const exitY = from.y + n;
  for (let ny = exitY; ny < Math.min(H, exitY + 130); ny++)
    for (const dx of [0, -1, 1, -2, 2, -3, 3]) {
      const p = pointByKey.get(key(cx + dx, ny));
      if (p && p.id !== from.id) return p;
    }
  return null;
}

function findMinerCandidate(pointByKey, points, data, from, dir) {
  const probeX = Math.floor(from.x + dir * 3);
  let has = false;
  for (let dy = 0; dy <= 4 && !has; dy++)
    for (let dx = 0; dx <= 4; dx++)
      if (isDiggable(data, probeX + dir * dx, from.y + dy, dir)) { has = true; break; }
  if (!has) return null;

  let mx = from.x, my = from.y, strokes = 0;
  while (strokes < 300) {
    my += 1; mx += dir * 0.5;
    const cx = Math.floor(mx + dir * 3), cy = my;
    let any = false;
    for (let dy = 0; dy <= 4 && !any; dy++)
      for (let dx = 0; dx <= 4; dx++)
        if (isDiggable(data, cx + dir * dx, cy + dy, dir)) { any = true; break; }
    if (!any) break;
    strokes++;
  }
  if (strokes < 3) return null;
  const exitX = Math.floor(mx), exitY = Math.floor(my);
  for (let ny = exitY; ny < Math.min(H, exitY + 130); ny++)
    for (const dx of [0, dir, -dir, dir * 2, -dir * 2, dir * 3]) {
      const p = pointByKey.get(key(exitX + dx, ny));
      if (p && p.id !== from.id) return p;
    }
  let best = null, bestD = Infinity;
  for (const p of points) {
    if (p.id === from.id) continue;
    const ddx = Math.abs(p.x - exitX), ddy = p.y - exitY;
    if (ddx <= 20 && ddy >= -5 && ddy <= 130) {
      const d = ddx + Math.abs(ddy);
      if (d < bestD) { bestD = d; best = p; }
    }
  }
  return best;
}

function findBuilderCandidate(points, data, from, dir) {
  const minGap = 4, maxGap = 72;
  let best = null, bestCost = Infinity;
  for (const p of points) {
    const dx = p.x - from.x;
    if ((dir > 0 && dx <= minGap) || (dir < 0 && dx >= -minGap)) continue;
    if (Math.abs(dx) > maxGap) continue;
    const dy = p.y - from.y;
    if (dy < -Math.floor(Math.abs(dx) / 2) || dy > 10) continue;
    const steps = Math.abs(dx);
    let blocked = false;
    for (let i = 1; i <= steps; i++) {
      const ix = from.x + Math.sign(dx) * i;
      const iy = from.y - Math.floor(i / 2);
      if (isSolid(data, ix, iy - 1)) { blocked = true; break; }
    }
    if (blocked) continue;
    const c = Math.abs(dx) + Math.abs(dy) * 2;
    if (c < bestCost) { bestCost = c; best = p; }
  }
  return best;
}

function findBasherCandidate(pointByKey, data, from, dir) {
  const bodyY = Math.max(1, from.y - Math.floor(PUFFIN_H / 2));
  let thickness = 0, x = from.x + dir;
  while (x >= 0 && x < W && thickness < 30 && isSolid(data, x, bodyY)) { thickness++; x += dir; }
  if (thickness < 2 || thickness >= 30) return null;
  for (const oy of [0, -1, 1, 2]) {
    const p = pointByKey.get(key(x, from.y + oy));
    if (p) return p;
  }
  return null;
}

function findClimberCandidate(pointByKey, data, from, dir) {
  if (!hasWallAtBody(data, from.x, from.y, dir)) return null;
  const wx = from.x + dir;
  for (let ny = from.y - 1; ny >= Math.max(2, from.y - 210); ny--) {
    const p = pointByKey.get(key(wx, ny));
    if (!p) continue;
    for (let cy = ny; cy <= from.y; cy++) {
      if (isSolid(data, wx, cy)) return p;
    }
  }
  return null;
}

class MinHeap {
  constructor() { this.arr = []; }
  push(item) { this.arr.push(item); this._up(this.arr.length - 1); }
  pop() {
    if (!this.arr.length) return null;
    const r = this.arr[0], e = this.arr.pop();
    if (this.arr.length) { this.arr[0] = e; this._down(0); }
    return r;
  }
  _up(i) {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.arr[p].score <= this.arr[i].score) break;
      [this.arr[p], this.arr[i]] = [this.arr[i], this.arr[p]]; i = p;
    }
  }
  _down(i) {
    const n = this.arr.length;
    while (true) {
      let s = i; const l = i * 2 + 1, r = i * 2 + 2;
      if (l < n && this.arr[l].score < this.arr[s].score) s = l;
      if (r < n && this.arr[r].score < this.arr[s].score) s = r;
      if (s === i) break;
      [this.arr[s], this.arr[i]] = [this.arr[i], this.arr[s]]; i = s;
    }
  }
  get size() { return this.arr.length; }
}

function cloneUsed(u) {
  return { builder: u.builder, basher: u.basher, climber: u.climber, floater: u.floater, digger: u.digger, miner: u.miner };
}
function stateKey(id, u) {
  return `${id}|b${u.builder}|h${u.basher}|c${u.climber}|f${u.floater}|d${u.digger}|m${u.miner}`;
}
function withinBudget(used, budget) {
  return used.builder <= budget.builder && used.basher <= budget.basher &&
    used.climber <= budget.climber && used.floater <= budget.floater &&
    used.digger <= budget.digger && used.miner <= budget.miner;
}

/**
 * Solve a level with the given skill budget. Returns {ok, used, actionList, steps, iterations, closest}.
 * actionList is an array of distinct action strings (not consecutive walk duplicates).
 */
function solve(level, data, budget, maxIter = 600000) {
  const { points, pointByKey } = getTopPoints(data);

  const ent = level.entrance || { x: 40, y: 40 };
  const exit = level.exit || { x: W - 30, y: H - 25, w: 20, h: 12 };

  const spawn = nearestTopPoint(points, Math.floor(ent.x), Math.floor(ent.y + PUFFIN_H + 1));
  const exitCands = points.filter(p =>
    p.x >= exit.x && p.x <= (exit.x + (exit.w || 20)) &&
    p.y >= exit.y && p.y <= (exit.y + (exit.h || 12) + 3));
  const fallbackExit = nearestTopPoint(points, Math.floor(exit.x + (exit.w || 20) / 2), Math.floor(exit.y + (exit.h || 12) + 1));

  if (!spawn || (!fallbackExit && exitCands.length === 0)) {
    return { ok: false, used: null, actionList: [], steps: 0, iterations: 0, closest: null };
  }

  const targetSet = new Set((exitCands.length ? exitCands : [fallbackExit]).map(p => p.id));
  const targetRef = exitCands.length ? exitCands[0] : fallbackExit;

  const heap = new MinHeap();
  const startUsed = { builder: 0, basher: 0, climber: 0, floater: 0, digger: 0, miner: 0 };
  heap.push({ node: spawn, used: startUsed, dist: 0, score: 0, prev: null, action: 'spawn' });
  const best = new Map();
  best.set(stateKey(spawn.id, startUsed), 0);

  let winner = null, iterations = 0;
  let closest = { distToExit: Infinity, node: spawn, used: cloneUsed(startUsed) };

  while (heap.size > 0 && iterations < maxIter) {
    iterations++;
    const cur = heap.pop();
    const curKey = stateKey(cur.node.id, cur.used);
    if ((best.get(curKey) ?? Infinity) < cur.dist) continue;

    const dExit = Math.abs(cur.node.x - targetRef.x) + Math.abs(cur.node.y - targetRef.y);
    if (dExit < closest.distToExit) closest = { distToExit: dExit, node: cur.node, used: cloneUsed(cur.used) };
    if (targetSet.has(cur.node.id)) { winner = cur; break; }

    for (const dir of [-1, 1]) {
      const step = findStepNeighbor(pointByKey, cur.node.x, cur.node.y, dir);
      if (step) {
        const nd = cur.dist + 1;
        const ns = { node: step, used: cloneUsed(cur.used), dist: nd, score: nd, prev: cur, action: `walk:${dir > 0 ? 'R' : 'L'}` };
        const k = stateKey(ns.node.id, ns.used);
        if (!best.has(k) || nd < best.get(k)) { best.set(k, nd); heap.push(ns); }
      } else {
        const landing = findFallLanding(pointByKey, data, cur.node.x, cur.node.y);
        if (landing) {
          const fallDist = landing.y - cur.node.y;
          const used = cloneUsed(cur.used);
          if (fallDist > FALL_DEATH_DIST) used.floater += 1;
          if (withinBudget(used, budget)) {
            const nd = cur.dist + 3;
            const ns = { node: landing, used, dist: nd, score: nd + used.floater * 40, prev: cur, action: `fall:${dir > 0 ? 'R' : 'L'}` };
            const k = stateKey(ns.node.id, ns.used);
            if (!best.has(k) || nd < best.get(k)) { best.set(k, nd); heap.push(ns); }
          }
        }
        const bld = findBuilderCandidate(points, data, cur.node, dir);
        if (bld) {
          const used = cloneUsed(cur.used); used.builder += 1;
          if (withinBudget(used, budget)) {
            const nd = cur.dist + 7;
            const ns = { node: bld, used, dist: nd, score: nd + used.builder * 25, prev: cur, action: `build:${dir > 0 ? 'R' : 'L'}` };
            const k = stateKey(ns.node.id, ns.used);
            if (!best.has(k) || nd < best.get(k)) { best.set(k, nd); heap.push(ns); }
          }
        }
        const bash = findBasherCandidate(pointByKey, data, cur.node, dir);
        if (bash) {
          const used = cloneUsed(cur.used); used.basher += 1;
          if (withinBudget(used, budget)) {
            const nd = cur.dist + 8;
            const ns = { node: bash, used, dist: nd, score: nd + used.basher * 30, prev: cur, action: `bash:${dir > 0 ? 'R' : 'L'}` };
            const k = stateKey(ns.node.id, ns.used);
            if (!best.has(k) || nd < best.get(k)) { best.set(k, nd); heap.push(ns); }
          }
        }
        const climb = findClimberCandidate(pointByKey, data, cur.node, dir);
        if (climb) {
          const used = cloneUsed(cur.used); used.climber += 1;
          if (withinBudget(used, budget)) {
            const nd = cur.dist + 8;
            const ns = { node: climb, used, dist: nd, score: nd + used.climber * 28, prev: cur, action: `climb:${dir > 0 ? 'R' : 'L'}` };
            const k = stateKey(ns.node.id, ns.used);
            if (!best.has(k) || nd < best.get(k)) { best.set(k, nd); heap.push(ns); }
          }
        }
      }
    }
    // Digger
    {
      const dig = findDiggerCandidate(pointByKey, points, data, cur.node);
      if (dig) {
        const used = cloneUsed(cur.used); used.digger += 1;
        if (withinBudget(used, budget)) {
          const nd = cur.dist + 10;
          const ns = { node: dig, used, dist: nd, score: nd + used.digger * 30, prev: cur, action: 'dig' };
          const k = stateKey(ns.node.id, ns.used);
          if (!best.has(k) || nd < best.get(k)) { best.set(k, nd); heap.push(ns); }
        }
      }
    }
    // Miner
    for (const mdir of [-1, 1]) {
      const mine = findMinerCandidate(pointByKey, points, data, cur.node, mdir);
      if (mine) {
        const used = cloneUsed(cur.used); used.miner += 1;
        if (withinBudget(used, budget)) {
          const nd = cur.dist + 12;
          const ns = { node: mine, used, dist: nd, score: nd + used.miner * 30, prev: cur, action: `mine:${mdir > 0 ? 'R' : 'L'}` };
          const k = stateKey(ns.node.id, ns.used);
          if (!best.has(k) || nd < best.get(k)) { best.set(k, nd); heap.push(ns); }
        }
      }
    }
  }

  if (!winner) {
    return { ok: false, used: null, actionList: [], steps: 0, iterations, closest };
  }

  // Extract compact action list (collapse consecutive same-action)
  const raw = [];
  let p = winner;
  while (p) { raw.push(p.action); p = p.prev; }
  raw.reverse();
  const actionList = [];
  for (const a of raw) {
    if (actionList.length === 0 || actionList[actionList.length - 1] !== a) actionList.push(a);
  }

  return { ok: true, used: winner.used, actionList, steps: winner.dist, iterations, closest: null };
}

// ── Terrain complexity metrics ───────────────────────────────────────────────

function analyzeTerrainComplexity(data) {
  // Count distinct terrain types
  const types = new Set();
  for (let i = 0; i < data.length; i++) if (data[i] !== 0) types.add(data[i]);

  // Count connected components (flood fill)
  const vis = new Uint8Array(W * H);
  let components = 0;
  let maxCompArea = 0;
  let totalSolid = 0;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (vis[i] || data[i] === 0) continue;
      components++;
      // BFS
      const qx = [x], qy = [y];
      vis[i] = 1;
      let qi = 0, area = 0;
      while (qi < qx.length) {
        const cx = qx[qi], cy = qy[qi]; qi++; area++;
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
          const ni = ny * W + nx;
          if (vis[ni] || data[ni] === 0) continue;
          vis[ni] = 1; qx.push(nx); qy.push(ny);
        }
      }
      if (area > maxCompArea) maxCompArea = area;
      totalSolid += area;
    }
  }

  // Count surface pixels (top surfaces = architectural detail)
  let surfaces = 0;
  for (let y = 1; y < H; y++)
    for (let x = 0; x < W; x++)
      if (isTopSurface(data, x, y)) surfaces++;

  // Count steel pixels
  let steelPixels = 0;
  for (let i = 0; i < data.length; i++) if (data[i] === 10) steelPixels++;

  // Vertical variation: count how many distinct Y bands have terrain
  const yBands = new Set();
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (data[y * W + x] !== 0) { yBands.add(y); break; }

  // Horizontal segmentation: count empty columns (vertical gaps)
  let emptyColumns = 0;
  for (let x = 0; x < W; x++) {
    let hasTerrain = false;
    for (let y = 0; y < H; y++) if (data[y * W + x] !== 0) { hasTerrain = true; break; }
    if (!hasTerrain) emptyColumns++;
  }

  // Gap count: number of contiguous empty-column runs (architectural gaps)
  let gaps = 0;
  let inGap = false;
  for (let x = 0; x < W; x++) {
    let hasTerrain = false;
    for (let y = 0; y < H; y++) if (data[y * W + x] !== 0) { hasTerrain = true; break; }
    if (!hasTerrain) {
      if (!inGap) { gaps++; inGap = true; }
    } else {
      inGap = false;
    }
  }

  return {
    terrainTypes: types.size,
    components,
    maxComponentArea: maxCompArea,
    totalSolid,
    surfacePixels: surfaces,
    steelPixels,
    yBands: yBands.size,
    emptyColumns,
    gapCount: gaps,
    fillRatio: +(totalSolid / (W * H)).toFixed(3),
    surfaceToSolidRatio: totalSolid > 0 ? +(surfaces / totalSolid).toFixed(3) : 0
  };
}

// ── Skill analysis ───────────────────────────────────────────────────────────

const SKILL_NAMES = ['climber', 'floater', 'bomber', 'blocker', 'builder', 'basher', 'miner', 'digger'];

function analyzeSkills(level) {
  const sk = level.skills || {};
  const provided = {};
  let totalProvided = 0;
  let typesProvided = 0;
  for (const name of SKILL_NAMES) {
    const n = Number(sk[name] || 0);
    provided[name] = n;
    totalProvided += n;
    if (n > 0) typesProvided++;
  }
  return { provided, totalProvided, typesProvided };
}

function computeSkillMetrics(skillAnalysis, normalUsed, zeroUsed) {
  const { provided, totalProvided, typesProvided } = skillAnalysis;

  // Total skills used in normal solution
  let totalUsed = 0;
  let typesUsed = 0;
  const usedMap = {};
  if (normalUsed) {
    for (const name of ['builder', 'basher', 'climber', 'floater', 'digger', 'miner']) {
      const n = normalUsed[name] || 0;
      usedMap[name] = n;
      totalUsed += n;
      if (n > 0) typesUsed++;
    }
  }

  const surplus = totalProvided > 0 ? +((totalProvided - totalUsed) / totalProvided).toFixed(3) : 0;

  // Red herrings: skills provided but not used at all
  const redHerrings = [];
  for (const name of SKILL_NAMES) {
    if (provided[name] > 0 && (!usedMap[name] || usedMap[name] === 0)) {
      redHerrings.push(name);
    }
  }

  return {
    totalProvided,
    typesProvided,
    totalUsed,
    typesUsed,
    surplus,
    redHerrings,
    redHerringCount: redHerrings.length
  };
}

// ── Solution depth ───────────────────────────────────────────────────────────

function computeSolutionDepth(actionList) {
  // Count non-walk, non-spawn actions
  const skillActions = actionList.filter(a =>
    !a.startsWith('walk:') && !a.startsWith('fall:') && a !== 'spawn');
  // Distinct skill types used
  const skillTypes = new Set(skillActions.map(a => a.split(':')[0]));
  return {
    totalActions: actionList.length,
    skillSteps: skillActions.length,
    distinctSkillTypes: skillTypes.size,
    skillSequence: skillActions
  };
}

// ── Difficulty tier classification ───────────────────────────────────────────

function classifyTier(levelNum) {
  if (levelNum <= 25) return 'Fledgling';
  if (levelNum <= 50) return 'Tricky';
  if (levelNum <= 75) return 'Taxing';
  return 'Mayhem';
}

function expectedComplexity(tier) {
  switch (tier) {
    case 'Fledgling': return { minSkillSteps: 0, maxSkillSteps: 2, minTypes: 0, maxTypes: 2, maxSurplus: 0.9, freeWalkOk: true };
    case 'Tricky':    return { minSkillSteps: 1, maxSkillSteps: 4, minTypes: 1, maxTypes: 4, maxSurplus: 0.7, freeWalkOk: false };
    case 'Taxing':    return { minSkillSteps: 2, maxSkillSteps: 6, minTypes: 2, maxTypes: 6, maxSurplus: 0.5, freeWalkOk: false };
    case 'Mayhem':    return { minSkillSteps: 3, maxSkillSteps: 10, minTypes: 2, maxTypes: 8, maxSurplus: 0.3, freeWalkOk: false };
  }
}

// ── Grading ──────────────────────────────────────────────────────────────────

function gradeSeverity(issues) {
  if (issues.some(i => i.severity === 'critical')) return 'F';
  const warns = issues.filter(i => i.severity === 'warning').length;
  const infos = issues.filter(i => i.severity === 'info').length;
  if (warns >= 3) return 'D';
  if (warns >= 2) return 'C';
  if (warns >= 1) return 'B';
  if (infos >= 2) return 'B+';
  return 'A';
}

// ── Main ─────────────────────────────────────────────────────────────────────

function auditLevel(file, level, levelNum) {
  const issues = [];
  const data = decodeTerrain(level.terrain || level.data);

  // 1. Skill analysis
  const skillInfo = analyzeSkills(level);

  // 2. Build budgets
  const fullBudget = {};
  for (const name of ['builder', 'basher', 'climber', 'floater', 'digger', 'miner']) {
    fullBudget[name] = Number((level.skills || {})[name] || 0);
  }
  const zeroBudget = { builder: 0, basher: 0, climber: 0, floater: 0, digger: 0, miner: 0 };

  // 3. Solve with full skills
  const normalResult = solve(level, data, fullBudget);

  // 4. Solve with ZERO skills (free-walk test)
  const zeroResult = solve(level, data, zeroBudget, 200000);

  // 5. Skill metrics
  const skillMetrics = computeSkillMetrics(skillInfo, normalResult.used, zeroResult.used);

  // 6. Solution depth
  const solutionDepth = normalResult.ok
    ? computeSolutionDepth(normalResult.actionList)
    : { totalActions: 0, skillSteps: 0, distinctSkillTypes: 0, skillSequence: [] };

  // 7. Terrain complexity
  const terrain = analyzeTerrainComplexity(data);

  // 8. Tier classification & expectations
  const tier = classifyTier(levelNum);
  const expected = expectedComplexity(tier);

  // ── Issue detection ──

  // CRITICAL: Level unsolvable
  if (!normalResult.ok) {
    issues.push({
      severity: 'critical',
      code: 'UNSOLVABLE',
      message: `Level is not solvable with provided skills. Closest: ${normalResult.closest?.distToExit ?? '?'}px from exit.`
    });
  }

  // CRITICAL: Free-walk path exists (except Fledgling levels 1-5)
  if (zeroResult.ok && levelNum > 5) {
    issues.push({
      severity: levelNum <= 25 ? 'warning' : 'critical',
      code: 'FREE_WALK',
      message: 'Level solvable with ZERO skills — no puzzle exists. Terrain must block naive path.'
    });
  }

  // WARNING: Skill surplus too high
  if (normalResult.ok && skillMetrics.surplus > expected.maxSurplus) {
    issues.push({
      severity: 'warning',
      code: 'SKILL_SURPLUS',
      message: `Skill surplus ${(skillMetrics.surplus * 100).toFixed(0)}% exceeds ${tier} maximum ${(expected.maxSurplus * 100).toFixed(0)}%. ` +
        `${skillMetrics.totalUsed} of ${skillMetrics.totalProvided} skills used.`
    });
  }

  // WARNING: Solution depth too shallow for tier
  if (normalResult.ok && solutionDepth.skillSteps < expected.minSkillSteps) {
    issues.push({
      severity: 'warning',
      code: 'SHALLOW_SOLUTION',
      message: `Solution uses ${solutionDepth.skillSteps} skill steps, ${tier} expects at least ${expected.minSkillSteps}. Puzzle lacks multi-layer reasoning.`
    });
  }

  // WARNING: Too few skill types used for tier
  if (normalResult.ok && solutionDepth.distinctSkillTypes < expected.minTypes) {
    issues.push({
      severity: 'warning',
      code: 'LOW_SKILL_DIVERSITY',
      message: `Solution uses ${solutionDepth.distinctSkillTypes} skill type(s), ${tier} expects at least ${expected.minTypes}.`
    });
  }

  // INFO: Terrain complexity low (few components, low surface ratio)
  if (terrain.components <= 2 && terrain.gapCount <= 1 && levelNum > 10) {
    issues.push({
      severity: 'info',
      code: 'SIMPLE_TERRAIN',
      message: `Terrain has only ${terrain.components} component(s) and ${terrain.gapCount} gap(s). Consider adding platforms, pillars, or chambers.`
    });
  }

  // INFO: No steel used (missed opportunity for skill constraint)
  if (terrain.steelPixels === 0 && levelNum > 15) {
    issues.push({
      severity: 'info',
      code: 'NO_STEEL',
      message: 'No steel terrain used. Steel forces specific skill choices and adds puzzle depth.'
    });
  }

  // WARNING: 100% save rate mid/late game is usually too harsh
  const saveRate = level.required / level.total;
  if (saveRate >= 1.0 && levelNum > 25) {
    issues.push({
      severity: 'warning',
      code: 'FULL_SAVE_REQUIRED',
      message: `100% save rate required in ${tier} tier. Consider allowing 1-2 losses for approachability.`
    });
  }

  // INFO: Many red herrings (deliberate misdirection — could be good, flag for review)
  if (skillMetrics.redHerringCount >= 3 && normalResult.ok) {
    issues.push({
      severity: 'info',
      code: 'MANY_RED_HERRINGS',
      message: `${skillMetrics.redHerringCount} skill types provided but unused: ${skillMetrics.redHerrings.join(', ')}. Verify this is intentional misdirection.`
    });
  }

  const grade = gradeSeverity(issues);

  return {
    file,
    level: levelNum,
    name: level.name || `Level ${levelNum}`,
    tier,
    grade,
    solvable: normalResult.ok,
    freeWalk: zeroResult.ok,
    skills: {
      ...skillMetrics,
      solutionDepth: solutionDepth.skillSteps,
      distinctSkillTypes: solutionDepth.distinctSkillTypes,
      skillSequence: solutionDepth.skillSequence
    },
    terrain: {
      components: terrain.components,
      gaps: terrain.gapCount,
      steelPixels: terrain.steelPixels,
      fillRatio: terrain.fillRatio,
      surfaceDetail: terrain.surfaceToSolidRatio,
      yBands: terrain.yBands
    },
    spawn: { total: level.total, required: level.required, saveRate: +saveRate.toFixed(2) },
    timing: { spawnRate: level.spawnRate, timeLimit: level.time },
    solverStats: {
      normalIterations: normalResult.iterations,
      zeroIterations: zeroResult.iterations,
      normalSteps: normalResult.steps
    },
    issues
  };
}

// ── Entry point ──────────────────────────────────────────────────────────────

const levelsDir = join(root, 'levels');
const manifest = JSON.parse(readFileSync(join(levelsDir, 'manifest.json'), 'utf8'));
const files = manifest.levels || [];

console.log(`\n  Level Quality Auditor — Puffin Panic 2`);
console.log(`  Scanning ${files.length} levels...\n`);

const results = [];
const gradeCount = { A: 0, 'B+': 0, B: 0, C: 0, D: 0, F: 0 };
let totalIssues = 0;
let criticalCount = 0;
let warningCount = 0;

for (const file of files) {
  const filePath = join(levelsDir, file);
  if (!existsSync(filePath)) { console.warn(`  SKIP: ${file} (not found)`); continue; }
  const raw = readFileSync(filePath, 'utf8');
  const level = JSON.parse(raw.replace(/^\uFEFF/, ''));
  const numMatch = file.match(/(\d+)/);
  const levelNum = numMatch ? parseInt(numMatch[1], 10) : 0;

  const result = auditLevel(file, level, levelNum);
  results.push(result);
  gradeCount[result.grade] = (gradeCount[result.grade] || 0) + 1;

  for (const issue of result.issues) {
    totalIssues++;
    if (issue.severity === 'critical') criticalCount++;
    if (issue.severity === 'warning') warningCount++;
  }

  // Console line
  const gradeColor = result.grade === 'A' ? '\x1b[32m' :
    result.grade.startsWith('B') ? '\x1b[33m' :
    result.grade === 'F' ? '\x1b[31m' : '\x1b[33m';
  const reset = '\x1b[0m';
  const fwTag = result.freeWalk ? ' [FREE-WALK]' : '';
  const unsolvTag = !result.solvable ? ' [UNSOLVABLE]' : '';
  const depthStr = result.solvable ? `depth:${result.skills.solutionDepth}` : 'N/A';
  const surpStr = result.solvable ? `surplus:${(result.skills.surplus * 100).toFixed(0)}%` : 'N/A';

  const issueStr = result.issues.length > 0
    ? result.issues.map(i => i.code).join(', ')
    : 'clean';

  if (VERBOSE || result.issues.length > 0) {
    console.log(
      `  ${gradeColor}${result.grade.padEnd(2)}${reset} ` +
      `${String(levelNum).padStart(3)}: ${(level.name || '').padEnd(28).slice(0, 28)} ` +
      `${result.tier.padEnd(9)} ` +
      `${depthStr.padEnd(8)} ${surpStr.padEnd(12)} ` +
      `${issueStr}${fwTag}${unsolvTag}`
    );
  } else {
    process.stdout.write('.');
  }
}

// Always show the full table at the end
console.log('\n');
console.log('  ═══════════════════════════════════════════════════════════════════════════════════');
console.log('  GRADE  LVL  NAME                          TIER       DEPTH    SURPLUS      ISSUES');
console.log('  ─────────────────────────────────────────────────────────────────────────────────');
for (const r of results) {
  const fwTag = r.freeWalk ? ' [FW]' : '';
  const unsolvTag = !r.solvable ? ' [!]' : '';
  const depthStr = r.solvable ? `${r.skills.solutionDepth}` : 'N/A';
  const surpStr = r.solvable ? `${(r.skills.surplus * 100).toFixed(0)}%` : 'N/A';
  const issueStr = r.issues.length > 0
    ? r.issues.map(i => i.code).join(', ')
    : 'OK';
  console.log(
    `  ${r.grade.padEnd(5)}  ${String(r.level).padStart(3)}  ${(r.name || '').padEnd(28).slice(0, 28)}  ${r.tier.padEnd(9)}  ${depthStr.padStart(5)}  ${surpStr.padStart(7)}      ${issueStr}${fwTag}${unsolvTag}`
  );
}

console.log('  ═══════════════════════════════════════════════════════════════════════════════════');
console.log(`\n  SUMMARY`);
console.log(`  ───────`);
console.log(`  Levels: ${results.length}`);
console.log(`  Grades: A=${gradeCount.A || 0}  B+=${gradeCount['B+'] || 0}  B=${gradeCount.B || 0}  C=${gradeCount.C || 0}  D=${gradeCount.D || 0}  F=${gradeCount.F || 0}`);
console.log(`  Issues: ${totalIssues} total (${criticalCount} critical, ${warningCount} warnings)`);
console.log(`  Free-walk levels: ${results.filter(r => r.freeWalk).length}`);
console.log(`  Unsolvable levels: ${results.filter(r => !r.solvable).length}`);
console.log();

// Write report
const reportDir = join(root, 'reports');
if (!existsSync(reportDir)) mkdirSync(reportDir, { recursive: true });
const report = {
  generatedAt: new Date().toISOString(),
  summary: {
    totalLevels: results.length,
    grades: gradeCount,
    totalIssues,
    criticalCount,
    warningCount,
    freeWalkCount: results.filter(r => r.freeWalk).length,
    unsolvableCount: results.filter(r => !r.solvable).length
  },
  tiers: {
    Fledgling: results.filter(r => r.tier === 'Fledgling').map(r => ({ level: r.level, grade: r.grade })),
    Tricky:    results.filter(r => r.tier === 'Tricky').map(r => ({ level: r.level, grade: r.grade })),
    Taxing:    results.filter(r => r.tier === 'Taxing').map(r => ({ level: r.level, grade: r.grade })),
    Mayhem:    results.filter(r => r.tier === 'Mayhem').map(r => ({ level: r.level, grade: r.grade }))
  },
  levels: results
};
writeFileSync(join(reportDir, 'level-quality-audit.json'), JSON.stringify(report, null, 2), 'utf8');
console.log(`  Report: reports/level-quality-audit.json\n`);

// Gate mode
if (GATE) {
  if (criticalCount > 0) {
    console.error(`  GATE FAILED: ${criticalCount} critical issue(s) found.\n`);
    process.exitCode = 1;
  } else {
    console.log(`  GATE PASSED: No critical issues.\n`);
  }
}
