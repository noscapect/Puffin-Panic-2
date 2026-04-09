/**
 * gen-levels-63-72.mjs  —  Levels 63-72: "Bone Dungeon" arc (bone_white / cave / crystal_dense)
 *
 * Run:  node scripts/gen-levels-63-72.mjs
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
        name: def.name, total: def.total, required: def.required,
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

// ── Level 63 ──────────────────────────────────────────────────────────────────
{
    name: '63: Catacombs',
    total: 22, required: 17, spawnRate: 58, time: 11400,
    entrance: { x: 28, y: 28 },
    exit:     { x: 358, y: 168, w: 20, h: 12 },
    theme: 'bone_white',
    skills: { basher: 6, digger: 5, builder: 5, blocker: 3, miner: 3 },
    build(d) {
        B.borders(d, 5, 5, 12);
        B.ground(d, 0, GW, 185);
        // Catacomb corridors carved into bone-white limestone
        B.htunnel(d, 10, 250, 38, 18);
        B.vtunnel(d, 236, 38, 90, 18);
        B.htunnel(d, 110, 250, 78, 18);
        B.vtunnel(d, 124, 78, 130, 18);
        B.htunnel(d, 110, 380, 118, 18);
        B.vtunnel(d, 366, 118, 168, 18);
        // Bone pillars decorating the walls
        B.stalagmite(d,  60, 185, 8, 30);
        B.stalagmite(d, 170, 185, 8, 22);
        B.stalagmite(d, 310, 185, 8, 36);
    },
},

// ── Level 64 ──────────────────────────────────────────────────────────────────
{
    name: '64: Skull Pass',
    total: 22, required: 16, spawnRate: 56, time: 12000,
    entrance: { x: 28, y: 60 },
    exit:     { x: 358, y: 150, w: 20, h: 12 },
    theme: 'bone_white',
    skills: { climber: 6, basher: 5, builder: 5, blocker: 4, floater: 3 },
    build(d) {
        B.borders(d, 5, 5, 12);
        B.ground(d, 0, GW, 165);
        // Skull: two large eye sockets carved from a solid bone-white block
        B.rect(d, 80, 40, 320, 130);     // skull mass
        B.chamber(d, 100, 55, 80, 55);   // left eye socket
        B.chamber(d, 220, 55, 80, 55);   // right eye socket
        // Nasal passage tunnel
        B.htunnel(d, 80, 320, 115, 18);
        // Access tunnels at sides
        B.htunnel(d, 10, 80, 55, 55);    // left approach
        B.htunnel(d, 320, GW - 6, 100, 55); // right exit passage
    },
},

// ── Level 65 ──────────────────────────────────────────────────────────────────
{
    name: '65: Bone Spire',
    total: 20, required: 15, spawnRate: 52, time: 13200,
    entrance: { x: 28, y: 168 },
    exit:     { x: 358, y: 28, w: 20, h: 12 },
    theme: 'bone_white',
    skills: { climber: 8, builder: 5, bomber: 3, basher: 4, blocker: 3 },
    build(d) {
        B.borders(d, 5, 5, 12);
        B.ground(d, 0, GW, 185);
        // Giant bone spires rising from the floor
        B.vwall(d,  60, 60, 185, 14);
        B.vwall(d, 130, 40, 185, 14);
        B.vwall(d, 200, 80, 185, 14);
        B.vwall(d, 270, 50, 185, 14);
        B.vwall(d, 340, 70, 185, 14);
        // Top landing with a gap to the exit
        B.platform(d, 340, GW - 6, 45, 6);
        // Small ledges on spires for builders to bridge
        B.platform(d,  60, 74, 90, 5);
        B.platform(d, 130, 144, 70, 5);
        B.platform(d, 200, 214, 110, 5);
        B.platform(d, 270, 284, 80, 5);
    },
},

// ── Level 66 ──────────────────────────────────────────────────────────────────
{
    name: '66: Ancient Ossuary',
    total: 22, required: 16, spawnRate: 50, time: 14400,
    entrance: { x: 28, y: 28 },
    exit:     { x: 358, y: 168, w: 20, h: 12 },
    theme: 'bone_white',
    skills: { bomber: 5, basher: 5, digger: 5, blocker: 4, builder: 5, miner: 3 },
    build(d) {
        B.borders(d, 5, 5, 12);
        B.ground(d, 0, GW, 185);
        // Sealed ossuary rooms in series
        B.roomWalls(d, 15, 15, 130, 95, 8);
        B.chamber(d, 23, 23, 114, 79);
        B.htunnel(d, 145, 200, 52, 18);  // link corridor
        B.roomWalls(d, 165, 40, 100, 100, 8);
        B.chamber(d, 173, 48, 84, 84);
        B.htunnel(d, 265, 320, 88, 18);
        B.roomWalls(d, 280, 60, 110, 90, 8);
        B.chamber(d, 288, 68, 94, 74);
        // Link to exit
        B.htunnel(d, 280, GW - 6, 148, 22);
    },
},

// ── Level 67 ──────────────────────────────────────────────────────────────────
{
    name: '67: Crystal Cavern',
    total: 24, required: 19, spawnRate: 60, time: 12000,
    entrance: { x: 28, y: 28 },
    exit:     { x: 358, y: 148, w: 20, h: 12 },
    theme: 'crystal_dense',
    skills: { digger: 5, miner: 6, builder: 6, basher: 4, blocker: 3, floater: 3 },
    build(d) {
        B.borders(d, 5, 5, 12);
        B.ground(d, 0, GW, 165);
        // Crystal shard clusters rising from the floor
        for (let x = 50; x < 380; x += 50) {
            const h = 30 + ((x / 50 | 0) % 4) * 15;
            B.stalagmite(d, x - 6, 165, 12, h);
        }
        // Hanging crystal formations
        B.archCeiling(d, 10, GW - 10, 50, 15);
        B.stalactite(d,  80, 50, 16, 44);
        B.stalactite(d, 190, 50, 16, 36);
        B.stalactite(d, 300, 50, 16, 50);
        // Mid crystal shelf
        B.platform(d, 100, 290, 110, 6);
        B.htunnel(d, 120, 160, 110, 6);
        B.htunnel(d, 220, 270, 110, 6);
    },
},

// ── Level 68 ──────────────────────────────────────────────────────────────────
{
    name: '68: The Geode',
    total: 22, required: 17, spawnRate: 56, time: 13200,
    entrance: { x: 28, y: 28 },
    exit:     { x: 358, y: 168, w: 20, h: 12 },
    theme: 'crystal_dense',
    skills: { basher: 6, miner: 6, builder: 5, floater: 4, blocker: 3, climber: 4 },
    build(d) {
        B.borders(d, 5, 5, 12);
        // Fill with crystal rock then carve a geode interior
        B.rect(d, 0, 0, GW, GH);
        // Large hollow geode chamber
        B.chamber(d, 60, 40, 280, 140);
        // Crystal teeth lining the interior walls
        B.stalagmite(d,  80, 180, 10, 36);
        B.stalagmite(d, 130, 180, 8, 22);
        B.stalagmite(d, 195, 180, 10, 44);
        B.stalagmite(d, 270, 180, 8, 28);
        B.stalactite(d,  90, 40, 10, 32);
        B.stalactite(d, 155, 40, 8, 24);
        B.stalactite(d, 220, 40, 10, 36);
        B.stalactite(d, 315, 40, 8, 20);
        // Entry passage left, exit passage right
        B.htunnel(d, 10, 60, 52, 18);
        B.htunnel(d, 340, GW - 6, 152, 20);
    },
},

// ── Level 69 ──────────────────────────────────────────────────────────────────
{
    name: '69: Dungeon Deep',
    total: 22, required: 15, spawnRate: 50, time: 15000,
    entrance: { x: 28, y: 28 },
    exit:     { x: 358, y: 168, w: 20, h: 12 },
    theme: 'cave',
    skills: { floater:4, bomber:4, blocker:4, builder:5, basher:6, digger:5, miner:5, climber:4 },
    build(d) {
        B.borders(d, 5, 5, 12);
        B.ground(d, 0, GW, 185);
        // Dungeon multi-floor layout
        B.platform(d, 20, 160, 55, 7);
        B.platform(d, 200, GW - 6, 55, 7);
        B.platform(d, 20, 250, 110, 7);
        B.platform(d, 290, GW - 6, 110, 7);
        // Gates / portcullises (bashable walls)
        B.vwall(d, 156, 40, 55, 10);
        B.vwall(d, 195, 40, 55, 10);
        B.vwall(d, 246, 95, 110, 10);
        B.vwall(d, 284, 95, 110, 10);
        // Drop shafts
        B.vtunnel(d, 50, 55, 110, 20);
        B.vtunnel(d, 320, 55, 110, 20);
        B.vtunnel(d, 130, 110, 185, 20);
        B.vtunnel(d, 250, 110, 185, 20);
        // Dungeon stalactites
        B.stalactite(d, 100, 0, 10, 20);
        B.stalactite(d, 230, 0, 10, 26);
        B.stalactite(d, 360, 0, 10, 16);
    },
},

// ── Level 70 ──────────────────────────────────────────────────────────────────
{
    name: '70: Phantom Halls',
    total: 25, required: 20, spawnRate: 60, time: 12000,
    entrance: { x: 28, y: 60 },
    exit:     { x: 358, y: 60, w: 20, h: 12 },
    theme: 'bone_white',
    skills: { builder: 8, blocker: 5, basher: 5, floater: 4, climber: 3 },
    build(d) {
        B.borders(d, 5, 5, 12);
        B.ground(d, 0, GW, 185);
        // Two equal platforms at the same height with a HUGE gap
        B.ground(d, 0, 110, 72);
        B.ground(d, 280, GW, 72);
        // Three floating stepping stones in the void
        B.platform(d, 148, 178, 95, 5);
        B.platform(d, 195, 225, 80, 5);
        B.platform(d, 240, 270, 95, 5);
        // Arched ceiling
        B.archCeiling(d, 10, 390, 44, 18);
        // Phantom decorative columns (aesthetic only)
        B.stalactite(d, 130, 44, 12, 38);
        B.stalactite(d, 255, 44, 12, 44);
    },
},

// ── Level 71 ──────────────────────────────────────────────────────────────────
{
    name: '71: Bone Dragon',
    total: 22, required: 16, spawnRate: 54, time: 14400,
    entrance: { x: 28, y: 28 },
    exit:     { x: 358, y: 168, w: 20, h: 12 },
    theme: 'bone_white',
    skills: { basher: 6, digger: 5, miner: 5, bomber: 4, builder: 5, blocker: 3 },
    build(d) {
        B.borders(d, 5, 5, 12);
        B.ground(d, 0, GW, 185);
        // Dragon skeleton: spine = central ramp, ribs = angled platforms
        B.rampDown(d, 20, 40, 350, 130);   // spine ramp across whole level
        // Rib bones branching from spine at angles (stubby platforms)
        for (let i = 0; i < 6; i++) {
            const ribX = 50 + i * 55;
            const spineY = 40 + Math.round(i * 55 * (130 / 350));
            // Above-spine rib
            B.platform(d, ribX, ribX + 35, spineY - 22, 5);
            // Below-spine rib  
            B.platform(d, ribX, ribX + 35, spineY + 10, 5);
        }
        // Skull at the right end
        B.rect(d, 310, 130, 390, 180);
        B.chamber(d, 320, 138, 60, 38);
        // Entry cave
        B.htunnel(d, 10, 60, 22, 20);
    },
},

// ── Level 72 ──────────────────────────────────────────────────────────────────
{
    name: '72: Dungeon Master',
    total: 25, required: 18, spawnRate: 50, time: 16800,
    entrance: { x: 28, y: 28 },
    exit:     { x: 358, y: 168, w: 20, h: 12 },
    theme: 'cave',
    skills: { floater:5, bomber:4, blocker:5, builder:6, basher:6, digger:5, climber:5, miner:5 },
    build(d) {
        B.borders(d, 5, 5, 12);
        B.ground(d, 0, GW, 185);
        // Complex dungeon finale: all block types
        B.archCeiling(d, 10, 390, 48, 16);
        // Left zone: descending ledges
        B.platform(d, 20, 110, 62, 6);
        B.platform(d, 20, 160, 112, 6);
        B.vwall(d, 104, 62, 112, 8);
        // Central zone: sealed chamber with two bombers needed
        B.roomWalls(d, 150, 55, 100, 95, 8);
        B.chamber(d, 158, 63, 84, 79);
        // Right zone: ascent
        B.stairsUp(d, 260, 145, 5, 26, 16);
        // Central ceiling access shaft
        B.vtunnel(d, 186, 16, 55, 18);
        // Steel barrier before exit
        B.steel(d, 340, 120, 350, 165);
        B.htunnel(d, 350, GW - 6, 148, 22);
    },
},

]; // end LEVELS

console.log('\nGenerating levels 63-72 (Bone Dungeon / Crystal)…\n');

const generated = [];
for (let i = 0; i < LEVELS.length; i++) {
    generated.push(bake(63 + i, LEVELS[i]));
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
console.log('Done — run the game to play levels 63-72.\n');
