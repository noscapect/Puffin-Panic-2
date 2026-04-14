import fs from "node:fs/promises";
import path from "node:path";

const GAME_WIDTH = 400;
const GAME_HEIGHT = 220;
const PUFFIN_H = 12;
const FALL_DEATH_DIST = 70;

function parseArgs() {
  const args = {};
  for (let i = 2; i < process.argv.length; i++) {
    const tok = process.argv[i];
    if (!tok.startsWith("--")) continue;
    const [k, v] = tok.slice(2).split("=");
    if (v !== undefined) args[k] = v;
    else if (i + 1 < process.argv.length && !process.argv[i + 1].startsWith("--")) args[k] = process.argv[++i];
    else args[k] = true;
  }
  return args;
}

function getTerrainPairs(level) {
  const src = Array.isArray(level.terrain) ? level.terrain : Array.isArray(level.data) ? level.data : [];
  if (src.length === 0) return [];

  if (Array.isArray(src[0])) {
    return src
      .filter((p) => Array.isArray(p) && p.length >= 2)
      .map((p) => [Number(p[0]) || 0, Math.max(0, Number(p[1]) || 0)]);
  }

  const pairs = [];
  for (let i = 0; i + 1 < src.length; i += 2) {
    const a = Number(src[i]) || 0;
    const b = Math.max(0, Number(src[i + 1]) || 0);
    if (a > 1 && (b === 0 || b === 1)) pairs.push([b, a]);
    else pairs.push([a, b]);
  }
  return pairs;
}

function decodeTerrain(pairs, size) {
  const out = new Uint8Array(size);
  let idx = 0;
  for (const [value, count] of pairs) {
    for (let i = 0; i < count && idx < size; i++) out[idx++] = value;
    if (idx >= size) break;
  }
  return out;
}

function key(x, y) {
  return `${x},${y}`;
}

function isSolid(data, w, h, x, y) {
  if (x < 0 || x >= w || y < 0 || y >= h) return false;
  return data[y * w + x] !== 0;
}

function isTopSurface(data, w, h, x, y) {
  return isSolid(data, w, h, x, y) && !isSolid(data, w, h, x, y - 1);
}

function getTopPoints(data, w, h) {
  const points = [];
  const pointByKey = new Map();
  for (let y = 1; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (isTopSurface(data, w, h, x, y)) {
        const p = { id: points.length, x, y };
        points.push(p);
        pointByKey.set(key(x, y), p);
      }
    }
  }
  return { points, pointByKey };
}

function nearestTopPoint(points, tx, ty, radius = 80) {
  let best = null;
  let bestD = Infinity;
  for (const p of points) {
    const dx = p.x - tx;
    const dy = p.y - ty;
    const d = Math.abs(dx) + Math.abs(dy) * 1.5;
    if (Math.abs(dx) <= radius && Math.abs(dy) <= radius && d < bestD) {
      best = p;
      bestD = d;
    }
  }
  return best;
}

function buildRowIndex(points) {
  const rows = new Map();
  for (const p of points) {
    if (!rows.has(p.y)) rows.set(p.y, []);
    rows.get(p.y).push(p);
  }
  for (const arr of rows.values()) arr.sort((a, b) => a.x - b.x);
  return rows;
}

function findStepNeighbor(pointByKey, x, y, dir) {
  const nx = x + dir;
  for (const dy of [0, -1, 1]) {
    const p = pointByKey.get(key(nx, y + dy));
    if (p) return p;
  }
  return null;
}

function findFallLanding(pointByKey, data, w, h, x, y) {
  for (let ny = y + 1; ny < h; ny++) {
    for (const dx of [0, -1, 1]) {
      const p = pointByKey.get(key(x + dx, ny));
      if (p) return p;
    }
    if (ny - y > 130) break;
  }
  return null;
}

function hasWallAtBody(data, w, h, x, y, dir) {
  const cx = x + dir;
  const bodyY = Math.max(1, y - Math.floor(PUFFIN_H / 2));
  return isSolid(data, w, h, cx, bodyY);
}

