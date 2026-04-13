/**
 * structural-check.mjs
 * 
 * Checks levels for definitive structural unsolvability:
 * 1. Exit above entrance with insufficient upward skills
 * 2. Full steel barriers between entrance and exit
 * 3. Fatal falls required with no floater
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, "..");
const W = 400, H = 220;

function decodeTerrain(level) {
  const src = Array.isArray(level.terrain) ? level.terrain
    : Array.isArray(level.data) ? level.data : [];
  const pairs = [];
  if (src.length === 0) return new Uint8Array(W * H);
  if (Array.isArray(src[0])) {
    for (const p of src) pairs.push([Number(p[0]) || 0, Math.max(0, Number(p[1]) || 0)]);
  } else {
    for (let i = 0; i + 1 < src.length; i += 2) {
      const a = Number(src[i]) || 0, b = Math.max(0, Number(src[i + 1]) || 0);
      if (a > 1 && (b === 0 || b === 1)) pairs.push([b, a]);
      else pairs.push([a, b]);
    }
  }
  const data = new Uint8Array(W * H);
  let idx = 0;
  for (const [v, c] of pairs) for (let i = 0; i < c && idx < W * H; i++) data[idx++] = v;
  return data;
}

function at(data, x, y) {
  if (x < 0 || x >= W || y < 0 || y >= H) return 10;
  return data[y * W + x];
}

const levels = [
  "level_005", "level_027", "level_036", "level_037", "level_038", "level_039",
  "level_044", "level_050", "level_051", "level_059", "level_066", "level_087"
];

for (const name of levels) {
  const level = JSON.parse(readFileSync(join(root, "levels", name + ".json"), "utf8"));
  const data = decodeTerrain(level);
  const ent = level.entrance, ex = level.exit;
  const skills = level.skills || {};
  const issues = [];

  // 1. Check entrance fall
  let entFallDist = 0;
  for (let y = ent.y; y < H; y++) {
    if (at(data, ent.x + 4, y) !== 0) break;
    entFallDist++;
  }

  // Find first surface below entrance
  let entSurface = ent.y;
  for (let y = ent.y; y < H; y++) {
    if (at(data, ent.x + 4, y) !== 0) { entSurface = y; break; }
  }

  // 2. Find all reachable surfaces from entrance platform via walking (simple)
  // Just check: what's the highest surface the puffin can reach near the exit X?
  
  // 3. Check if exit is reachable vertically
  // Exit hitbox: y range [exit.y - 1, exit.y + 13]
  const exitBottom = ex.y + 13; // bottom of exit hitbox
  
  // Find the surface the puffin would walk on near the exit
  // A puffin on a surface at surfaceY has top at surfaceY - 12
  // It overlaps exit if puffinTop <= exitBottom => surfaceY - 12 <= exit.y + 13
  // AND puffinBottom >= exitTop => surfaceY >= exit.y - 1
  // So: exit.y - 1 <= surfaceY <= exit.y + 25
  
  // Find surfaces at exit X column
  const exitSurfaces = [];
  for (let y = 1; y < H; y++) {
    if (at(data, ex.x + 4, y - 1) === 0 && at(data, ex.x + 4, y) !== 0) {
      exitSurfaces.push(y);
    }
  }
  
  // Check if any exit surface allows overlap with exit hitbox
  let canReachExitVertically = false;
  for (const sy of exitSurfaces) {
    if (sy >= ex.y - 1 && sy <= ex.y + 25) {
      canReachExitVertically = true;
      break;
    }
  }
  
  // Check height difference issues
  if (ex.y < ent.y) {
    const heightDiff = entSurface - ex.y;
    const hasClimber = (skills.climber || 0) > 0;
    const builders = skills.builder || 0;
    const maxBuildHeight = builders * 6;
    
    if (!hasClimber && maxBuildHeight < heightDiff && heightDiff > 15) {
      issues.push(`EXIT ${heightDiff}px ABOVE entrance surface (builders gain ${maxBuildHeight}px, need climber)`);
    }
  }
  
  // Check for steel barriers
  const minX = Math.min(ent.x, ex.x), maxX = Math.max(ent.x, ex.x);
  let steelBarriers = 0;
  for (let x = minX; x <= maxX; x++) {
    let blocked = true;
    for (let y = 0; y < H; y++) {
      const v = at(data, x, y);
      if (v === 0 || v === 1) { blocked = false; break; }
    }
    if (blocked) steelBarriers++;
  }
  if (steelBarriers > 0) issues.push(`${steelBarriers} full steel barrier columns`);
  
  // Check minimum required fall from entrance
  if (entFallDist >= 70 && (skills.floater || 0) === 0) {
    issues.push(`Entrance fall ${entFallDist}px with no floater`);
  }

  // Report
  const tag = issues.length > 0 ? "⚠️ " : "✓  ";
  console.log(`${tag}${name}  ent=(${ent.x},${ent.y}) exit=(${ex.x},${ex.y})  exitSurfaces=[${exitSurfaces}]`);
  if (issues.length > 0) {
    for (const i of issues) console.log(`     ${i}`);
  }
}
