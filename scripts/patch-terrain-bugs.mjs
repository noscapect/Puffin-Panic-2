/**
 * patch-terrain-bugs.mjs
 *
 * Fixes specific terrain bugs found by QA in the baked level JSON files.
 *
 * Issues addressed:
 *  - "Thin bridge" anti-pattern: a small bridge of 4-6 cells elevated inside
 *    an already-existing air region creates an impassable 5px step-up for
 *    walkers.  The bridge is removed and, where needed, the gap region below
 *    it is filled with proper ground so the level still has a challenge.
 *
 * Affected levels (from route-analyzer output):
 *   level_006  Oasis Trap   – two 5px bridges at y=85-89
 *   level_014  Frozen Lake  – two 5px bridges at y=45-49
 *   level_015  Glacier      – one 5px bridge at y=85-89
 *   level_016  Inferno      – two 5px bridges at y=85-89
 *
 * Usage:
 *   node scripts/patch-terrain-bugs.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root  = join(__dir, '..');

const GW = 400, GH = 220;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function decodeRLE(pairs) {
    const buf = new Uint8Array(GW * GH);
    let idx = 0;
    for (const [v, c] of pairs) {
        for (let i = 0; i < c && idx < buf.length; i++) buf[idx++] = v;
    }
    return buf;
}

function encodeRLE(buf) {
    const pairs = [];
    let i = 0;
    while (i < buf.length) {
        const v = buf[i];
        let c = 1;
        while (i + c < buf.length && buf[i + c] === v) c++;
        pairs.push([v, c]);
        i += c;
    }
    return pairs;
}

function patchLevel(filename, patchFn) {
    const path = join(root, 'levels', filename);
    const level = JSON.parse(readFileSync(path, 'utf8'));
    const buf   = decodeRLE(level.terrain);
    const before = buf.reduce((s, v) => s + v, 0);

    patchFn(buf, GW, GH);

    const after = buf.reduce((s, v) => s + v, 0);
    level.terrain = encodeRLE(buf);
    writeFileSync(path, JSON.stringify(level, null, 2));
    console.log(`  ${filename}: ${after - before > 0 ? '+' : ''}${after - before} cells changed`);
}

// ─── Level 006 — Oasis Trap ───────────────────────────────────────────────────
// Original: gaps at x=100-149 and x=220-279 with 5px bridges at y=85-89.
// Fix: remove the bridges; the gaps in the wall (y=50-89) are visual only —
// puffins walk on y=90 ground freely through the "oasis" areas.
// To make the level actually challenging, extend the pits deep enough to be
// fatal (>70px) and let floaters handle the crossing.
// After removal, gaps at x=100-149 and x=220-279, y=50-89 are pure air.
// We keep the main ground at y=90 continuous — this means puffins CAN walk
// through safely on ground. The oasis "pits" are visual only.
// To preserve the FLOATER challenge: in a second pass we clear ground at
// y=90-160 for those x ranges, making genuine deep pits (70px → fatal fall).
// Floaters survive the 70px+ fall (exactly 70 = SAFE, but > 70 = fatal).
// Use y=90-164 → height = 74 px which IS fatal (>70).
patchLevel('level_006.json', (buf, gw, gh) => {
    // 1. Remove the 5px bridges at y=85-89
    for (let y = 85; y < 90; y++) {
        for (let x = 100; x < 150; x++) buf[y * gw + x] = 0;
        for (let x = 220; x < 280; x++) buf[y * gw + x] = 0;
    }
    // 2. Hollow out the ground beneath the gaps to create fatal-fall pits
    //    y=90 to y=163 (74 rows) → fall of 74px > 70 → fatal without floater
    for (let y = 90; y < 164; y++) {
        for (let x = 100; x < 150; x++) buf[y * gw + x] = 0;
        for (let x = 220; x < 280; x++) buf[y * gw + x] = 0;
    }
    // 3. Pit floor at y=164 (solid base to catch floaters)
    for (let x = 95; x < 155; x++)  buf[164 * gw + x] = 1;
    for (let x = 215; x < 285; x++) buf[164 * gw + x] = 1;

    // 4. Also clear the main ground at y=90 for the gap ranges
    //    so the pits have no floor at ground level
    for (let y = 90; y < 92; y++) {
        for (let x = 100; x < 150; x++) buf[y * gw + x] = 0;
        for (let x = 220; x < 280; x++) buf[y * gw + x] = 0;
    }

    // 5. Ensure entrance (x=30, y=20) and exit (x=360, y=78) areas are clear
    //    (bake-levels already did this, but let's be safe after pit changes)
    for (let dy = -2; dy <= 14; dy++) for (let dx = -2; dx <= 22; dx++) {
        const ex = 360 + dx, ey = 78 + dy;
        if (ex >= 0 && ex < gw && ey >= 0 && ey < gh) buf[ey * gw + ex] = 0;
    }
});

// ─── Level 014 — Frozen Lake ──────────────────────────────────────────────────
// Original: thin corridor y=30-49, ground at y=50, ceiling at y=0-29.
//   Gaps: y=30-49 cleared at x=120-179 and x=240-309 (was already air — no-op).
//   Bridges: y=45-49 added back at those x ranges — creates 5px step-up.
// Fix: remove bridges; then create proper floor holes at y=50 for the gap x
//   ranges so the pits are real (fall from y=50 down to y=50+? — ground is
//   solid at y=50+ everywhere else but at the gap areas we need to clear).
// After bridge removal: corridor y=30-49 is clean air. Ground at y=50 is solid.
// We additionally hollow out y=50-110 at gap x-ranges → 60px fall (NOT fatal).
// Platformer or builder can help cross. The extra fall isn't fatal, so floaters
// aren't required, but difficulty increases.
patchLevel('level_014.json', (buf, gw, gh) => {
    // 1. Remove the 5px bridges
    for (let y = 45; y < 50; y++) {
        for (let x = 120; x < 180; x++) buf[y * gw + x] = 0;
        for (let x = 240; x < 310; x++) buf[y * gw + x] = 0;
    }
    // 2. Make the pits real: clear y=50 (ground level) and a bit below
    //    at the gap x ranges — creates actual holes puffins can fall into
    for (let y = 50; y < 112; y++) {
        for (let x = 122; x < 178; x++) buf[y * gw + x] = 0;
        for (let x = 242; x < 308; x++) buf[y * gw + x] = 0;
    }
    // 3. Pit landings (so puffins don't fall off-screen)
    for (let x = 118; x < 182; x++) buf[112 * gw + x] = 1;
    for (let x = 238; x < 312; x++) buf[112 * gw + x] = 1;
});

// ─── Level 015 — Glacier ──────────────────────────────────────────────────────
// Original: ground at y=90. Crevasse cleared y=50-89 at x=160-209 (no-op,
//   was already air). Bridge y=85-89 at x=160-209 — creates 5px step-up.
//   Ice wall at x=260-264, y=60-84 (30px overhang — real obstacle for basher).
// Fix: remove bridge. Then make the crevasse a real gap in the ground (y=90
//   cleared at x=160-209 and below to y=160) → 70px fall = EXACTLY at limit.
//   Use y=90-161 → 71px total fall = fatal without floater.
patchLevel('level_015.json', (buf, gw, gh) => {
    // 1. Remove the bridge at y=85-89
    for (let y = 85; y < 90; y++) {
        for (let x = 160; x < 210; x++) buf[y * gw + x] = 0;
    }
    // 2. Clear ground under the crevasse to make it a real fatal pit
    for (let y = 90; y < 162; y++) {
        for (let x = 162; x < 208; x++) buf[y * gw + x] = 0;
    }
    // 3. Crevasse floor landing platform
    for (let x = 158; x < 212; x++) buf[162 * gw + x] = 1;
});

// ─── Level 016 — Inferno ──────────────────────────────────────────────────────
// Original: ground at y=90. Lava gaps cleared at x=110-149, y=60-89 and
//   x=220-269, y=50-89 (these ARE actual missing ground since ground starts
//   at y=90 and the clearing goes from y=50–89 which was already air? No:
//   wait — the GROUND fill is y=90-gh. The gaps clear y=60-89 which is NOT
//   ground (that's y=60-89, ground is y=90). So clearing y=60-89 is a no-op.
//   THEN the bridges are added at y=85-89 → same bug.
// Fix: remove bridges. Make the passages genuine by also clearing y=90 at
//   gap x-ranges and some depth below → creates real lava pits.
patchLevel('level_016.json', (buf, gw, gh) => {
    // 1. Remove 5px bridges
    for (let y = 85; y < 90; y++) {
        for (let x = 110; x < 150; x++) buf[y * gw + x] = 0;
        for (let x = 220; x < 270; x++) buf[y * gw + x] = 0;
    }
    // 2. Hollow out ground beneath to create genuine lava pits
    for (let y = 90; y < 162; y++) {
        for (let x = 112; x < 148; x++) buf[y * gw + x] = 0;
        for (let x = 222; x < 268; x++) buf[y * gw + x] = 0;
    }
    // 3. Pit floors
    for (let x = 108; x < 152; x++)  buf[162 * gw + x] = 1;
    for (let x = 218; x < 272; x++)  buf[162 * gw + x] = 1;
});

console.log('\nTerrain patches applied. Re-run QA to verify.');