function isDiggable(data, w, h, x, y, dir) {
  if (x < 0 || x >= w || y < 0 || y >= h) return false;
  const val = data[y * w + x];
  if (val === 1) return true;
  if (val === 11) return dir > 0;
  if (val === 12) return dir < 0;
  return false;
}

// Digger: carves straight down in a 7-wide x 4-deep column per stroke,
// moving 1px down per stroke. Stops when nothing in the carve zone is diggable.
function findDiggerCandidate(pointByKey, points, data, w, h, from) {
  const cx = from.x;
  // Check if there's diggable terrain right below the surface
  let hasDiggableBelow = false;
  for (let dy = 0; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      if (isDiggable(data, w, h, cx + dx, from.y + dy, 0)) {
        hasDiggableBelow = true; break;
      }
    }
    if (hasDiggableBelow) break;
  }
  if (!hasDiggableBelow) return null;

  // Simulate strokes: at depth n, carve zone is (cx-3..cx+3, from.y+n .. from.y+n+3)
  let n = 0;
  while (n < h - from.y - 4) {
    let anyDig = false;
    for (let dy = 0; dy <= 3 && !anyDig; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        if (isDiggable(data, w, h, cx + dx, from.y + n + dy, 0)) {
          anyDig = true; break;
        }
      }
    }
    if (!anyDig) break;
    n++;
  }
  if (n < 3) return null; // trivial dig

  // Puffin exits dig at approximate depth from.y + n, then falls to next surface
  const exitY = from.y + n;
  // Search for existing surface points near the exit
  for (let ny = exitY; ny < Math.min(h, exitY + 130); ny++) {
    for (const dx of [0, -1, 1, -2, 2, -3, 3]) {
      const p = pointByKey.get(key(cx + dx, ny));
      if (p && p.id !== from.id) return p;
    }
  }
  return null;
}

// Miner: carves diagonally (forward + down). Moves x += dir*0.5, y += 1 per stroke.
// Carves 5x5 area ahead. Stops when nothing is diggable.
function findMinerCandidate(pointByKey, points, data, w, h, from, dir) {
  const startX = from.x;
  // Check if there's diggable terrain ahead-and-below
  const probeX = Math.floor(startX + dir * 3);
  let hasDiggable = false;
  for (let dy = 0; dy <= 4 && !hasDiggable; dy++) {
    for (let dx = 0; dx <= 4; dx++) {
      if (isDiggable(data, w, h, probeX + dir * dx, from.y + dy, dir)) {
        hasDiggable = true; break;
      }
    }
  }
  if (!hasDiggable) return null;

  // Simulate mining strokes
  let mx = startX;
  let my = from.y;
  let strokes = 0;
  while (strokes < 300) {
    my += 1;
    mx += dir * 0.5;
    const cx = Math.floor(mx + dir * 3);
    const cy = my;
    let anyDig = false;
    for (let dy = 0; dy <= 4 && !anyDig; dy++) {
      for (let dx = 0; dx <= 4; dx++) {
        if (isDiggable(data, w, h, cx + dir * dx, cy + dy, dir)) {
          anyDig = true; break;
        }
      }
    }
    if (!anyDig) break;
    strokes++;
  }
  if (strokes < 3) return null;

  // Find landing near exit point
  const exitX = Math.floor(mx);
  const exitY = Math.floor(my);
  for (let ny = exitY; ny < Math.min(h, exitY + 130); ny++) {
    for (const dx of [0, dir, -dir, dir * 2, -dir * 2, dir * 3]) {
      const p = pointByKey.get(key(exitX + dx, ny));
      if (p && p.id !== from.id) return p;
    }
  }
  // Wider search
  let best = null, bestD = Infinity;
  for (const p of points) {
    if (p.id === from.id) continue;
    const ddx = Math.abs(p.x - exitX);
    const ddy = p.y - exitY;
    if (ddx <= 20 && ddy >= -5 && ddy <= 130) {
      const d = ddx + Math.abs(ddy);
      if (d < bestD) { bestD = d; best = p; }
    }
  }
  return best;
}

