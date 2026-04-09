/**
 * gen-levels-23-32.mjs  —  Levels 23-32: "Temple Ruins" arc (sandstone theme)
 *
 * Run:  node scripts/gen-levels-23-32.mjs
 *
 * Each level is built with the level-blocks.mjs primitives.
 * Outputs levels/level_023.json … level_032.json and patches manifest.json.
 */

import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as B from './level-blocks.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const root  = join(__dir, '..');
const GW = B.GW, GH = B.GH;

// ─── Level helper ─────────────────────────────────────────────────────────────

function makeTerrain(buildFn) {
    const d = new Uint8Array(GW * GH);
    buildFn(d);
    return d;
}

function bake(num, def) {
    const d = makeTerrain(def.build);
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

// ─── Level definitions 23-32 ──────────────────────────────────────────────────

const LEVELS = [

// ── Level 23 ──────────────────────────────────────────────────────────────────
{
    name: '23: Temple Entrance',
    total: 20, required: 17, spawnRate: 62, time: 10800,
    entrance: { x: 30, y: 60 },
    exit:     { x: 358, y: 160, w: 20, h: 12 },
    theme: 'sandstone',
    skills: { basher: 4, builder: 3, blocker: 2, floater: 2 },
    // Simple left-to-right. Ground slopes down; one basher wall in the middle.
    build(d) {
        B.borders(d, 5, 5, 12);
        // Main ground slopes down from L to R in two steps
        B.ground(d, 0, 140, 80);
        B.ground(d, 140, 280, 100);
        B.ground(d, 280, GW, 130);
        // Blocking wall the puffins can't walk around – needs basher
        B.vwall(d, 190, 60, 100, 14);
        // Decorative side pillar near exit
        B.vwall(d, 310, 100, 130, 8);
    },
},

// ── Level 24 ──────────────────────────────────────────────────────────────────
{
    name: '24: Pillared Hall',
    total: 22, required: 17, spawnRate: 58, time: 11400,
    entrance: { x: 28, y: 40 },
    exit:     { x: 358, y: 150, w: 20, h: 12 },
    theme: 'sandstone',
    skills: { basher: 6, climber: 4, blocker: 3, floater: 2, builder: 4 },
    // Flat ground with a colonnade of narrow pillars. Bash OR climb over.
    build(d) {
        B.borders(d, 5, 5, 12);
        B.ground(d, 0, GW, 160);
        // Six pillars across the hall
        B.colonnade(d, 50, 360, 100, 160, 12, 44);
        // Low ceiling in the middle section – forces puffins under
        B.ceiling(d, 30, 140, 260);
        // Small ledge before exit so builders can bridge
        B.platform(d, 320, 358, 140, 5);
    },
},

// ── Level 25 ──────────────────────────────────────────────────────────────────
{
    name: '25: The Grand Ramp',
    total: 25, required: 20, spawnRate: 62, time: 10200,
    entrance: { x: 28, y: 160 },
    exit:     { x: 358, y: 55, w: 20, h: 12 },
    theme: 'sandstone',
    skills: { builder: 8, blocker: 3, basher: 3, climber: 4 },
    // Puffins must ascend. There is a long diagonal ramp but it's broken by two gaps.
    build(d) {
        B.borders(d, 5, 5, 12);
        B.ground(d, 0, GW, 175);
        // Ascending ramp in three sections with gaps to cross
        B.rampUp(d, 30, 172, 90, 72);        // section 1 -> top at y=100
        //  gap at ~x=120
        B.rampUp(d, 140, 100, 90, 38);       // section 2 -> top at y=62
        //  gap at ~x=230
        B.rampUp(d, 250, 62, 90, 7);         // section 3 -> top at y=55
        // Right side landing to exit
        B.ground(d, 340, GW, 68);
        // Overhead stalactites add visual variety
        B.stalactite(d, 100, 0, 14, 20);
        B.stalactite(d, 210, 0, 14, 28);
        B.stalactite(d, 310, 0, 10, 16);
    },
},

// ── Level 26 ──────────────────────────────────────────────────────────────────
{
    name: '26: Pit of No Return',
    total: 20, required: 14, spawnRate: 52, time: 10800,
    entrance: { x: 28, y: 60 },
    exit:     { x: 358, y: 80, w: 20, h: 12 },
    theme: 'sandstone',
    skills: { floater: 8, blocker: 4, builder: 5, bomber: 2 },
    // Wide ledge on left; huge pit in the centre; far ledge at same height.
    // Floaters survive the drop; blockers stop puffins at the edge.
    build(d) {
        B.borders(d, 5, 5, 12);
        // Left landing pad
        B.ground(d, 0, 130, 80);
        // Right landing pad (slightly lower)
        B.ground(d, 260, GW, 92);
        // Pit floor deep down
        B.ground(d, 0, GW, 185);
        // Pit side walls (indestructible sides are the screen borders)
        // Narrow ledge at bottom centre so builders can connect
        B.platform(d, 165, 235, 170, 6);
        // Ceiling above start keeps falls inside the view
        B.ceiling(d, 20, 0, GW);
    },
},

// ── Level 27 ──────────────────────────────────────────────────────────────────
{
    name: '27: Temple Staircase',
    total: 25, required: 21, spawnRate: 64, time: 10800,
    entrance: { x: 28, y: 170 },
    exit:     { x: 358, y: 58, w: 20, h: 12 },
    theme: 'sandstone',
    skills: { digger: 5, miner: 5, builder: 6, blocker: 3, basher: 3 },
    // Big staircase ascending right.  Puffins can dig/mine shortcuts or
    // walk up the full staircase when builders plug gaps.
    build(d) {
        B.borders(d, 5, 5, 12);
        // 7 wide steps going up from left
        B.stairsUp(d, 20, 175, 7, 52, 16);
        // Exit landing
        B.ground(d, 340, GW, 70);
        // Decorative stalactite row
        for (let x = 50; x < 340; x += 60)
            B.stalactite(d, x, 0, 8, 14 + (x % 3) * 4);
    },
},

// ── Level 28 ──────────────────────────────────────────────────────────────────
{
    name: '28: Sealed Chamber',
    total: 20, required: 15, spawnRate: 54, time: 12000,
    entrance: { x: 30, y: 42 },
    exit:     { x: 358, y: 130, w: 20, h: 12 },
    theme: 'sandstone',
    skills: { basher: 5, digger: 5, bomber: 3, blocker: 3, miner: 3 },
    // Puffins fall into a sealed box; they must bash or dig their way out.
    build(d) {
        B.borders(d, 5, 5, 12);
        // Thick outer ground
        B.ground(d, 0, GW, 150);
        // Sealed room top-left where puffins land
        B.roomWalls(d, 20, 55, 140, 80, 10);
        B.chamber(d, 30, 65, 120, 60);   // hollow interior
        // Second chamber mid-level
        B.roomWalls(d, 180, 80, 130, 65, 8);
        B.chamber(d, 188, 88, 114, 49);
        // Open corridor leading right to exit
        B.htunnel(d, 310, GW - 6, 115, 30);
        // Connecting tunnel between chamber 2 and corridor (bashed by player)
        //  no pre-made tunnel – they earn it
    },
},

// ── Level 29 ──────────────────────────────────────────────────────────────────
{
    name: '29: The Labyrinth',
    total: 22, required: 16, spawnRate: 50, time: 14400,
    entrance: { x: 28, y: 28 },
    exit:     { x: 358, y: 168, w: 20, h: 12 },
    theme: 'sandstone',
    skills: { basher: 6, digger: 4, climber: 5, blocker: 4, miner: 4, builder: 4 },
    // Vertical maze of walls; puffins naturally walk right and bash / climb.
    build(d) {
        B.borders(d, 5, 5, 12);
        B.ground(d, 0, GW, 185);
        // Horizontal shelves creating a zigzag path
        B.platform(d, 30, 200, 55, 8);
        B.platform(d, 150, 390, 105, 8);
        B.platform(d, 30, 240, 155, 8);
        // Vertical dividers
        B.vwall(d, 200, 55, 105, 10);
        B.vwall(d, 148, 105, 155, 10);
        B.vwall(d, 238, 55, 155, 10);
        // Narrow gap in each wall so only climbers or bashers get through
        // (the vwall is intentionally solid - players must use skills)
        // Exit alcove
        B.platform(d, 300, GW, 148, 6);
    },
},

// ── Level 30 ──────────────────────────────────────────────────────────────────
{
    name: '30: Cascade Falls',
    total: 25, required: 18, spawnRate: 56, time: 12000,
    entrance: { x: 28, y: 28 },
    exit:     { x: 60, y: 168, w: 20, h: 12 },
    theme: 'sandstone',
    skills: { floater: 8, blocker: 5, builder: 6, basher: 2 },
    // Puffins walk right off a series of descending platforms.
    // Floaters survive each drop; blockers keep some safe on each tier.
    // Exit is back on the LEFT at the bottom (U-shape).
    build(d) {
        B.borders(d, 5, 5, 12);
        B.ground(d, 0, GW, 185);
        // Tier 1
        B.platform(d, 20, 200, 48, 6);
        // Tier 2
        B.platform(d, 130, 390, 98, 6);
        // Tier 3
        B.platform(d, 20, 270, 148, 6);
        // Ramp from tier-3 down to exit
        B.rampDown(d, 20, 148, 40, 32);
        // Decorative stalactites
        B.stalactite(d, 60, 0, 10, 22);
        B.stalactite(d, 170, 0, 10, 18);
        B.stalactite(d, 280, 0, 8, 30);
        B.stalactite(d, 350, 0, 10, 14);
    },
},

// ── Level 31 ──────────────────────────────────────────────────────────────────
{
    name: '31: Bridge Builders',
    total: 25, required: 22, spawnRate: 66, time: 11400,
    entrance: { x: 28, y: 80 },
    exit:     { x: 358, y: 80, w: 20, h: 12 },
    theme: 'sandstone',
    skills: { builder: 10, blocker: 5, basher: 2, floater: 3 },
    // Flat ground on both sides; three gaps must be bridged with builders.
    build(d) {
        B.borders(d, 5, 5, 12);
        // Left island
        B.ground(d, 0, 95, 92);
        // Three stepping islands across a chasm
        B.ground(d, 135, 185, 92);
        B.ground(d, 225, 275, 92);
        // Right island
        B.ground(d, 315, GW, 92);
        // All islands have a lip at the base (so builders reach)
        // Deep chasm floor
        B.ground(d, 0, GW, 185);
        // Overhanging ceiling of sandstone
        B.ceiling(d, 40, 0, GW);
        // Decorative sandstone columns (no function – just look)
        B.stalactite(d, 110, 40, 20, 25);
        B.stalactite(d, 200, 40, 20, 20);
        B.stalactite(d, 290, 40, 20, 25);
    },
},

// ── Level 32 ──────────────────────────────────────────────────────────────────
{
    name: '32: Temple of Trials',
    total: 25, required: 18, spawnRate: 50, time: 15000,
    entrance: { x: 28, y: 28 },
    exit:     { x: 358, y: 168, w: 20, h: 12 },
    theme: 'sandstone',
    skills: { floater:4, bomber:3, blocker:4, builder:6, basher:5, digger:4, climber:4, miner:4 },
    // Multi-phase challenge: descend, cross a gap, ascend past a sealed room.
    build(d) {
        B.borders(d, 5, 5, 12);
        B.ground(d, 0, GW, 185);
        // Left upper ledge (spawn area)
        B.ground(d, 0, 130, 48);
        // Drop zone – puffins fall to mid ground
        B.ground(d, 0, GW, 110);
        // First cut: open a hole in the mid ground for the exit route
        B.htunnel(d, 180, 310, 90, 20);
        // Pillar blocking central passage
        B.vwall(d, 190, 45, 110, 16);
        // Upper tunnel they fall through
        B.htunnel(d, 130, 200, 28, 20);
        // Right ascent stairs
        B.stairsUp(d, 280, 110, 5, 20, 14);
        // Exit alcove landing
        B.ground(d, 310, GW, 155);
        // Stalactites for visual drama
        B.stalactite(d, 70,  0, 14, 20);
        B.stalactite(d, 240, 0, 14, 30);
        B.stalactite(d, 340, 0, 10, 18);
    },
},

]; // end LEVELS array

// ─── Write JSON files ──────────────────────────────────────────────────────────

console.log('\nGenerating levels 23-32 (Temple Ruins / Sandstone)…\n');

const generated = [];
for (let i = 0; i < LEVELS.length; i++) {
    const levelNum = 23 + i;
    generated.push(bake(levelNum, LEVELS[i]));
}

// ─── Patch manifest.json ──────────────────────────────────────────────────────

const manifestPath = join(root, 'levels', 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

for (const f of generated) {
    if (!manifest.levels.includes(f)) {
        // Insert before level_999.json
        const bonus = manifest.levels.indexOf('level_999.json');
        if (bonus >= 0) manifest.levels.splice(bonus, 0, f);
        else manifest.levels.push(f);
    }
}

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`\nManifest updated: ${manifest.levels.length} total levels.`);
console.log('Done — run the game to play levels 23-32.\n');
