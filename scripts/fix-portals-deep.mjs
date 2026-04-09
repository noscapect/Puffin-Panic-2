#!/usr/bin/env node
/**
 * Deep-fix for levels where entrance has no ground anywhere near.
 * Strategy: scan the entire terrain map to find the leftmost ground surface,
 * then place entrance above it, carving space if needed. If truly empty, 
 * build a small landing platform.
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const W = 400, H = 220;
const PUFFIN_W = 8, PUFFIN_H = 12;

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
    if (x >= 0 && x < W && y >= 0 && y < H) terrain[y * W + x] = v;
}

function clearRect(terrain, x, y, w, h) {
    for (let dy = 0; dy < h; dy++) {
        for (let dx = 0; dx < w; dx++) {
            const tx = x + dx, ty = y + dy;
            if (tx >= 0 && tx < W && ty >= 0 && ty < H && terrain[ty * W + tx] === 1) {
                terrain[ty * W + tx] = 0;
            }
        }
    }
}

const brokenLevels = ['level_040.json', 'level_056.json', 'level_060.json', 'level_067.json'];

for (const file of brokenLevels) {
    const path = join(levelsDir, file);
    const lvl = JSON.parse(readFileSync(path, 'utf-8'));
    const num = file.replace('level_', '').replace('.json', '');
    const terrain = decodeTerrain(lvl.terrain);
    const ent = lvl.entrance;

    // Scan the left third of the map (x 5..130) for the topmost ground surface
    let bestX = -1, bestSurfaceY = H;
    for (let x = 5; x < 130; x++) {
        for (let y = 10; y < H - 5; y++) {
            if (isSolid(terrain, x, y) && !isSolid(terrain, x, y - 1)) {
                // Found a surface at (x, y) — air above, solid below
                if (y < bestSurfaceY || (y === bestSurfaceY && x < bestX)) {
                    // Prefer surfaces that aren't too close to top
                    if (y > PUFFIN_H + 8) {
                        bestSurfaceY = y;
                        bestX = x;
                    }
                }
                break; // Only check topmost surface per column
            }
        }
    }

    if (bestX === -1) {
        // No terrain at all on left side — scan wider
        for (let x = 5; x < W - 30; x++) {
            for (let y = 10; y < H - 5; y++) {
                if (isSolid(terrain, x, y) && !isSolid(terrain, x, y - 1)) {
                    if (y > PUFFIN_H + 8 && y < bestSurfaceY) {
                        bestSurfaceY = y;
                        bestX = x;
                    }
                    break;
                }
            }
        }
    }

    if (bestX === -1) {
        // Truly empty level — create a ground platform
        console.log(`Level ${num}: No terrain found at all, creating platform`);
        const platY = 170;
        for (let dx = 10; dx < 50; dx++) {
            set(terrain, dx, platY, 1);
            set(terrain, dx, platY + 1, 1);
        }
        bestX = 20;
        bestSurfaceY = platY;
    }

    // Place entrance above the surface
    const newX = Math.max(5, bestX - Math.floor(PUFFIN_W / 2));
    const newY = Math.max(8, bestSurfaceY - PUFFIN_H - 4);

    // Make sure there's air for the puffin body + some space above for trapdoor
    clearRect(terrain, newX - 1, newY - 4, PUFFIN_W + 2, PUFFIN_H + 5);

    // Ensure there is solid ground under feet
    let hasGround = false;
    for (let dx = 0; dx < PUFFIN_W; dx++) {
        if (isSolid(terrain, newX + dx, newY + PUFFIN_H) ||
            isSolid(terrain, newX + dx, newY + PUFFIN_H + 1)) {
            hasGround = true;
            break;
        }
    }
    if (!hasGround) {
        // Add a small landing platform
        const platY = newY + PUFFIN_H + 1;
        for (let dx = -2; dx < PUFFIN_W + 2; dx++) {
            set(terrain, newX + dx, platY, 1);
            set(terrain, newX + dx, platY + 1, 1);
        }
        console.log(`Level ${num}: Added landing platform at y=${platY}`);
    }

    lvl.entrance = { x: newX, y: newY };
    lvl.terrain = encodeTerrain(terrain);
    writeFileSync(path, JSON.stringify(lvl, null, 2));
    console.log(`Level ${num}: Fixed entrance → (${newX},${newY}), surface found at x=${bestX},y=${bestSurfaceY}`);
}
