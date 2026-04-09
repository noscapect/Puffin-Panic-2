/**
 * gen-levels-33-42.mjs  —  Levels 33-42: "Deep Sea" arc (deep_sea / coral / wet_cave_stone)
 *
 * Run:  node scripts/gen-levels-33-42.mjs
 */

import { writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as B from './level-blocks.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const root  = join(__dir, '..');
const GW = B.GW, GH = B.GH;

function bake(num, def) {
    const d = new Uint8Array(GW * GH);
    def.build(d);
    B.clearZones(d, def.entrance, def.exit);
    const terrain = B.encodeRLE(d);
    const sum = B.rleSum(terrain);
    if (sum !== GW * GH) throw new Error(`RLE mismatch level ${num}: ${sum}`);
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
    if (def.props)      json.props      = def.props;
    if (def.waterZones) json.waterZones = def.waterZones;
    const filename = `level_${String(num).padStart(3,'0')}.json`;
    writeFileSync(join(root, 'levels', filename), JSON.stringify(json, null, 2));
    const solid = d.filter(v => v).length;
    console.log(`  ✔ ${filename}  ${(solid/d.length*100).toFixed(1)}% solid  "${def.name}"`);
    return filename;
}

// ─── Level definitions 33-42 ──────────────────────────────────────────────────

const LEVELS = [

// ── Level 33 ──────────────────────────────────────────────────────────────────
{
    name: '33: Sunken Entry',
    total: 22, required: 18, spawnRate: 60, time: 10800,
    entrance: { x: 28, y: 28 },
    exit:     { x: 358, y: 152, w: 20, h: 12 },
    theme: 'deep_sea',
    skills: { floater: 6, basher: 4, builder: 5, blocker: 3 },
    // Long fall from the top then a corridor to the right exit.
    build(d) {
        B.borders(d, 5, 5, 12);
        B.ground(d, 0, GW, 170);
        // Gentle staircase descending into the deep
        B.stairsDown(d, 20, 40, 6, 50, 20);
        // One blocking wall they must bash
        B.vwall(d, 200, 80, 170, 14);
        // Ceiling presses down narrowing the passage
        B.ceiling(d, 36, 0, GW);
        // Coral stalagmites for visual variety (non-functional thin posts)
        B.stalagmite(d, 100, 170, 6, 18);
        B.stalagmite(d, 160, 170, 6, 24);
        B.stalagmite(d, 280, 170, 6, 14);
    },
},

// ── Level 34 ──────────────────────────────────────────────────────────────────
{
    name: '34: The Trench',
    total: 20, required: 15, spawnRate: 52, time: 12000,
    entrance: { x: 28, y: 50 },
    exit:     { x: 180, y: 196, w: 20, h: 12 },
    theme: 'deep_sea',
    skills: { floater: 8, digger: 4, miner: 4, blocker: 3, builder: 3 },
    // Very deep central trench; exit is at the bottom of it.
    // Floaters needed to survive the drop; miners to dig sideways at the bottom.
    build(d) {
        B.borders(d, 5, 5, 12);
        // Wide left shelf
        B.ground(d, 0, 160, 70);
        // Narrow right shelf (just a landing)
        B.ground(d, 250, GW, 70);
        // Trench walls
        B.vwall(d, 155, 70, GH - 15, 10);
        B.vwall(d, 245, 70, GH - 15, 10);
        // Partial bottom sealing the trench (miners dig through)
        B.ground(d, 155, 245, 195);
        // Exit is cut through the left trench wall at the bottom
        // (clearZones will carve it out)
        B.stalagmite(d, 60, 70, 8, 20);
        B.stalagmite(d, 300, 70, 8, 16);
    },
},

// ── Level 35 ──────────────────────────────────────────────────────────────────
{
    name: '35: Coral Reef Crossing',
    total: 25, required: 20, spawnRate: 62, time: 11400,
    entrance: { x: 28, y: 60 },
    exit:     { x: 358, y: 60, w: 20, h: 12 },
    theme: 'coral',
    skills: { basher: 5, builder: 5, blocker: 4, climber: 4, floater: 2 },
    // Flat sea-floor with rising coral columns to bash/climb.
    build(d) {
        B.borders(d, 5, 5, 12);
        B.ground(d, 0, GW, 75);
        // Coral pillars of varying heights
        B.vwall(d,  80, 30, 75, 12);
        B.vwall(d, 130, 42, 75, 12);
        B.vwall(d, 180, 22, 75, 12);
        B.vwall(d, 240, 36, 75, 12);
        B.vwall(d, 295, 48, 75, 12);
        B.vwall(d, 340, 26, 75, 12);
        // Small reef platform above mid to add a jumping ledge
        B.platform(d, 155, 205, 38, 5);
    },
},

// ── Level 36 ──────────────────────────────────────────────────────────────────
{
    name: '36: Abyssal Drop',
    total: 20, required: 13, spawnRate: 50, time: 13200,
    entrance: { x: 28, y: 28 },
    exit:     { x: 358, y: 28, w: 20, h: 12 },
    theme: 'deep_sea',
    skills: { floater: 10, blocker: 6, builder: 5, basher: 2 },
    // Both entrance and exit at the top; a treacherous drop to the bottom if
    // a puffin isn't floated across the central bridgeable gap.
    build(d) {
        B.borders(d, 5, 5, 12);
        B.ground(d, 0, GW, 185);
        // Left and right top platforms — gap in the middle
        B.ground(d, 0, 130, 45);
        B.ground(d, 260, GW, 45);
        // Mid-air stepping stone very narrow
        B.platform(d, 188, 212, 80, 5);
        // Deep stalactites from low ceiling
        B.ceiling(d, 12, 0, GW);
        B.stalactite(d, 148, 12, 16, 46);
        B.stalactite(d, 236, 12, 16, 52);
    },
},

// ── Level 37 ──────────────────────────────────────────────────────────────────
{
    name: '37: Bubble Vents',
    total: 22, required: 17, spawnRate: 60, time: 12000,
    entrance: { x: 28, y: 170 },
    exit:     { x: 358, y: 50, w: 20, h: 12 },
    theme: 'deep_sea',
    skills: { climber: 6, builder: 6, basher: 4, blocker: 4, miner: 3 },
    // Puffins start at the bottom and must climb up tall thin walls.
    build(d) {
        B.borders(d, 5, 5, 12);
        B.ground(d, 0, GW, 185);
        // Ascending series of ledges, each slightly higher
        B.platform(d, 30, 130, 150, 6);
        B.platform(d, 100, 220, 120, 6);
        B.platform(d, 190, 300, 90, 6);
        B.platform(d, 270, 390, 62, 6);
        // Walls between ledges that climbers scale
        B.vwall(d,  98, 150, 156, 8);
        B.vwall(d, 188, 120, 126, 8);
        B.vwall(d, 268, 90,  96,  8);
        // Coral teeth at bottom
        B.stalagmite(d, 50,  185, 8, 22);
        B.stalagmite(d, 140, 185, 8, 16);
        B.stalagmite(d, 230, 185, 8, 28);
        B.stalagmite(d, 320, 185, 8, 14);
    },
},

// ── Level 38 ──────────────────────────────────────────────────────────────────
{
    name: '38: The Squeeze',
    total: 20, required: 15, spawnRate: 56, time: 12600,
    entrance: { x: 28, y: 60 },
    exit:     { x: 358, y: 120, w: 20, h: 12 },
    theme: 'wet_cave_stone',
    skills: { basher: 6, digger: 5, bomber: 3, blocker: 3, miner: 4 },
    // Tightly compressed maze — walls close in. Bashers and diggers carve paths.
    build(d) {
        B.borders(d, 5, 5, 12);
        B.ground(d, 0, GW, 155);
        // Row of horizontal slabs with just enough space between
        B.platform(d, 30, 200, 78, 8);
        B.platform(d, 150, 390, 112, 8);
        // Columns connecting slabs to the floor
        B.vwall(d,  30, 78, 155, 8);
        B.vwall(d, 192, 78, 112, 8);
        B.vwall(d, 148, 112, 155, 8);
        B.vwall(d, 382, 78, 155, 8);
        // Narrow top passage
        B.ceiling(d, 52, 0, GW);
        B.htunnel(d, 20, GW - 6, 52, 8);
    },
},

// ── Level 39 ──────────────────────────────────────────────────────────────────
{
    name: '39: Shipwreck',
    total: 24, required: 18, spawnRate: 58, time: 12600,
    entrance: { x: 28, y: 40 },
    exit:     { x: 358, y: 130, w: 20, h: 12 },
    theme: 'deep_sea',
    skills: { builder: 7, basher: 5, digger: 4, blocker: 4, floater: 3, miner: 3 },
    // Ship-hull shaped terrain: peaked hull in the middle blocks the route.
    build(d) {
        B.borders(d, 5, 5, 12);
        B.ground(d, 0, GW, 148);
        // Ship hull inverted V shape: thick block in the centre
        B.stairsUp(d,   60, 148, 8, 20, 8);  // Left hull side rises
        B.stairsDown(d, 220, 84, 8, 20, 8);  // Right hull side descends
        // Keel (top of hull): solid block
        B.vwall(d, 155, 60, 85, 66);
        // Hull interior room puffins can get trapped in
        B.chamber(d, 165, 85, 50, 30);
        // porthole (basher slot)
        B.htunnel(d, 60,  160, 105, 14);
        B.htunnel(d, 220, 390, 105, 14);
        // Seafloor stalactites
        B.stalactite(d, 30, 0, 10, 18);
        B.stalactite(d, 350, 0, 10, 22);
    },
},

// ── Level 40 ──────────────────────────────────────────────────────────────────
{
    name: '40: Bioluminescent Caves',
    total: 25, required: 20, spawnRate: 60, time: 12000,
    entrance: { x: 28, y: 28 },
    exit:     { x: 358, y: 168, w: 20, h: 12 },
    theme: 'fungus_glow',
    skills: { digger: 6, miner: 5, builder: 6, blocker: 4, basher: 3, floater: 3 },
    // Cave filled with arched ceilings and glowing sediment columns.
    build(d) {
        B.borders(d, 5, 5, 12);
        B.ground(d, 0, GW, 185);
        // Arched ceiling cavern
        B.archCeiling(d, 10, 390, 45, 20);
        // Three large sediment pillars
        B.vwall(d,  90, 20, 130, 18);
        B.vwall(d, 190, 20, 110, 18);
        B.vwall(d, 290, 20, 150, 18);
        // Floor shelves at different heights
        B.platform(d, 60, 145, 150, 6);
        B.platform(d, 155, 265, 120, 6);
        B.platform(d, 270, GW - 10, 140, 6);
        // Fungus stalagmites from floor
        B.stalagmite(d, 50, 185, 10, 20);
        B.stalagmite(d, 170, 185, 10, 30);
        B.stalagmite(d, 340, 185, 10, 16);
    },
},

// ── Level 41 ──────────────────────────────────────────────────────────────────
{
    name: '41: Pressure Locks',
    total: 22, required: 16, spawnRate: 52, time: 14400,
    entrance: { x: 28, y: 30 },
    exit:     { x: 358, y: 166, w: 20, h: 12 },
    theme: 'wet_cave_stone',
    skills: { bomber: 4, basher: 5, digger: 4, miner: 4, builder: 5, blocker: 3 },
    // Series of sealed pressure-lock chambers that must be bombed / bashed open.
    build(d) {
        B.borders(d, 5, 5, 12);
        B.ground(d, 0, GW, 185);
        // Chamber 1 (top-left)
        B.roomWalls(d, 20, 44, 100, 60, 8);
        B.chamber(d, 28, 52, 84, 44);
        // Tight corridor under chamber 1
        B.htunnel(d, 120, 185, 68, 18);
        // Chamber 2 (mid)
        B.roomWalls(d, 175, 60, 90, 80, 8);
        B.chamber(d, 183, 68, 74, 64);
        // Corridor leading to Chamber 3
        B.htunnel(d, 265, 380, 108, 18);
        // Chamber 3 (bottom-right)
        B.roomWalls(d, 280, 110, 100, 70, 8);
        B.chamber(d, 288, 118, 84, 54);
    },
},

// ── Level 42 ──────────────────────────────────────────────────────────────────
{
    name: '42: Mariana Finale',
    total: 25, required: 18, spawnRate: 50, time: 15600,
    entrance: { x: 28, y: 28 },
    exit:     { x: 358, y: 178, w: 20, h: 12 },
    theme: 'deep_sea',
    skills: { floater:5, bomber:3, blocker:4, builder:6, basher:5, digger:5, climber:4, miner:4 },
    // The grand deep-sea finale: a full-height descent with multiple obstacles.
    build(d) {
        B.borders(d, 5, 5, 12);
        B.ground(d, 0, GW, 195);
        // Spiral descent: platforms on alternating sides
        B.platform(d, 20, 230, 55, 7);
        B.vwall(d, 223, 55, 92, 8);      // Drop wall on right of tier 1
        B.platform(d, 160, 390, 100, 7);
        B.vwall(d, 165, 100, 140, 8);    // Drop wall on left of tier 2
        B.platform(d, 20, 240, 148, 7);
        B.vwall(d, 233, 148, 185, 8);    // Descent to floor
        // Right exit path
        B.htunnel(d, 240, GW - 6, 165, 18);
        // Extra coral columns
        B.stalagmite(d, 80,  195, 10, 28);
        B.stalagmite(d, 280, 195, 10, 20);
        // Top ceiling (dramatic pressure feel)
        B.ceiling(d, 12, 0, GW);
    },
},

]; // end LEVELS

// ─── Write + manifest ─────────────────────────────────────────────────────────

console.log('\nGenerating levels 33-42 (Deep Sea)…\n');

const generated = [];
for (let i = 0; i < LEVELS.length; i++) {
    generated.push(bake(33 + i, LEVELS[i]));
}

const manifestPath = join(root, 'levels', 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
for (const f of generated) {
    if (!manifest.levels.includes(f)) {
        const bonus = manifest.levels.indexOf('level_999.json');
        if (bonus >= 0) manifest.levels.splice(bonus, 0, f);
        else manifest.levels.push(f);
    }
}
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`\nManifest updated: ${manifest.levels.length} total levels.`);
console.log('Done — run the game to play levels 33-42.\n');
