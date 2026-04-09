#!/usr/bin/env node
/**
 * deep-debug-levels-v2.mjs — Accurate gameplay debugger for levels 1-15.
 *
 * Fixes from v1:
 *  - Walk simulation loop detection uses position-change window, not per-tick visited set
 *  - Exit ground check looks up to 10px below exit (clearZones clears 3px below)
 *  - Step-up matches engine exactly (accepts open-air step-ups)
 *  - Reports whether walk sim reaches exit area
 *  - Terrain mini-map for failed levels
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

/**
 * Simulate puffin walking from (startX, startY) in direction dir.
 * Matches engine doWalk() physics exactly.
 */
function simulateWalk(terrain, startX, startY, dir, exitBox, maxTicks = 6000) {
    let x = startX, y = startY;
    let vx = dir;
    let state = 'walk'; // walk, fall
    let fallStartY = y;
    let ticks = 0;
    const path = [];
    let reachedExit = false;

    // Loop detection: track position every 50 ticks; if same pos for 200 ticks → stuck
    let stuckTicks = 0;
    let lastCheckX = x, lastCheckY = y;

    while (ticks < maxTicks) {
        ticks++;

        if (x < 0 || x >= W || y > H + 10) {
            return { x, y, state: 'offscreen', ticks, path, reachedExit, reason: `Off screen at (${x|0},${y|0})` };
        }

        // Check exit overlap
        if (exitBox) {
            const pad = 1;
            const pR = x + PUFFIN_W, pB = y + PUFFIN_H;
            const eL = exitBox.x - pad, eR = exitBox.x + (exitBox.w||20) + pad;
            const eT = exitBox.y - pad, eB = exitBox.y + (exitBox.h||12) + pad;
            if (pR >= eL && x <= eR && pB >= eT && y <= eB) {
                reachedExit = true;
                return { x, y, state: 'exited', ticks, path, reachedExit: true, reason: 'Reached exit' };
            }
        }

        if (state === 'fall') {
            y += 1;
            let fy = Math.floor(y + PUFFIN_H);
            if (fy >= H) {
                return { x, y, state: 'dead', ticks, path, reachedExit, reason: 'Fell off map bottom' };
            }
            if (isSolid(terrain, Math.floor(x), fy)) {
                // Land
                y = fy - PUFFIN_H;
                let fallDist = y - fallStartY;
                if (fallDist > FALL_DEATH) {
                    return { x, y, state: 'splat', ticks, path, reachedExit, reason: `Fatal fall ${fallDist}px at x=${x|0}` };
                }
                state = 'walk';
            }
            continue;
        }

        // Walk state — check ground
        let fx = Math.floor(x);
        let fy = Math.floor(y + PUFFIN_H + 1);
        if (!isSolid(terrain, fx, fy)) {
            state = 'fall';
            fallStartY = y;
            continue;
        }

        // Move every other tick (matching engine animFrame % 2)
        if (ticks % 2 === 0) {
            let nextX = x + vx;
            let nx = Math.floor(nextX);

            let wallMid = isSolid(terrain, nx, Math.floor(y + PUFFIN_H / 2));
            let wallBot = isSolid(terrain, nx, Math.floor(y + PUFFIN_H - 1));

            if (wallMid || wallBot) {
                // Try step-up (matching engine exactly)
                let stepped = false;
                for (let step = 1; step <= MAX_STEP_UP; step++) {
                    let testY = y - step;
                    let headClear = !isSolid(terrain, nx, Math.floor(testY));
                    let midClear  = !isSolid(terrain, nx, Math.floor(testY + PUFFIN_H / 2));
                    let feetClear = !isSolid(terrain, nx, Math.floor(testY + PUFFIN_H - 1));
                    // Engine accepts both floor-solid and open-air step-ups
                    if (headClear && midClear && feetClear) {
                        x = nextX;
                        y = testY;
                        stepped = true;
                        break;
                    }
                }
                if (!stepped) {
                    vx *= -1; // bounce
                }
            } else {
                x = nextX;
            }
        }

        // Loop detection: check every 50 ticks if position changed
        if (ticks % 50 === 0) {
            if (Math.abs(x - lastCheckX) < 2 && Math.abs(y - lastCheckY) < 2) {
                stuckTicks += 50;
                if (stuckTicks >= 200) {
                    return { x, y, state: 'stuck', ticks, path, reachedExit, reason: `Stuck bouncing at (${x|0},${y|0}) for 200+ ticks` };
                }
            } else {
                stuckTicks = 0;
                lastCheckX = x;
                lastCheckY = y;
            }
        }

        if (ticks % 200 === 0) {
            path.push({ x: x|0, y: y|0, vx, tick: ticks });
        }
    }
    return { x, y, state: 'timeout', ticks, path, reachedExit, reason: `Timeout at (${x|0},${y|0}) vx=${vx}` };
}