function findBuilderCandidate(points, data, w, h, from, dir) {
  const minGap = 4;
  const maxGap = 72; // increased from 28 to handle wider builder bridges (up to ~18 bricks)
  let best = null;
  let bestCost = Infinity;

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
      if (isSolid(data, w, h, ix, iy - 1)) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;

    const c = Math.abs(dx) + Math.abs(dy) * 2;
    if (c < bestCost) {
      bestCost = c;
      best = p;
    }
  }

  return best;
}

function findBasherCandidate(pointByKey, data, w, h, from, dir) {
  const bodyY = Math.max(1, from.y - Math.floor(PUFFIN_H / 2));
  let thickness = 0;
  let x = from.x + dir;

  while (x >= 0 && x < w && thickness < 30 && isSolid(data, w, h, x, bodyY)) {
    thickness++;
    x += dir;
  }

  if (thickness < 2 || thickness >= 30) return null;
  for (const oy of [0, -1, 1, 2]) {
    const p = pointByKey.get(key(x, from.y + oy));
    if (p) return p;
  }
  return null;
}

function findClimberCandidate(pointByKey, data, w, h, from, dir) {
  if (!hasWallAtBody(data, w, h, from.x, from.y, dir)) return null;
  const wx = from.x + dir;
  let best = null;

  for (let ny = from.y - 1; ny >= Math.max(2, from.y - 210); ny--) { // no engine height limit; search whole wall
    const p = pointByKey.get(key(wx, ny));
    if (!p) continue;
    let wallValid = false;
    for (let cy = ny; cy <= from.y; cy++) {
      if (isSolid(data, w, h, wx, cy)) {
        wallValid = true;
        break;
      }
    }
    if (wallValid) {
      best = p;
      break;
    }
  }

  return best;
}

class MinHeap {
  constructor() {
    this.arr = [];
  }
  push(item) {
    this.arr.push(item);
    this._up(this.arr.length - 1);
  }
  pop() {
    if (this.arr.length === 0) return null;
    const root = this.arr[0];
    const end = this.arr.pop();
    if (this.arr.length > 0) {
      this.arr[0] = end;
      this._down(0);
    }
    return root;
  }
  _up(i) {
    while (i > 0) {
      const p = Math.floor((i - 1) / 2);
      if (this.arr[p].score <= this.arr[i].score) break;
      [this.arr[p], this.arr[i]] = [this.arr[i], this.arr[p]];
      i = p;
    }
  }
  _down(i) {
    const n = this.arr.length;
    while (true) {
      let s = i;
      const l = i * 2 + 1;
      const r = i * 2 + 2;
      if (l < n && this.arr[l].score < this.arr[s].score) s = l;
      if (r < n && this.arr[r].score < this.arr[s].score) s = r;
      if (s === i) break;
      [this.arr[s], this.arr[i]] = [this.arr[i], this.arr[s]];
      i = s;
    }
  }
  get size() {
    return this.arr.length;
  }
}

function skillBudget(level) {
  const s = level.skills || {};
  return {
    builder: Number(s.builder || 0),
    basher: Number(s.basher || 0),
    climber: Number(s.climber || 0),
    floater: Number(s.floater || 0),
    digger: Number(s.digger || 0),
    miner: Number(s.miner || 0)
  };
}

function withinBudget(used, budget) {
  return used.builder <= budget.builder &&
    used.basher <= budget.basher &&
    used.climber <= budget.climber &&
    used.floater <= budget.floater &&
    used.digger <= budget.digger &&
    used.miner <= budget.miner;
}

function cloneUsed(used) {
  return { builder: used.builder, basher: used.basher, climber: used.climber, floater: used.floater, digger: used.digger, miner: used.miner };
}

function stateKey(nodeId, used) {
  return `${nodeId}|b${used.builder}|h${used.basher}|c${used.climber}|f${used.floater}|d${used.digger}|m${used.miner}`;
}

