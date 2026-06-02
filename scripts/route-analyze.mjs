#!/usr/bin/env node
/**
 * Heuristic route analysis for Puffin Panic 2.
 * 
 * Performs a BFS traversal of the level geometry using puffin movement rules
 * to determine if the exit is reachable from the entrance.
 * 
 * Usage:
 *   node scripts/route-analyze.mjs --file levels/level_001.json
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, '..');

const GRID_W = 400;
const GRID_H = 220;
const TERRAIN_PIECES = {
    dirt_tiny: { w: 8, h: 8 },
    dirt_small: { w: 16, h: 16 },
    dirt_block: { w: 32, h: 32 },
    dirt_slab: { w: 64, h: 16 },
    dirt_slab_long: { w: 128, h: 16 },
    dirt_pillar: { w: 16, h: 64 },
    dirt_column: { w: 32, h: 128 },
    dirt_huge: { w: 128, h: 128 },
    dirt_floor: { w: 420, h: 32 },
    step_small: { w: 16, h: 8 },
    step_large: { w: 32, h: 16 },
    steel_plate: { w: 16, h: 32 },
    steel_plate_h: { w: 32, h: 16 },
    steel_block: { w: 32, h: 32 },
    steel_pillar: { w: 16, h: 64 },
    steel_column: { w: 32, h: 128 },
    steel_huge: { w: 64, h: 64 },
    steel_floor: { w: 420, h: 16 },
    bridge_wood: { w: 48, h: 8 },
};

function decodeRLE(rle) {
    const grid = new Uint8Array(GRID_W * GRID_H);
    if (!Array.isArray(rle)) return grid;
    let offset = 0;
    for (const [val, count] of rle) {
        for (let i = 0; i < count && offset < grid.length; i++) {
            grid[offset++] = val;
        }
    }
    return grid;
}

function stampObjects(grid, objects) {
    if (!Array.isArray(objects)) return;
    for (const obj of objects) {
        const piece = TERRAIN_PIECES[obj.type];
        if (!piece) {
            console.warn(`Unknown terrain object skipped: ${obj.type}`);
            continue;
        }
        for (let y = 0; y < piece.h; y++) {
            for (let x = 0; x < piece.w; x++) {
                const tx = obj.x + x;
                const ty = obj.y + y;
                if (tx >= 0 && tx < GRID_W && ty >= 0 && ty < GRID_H) {
                    grid[ty * GRID_W + tx] = 1;
                }
            }
        }
    }
}

function isSolid(grid, x, y) {
    if (x < 0 || x >= GRID_W || y < 0 || y >= GRID_H) return false;
    return grid[y * GRID_W + x] !== 0;
}

async function analyze(filePath) {
    const data = JSON.parse(readFileSync(filePath, 'utf8'));
    const grid = decodeRLE(data.terrain);
    stampObjects(grid, data.objects);
    
    const startX = Math.floor(data.entrance.x);
    const startY = Math.floor(data.entrance.y);
    const exitX  = Math.floor(data.exit.x);
    const exitY  = Math.floor(data.exit.y);
    const exitW  = data.exit.w || 20;
    const exitH  = data.exit.h || 12;

    console.log(`Analyzing: ${data.name}`);
    console.log(`Entrance: (${startX}, ${startY})`);
    console.log(`Exit: (${exitX}, ${exitY})`);

    // State: [x, y, vx]
    // We use a Set of strings "x,y,vx" to track visited states
    const queue = [[startX, startY, 1]]; 
    const visited = new Set();
    visited.add(`${startX},${startY},1`);

    let reachable = false;
    let iterations = 0;
    const maxIterations = 50000;

    while (queue.length > 0 && iterations < maxIterations) {
        iterations++;
        const [x, y, vx] = queue.shift();

        // Check if reached exit
        if (x >= exitX && x < exitX + exitW && y >= exitY && y < exitY + exitH) {
            reachable = true;
            break;
        }

        // 1. Gravity: if no floor, fall
        if (!isSolid(grid, x, y + 1)) {
            let fallY = y;
            let dist = 0;
            while (fallY < GRID_H - 1 && !isSolid(grid, x, fallY + 1)) {
                fallY++;
                dist++;
                if (dist > 70 && !data.skills.floater) break; // Splat
            }
            
            if (dist <= 70 || data.skills.floater) {
                const nextState = `${x},${fallY},${vx}`;
                if (!visited.has(nextState)) {
                    visited.add(nextState);
                    queue.push([x, fallY, vx]);
                }
            }
            continue; // Falling prevents walking
        }

        // 2. Walking logic
        const nx = x + vx;
        if (nx >= 0 && nx < GRID_W) {
            // Check for step-up (up to 6px)
            let stepY = y;
            let foundStep = false;
            for (let dy = 0; dy <= 6; dy++) {
                if (!isSolid(grid, nx, y - dy)) {
                    // This height is clear, but is there a floor?
                    if (isSolid(grid, nx, y - dy + 1)) {
                        stepY = y - dy;
                        foundStep = true;
                        break;
                    }
                }
            }

            if (foundStep) {
                const nextState = `${nx},${stepY},${vx}`;
                if (!visited.has(nextState)) {
                    visited.add(nextState);
                    queue.push([nx, stepY, vx]);
                }
            } else if (!isSolid(grid, nx, y)) {
                // Empty space with no floor is a ledge, not a wall. Fall forward.
                let fallY = y;
                let dist = 0;
                while (fallY < GRID_H - 1 && !isSolid(grid, nx, fallY + 1)) {
                    fallY++;
                    dist++;
                    if (dist > 70 && !data.skills.floater) break;
                }
                if (dist <= 70 || data.skills.floater) {
                    const nextState = `${nx},${fallY},${vx}`;
                    if (!visited.has(nextState)) {
                        visited.add(nextState);
                        queue.push([nx, fallY, vx]);
                    }
                }
            } else {
                // Hit a wall, turn around
                const nextState = `${x},${y},${-vx}`;
                if (!visited.has(nextState)) {
                    visited.add(nextState);
                    queue.push([x, y, -vx]);
                }
            }
        }
    }

    if (reachable) {
        console.log("\x1b[32m✓ EXIT REACHABLE\x1b[0m via standard walking/falling.");
    } else {
        console.log("\x1b[31m✗ EXIT UNREACHABLE\x1b[0m via standard movement.");
        console.log("Suggestion: skill-based pathfinding or manual playtest needed.");
    }
}

const args = process.argv.slice(2);
const fileIdx = args.indexOf('--file');
if (fileIdx === -1) {
    console.error("Usage: node scripts/route-analyze.mjs --file levels/level_001.json");
    process.exit(1);
}

analyze(resolve(ROOT, args[fileIdx + 1])).catch(err => {
    console.error(err);
    process.exit(1);
});
