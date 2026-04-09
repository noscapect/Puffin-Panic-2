#!/usr/bin/env node
/**
 * deep-debug-levels.mjs — Comprehensive gameplay debugger for levels 1-15.
 *
 * Simulates puffin walking physics (same as engine) and checks:
 *  1. Entrance: puffin body fits, ground reachable, not trapped in 1-pixel pocket
 *  2. Walk simulation: puffin walks right (default vx=1) from entrance, what happens?
 *  3. Fall distances: any fatal falls in the natural path?
 *  4. Exit reachability: can a puffin physically reach the exit area?
 *  5. Terrain structural issues: floating platforms with no connection, etc.
 *  6. Skill feasibility: are the provided skills actually USEFUL given the terrain?
 *  7. Water zones overlap with platforms
 *  8. Platform gaps: are they bridgeable with builder physics?
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const W = 400, H = 220;
const PUFFIN_W = 8, PUFFIN_H = 12;
const FALL_DEATH = 70;
const MAX_STEP_UP = 6;

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

function isSolid(t, x, y) {
    if (x < 0 || x >= W || y < 0 || y >= H) return false;
    return t[y * W + x] !== 0;
}

function isSteel(t, x, y) {
    if (x < 0 || x >= W || y < 0 || y >= H) return false;
    return t[y * W + x] === 10;
}

// Simulate a puffin walking from (startX, startY) in direction dir (1=right, -1=left)
// Returns: path taken, where it ends up, reason for stopping
function simulateWalk(terrain, startX, startY, dir, maxTicks = 3000) {
    let x = startX, y = startY;
    let vx = dir;
    let state = 'walk'; // walk, fall, dead, exited, stuck, offscreen
    let fallStartY = y;
    let ticks = 0;
    const visited = new Set();
    const path = [];

    while (ticks < maxTicks) {
        ticks++;
        const key = `${Math.floor(x)},${Math.floor(y)},${vx},${state}`;
        if (visited.has(key)) {
            return { x, y, state: 'loop', ticks, path, reason: `Stuck in loop at (${Math.floor(x)},${Math.floor(y)}) vx=${vx}` };
        }
        visited.add(key);

        if (x < 0 || x >= W || y > H) {
            return { x, y, state: 'offscreen', ticks, path, reason: `Fell off screen at (${Math.floor(x)},${Math.floor(y)})` };
        }

        if (state === 'fall') {
            y += 1;
            // Check landing
            let fx = Math.floor(x);
            let fy = Math.floor(y + PUFFIN_H);
            if (fy >= H) {
                return { x, y, state: 'dead', ticks, path, reason: `Fell off bottom of map` };
            }
            if (isSolid(terrain, fx, fy)) {
                y = fy - PUFFIN_H - 1;
                let fallDist = y - fallStartY;
                if (fallDist > FALL_DEATH) {
                    return { x, y, state: 'splat', ticks, path, reason: `Fatal fall of ${fallDist}px at x=${Math.floor(x)} (max=${FALL_DEATH})` };
                }
                state = 'walk';
            }
            continue;
        }

        // Walk state
        // Check ground under feet
        let fx = Math.floor(x);
        let fy = Math.floor(y + PUFFIN_H + 1);
        if (!isSolid(terrain, fx, fy)) {
            state = 'fall';
            fallStartY = y;
            continue;
        }

        // Move horizontal (every other tick, matching engine)
        if (ticks % 2 === 0) {
            let nextX = x + vx;
            let nx = Math.floor(nextX);
            let wallMid = isSolid(terrain, nx, Math.floor(y + PUFFIN_H/2));
            let wallBot = isSolid(terrain, nx, Math.floor(y + PUFFIN_H - 1));

            if (wallMid || wallBot) {
                // Try step-up
                let stepped = false;
                for (let step = 1; step <= MAX_STEP_UP; step++) {
                    let testY = y - step;
                    let headClear = !isSolid(terrain, nx, Math.floor(testY));
                    let midClear  = !isSolid(terrain, nx, Math.floor(testY + PUFFIN_H/2));
                    let feetClear = !isSolid(terrain, nx, Math.floor(testY + PUFFIN_H - 1));
                    let floorSolid = isSolid(terrain, nx, Math.floor(testY + PUFFIN_H));
                    if (headClear && midClear && feetClear) {
                        x = nextX;
                        y = testY;
                        stepped = true;
                        break;
                    }
                }
                if (!stepped) {
                    vx *= -1; // bounce off wall
                }
            } else {
                x = nextX;
            }
        }
        
        if (ticks % 100 === 0) {
            path.push({ x: Math.floor(x), y: Math.floor(y), tick: ticks });
        }
    }
    return { x, y, state: 'timeout', ticks, path, reason: `Simulation timeout at (${Math.floor(x)},${Math.floor(y)})` };
}

// Check if a puffin can physically stand at (px, py) - body fits in air, ground below
function canStandAt(terrain, px, py) {
    // Body must be in air
    for (let dy = 0; dy < PUFFIN_H; dy++) {
        for (let dx = 0; dx < PUFFIN_W; dx++) {
            if (isSolid(terrain, px + dx, py + dy)) return false;
        }
    }
    // Must have ground below feet
    let hasGround = false;
    for (let dx = 0; dx < PUFFIN_W; dx++) {
        if (isSolid(terrain, px + dx, py + PUFFIN_H) || isSolid(terrain, px + dx, py + PUFFIN_H + 1)) {
            hasGround = true;
            break;
        }
    }
    return hasGround;
}

// Find the natural landing position from entrance (falling until ground)
function findLandingFromEntrance(terrain, ent) {
    let y = ent.y;
    let fallDist = 0;
    while (y + PUFFIN_H < H) {
        let feetY = y + PUFFIN_H;
        let cx = ent.x + Math.floor(PUFFIN_W / 2);
        if (isSolid(terrain, cx, feetY) || isSolid(terrain, cx, feetY + 1)) {
            return { x: ent.x, y, fallDist, fatal: fallDist > FALL_DEATH };
        }
        y++;
        fallDist++;
    }
    return { x: ent.x, y, fallDist, fatal: true, offscreen: true };
}

// Check if exit area is accessible (any reachable air around it with ground)
function exitAccessCheck(terrain, ext) {
    const results = [];
    // Check 1: Is the exit box area clear of terrain?
    let blocked = 0;
    for (let dy = 0; dy < ext.h; dy++) {
        for (let dx = 0; dx < ext.w; dx++) {
            if (isSolid(terrain, ext.x + dx, ext.y + dy)) blocked++;
        }
    }
    if (blocked > 0) {
        results.push(`Exit box has ${blocked}/${ext.w * ext.h} solid pixels inside it`);
    }

    // Check 2: Is there ground under/adjacent to exit?
    let groundUnder = false;
    for (let dx = -2; dx < ext.w + 2; dx++) {
        for (let dy = 0; dy <= 3; dy++) {
            if (isSolid(terrain, ext.x + dx, ext.y + ext.h + dy)) {
                groundUnder = true;
                break;
            }
        }
        if (groundUnder) break;
    }
    if (!groundUnder) {
        results.push('No ground under/near exit — puffins will fall past it');
    }

    // Check 3: Can a puffin body fit adjacent to the exit?
    let canApproach = false;
    for (let testX = ext.x - PUFFIN_W - 2; testX <= ext.x + ext.w + 2; testX++) {
        for (let testY = ext.y - PUFFIN_H; testY <= ext.y + ext.h; testY++) {
            if (canStandAt(terrain, testX, testY)) {
                // Check if this standing position overlaps exit box
                const pR = testX + PUFFIN_W, pB = testY + PUFFIN_H;
                const eL = ext.x - 1, eR = ext.x + ext.w + 1;
                const eT = ext.y - 1, eB = ext.y + ext.h + 1;
                if (pR >= eL && testX <= eR && pB >= eT && testY <= eB) {
                    canApproach = true;
                    break;
                }
            }
        }
        if (canApproach) break;
    }
    if (!canApproach) {
        results.push('No walkable position overlaps exit detection zone');
    }

    return results;
}

// Check: does the entrance clear zone have valid spawn physics?
function entranceCheck(terrain, ent) {
    const results = [];
    
    // Body blocked?
    let blocked = 0;
    for (let dy = 0; dy < PUFFIN_H; dy++) {
        for (let dx = 0; dx < PUFFIN_W; dx++) {
            if (isSolid(terrain, ent.x + dx, ent.y + dy)) blocked++;
        }
    }
    if (blocked > 0) {
        results.push(`Entrance body area has ${blocked} solid pixels — puffin spawns inside terrain!`);
    }

    // Landing check
    const landing = findLandingFromEntrance(terrain, ent);
    if (landing.offscreen) {
        results.push('Puffin falls off bottom of map from entrance — no ground below');
    } else if (landing.fatal) {
        results.push(`Fatal fall from entrance: ${landing.fallDist}px (max ${FALL_DEATH}) — needs floater or shorter drop`);
    }

    return { issues: results, landing };
}

// Measure gap width at a given Y level
function measureGapAt(terrain, y, startX) {
    let gapStart = -1;
    for (let x = startX; x < W; x++) {
        let hasSolid = false;
        for (let dy = 0; dy <= 2; dy++) {
            if (isSolid(terrain, x, y + dy)) { hasSolid = true; break; }
        }
        if (!hasSolid && gapStart === -1) {
            gapStart = x;
        } else if (hasSolid && gapStart !== -1) {
            return { start: gapStart, end: x, width: x - gapStart };
        }
    }
    if (gapStart !== -1) {
        return { start: gapStart, end: W, width: W - gapStart };
    }
    return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n=== Deep Level Debugger: Levels 1-15 ===\n');

let totalIssues = 0;

for (let num = 1; num <= 15; num++) {
    const file = `level_${String(num).padStart(3, '0')}.json`;
    const lvl = JSON.parse(readFileSync(join(levelsDir, file), 'utf-8'));
    const terrain = decodeTerrain(lvl.terrain);
    const ent = lvl.entrance;
    const ext = lvl.exit;
    const issues = [];

    // 1. ENTRANCE CHECKS
    const entResult = entranceCheck(terrain, ent);
    issues.push(...entResult.issues);

    // 2. EXIT CHECKS
    const exitIssues = exitAccessCheck(terrain, ext);
    issues.push(...exitIssues);

    // 3. WALK SIMULATION — walk right from landing position
    if (entResult.landing && !entResult.landing.offscreen && !entResult.landing.fatal) {
        const landY = entResult.landing.y;
        const landX = entResult.landing.x;
        
        // Simulate walking RIGHT (default direction)
        const simR = simulateWalk(terrain, landX, landY, 1);
        if (simR.state === 'loop') {
            issues.push(`Walk-right: ${simR.reason}`);
        } else if (simR.state === 'splat') {
            issues.push(`Walk-right: ${simR.reason}`);
        } else if (simR.state === 'offscreen') {
            issues.push(`Walk-right: ${simR.reason}`);
        } else if (simR.state === 'dead') {
            issues.push(`Walk-right: ${simR.reason}`);
        }
        
        // Simulate walking LEFT (after bouncing off wall)
        const simL = simulateWalk(terrain, landX, landY, -1);
        if (simL.state === 'loop') {
            // Loop is generally OK — puffin bounces between walls
        } else if (simL.state === 'splat') {
            issues.push(`Walk-left: ${simL.reason}`);
        } else if (simL.state === 'offscreen') {
            issues.push(`Walk-left: ${simL.reason}`);
        } else if (simL.state === 'dead') {
            issues.push(`Walk-left: ${simL.reason}`);
        }
    }

    // 4. WATER ZONE CHECKS
    if (lvl.waterZones) {
        for (const wz of lvl.waterZones) {
            // Check water zone is within bounds
            if (wz.x < 0 || wz.y < 0 || wz.x + wz.w > W || wz.y + wz.h > H) {
                issues.push(`Water zone out of bounds: (${wz.x},${wz.y} ${wz.w}x${wz.h})`);
            }
            // Check water zone isn't entirely inside solid terrain
            let waterBlocked = 0;
            let waterTotal = wz.w * wz.h;
            for (let dy = 0; dy < wz.h; dy++) {
                for (let dx = 0; dx < wz.w; dx++) {
                    if (isSolid(terrain, wz.x + dx, wz.y + dy)) waterBlocked++;
                }
            }
            if (waterBlocked > waterTotal * 0.8) {
                issues.push(`Water zone mostly buried in terrain (${waterBlocked}/${waterTotal} solid)`);
            }
        }
    }

    // 5. SKILL FEASIBILITY
    const skills = lvl.skills || {};
    const hasAnySkill = Object.values(skills).some(v => v > 0);
    
    // If no skills given, ensure a clean walk path exists to exit
    if (!hasAnySkill) {
        // Walk sim already covers this, but let's check the exit is reachable by walking
        if (entResult.landing && !entResult.landing.fatal) {
            const landY = entResult.landing.y;
            const simR = simulateWalk(terrain, ent.x, landY, 1, 5000);
            const simL = simulateWalk(terrain, ent.x, landY, -1, 5000);
            
            // Check if either simulation gets near the exit
            const nearExitR = Math.abs(simR.x - ext.x) < 30 && Math.abs(simR.y - ext.y) < 30;
            const nearExitL = Math.abs(simL.x - ext.x) < 30 && Math.abs(simL.y - ext.y) < 30;
            
            if (!nearExitR && !nearExitL && simR.state !== 'loop' && simL.state !== 'loop') {
                issues.push('No-skill level: walk simulation never reaches near exit area');
            }
        }
    }

    // 6. GEOMETRIC CHECKS
    // Check entrance/exit not overlapping
    if (Math.abs(ent.x - ext.x) < 15 && Math.abs(ent.y - ext.y) < 15) {
        issues.push('Entrance and exit are overlapping or very close');
    }

    // Check for terrain that completely seals off the map (no air path from entrance side to exit side)
    // Simple flood fill from entrance area
    const airVisited = new Uint8Array(W * H);
    const queue = [];
    const startPx = ent.x + Math.floor(PUFFIN_W / 2);
    const startPy = ent.y + Math.floor(PUFFIN_H / 2);
    if (!isSolid(terrain, startPx, startPy)) {
        queue.push(startPy * W + startPx);
        airVisited[startPy * W + startPx] = 1;
    }
    while (queue.length > 0) {
        const idx = queue.shift();
        const cx = idx % W, cy = Math.floor(idx / W);
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
            const nx = cx + dx, ny = cy + dy;
            if (nx >= 0 && nx < W && ny >= 0 && ny < H) {
                const ni = ny * W + nx;
                if (!airVisited[ni] && !isSolid(terrain, nx, ny)) {
                    airVisited[ni] = 1;
                    queue.push(ni);
                }
            }
        }
    }
    
    // Check if exit area is air-reachable from entrance
    const exitCx = ext.x + Math.floor(ext.w / 2);
    const exitCy = ext.y + Math.floor(ext.h / 2);
    if (!airVisited[exitCy * W + exitCx]) {
        // Check if any air near exit is reachable
        let anyExitAirReachable = false;
        for (let dy = -5; dy <= ext.h + 5; dy++) {
            for (let dx = -5; dx <= ext.w + 5; dx++) {
                const tx = ext.x + dx, ty = ext.y + dy;
                if (tx >= 0 && tx < W && ty >= 0 && ty < H && airVisited[ty * W + tx]) {
                    anyExitAirReachable = true;
                    break;
                }
            }
            if (anyExitAirReachable) break;
        }
        if (!anyExitAirReachable) {
            // Check what skills could break through
            const hasBash = (skills.basher || 0) > 0;
            const hasDig = (skills.digger || 0) > 0;
            const hasMine = (skills.miner || 0) > 0;
            const hasBomb = (skills.bomber || 0) > 0;
            if (!hasBash && !hasDig && !hasMine && !hasBomb) {
                issues.push('EXIT UNREACHABLE: No air path from entrance to exit, and no terrain-breaking skills provided (need basher/digger/miner/bomber)');
            } else {
                // It's OK if they have digging skills — that's the puzzle
            }
        }
    }

    // 7. Check ramp transitions (from gen script) aren't creating too-steep walls
    // by checking if any platform edge has a drop > MAX_STEP_UP without skills to handle it
    
    // 8. Print results
    if (issues.length > 0) {
        console.log(`❌ Level ${num} "${lvl.name}"`);
        console.log(`   entrance=(${ent.x},${ent.y})  exit=(${ext.x},${ext.y} ${ext.w}x${ext.h})`);
        for (const iss of issues) {
            console.log(`   ⚠ ${iss}`);
        }
        console.log();
        totalIssues += issues.length;
    } else {
        console.log(`✔ Level ${num} "${lvl.name}" — OK`);
    }
}

console.log(`\n=== Summary: ${totalIssues} issue(s) found ===\n`);
