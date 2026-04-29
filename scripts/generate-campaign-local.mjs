#!/usr/bin/env node
/**
 * Generates the 10-level AI-designed campaign locally — no API call needed.
 * Level geometry was designed by Claude and is baked in here.
 * Run: node scripts/generate-campaign-local.mjs
 */

import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname }         from 'path';
import { fileURLToPath }            from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, '..');
const OUT_DIR   = resolve(ROOT, 'levels', 'generated');

const GRID_W = 400, GRID_H = 220, BORDER = 5, TOTAL = GRID_W * GRID_H;

function buildGrid(blocks) {
    const grid = new Uint8Array(TOTAL);
    for (let y = 0; y < GRID_H; y++)
        for (let x = 0; x < GRID_W; x++)
            if (y < BORDER || y >= GRID_H - BORDER || x < BORDER || x >= GRID_W - BORDER)
                grid[y * GRID_W + x] = 10;
    for (const { x, y, w, h, type } of blocks)
        for (let dy = 0; dy < h; dy++)
            for (let dx = 0; dx < w; dx++) {
                const px = x + dx, py = y + dy;
                if (px >= 0 && px < GRID_W && py >= 0 && py < GRID_H)
                    grid[py * GRID_W + px] = type;
            }
    return grid;
}

function encodeRLE(grid) {
    const rle = []; let cur = grid[0], count = 1;
    for (let i = 1; i < grid.length; i++) {
        if (grid[i] === cur) count++;
        else { rle.push([cur, count]); cur = grid[i]; count = 1; }
    }
    rle.push([cur, count]);
    return rle;
}

