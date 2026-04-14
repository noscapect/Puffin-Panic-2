/**
 * route-sim.mjs
 *
 * Simulation-based route verifier for Puffin Panic 2 levels.
 * Uses actual game physics (walk, fall, step-up, bounce) with a DFS solver
 * that tries skill applications at obstacle points. Fully supports all 8 skills
 * including terrain-modifying ones (digger, miner, basher, bomber).
 *
 * Usage:
 *   node scripts/route-sim.mjs --file=levels/level_005.json [--verbose] [--no-fail]
 *   node scripts/route-sim.mjs --all [--out=reports/route-sim.json]
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, "..");

const W = 400;
const H = 220;
const PUFFIN_H = 12;
const PUFFIN_W = 8;
const FALL_DEATH = 70;
const MAX_STEP_UP = 6;

// ─── Arg parsing ─────────────────────────────────────────────────────────────
function parseArgs() {
  const args = {};
  for (let i = 2; i < process.argv.length; i++) {
    const tok = process.argv[i];
    if (!tok.startsWith("--")) continue;
    const eq = tok.indexOf("=");
    if (eq > 0) { args[tok.slice(2, eq)] = tok.slice(eq + 1); }
    else { args[tok.slice(2)] = true; }
  }
  return args;
}

// ─── Terrain helpers ─────────────────────────────────────────────────────────
function getTerrainPairs(level) {
  const src = Array.isArray(level.terrain) ? level.terrain
            : Array.isArray(level.data) ? level.data : [];
  if (src.length === 0) return [];
  if (Array.isArray(src[0])) {
    return src.filter(p => Array.isArray(p) && p.length >= 2)
              .map(p => [Number(p[0]) || 0, Math.max(0, Number(p[1]) || 0)]);
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

// ─── Terrain overlay (efficient copy-on-write terrain) ───────────────────────
class Terrain {
  constructor(base) {
    this.data = new Uint8Array(base);
  }
  idx(x, y) { return y * W + x; }
  get(x, y) {
    if (x < 0 || x >= W || y < 0 || y >= H) return 0;
    return this.data[this.idx(x, y)];
  }
  set(x, y, v) {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    this.data[this.idx(x, y)] = v;
  }
  solid(x, y) { return this.get(x, y) !== 0; }
  diggable(x, y, dir) {
    const v = this.get(x, y);
    if (v === 1) return true;
    if (v === 11) return dir > 0;
    if (v === 12) return dir < 0;
    return false;
  }
  snapshot() { return new Uint8Array(this.data); }
  restore(snap) { this.data.set(snap); }
}

// ─── Exit overlap check ─────────────────────────────────────────────────────
function atExit(px, py, exit) {
  const pad = 2;
  return px + PUFFIN_W > exit.x - pad &&
         px < exit.x + (exit.w || 20) + pad &&
         py + PUFFIN_H > exit.y - pad &&
         py < exit.y + (exit.h || 12) + pad;
}

// ─── Walk simulation: run puffin until obstacle/exit/death ──────────────────
// Returns: { event, x, y, dir, fallDist, edges: [{x,y,dir}] }
// 'edges' records cliff positions where skills could have been applied pre-fall
function walkUntilEvent(terrain, startX, startY, dir, exit, isFloater) {
  let x = startX, y = startY, vx = dir;
  const visited = new Set();
  const edges = []; // cliff edges encountered during walk
  let steps = 0;

  while (steps < 8000) {
    steps++;

    // Exit check
    if (atExit(x, y, exit)) return { event: "exit", x, y, dir: vx, edges };

    // Fall check
    const fx = Math.floor(x);
    const fy = Math.floor(y + PUFFIN_H + 1);
    if (!terrain.solid(fx, fy)) {
      // Record this edge position for the solver
      edges.push({ x, y, dir: vx });
      // Fall
      let fallStartY = y;
      let vy = 0;
      let landed = false;
      for (let fi = 0; fi < 500; fi++) {
        vy += 0.2;
        if (isFloater && vy > 1.0) vy = 1.0;
        if (!isFloater && vy > 3.0) vy = 3.0;
        const subSteps = Math.ceil(vy);
        for (let s = 0; s < subSteps; s++) {
          y += vy / subSteps;
          if (atExit(x, y, exit)) return { event: "exit", x, y, dir: vx, edges };
          const ly = Math.floor(y + PUFFIN_H);
          if (terrain.solid(Math.floor(x), ly)) {
            y = ly - PUFFIN_H - 1;
            while (terrain.solid(Math.floor(x), Math.floor(y + PUFFIN_H))) y--;
            landed = true;
            break;
          }
          if (y > H + 20) return { event: "dead", x, y, dir: vx, fallDist: 999, edges };
        }
        if (landed) break;
      }
      const fallDist = y - fallStartY;
      if (!landed) return { event: "dead", x, y, dir: vx, fallDist: 999, edges };
      if (fallDist > FALL_DEATH && !isFloater) return { event: "dead", x, y, dir: vx, fallDist, edges };
      continue;
    }

    // Walk step
    const nextX = x + vx;
    const nx = Math.floor(nextX);
    const wallMid = terrain.solid(nx, Math.floor(y + PUFFIN_H / 2));
    const wallBot = terrain.solid(nx, Math.floor(y + PUFFIN_H - 1));

    if (wallMid || wallBot) {
      let stepped = false;
      for (let step = 1; step <= MAX_STEP_UP; step++) {
        const ty = y - step;
        const headOk = !terrain.solid(nx, Math.floor(ty));
        const midOk  = !terrain.solid(nx, Math.floor(ty + PUFFIN_H / 2));
        const feetOk = !terrain.solid(nx, Math.floor(ty + PUFFIN_H - 1));
        if (headOk && midOk && feetOk) {
          x = nextX;
          y = ty;
          stepped = true;
          break;
        }
      }
      if (!stepped) {
        return { event: "wall", x, y, dir: vx, edges };
      }
    } else {
      x = nextX;
    }

    // Loop detection
    const pk = `${Math.floor(x)},${Math.floor(y)},${vx}`;
    if (visited.has(pk)) return { event: "loop", x, y, dir: vx, edges };
    if (steps % 4 === 0) visited.add(pk);
  }
  return { event: "loop", x, y, dir: vx, edges };
}

// ─── Skill simulations (modify terrain, return new puffin state) ─────────────

function applyBash(terrain, px, py, dir) {
  // Bash: carve horizontal tunnel 5w × 11h at body, advance 1px per stroke
  const bodyY = Math.floor(py + PUFFIN_H / 2);
  let cx = Math.floor(px + dir * 2);
  let totalCarved = 0;
  for (let stroke = 0; stroke < 30; stroke++) {
    let carved = false;
    for (let dy = -5; dy <= 5; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (terrain.diggable(cx + dx, bodyY + dy, dir)) {
          terrain.set(cx + dx, bodyY + dy, 0);
          carved = true;
        }
      }
    }
    if (!carved) break;
    totalCarved++;
    px += dir;
    cx = Math.floor(px + dir * 2);
  }
  if (totalCarved < 1) return null;
  return { x: px, y: py, dir };
}

function applyBuild(terrain, px, py, dir) {
  // Build: lay 4-wide × 2-high bricks, step x+=2*dir, y-=1 per brick, max 12 bricks
  let bx = px, by = py;
  for (let brick = 0; brick < 12; brick++) {
    const layX = Math.floor(bx + dir * 4);
    const layY = Math.floor(by + PUFFIN_H);
    // Check wall ahead
    if (terrain.solid(Math.floor(bx + dir * 4), Math.floor(by - 1 + PUFFIN_H / 2))) break;
    // Check leading edge
    const leadX = layX + dir * 3;
    if (terrain.solid(leadX, layY) || terrain.solid(leadX, layY - 1)) break;
    // Lay brick
    for (let i = 0; i < 4; i++) {
      terrain.set(layX + dir * i, layY, 1);
      terrain.set(layX + dir * i, layY - 1, 1);
    }
    bx += dir * 2;
    by -= 1;
  }
  if (Math.abs(bx - px) < 2) return null;
  return { x: bx, y: by, dir };
}

function applyClimb(terrain, px, py, dir) {
  // Climb: go up next to wall until reaching top
  const wx = Math.floor(px + dir); // wall x
  let cy = py;
  for (let step = 0; step < 220; step++) {
    // Check wall still there
    const feetY = Math.floor(cy + PUFFIN_H - 1);
    const wallThere = terrain.solid(wx, feetY) || terrain.solid(wx, feetY - 1) || terrain.solid(wx, feetY - 2);
    if (!wallThere) {
      // Reached top — pull up
      return { x: px + dir, y: cy - 1, dir };
    }
    // Check ceiling
    if (terrain.solid(Math.floor(px), Math.floor(cy - 1))) {
      // Hit ceiling — fall back
      return null;
    }
    cy -= 0.5; // climb speed
  }
  return null;
}

function applyDig(terrain, px, py, dir) {
  // Dig: carve 7-wide × 4-deep column, puffin moves 1 down per stroke  
  const cx = Math.floor(px);
  // puffin.y = py, feet at py + PUFFIN_H
  // After first y += 1, cy = floor(py + 1 + PUFFIN_H)
  let puffinY = py;
  let strokes = 0;
  for (let s = 0; s < 300; s++) {
    puffinY += 1;
    const cy = Math.floor(puffinY + PUFFIN_H);
    let carved = false;
    for (let dy = 0; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        if (terrain.diggable(cx + dx, cy + dy, dir)) {
          terrain.set(cx + dx, cy + dy, 0);
          carved = true;
        }
      }
    }
    if (!carved) break;
    strokes++;
  }
  if (strokes < 1) return null;
  return { x: px, y: puffinY, dir };
}

function applyMine(terrain, px, py, dir) {
  // Mine: diagonal tunnel, x += dir*0.5, y += 1 per stroke, carve 5×5 ahead
  let mx = px, my = py;
  let strokes = 0;
  for (let s = 0; s < 300; s++) {
    my += 1;
    mx += dir * 0.5;
    const cx = Math.floor(mx + dir * 3);
    const cy = Math.floor(my + PUFFIN_H);
    let carved = false;
    for (let dy = 0; dy <= 4; dy++) {
      for (let dx = 0; dx <= 4; dx++) {
        const tx = cx + dir * dx;
        const ty = cy + dy;
        if (terrain.diggable(tx, ty, dir)) {
          terrain.set(tx, ty, 0);
          carved = true;
        }
      }
    }
    if (!carved) break;
    strokes++;
  }
  if (strokes < 1) return null;
  return { x: mx, y: my, dir };
}

// ─── DFS solver ─────────────────────────────────────────────────────────────
function solve(baseTerrain, entrance, exit, skills, verbose) {
  // Find spawn position: drop from entrance to ground
  const terrain = new Terrain(baseTerrain);
  let spawnX = entrance.x;
  let spawnY = entrance.y;
  // Drop to ground
  for (let fy = Math.floor(spawnY); fy < H; fy++) {
    if (terrain.solid(Math.floor(spawnX), fy)) {
      spawnY = fy - PUFFIN_H - 1;
      break;
    }
  }

  const totalBudget = Object.values(skills).reduce((a, b) => a + Math.max(0, b), 0);
  const maxDepth = Math.min(totalBudget, 25); // max skill applications
  
  let bestClosest = Infinity;
  let explored = 0;
  let found = false;

  // Pre-compute "interesting dig/mine positions" — positions where the exit
  // is roughly below or diagonally below, and diggable terrain exists.
  const exitCX = (exit.x || 0) + ((exit.w || 20) / 2);
  const exitCY = (exit.y || 0) + ((exit.h || 12) / 2);
  
  function findProactivePositions(terrainSnap, px, py, dir) {
    // Walk trajectory without skills to find intermediate positions where
    // dig/mine toward exit would be meaningful
    const t = new Terrain(terrainSnap);
    const positions = [];
    let wx = px, wy = py, wdir = dir;
    const seen = new Set();
    
    for (let step = 0; step < 2000; step++) {
      // Exit check
      if (atExit(wx, wy, exit)) break;
      
      // Check if this is a good dig/mine position
      if (step % 8 === 0) {
        const digHasGround = t.solid(Math.floor(wx), Math.floor(wy + PUFFIN_H + 1));
        const digTerrainBelow = t.diggable(Math.floor(wx), Math.floor(wy + PUFFIN_H + 2), 0) ||
                                t.diggable(Math.floor(wx), Math.floor(wy + PUFFIN_H + 5), 0);
        
        // Dig if there's diggable terrain below (regardless of exit position)
        if (digHasGround && digTerrainBelow) {
          const pk = `${Math.floor(wx / 8)},${Math.floor(wy / 8)}`;
          if (!seen.has(pk)) {
            seen.add(pk);
            positions.push({ x: wx, y: wy, dir: wdir, type: "dig" });
          }
        }
        
        // Mine in direction of exit (or both dirs)
        for (const md of [-1, 1]) {
          const mineAheadX = Math.floor(wx + md * 4);
          const mineTerrainAhead = t.diggable(mineAheadX, Math.floor(wy + PUFFIN_H + 2), md) ||
                                   t.diggable(mineAheadX, Math.floor(wy + PUFFIN_H / 2), md);
          if (digHasGround && mineTerrainAhead) {
            const pk = `m${Math.floor(wx / 8)},${Math.floor(wy / 8)},${md}`;
            if (!seen.has(pk)) {
              seen.add(pk);
              positions.push({ x: wx, y: wy, dir: md, type: "mine" });
            }
          }
        }
      }
      
      // Simplified walk (no step-up to keep it fast)
      const fgy = Math.floor(wy + PUFFIN_H + 1);
      if (!t.solid(Math.floor(wx), fgy)) {
        // Fall
        for (let fy = Math.floor(wy); fy < H; fy++) {
          if (t.solid(Math.floor(wx), fy)) { wy = fy - PUFFIN_H - 1; break; }
          if (fy > wy + 120) { wy = H + 10; break; }
        }
        if (wy > H) break;
        continue;
      }
      const nnx = Math.floor(wx + wdir);
      if (t.solid(nnx, Math.floor(wy + PUFFIN_H / 2)) || t.solid(nnx, Math.floor(wy + PUFFIN_H - 1))) {
        wdir *= -1; // bounce
      } else {
        wx += wdir;
      }
    }
    
    // Limit to best 6 positions (closest to exit)
    positions.sort((a, b) => {
      const da = Math.abs(a.x - exitCX) + Math.abs(a.y - exitCY);
      const db = Math.abs(b.x - exitCX) + Math.abs(b.y - exitCY);
      return da - db;
    });
    return positions.slice(0, 10);
  }

  const visited = new Map(); // stateKey -> min depth

  function stateKey(x, y, dir, sk) {
    // Quantize position to 4px grid to merge similar states
    const qx = Math.floor(x / 4);
    const qy = Math.floor(y / 4);
    // Skills hash: encode remaining counts
    let sh = 0;
    for (const s of ["basher", "builder", "climber", "digger", "miner", "floater"]) {
      sh = sh * 11 + (sk[s] || 0);
    }
    return `${qx},${qy},${dir},${sh}`;
  }

  function dfs(terrainSnap, x, y, dir, sk, depth, path) {
    explored++;
    if (explored > 500000) return false; // safety limit

    // Restore terrain to this state
    terrain.restore(terrainSnap);
    const isFloater = (sk.floater || 0) > 0;

    // Walk until something happens
    const ev = walkUntilEvent(terrain, x, y, dir, exit, isFloater);

    if (ev.event === "exit") {
      found = true;
      return true;
    }

    // Track closest to exit
    const dist = Math.abs(ev.x - (exit.x + (exit.w || 20) / 2)) +
                 Math.abs(ev.y - (exit.y + (exit.h || 12) / 2));
    if (dist < bestClosest) bestClosest = dist;

    if (depth >= maxDepth) return false;

    // Memoization check
    const sk2 = stateKey(ev.x, ev.y, ev.dir, sk);
    const prevDepth = visited.get(sk2);
    if (prevDepth !== undefined && prevDepth <= depth) return false;
    visited.set(sk2, depth);

    // Determine applicable skills based on event
    let applicableSkills = [];
    if (ev.event === "wall") {
      applicableSkills = ["basher", "climber", "miner", "builder", "digger"];
    } else if (ev.event === "loop") {
      applicableSkills = ["basher", "builder", "climber", "digger", "miner"];
    }

    // Try bouncing (no skill cost) — puffin reverses at wall
    if (ev.event === "wall" || ev.event === "loop") {
      const bounceDir = -ev.dir;
      const bounceSk = stateKey(ev.x, ev.y, bounceDir, sk);
      const bp = visited.get(bounceSk);
      if (bp === undefined || bp > depth) {
        const snap = terrain.snapshot();
        if (dfs(snap, ev.x, ev.y, bounceDir, sk, depth, [...path, "bounce"])) return true;
      }
    }

    // Try each applicable skill
    for (const skill of applicableSkills) {
      if ((sk[skill] || 0) <= 0) continue;

      const snap = terrain.snapshot();
      terrain.restore(snap); // ensure clean state

      let result = null;
      switch (skill) {
        case "basher":  result = applyBash(terrain, ev.x, ev.y, ev.dir); break;
        case "builder": result = applyBuild(terrain, ev.x, ev.y, ev.dir); break;
        case "climber": result = applyClimb(terrain, ev.x, ev.y, ev.dir); break;
        case "digger":  result = applyDig(terrain, ev.x, ev.y, ev.dir); break;
        case "miner":   result = applyMine(terrain, ev.x, ev.y, ev.dir); break;
      }

      if (!result) {
        terrain.restore(snap);
        continue;
      }

      const newSk = { ...sk, [skill]: sk[skill] - 1 };
      const newSnap = terrain.snapshot();

      if (verbose) {
        const indent = "  ".repeat(depth);
        console.log(`${indent}[d=${depth}] ${skill}:${ev.dir > 0 ? "R" : "L"} at (${Math.round(ev.x)},${Math.round(ev.y)}) → (${Math.round(result.x)},${Math.round(result.y)})`);
      }

      if (dfs(newSnap, result.x, result.y, result.dir, newSk, depth + 1, [...path, `${skill}:${ev.dir > 0 ? "R" : "L"}`])) return true;

      terrain.restore(snap);
    }

    // Also try skill application in the opposite direction (e.g. mine backward)
    if (ev.event === "wall" || ev.event === "loop") {
      const revDir = -ev.dir;
      for (const skill of ["miner", "digger", "builder", "basher"]) {
        if ((sk[skill] || 0) <= 0) continue;
        const snap = terrain.snapshot();
        let result = null;
        switch (skill) {
          case "basher":  result = applyBash(terrain, ev.x, ev.y, revDir); break;
          case "builder": result = applyBuild(terrain, ev.x, ev.y, revDir); break;
          case "digger":  result = applyDig(terrain, ev.x, ev.y, revDir); break;
          case "miner":   result = applyMine(terrain, ev.x, ev.y, revDir); break;
        }
        if (!result) { terrain.restore(snap); continue; }
        const newSk = { ...sk, [skill]: sk[skill] - 1 };
        const newSnap = terrain.snapshot();
        if (dfs(newSnap, result.x, result.y, revDir, newSk, depth + 1, [...path, `${skill}:${revDir > 0 ? "R" : "L"}`])) return true;
        terrain.restore(snap);
      }
    }

    // Try skills at cliff edges encountered during the walk (build bridges, dig, mine)
    const edgeSkills = ["builder", "digger", "miner"];
    for (const ep of (ev.edges || []).slice(0, 4)) { // limit to first 4 edges
      for (const skill of edgeSkills) {
        if ((sk[skill] || 0) <= 0) continue;
        const snap = terrain.snapshot();
        terrain.restore(snap);
        let result = null;
        switch (skill) {
          case "builder": result = applyBuild(terrain, ep.x, ep.y, ep.dir); break;
          case "digger":  result = applyDig(terrain, ep.x, ep.y, ep.dir); break;
          case "miner":   result = applyMine(terrain, ep.x, ep.y, ep.dir); break;
        }
        if (!result) { terrain.restore(snap); continue; }
        const newSk = { ...sk, [skill]: sk[skill] - 1 };
        const newSnap = terrain.snapshot();
        if (verbose) {
          const indent = "  ".repeat(depth);
          console.log(`${indent}[d=${depth}] edge-${skill}:${ep.dir > 0 ? "R" : "L"} at (${Math.round(ep.x)},${Math.round(ep.y)}) → (${Math.round(result.x)},${Math.round(result.y)})`);
        }
        if (dfs(newSnap, result.x, result.y, result.dir, newSk, depth + 1, [...path, `edge-${skill}`])) return true;
        terrain.restore(snap);
      }
    }

    // Proactive dig/mine: find interesting positions along the walk trajectory
    // where digging/mining toward the exit would be useful
    if (depth < 3 && ((sk.digger || 0) > 0 || (sk.miner || 0) > 0)) {
      const proSnap = terrain.snapshot();
      const proactivePos = findProactivePositions(proSnap, ev.x, ev.y, ev.dir);
      terrain.restore(proSnap);

      for (const pp of proactivePos) {
        if (pp.type === "dig" && (sk.digger || 0) > 0) {
          const snap2 = terrain.snapshot();
          terrain.restore(snap2);
          const digR = applyDig(terrain, pp.x, pp.y, pp.dir);
          if (digR) {
            const newSk2 = { ...sk, digger: sk.digger - 1 };
            const newSnap2 = terrain.snapshot();
            if (verbose) console.log(`${"  ".repeat(depth)}[d=${depth}] proactive-dig at (${Math.round(pp.x)},${Math.round(pp.y)}) → (${Math.round(digR.x)},${Math.round(digR.y)})`);
            if (dfs(newSnap2, digR.x, digR.y, digR.dir, newSk2, depth + 1, [...path, "pro-dig"])) return true;
          }
          terrain.restore(snap2);
        }
        if (pp.type === "mine" && (sk.miner || 0) > 0) {
          const snap2 = terrain.snapshot();
          terrain.restore(snap2);
          const mineR = applyMine(terrain, pp.x, pp.y, pp.dir);
          if (mineR) {
            const newSk2 = { ...sk, miner: sk.miner - 1 };
            const newSnap2 = terrain.snapshot();
            if (verbose) console.log(`${"  ".repeat(depth)}[d=${depth}] proactive-mine:${pp.dir > 0 ? "R" : "L"} at (${Math.round(pp.x)},${Math.round(pp.y)}) → (${Math.round(mineR.x)},${Math.round(mineR.y)})`);
            if (dfs(newSnap2, mineR.x, mineR.y, mineR.dir, newSk2, depth + 1, [...path, `pro-mine:${pp.dir > 0 ? "R" : "L"}`])) return true;
          }
          terrain.restore(snap2);
        }
      }
    }

    return false;
  }

  const initSnap = terrain.snapshot();
  let totalExplored = 0;
  // Try both initial directions
  for (const initDir of [1, -1]) {
    visited.clear();
    explored = 0;
    if (dfs(initSnap, spawnX, spawnY, initDir, { ...skills }, 0, [])) {
      return { ok: true, explored: totalExplored + explored, closest: 0 };
    }
    totalExplored += explored;
  }

  return { ok: false, explored: totalExplored, closest: bestClosest };
}

// ─── Process one level ──────────────────────────────────────────────────────
function processLevel(filePath, verbose) {
  const raw = readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  const level = JSON.parse(raw);
  const pairs = getTerrainPairs(level);
  const data = decodeTerrain(pairs, W * H);

  const ent = level.entrance || { x: 40, y: 40 };
  const exit = level.exit || { x: W - 30, y: H - 25, w: 20, h: 12 };
  const skills = {};
  for (const s of ["climber", "floater", "bomber", "blocker", "builder", "basher", "digger", "miner"]) {
    skills[s] = Number((level.skills || {})[s] || 0);
  }

  const result = solve(data, ent, exit, skills, verbose);
  return { file: basename(filePath, ".json"), ...result };
}

// ─── Main ───────────────────────────────────────────────────────────────────
const args = parseArgs();
const verbose = !!args.verbose;

if (args.all) {
  const manifest = JSON.parse(readFileSync(join(root, "levels", "manifest.json"), "utf8"));
  const files = manifest.levels
    .map(f => join(root, "levels", f))
    .filter(f => existsSync(f));

  // Filter to only levels with dig/mine if --dig-mine-only
  let targets = files;
  if (args["dig-mine-only"]) {
    targets = files.filter(f => {
      const lv = JSON.parse(readFileSync(f, "utf8"));
      const sk = lv.skills || {};
      return (sk.miner || 0) > 0 || (sk.digger || 0) > 0;
    });
  }

  console.log(`\n=== Route Simulation: ${targets.length} levels ===\n`);

  const results = [];
  let ok = 0, fail = 0;
  for (const f of targets) {
    const r = processLevel(f, false);
    results.push(r);
    const icon = r.ok ? "✅" : "❌";
    console.log(`${icon} ${r.file.padEnd(12)} ${r.ok ? "SOLVABLE" : `NOT FOUND (closest=${r.closest})`}  explored=${r.explored}`);
    if (r.ok) ok++; else fail++;
  }

  console.log(`\n  Solvable: ${ok}/${results.length}  |  Failed: ${fail}/${results.length}\n`);

  const outPath = args.out || join(root, "reports", "route-sim.json");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify({
    total: results.length, solvable: ok, failed: fail,
    details: results, generatedAt: new Date().toISOString()
  }, null, 2));
  console.log(`Report: ${outPath}`);

  if (fail > 0 && !args["no-fail"]) process.exitCode = 2;
} else {
  const file = args.file || "levels/level_005.json";
  const r = processLevel(join(root, file), verbose);
  console.log(`${r.ok ? "SOLVABLE" : "NOT FOUND"}: ${r.file}  closest=${r.closest}  explored=${r.explored}`);
  if (!r.ok && !args["no-fail"]) process.exitCode = 2;
}
