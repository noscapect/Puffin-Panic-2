/**
 * gen-levels-redesign-1-15.mjs  —  Complete redesign of levels 1-15
 *
 * Progression philosophy:
 *   Phase 1 – Sandbox   (1-4):  One new skill per level, short paths, tutorial
 *   Phase 2 – Synthesis  (5-10): Combine mechanics, resource scarcity
 *   Phase 3 – Legacy     (11-15): Multi-step puzzles, red herrings, sacrifice
 *
 * Run:  node scripts/gen-levels-redesign-1-15.mjs
 */

import { writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as B from './level-blocks.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const root  = join(__dir, '..');
const GW = B.GW, GH = B.GH;

/* ═══════════════════════════════════════════════════════════════════════════
   DESIGN SPEC — exported for reference / documentation
   ═══════════════════════════════════════════════════════════════════════════ */

export const LEVEL_DESIGNS = [

// ─────────────────────────── PHASE 1: SANDBOX (1-4) ──────────────────────────

{
    id: 1,
    title: "First Steps",
    grid: [
        "####################",
        "#..................#",
        "#.S................#",
        "#..####............#",
        "#......####........#",
        "#..........####..E.#",
        "#..........#########",
        "#..................#",
        "####################",
        "####################"
    ],
    roleInventory: {},
    totalNPCs: 10,
    saveRequirement: 10,
    solutionHint: "No skills needed. Puffins walk right along stepped-down platforms to the exit. Teaches basic game flow."
},

{
    id: 2,
    title: "Mind the Gap",
    grid: [
        "####################",
        "#..................#",
        "#.S................#",
        "#..####....####..E.#",
        "#......~~~~....####.#",
        "#......~~~~........#",
        "####################",
        "####################",
        "####################",
        "####################"
    ],
    roleInventory: { builder: 3 },
    totalNPCs: 10,
    saveRequirement: 9,
    solutionHint: "One gap in the walkway. Assign builder to first puffin at the gap edge. Bridge spans ~20px. Teaches builder skill."
},

{
    id: 3,
    title: "Going Down",
    grid: [
        "####################",
        "#.S................#",
        "#.################.#",
        "#.################.#",
        "#..................#",
        "#..................#",
        "#..E...............#",
        "#..###.............#",
        "####################",
        "####################"
    ],
    roleInventory: { digger: 3 },
    totalNPCs: 10,
    saveRequirement: 8,
    solutionHint: "Puffins walk on a thick platform. Dig down through it to drop to the exit platform below. Teaches digger skill."
},

{
    id: 4,
    title: "Traffic Control",
    grid: [
        "####################",
        "#..........S.......#",
        "#..........##......#",
        "#.........#..#.....#",
        "#..~~~~..#....#..E.#",
        "#..~~~~..#....#####.#",
        "#........#.........#",
        "####################",
        "####################",
        "####################"
    ],
    roleInventory: { blocker: 2 },
    totalNPCs: 10,
    saveRequirement: 8,
    solutionHint: "Puffins spawn mid-map walking right AND left. Left path drops into water hazard. Place blocker to redirect leftward puffins back right toward exit. Teaches blocker."
},

// ─────────────────────── PHASE 2: SYNTHESIS (5-10) ───────────────────────────

{
    id: 5,
    title: "The Turnaround",
    grid: [
        "####################",
        "#..................#",
        "#.S................#",
        "#..########..E.....#",
        "#..........####..###",
        "#....~~............#",
        "#....~~..##########.#",
        "#........##########.#",
        "####################",
        "####################"
    ],
    roleInventory: { blocker: 1, builder: 2 },
    totalNPCs: 12,
    saveRequirement: 10,
    solutionHint: "Puffins walk right but path dead-ends at a wall. Place blocker at wall to reverse direction. Builder bridges the gap on the left to reach exit below. Blocker+Builder combo."
},

{
    id: 6,
    title: "Three Gaps, Two Bridges",
    grid: [
        "####################",
        "#..................#",
        "#.S................#",
        "#..###..###..###.E.#",
        "#.....~~...~~..####.#",
        "#.....~~...~~......#",
        "#.....~~...~~......#",
        "####################",
        "####################",
        "####################"
    ],
    roleInventory: { builder: 2, digger: 1 },
    totalNPCs: 15,
    saveRequirement: 12,
    solutionHint: "Three gaps but only 2 builders. Dig through the 2nd platform to bypass the 2nd gap, bridge gaps 1 and 3. Resource scarcity forces creative routing."
},

{
    id: 7,
    title: "Break Through",
    grid: [
        "####################",
        "#..................#",
        "#.S........E.......#",
        "#..####.#..####....#",
        "#.......|..........#",
        "#.......|..........#",
        "#.......#..........#",
        "#....############..#",
        "####################",
        "####################"
    ],
    roleInventory: { basher: 2, builder: 3 },
    totalNPCs: 15,
    saveRequirement: 12,
    solutionHint: "Wall blocks horizontal path. Bash through the wall, then build a bridge up to the exit platform. Basher+Builder combo."
},

{
    id: 8,
    title: "Safe Landing",
    grid: [
        "####################",
        "#.S................#",
        "#..################.#",
        "#..################.#",
        "#..................#",
        "#..................#",
        "#..................#",
        "#...............E..#",
        "#...............####",
        "####################"
    ],
    roleInventory: { digger: 2, floater: 10 },
    totalNPCs: 10,
    saveRequirement: 8,
    solutionHint: "Dig through thick platform, then ALL puffins must float to survive the long drop to exit. Digger+Floater combo. Must assign floater to each puffin before they fall."
},

{
    id: 9,
    title: "The Shaft",
    grid: [
        "####################",
        "#.S................#",
        "#..################.#",
        "#.........#########.#",
        "#.........#########.#",
        "#.........####.E...#",
        "#..............####.#",
        "#..................#",
        "####################",
        "####################"
    ],
    roleInventory: { miner: 2, blocker: 1 },
    totalNPCs: 12,
    saveRequirement: 10,
    solutionHint: "Mine diagonally down-right through the thick terrain mass to reach the exit cavity. Place blocker at the edge to prevent puffins falling off after exit. Miner+Blocker combo."
},

{
    id: 10,
    title: "Over the Wall",
    grid: [
        "####################",
        "#..................#",
        "#.S............E...#",
        "#..####..#..####...#",
        "#........|.........#",
        "#........|.........#",
        "#........|.........#",
        "#...#####|#####....#",
        "####################",
        "####################"
    ],
    roleInventory: { climber: 10, builder: 1 },
    totalNPCs: 10,
    saveRequirement: 8,
    solutionHint: "Tall wall blocks path. All puffins are climbers. First climber over the wall gets assigned builder to create a bridge to exit. Sacrificial: builder puffin keeps building off screen. Climber+Builder combo."
},

// ──────────────────── PHASE 3: LEMMINGS LEGACY (11-15) ───────────────────────

{
    id: 11,
    title: "Divide and Conquer",
    grid: [
        "####################",
        "#...E......E.......#",
        "#...####...####....#",
        "#..................#",
        "#........S.........#",
        "#.......####.......#",
        "#......#....#......#",
        "#.....#......#.....#",
        "#....############..#",
        "####################"
    ],
    roleInventory: { blocker: 2, builder: 3, basher: 2, digger: 1 },
    totalNPCs: 20,
    saveRequirement: 16,
    solutionHint: "Spawn in center — puffins split left & right. Left group needs builder to reach left exit. Right group needs basher + builder to reach right exit. Blocker controls flow timing. Dual-path management."
},

{
    id: 12,
    title: "The Sacrifice",
    grid: [
        "####################",
        "#..................#",
        "#.S................#",
        "#..####............#",
        "#......############.#",
        "#......#XXXXXXX#...#",
        "#......#XXXXXXX#.E.#",
        "#......########.####",
        "####################",
        "####################"
    ],
    roleInventory: { bomber: 3, builder: 2, blocker: 1 },
    totalNPCs: 20,
    saveRequirement: 15,
    solutionHint: "Steel-encased chamber blocks direct path. Must sacrifice 3 bombers to blast through the terrain sections (not steel). Then build bridge to exit. Tight save req means minimizing bomber puffin losses. Sacrificial puzzle."
},

{
    id: 13,
    title: "Fool's Gold",
    grid: [
        "####################",
        "#..................#",
        "#.S.......fake_E...#",
        "#..####...####.....#",
        "#......###.....~~~~#",
        "#..................#",
        "#..............E...#",
        "#..............####.#",
        "####################",
        "####################"
    ],
    roleInventory: { builder: 3, blocker: 2, digger: 2, basher: 1 },
    totalNPCs: 20,
    saveRequirement: 16,
    solutionHint: "Obvious right path leads to water trap. Real exit is below and behind a wall on the right. Must blocker-stop the puffins before the trap, dig down, bash right to the real exit. Red herring design."
},

{
    id: 14,
    title: "Timing is Everything",
    grid: [
        "####################",
        "#.S................#",
        "#..####............#",
        "#.......|..........#",
        "#.......#####..E...#",
        "#.......#####..####.#",
        "#..................#",
        "#.........#########.#",
        "####################",
        "####################"
    ],
    roleInventory: { builder: 2, basher: 1, floater: 15, blocker: 1 },
    totalNPCs: 15,
    saveRequirement: 12,
    solutionHint: "First puffin builds right from platform edge. BEFORE ramp is complete, assign basher at the wall so second wave can pass through. Late puffins need floater assigned to survive the drop to exit platform. Precise timing between build and bash."
},

{
    id: 15,
    title: "The Gauntlet",
    grid: [
        "####################",
        "#.S................#",
        "#..####..#..####...#",
        "#........|.........#",
        "#..~~~~..|..####...#",
        "#..~~~~..|.........#",
        "#........#..XXXX.E.#",
        "#...########XXXX####",
        "####################",
        "####################"
    ],
    roleInventory: { climber: 5, builder: 3, basher: 2, bomber: 2, blocker: 2, digger: 1, floater: 5 },
    totalNPCs: 25,
    saveRequirement: 18,
    solutionHint: "Multi-obstacle gauntlet: build over water trap, bash/climb the tall wall, bomb through the steel-adjacent terrain to reach exit. Blocker splits flow so front group clears path. Uses 6+ skill types in sequence. Final exam."
}

];

/* ═══════════════════════════════════════════════════════════════════════════
   ACTUAL TERRAIN BUILDER — converts each design into a real 400×220 level
   ═══════════════════════════════════════════════════════════════════════════ */

function bake(num, def) {
    const d = new Uint8Array(GW * GH);
    def.build(d);
    B.clearZones(d, def.entrance, def.exit);
    const terrain = B.encodeRLE(d);
    const sum = B.rleSum(terrain);
    if (sum !== GW * GH) throw new Error(`RLE mismatch level ${num}: ${sum} != ${GW*GH}`);
    const json = {
        version:  1,
        name:     def.name,
        total:    def.total,
        required: def.required,
        spawnRate: def.spawnRate,
        time:     def.time,
        entrance: def.entrance,
        exit:     def.exit,
        theme:    def.theme,
        skills:   Object.assign(
            { floater:0, bomber:0, blocker:0, builder:0, basher:0, digger:0, climber:0, miner:0, platformer:0 },
            def.skills
        ),
        terrain,
    };
    if (def.waterZones) json.waterZones = def.waterZones;
    const filename = `level_${String(num).padStart(3,'0')}.json`;
    writeFileSync(join(root, 'levels', filename), JSON.stringify(json, null, 2));
    const solid = d.filter(v => v).length;
    console.log(`  ✔ ${filename}  ${(solid/d.length*100).toFixed(1)}% solid  "${def.name}"`);
}

/* ═══════════════════════════════════════════════════════════════════════════
   LEVEL DEFINITIONS — precise terrain for each of the 15 levels
   ═══════════════════════════════════════════════════════════════════════════ */

const LEVELS = [];

// ════════════════════════════════════════════════════════════════════════════
//  LEVEL 1: "First Steps" — No skills. Walk right along gently stepping
//           platforms to reach exit. Pure tutorial.
// ════════════════════════════════════════════════════════════════════════════
LEVELS.push({
    name: '1: First Steps',
    total: 10, required: 10, spawnRate: 90, time: 9600,
    entrance: { x: 30, y: 55 },
    exit:     { x: 350, y: 152, w: 20, h: 12 },
    theme: 'grass',
    skills: {},
    build(d) {
        B.borders(d, 5, 5, 12);
        // No-skill onboarding: three descending platforms with safe transitions.
        B.platform(d, 5, 150, 70, 6);         // left platform (entrance)
        B.platform(d, 130, 260, 110, 6);      // mid platform
        B.platform(d, 240, 395, 165, 6);      // right platform (exit)
        // Gentle ramp transitions so puffins can traverse without skills.
        B.rampDown(d, 118, 70, 30, 40);
        B.rampDown(d, 228, 110, 30, 55);
    },
});

// ════════════════════════════════════════════════════════════════════════════
//  LEVEL 2: "Mind the Gap" — Builders only. One gap to bridge.
// ════════════════════════════════════════════════════════════════════════════
LEVELS.push({
    name: '2: Mind the Gap',
    total: 10, required: 9, spawnRate: 84, time: 9600,
    entrance: { x: 30, y: 128 },
    exit:     { x: 360, y: 138, w: 20, h: 12 },
    theme: 'grass',
    skills: { builder: 3 },
    build(d) {
        B.borders(d, 5, 5, 12);
        // Flat ground at y=150, gap from x=170..230
        B.platform(d, 5, 170, 150, 60);       // left solid ground
        // GAP here — 60px wide, puffins fall if not bridged
        B.platform(d, 230, 395, 150, 60);     // right solid ground
        // Death pit below — water zone
        B.platform(d, 170, 230, 208, 12);     // thin floor under gap so it's visible
    },
    waterZones: [{ x: 170, y: 190, w: 60, h: 18 }]
});

// ════════════════════════════════════════════════════════════════════════════
//  LEVEL 3: "Going Down" — Diggers only. Dig through platform to reach exit.
// ════════════════════════════════════════════════════════════════════════════
LEVELS.push({
    name: '3: Going Down',
    total: 10, required: 8, spawnRate: 84, time: 9600,
    entrance: { x: 55, y: 38 },
    exit:     { x: 65, y: 162, w: 20, h: 12 },
    theme: 'rock',
    skills: { digger: 3 },
    build(d) {
        B.borders(d, 5, 5, 12);
        // Wide platform for puffins to walk on (entrance is on top)
        B.platform(d, 20, 200, 55, 50);      // thick diggable platform, y=55..105
        // Exit floor below
        B.platform(d, 20, 200, 175, 33);     // solid ground at y=175
        // Side walls to keep puffins contained
        B.vwall(d, 20, 40, 175, 10);
        B.vwall(d, 190, 40, 175, 10);
        // Decorative: some terrain on the right side (not functional)
        B.ground(d, 250, 395, 130);
    }
});

// ════════════════════════════════════════════════════════════════════════════
//  LEVEL 4: "Traffic Control" — Blockers only. Redirect puffins from trap.
//  Puffins walk right into a pit unless blocked early.
// ════════════════════════════════════════════════════════════════════════════
LEVELS.push({
    name: '4: Traffic Control',
    total: 10, required: 8, spawnRate: 84, time: 9600,
    entrance: { x: 180, y: 78 },
    exit:     { x: 50, y: 128, w: 20, h: 12 },
    theme: 'grass',
    skills: { blocker: 2 },
    build(d) {
        B.borders(d, 5, 5, 12);
        // Central platform where puffins spawn
        B.platform(d, 80, 330, 95, 6);
        // Exit platform on the LEFT (lower)
        B.platform(d, 5, 120, 140, 68);
        // Gentle ramp from center platform down-left to exit
        B.rampDown(d, 80, 100, 1, 40);       // tiny ramp for visual help
        // The RIGHT side is a death pit — open air into void
        // (Right side of platform just ends — puffins walk off and die)
        // Player must place a blocker on the right edge to stop rightward walkers
        // and another blocker can be placed to force all puffins left
        // Water hazard on the right to make it visible
        B.platform(d, 330, 395, 195, 13);
    },
    waterZones: [{ x: 330, y: 170, w: 65, h: 25 }]
});

// ════════════════════════════════════════════════════════════════════════════
//  LEVEL 5: "The Turnaround" — Blocker + Builder.
//  Dead end on right. Blocker reverses, Builder bridges gap on left to exit.
// ════════════════════════════════════════════════════════════════════════════
LEVELS.push({
    name: '5: The Turnaround',
    total: 12, required: 10, spawnRate: 78, time: 10200,
    entrance: { x: 260, y: 78 },
    exit:     { x: 18, y: 48, w: 20, h: 12 },
    theme: 'desert',
    skills: { blocker: 1, builder: 2 },
    build(d) {
        B.borders(d, 5, 5, 12);
        // RIGHT: main walking platform. Puffins spawn, walk right, hit the steel
        // border, bounce left toward the gap.
        B.platform(d, 150, 395, 95, 6);
        // LEFT: upper exit platform, 35 px higher. Reachable only via a builder bridge:
        // builder rises 1 px per 2 px advance; 70-px gap → exactly 35 px rise.
        B.platform(d, 5, 80, 60, 6);
        // Gap x=80..150 (70 px wide), fatal drop to steel floor.
        // SOLUTION: BLOCKER holds the crowd near x=150; BUILDER walks left and
        // builds the diagonal bridge up to the left platform; crowd follows;
        // blocker eventually sacrificed.
    }
});

// ════════════════════════════════════════════════════════════════════════════
//  LEVEL 6: "Three Gaps, Two Bridges" — Builder(2) + Digger(1).
//  Three gaps, only 2 builders. Dig through one platform to bypass a gap.
// ════════════════════════════════════════════════════════════════════════════
LEVELS.push({
    name: '6: Three Gaps, Two Bridges',
    total: 15, required: 12, spawnRate: 72, time: 10200,
    entrance: { x: 20, y: 108 },
    exit:     { x: 365, y: 118, w: 20, h: 12 },
    theme: 'desert',
    skills: { builder: 2, digger: 1 },
    build(d) {
        B.borders(d, 5, 5, 12);
        // Four platform segments with 3 gaps between them
        B.platform(d, 5,  90,  125, 6);      // plat 1 (entrance)
        // GAP 1: x=90..130 (40px)
        B.platform(d, 130, 210, 125, 6);     // plat 2
        // GAP 2: x=210..250 (40px) — this one has thick terrain BELOW that can be dug through
        B.platform(d, 210, 250, 125, 45);    // thick chunk under gap 2 (diggable)
        B.platform(d, 250, 320, 125, 6);     // plat 3
        // GAP 3: x=320..360 (40px)
        B.platform(d, 360, 395, 125, 83);    // plat 4 (exit area, solid to floor)
        // Floor under gap 2 connects to plat 3 if you dig through the thick chunk
        B.platform(d, 210, 320, 165, 6);     // lower walkway connecting under gap 2 to plat 3
        // Catch floors under gaps 1 and 3 so falls are non-fatal (60px drop)
        B.platform(d, 88, 132, 185, 23);     // floor under gap 1
        B.platform(d, 318, 362, 185, 23);    // floor under gap 3
    }
});

// ════════════════════════════════════════════════════════════════════════════
//  LEVEL 7: "Break Through" — Basher(2) + Builder(3).
//  Wall blocks path, bash through. Then build over a pit.
// ════════════════════════════════════════════════════════════════════════════
LEVELS.push({
    name: '7: Break Through',
    total: 15, required: 12, spawnRate: 72, time: 10200,
    entrance: { x: 25, y: 98 },
    exit:     { x: 350, y: 98, w: 20, h: 12 },
    theme: 'rock',
    skills: { basher: 2, builder: 3 },
    build(d) {
        B.borders(d, 5, 5, 12);
        // Ground level
        B.platform(d, 5, 160, 115, 93);
        // Thick bashable wall
        B.vwall(d, 160, 60, 115, 25);
        // Ground continues after wall, then a gap
        B.platform(d, 185, 260, 115, 93);
        // GAP: x=260..330 — needs builder
        B.platform(d, 330, 395, 115, 93);
        // Ceiling to prevent builders from going too high
        B.ceiling(d, 50, 5, 395);
    }
});

// ════════════════════════════════════════════════════════════════════════════
//  LEVEL 8: "Safe Landing" — Digger(2) + Floater(10).
//  Thick high platform; dig through; long drop requires floaters.
// ════════════════════════════════════════════════════════════════════════════
LEVELS.push({
    name: '8: Safe Landing',
    total: 10, required: 8, spawnRate: 78, time: 10200,
    entrance: { x: 180, y: 20 },
    exit:     { x: 180, y: 178, w: 20, h: 12 },
    theme: 'ice',
    skills: { digger: 2, floater: 10 },
    build(d) {
        B.borders(d, 5, 5, 12);
        // High thick platform — puffins spawn on top
        B.platform(d, 40, 360, 38, 50);      // y=38..88, thick and diggable
        // Exit at the bottom with small floor
        B.platform(d, 140, 260, 192, 16);    // landing pad
        // Side walls THROUGH platform to contain puffins in central corridor
        B.vwall(d, 140, 30, 192, 10);        // extends above platform surface
        B.vwall(d, 250, 30, 192, 10);        // extends above platform surface
        // Drop from y=88 to y=192 = 104px > FALL_DEATH(70) → floater required!
    }
});

// ════════════════════════════════════════════════════════════════════════════
//  LEVEL 9: "The Shaft" — Miner(2) + Blocker(1).
//  Mine diagonally through terrain mass. Blocker stops some from going wrong way.
// ════════════════════════════════════════════════════════════════════════════
LEVELS.push({
    name: '9: The Shaft',
    total: 12, required: 10, spawnRate: 72, time: 10800,
    entrance: { x: 35, y: 68 },
    exit:     { x: 310, y: 168, w: 20, h: 12 },
    theme: 'iron_ore',
    skills: { miner: 2, blocker: 1 },
    build(d) {
        B.borders(d, 5, 5, 12);
        // Upper platform (entrance)
        B.platform(d, 5, 140, 82, 6);
        // Large terrain mass to mine through diagonally
        B.ground(d, 100, 395, 88);
        // Carve out the exit chamber on the right
        B.chamber(d, 280, 148, 100, 40);
        // Exit floor
        B.platform(d, 280, 395, 182, 26);
        // Left side trap — puffins going left fall off the platform edge
        // Need blocker at left edge of the platform to prevent that
    }
});

// ════════════════════════════════════════════════════════════════════════════
//  LEVEL 10: "Over the Wall" — Climber(10) + Builder(1).
//  Tall wall. All puffins are climbers. First one over builds a bridge to exit.
//  Sacrificial: the builder puffin walks off building.
// ════════════════════════════════════════════════════════════════════════════
LEVELS.push({
    name: '10: Over the Wall',
    total: 10, required: 8, spawnRate: 72, time: 10800,
    entrance: { x: 50, y: 108 },
    exit:     { x: 290, y: 108, w: 20, h: 12 },
    theme: 'cliff_chalk',
    skills: { climber: 10, builder: 1 },
    build(d) {
        B.borders(d, 5, 5, 12);
        // Left ground
        B.platform(d, 5, 160, 125, 83);
        // TALL wall — 80px high, cannot be walked over
        B.vwall(d, 160, 30, 125, 20);
        // Right side: short platform, then a gap to exit platform
        B.platform(d, 180, 230, 125, 83);
        // GAP: 230..275 — needs builder bridge
        B.platform(d, 275, 395, 125, 83);
        // Low ceiling to prevent climbers from escaping top
        B.ceiling(d, 25);
    }
});

// ════════════════════════════════════════════════════════════════════════════
//  LEVEL 11: "Divide and Conquer" — Split puffin group, manage two paths.
//  Entrance center, exits on both sides. Blocker splits stream.
// ════════════════════════════════════════════════════════════════════════════
LEVELS.push({
    name: '11: Divide and Conquer',
    total: 20, required: 16, spawnRate: 66, time: 10800,
    entrance: { x: 195, y: 48 },
    exit:     { x: 40, y: 168, w: 20, h: 12 },  // primary exit on left
    theme: 'slate_ledge',
    skills: { blocker: 2, builder: 3, basher: 2, digger: 1 },
    build(d) {
        B.borders(d, 5, 5, 12);
        // Central spawn platform
        B.platform(d, 150, 250, 65, 6);
        // Connecting ramps from center to side platforms (non-fatal transitions)
        B.rampUp(d, 130, 110, 20, 45);       // left ramp: y=110→y=65 over x=130..150
        B.rampDown(d, 250, 65, 20, 45);      // right ramp: y=65→y=110 over x=250..270
        // Left side: stepped platforms leading to exit
        B.platform(d, 5, 130, 110, 6);
        // Gap between center and left platforms — needs builder
        B.platform(d, 5, 100, 180, 28);      // exit floor left
        // Right path — looks inviting but leads to a dead end
        B.platform(d, 270, 395, 110, 6);
        B.ground(d, 350, 395, 80);           // dead-end wall on right
        // Lower left exit area
        B.platform(d, 5, 140, 180, 28);
        // Right side has a bashable wall that WOULD connect to a lower path
        B.vwall(d, 350, 80, 208, 20);
        // Ramp from left platform down to exit area
        B.rampDown(d, 100, 110, 40, 70);
        // Main solution: blocker at right edge of center platform (stop right-walkers),
        // all puffins go left, builder bridges to left platform, walk to exit.
        // OR: split group, bash through right wall too
    }
});

// ════════════════════════════════════════════════════════════════════════════
//  LEVEL 12: "The Sacrifice" — Bombers create paths at cost of puffin lives.
//  Steel-enclosed area needs bombing. Tight save requirement.
// ════════════════════════════════════════════════════════════════════════════
LEVELS.push({
    name: '12: The Sacrifice',
    total: 20, required: 15, spawnRate: 66, time: 10800,
    entrance: { x: 30, y: 78 },
    exit:     { x: 330, y: 148, w: 20, h: 12 },
    theme: 'volcanic_ash',
    skills: { bomber: 3, builder: 2, blocker: 1 },
    build(d) {
        B.borders(d, 5, 5, 12);
        // Upper ground
        B.platform(d, 5, 200, 95, 6);
        // Thick terrain mass blocking the path
        B.ground(d, 200, 320, 60);
        // Steel shell around the mass (indestructible outer layer)
        B.steel(d, 200, 55, 320, 62);        // steel roof
        B.steel(d, 200, 55, 205, 208);       // steel left wall
        B.steel(d, 315, 55, 320, 208);       // steel right wall
        // Interior is diggable (val=1) — bombers can blast through
        // The terrain from y=62 to y=180 between x=205..315 is diggable
        // Chamber carved for exit
        B.chamber(d, 285, 130, 70, 50);
        // Exit floor
        B.platform(d, 285, 395, 162, 46);
        // Must bomb through terrain, losing 3 puffins (20-3=17 alive, need 15)
        // Builder bridges from bombed hole to exit
    }
});

// ════════════════════════════════════════════════════════════════════════════
//  LEVEL 13: "Fool's Gold" — Red herring. Obvious path traps puffins.
//  Real exit is below, accessed by digging + bashing.
// ════════════════════════════════════════════════════════════════════════════
LEVELS.push({
    name: "13: Fool's Gold",
    total: 20, required: 16, spawnRate: 66, time: 10800,
    entrance: { x: 30, y: 58 },
    exit:     { x: 310, y: 168, w: 20, h: 12 },
    theme: 'amber',
    skills: { builder: 3, blocker: 2, digger: 2, basher: 1 },
    build(d) {
        B.borders(d, 5, 5, 12);
        // Upper platform (entrance)
        B.platform(d, 5, 180, 75, 6);
        // RED HERRING: obvious right path with what looks like an exit area
        B.platform(d, 180, 395, 75, 6);
        // But the right side ends in a water trap!
        B.chamber(d, 330, 75, 65, 80);       // open air over water
        // Lower level with REAL exit
        B.platform(d, 5, 395, 180, 28);      // floor at y=180
        // The way down: dig through the platform at a specific spot
        // The thick section that's diggable
        B.platform(d, 100, 180, 81, 99);     // thick mass under herring path
        // After digging down, bash right through a wall to reach exit
        B.vwall(d, 280, 100, 180, 15);       // bash target wall
        // Exit chamber
        B.chamber(d, 295, 140, 80, 40);
        B.platform(d, 295, 395, 180, 28);
        // Blocker to stop puffins from going right on upper path to the trap
    },
    waterZones: [{ x: 332, y: 135, w: 60, h: 20 }]
});

// ════════════════════════════════════════════════════════════════════════════
//  LEVEL 14: "Timing is Everything" — Precise timing with builder + basher.
//  First puffin builds ramp; basher must be assigned at exact moment.
// ════════════════════════════════════════════════════════════════════════════
LEVELS.push({
    name: '14: Timing is Everything',
    total: 15, required: 12, spawnRate: 60, time: 10800,
    entrance: { x: 30, y: 58 },
    exit:     { x: 340, y: 128, w: 20, h: 12 },
    theme: 'bone_white',
    skills: { builder: 2, basher: 1, floater: 15, blocker: 1 },
    build(d) {
        B.borders(d, 5, 5, 12);
        // Upper platform (entrance)
        B.platform(d, 5, 160, 75, 6);
        // Ramp transition down to middle platform (non-fatal 30px height change)
        B.rampDown(d, 160, 75, 30, 30);
        // Middle platform with a wall (moved closer to reduce gap)
        B.platform(d, 190, 395, 105, 6);
        // Bashable wall on middle platform
        B.vwall(d, 280, 60, 105, 18);
        // After bashing: drop to exit (long fall → floater needed)
        // Exit platform
        B.platform(d, 310, 395, 142, 66);
        // Low ceiling on right side only (past bash wall)
        B.ceiling(d, 55, 285, 395);
        // Solution: walk/build down ramp to middle platform, bash through wall,
        // assign floater to everyone, they drop to exit platform
    }
});

// ════════════════════════════════════════════════════════════════════════════
//  LEVEL 15: "The Gauntlet" — Final exam. Multiple obstacles, ALL skills.
// ════════════════════════════════════════════════════════════════════════════
LEVELS.push({
    name: '15: The Gauntlet',
    total: 25, required: 18, spawnRate: 58, time: 12600,
    entrance: { x: 25, y: 48 },
    exit:     { x: 355, y: 168, w: 20, h: 12 },
    theme: 'obsidian_floor',
    skills: { climber: 5, builder: 3, basher: 2, bomber: 2, blocker: 2, digger: 1, floater: 5 },
    build(d) {
        B.borders(d, 5, 5, 12);
        // OBSTACLE 1: High platform with gap — needs builder
        B.platform(d, 5, 100, 65, 6);        // start platform
        // GAP: x=100..150 — catch floor so gap fall is non-fatal
        B.platform(d, 98, 152, 125, 6);      // catch floor under gap (60px drop, safe)
        B.platform(d, 150, 210, 65, 6);      // mid platform 1

        // OBSTACLE 2: Tall wall — needs climbers (or bash)
        B.vwall(d, 210, 20, 160, 18);

        // OBSTACLE 3: Post-wall platform with water trap below
        B.platform(d, 228, 310, 95, 6);
        // Thick terrain mass under obstacles 3-4
        B.platform(d, 100, 310, 160, 48);    // thick terrain mass
        // Carve water trap under obstacle 3 (away from gap 1 catch floor)
        B.chamber(d, 230, 100, 80, 60);

        // OBSTACLE 4: Thick terrain mass requiring bomber/miner to get through
        B.ground(d, 310, 360, 65);
        // Interior is solid diggable terrain, with a steel cap
        B.steel(d, 310, 60, 360, 68);        // steel roof so can't go over

        // EXIT area on far right
        B.chamber(d, 330, 135, 60, 45);
        B.platform(d, 330, 395, 180, 28);

        // Blocker needed at some point to split/control flow
        // Floater needed for drops
        // Full gauntlet: build → climb → bash/bomb → float to exit
    }
});


// ═══════════════════════════════════════════════════════════════════════════
//  MAIN — Bake all 15 levels
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n=== Regenerating levels 1-15 (Master Level Design) ===\n');

for (let i = 0; i < LEVELS.length; i++) {
    bake(i + 1, LEVELS[i]);
}

// Update manifest if needed (levels 1-15 already exist in manifest, just overwriting files)
console.log('\n✔ All 15 levels regenerated. Existing manifest entries are unchanged.\n');
