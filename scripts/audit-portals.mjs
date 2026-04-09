#!/usr/bin/env node
/**
 * Audit all levels for portal placement issues.
 * Checks:
 *  1. Entrance/exit within bounds (400×220)
 *  2. Entrance not buried in solid terrain
 *  3. Exit not buried in solid terrain
 *  4. Entrance has ground reachable below (within fall-death distance)
 *  5. Exit has ground adjacent (puffins walk into it)
 *  6. Exit not floating in unreachable air
 */
import { readFileSync, readdirSync } from 'fs';
import { join, basename } from 'path';

const W = 400, H = 220;
const PUFFIN_W = 8, PUFFIN_H = 12;
const FALL_DEATH = 60;

const levelsDir = join(process.cwd(), 'levels');
const files = readdirSync(levelsDir)
    .filter(f => /^level_\d{3}\.json$/.test(f))
    .sort();

function decodeTerrain(rle) {
    const data = new Uint8Array(W * H);
    let idx = 0;
    for (const run of rle) {
        const [val, count] = run;
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

const issues = [];

for (const file of files) {
    const lvl = JSON.parse(readFileSync(join(levelsDir, file), 'utf-8'));
    const num = file.replace('level_', '').replace('.json', '');
    const label = `Level ${num} (${lvl.name || '?'})`;
    const terrain = decodeTerrain(lvl.terrain);
    const ent = lvl.entrance;
    const ext = lvl.exit;
    const lvlIssues = [];

    // --- BOUNDS ---
    if (ent.x < 0 || ent.x >= W || ent.y < 0 || ent.y >= H) {
        lvlIssues.push(`Entrance OUT OF BOUNDS (${ent.x},${ent.y})`);
    }
    if (ext.x < 0 || ext.x + ext.w > W || ext.y < 0 || ext.y + ext.h > H) {
        lvlIssues.push(`Exit OUT OF BOUNDS (${ext.x},${ext.y} ${ext.w}x${ext.h})`);
    }

    // --- ENTRANCE: puffin spawns at (ent.x, ent.y), body occupies ent.x..ent.x+7, ent.y..ent.y+11
    // Check if the puffin body area is blocked
    let entBlocked = 0;
    for (let dy = 0; dy < PUFFIN_H; dy++) {
        for (let dx = 0; dx < PUFFIN_W; dx++) {
            if (isSolid(terrain, ent.x + dx, ent.y + dy)) entBlocked++;
        }
    }
    if (entBlocked > PUFFIN_W * PUFFIN_H * 0.5) {
        lvlIssues.push(`Entrance BURIED in terrain (${entBlocked}/${PUFFIN_W*PUFFIN_H} pixels solid) at (${ent.x},${ent.y})`);
    }

    // Check ground reachable below entrance
    let groundBelow = -1;
    for (let dy = PUFFIN_H; dy < PUFFIN_H + FALL_DEATH + 20; dy++) {
        if (isSolid(terrain, ent.x + Math.floor(PUFFIN_W/2), ent.y + dy)) {
            groundBelow = dy;
            break;
        }
    }
    if (groundBelow === -1 && ent.y + PUFFIN_H < H - 10) {
        lvlIssues.push(`Entrance has NO GROUND below within ${FALL_DEATH+20}px — puffins will fall to death/void at (${ent.x},${ent.y})`);
    }

    // --- EXIT: box at ext.x, ext.y, ext.w, ext.h
    // Check if exit box area is mostly buried
    let exitBlocked = 0;
    let exitTotal = ext.w * ext.h;
    for (let dy = 0; dy < ext.h; dy++) {
        for (let dx = 0; dx < ext.w; dx++) {
            if (isSolid(terrain, ext.x + dx, ext.y + dy)) exitBlocked++;
        }
    }
    if (exitBlocked > exitTotal * 0.6) {
        lvlIssues.push(`Exit BURIED in terrain (${exitBlocked}/${exitTotal} pixels solid) at (${ext.x},${ext.y})`);
    }

    // Check if there's ground under/near exit (puffins walk into it)
    let exitGroundBelow = false;
    for (let dx = -2; dx < ext.w + 2; dx++) {
        if (isSolid(terrain, ext.x + dx, ext.y + ext.h) ||
            isSolid(terrain, ext.x + dx, ext.y + ext.h + 1) ||
            isSolid(terrain, ext.x + dx, ext.y + ext.h + 2)) {
            exitGroundBelow = true;
            break;
        }
    }
    if (!exitGroundBelow) {
        // Check if ground exists within a longer range (maybe exit is on a platform reachable by building)
        let anyGround = false;
        for (let dy = ext.h; dy < ext.h + FALL_DEATH; dy++) {
            for (let dx = -2; dx < ext.w + 2; dx++) {
                if (isSolid(terrain, ext.x + dx, ext.y + dy)) {
                    anyGround = true;
                    break;
                }
            }
            if (anyGround) break;
        }
        if (!anyGround) {
            lvlIssues.push(`Exit FLOATING — no ground below exit within ${FALL_DEATH}px at (${ext.x},${ext.y})`);
        }
    }

    // Check exit not off the edge of the map (clipped)
    if (ext.x < 2 || ext.x + ext.w > W - 2) {
        lvlIssues.push(`Exit very close to or past horizontal edge (${ext.x} to ${ext.x + ext.w})`);
    }
    if (ext.y < 2) {
        lvlIssues.push(`Exit very close to top edge (y=${ext.y})`);
    }
    if (ext.y + ext.h > H - 2) {
        lvlIssues.push(`Exit very close to or past bottom edge (y=${ext.y}+${ext.h}=${ext.y+ext.h})`);
    }

    // Check entrance not at very top (puffins need room above for trapdoor visual)
    if (ent.y < 5) {
        lvlIssues.push(`Entrance very close to top edge (y=${ent.y}) — trapdoor may be clipped`);
    }

    // Check if entrance and exit are at the same location (nonsensical)
    if (Math.abs(ent.x - ext.x) < 10 && Math.abs(ent.y - ext.y) < 10) {
        lvlIssues.push(`Entrance and Exit overlap or are very close (ent=${ent.x},${ent.y} exit=${ext.x},${ext.y})`);
    }

    if (lvlIssues.length > 0) {
        issues.push({ label, file, issues: lvlIssues, entrance: ent, exit: ext });
    }
}

console.log(`\n=== Portal Audit: ${files.length} levels scanned ===\n`);

if (issues.length === 0) {
    console.log('All levels passed portal checks!');
} else {
    console.log(`Found issues in ${issues.length} level(s):\n`);
    for (const { label, file, issues: lvlIssues, entrance, exit } of issues) {
        console.log(`${label} [${file}]`);
        console.log(`  entrance=(${entrance.x},${entrance.y})  exit=(${exit.x},${exit.y} ${exit.w}x${exit.h})`);
        for (const iss of lvlIssues) {
            console.log(`  ❌ ${iss}`);
        }
        console.log();
    }
}

process.exit(issues.length > 0 ? 1 : 0);
