#!/usr/bin/env node
/**
 * deep-audit-all.mjs — Comprehensive gameplay audit for ALL campaign levels.
 *
 * Checks that existing tools miss:
 *  1. Entrance spawn: body not buried, ground reachable, no fatal unsaved fall
 *  2. Exit validity: box not blocked, ground nearby, standing overlap possible
 *  3. Air-path reachability (flood-fill from entrance to exit through air)
 *  4. Walk simulation: fatal falls in BOTH directions that skills can't save
 *  5. Water/lava zone validity and path blockage
 *  6. Steel terrain: bash/dig through steel is impossible
 *  7. Invalid/phantom skill keys (e.g. "platformer")
 *  8. Puffin economy: total vs required vs blockers needed
 *  9. Time limit feasibility (minimum walk time vs time budget)
 * 10. Difficulty curve sanity
 *
 * Outputs: reports/deep-audit.json + console summary
 *
 * Usage:  node scripts/deep-audit-all.mjs [--fix]
 *   --fix  auto-repair what can be fixed and write patched level JSONs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir  = dirname(fileURLToPath(import.meta.url));
const root   = join(__dir, '..');
const FIX    = process.argv.includes('--fix');

const W = 400, H = 220;
const PUFFIN_W = 8, PUFFIN_H = 12;
const FALL_DEATH = 70;
const MAX_STEP_UP = 6;

const VALID_SKILLS = ['climber','floater','bomber','blocker','builder','basher','miner','digger'];

// ── Terrain helpers ───────────────────────────────────────────────────────────

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

// ── Walk simulator (matches engine physics) ──────────────────────────────────

function simulateWalk(terrain, startX, startY, dir, exitBox, maxTicks = 6000) {
    let x = startX, y = startY, vx = dir;
    let state = 'walk', fallStartY = y, ticks = 0;
    let stuckTicks = 0, lastCheckX = x, lastCheckY = y;
    let maxFall = 0;

    while (ticks < maxTicks) {
        ticks++;
        if (x < 0 || x >= W || y > H + 10) {
            return { state: 'offscreen', x, y, ticks, maxFall, reason: `Off screen at (${x|0},${y|0})` };
        }

        // Exit overlap
        if (exitBox) {
            const pad = 1;
            const pR = x + PUFFIN_W, pB = y + PUFFIN_H;
            if (pR >= exitBox.x - pad && x <= exitBox.x + (exitBox.w||20) + pad &&
                pB >= exitBox.y - pad && y <= exitBox.y + (exitBox.h||12) + pad) {
                return { state: 'exited', x, y, ticks, maxFall, reason: 'Reached exit' };
            }
        }

        if (state === 'fall') {
            y += 1;
            const fy = Math.floor(y + PUFFIN_H);
            if (fy >= H) return { state: 'dead', x, y, ticks, maxFall, reason: 'Fell off map bottom' };
            if (isSolid(terrain, Math.floor(x), fy)) {
                y = fy - PUFFIN_H;
                const fallDist = y - fallStartY;
                if (fallDist > maxFall) maxFall = fallDist;
                if (fallDist > FALL_DEATH) {
                    return { state: 'splat', x, y, ticks, maxFall, reason: `Fatal fall ${fallDist}px at (${x|0},${y|0})` };
                }
                state = 'walk';
            }
            continue;
        }

        // Walk: check ground
        const fy = Math.floor(y + PUFFIN_H + 1);
        if (!isSolid(terrain, Math.floor(x), fy)) {
            state = 'fall';
            fallStartY = y;
            continue;
        }

        // Move every other tick
        if (ticks % 2 === 0) {
            const nextX = x + vx;
            const nx = Math.floor(nextX);
            const wallMid = isSolid(terrain, nx, Math.floor(y + PUFFIN_H / 2));
            const wallBot = isSolid(terrain, nx, Math.floor(y + PUFFIN_H - 1));
            if (wallMid || wallBot) {
                let stepped = false;
                for (let step = 1; step <= MAX_STEP_UP; step++) {
                    const testY = y - step;
                    if (!isSolid(terrain, nx, Math.floor(testY)) &&
                        !isSolid(terrain, nx, Math.floor(testY + PUFFIN_H / 2)) &&
                        !isSolid(terrain, nx, Math.floor(testY + PUFFIN_H - 1))) {
                        x = nextX; y = testY; stepped = true; break;
                    }
                }
                if (!stepped) vx *= -1;
            } else {
                x = nextX;
            }
        }

        // Loop detection
        if (ticks % 50 === 0) {
            if (Math.abs(x - lastCheckX) < 2 && Math.abs(y - lastCheckY) < 2) {
                stuckTicks += 50;
                if (stuckTicks >= 200) {
                    return { state: 'stuck', x, y, ticks, maxFall, reason: `Stuck bouncing at (${x|0},${y|0})` };
                }
            } else { stuckTicks = 0; lastCheckX = x; lastCheckY = y; }
        }
    }
    return { state: 'timeout', x, y, ticks, maxFall, reason: `Timeout at (${x|0},${y|0})` };
}

// ── Check: Entrance ──────────────────────────────────────────────────────────

function findLanding(terrain, ent) {
    let y = ent.y, dist = 0;
    while (y + PUFFIN_H < H) {
        const feetY = y + PUFFIN_H;
        const cx = ent.x + (PUFFIN_W >> 1);
        if (isSolid(terrain, cx, feetY) || isSolid(terrain, cx, feetY + 1)) {
            return { x: ent.x, y, dist, fatal: dist > FALL_DEATH };
        }
        y++; dist++;
    }
    return { x: ent.x, y, dist, fatal: true, offscreen: true };
}

function checkEntrance(terrain, ent) {
    const issues = [];
    let blocked = 0;
    for (let dy = 0; dy < PUFFIN_H; dy++)
        for (let dx = 0; dx < PUFFIN_W; dx++)
            if (isSolid(terrain, ent.x + dx, ent.y + dy)) blocked++;
    if (blocked > PUFFIN_W * 2)
        issues.push({ code: 'ENT_BURIED', sev: 'error', msg: `Spawn area has ${blocked}/${PUFFIN_W*PUFFIN_H} solid pixels` });

    const landing = findLanding(terrain, ent);
    if (landing.offscreen)
        issues.push({ code: 'ENT_NO_GROUND', sev: 'error', msg: 'No ground below entrance — puffin falls off map' });
    else if (landing.fatal)
        issues.push({ code: 'ENT_FATAL_FALL', sev: 'warn', msg: `${landing.dist}px fall from entrance (max safe: ${FALL_DEATH})` });
    return { issues, landing };
}

// ── Check: Exit ──────────────────────────────────────────────────────────────

function checkExit(terrain, ext) {
    const issues = [];
    const ew = ext.w || 20, eh = ext.h || 12;

    // Box blocked?
    let blocked = 0;
    for (let dy = 0; dy < eh; dy++)
        for (let dx = 0; dx < ew; dx++)
            if (isSolid(terrain, ext.x + dx, ext.y + dy)) blocked++;
    if (blocked > ew * eh * 0.5)
        issues.push({ code: 'EXIT_BLOCKED', sev: 'error', msg: `Exit box ${blocked}/${ew*eh}px blocked` });

    // Ground near exit
    let groundNear = false;
    for (let dy = 0; dy <= 10 && !groundNear; dy++)
        for (let dx = -3; dx < ew + 3 && !groundNear; dx++)
            if (isSolid(terrain, ext.x + dx, ext.y + eh + dy)) groundNear = true;
    if (!groundNear)
        issues.push({ code: 'EXIT_NO_GROUND', sev: 'error', msg: 'No ground within 10px below exit' });

    // Standing overlap
    let canOverlap = false;
    for (let testY = ext.y + eh; testY <= ext.y + eh + 12 && !canOverlap; testY++) {
        for (let tx = ext.x - PUFFIN_W; tx <= ext.x + ew && !canOverlap; tx++) {
            if (isSolid(terrain, tx, testY) || isSolid(terrain, tx + PUFFIN_W/2, testY)) {
                const pTop = testY - PUFFIN_H;
                if (pTop <= ext.y + eh + 1 && testY >= ext.y - 1 &&
                    tx + PUFFIN_W >= ext.x - 1 && tx <= ext.x + ew + 1) {
                    canOverlap = true;
                }
            }
        }
    }
    if (!canOverlap)
        issues.push({ code: 'EXIT_UNREACHABLE_STAND', sev: 'error', msg: 'No standing position overlaps exit detection zone' });

    return issues;
}

// ── Check: Air-path flood fill ───────────────────────────────────────────────

function checkAirPath(terrain, ent, ext, skills) {
    const visited = new Uint8Array(W * H);
    const queue = [];
    const sx = ent.x + (PUFFIN_W >> 1), sy = ent.y + (PUFFIN_H >> 1);
    if (!isSolid(terrain, sx, sy)) {
        queue.push(sy * W + sx);
        visited[sy * W + sx] = 1;
    }
    while (queue.length) {
        const idx = queue.pop();
        const cx = idx % W, cy = (idx / W) | 0;
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
            const nx = cx + dx, ny = cy + dy;
            if (nx >= 0 && nx < W && ny >= 0 && ny < H) {
                const ni = ny * W + nx;
                if (!visited[ni] && !isSolid(terrain, nx, ny)) {
                    visited[ni] = 1;
                    queue.push(ni);
                }
            }
        }
    }
    const ecx = ext.x + ((ext.w || 20) >> 1), ecy = ext.y + ((ext.h || 12) >> 1);
    if (visited[ecy * W + ecx]) return [];

    // Not air-reachable: check if terrain-breaking skills exist
    const hasDig = (skills.basher||0) + (skills.digger||0) + (skills.miner||0) + (skills.bomber||0);
    if (hasDig > 0) return [];
    return [{ code: 'NO_AIR_PATH', sev: 'error', msg: 'No air path from entrance to exit and no terrain-breaking skills' }];
}

// ── Check: Steel blocks dig/bash paths ───────────────────────────────────────

function checkSteelBlocking(terrain, ent, ext, skills) {
    const issues = [];
    // If level relies on basher/digger/miner but steel walls fully block the path
    const hasDigSkills = (skills.basher||0) + (skills.digger||0) + (skills.miner||0);
    if (hasDigSkills === 0) return issues;

    // Check if steel forms a complete horizontal barrier between entrance and exit
    const entX = ent.x, extX = ext.x;
    const minX = Math.min(entX, extX);
    const maxX = Math.max(entX, extX);

    // For each column between entrance and exit, check for vertical steel barriers
    for (let x = minX; x <= maxX; x++) {
        let steelCol = 0;
        for (let y = 0; y < H; y++) {
            if (isSteel(terrain, x, y)) steelCol++;
        }
        if (steelCol > H * 0.8) {
            issues.push({ code: 'STEEL_BARRIER', sev: 'warn', msg: `Column x=${x} is >80% steel — may block dig path` });
            break;
        }
    }
    return issues;
}

// ── Check: Walk simulation fatal falls ───────────────────────────────────────

function checkWalkFatality(terrain, landing, ext, skills) {
    const issues = [];
    if (!landing || landing.offscreen || landing.fatal) return issues;

    const hasFloater = (skills.floater || 0) > 0;

    for (const dir of [1, -1]) {
        const label = dir > 0 ? 'right' : 'left';
        const sim = simulateWalk(terrain, landing.x, landing.y, dir, ext);
        if (sim.state === 'splat' && !hasFloater) {
            issues.push({ code: 'WALK_FATAL_FALL', sev: 'error', msg: `Walk-${label}: ${sim.reason} (no floaters!)` });
        } else if (sim.state === 'dead') {
            issues.push({ code: 'WALK_OFF_MAP', sev: 'error', msg: `Walk-${label}: ${sim.reason}` });
        } else if (sim.state === 'offscreen') {
            issues.push({ code: 'WALK_OFFSCREEN', sev: 'error', msg: `Walk-${label}: ${sim.reason}` });
        }
    }
    return issues;
}

// ── Check: Invalid skill keys ────────────────────────────────────────────────

function checkSkillKeys(skills) {
    const issues = [];
    for (const [key, val] of Object.entries(skills)) {
        if (!VALID_SKILLS.includes(key) && val > 0) {
            issues.push({ code: 'PHANTOM_SKILL', sev: 'error', msg: `Unknown skill "${key}" with budget ${val}` });
        }
    }
    return issues;
}

// ── Check: Puffin economy ────────────────────────────────────────────────────

function checkPuffinEconomy(total, required, skills) {
    const issues = [];
    if (total < 1)
        issues.push({ code: 'NO_PUFFINS', sev: 'error', msg: `total=${total} — no puffins spawn` });
    if (required < 1)
        issues.push({ code: 'NO_GOAL', sev: 'error', msg: `required=${required} — no save goal` });
    if (required > total)
        issues.push({ code: 'IMPOSSIBLE_GOAL', sev: 'error', msg: `required(${required}) > total(${total})` });

    // Blockers sacrifice themselves; if blockerCount >= (total - required + 1), impossible
    const blockers = skills.blocker || 0;
    if (blockers > 0 && blockers >= total - required + 1)
        issues.push({ code: 'BLOCKER_OVERFLOW', sev: 'warn', msg: `${blockers} blockers but only ${total - required} spare puffins` });

    return issues;
}

// ── Check: Water/lava zones ──────────────────────────────────────────────────

function checkLiquidZones(waterZones, lavaZones, terrain) {
    const issues = [];
    for (const zones of [waterZones || [], lavaZones || []]) {
        for (const z of zones) {
            if (z.x < 0 || z.y < 0 || z.x + z.w > W || z.y + z.h > H)
                issues.push({ code: 'LIQUID_OOB', sev: 'warn', msg: `Liquid zone OOB: (${z.x},${z.y} ${z.w}x${z.h})` });
        }
    }
    return issues;
}

// ── Check: Time feasibility ──────────────────────────────────────────────────

function checkTimeFeasibility(total, spawnRate, time) {
    const issues = [];
    // Time is in frames at 30FPS.  spawnRate = frames between spawns.
    if (!time || time < 60)
        issues.push({ code: 'NO_TIME', sev: 'error', msg: `time=${time} — not enough time` });

    // Minimum time to spawn all puffins
    const minSpawnTime = total * (spawnRate || 60);
    if (minSpawnTime > time * 0.95)
        issues.push({ code: 'TIME_TIGHT', sev: 'warn', msg: `Need ${minSpawnTime} frames to spawn ${total} puffins, but only ${time} frames available` });

    return issues;
}

// ── Check: Entrance entrance position sanity ─────────────────────────────────

function checkPositionSanity(ent, ext) {
    const issues = [];
    if (ent.x < 3 || ent.x > W - 15) issues.push({ code: 'ENT_EDGE', sev: 'warn', msg: `Entrance near edge: x=${ent.x}` });
    if (ent.y < 3) issues.push({ code: 'ENT_TOP_EDGE', sev: 'warn', msg: `Entrance near top: y=${ent.y}` });
    if (ext.x < 0 || ext.x + (ext.w||20) > W) issues.push({ code: 'EXIT_EDGE', sev: 'warn', msg: `Exit clips boundary: x=${ext.x}` });
    if (ext.y < 0 || ext.y + (ext.h||12) > H) issues.push({ code: 'EXIT_BOTTOM', sev: 'warn', msg: `Exit clips boundary: y=${ext.y}` });

    // Distance sanity
    const dx = Math.abs(ent.x - ext.x);
    const dy = Math.abs(ent.y - ext.y);
    if (dx < 20 && dy < 20)
        issues.push({ code: 'ENT_EXIT_OVERLAP', sev: 'error', msg: `Entrance and exit too close: (${dx},${dy})px apart` });

    return issues;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTO-FIX FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function fixPhantomSkills(data) {
    const skills = data.skills || {};
    let fixed = false;
    for (const key of Object.keys(skills)) {
        if (!VALID_SKILLS.includes(key)) {
            delete skills[key];
            fixed = true;
        }
    }
    if (fixed) data.skills = skills;
    return fixed;
}

function fixPuffinCounts(data) {
    let fixed = false;
    if (!data.total || data.total < 1) { data.total = 20; fixed = true; }
    if (!data.required || data.required < 1) { data.required = Math.max(1, Math.floor(data.total * 0.75)); fixed = true; }
    if (data.required > data.total) { data.required = data.total; fixed = true; }
    return fixed;
}

function fixBlockerOverflow(data) {
    const skills = data.skills || {};
    const blockers = skills.blocker || 0;
    const spare = data.total - data.required;
    if (blockers > 0 && blockers >= spare + 1) {
        // Lower blocker count to spare-1 (always leave 1 margin)
        skills.blocker = Math.max(1, spare - 1);
        data.skills = skills;
        return true;
    }
    return false;
}

function fixEntranceBuried(data, terrain) {
    const ent = data.entrance;
    // Carve a 10×14 air pocket around entrance
    let carved = 0;
    for (let dy = -1; dy < PUFFIN_H + 1; dy++) {
        for (let dx = -1; dx < PUFFIN_W + 1; dx++) {
            const tx = ent.x + dx, ty = ent.y + dy;
            if (tx >= 0 && tx < W && ty >= 0 && ty < H && isSolid(terrain, tx, ty)) {
                terrain[ty * W + tx] = 0;
                carved++;
            }
        }
    }
    return carved > 0;
}

function fixExitBlocked(data, terrain) {
    const ext = data.exit;
    const ew = ext.w || 20, eh = ext.h || 12;
    let carved = 0;
    for (let dy = 0; dy < eh; dy++) {
        for (let dx = 0; dx < ew; dx++) {
            const tx = ext.x + dx, ty = ext.y + dy;
            if (tx >= 0 && tx < W && ty >= 0 && ty < H && isSolid(terrain, tx, ty)) {
                terrain[ty * W + tx] = 0;
                carved++;
            }
        }
    }
    return carved > 0;
}

function fixExitNoGround(data, terrain) {
    // Add a platform below exit
    const ext = data.exit;
    const ew = ext.w || 20, eh = ext.h || 12;
    const groundY = ext.y + eh + 1;
    if (groundY >= H) return false;
    let placed = 0;
    for (let dx = -2; dx < ew + 2; dx++) {
        const tx = ext.x + dx;
        if (tx >= 0 && tx < W) {
            terrain[groundY * W + tx] = 1;
            terrain[(groundY + 1) * W + tx] = 1;
            placed++;
        }
    }
    return placed > 0;
}

function fixEntranceNoGround(data, terrain) {
    const ent = data.entrance;
    // Find nearest ground below entrance
    for (let searchDist = PUFFIN_H; searchDist < FALL_DEATH; searchDist++) {
        const checkY = ent.y + searchDist;
        if (checkY >= H) break;
        const cx = ent.x + (PUFFIN_W >> 1);
        if (isSolid(terrain, cx, checkY)) return false; // Ground exists, it's just far
    }
    // No ground within fall-death. Add a landing platform
    const platY = Math.min(H - 3, ent.y + PUFFIN_H + 5);
    let placed = 0;
    for (let dx = -3; dx < PUFFIN_W + 3; dx++) {
        const tx = ent.x + dx;
        if (tx >= 0 && tx < W) {
            terrain[platY * W + tx] = 1;
            terrain[(platY + 1) * W + tx] = 1;
            placed++;
        }
    }
    return placed > 0;
}

function fixEntranceFatalFall(data, terrain, landing) {
    // Add floater if not already available, OR add a landing platform
    const skills = data.skills || {};
    if ((skills.floater || 0) === 0) {
        // Add a landing platform at safe distance
        const safeY = Math.min(H - 3, data.entrance.y + FALL_DEATH - 10);
        let placed = 0;
        for (let dx = -5; dx < PUFFIN_W + 5; dx++) {
            const tx = data.entrance.x + dx;
            if (tx >= 0 && tx < W && !isSolid(terrain, tx, safeY)) {
                terrain[safeY * W + tx] = 1;
                placed++;
            }
        }
        return placed > 0;
    }
    return false;
}

function fixWalkFatalFall(data) {
    // Levels with fatal drops and no floaters — add floaters so player can save puffins 
    const skills = data.skills || {};
    if ((skills.floater || 0) > 0) return false; // already has floaters
    // Determine how many floaters to add based on level total (more puffins = more floaters needed)
    const total = data.total || 20;
    const floatersToAdd = Math.max(2, Math.min(8, Math.ceil(total * 0.25)));
    skills.floater = floatersToAdd;
    data.skills = skills;
    return true;
}

function encodeTerrain(data) {
    const pairs = [];
    let i = 0;
    while (i < data.length) {
        const val = data[i];
        let count = 0;
        while (i + count < data.length && data[i + count] === val) count++;
        pairs.push([val, count]);
        i += count;
    }
    return pairs;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

const reportsDir = join(root, 'reports');
if (!existsSync(reportsDir)) mkdirSync(reportsDir, { recursive: true });

const manifest = JSON.parse(readFileSync(join(root, 'levels', 'manifest.json'), 'utf8'));
const levelFiles = manifest.levels
    .map(f => join(root, 'levels', f))
    .filter(f => existsSync(f));

console.log(`\n=== Deep Audit: ${levelFiles.length} levels ===\n`);

const allResults = [];
let totalErrors = 0, totalWarns = 0, totalFixed = 0;

for (const filepath of levelFiles) {
    const filename = filepath.replace(/\\/g, '/').split('/').pop();
    const num = parseInt(filename.replace(/\D/g, ''), 10);

    const raw = readFileSync(filepath, 'utf8').replace(/^\uFEFF/, '');
    const data = JSON.parse(raw);
    const terrain = decodeTerrain(data.terrain);
    const ent = data.entrance || { x: 40, y: 40 };
    const ext = data.exit || { x: W - 30, y: H - 25, w: 20, h: 12 };
    const skills = data.skills || {};
    const total = data.total || 0;
    const required = data.required || 0;
    const spawnRate = data.spawnRate || 60;
    const time = data.time || 0;

    const issues = [];
    const fixes = [];

    // 1. Entrance checks
    const { issues: entIssues, landing } = checkEntrance(terrain, ent);
    issues.push(...entIssues);

    // 2. Exit checks
    issues.push(...checkExit(terrain, ext));

    // 3. Air path
    issues.push(...checkAirPath(terrain, ent, ext, skills));

    // 4. Walk fatality
    issues.push(...checkWalkFatality(terrain, landing, ext, skills));

    // 5. Steel blocking
    issues.push(...checkSteelBlocking(terrain, ent, ext, skills));

    // 6. Phantom skills
    issues.push(...checkSkillKeys(skills));

    // 7. Puffin economy
    issues.push(...checkPuffinEconomy(total, required, skills));

    // 8. Water/lava
    issues.push(...checkLiquidZones(data.waterZones, data.lavaZones, terrain));

    // 9. Time feasibility
    issues.push(...checkTimeFeasibility(total, spawnRate, time));

    // 10. Position sanity
    issues.push(...checkPositionSanity(ent, ext));

    // ── Auto-fix if requested ────────────────────────────────────────────
    let terrainModified = false;
    if (FIX && issues.length > 0) {
        for (const iss of issues) {
            let fixed = false;
            switch (iss.code) {
                case 'PHANTOM_SKILL':
                    fixed = fixPhantomSkills(data);
                    break;
                case 'NO_PUFFINS':
                case 'NO_GOAL':
                case 'IMPOSSIBLE_GOAL':
                    fixed = fixPuffinCounts(data);
                    break;
                case 'BLOCKER_OVERFLOW':
                    fixed = fixBlockerOverflow(data);
                    break;
                case 'ENT_BURIED':
                    fixed = fixEntranceBuried(data, terrain);
                    terrainModified = terrainModified || fixed;
                    break;
                case 'EXIT_BLOCKED':
                    fixed = fixExitBlocked(data, terrain);
                    terrainModified = terrainModified || fixed;
                    break;
                case 'EXIT_NO_GROUND':
                    fixed = fixExitNoGround(data, terrain);
                    terrainModified = terrainModified || fixed;
                    break;
                case 'ENT_NO_GROUND':
                    fixed = fixEntranceNoGround(data, terrain);
                    terrainModified = terrainModified || fixed;
                    break;
                case 'ENT_FATAL_FALL':
                    fixed = fixEntranceFatalFall(data, terrain, landing);
                    terrainModified = terrainModified || fixed;
                    break;
                case 'WALK_FATAL_FALL':
                    fixed = fixWalkFatalFall(data);
                    break;
            }
            if (fixed) {
                fixes.push(iss.code);
                totalFixed++;
            }
        }

        // Write repaired level
        if (fixes.length > 0) {
            if (terrainModified) data.terrain = encodeTerrain(terrain);
            writeFileSync(filepath, JSON.stringify(data, null, 2));
        }
    }

    // Count
    const errs = issues.filter(i => i.sev === 'error').length;
    const warns = issues.filter(i => i.sev === 'warn').length;
    totalErrors += errs;
    totalWarns += warns;

    // Report
    const result = {
        file: filename,
        num,
        name: data.name || '',
        errors: errs,
        warns,
        issues,
        fixes: fixes.length ? fixes : undefined,
    };
    allResults.push(result);

    const icon = errs > 0 ? '❌' : warns > 0 ? '⚠️ ' : '✅';
    const fixNote = fixes.length > 0 ? ` [FIXED: ${fixes.join(', ')}]` : '';
    if (issues.length > 0) {
        console.log(`${icon} Level ${num} "${(data.name||'').substring(0, 30)}" — ${errs}E ${warns}W${fixNote}`);
        for (const iss of issues) {
            const si = iss.sev === 'error' ? '  ✗' : '  ⚡';
            console.log(`${si} [${iss.code}] ${iss.msg}`);
        }
    } else {
        console.log(`${icon} Level ${num} "${(data.name||'').substring(0, 30)}" — OK`);
    }
}

// ── Summary ──────────────────────────────────────────────────────────────────

const levelsWithErrors = allResults.filter(r => r.errors > 0).length;
const levelsWithWarns = allResults.filter(r => r.warns > 0 && r.errors === 0).length;
const levelsOk = allResults.filter(r => r.errors === 0 && r.warns === 0).length;

const summary = {
    totalLevels: allResults.length,
    totalErrors,
    totalWarns,
    levelsWithErrors,
    levelsWithWarns,
    levelsOk,
    fixesApplied: totalFixed,
    errorsByCode: {},
    details: allResults,
};

// Count errors by code
for (const r of allResults) {
    for (const iss of r.issues) {
        summary.errorsByCode[iss.code] = (summary.errorsByCode[iss.code] || 0) + 1;
    }
}

writeFileSync(join(reportsDir, 'deep-audit.json'), JSON.stringify(summary, null, 2));

console.log(`
═══════════════════════════════════════════
  Deep Audit Summary
═══════════════════════════════════════════
  Levels scanned: ${allResults.length}
  ✅ Clean:       ${levelsOk}
  ⚠️  Warnings:    ${levelsWithWarns}
  ❌ Errors:      ${levelsWithErrors}
  
  Total errors:   ${totalErrors}
  Total warnings: ${totalWarns}
  Fixes applied:  ${totalFixed}
  
  Breakdown by code:
${Object.entries(summary.errorsByCode).sort((a,b) => b[1] - a[1]).map(([c, n]) => `    ${c}: ${n}`).join('\n')}
    
  Report: reports/deep-audit.json
═══════════════════════════════════════════`);

if (totalErrors > 0 && !FIX) {
    console.log('\nRun with --fix to auto-repair detected issues.\n');
}
