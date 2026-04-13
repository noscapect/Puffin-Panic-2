/**
 * level-inspect.mjs
 * 
 * Renders ASCII terrain for a level and performs structural solvability checks.
 * Usage: node scripts/level-inspect.mjs --file=levels/level_005.json
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, "..");
const W = 400, H = 220;

function parseArgs() {
  const args = {};
  for (let i = 2; i < process.argv.length; i++) {
    const tok = process.argv[i];
    if (!tok.startsWith("--")) continue;
    const eq = tok.indexOf("=");
    if (eq > 0) args[tok.slice(2, eq)] = tok.slice(eq + 1);
    else args[tok.slice(2)] = true;
  }
  return args;
}

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

function decodeTerrain(pairs) {
  const data = new Uint8Array(W * H);
  let idx = 0;
  for (const [val, count] of pairs) {
    for (let i = 0; i < count && idx < W * H; i++) data[idx++] = val;
  }
  return data;
}

function at(data, x, y) {
  if (x < 0 || x >= W || y < 0 || y >= H) return 0;
  return data[y * W + x];
}

function renderASCII(data, entrance, exit, scaleX = 4, scaleY = 4) {
  const cols = Math.ceil(W / scaleX);
  const rows = Math.ceil(H / scaleY);
  const lines = [];

  const ex = Math.floor(entrance.x / scaleX);
  const ey = Math.floor(entrance.y / scaleY);
  const xx = Math.floor(exit.x / scaleX);
  const xy = Math.floor(exit.y / scaleY);

  for (let r = 0; r < rows; r++) {
    let line = "";
    for (let c = 0; c < cols; c++) {
      if (c === ex && r === ey) { line += "E"; continue; }
      if (c === xx && r === xy) { line += "X"; continue; }

      // Sample the dominant terrain in this block
      let airCount = 0, softCount = 0, steelCount = 0;
      for (let dy = 0; dy < scaleY; dy++) {
        for (let dx = 0; dx < scaleX; dx++) {
          const v = at(data, c * scaleX + dx, r * scaleY + dy);
          if (v === 0) airCount++;
          else if (v === 10) steelCount++;
          else softCount++;
        }
      }
      const total = scaleX * scaleY;
      if (steelCount > total * 0.3) line += "#";
      else if (softCount > total * 0.5) line += ".";
      else if (softCount > 0) line += ":";
      else line += " ";
    }
    lines.push(line);
  }
  return lines.join("\n");
}

function analyzeStructure(data, entrance, exit, skills) {
  const issues = [];

  // Check for steel barriers between entrance and exit
  const minX = Math.min(entrance.x, exit.x);
  const maxX = Math.max(entrance.x, exit.x);

  let steelBarriers = 0;
  for (let x = minX; x <= maxX; x++) {
    let allBlocked = true;
    for (let y = 0; y < H; y++) {
      const v = at(data, x, y);
      if (v === 0 || v === 1) { allBlocked = false; break; }
    }
    if (allBlocked) steelBarriers++;
  }
  if (steelBarriers > 0) {
    issues.push(`CRITICAL: ${steelBarriers} full-height steel barrier column(s) between entrance and exit!`);
  }

  // Check exit reachability - is exit surrounded by steel?
  const ex = exit.x, ey = exit.y;
  let exitBlocked = true;
  for (let dy = -15; dy <= 0; dy++) {
    for (let dx = -10; dx <= 10; dx++) {
      const v = at(data, ex + dx, ey + dy);
      if (v === 0 || v === 1) { exitBlocked = false; break; }
    }
    if (!exitBlocked) break;
  }
  if (exitBlocked) {
    issues.push("WARNING: Exit appears to be embedded in steel/solid terrain");
  }

  // Check if exit is above entrance and no upward skills
  if (exit.y < entrance.y) {
    const heightDiff = entrance.y - exit.y;
    const hasClimber = (skills.climber || 0) > 0;
    const hasBuilder = (skills.builder || 0) > 0;
    if (!hasClimber && !hasBuilder) {
      issues.push(`CRITICAL: Exit is ${heightDiff}px ABOVE entrance with NO climber and NO builder!`);
    } else if (!hasClimber) {
      // Each builder bridge gains ~6px height over 12 steps
      const maxHeight = (skills.builder || 0) * 6;
      if (maxHeight < heightDiff) {
        issues.push(`WARNING: Exit is ${heightDiff}px above, builders can gain ~${maxHeight}px max (${skills.builder} builders × 6px)`);
      }
    }
  }

  // Check for fatal falls if no floater
  if ((skills.floater || 0) === 0) {
    // Find longest vertical air gap along likely path  
    let maxDrop = 0;
    for (let x = minX; x <= maxX; x++) {
      let currentDrop = 0;
      for (let y = 0; y < H; y++) {
        if (at(data, x, y) === 0) currentDrop++;
        else { maxDrop = Math.max(maxDrop, currentDrop); currentDrop = 0; }
      }
      maxDrop = Math.max(maxDrop, currentDrop);
    }
    if (maxDrop >= 70) {
      issues.push(`WARNING: No floater and max air gap is ${maxDrop}px (death at 70px). May need careful routing.`);
    }
  }

  // Analyze terrain composition between entrance and exit
  let totalCells = 0, airCells = 0, softCells = 0, steelCells = 0;
  for (let x = minX; x <= maxX; x++) {
    for (let y = 0; y < H; y++) {
      totalCells++;
      const v = at(data, x, y);
      if (v === 0) airCells++;
      else if (v === 10) steelCells++;
      else softCells++;
    }
  }

  return { issues, steelBarriers, terrain: { total: totalCells, air: airCells, soft: softCells, steel: steelCells } };
}

// ─── Main ────────────────────────────────────────────────────────────────────
const args = parseArgs();
const filePath = args.file ? join(root, args.file) : null;
if (!filePath) { console.error("Usage: --file=levels/level_005.json"); process.exit(1); }

const level = JSON.parse(readFileSync(filePath, "utf8"));
const pairs = getTerrainPairs(level);
const data = decodeTerrain(pairs);
const entrance = level.entrance;
const exit = level.exit;
const skills = level.skills || {};

console.log(`\n=== ${level.name || args.file} ===`);
console.log(`Entrance: (${entrance.x}, ${entrance.y})  Exit: (${exit.x}, ${exit.y})`);
console.log(`Skills: ${JSON.stringify(skills)}`);
console.log(`Puffins: ${level.numPuffins || "?"} need ${level.numToSave || "?"}`);
console.log();

// ASCII render
console.log("Terrain (E=entrance, X=exit, #=steel, .=soft, :=sparse, space=air):");
console.log(renderASCII(data, entrance, exit));
console.log();

// Structural analysis
const analysis = analyzeStructure(data, entrance, exit, skills);
console.log("Terrain composition (entrance-exit corridor):");
console.log(`  Air: ${analysis.terrain.air} (${(analysis.terrain.air / analysis.terrain.total * 100).toFixed(1)}%)`);
console.log(`  Soft: ${analysis.terrain.soft} (${(analysis.terrain.soft / analysis.terrain.total * 100).toFixed(1)}%)`);
console.log(`  Steel: ${analysis.terrain.steel} (${(analysis.terrain.steel / analysis.terrain.total * 100).toFixed(1)}%)`);

if (analysis.issues.length > 0) {
  console.log("\nIssues found:");
  for (const issue of analysis.issues) console.log(`  - ${issue}`);
} else {
  console.log("\nNo structural issues found — level appears solvable in principle.");
}
