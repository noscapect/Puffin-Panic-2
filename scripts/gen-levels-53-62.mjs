/**
 * gen-levels-53-62.mjs  —  Levels 53-62: "Amber Forest" arc (amber / coral / mossy_ruin)
 *
 * Run:  node scripts/gen-levels-53-62.mjs
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

const LEVELS = [

// ── Level 53 ──────────────────────────────────────────────────────────────────
{
    name: '53: Amber Glade',
    total: 22, required: 18, spawnRate: 62, time: 10800,
    entrance: { x: 28, y: 60 },
    exit:     { x: 358, y: 130, w: 20, h: 12 },
    theme: 'amber',
    skills: { builder: 6, basher: 4, blocker: 3, floater: 3, climber: 3 },
    // Gently undulating amber terrain — soft ramps and open space.
    build(d) {
        B.borders(d, 5, 5, 12);
        B.roughGround(d, 0, GW, 145, 20, 0.12);
        // Tree-trunk amber pillars rising from the floor
        B.stalagmite(d,  70, 145, 14, 50);
        B.stalagmite(d, 140, 145, 14, 70);
        B.stalagmite(d, 230, 145, 14, 40);
        B.stalagmite(d, 300, 145, 14, 60);
        // Overhead canopy shelf
        B.ceiling(d, 22, 0, GW);
        // Hanging resin drops from ceiling
        B.stalactite(d, 100, 22, 8, 28);
        B.stalactite(d, 200, 22, 8, 36);
        B.stalactite(d, 310, 22, 8, 20);
    },
},

// ── Level 54 ──────────────────────────────────────────────────────────────────
{
    name: '54: Petrified Forest',
    total: 22, required: 17, spawnRate: 60, time: 11400,
    entrance: { x: 28, y: 60 },
    exit:     { x: 358, y: 140, w: 20, h: 12 },
    theme: 'mossy_ruin',
    skills: { basher: 6, climber: 5, builder: 5, blocker: 3, floater: 2 },
    // Tightly packed stone-tree trunks — bash or climb through.
    build(d) {
        B.borders(d, 5, 5, 12);
        B.ground(d, 0, GW, 155);
        // Forest of petrified trunks (alternating heights)
        for (let x = 50; x < 370; x += 38) {
            const h = 60 + ((x / 38 | 0) % 3) * 20;
            B.stalagmite(d, x, 155, 10, h);
        }
        // Mossy ruin wall blocking the centre
        B.vwall(d, 190, 40, 155, 16);
    },
},

// ── Level 55 ──────────────────────────────────────────────────────────────────
{
    name: '55: The Amber Tomb',
    total: 20, required: 15, spawnRate: 52, time: 13200,
    entrance: { x: 28, y: 28 },
    exit:     { x: 358, y: 168, w: 20, h: 12 },
    theme: 'amber',
    skills: { bomber: 4, digger: 5, miner: 4, basher: 4, builder: 5, blocker: 3 },
    // Stone sarcophagus-shaped rooms encased in amber.
    build(d) {
        B.borders(d, 5, 5, 12);
        B.ground(d, 0, GW, 185);
        // Outer amber shell — near-solid with carved tombs
        B.rect(d, 15, 15, GW - 15, GH - 15);
        // Three nested chambers
        B.chamber(d, 30, 30, 120, 60);
        B.chamber(d, 50, 35, 80, 50);    // inner void
        B.htunnel(d, 150, 280, 50, 18);  // corridor to mid
        B.chamber(d, 190, 28, 110, 140);  // large central tomb
        B.chamber(d, 205, 40, 80, 110);   // hollow it
        B.htunnel(d, 300, GW - 16, 120, 22); // exit passage
    },
},

// ── Level 56 ──────────────────────────────────────────────────────────────────
{
    name: '56: Root Maze',
    total: 24, required: 19, spawnRate: 60, time: 12000,
    entrance: { x: 28, y: 28 },
    exit:     { x: 358, y: 168, w: 20, h: 12 },
    theme: 'mossy_ruin',
    skills: { miner: 6, basher: 5, digger: 5, builder: 4, blocker: 3 },
    // Gnarled root networks — angled walls from rampUp/Down creating organic maze.
    build(d) {
        B.borders(d, 5, 5, 12);
        B.ground(d, 0, GW, 185);
        // Two main root arches crossing the level
        B.rampUp(d,  20, 185, 130, 100);   // left root rises
        B.rampDown(d, 150, 90, 130, 90);   // right leg descends
        B.rampUp(d, 160, 185, 130, 120);   // second root
        B.rampDown(d, 290, 68, 100, 60);   // right leg
        // Gap at the very top punched through
        B.htunnel(d, 20, GW - 6, 15, 20);
        // Ceiling 
        B.ceiling(d, 10, 0, GW);
    },
},

// ── Level 57 ──────────────────────────────────────────────────────────────────
{
    name: '57: Fossil Bed',
    total: 22, required: 17, spawnRate: 58, time: 12000,
    entrance: { x: 28, y: 60 },
    exit:     { x: 196, y: 196, w: 20, h: 12 },
    theme: 'amber',
    skills: { digger: 7, miner: 5, basher: 4, builder: 4, blocker: 3, floater: 2 },
    // Puffins must dig straight down through compressed fossil layers.
    // Exit is at the very bottom-centre.
    build(d) {
        B.borders(d, 5, 5, 12);
        // Deep layers of compacted fossil rock
        B.rect(d, 0, 70, GW, GH);
        // Seams: horizontal hollow gaps between layers (partial)
        B.htunnel(d, 20, 180, 100, 10);
        B.htunnel(d, 200, GW - 6, 100, 10);
        B.htunnel(d, 20, 220, 140, 10);
        B.htunnel(d, 240, GW - 6, 140, 10);
        // Central shaft cleared for diggers
        B.vtunnel(d, 185, 70, 185, 22);
    },
},

// ── Level 58 ──────────────────────────────────────────────────────────────────
{
    name: '58: Jungle Ruins',
    total: 24, required: 19, spawnRate: 60, time: 12600,
    entrance: { x: 28, y: 28 },
    exit:     { x: 358, y: 148, w: 20, h: 12 },
    theme: 'mossy_ruin',
    skills: { climber: 6, builder: 6, basher: 5, blocker: 4, floater: 3, miner: 3 },
    // Ancient ruin with crumbling stairways and mossy overhangs.
    build(d) {
        B.borders(d, 5, 5, 12);
        B.ground(d, 0, GW, 165);
        // Crumbling stairways on left and right
        B.stairsUp(d, 20, 165, 4, 40, 18);
        B.stairsDown(d, 220, 93, 4, 40, 18);
        // Central ruin arch
        B.vwall(d, 175, 40, 110, 14);
        B.vwall(d, 210, 40, 110, 14);
        B.platform(d, 175, 224, 40, 8);     // top of arch
        // Overgrown balconies
        B.platform(d, 100, 175, 110, 6);
        B.platform(d, 224, 340, 90, 6);
        // Mossy vines (thin stalactites)
        B.stalactite(d, 50, 0, 6, 40);
        B.stalactite(d, 130, 0, 6, 55);
        B.stalactite(d, 280, 0, 6, 35);
        B.stalactite(d, 360, 0, 6, 48);
    },
},

// ── Level 59 ──────────────────────────────────────────────────────────────────
{
    name: '59: The Canopy',
    total: 22, required: 17, spawnRate: 56, time: 13200,
    entrance: { x: 28, y: 168 },
    exit:     { x: 358, y: 28, w: 20, h: 12 },
    theme: 'mossy',
    skills: { climber: 8, builder: 5, basher: 4, blocker: 3, floater: 2 },
    // Puffins start at the forest floor and climb up to the canopy.
    // Thin trunk-like walls all the way up — heavy climber level.
    build(d) {
        B.borders(d, 5, 5, 12);
        B.ground(d, 0, GW, 185);
        // Thick canopy ceiling with scattered holes
        B.ceiling(d, 12, 0, GW);
        B.htunnel(d, 340, GW - 6, 12, 24);  // exit opening
        // Trunks spanning floor to ceiling — climbers scale them
        B.vwall(d,  60, 12, 185, 12);
        B.vwall(d, 130, 12, 185, 12);
        B.vwall(d, 200, 12, 185, 12);
        B.vwall(d, 270, 12, 185, 12);
        B.vwall(d, 340, 12, 185, 12);
        // Hollowed gaps mid-trunk to allow passage
        B.vtunnel(d,  60, 80, 140, 12);
        B.vtunnel(d, 130, 60, 120, 12);
        B.vtunnel(d, 200, 100, 160, 12);
        B.vtunnel(d, 270, 70, 130, 12);
        B.vtunnel(d, 340, 90, 150, 12);
    },
},

// ── Level 60 ──────────────────────────────────────────────────────────────────
{
    name: '60: Amber Panic',
    total: 25, required: 18, spawnRate: 52, time: 14400,
    entrance: { x: 28, y: 28 },
    exit:     { x: 358, y: 168, w: 20, h: 12 },
    theme: 'amber',
    skills: { floater: 5, bomber: 4, blocker: 4, builder: 6, basher: 5, digger: 5, miner: 4, climber: 3 },
    // Level 60 milestone — chaotic amber world mixing all organic shapes.
    build(d) {
        B.borders(d, 5, 5, 12);
        B.ground(d, 0, GW, 185);
        // Complex organic terrain using multiple primitives
        B.archCeiling(d, 10, 390, 42, 18);
        // Amber boulders (wide stubby pillars)
        B.stalagmite(d, 55,  185, 24, 55);
        B.stalagmite(d, 150, 185, 24, 75);
        B.stalagmite(d, 240, 185, 24, 45);
        B.stalagmite(d, 330, 185, 24, 65);
        // Mid floating slab with small gaps
        B.platform(d, 90, 145, 105, 6);
        B.htunnel(d, 100, 110, 105, 6);   // small gap 1
        B.htunnel(d, 130, 145, 105, 6);   // small gap 2
        // Hanging amber masses
        B.stalactite(d, 105, 42, 16, 40);
        B.stalactite(d, 210, 42, 16, 30);
        B.stalactite(d, 310, 42, 16, 44);
    },
},

// ── Level 61 ──────────────────────────────────────────────────────────────────
{
    name: '61: Resin River',
    total: 22, required: 17, spawnRate: 58, time: 13200,
    entrance: { x: 28, y: 40 },
    exit:     { x: 358, y: 145, w: 20, h: 12 },
    theme: 'amber',
    skills: { builder: 8, blocker: 5, floater: 4, basher: 4, miner: 4 },
    // River of amber flows through the level as gaps puffins must bridge.
    build(d) {
        B.borders(d, 5, 5, 12);
        // Ground with flowing gaps (river channels)
        B.ground(d, 0, 80, 55);           // left bank
        B.ground(d, 130, 220, 80);        // mid island 1
        B.ground(d, 265, 360, 65);        // mid island 2
        B.ground(d, 360, GW, 160);        // right bank (exit)
        // Shared deep river bed
        B.ground(d, 0, GW, 185);
        // Stalactite formations over the river
        B.stalactite(d, 90,  0, 12, 46);
        B.stalactite(d, 108, 0, 12, 36);
        B.stalactite(d, 235, 0, 12, 52);
        B.stalactite(d, 252, 0, 12, 40);
    },
},

// ── Level 62 ──────────────────────────────────────────────────────────────────
{
    name: '62: Lost in the Forest',
    total: 25, required: 18, spawnRate: 50, time: 15600,
    entrance: { x: 28, y: 28 },
    exit:     { x: 358, y: 168, w: 20, h: 12 },
    theme: 'mossy_ruin',
    skills: { floater:4, bomber:3, blocker:5, builder:6, basher:6, digger:4, climber:5, miner:5 },
    // Arc finale — full forest-ruin complexity with all tools needed.
    build(d) {
        B.borders(d, 5, 5, 12);
        B.ground(d, 0, GW, 185);
        // Ruined terraces descending right
        B.platform(d, 20, 120, 48, 7);
        B.platform(d, 100, 220, 88, 7);
        B.platform(d, 200, 320, 128, 7);
        B.platform(d, 300, GW - 6, 155, 7);
        // Vertical ruin walls between terraces
        B.vwall(d, 115, 48, 88, 10);
        B.vwall(d, 195, 88, 128, 10);
        B.vwall(d, 295, 128, 155, 10);
        // Arching ruin ceiling
        B.archCeiling(d, 10, 390, 38, 14);
        // Forest pillars rising from lowest terrace
        B.stalagmite(d,  60, 185, 10, 42);
        B.stalagmite(d, 160, 185, 10, 60);
        B.stalagmite(d, 260, 185, 10, 36);
        B.stalagmite(d, 355, 185, 10, 50);
        // Hanging vines
        B.stalactite(d,  80, 38, 6, 32);
        B.stalactite(d, 180, 38, 6, 48);
        B.stalactite(d, 290, 38, 6, 28);
    },
},

]; // end LEVELS

console.log('\nGenerating levels 53-62 (Amber Forest / Mossy Ruins)…\n');

const generated = [];
for (let i = 0; i < LEVELS.length; i++) {
    generated.push(bake(53 + i, LEVELS[i]));
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
console.log('Done — run the game to play levels 53-62.\n');
