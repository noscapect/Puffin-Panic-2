/**
 * gen-levels-83-92.mjs  —  Levels 83-92: "Expert Gauntlet" arc
 * High difficulty: fewer skills given, high required%, steel barriers common.
 *
 * Run:  node scripts/gen-levels-83-92.mjs
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

// ── Level 83: bomber puzzle — four steel walls ────────────────────────────────
{
    name: '83: Steel Curtain',
    total: 20, required: 16, spawnRate: 55, time: 12000,
    entrance: { x: 28, y: 28 },
    exit:     { x: 358, y: 155, w: 20, h: 12 },
    theme: 'lava',
    skills: { bomber: 5, builder: 5, blocker: 4, floater: 4 },
    build(d) {
        B.borders(d, 5, 5, 12);
        B.ground(d, 0, GW, 170);
        // Four solid steel curtains, each needs a bomber to clear
        B.steel(d,  80,  15,  90, 170);
        B.steel(d, 150,  15, 160, 170);
        B.steel(d, 225,  15, 235, 170);
        B.steel(d, 305,  15, 315, 170);
        // Small diggable launch pads before each wall
        B.platform(d,  35,  80, 110, 6);
        B.platform(d, 100, 148, 90, 6);
        B.platform(d, 175, 225, 80, 6);
        B.platform(d, 255, 305, 95, 6);
        // Safety ledge before exit
        B.platform(d, 315, GW - 6, 155, 6);
    },
},

// ── Level 84: precision floaters ──────────────────────────────────────────────
{
    name: '84: Needle Drop',
    total: 20, required: 16, spawnRate: 58, time: 12000,
    entrance: { x: 28, y: 28 },
    exit:     { x: 175, y: 178, w: 20, h: 12 },
    theme: 'rock',
    skills: { floater: 8, blocker: 4, builder: 4 },
    build(d) {
        B.borders(d, 5, 5, 12);
        B.ground(d, 0, GW, 185);
        // High spawn platform
        B.ground(d, 0, 80, 38);
        // Three narrow pillars puffins must fall between
        B.vwall(d,  95, 15, 185, 10);
        B.vwall(d, 140, 15, 185, 10);
        B.vwall(d, 185, 15, 185, 10);
        B.vwall(d, 235, 15, 185, 10);
        // The target catchment pocket at the bottom — only open between 140 and 185
        B.ground(d, 0, 140, 165);       // left floor block
        B.ground(d, 195, GW, 165);      // right floor block
        // Landing pit deep enough to catch them
    },
},

// ── Level 85: all-miner excavation ────────────────────────────────────────────
{
    name: '85: The Excavation',
    total: 20, required: 15, spawnRate: 52, time: 14400,
    entrance: { x: 28, y: 28 },
    exit:     { x: 358, y: 155, w: 20, h: 12 },
    theme: 'iron_ore',
    skills: { miner: 8, digger: 5, basher: 5, blocker: 4, builder: 3 },
    build(d) {
        B.borders(d, 5, 5, 12);
        // Fill the whole map with ore
        B.rect(d, 5, 15, GW - 6, GH - 14);
        // Pre-carve just the spawn pocket and exit corridor
        B.chamber(d, 14, 15, 60, 35);   // spawn room
        B.chamber(d, GW - 70, GH - 70, 60, 55);  // exit room
        // Small hint passage to locate the exit
        B.htunnel(d, 300, GW - 6, 145, 12);
        // A few pre-cleared ventilation corridors
        B.htunnel(d, 80, 180, 45, 10);
        B.vtunnel(d, 175, 45, 110, 12);
        B.htunnel(d, 175, 310, 110, 10);
        B.vtunnel(d, 305, 110, 145, 12);
    },
},

// ── Level 86: lava pit precision ──────────────────────────────────────────────
{
    name: '86: Lava Crossing',
    total: 22, required: 18, spawnRate: 60, time: 12600,
    entrance: { x: 28, y: 68 },
    exit:     { x: 358, y: 68, w: 20, h: 12 },
    theme: 'lava',
    skills: { builder: 8, blocker: 5, basher: 4, floater: 3 },
    build(d) {
        B.borders(d, 5, 5, 12);
        B.ground(d, 0, GW, 185);
        // Left and right high platforms — vast lava sea below
        B.ground(d, 0, 60, 80);
        B.ground(d, 330, GW, 80);
        // Three narrow stepping-stone columns separated by gaps
        B.vwall(d, 130, 80, 185, 12);
        B.vwall(d, 190, 80, 185, 12);
        B.vwall(d, 260, 80, 185, 12);
        // Tiny tops on each pillar for builders to land on
    },
},

// ── Level 87: ice climbing  ────────────────────────────────────────────────────
{
    name: '87: Ice Tower',
    total: 20, required: 16, spawnRate: 55, time: 13200,
    entrance: { x: 28, y: 168 },
    exit:     { x: 358, y: 28, w: 20, h: 12 },
    theme: 'black_ice',
    skills: { climber: 8, builder: 7, blocker: 4, basher: 3 },
    build(d) {
        B.borders(d, 5, 5, 12);
        B.ground(d, 0, GW, 185);
        // A single giant ice tower taking up the centre
        B.rect(d, 140, 15, 260, 185);
        // Doors punched through at various heights — climbers go up the side
        B.htunnel(d, 140, 260, 155, 18);
        B.htunnel(d, 140, 260, 112, 18);
        B.htunnel(d, 140, 260,  68, 18);
        // Exit is on top-right — need to get around/over the tower
        B.platform(d, 260, GW - 6, 42, 6);
    },
},

// ── Level 88: cavern gauntlet ──────────────────────────────────────────────────
{
    name: '88: The Grand Cavern',
    total: 25, required: 20, spawnRate: 52, time: 15600,
    entrance: { x: 28, y: 28 },
    exit:     { x: 358, y: 168, w: 20, h: 12 },
    theme: 'cave',
    skills: { floater:4, bomber:3, blocker:5, builder:6, basher:5, digger:5, climber:4, miner:4 },
    build(d) {
        B.borders(d, 5, 5, 12);
        // Rich cave with all terrain types
        B.ground(d, 0, GW, 185);
        B.ceiling(d, 22, 0, GW);
        // Upper gallery — long winding ledge
        B.ground(d, 20, 200, 45);
        B.ground(d, 180, GW - 6, 85);
        // Mid-level colonnade
        B.colonnade(d, 20, 380, 110, 155, 12, 28);
        // Stalactite forest
        B.stalactite(d,  55, 22, 12, 44);
        B.stalactite(d, 115, 22, 12, 30);
        B.stalactite(d, 175, 22, 12, 52);
        B.stalactite(d, 240, 22, 12, 38);
        B.stalactite(d, 310, 22, 12, 46);
        B.stalactite(d, 365, 22, 12, 26);
        // Stalagmite floor spikes
        B.stalagmite(d,  80, 185, 10, 24);
        B.stalagmite(d, 155, 185, 10, 34);
        B.stalagmite(d, 260, 185, 10, 28);
        B.stalagmite(d, 345, 185, 10, 18);
        // Exit alcove
        B.chamber(d, 330, 145, 48, 40);
    },
},

// ── Level 89: bomber sequence ──────────────────────────────────────────────────
{
    name: '89: Chain Reaction',
    total: 20, required: 14, spawnRate: 50, time: 12600,
    entrance: { x: 28, y: 40 },
    exit:     { x: 358, y: 155, w: 20, h: 12 },
    theme: 'rock',
    skills: { bomber: 8, blocker: 5, builder: 4, floater: 3 },
    build(d) {
        B.borders(d, 5, 5, 12);
        // Solid rock with a chain of bomb-able plugs
        B.rect(d, 5, 55, GW - 6, GH - 14);
        // Pre-carved upper corridor
        B.htunnel(d, 5, GW - 6, 55, 22);
        // Diggable plugs — each requires a bomber
        B.rect(d,  72,  55,  88, 120);
        B.rect(d, 148,  55, 164, 160);
        B.rect(d, 224,  55, 240, 110);
        B.rect(d, 300,  55, 316, 140);
        // Below the plugs — open chambers
        B.chamber(d,  55, 120, 50, 45);
        B.chamber(d, 130, 160, 60, 25);
        B.chamber(d, 206, 110, 64, 50);
        B.chamber(d, 282, 140, 64, 30);
        // Final exit corridor
        B.htunnel(d, 282, GW - 6, 155, 18);
    },
},

// ── Level 90: expert timing — 90th level milestone ────────────────────────────
{
    name: '90: Ninety Lives',
    total: 30, required: 25, spawnRate: 55, time: 16800,
    entrance: { x: 28, y: 28 },
    exit:     { x: 358, y: 168, w: 20, h: 12 },
    theme: 'obsidian_floor',
    skills: { floater:5, bomber:4, blocker:6, builder:7, basher:5, digger:5, climber:5, miner:4 },
    build(d) {
        B.borders(d, 5, 5, 12);
        B.ground(d, 0, GW, 185);
        B.ceiling(d, 15, 0, GW);
        // Grand staircase descending L→R — but every other step is steel
        B.stairsDown(d, 20, 30, 10, 36, 14);
        for (let i = 0; i < 10; i += 2) {
            const sx = 20 + i * 36;
            const sy = 30 + i * 14;
            B.steel(d, sx, sy, sx + 36, sy + 14);
        }
        // Mid-level large chamber with colonnade
        B.chamber(d, 20, 145, GW - 40, 38);
        B.colonnade(d, 20, GW - 20, 145, 183, 8, 28);
        // Bomber-required steel gate before the exit
        B.steel(d, GW - 65, 145, GW - 55, 185);
        B.htunnel(d, GW - 55, GW - 6, 165, 20);
    },
},

// ── Level 91: death march — precision required ─────────────────────────────────
{
    name: '91: No Margin for Error',
    total: 18, required: 17, spawnRate: 60, time: 12000,
    entrance: { x: 28, y: 48 },
    exit:     { x: 358, y: 155, w: 20, h: 12 },
    theme: 'volcanic_ash',
    skills: { blocker: 4, builder: 6, floater: 4, basher: 3 },
    build(d) {
        B.borders(d, 5, 5, 12);
        B.ground(d, 0, GW, 185);
        // Left raised working platform
        B.ground(d, 0, 130, 60);
        // Big central void — builders must bridge it
        B.ground(d, 240, GW, 60);
        // Second lower platform on right for exit access
        B.ground(d, 300, GW, 128);
        // Small helper ledge in the void
        B.platform(d, 170, 200, 100, 5);
        // Tight exit passage
        B.htunnel(d, 240, GW - 6, 155, 20);
        // Stalactites threatening the bridge path
        B.stalactite(d, 145, 0, 10, 38);
        B.stalactite(d, 215, 0, 10, 44);
    },
},

// ── Level 92: gauntlet finale ─────────────────────────────────────────────────
{
    name: "92: Gauntlet's End",
    total: 25, required: 18, spawnRate: 50, time: 15600,
    entrance: { x: 28, y: 28 },
    exit:     { x: 358, y: 168, w: 20, h: 12 },
    theme: 'crystal_dense',
    skills: { floater:5, bomber:5, blocker:5, builder:7, basher:6, digger:5, climber:5, miner:4 },
    build(d) {
        B.borders(d, 5, 5, 12);
        B.ground(d, 0, GW, 185);
        // Crystal maze — five inter-connected rooms
        B.roomWalls(d, 15, 18, 100, 80, 7);
        B.chamber(d, 22, 25, 86, 66);
        B.roomWalls(d, 130, 18, 120, 80, 7);
        B.chamber(d, 137, 25, 106, 66);
        B.roomWalls(d, 265, 18, 118, 100, 7);
        B.chamber(d, 272, 25, 104, 86);
        B.roomWalls(d, 15, 108, 230, 68, 7);
        B.chamber(d, 22, 115, 216, 54);
        B.roomWalls(d, 255, 118, 128, 58, 7);
        B.chamber(d, 262, 125, 114, 44);
        // Corridors linking rooms
        B.htunnel(d, 101, 130, 55, 14);  // room1 → room2
        B.htunnel(d, 250, 265, 55, 14);  // room2 → room3
        B.vtunnel(d,  80, 98, 108, 14);  // room1 → room4
        B.vtunnel(d, 200, 98, 108, 14);  // room2 → room4
        B.vtunnel(d, 310, 118, 118, 14); // room3 → room5
        B.htunnel(d, 245, 255, 148, 14); // room4 → room5
        // Exit from room 5
        B.htunnel(d, 369, GW - 6, 168, 18);
        // Steel gate between room4 and exit room5
        B.steel(d, 245, 108, 255, 118);
    },
},

]; // end LEVELS

console.log('\nGenerating levels 83-92 (Expert Gauntlet)…\n');

const generated = [];
for (let i = 0; i < LEVELS.length; i++) {
    generated.push(bake(83 + i, LEVELS[i]));
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
console.log('Done — run the game to play levels 83-92.\n');
