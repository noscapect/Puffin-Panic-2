/**
 * gen-levels-73-82.mjs  —  Levels 73-82: "Mixed Mastery" arc
 * Themes cycle across the full palette, using trickier layouts and steel.
 *
 * Run:  node scripts/gen-levels-73-82.mjs
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
        version: 1, name: def.name, total: def.total, required: def.required,
        spawnRate: def.spawnRate, time: def.time,
        entrance: def.entrance, exit: def.exit, theme: def.theme,
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

const LEVELS = [

// ── Level 73: lava + ice contrast ────────────────────────────────────────────
{
    name: '73: Hot & Cold',
    total: 22, required: 17, spawnRate: 56, time: 13200,
    entrance: { x: 28, y: 28 },
    exit:     { x: 358, y: 155, w: 20, h: 12 },
    theme: 'obsidian_floor',
    skills: { floater: 5, basher: 5, builder: 5, digger: 4, blocker: 4, miner: 3 },
    build(d) {
        B.borders(d, 5, 5, 12);
        B.ground(d, 0, GW, 170);
        // Left (hot) side: steep lava rock zigzag
        B.rampDown(d, 10, 38, 80, 60);
        B.rampUp(d, 90, 98, 80, 55);
        // Right (cold) side: flat icy ledges
        B.platform(d, 200, 280, 70, 6);
        B.platform(d, 280, GW - 6, 105, 6);
        // Steel beam separating the two halves
        B.steel(d, 188, 38, 198, 170);
        // Punch a basher-width hole in the steel wall
        B.htunnel(d, 188, 198, 90, 22);
        // Ceiling slice
        B.ceiling(d, 15, 0, GW);
        B.stalactite(d, 130, 15, 14, 30);
        B.stalactite(d, 300, 15, 14, 22);
    },
},

// ── Level 74: volcanic ash + bone white ───────────────────────────────────────
{
    name: '74: Ashen Crypt',
    total: 22, required: 16, spawnRate: 54, time: 13200,
    entrance: { x: 28, y: 40 },
    exit:     { x: 358, y: 165, w: 20, h: 12 },
    theme: 'volcanic_ash',
    skills: { basher: 6, digger: 5, miner: 5, blocker: 4, builder: 4, floater: 3 },
    build(d) {
        B.borders(d, 5, 5, 12);
        B.rect(d, 0, 55, GW, GH);        // thick ash deposit
        // Three parallel horizontal corridors carved in
        B.htunnel(d, 10, 220, 55, 18);   // upper corridor (spawn-side)
        B.htunnel(d, 150, GW - 6, 108, 18); // mid
        B.htunnel(d, 10, 260, 158, 18);  // lower
        // Vertical linking shafts
        B.vtunnel(d, 208, 55, 108, 16);
        B.vtunnel(d, 155, 108, 158, 16);
        B.vtunnel(d, 248, 158, GH - 14, 16);
        // Exit shaft
        B.htunnel(d, 248, GW - 6, 165, 18);
    },
},

// ── Level 75: wood planks factory ─────────────────────────────────────────────
{
    name: '75: The Sawmill',
    total: 24, required: 20, spawnRate: 60, time: 12000,
    entrance: { x: 28, y: 40 },
    exit:     { x: 358, y: 148, w: 20, h: 12 },
    theme: 'wood_planks',
    skills: { builder: 8, blocker: 5, basher: 5, digger: 3, floater: 3 },
    build(d) {
        B.borders(d, 5, 5, 12);
        B.ground(d, 0, GW, 165);
        // Conveyor-belt style stacked planks
        B.platform(d, 20, 150, 55, 8);
        B.platform(d, 120, 260, 95, 8);
        B.platform(d, 230, 390, 125, 8);
        // Saw-blade gaps cut into planks
        B.htunnel(d, 80, 105, 55, 8);
        B.htunnel(d, 180, 215, 95, 8);
        B.htunnel(d, 300, 345, 125, 8);
        // Solid wood pillars supporting the planks
        B.vwall(d, 20, 55, 165, 8);
        B.vwall(d, 141, 55, 165, 8);
        B.vwall(d, 252, 95, 165, 8);
        // Overhead log pile
        B.stalactite(d,  60, 0, 18, 22);
        B.stalactite(d, 200, 0, 18, 18);
        B.stalactite(d, 340, 0, 18, 28);
    },
},

// ── Level 76: packed snow puzzle ─────────────────────────────────────────────
{
    name: '76: Blizzard Pass',
    total: 22, required: 17, spawnRate: 58, time: 12600,
    entrance: { x: 28, y: 60 },
    exit:     { x: 358, y: 60, w: 20, h: 12 },
    theme: 'packed_snow',
    skills: { floater: 6, builder: 6, blocker: 5, basher: 3, climber: 4 },
    build(d) {
        B.borders(d, 5, 5, 12);
        B.ground(d, 0, GW, 185);
        // Left high ledge
        B.ground(d, 0, 100, 72);
        // Right high ledge (exit)
        B.ground(d, 290, GW, 72);
        // Snow drifts: rough ground in the middle valley
        B.roughGround(d, 100, 290, 72, 20, 0.15);
        // Ice stalactites from a low pressing ceiling
        B.ceiling(d, 22, 0, GW);
        B.stalactite(d,  80, 22, 12, 32);
        B.stalactite(d, 160, 22, 12, 44);
        B.stalactite(d, 230, 22, 12, 28);
        B.stalactite(d, 310, 22, 12, 36);
    },
},

// ── Level 77: salt flats speed run ─────────────────────────────────────────
{
    name: '77: Salt Flat Sprint',
    total: 30, required: 27, spawnRate: 70, time: 9600,
    entrance: { x: 28, y: 80 },
    exit:     { x: 358, y: 80, w: 20, h: 12 },
    theme: 'salt_flats',
    skills: { blocker: 4, basher: 6, builder: 4, floater: 2 },
    // Speed level — near-flat, but three thin salt ridges block the path.
    build(d) {
        B.borders(d, 5, 5, 12);
        B.ground(d, 0, GW, 92);
        // Three thin ridges rising from the flat ground
        B.vwall(d, 100, 58, 92, 8);
        B.vwall(d, 200, 52, 92, 8);
        B.vwall(d, 300, 62, 92, 8);
        // Wide sky gap in the ceiling — no ceiling pressure here
    },
},

// ── Level 78: toxic sludge escape ────────────────────────────────────────────
{
    name: '78: Toxic Swamp',
    total: 22, required: 15, spawnRate: 52, time: 14400,
    entrance: { x: 28, y: 28 },
    exit:     { x: 358, y: 168, w: 20, h: 12 },
    theme: 'toxic_sludge',
    skills: { floater: 6, bomber: 4, basher: 5, digger: 4, builder: 5, blocker: 3 },
    build(d) {
        B.borders(d, 5, 5, 12);
        B.ground(d, 0, GW, 185);
        // Swamp islands of solid ground separated by toxic gaps
        B.ground(d, 0, 110, 72);
        B.ground(d, 145, 250, 112);
        B.ground(d, 290, GW, 148);
        // Sludge pits going down to bottom
        // Toxic gas vents (stalactites)
        B.stalactite(d, 120, 0, 16, 50);
        B.stalactite(d, 258, 0, 16, 38);
        // Floating debris platforms
        B.platform(d, 110, 148, 82, 5);
        B.platform(d, 250, 292, 120, 5);
        // Organic mounds
        B.stalagmite(d, 70, 185, 12, 28);
        B.stalagmite(d, 200, 185, 12, 20);
        B.stalagmite(d, 330, 185, 12, 36);
    },
},

// ── Level 79: frozen mud descent ──────────────────────────────────────────────
{
    name: '79: The Thaw',
    total: 22, required: 17, spawnRate: 58, time: 13200,
    entrance: { x: 28, y: 28 },
    exit:     { x: 358, y: 168, w: 20, h: 12 },
    theme: 'frozen_mud',
    skills: { miner: 6, digger: 5, basher: 5, builder: 5, blocker: 3, floater: 3 },
    build(d) {
        B.borders(d, 5, 5, 12);
        B.ground(d, 0, GW, 185);
        // Frozen mud layers with ice sheets (steel) punctuating them
        B.platform(d, 20, GW - 6, 55, 8);
        B.steel(d, 20, 55, GW - 6, 63);   // ice sheet on top of first mud layer
        B.htunnel(d, 80, 130, 55, 8);     // thaw hole in first layer
        B.platform(d, 20, GW - 6, 110, 8);
        B.steel(d, 20, 110, GW - 6, 118);
        B.htunnel(d, 220, 290, 110, 8);   // thaw hole in second layer
        B.platform(d, 20, GW - 6, 160, 8);
        B.htunnel(d, 310, GW - 6, 160, 8); // thaw hole leading to exit
        // Icicle stalactites
        B.stalactite(d,  70, 0, 10, 36);
        B.stalactite(d, 190, 0, 10, 28);
        B.stalactite(d, 330, 0, 10, 42);
    },
},

// ── Level 80: milestone — gauntlet sampler ────────────────────────────────────
{
    name: '80: The Proving Ground',
    total: 30, required: 24, spawnRate: 56, time: 15000,
    entrance: { x: 28, y: 28 },
    exit:     { x: 358, y: 155, w: 20, h: 12 },
    theme: 'slate_ledge',
    skills: { floater:5, bomber:4, blocker:5, builder:7, basher:6, digger:5, climber:5, miner:5 },
    build(d) {
        B.borders(d, 5, 5, 12);
        B.ground(d, 0, GW, 185);
        // 5-section proving ground sampler
        // Section A: bridge gap
        B.ground(d, 0, 75, 48);
        B.ground(d, 115, 190, 48);
        // Section B: descending ledges
        B.platform(d, 190, 250, 90, 6);
        B.platform(d, 250, 310, 120, 6);
        // Section C: mine shaft (diggers)
        B.rect(d, 305, 48, 380, 140);
        B.vtunnel(d, 320, 48, 140, 18);
        B.htunnel(d, 305, 380, 155, 20);  // exit corridor at bottom
        // Connecting pieces
        B.platform(d, 170, 195, 48, 6);   // tiny ledge before B
        B.steel(d, 108, 35, 118, 48);     // mini steel gate over gap
        B.htunnel(d, 108, 118, 35, 13);   // open top of gate
        // Decoration
        B.stalactite(d,  50, 0, 12, 22);
        B.stalactite(d, 220, 0, 12, 34);
        B.stalactite(d, 350, 0, 12, 18);
    },
},

// ── Level 81: cliff chalk ascent ──────────────────────────────────────────────
{
    name: '81: White Cliffs',
    total: 22, required: 18, spawnRate: 60, time: 12600,
    entrance: { x: 28, y: 168 },
    exit:     { x: 358, y: 28, w: 20, h: 12 },
    theme: 'cliff_chalk',
    skills: { climber: 8, builder: 6, basher: 5, floater: 3, blocker: 3 },
    build(d) {
        B.borders(d, 5, 5, 12);
        B.ground(d, 0, GW, 185);
        // Sheer chalk cliffs puffins must climb
        B.vwall(d,  60, 20, 185, 14);
        B.vwall(d, 135, 20, 185, 14);
        B.vwall(d, 210, 20, 185, 14);
        B.vwall(d, 285, 20, 185, 14);
        B.vwall(d, 355, 20, 185, 14);
        // Ledges on each cliff face for builders
        B.platform(d,  60, 74, 120, 5);
        B.platform(d, 135, 149, 90, 5);
        B.platform(d, 210, 224, 140, 5);
        B.platform(d, 285, 299, 100, 5);
        // Top platforms linking cliff tops
        B.platform(d,  60, 135, 48, 5);
        B.platform(d, 149, 210, 38, 5);
        B.platform(d, 224, 285, 48, 5);
        B.platform(d, 299, GW - 6, 38, 5);
    },
},

// ── Level 82: mixed mastery finale ────────────────────────────────────────────
{
    name: '82: Masterwork',
    total: 25, required: 18, spawnRate: 50, time: 16800,
    entrance: { x: 28, y: 28 },
    exit:     { x: 358, y: 168, w: 20, h: 12 },
    theme: 'obsidian_floor',
    skills: { floater:5, bomber:4, blocker:5, builder:7, basher:6, digger:5, climber:5, miner:5 },
    build(d) {
        B.borders(d, 5, 5, 12);
        B.ground(d, 0, GW, 185);
        // Complex interlocking zones
        // Zone 1: descent with stalactite spikes
        B.ground(d, 0, 130, 48);
        B.stalactite(d, 30, 0, 10, 30);
        B.stalactite(d, 90, 0, 10, 38);
        // Zone 2: colonnade with steel caps
        B.colonnade(d, 125, 265, 48, 130, 10, 22);
        B.steel(d, 125, 120, 265, 130);  // steel floor cap on colonnade
        B.htunnel(d, 125, 265, 120, 10); // clear the steel cap
        // Zone 3: enclosed box punch-through
        B.roomWalls(d, 260, 48, 130, 100, 8);
        B.chamber(d, 268, 56, 114, 84);
        // Link from colonnade to box
        B.htunnel(d, 256, 268, 88, 16);
        // Exit corridor from box bottom
        B.htunnel(d, 268, GW - 6, 148, 22);
        // Decoration
        B.stalactite(d, 230, 0, 10, 28);
        B.stalactite(d, 340, 0, 10, 36);
    },
},

]; // end LEVELS

console.log('\nGenerating levels 73-82 (Mixed Mastery)…\n');

const generated = [];
for (let i = 0; i < LEVELS.length; i++) {
    generated.push(bake(73 + i, LEVELS[i]));
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
console.log('Done — run the game to play levels 73-82.\n');