function heuristicallyAnalyze(level, data, w, h) {
  const { points, pointByKey } = getTopPoints(data, w, h);
  const rows = buildRowIndex(points);
  const budget = skillBudget(level);

  const ent = level.entrance || { x: 40, y: 40 };
  const exit = level.exit || { x: w - 30, y: h - 25, w: 20, h: 12 };

  const spawn = nearestTopPoint(points, Math.floor(ent.x), Math.floor(ent.y + PUFFIN_H + 1), 140);
  const exitCandidates = points.filter((p) => p.x >= exit.x && p.x <= (exit.x + (exit.w || 20)) && p.y >= exit.y && p.y <= (exit.y + (exit.h || 12) + 3));
  const fallbackExit = nearestTopPoint(points, Math.floor(exit.x + (exit.w || 20) / 2), Math.floor(exit.y + (exit.h || 12) + 1), 140);

  if (!spawn || (!fallbackExit && exitCandidates.length === 0)) {
    return {
      ok: false,
      reason: "Could not locate spawn or exit standable surfaces.",
      spawn: spawn || null,
      exit: fallbackExit || null,
      budget,
      used: null,
      nodes: points.length
    };
  }

  const targetSet = new Set((exitCandidates.length ? exitCandidates : [fallbackExit]).map((p) => p.id));
  const targetRef = (exitCandidates.length ? exitCandidates[0] : fallbackExit);

  const heap = new MinHeap();
  const startUsed = { builder: 0, basher: 0, climber: 0, floater: 0, digger: 0, miner: 0 };
  const startState = {
    node: spawn,
    used: startUsed,
    dist: 0,
    score: 0,
    prev: null,
    action: "spawn"
  };

  heap.push(startState);
  const best = new Map();
  best.set(stateKey(spawn.id, startUsed), 0);

  let winner = null;
  let iterations = 0;
  const maxIterations = 800000;
  const blockedByBudget = { builder: 0, basher: 0, climber: 0, floater: 0, digger: 0, miner: 0 };
  let closest = {
    distToExit: Infinity,
    node: spawn,
    used: cloneUsed(startUsed),
    steps: 0
  };

  while (heap.size > 0 && iterations < maxIterations) {
    iterations++;
    const cur = heap.pop();
    const curKey = stateKey(cur.node.id, cur.used);
    const known = best.get(curKey);
    if (known !== undefined && cur.dist > known) continue;

    const distToExit = Math.abs(cur.node.x - targetRef.x) + Math.abs(cur.node.y - targetRef.y);
    if (distToExit < closest.distToExit) {
      closest = {
        distToExit,
        node: cur.node,
        used: cloneUsed(cur.used),
        steps: cur.dist
      };
    }

    if (targetSet.has(cur.node.id)) {
      winner = cur;
      break;
    }

    for (const dir of [-1, 1]) {
      const step = findStepNeighbor(pointByKey, cur.node.x, cur.node.y, dir);
      if (step) {
        const nd = cur.dist + 1;
        const ns = {
          node: step,
          used: cloneUsed(cur.used),
          dist: nd,
          score: nd,
          prev: cur,
          action: `walk:${dir > 0 ? "R" : "L"}`
        };
        const k = stateKey(ns.node.id, ns.used);
        if (!best.has(k) || nd < best.get(k)) {
          best.set(k, nd);
          heap.push(ns);
        }
      } else {
        const landing = findFallLanding(pointByKey, data, w, h, cur.node.x, cur.node.y);
        if (landing) {
          const fallDist = landing.y - cur.node.y;
          const used = cloneUsed(cur.used);
          if (fallDist > FALL_DEATH_DIST) used.floater += 1;
          if (withinBudget(used, budget)) {
            const nd = cur.dist + 3;
            const ns = {
              node: landing,
              used,
              dist: nd,
              score: nd + (used.floater * 40),
              prev: cur,
              action: `fall:${dir > 0 ? "R" : "L"}`
            };
            const k = stateKey(ns.node.id, ns.used);
            if (!best.has(k) || nd < best.get(k)) {
              best.set(k, nd);
              heap.push(ns);
            }
          } else if (used.floater > budget.floater) {
            blockedByBudget.floater += 1;
          }
        }

        const bld = findBuilderCandidate(points, data, w, h, cur.node, dir);
        if (bld) {
          const used = cloneUsed(cur.used);
          used.builder += 1;
          if (withinBudget(used, budget)) {
            const nd = cur.dist + 7;
            const ns = {
              node: bld,
              used,
              dist: nd,
              score: nd + used.builder * 25,
              prev: cur,
              action: `build:${dir > 0 ? "R" : "L"}`
            };
            const k = stateKey(ns.node.id, ns.used);
            if (!best.has(k) || nd < best.get(k)) {
              best.set(k, nd);
              heap.push(ns);
            }
          } else if (used.builder > budget.builder) {
            blockedByBudget.builder += 1;
          }
        }

        const bash = findBasherCandidate(pointByKey, data, w, h, cur.node, dir);
        if (bash) {
          const used = cloneUsed(cur.used);
          used.basher += 1;
          if (withinBudget(used, budget)) {
            const nd = cur.dist + 8;
            const ns = {
              node: bash,
              used,
              dist: nd,
              score: nd + used.basher * 30,
              prev: cur,
              action: `bash:${dir > 0 ? "R" : "L"}`
            };
            const k = stateKey(ns.node.id, ns.used);
            if (!best.has(k) || nd < best.get(k)) {
              best.set(k, nd);
              heap.push(ns);
            }
          } else if (used.basher > budget.basher) {
            blockedByBudget.basher += 1;
          }
        }

        const climb = findClimberCandidate(pointByKey, data, w, h, cur.node, dir);
        if (climb) {
          const used = cloneUsed(cur.used);
          used.climber += 1;
          if (withinBudget(used, budget)) {
            const nd = cur.dist + 8;
            const ns = {
              node: climb,
              used,
              dist: nd,
              score: nd + used.climber * 28,
              prev: cur,
              action: `climb:${dir > 0 ? "R" : "L"}`
            };
            const k = stateKey(ns.node.id, ns.used);
            if (!best.has(k) || nd < best.get(k)) {
              best.set(k, nd);
              heap.push(ns);
            }
          } else if (used.climber > budget.climber) {
            blockedByBudget.climber += 1;
          }
        }
      }
    }

    // Digger — available from any standing point, digs straight down
    {
      const digTarget = findDiggerCandidate(pointByKey, points, data, w, h, cur.node);
      if (digTarget) {
        const used = cloneUsed(cur.used);
        used.digger += 1;
        if (withinBudget(used, budget)) {
          const nd = cur.dist + 10;
          const ns = {
            node: digTarget,
            used,
            dist: nd,
            score: nd + used.digger * 30,
            prev: cur,
            action: "dig"
          };
          const k = stateKey(ns.node.id, ns.used);
          if (!best.has(k) || nd < best.get(k)) {
            best.set(k, nd);
            heap.push(ns);
          }
        } else if (used.digger > budget.digger) {
          blockedByBudget.digger += 1;
        }
      }
    }

    // Miner — available from any standing point, mines diagonally in each direction
    for (const mdir of [-1, 1]) {
      const mineTarget = findMinerCandidate(pointByKey, points, data, w, h, cur.node, mdir);
      if (mineTarget) {
        const used = cloneUsed(cur.used);
        used.miner += 1;
        if (withinBudget(used, budget)) {
          const nd = cur.dist + 12;
          const ns = {
            node: mineTarget,
            used,
            dist: nd,
            score: nd + used.miner * 30,
            prev: cur,
            action: `mine:${mdir > 0 ? "R" : "L"}`
          };
          const k = stateKey(ns.node.id, ns.used);
          if (!best.has(k) || nd < best.get(k)) {
            best.set(k, nd);
            heap.push(ns);
          }
        } else if (used.miner > budget.miner) {
          blockedByBudget.miner += 1;
        }
      }
    }
  }

  if (!winner) {
    const suggestion = [];
    const sorted = Object.entries(blockedByBudget).sort((a, b) => b[1] - a[1]);
    for (const [skill, hits] of sorted) {
      if (hits > 0) suggestion.push(`Consider increasing ${skill} (budget pressure seen ${hits} times).`);
    }
    if (suggestion.length === 0) suggestion.push("Likely topology issue: adjust trench lips, add flatter bridge shoulder, or reduce vertical cliff steps.");

    const recommendedDelta = {
      builder: blockedByBudget.builder > 0 ? 2 : 0,
      basher: blockedByBudget.basher > 0 ? 1 : 0,
      climber: blockedByBudget.climber > 0 ? 2 : 0,
      floater: blockedByBudget.floater > 0 ? 1 : 0,
      digger: blockedByBudget.digger > 0 ? 1 : 0,
      miner: blockedByBudget.miner > 0 ? 1 : 0
    };
    const recommendedBudget = {
      builder: budget.builder + recommendedDelta.builder,
      basher: budget.basher + recommendedDelta.basher,
      climber: budget.climber + recommendedDelta.climber,
      floater: budget.floater + recommendedDelta.floater,
      digger: budget.digger + recommendedDelta.digger,
      miner: budget.miner + recommendedDelta.miner
    };

    return {
      ok: false,
      reason: "No route found with current heuristic operations and skill budget.",
      spawn,
      exit: fallbackExit,
      budget,
      used: null,
      nodes: points.length,
      iterations,
      closest,
      blockedByBudget,
      suggestion,
      recommendedDelta,
      recommendedBudget
    };
  }

  const actions = [];
  let p = winner;
  while (p) {
    actions.push({ x: p.node.x, y: p.node.y, action: p.action, used: p.used });
    p = p.prev;
  }
  actions.reverse();

  const used = winner.used;
  const headActions = [];
  for (const a of actions) {
    if (headActions.length === 0 || headActions[headActions.length - 1].action !== a.action) headActions.push(a.action);
  }

  return {
    ok: true,
    reason: "Route found by heuristic graph search.",
    spawn,
    exit: points.find((pt) => pt.id === winner.node.id) || fallbackExit,
    budget,
    used,
    actions: headActions,
    steps: winner.dist,
    nodes: points.length,
    iterations
  };
}

