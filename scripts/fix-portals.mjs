#!/usr/bin/env node
/**
 * Fix portal placements for levels flagged by audit-portals.
 * For each broken level:
 *   - If entrance is buried: clear a column of air above the entrance or move it up to open air
 *   - If entrance has no ground: find the nearest ground column and relocate entrance above it
 *   - If exit is buried: clear terrain around exit
 *   - If exit is floating: move exit down to nearest ground
 * Also clears a safe landing zone around entrance/exit portals.
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const W = 400, H = 220;
const PUFFIN_W = 8, PUFFIN_H = 12;
const FALL_DEATH = 60;

const levelsDir = join(process.cwd(), 'levels');

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

function encodeTerrain(data) {
    const rle = [];
    let i = 0;
    while (i < data.length) {
        const val = data[i];
        let count = 1;
        while (i + count < data.length && data[i + count] === val && count < 65535) {
            count++;
        }
        rle.push([val, count]);
        i += count;
    }
    return rle;
}

function isSolid(terrain, x, y) {
    if (x < 0 || x >= W || y < 0 || y >= H) return false;
    return terrain[y * W + x] !== 0;
}

function set(terrain, x, y, v) {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    terrain[y * W + x] = v;
}

// Check if a puffin body fits at (px,py) — all PUFFIN_W×PUFFIN_H pixels are air
function bodyFits(terrain, px, py) {
    for (let dy = 0; dy < PUFFIN_H; dy++) {
        for (let dx = 0; dx < PUFFIN_W; dx++) {
            if (isSolid(terrain, px + dx, py + dy)) return false;
        }
    }
    return true;
}

// Find ground below point (center x), returns y of first solid or -1
function findGroundBelow(terrain, cx, startY, maxDist) {
    for (let dy = 0; dy < maxDist; dy++) {
        if (isSolid(terrain, cx, startY + dy)) return startY + dy;
    }
    return -1;
}

// Clear a rectangle of terrain to air
function clearRect(terrain, x, y, w, h) {
    for (let dy = 0; dy < h; dy++) {
        for (let dx = 0; dx < w; dx++) {
            const tx = x + dx, ty = y + dy;
            if (tx >= 0 && tx < W && ty >= 0 && ty < H) {
                // Only clear diggable terrain (val=1), leave steel (val=10)
                if (terrain[ty * W + tx] === 1) {
                    terrain[ty * W + tx] = 0;
                }
            }
        }
    }
}

function fixLevel(file) {
    const path = join(levelsDir, file);
    const lvl = JSON.parse(readFileSync(path, 'utf-8'));
    const num = file.replace('level_', '').replace('.json', '');
    const terrain = decodeTerrain(lvl.terrain);
    let ent = lvl.entrance;
    let ext = lvl.exit;
    const fixes = [];

    // === FIX ENTRANCE ===

    // Check if entrance is buried
    let entBlocked = 0;
    for (let dy = 0; dy < PUFFIN_H; dy++) {
        for (let dx = 0; dx < PUFFIN_W; dx++) {
            if (isSolid(terrain, ent.x + dx, ent.y + dy)) entBlocked++;
        }
    }

    if (entBlocked > PUFFIN_W * PUFFIN_H * 0.5) {
        // Strategy: search upward from entrance to find open air, or carve a cavity
        let found = false;
        for (let dy = 0; dy <= ent.y; dy++) {
            let testY = ent.y - dy;
            if (testY < 5) break;
            let blocked = 0;
            for (let cy = 0; cy < PUFFIN_H; cy++) {
                for (let cx = 0; cx < PUFFIN_W; cx++) {
                    if (isSolid(terrain, ent.x + cx, testY + cy)) blocked++;
                }
            }
            if (blocked === 0) {
                ent.y = testY;
                fixes.push(`Moved entrance up to y=${testY} (was buried)`);
                found = true;
                break;
            }
        }
        if (!found) {
            // Carve out a cavity at the entrance
            clearRect(terrain, ent.x - 2, ent.y - 2, PUFFIN_W + 4, PUFFIN_H + 4);
            fixes.push(`Carved cavity around entrance at (${ent.x},${ent.y}) — was deeply buried`);
        }
    }

    // Check ground reachable below entrance
    const centerX = ent.x + Math.floor(PUFFIN_W / 2);
    let groundY = findGroundBelow(terrain, centerX, ent.y + PUFFIN_H, FALL_DEATH + 20);

    if (groundY === -1) {
        // No ground below — search nearby columns for ground
        let bestCol = -1, bestDist = Infinity, bestGroundY = -1;
        for (let scanX = 10; scanX < W - 10; scanX++) {
            const gy = findGroundBelow(terrain, scanX, 5, H - 10);
            if (gy !== -1 && gy > 15) {  // needs room above for trapdoor
                const dist = Math.abs(scanX - ent.x);
                if (dist < bestDist) {
                    bestDist = dist;
                    bestCol = scanX;
                    bestGroundY = gy;
                }
            }
        }
        if (bestCol !== -1) {
            // Place entrance above the ground, ensure the body fits
            let newY = bestGroundY - PUFFIN_H - 2;
            let newX = bestCol - Math.floor(PUFFIN_W / 2);
            if (newX < 2) newX = 2;
            if (newY < 5) newY = 5;
            // Clear space for the puffin
            clearRect(terrain, newX - 1, newY - 1, PUFFIN_W + 2, PUFFIN_H + 2);
            ent.x = newX;
            ent.y = newY;
            fixes.push(`Relocated entrance to (${newX},${newY}) — had no ground below`);
        } else {
            fixes.push(`WARNING: Could not find any ground for entrance in level ${num}`);
        }
    }

    // Ensure entrance area is clear (carve small landing zone)
    clearRect(terrain, ent.x, ent.y, PUFFIN_W, PUFFIN_H);

    // === FIX EXIT ===

    // Check if exit is buried
    let exitBlocked = 0;
    let exitTotal = ext.w * ext.h;
    for (let dy = 0; dy < ext.h; dy++) {
        for (let dx = 0; dx < ext.w; dx++) {
            if (isSolid(terrain, ext.x + dx, ext.y + dy)) exitBlocked++;
        }
    }

    if (exitBlocked > exitTotal * 0.6) {
        // Clear the exit area and a small buffer
        clearRect(terrain, ext.x - 2, ext.y - 2, ext.w + 4, ext.h + 4);
        fixes.push(`Cleared terrain around buried exit at (${ext.x},${ext.y})`);
    }

    // Check if exit has ground below
    let exitGroundBelow = false;
    for (let dx = -2; dx < ext.w + 2; dx++) {
        for (let dy = 0; dy <= 2; dy++) {
            if (isSolid(terrain, ext.x + dx, ext.y + ext.h + dy)) {
                exitGroundBelow = true;
                break;
            }
        }
        if (exitGroundBelow) break;
    }

    if (!exitGroundBelow) {
        // Find ground below exit
        let exitGround = findGroundBelow(terrain, ext.x + Math.floor(ext.w / 2), ext.y + ext.h, FALL_DEATH);
        if (exitGround !== -1) {
            ext.y = exitGround - ext.h;
            clearRect(terrain, ext.x - 1, ext.y - 1, ext.w + 2, ext.h + 2);
            fixes.push(`Moved exit down to ground at y=${ext.y}`);
        } else {
            // Place solid ground under exit
            for (let dx = -2; dx < ext.w + 2; dx++) {
                set(terrain, ext.x + dx, ext.y + ext.h, 1);
                set(terrain, ext.x + dx, ext.y + ext.h + 1, 1);
            }
            clearRect(terrain, ext.x, ext.y, ext.w, ext.h);
            fixes.push(`Added ground platform under floating exit at (${ext.x},${ext.y})`);
        }
    }

    // Ensure exit box itself is clear
    clearRect(terrain, ext.x, ext.y, ext.w, ext.h);

    if (fixes.length > 0) {
        lvl.entrance = ent;
        lvl.exit = ext;
        lvl.terrain = encodeTerrain(terrain);
        writeFileSync(path, JSON.stringify(lvl, null, 2));
        console.log(`Level ${num}: ${fixes.join('; ')}`);
    }
    return fixes.length;
}

// List of levels with known issues from audit
const brokenLevels = [
    'level_024.json', 'level_027.json', 'level_039.json', 'level_040.json',
    'level_044.json', 'level_049.json', 'level_054.json', 'level_056.json',
    'level_058.json', 'level_059.json', 'level_060.json', 'level_063.json',
    'level_064.json', 'level_067.json', 'level_068.json', 'level_072.json',
    'level_083.json', 'level_090.json', 'level_093.json', 'level_096.json',
    'level_999.json'
];

console.log(`\n=== Fixing ${brokenLevels.length} levels with portal issues ===\n`);
let totalFixed = 0;
for (const file of brokenLevels) {
    totalFixed += fixLevel(file);
}
console.log(`\nDone. Applied ${totalFixed} fix(es) across ${brokenLevels.length} levels.`);