/** Find where a puffin lands when spawned at entrance. */
function findLanding(terrain, ent) {
    let y = ent.y;
    let dist = 0;
    while (y + PUFFIN_H < H) {
        let feetY = y + PUFFIN_H;
        let cx = ent.x + (PUFFIN_W >> 1);
        if (isSolid(terrain, cx, feetY) || isSolid(terrain, cx, feetY + 1)) {
            return { x: ent.x, y, dist, fatal: dist > FALL_DEATH };
        }
        y++;
        dist++;
    }
    return { x: ent.x, y, dist, fatal: true, offscreen: true };
}

/** Check entrance for spawn issues. */
function checkEntrance(terrain, ent) {
    const issues = [];
    // Body blocked at spawn?
    let blocked = 0;
    for (let dy = 0; dy < PUFFIN_H; dy++)
        for (let dx = 0; dx < PUFFIN_W; dx++)
            if (isSolid(terrain, ent.x + dx, ent.y + dy)) blocked++;
    if (blocked > 0)
        issues.push(`Spawn area has ${blocked} solid pixels — puffin spawns inside terrain`);

    const landing = findLanding(terrain, ent);
    if (landing.offscreen) issues.push('No ground below entrance — puffin falls off map');
    else if (landing.fatal) issues.push(`Fatal ${landing.dist}px fall from entrance (max ${FALL_DEATH})`);
    return { issues, landing };
}

/** Check exit area is valid. */
function checkExit(terrain, ext) {
    const issues = [];
    // Box clear?
    let blocked = 0;
    for (let dy = 0; dy < ext.h; dy++)
        for (let dx = 0; dx < ext.w; dx++)
            if (isSolid(terrain, ext.x + dx, ext.y + dy)) blocked++;
    if (blocked > ext.w * ext.h * 0.5)
        issues.push(`Exit box ${blocked}/${ext.w*ext.h} pixels blocked by terrain`);

    // Ground reachable NEAR exit (up to 10px below + sides)
    let groundNear = false;
    for (let dy = 0; dy <= 10 && !groundNear; dy++)
        for (let dx = -3; dx < ext.w + 3 && !groundNear; dx++)
            if (isSolid(terrain, ext.x + dx, ext.y + ext.h + dy)) groundNear = true;
    if (!groundNear) issues.push('No ground within 10px below exit');

    // Can a puffin body overlap exit while standing on nearby ground?
    let canOverlap = false;
    for (let testGroundY = ext.y + ext.h; testGroundY <= ext.y + ext.h + 12 && !canOverlap; testGroundY++) {
        for (let tx = ext.x - PUFFIN_W; tx <= ext.x + ext.w && !canOverlap; tx++) {
            if (isSolid(terrain, tx, testGroundY) || isSolid(terrain, tx + PUFFIN_W/2, testGroundY)) {
                // Puffin standing here: top = testGroundY - PUFFIN_H
                const pTop = testGroundY - PUFFIN_H;
                const pBot = testGroundY;
                const pad = 1;
                if (pBot >= ext.y - pad && pTop <= ext.y + ext.h + pad &&
                    tx + PUFFIN_W >= ext.x - pad && tx <= ext.x + ext.w + pad) {
                    canOverlap = true;
                }
            }
        }
    }
    if (!canOverlap) issues.push('No standing position overlaps exit detection zone');
    return issues;
}