async function main() {
  const args = parseArgs();
  const file = args.file || "levels/level_999.json";
  const width = Number(args.width || GAME_WIDTH);
  const height = Number(args.height || GAME_HEIGHT);
  const out = args.out || `reports/${path.basename(file, path.extname(file))}.route.json`;
  const noFail = Boolean(args["no-fail"] || args.noFail);

  const raw = await fs.readFile(file, "utf8");
  const level = JSON.parse(raw.replace(/^\uFEFF/, ""));
  const pairs = getTerrainPairs(level);
  const data = decodeTerrain(pairs, width * height);

  const result = heuristicallyAnalyze(level, data, width, height);

  const report = {
    file: path.resolve(file),
    mapSize: { width, height, cells: width * height },
    route: result,
    generatedAt: new Date().toISOString()
  };

  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, JSON.stringify(report, null, 2), "utf8");

  console.log(`Route ${result.ok ? "FOUND" : "NOT FOUND"}: ${path.basename(file)}`);
  if (result.used) {
    console.log(`Used skills => builder:${result.used.builder}, basher:${result.used.basher}, climber:${result.used.climber}, floater:${result.used.floater}, digger:${result.used.digger}, miner:${result.used.miner}`);
  }
  console.log(`Report: ${path.resolve(out)}`);

  if (!result.ok && !noFail) process.exitCode = 2;
}

main().catch((err) => {
  console.error(err?.stack || err?.message || String(err));
  process.exit(1);
});
