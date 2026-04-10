#!/usr/bin/env node
/**
 * fix-skill-budgets.mjs
 * Reads route reports for all 99 levels. For any level where the route-analyzer
 * recommended more builder/basher/climber/floater than the level currently has,
 * patches the level JSON's skill counts upward to at least the recommended values.
 *
 * Safe: only ever increases skill counts, never reduces them.
 * Idempotent: re-running produces the same result.
 *
 * Guard against spiral: if a level already has significant unmodeled skills
 * (digger/miner/bomber >= DIG_THRESHOLD) AND the route was NOT found,
 * AND the recommended increase per skill is large (>= BIG_DELTA), skip it.
 * Those levels are designed to be solved via dig/mine/bomb, not more builders.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { resolve } from 'path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const LEVELS_DIR = resolve(ROOT, 'levels');
const REPORTS_DIR = resolve(ROOT, 'reports');

const MODELED_SKILLS = ['builder', 'basher', 'climber', 'floater'];
// If a level has this many dig/mine/bomb skills, it's a dig-route level —
// don't add modeled skills just because the heuristic can't traverse it.
const DIG_THRESHOLD = 2;
// Maximum number each skill may be increased BEYOND its original git-committed value.
const TOTAL_CAP_PER_SKILL = 4;

// Read original (committed) skill values from git HEAD for each level
function getOriginalSkills(n) {
  try {
    const raw = execSync(`git show HEAD:levels/level_${n}.json`, { cwd: ROOT, encoding: 'utf8' });
    return JSON.parse(raw).skills || {};
  } catch {
    return null; // not in git or error
  }
}

let patched = 0;
let skipped = 0;
let noReport = 0;
const patchLog = [];

for (let i = 1; i <= 99; i++) {
  const n = String(i).padStart(3, '0');
  const levelPath = resolve(LEVELS_DIR, `level_${n}.json`);
  const reportPath = resolve(REPORTS_DIR, `level_${n}.route.json`);

  if (!existsSync(levelPath)) { console.warn(`  SKIP: ${levelPath} not found`); continue; }
  if (!existsSync(reportPath)) {
    noReport++;
    console.warn(`  NO REPORT: level_${n} — run route-analyze first`);
    continue;
  }

  const level = JSON.parse(readFileSync(levelPath, 'utf8'));
  const report = JSON.parse(readFileSync(reportPath, 'utf8'));
  const route  = report.route;
  const origSkills = getOriginalSkills(n) || {};

  // Only patch if the analyzer found a recommendedBudget
  if (!route || !route.recommendedBudget) { skipped++; continue; }

  // Skip levels where route was NOT found AND they have significant dig/mine/bomb skills.
  // These are dig-route levels; the recommendation is heuristic noise, not a real fix.
  if (!route.ok) {
    const s = level.skills || {};
    const digCount = Number(s.digger || 0) + Number(s.miner || 0) + Number(s.bomber || 0);
    if (digCount >= DIG_THRESHOLD) {
      // Still check: if any single modeled skill delta from the ORIGINAL is small, allow it.
      const rec = route.recommendedBudget;
      const maxDeltaFromOrig = Math.max(
        ...MODELED_SKILLS.map(sk => Math.max(0, Number(rec[sk] || 0) - Number(origSkills[sk] || 0)))
      );
      if (maxDeltaFromOrig > TOTAL_CAP_PER_SKILL) {
        console.log(`  SKIP (dig-route) level_${n} "${level.name}" — delta from original ${maxDeltaFromOrig} exceeds cap`);
        skipped++;
        continue;
      }
    }
  }

  const rec = route.recommendedBudget; // absolute recommended minimums
  const skills = level.skills || {};
  let changed = false;
  const deltas = {};

  for (const sk of MODELED_SKILLS) {
    const cur   = Number(skills[sk] || 0);
    const orig  = Number(origSkills[sk] || 0);
    const need  = Number(rec[sk] || 0);
    // Cap at original + TOTAL_CAP_PER_SKILL to prevent runaway spiral
    const capped = Math.min(need, orig + TOTAL_CAP_PER_SKILL);
    if (capped > cur) {
      deltas[sk] = capped - cur;
      skills[sk] = capped;
      changed = true;
    }
  }

  if (!changed) { skipped++; continue; }

  // Surgical string replacement — preserve original file formatting.
  // Matches: "skillName":  <number>  (any amount of whitespace after colon)
  let text = readFileSync(levelPath, 'utf8');
  for (const [sk, newVal] of Object.entries(skills)) {
    if (!MODELED_SKILLS.includes(sk)) continue;
    // Replace the skill value in-place using regex (handles varied whitespace)
    text = text.replace(
      new RegExp(`("${sk}":\\s*)(\\d+)`),
      (_, prefix) => `${prefix}${newVal}`
    );
  }
  writeFileSync(levelPath, text);
  patched++;
  const deltaStr = Object.entries(deltas).map(([k, v]) => `+${v} ${k}`).join(', ');
  patchLog.push(`  level_${n} "${level.name}": ${deltaStr}`);
  console.log(`  PATCHED level_${n} "${level.name}": ${deltaStr}`);
}

console.log(`\nDone. Patched: ${patched}  Already OK: ${skipped}  No report: ${noReport}`);
if (patchLog.length) {
  console.log('\nPatched levels:');
  patchLog.forEach(l => console.log(l));
}