function makeLevel(raw) {
    return {
        version:   1,
        name:      raw.name,
        total:     raw.total     ?? 10,
        required:  raw.required  ?? 8,
        spawnRate: raw.spawnRate ?? 75,
        time:      raw.time      ?? 9600,
        entrance:  raw.entrance,
        exit:      { w: 20, h: 12, ...raw.exit },
        theme:     raw.theme     ?? 'grass',
        skills: {
            floater: 0, bomber: 0, blocker: 0, builder:    0,
            basher:  0, digger: 0, climber: 0, miner:      0, platformer: 0,
            ...raw.skills,
        },
        terrain: encodeRLE(buildGrid(raw.terrain_blocks)),
        ...(raw.waterZones?.length ? { waterZones: raw.waterZones } : {}),
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// 10-LEVEL CAMPAIGN  (designed by Claude, no API call required)
//
// Physics rules respected throughout:
//   • Fall death:  > 70 px  (70 is safe, 71+ splats)
//   • Builder:     1 use = 24 px forward + 12 px rise
//   • Puffin size: 8 × 12 px  (puffin.y = top of body; feet at puffin.y + 12)
//   • Grid:        400 × 220 px, 5-px indestructible border on all sides
//   • Entrance:    puffins spawn at (entrance.x, entrance.y) and fall until terrain
// ─────────────────────────────────────────────────────────────────────────────
const LEVELS = [

    // ── 1 ─ Just Walk ─────────────────────────────────────────────────────────
    // No skills. One flat floor from entrance to exit. Pure introduction.
    // Entrance y=148 → floor top y=160. Drop = 12 px. SAFE.
    {
        name: '1: Just Walk',
        total: 10, required: 10,
        theme: 'grass',
        skills: {},
        entrance: { x: 30,  y: 148 },
        exit:     { x: 355, y: 148 },
        terrain_blocks: [
            // Continuous flat floor
            { x: 5, y: 160, w: 390, h: 8, type: 1 },
        ],
    },

    // ── 2 ─ Mind the Gap ──────────────────────────────────────────────────────
    // Builder (3 given, 2 needed + 1 spare).
    // 40-px gap; 2 builder uses span 48 px → bridge reaches far side.
    // Puffin arrives at x=197, y=64 (feet y=76), falls 24 px to right floor. SAFE.
    // Gap depth to border = ~55 px → FATAL without bridge.
    {
        name: '2: Mind the Gap',
        total: 10, required: 8,
        theme: 'grass',
        skills: { builder: 3 },
        entrance: { x: 30,  y: 148 },
        exit:     { x: 355, y: 148 },
        terrain_blocks: [
            // Left platform
            { x: 5,   y: 160, w: 155, h: 8, type: 1 },
            // Right platform (gap at x=160..199, 40 px wide)
            { x: 200, y: 160, w: 195, h: 8, type: 1 },
        ],
    },

    // ── 3 ─ Leap of Faith ─────────────────────────────────────────────────────
    // Floater (2 given, 1 needed + 1 spare).
    // Upper platform ends at x=200. Below is void.
    // Drop from upper top (y=100) to lower floor top (y=195) = 95 px → FATAL without floater.
    // With floater: puffin drifts safely down. Lands on lower floor. Walks to exit.
    {
        name: '3: Leap of Faith',
        total: 10, required: 7,
        theme: 'rock',
        skills: { floater: 2 },
        entrance: { x: 30,  y: 88  },   // 12 px above upper platform
        exit:     { x: 355, y: 183 },   // exit.y + 12 = 195 = lower floor top
        terrain_blocks: [
            // Upper platform (entrance landing + walk to cliff)
            { x: 5,   y: 100, w: 196, h: 8, type: 1 },
            // Left wall so puffins can't escape left
            { x: 5,   y: 5,   w: 8,   h: 95, type: 10 },
            // Lower floor (goal)
            { x: 150, y: 195, w: 245, h: 8, type: 1 },
        ],
    },

    // ── 4 ─ Knock Knock ───────────────────────────────────────────────────────
    // Basher (2 given, 1 needed + 1 spare).
    // 13-px type-1 wall bisects the level. Without bashing puffins bounce forever.
    // Wall is TYPE 1 (diggable). Basher punches through at body height.
    {
        name: '4: Knock Knock',
        total: 10, required: 8,
        theme: 'cave',
        skills: { basher: 2 },
        entrance: { x: 30,  y: 153 },   // 12 px above floor
        exit:     { x: 355, y: 153 },
        terrain_blocks: [
            // Full-width floor
            { x: 5,   y: 165, w: 390, h: 8, type: 1 },
            // Bisecting wall — type 1 so basher can remove it
            { x: 170, y: 80,  w: 13,  h: 85, type: 1 },
        ],
    },

    // ── 5 ─ Dig Deep ──────────────────────────────────────────────────────────
    // Digger (2 given, 1 needed + 1 spare).
    // Full-width upper platform — puffins can't fall off the sides.
    // The ONLY way down is to dig through the 8-px floor.
    // After digging: fall from y=107 (floor bottom) to y=160 (lower floor top) = 53 px. SAFE.
    {
        name: '5: Dig Deep',
        total: 10, required: 8,
        theme: 'rock',
        skills: { digger: 2 },
        entrance: { x: 30,  y: 88  },   // 12 px above upper platform
        exit:     { x: 355, y: 148 },   // exit.y + 12 = 160 = lower floor top
        terrain_blocks: [
            // Upper platform spans full playable width — no cliff edges
            { x: 5, y: 100, w: 390, h: 8, type: 1 },
            // Lower floor
            { x: 5, y: 160, w: 390, h: 8, type: 1 },
        ],
    },

    // ── 6 ─ Fork in the Road ──────────────────────────────────────────────────
    // Blocker (2 given, 1 needed).
    // Puffins spawn at x=195 walking RIGHT (default). The floor ends at x=290 with
    // a fatal cliff (drop to border = 95 px → FATAL). Exit is on the far LEFT.
    // Blocker at ~x=275 turns all puffins left → they walk to exit at x=15.
    {
        name: '6: Fork in the Road',
        total: 10, required: 9,
        theme: 'grass',
        skills: { blocker: 2 },
        entrance: { x: 195, y: 108 },   // middle of level, 12 px above floor
        exit:     { x: 15,  y: 108 },   // left wall, exit.y+12=120=floor top
        terrain_blocks: [
            // Floor — ends at x=290, cliff to right
            { x: 5, y: 120, w: 286, h: 8, type: 1 },
        ],
    },

    // ── 7 ─ Going Vertical ────────────────────────────────────────────────────
    // Climber (3 given; player needs to assign to enough puffins).
    // A tall TYPE-1 wall blocks the path. Non-climbers bounce forever.
    // Climbers scale the wall face, land on mid-ledge (35 px fall — SAFE),
    // walk to ledge end, fall 60 px to floor — SAFE (< 70).
    {
        name: '7: Going Vertical',
        total: 10, required: 6,
        theme: 'cave',
        skills: { climber: 3 },
        entrance: { x: 30,  y: 163 },   // 12 px above floor
        exit:     { x: 355, y: 163 },
        terrain_blocks: [
            // Main floor
            { x: 5,   y: 175, w: 390, h: 8, type: 1 },
            // Climbable wall — TYPE 1 (not 10!); climbers scale x=165 face
            { x: 165, y: 80,  w: 11,  h: 95, type: 1 },
            // Mid-ledge right of wall: puffin falls 35 px from wall top to here
            { x: 175, y: 115, w: 46,  h: 8,  type: 1 },
            // Fall from ledge end (x=220, y=115) to floor (y=175) = 60 px. SAFE.
        ],
    },

    // ── 8 ─ Diagonal Cut ──────────────────────────────────────────────────────
    // Miner (2 given, 1 needed + 1 spare).
    // A large terrain mass fills the right side. The only way through is diagonally.
    // Puffins on left platform hit the mass and bounce. Assign miner to cut through.
    // After mining, puffin exits at bottom of mass, lands on right floor.
    {
        name: '8: Diagonal Cut',
        total: 10, required: 8,
        theme: 'sandstone',
        skills: { miner: 2 },
        entrance: { x: 30,  y: 68  },   // 12 px above left platform (y=80)
        exit:     { x: 355, y: 143 },   // exit.y + 12 = 155 = right floor top
        terrain_blocks: [
            // Left platform
            { x: 5,   y: 80,  w: 146, h: 8, type: 1 },
            // Large diagonal mass (type 1 — mineable)
            // Approximated as a staircase of blocks descending right
            { x: 144, y: 80,  w: 65,  h: 35, type: 1 },
            { x: 190, y: 105, w: 65,  h: 30, type: 1 },
            { x: 235, y: 125, w: 65,  h: 30, type: 1 },
            { x: 280, y: 140, w: 65,  h: 15, type: 1 },
            // Right floor below the mass
            { x: 250, y: 155, w: 145, h: 8,  type: 1 },
        ],
    },

    // ── 9 ─ Two-Step ──────────────────────────────────────────────────────────
    // Builder (3 given, 2 needed) + Floater (2 given, 1 needed).
    // Stage 1: 44-px gap — need 2 builders to bridge.
    // Stage 2: 85-px drop from middle island to lower floor — need floater.
    // Both skills are REQUIRED; forgetting either causes deaths.
    {
        name: '9: Two-Step',
        total: 10, required: 7,
        theme: 'crystal',
        skills: { builder: 3, floater: 2 },
        entrance: { x: 30,  y: 88  },   // 12 px above left platform (y=100)
        exit:     { x: 355, y: 173 },   // exit.y + 12 = 185 = lower floor top
        terrain_blocks: [
            // Left platform
            { x: 5,   y: 100, w: 145, h: 8, type: 1 },
            // 44-px gap at x=150..193
            // Middle island
            { x: 194, y: 100, w: 87,  h: 8, type: 1 },
            // Lower floor (exit level) — drop from island = 85 px → needs floater
            { x: 260, y: 185, w: 135, h: 8, type: 1 },
        ],
    },

    // ── 10 ─ Full House ───────────────────────────────────────────────────────
    // Basher (2) + Digger (2) + Builder (3) — all three required, in sequence.
    //
    // Stage 1 — BASH:
    //   13-px type-1 wall at x=161..173. Puffins bounce; assign basher.
    //
    // Stage 2 — DIG:
    //   After bashing, puffins are on the RIGHT upper floor (full-width, no cliff).
    //   Assign digger to cut through 8-px floor.
    //   Fall: upper floor bottom (y=87) → lower floor top (y=135) = 48 px. SAFE.
    //
    // Stage 3 — BUILD:
    //   Lower floor has a 44-px gap at x=311..354.
    //   Gap fall to border = 80 px → FATAL without bridge.
    //   2 builder uses bridge 48 px → spans gap. Exit on far right.
    {
        name: '10: Full House',
        total: 10, required: 6,
        theme: 'volcanic_ash',
        skills: { basher: 2, digger: 2, builder: 3 },
        entrance: { x: 30,  y: 68  },   // 12 px above left upper platform (y=80)
        exit:     { x: 355, y: 123 },   // exit.y + 12 = 135 = lower floor top
        terrain_blocks: [
            // Left upper section (pre-bash)
            { x: 5,   y: 80,  w: 157, h: 8, type: 1 },
            // Bash wall — TYPE 1 so basher can remove it
            { x: 161, y: 20,  w: 13,  h: 68, type: 1 },
            // Right upper section (post-bash, full width — forces digger)
            { x: 174, y: 80,  w: 221, h: 8, type: 1 },
            // Lower left floor (post-dig)
            { x: 5,   y: 135, w: 307, h: 8, type: 1 },
            // Lower right floor (post-build, exit side)
            { x: 355, y: 135, w: 40,  h: 8, type: 1 },
            // 44-px gap at x=311..354; fall to border = 80 px → FATAL without build
        ],
    },
];

// ─── Write all levels ─────────────────────────────────────────────────────────
mkdirSync(OUT_DIR, { recursive: true });

const pad = n => String(n).padStart(3, '0');

console.log('Puffin Panic 2 — Local Campaign Generator');
console.log(`Output: ${OUT_DIR}\n`);

for (let i = 0; i < LEVELS.length; i++) {
    const num  = i + 1;
    const raw  = LEVELS[i];
    const slug = raw.name.toLowerCase().replace(/\d+:\s*/,'').trim().replace(/\s+/g, '_');
    const file = `level_${pad(num)}_${slug}.json`;
    const path = resolve(OUT_DIR, file);

    const lvl  = makeLevel(raw);

    // Quick sanity check
    const total = lvl.terrain.reduce((s, [, c]) => s + c, 0);
    const ok    = total === TOTAL ? '✓' : `✗ (${total})`;

    writeFileSync(path, JSON.stringify(lvl, null, 2));

    const skillStr = Object.entries(lvl.skills)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => `${k}×${v}`)
        .join(', ') || 'none';

    console.log(`[${num}/10] ${ok}  ${file}`);
    console.log(`         theme=${lvl.theme}  skills=${skillStr}`);
}

console.log(`\nDone. Open the level editor to preview:`);
console.log(`  npm run editor   →  http://localhost:3747`);