/** Air-reachability flood fill from entrance to exit. */
function checkAirPath(terrain, ent, ext, skills) {
    const visited = new Uint8Array(W * H);
    const queue = [];
    const sx = ent.x + (PUFFIN_W >> 1), sy = ent.y + (PUFFIN_H >> 1);
    if (!isSolid(terrain, sx, sy)) {
        queue.push(sy * W + sx);
        visited[sy * W + sx] = 1;
    }
    while (queue.length) {
        const idx = queue.pop(); // DFS for speed
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
    const ecx = ext.x + (ext.w >> 1), ecy = ext.y + (ext.h >> 1);
    if (visited[ecy * W + ecx]) return []; // reachable through air

    // Not reachable — check if digging skills exist
    const hasDig = (skills.basher||0) + (skills.digger||0) + (skills.miner||0) + (skills.bomber||0);
    if (hasDig > 0) return []; // have terrain-breaking skills, assume intentional
    return ['EXIT UNREACHABLE: No air path from entrance to exit and no terrain-breaking skills'];
}

/** Print terrain mini-map for a level. */
function printMiniMap(terrain, ent, ext) {
    const SCALE = 4; // each char = 4x4 pixels
    const mw = Math.ceil(W / SCALE), mh = Math.ceil(H / SCALE);
    const lines = [];
    for (let my = 0; my < mh; my++) {
        let row = '';
        for (let mx = 0; mx < mw; mx++) {
            const px = mx * SCALE, py = my * SCALE;
            // Check if entrance or exit
            if (px >= ent.x - 2 && px <= ent.x + PUFFIN_W + 2 && py >= ent.y - 2 && py <= ent.y + PUFFIN_H + 2) {
                row += 'S'; continue;
            }
            if (px >= ext.x - 1 && px < ext.x + ext.w + 1 && py >= ext.y - 1 && py < ext.y + ext.h + 1) {
                row += 'E'; continue;
            }
            // Average the 4x4 block
            let solid = 0, steel = 0;
            for (let dy = 0; dy < SCALE; dy++)
                for (let dx = 0; dx < SCALE; dx++) {
                    const v = (px+dx < W && py+dy < H) ? terrain[(py+dy)*W+px+dx] : 0;
                    if (v === 10) steel++;
                    else if (v > 0) solid++;
                }
            const total = SCALE * SCALE;
            if (steel > total/4) row += 'X';
            else if (solid > total * 0.75) row += '#';
            else if (solid > total * 0.25) row += ':';
            else if (solid > 0) row += '.';
            else row += ' ';
        }
        lines.push(row);
    }
    return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n=== Deep Level Debugger V2: Levels 1-15 ===\n');

let grandTotal = 0;

for (let num = 1; num <= 15; num++) {
    const file = `level_${String(num).padStart(3, '0')}.json`;
    const lvl = JSON.parse(readFileSync(join(levelsDir, file), 'utf-8'));
    const terrain = decodeTerrain(lvl.terrain);
    const ent = lvl.entrance, ext = lvl.exit;
    const skills = lvl.skills || {};
    const issues = [];

    // 1. ENTRANCE
    const entResult = checkEntrance(terrain, ent);
    issues.push(...entResult.issues);

    // 2. EXIT
    issues.push(...checkExit(terrain, ext));

    // 3. AIR PATH
    issues.push(...checkAirPath(terrain, ent, ext, skills));

    // 4. WALK SIMULATION (from landing position)
    if (entResult.landing && !entResult.landing.offscreen && !entResult.landing.fatal) {
        const { x: lx, y: ly } = entResult.landing;

        // Walk RIGHT (default puffin direction)
        const simR = simulateWalk(terrain, lx, ly, 1, ext);
        if (simR.state === 'exited') {
            // Great — level 1-type scenario, natural walk reaches exit
        } else if (simR.state === 'splat') {
            issues.push(`Walk-right: ${simR.reason}`);
        } else if (simR.state === 'offscreen' || simR.state === 'dead') {
            issues.push(`Walk-right: ${simR.reason}`);
        } else if (simR.state === 'stuck') {
            // Check if skills would help
            const hasAnySkill = Object.values(skills).some(v => v > 0);
            if (!hasAnySkill) {
                issues.push(`Walk-right: ${simR.reason} (NO skills available!)`);
            } else {
                // Getting stuck is expected for skill-based levels
                // Log for info but don't flag as issue
                console.log(`  ℹ️  L${num} walk-right stuck at (${simR.x|0},${simR.y|0}) — skills needed`);
            }
        } else if (simR.state === 'timeout') {
            // Puffin is still walking after 6000 ticks — probably bouncing between walls
            console.log(`  ℹ️  L${num} walk-right: timeout at (${simR.x|0},${simR.y|0}) — likely bouncing`);
        }

        // Walk LEFT (after wall bounce — for levels where exit is left of entrance)
        const simL = simulateWalk(terrain, lx, ly, -1, ext);
        if (simL.state === 'splat') {
            issues.push(`Walk-left: ${simL.reason}`);
        } else if (simL.state === 'offscreen' || simL.state === 'dead') {
            issues.push(`Walk-left: ${simL.reason}`);
        }
        // Stuck/timeout on walk-left is normal (bouncing between walls)
    }

    // 5. WATER ZONE CHECKS
    if (lvl.waterZones) {
        for (const wz of lvl.waterZones) {
            if (wz.x < 0 || wz.y < 0 || wz.x + wz.w > W || wz.y + wz.h > H)
                issues.push(`Water zone out of bounds: (${wz.x},${wz.y} ${wz.w}x${wz.h})`);
            let buried = 0, total = wz.w * wz.h;
            for (let dy = 0; dy < wz.h; dy++)
                for (let dx = 0; dx < wz.w; dx++)
                    if (isSolid(terrain, wz.x + dx, wz.y + dy)) buried++;
            if (buried > total * 0.8)
                issues.push(`Water zone ${(buried/total*100)|0}% buried in terrain`);
        }
    }

    // 6. GEOMETRIC SANITY
    if (ent.x < 3 || ent.x > W - 15) issues.push(`Entrance near edge: x=${ent.x}`);
    if (ext.x < 3 || ext.x + ext.w > W - 3) issues.push(`Exit near edge: x=${ext.x}`);
    if (ent.y < 3) issues.push(`Entrance near top: y=${ent.y}`);

    // 7. For no-skill levels, verify pure walk path exists
    const hasAnySkill = Object.values(skills).some(v => v > 0);
    if (!hasAnySkill && entResult.landing && !entResult.landing.fatal) {
        const { x: lx, y: ly } = entResult.landing;
        const simR = simulateWalk(terrain, lx, ly, 1, ext, 10000);
        const simL = simulateWalk(terrain, lx, ly, -1, ext, 10000);
        if (!simR.reachedExit && !simL.reachedExit) {
            issues.push('NO-SKILL LEVEL: Walk simulation never reaches exit in either direction');
        }
    }

    // PRINT RESULTS
    if (issues.length === 0) {
        console.log(`✅ Level ${num} "${lvl.name}" — OK`);
    } else {
        console.log(`❌ Level ${num} "${lvl.name}" — ${issues.length} issue(s):`);
        for (const iss of issues) console.log(`   • ${iss}`);
        console.log('   Mini-map:');
        console.log(printMiniMap(terrain, ent, ext).split('\n').map(l => '   ' + l).join('\n'));
        grandTotal += issues.length;
    }
}

console.log(`\n=== Summary: ${grandTotal} real issue(s) found ===\n`);
