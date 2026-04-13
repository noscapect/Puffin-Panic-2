#!/usr/bin/env node
/**
 * qa-exit-physics.mjs
 *
 * Simulates runtime exit portal gravity for each level and reports levels where
 * the exit moves after spawn (especially first-tick movement).
 *
 * Usage:
 *   node scripts/qa-exit-physics.mjs [--ticks=240] [--gate] [--gate-threshold=4] [--fix]
 *
 * Output:
 *   reports/exit-physics-audit.json
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, '..');

const W = 400;
const H = 220;
const MIN_SUPPORT = 0.4;
const DEFAULT_TICKS = 240;
const DEFAULT_GATE_THRESHOLD = 4;

const ticksArg = process.argv.find(a => a.startsWith('--ticks='));
const maxTicks = ticksArg ? Math.max(1, parseInt(ticksArg.split('=')[1], 10) || DEFAULT_TICKS) : DEFAULT_TICKS;
const gateArg = process.argv.find(a => a.startsWith('--gate-threshold='));
const gateThreshold = gateArg
  ? Math.max(0, parseInt(gateArg.split('=')[1], 10) || DEFAULT_GATE_THRESHOLD)
  : DEFAULT_GATE_THRESHOLD;
const gateMode = process.argv.includes('--gate') || Boolean(gateArg);
const fixMode = process.argv.includes('--fix');

function decodeTerrain(rle) {
  const data = new Uint8Array(W * H);
  let idx = 0;
  if (!Array.isArray(rle)) return data;
  for (const run of rle) {
    if (!Array.isArray(run) || run.length < 2) continue;
    const val = run[0];
    const count = run[1];
    for (let i = 0; i < count && idx < data.length; i++) {
      data[idx++] = val;
    }
  }
  return data;
}

function isSolid(terrain, x, y) {
  if (x < 0 || x >= W || y < 0 || y >= H) return false;
  return terrain[y * W + x] !== 0;
}

function computeSupport(terrain, exit) {
  const bottomY = Math.floor(exit.y + exit.h);
  const x0 = Math.floor(exit.x);
  const x1 = Math.floor(exit.x + exit.w);
  const portalW = Math.max(1, x1 - x0);

  let solidCount = 0;
  let solidSumX = 0;

  for (let x = x0; x < x1; x++) {
    if (x < 0 || x >= W) continue;
    if (isSolid(terrain, x, bottomY)) {
      solidCount++;
      solidSumX += x;
    }
  }

  const supportRatio = solidCount / portalW;
  const supportCenterX = solidCount > 0 ? (solidSumX / solidCount) : null;
  const portalCenterX = (x0 + x1) / 2;

  return {
    bottomY,
    x0,
    x1,
    portalW,
    solidCount,
    supportRatio,
    supportCenterX,
    portalCenterX
  };
}

function stepExitGravity(terrain, exit) {
  const before = { x: exit.x, y: exit.y };
  const support = computeSupport(terrain, exit);

  if (support.bottomY >= H - 1) {
    return { moved: false, reason: 'floor', support };
  }

  if (support.supportRatio >= MIN_SUPPORT) {
    return { moved: false, reason: 'stable', support };
  }

  if (support.solidCount === 0) {
    exit.y += 1;
    return { moved: true, reason: 'free_fall', supportBefore: support, before, after: { x: exit.x, y: exit.y } };
  }

  if (support.supportCenterX < support.portalCenterX - 0.5) {
    exit.x += 1;
  } else if (support.supportCenterX > support.portalCenterX + 0.5) {
    exit.x -= 1;
  }
  exit.y += 1;
  return { moved: true, reason: 'tipping', supportBefore: support, before, after: { x: exit.x, y: exit.y } };
}

function auditLevel(filePath) {
  const raw = JSON.parse(readFileSync(filePath, 'utf8'));
  const terrain = decodeTerrain(raw.terrain);
  const initial = {
    x: raw.exit?.x ?? 340,
    y: raw.exit?.y ?? 78,
    w: raw.exit?.w ?? 20,
    h: raw.exit?.h ?? 12
  };
  const sim = { ...initial };

  const spawnSupport = computeSupport(terrain, sim);
  let firstTickMoved = false;
  let firstTickReason = 'stable';
  let movedTicks = 0;
  let movedX = 0;
  let movedY = 0;

  for (let t = 1; t <= maxTicks; t++) {
    const step = stepExitGravity(terrain, sim);
    if (t === 1) {
      firstTickMoved = step.moved;
      firstTickReason = step.reason;
    }
    if (step.moved) {
      movedTicks++;
      movedX = sim.x - initial.x;
      movedY = sim.y - initial.y;
    }
    if (!step.moved && step.reason === 'stable') {
      break;
    }
    if (!step.moved && step.reason === 'floor') {
      break;
    }
  }

  const finalSupport = computeSupport(terrain, sim);

  return {
    filePath,
    file: filePath.replace(/\\/g, '/').split('/').pop(),
    name: raw.name || '',
    initialExit: initial,
    finalExit: { x: sim.x, y: sim.y, w: sim.w, h: sim.h },
    spawnSupportRatio: Number(spawnSupport.supportRatio.toFixed(3)),
    finalSupportRatio: Number(finalSupport.supportRatio.toFixed(3)),
    firstTickMoved,
    firstTickReason,
    movedTicks,
    deltaX: sim.x - initial.x,
    deltaY: sim.y - initial.y,
    movedAtAll: movedTicks > 0
  };
}

function buildReport(results) {
  const moved = results.filter(r => r.movedAtAll);
  const movedFirstTick = results.filter(r => r.firstTickMoved);
  const movedFar = results.filter(r => r.deltaY >= 8 || Math.abs(r.deltaX) >= 4);
  const gateViolations = results.filter(r => r.deltaY > gateThreshold || Math.abs(r.deltaX) > gateThreshold);

  return {
    levels: results.length,
    ticksSimulated: maxTicks,
    movedAtAll: moved.length,
    movedFirstTick: movedFirstTick.length,
    movedFar: movedFar.length,
    gate: {
      enabled: gateMode,
      threshold: gateThreshold,
      violations: gateViolations.length
    },
    summary: {
      stableAtSpawn: results.length - movedFirstTick.length,
      unstableAtSpawn: movedFirstTick.length
    },
    topMovers: [...moved]
      .sort((a, b) => (Math.abs(b.deltaY) + Math.abs(b.deltaX)) - (Math.abs(a.deltaY) + Math.abs(a.deltaX)))
      .slice(0, 25),
    gateViolations: gateViolations.map(v => ({
      file: v.file,
      name: v.name,
      deltaX: v.deltaX,
      deltaY: v.deltaY,
      movedTicks: v.movedTicks
    })),
    details: results
  };
}

function applyFixes(results) {
  const violators = results.filter(r => r.deltaY > gateThreshold || Math.abs(r.deltaX) > gateThreshold);
  let fixed = 0;

  for (const v of violators) {
    const raw = JSON.parse(readFileSync(v.filePath, 'utf8'));
    const exit = raw.exit || {};
    const nx = v.finalExit.x;
    const ny = v.finalExit.y;
    const changed = (exit.x !== nx) || (exit.y !== ny);
    if (!changed) continue;
    raw.exit = { ...exit, x: nx, y: ny };
    writeFileSync(v.filePath, JSON.stringify(raw, null, 2));
    fixed++;
  }

  return { fixed, violators: violators.length };
}

const levelsDir = join(root, 'levels');
const files = readdirSync(levelsDir)
  .filter(f => /^level_\d{3}\.json$/.test(f))
  .sort();

let results = files.map(f => auditLevel(join(levelsDir, f)));
if (fixMode) {
  const fixResult = applyFixes(results);
  console.log(`Applied exit spawn fixes: ${fixResult.fixed}/${fixResult.violators} violating levels`);
  results = files.map(f => auditLevel(join(levelsDir, f)));
}

const moved = results.filter(r => r.movedAtAll);
const movedFirstTick = results.filter(r => r.firstTickMoved);
const movedFar = results.filter(r => r.deltaY >= 8 || Math.abs(r.deltaX) >= 4);
const gateViolations = results.filter(r => r.deltaY > gateThreshold || Math.abs(r.deltaX) > gateThreshold);
const report = buildReport(results);

const reportsDir = join(root, 'reports');
if (!existsSync(reportsDir)) mkdirSync(reportsDir, { recursive: true });
const outPath = join(reportsDir, 'exit-physics-audit.json');
writeFileSync(outPath, JSON.stringify(report, null, 2));

console.log(`Exit physics QA complete: ${results.length} levels`);
console.log(`  first-tick movement: ${movedFirstTick.length}`);
console.log(`  moved at all:        ${moved.length}`);
console.log(`  moved far:           ${movedFar.length}`);
if (gateMode) {
  console.log(`  gate threshold:      ${gateThreshold}px`);
  console.log(`  gate violations:     ${gateViolations.length}`);
}
console.log('  report: reports/exit-physics-audit.json');

if (gateMode && gateViolations.length > 0) {
  console.log('  gate status:         FAIL');
  process.exitCode = 1;
} else if (gateMode) {
  console.log('  gate status:         PASS');
}
