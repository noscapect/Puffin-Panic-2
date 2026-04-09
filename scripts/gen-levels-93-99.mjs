/**
 * gen-levels-93-99.mjs  —  Levels 93-99: "Grand Finale" arc
 * Seven spectacular final levels. All skills in play. Maximum drama.
 *
 * Run:  node scripts/gen-levels-93-99.mjs
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

// ── Level 93: The Colosseum ───────────────────────────────────────────────────
// Huge circular arena. Puffins enter top-left, exit top-right.
// Concentric stone tiers they must bash and mine through.
{
    name: '93: The Colosseum',
    total: 30, required: 24, spawnRate: 52, time: 18000,
    entrance: { x: 28, y: 28 },
    exit:     { x: 358, y: 28, w: 20, h: 12 },
    theme: 'sandstone',
    skills: { floater:6, bomber:4, blocker:6, builder:8, basher:8, digger:6, climber:6, miner:6 },
    build(d) {
        B.borders(d, 5, 5, 12);
        B.ground(d, 0, GW, 185);
        // Colosseum tiers — three concentric raised rings
        // Outer ring
        B.rect(d, 30, 30, 370, 180);
        B.chamber(d, 40, 40, 320, 130);   // hollow interior
        // Middle ring
        B.rect(d, 80, 60, 320, 165);
        B.chamber(d, 92, 72, 216, 82);    // hollow
        // Inner ring / arena floor
        B.rect(d, 140, 110, 260, 165);
        B.chamber(d, 150, 120, 100, 38);  // arena pit
        // Arch passages through outer ring
        B.htunnel(d, 30, 80, 100, 22);    // left passage
        B.htunnel(d, 320, 370, 100, 22);  // right passage
        // Arch passages through middle ring
        B.htunnel(d, 80, 140, 128, 20);
        B.htunnel(d, 260, 320, 128, 20);
        // Landing ledges inside
        B.platform(d, 80, 140, 90, 5);
        B.platform(d, 260, 320, 90, 5);
        // Top entries cut through (spawn → exit path via inner)
        B.htunnel(d, 30, 80, 45, 16);    // spawn side entry
        B.htunnel(d, 320, 370, 45, 16);  // exit side entry
    },
},

// ── Level 94: The Abyss ───────────────────────────────────────────────────────
// Spawn high up. A vertiginous descent to the bottom, then rise again.
{
    name: '94: Into the Abyss',
    total: 28, required: 21, spawnRate: 55, time: 16800,
    entrance: { x: 28, y: 28 },
    exit:     { x: 358, y: 28, w: 20, h: 12 },
    theme: 'deep_sea',
    skills: { floater:8, bomber:4, blocker:5, builder:6, basher:6, digger:5, climber:6, miner:4 },
    build(d) {
        B.borders(d, 5, 5, 12);
        // Narrow top ledges on each side
        B.ground(d, 0, 80, 42);
        B.ground(d, 310, GW, 42);
        // The central ABYSS — open vertical shaft
        // Left cliff wall
        B.rect(d, 5, 42, 65, GH - 14);
        // Right cliff wall
        B.rect(d, 325, 42, GW - 6, GH - 14);
        // Floating platforms inside the abyss — asymmetric
        B.platform(d, 100, 160, 80, 6);
        B.platform(d, 220, 290, 110, 6);
        B.platform(d, 100, 175, 155, 6);
        B.platform(d, 210, 290, 185, 6);
        // Stalactites from abyss ceiling zone
        B.stalactite(d, 130, 42, 12, 28);
        B.stalactite(d, 250, 42, 12, 36);
        // Stalagmites from abyss floor
        B.stalagmite(d, 150, GH - 14, 10, 30);
        B.stalagmite(d, 240, GH - 14, 10, 24);
        // Steel bridge anchors at entrance/exit heights — bombers needed
        B.steel(d, 64, 35, 70, 42);   // left cliff edge cap
        B.steel(d, 320, 35, 326, 42); // right cliff edge cap
    },
},

// ── Level 95: Dragon's Spine ──────────────────────────────────────────────────
// A long undulating ridge of bone-white stone. Puffins must traverse it.
{
    name: '95: Dragon Spine',
    total: 26, required: 20, spawnRate: 54, time: 16800,
    entrance: { x: 28, y: 168 },
    exit:     { x: 358, y: 168, w: 20, h: 12 },
    theme: 'bone_white',
    skills: { floater:6, bomber:4, blocker:5, builder:8, basher:7, digger:5, climber:6, miner:4 },
    build(d) {
        B.borders(d, 5, 5, 12);
        B.ground(d, 0, GW, 185);
        // The dragon spine — a large jagged ridge running left to right
        B.rampUp(d, 20,   185, 60,  90);   // rise to peak 1
        B.rampDown(d, 80,  95, 40,  30);   // valley
        B.rampUp(d, 120,  125, 60, 100);   // rise to peak 2 (highest)
        B.rampDown(d, 180,  25, 60,  70);  // fall to mid
        B.rampUp(d, 240,   95, 60,  60);   // rise to peak 3
        B.rampDown(d, 300,  80, 60,  45);  // settle to exit plateau
        // Bone spurs (stalactites from ceiling) threatening the high peaks
        B.ceiling(d, 15, 80, 180);
        B.stalactite(d, 100, 15, 12, 48);
        B.stalactite(d, 160, 15, 12, 36);
        // Safe carved path along the base of the spine
        B.htunnel(d, 20, 380, 165, 20);
        // But the base tunnel is interrupted by steel columns
        B.steel(d, 130, 145, 142, 185);
        B.steel(d, 240, 145, 252, 185);
    },
},

// ── Level 96: The Mirror ──────────────────────────────────────────────────────
// Left/right symmetry. Top spawn, bottom exit in the center.
{
    name: '96: The Mirror',
    total: 30, required: 24, spawnRate: 55, time: 15600,
    entrance: { x: 28, y: 28 },
    exit:     { x: 185, y: 178, w: 20, h: 12 },
    theme: 'crystal_dense',
    skills: { floater:6, bomber:4, blocker:5, builder:7, basher:6, digger:6, climber:6, miner:5 },
    build(d) {
        B.borders(d, 5, 5, 12);
        B.ground(d, 0, GW, 185);
        // Symmetrical crystal cathedral structure
        // Left side mirrors right side around x=200
        // Outer walls with arched passages
        B.rect(d, 30, 15, 80, 185);
        B.htunnel(d, 30, 80, 80, 22);    // left arch
        B.rect(d, 310, 15, 360, 185);
        B.htunnel(d, 310, 360, 80, 22);  // right arch
        // Inner columns
        B.vwall(d, 110, 15, 130, 10);
        B.vwall(d, 275, 15, 130, 10);
        // Crystal bridge mid-level (mirrored)
        B.platform(d, 80, 150, 110, 6);
        B.platform(d, 240, 310, 110, 6);
        // Transept platform (both sides meet centrally)
        B.platform(d, 130, 260, 150, 6);
        B.vtunnel(d, 195, 150, 185, 20);  // descent shaft to exit
        // Cathedral ceiling arches
        B.archCeiling(d, 30, 200, 40, 15);
        B.archCeiling(d, 200, 370, 40, 15);
        // Crystalline stalactites
        B.stalactite(d,  55, 15, 10, 24);
        B.stalactite(d, 155, 15, 10, 30);
        B.stalactite(d, 245, 15, 10, 30);
        B.stalactite(d, 345, 15, 10, 24);
    },
},

// ── Level 97: Omega Loop ──────────────────────────────────────────────────────
// A serpentine loop that crosses itself. Miner-heavy.
{
    name: '97: Omega Loop',
    total: 28, required: 22, spawnRate: 52, time: 18000,
    entrance: { x: 28, y: 28 },
    exit:     { x: 358, y: 155, w: 20, h: 12 },
    theme: 'amber',
    skills: { floater:5, bomber:5, blocker:5, builder:7, basher:6, digger:6, climber:6, miner:8 },
    build(d) {
        B.borders(d, 5, 5, 12);
        B.ground(d, 0, GW, 185);
        // Solid amber mass with an omega (Ω) shaped tunnel carved through
        B.rect(d, 15, 15, GW - 16, GH - 14);
        // Top horizontal bar of omega
        B.htunnel(d, 15, GW - 16, 18, 22);
        // Left descent shaft
        B.vtunnel(d,  36, 18, 130, 20);
        // Right descent shaft
        B.vtunnel(d, GW - 56, 18, 130, 20);
        // Bottom omega curve — wide horizontal
        B.htunnel(d,  15, GW - 16, 130, 22);
        // Inner upward loop (the middle of the Ω)
        B.vtunnel(d, 130, 60, 130, 20);
        B.htunnel(d, 115, 280, 60, 22);
        B.vtunnel(d, 255, 60, 130, 20);
        // Exit branch from bottom-right
        B.htunnel(d, GW - 56, GW - 16, 145, 20);
        // Steel barriers forcing loop traversal (can't short-circuit)
        B.steel(d, 110, 15, 130, 40);    // blocks inner top-left
        B.steel(d, 255, 15, 275, 40);    // blocks inner top-right
    },
},

// ── Level 98: The Sacrifice ───────────────────────────────────────────────────
// Only 10 skills total, but 20 puffins. Save as many as possible.
{
    name: '98: The Last Rite',
    total: 20, required: 14, spawnRate: 45, time: 18000,
    entrance: { x: 28, y: 28 },
    exit:     { x: 358, y: 168, w: 20, h: 12 },
    theme: 'lava',
    skills: { floater:3, bomber:2, blocker:2, builder:3, basher:2, digger:2, climber:2, miner:2 },
    build(d) {
        B.borders(d, 5, 5, 12);
        B.ground(d, 0, GW, 185);
        // A perilous terrain that punishes impatience
        // Steep drop from left ledge
        B.ground(d, 0, 100, 40);
        // Mid-air stepping stones
        B.platform(d, 100, 145, 80, 5);
        B.platform(d, 180, 230, 120, 5);
        B.platform(d, 260, 320, 90, 5);
        // Final run to the exit with steel blockade
        B.ground(d, 320, GW, 80);
        B.steel(d, 340, 80, 350, 185);   // steel wall on exit platform
        B.htunnel(d, 340, 350, 148, 22); // narrow gap in steel
        // Precarious spikes
        B.stalactite(d, 130, 0, 8, 50);
        B.stalactite(d, 250, 0, 8, 38);
        B.stalagmite(d, 160, 185, 8, 38);
        B.stalagmite(d, 295, 185, 8, 30);
    },
},

// ── Level 99: The Grand Finale ────────────────────────────────────────────────
// The ultimate level. Every mechanic, maximum puffins, grand architecture.
{
    name: '99: The Grand Finale',
    total: 40, required: 30, spawnRate: 48, time: 24000,
    entrance: { x: 28, y: 28 },
    exit:     { x: 358, y: 168, w: 20, h: 12 },
    theme: 'crystal_dense',
    skills: { floater:8, bomber:6, blocker:8, builder:10, basher:8, digger:8, climber:8, miner:8 },
    build(d) {
        B.borders(d, 5, 5, 12);
        B.ground(d, 0, GW, 185);
        B.ceiling(d, 15, 0, GW);

        // ── Zone A: The Atrium (left third) ──────────────────────────────────
        // Grand vaulted entrance hall
        B.archCeiling(d, 5, 135, 65, 15);
        B.colonnade(d, 15, 130, 65, 185, 12, 28);
        B.platform(d, 15, 130, 115, 6);  // mid-hall balcony

        // ── Zone B: The Bridge (centre span) ─────────────────────────────────
        // A wide void with partial bridge already built; puffins extend it
        B.ground(d, 130, 160, 42);       // left bridge abutment
        B.ground(d, 250, GW - 6, 42);   // right bridge abutment (exit side up here)
        // Partial bridge spans (gaps the player must fill with builders)
        B.platform(d, 155, 195, 42, 6);  // partial 1
        B.platform(d, 225, 255, 42, 6);  // partial 2
        // Steel pins holding the partials — bombers to shift if blocking
        B.steel(d, 192, 35, 202, 42);
        B.steel(d, 215, 35, 228, 42);
        // Below bridge: cathedral space with stalactites
        B.stalactite(d, 170, 15, 14, 52);
        B.stalactite(d, 210, 15, 14, 38);
        B.stalactite(d, 240, 15, 14, 46);

        // ── Zone C: The Vault (right third) ──────────────────────────────────
        // Descending vault rooms with steel-gated transition
        B.roomWalls(d, 255, 55, 135, 80, 8);
        B.chamber(d, 263, 63, 119, 64);
        B.roomWalls(d, 255, 135, 135, 52, 8);
        B.chamber(d, 263, 143, 119, 36);
        // Gate between the two vault rooms
        B.steel(d, 263, 128, 374, 136);
        B.htunnel(d, 280, 360, 128, 8);   // narrow crawl under steel
        // Exit carved through right vault bottom
        B.htunnel(d, 338, GW - 6, 165, 22);

        // ── Linking corridors ─────────────────────────────────────────────────
        // Atrium → Bridge (right side of atrium)
        B.htunnel(d, 120, 135, 55, 18);
        // Bridge (right abutment) → Vault entry
        B.htunnel(d, 248, 263, 55, 18);
        // Vault entry → Vault lower
        B.vtunnel(d, 300, 118, 136, 18);

        // ── Decoration ───────────────────────────────────────────────────────
        B.stalagmite(d,  60, 185, 10, 28);
        B.stalagmite(d, 175, 185, 10, 22);
        B.stalagmite(d, 310, 185, 10, 35);
    },
},

]; // end LEVELS

console.log('\nGenerating levels 93-99 (Grand Finale)…\n');

const generated = [];
for (let i = 0; i < LEVELS.length; i++) {
    generated.push(bake(93 + i, LEVELS[i]));
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
console.log('Campaign complete! All 99 levels generated.\n');
