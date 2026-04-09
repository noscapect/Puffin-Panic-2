/**
 * gen-levels-43-52.mjs  —  Levels 43-52: "Iron Mines" arc (iron_ore / rusty_metal / cave)
 *
 * Run:  node scripts/gen-levels-43-52.mjs
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
        version: 1,
        name: def.name,
        total: def.total,
        required: def.required,
        spawnRate: def.spawnRate,
        time: def.time,
        entrance: def.entrance,
        exit: def.exit,
        theme: def.theme,
        skills: Object.assign(
            { floater:0, bomber:0, blocker:0, builder:0, basher:0, digger:0, climber:0, miner:0, platformer:0 },
            def.skills
        ),
        terrain,
    };
    const filename = `level_${String(num).padStart(3,'0')}.json`;
    writeFileSync(join(root, 'levels', filename), JSON.stringify(json, null, 2));
    const solid = d.filter(v => v).length;
    console.log(`  ✔ ${filename}  ${(solid/d.length*100).toFixed(1)}% solid  "${def.name}"`);
    return filename;
}

// ─── Level definitions 43-52 ──────────────────────────────────────────────────

const LEVELS = [

// ── Level 43 ──────────────────────────────────────────────────────────────────
{
    name: '43: Mine Shaft',
    total: 22, required: 18, spawnRate: 60, time: 10800,
    entrance: { x: 28, y: 28 },
    exit:     { x: 358, y: 168, w: 20, h: 12 },
    theme: 'iron_ore',
    skills: { digger: 6, miner: 5, basher: 4, blocker: 3, builder: 4 },
    // Puffins descend a mine shaft via a series of carved ledges.
    build(d) {
        B.borders(d, 5, 5, 12);
        // Solid mine rock filling most of the level
        B.rect(d, 0, 0, GW, GH);
        // Carve a series of connected pockets top → bottom
        B.chamber(d, 20, 20, 100, 30);     // top chamber (spawn area)
        B.vtunnel(d, 90, 50, 80, 18);      // first drop
        B.chamber(d, 60, 78, 140, 30);     // mid-level pocket
        B.vtunnel(d, 170, 108, 130, 18);   // second drop
        B.chamber(d, 140, 128, 180, 32);   // lower pocket
        B.vtunnel(d, 280, 160, 185, 18);   // third drop to floor
        B.htunnel(d, 280, GW - 6, 160, 24);// exit corridor
    },
},

// ── Level 44 ──────────────────────────────────────────────────────────────────
{
    name: '44: Ore Veins',
    total: 22, required: 17, spawnRate: 58, time: 11400,
    entrance: { x: 28, y: 60 },
    exit:     { x: 358, y: 140, w: 20, h: 12 },
    theme: 'iron_ore',
    skills: { miner: 8, basher: 5, digger: 4, blocker: 3, builder: 3 },
    // Diagonal ore veins (angled walls) — miners cut through at angles.
    build(d) {
        B.borders(d, 5, 5, 12);
        B.ground(d, 0, GW, 158);
        // Three diagonal vein clusters — rampUp/Down create angled solid bands
        B.rampUp(d, 60, 158, 55, 80);     // vein 1 slanting upward
        B.rampDown(d, 130, 80, 55, 55);   // vein 1 coming down (creates a peak)
        B.rampUp(d, 180, 158, 55, 70);    // vein 2
        B.rampDown(d, 250, 90, 55, 50);   // vein 2 peak
        B.rampUp(d, 295, 158, 55, 60);    // vein 3
        B.rampDown(d, 355, 98, 40, 40);   // vein 3 (near exit)
    },
},

// ── Level 45 ──────────────────────────────────────────────────────────────────
{
    name: '45: The Crusher',
    total: 20, required: 14, spawnRate: 50, time: 13200,
    entrance: { x: 28, y: 28 },
    exit:     { x: 358, y: 28, w: 20, h: 12 },
    theme: 'rusty_metal',
    skills: { blocker: 5, builder: 6, basher: 4, floater: 4, bomber: 3 },
    // Industrial level — horizontal crushing plates; puffins must be herded
    // and buildered across gaps between suspended metal plates.
    build(d) {
        B.borders(d, 5, 5, 12);
        B.ground(d, 0, GW, 185);
        // Suspended metal plates acting as floor segments
        B.platform(d, 20, 120, 44, 8);      // left plate (spawn height)
        B.platform(d, 150, 260, 44, 8);     // middle plate
        B.platform(d, 290, GW - 6, 44, 8); // right plate (exit height)
        // Hanging ceiling blades from top
        B.stalactite(d, 80, 0, 14, 34);
        B.stalactite(d, 200, 0, 14, 28);
        B.stalactite(d, 320, 0, 14, 34);
        // Vertical shaft risers (industrial supports)
        B.vwall(d,  20, 52, 100, 6);
        B.vwall(d, 114, 52, 100, 6);
        B.vwall(d, 150, 52, 100, 6);
        B.vwall(d, 254, 52, 100, 6);
    },
},

// ── Level 46 ──────────────────────────────────────────────────────────────────
{
    name: '46: Drill Tunnels',
    total: 24, required: 20, spawnRate: 62, time: 11400,
    entrance: { x: 28, y: 60 },
    exit:     { x: 358, y: 150, w: 20, h: 12 },
    theme: 'iron_ore',
    skills: { basher: 7, digger: 5, miner: 5, blocker: 3, builder: 3 },
    // Horizontal drill tunnels at different heights — puffins need to bash
    // through rock seams to connect them.
    build(d) {
        B.borders(d, 5, 5, 12);
        B.rect(d, 0, 0, GW, GH);  // solid fill
        // Three horizontal drill bores
        B.htunnel(d, 10, 200, 52, 20);
        B.htunnel(d, 180, GW - 6, 100, 20);
        B.htunnel(d, 10, 220, 148, 20);
        // Vertical connecting shafts
        B.vtunnel(d, 186, 52, 100, 14);
        B.vtunnel(d, 214, 100, 148, 14);
        // Wide entry drop
        B.vtunnel(d, 22, 10, 52, 22);
    },
},

// ── Level 47 ──────────────────────────────────────────────────────────────────
{
    name: '47: Smelter Floor',
    total: 25, required: 20, spawnRate: 60, time: 12000,
    entrance: { x: 28, y: 28 },
    exit:     { x: 358, y: 150, w: 20, h: 12 },
    theme: 'rusty_metal',
    skills: { builder: 7, blocker: 4, basher: 5, digger: 3, floater: 3, miner: 3 },
    // Wide open factory floor with metal grate pillars and wide gaps.
    build(d) {
        B.borders(d, 5, 5, 12);
        B.ground(d, 0, GW, 165);
        // Grate platforms at mid height
        B.platform(d, 20, 100, 90, 6);
        B.platform(d, 140, 240, 80, 6);
        B.platform(d, 280, 390, 100, 6);
        // Steel support beams (indestructible) — steel value 10
        B.steel(d, 95, 80, 105, 165);   // left beam
        B.steel(d, 235, 70, 245, 165);  // mid beam
        // Hanging gear assemblies (stalactites)
        B.stalactite(d, 60, 0, 22, 36);
        B.stalactite(d, 180, 0, 22, 28);
        B.stalactite(d, 310, 0, 16, 44);
    },
},

// ── Level 48 ──────────────────────────────────────────────────────────────────
{
    name: '48: Ore Cart Run',
    total: 22, required: 17, spawnRate: 56, time: 12600,
    entrance: { x: 28, y: 60 },
    exit:     { x: 358, y: 172, w: 20, h: 12 },
    theme: 'iron_ore',
    skills: { miner: 6, digger: 5, builder: 5, basher: 4, floater: 3, blocker: 3 },
    // Track-like level with a long zigzag descent on mine-cart rails.
    build(d) {
        B.borders(d, 5, 5, 12);
        B.ground(d, 0, GW, 188);
        // Rail segment 1 (top left going right)
        B.platform(d, 20, 160, 72, 6);
        // Drop block
        B.vwall(d, 154, 72, 118, 8);
        // Rail segment 2 (mid going left)
        B.platform(d, 30, 200, 118, 6);
        // Drop block 2
        B.vwall(d, 28, 118, 162, 8);
        // Rail segment 3 (lower going right)
        B.platform(d, 28, 220, 162, 6);
        // Drop block 3
        B.vwall(d, 214, 162, GH - 14, 8);
        // Right exit ramp
        B.platform(d, 214, GW - 6, 175, 6);
        // Overhead drills (stalactites)
        B.stalactite(d, 90, 0, 10, 22);
        B.stalactite(d, 250, 0, 10, 18);
    },
},

// ── Level 49 ──────────────────────────────────────────────────────────────────
{
    name: '49: The Iron Cage',
    total: 20, required: 14, spawnRate: 50, time: 14400,
    entrance: { x: 28, y: 28 },
    exit:     { x: 358, y: 168, w: 20, h: 12 },
    theme: 'rusty_metal',
    skills: { bomber: 5, basher: 5, digger: 4, builder: 5, blocker: 4, miner: 3 },
    // Puffins enter a massive iron cage (room full of internal walls).
    // They bomb or bash their way to the exit.
    build(d) {
        B.borders(d, 5, 5, 12);
        B.ground(d, 0, GW, 185);
        // Outer cage shell
        B.roomWalls(d, 15, 20, GW - 16, GH - 26, 8);
        B.chamber(d, 23, 28, GW - 32, GH - 52);  // hollow interior
        // Internal grid of bars
        B.vwall(d, 110, 28, GH - 41, 6);
        B.vwall(d, 200, 28, GH - 41, 6);
        B.vwall(d, 290, 28, GH - 41, 6);
        B.platform(d, 23, GW - 18, 88, 6);
        B.platform(d, 23, GW - 18, 138, 6);
        // Gaps in each bar to allow passage if right skill used
        B.htunnel(d, 23, 109, 88, 6);     // left of pillar 1
        B.htunnel(d, 116, 199, 138, 6);   // gap in shelf 2 centre-left
        B.htunnel(d, 296, GW - 18, 88, 6); // right of pillar 3
    },
},

// ── Level 50 ──────────────────────────────────────────────────────────────────
{
    name: '50: Halfway Down',
    total: 30, required: 25, spawnRate: 66, time: 12000,
    entrance: { x: 28, y: 28 },
    exit:     { x: 358, y: 90, w: 20, h: 12 },
    theme: 'iron_ore',
    skills: { floater:5, builder:8, blocker:5, basher:5, digger:4, climber:4, miner:3, bomber:3 },
    // Level 50 milestone — generous skills, fun mixed layout.
    // Wide open with a big celebration-style bridge challenge.
    build(d) {
        B.borders(d, 5, 5, 12);
        B.ground(d, 0, GW, 185);
        // Left high ledge (spawn)
        B.ground(d, 0, 100, 45);
        // Right high ledge (exit)
        B.ground(d, 290, GW, 45);  // changed exit y from 90 to 45+12 so exit is visible
        // Middle floating platforms at two heights
        B.platform(d, 130, 190, 80, 6);
        B.platform(d, 200, 265, 60, 6);
        // Diagonal approach from left
        B.rampDown(d, 95, 45, 45, 35);   // ramp down from left ledge
        // Vertical wall by right exit
        B.vwall(d, 288, 44, 105, 8);
        // Central pit with a hidden exit shelf
        B.platform(d, 150, 240, 128, 6);
        // Decorative shapes
        B.stalactite(d, 50, 0, 14, 26);
        B.stalactite(d, 210, 0, 14, 32);
        B.stalactite(d, 330, 0, 14, 20);
    },
},

// ── Level 51 ──────────────────────────────────────────────────────────────────
{
    name: '51: Minekart Mayhem',
    total: 22, required: 16, spawnRate: 54, time: 13200,
    entrance: { x: 28, y: 28 },
    exit:     { x: 358, y: 168, w: 20, h: 12 },
    theme: 'iron_ore',
    skills: { miner: 7, basher: 6, builder: 5, blocker: 4, digger: 3, floater: 3 },
    // Tight corkscrewing mine tunnels — miners cut the optimal path.
    build(d) {
        B.borders(d, 5, 5, 12);
        B.rect(d, 0, 0, GW, GH);
        // Corkscrew of tunnels
        B.htunnel(d, 10, 250, 22, 18);   // top corridor
        B.vtunnel(d, 236, 22, 75, 18);   // drop 1
        B.htunnel(d, 120, 250, 62, 18);  // mid corridor right→left
        B.vtunnel(d, 134, 62, 118, 18);  // drop 2
        B.htunnel(d, 120, 300, 104, 18); // lower corridor left→right
        B.vtunnel(d, 286, 104, 155, 18); // drop 3
        B.htunnel(d, 280, GW - 6, 140, 22); // exit corridor
    },
},

// ── Level 52 ──────────────────────────────────────────────────────────────────
{
    name: '52: Forged in Iron',
    total: 25, required: 18, spawnRate: 50, time: 15600,
    entrance: { x: 28, y: 28 },
    exit:     { x: 358, y: 168, w: 20, h: 12 },
    theme: 'rusty_metal',
    skills: { floater:4, bomber:4, blocker:4, builder:6, basher:6, digger:5, climber:4, miner:5 },
    // Full-difficulty iron mines finale — steel beams mixed with diggable rock.
    build(d) {
        B.borders(d, 5, 5, 12);
        B.ground(d, 0, GW, 185);
        // Indestructible steel girder framework
        B.steel(d, 0, 50, GW, 58);      // top steel deck (solid)
        B.htunnel(d, 20, GW - 6, 50, 8); // but cut a gap through it for entry
        // Diggable rock slabs below
        B.platform(d, 20, 150, 90, 8);
        B.platform(d, 200, GW - 6, 110, 8);
        // Steel support columns
        B.steel(d, 148, 58, 158, 130);
        B.steel(d, 198, 58, 208, 130);
        // Lower diggable layer
        B.platform(d, 20, 350, 148, 8);
        B.chamber(d, 28, 156, 130, 48);  // hollow under slab
        B.htunnel(d, 280, GW - 6, 148, 22); // right channel to exit
        // Stalactites from steel deck
        B.stalactite(d, 80, 58, 12, 22);
        B.stalactite(d, 230, 58, 12, 18);
        B.stalactite(d, 330, 58, 12, 28);
    },
},

]; // end LEVELS

// ─── Write + manifest ─────────────────────────────────────────────────────────

console.log('\nGenerating levels 43-52 (Iron Mines)…\n');

const generated = [];
for (let i = 0; i < LEVELS.length; i++) {
    generated.push(bake(43 + i, LEVELS[i]));
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
console.log('Done — run the game to play levels 43-52.\n');
