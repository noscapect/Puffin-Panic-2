#!/usr/bin/env node
/**
 * patch-steel-borders.mjs
 *
 * Retroactively upgrades all existing baked level JSON files so their
 * border regions use steel (value 10 = indestructible) instead of
 * ordinary solid terrain (value 1).
 *
 * Border regions applied (pixels measured from each edge):
 *   Top    : y = 0..4  (5 px)
 *   Bottom : y = H-12..H  (12 px, matching bake call B.borders(d,5,5,12))
 *   Left   : x = 0..4  (5 px)
 *   Right  : x = W-5..W  (5 px)
 *
 * Run: node scripts/patch-steel-borders.mjs
 */
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

const W = 400, H = 220;
const STEEL = 10;

// Border thicknesses (must match what every level's build() uses)
const LEFT   = 5;
const RIGHT  = 5;
const BOTTOM = 12;
const TOP    = 5;

const levelsDir = join(process.cwd(), 'levels');
const files = readdirSync(levelsDir)
    .filter(f => f.match(/^level_\d{3}\.json$/))
    .sort();

console.log(`\n=== Patching steel borders on ${files.length} levels ===\n`);

let patched = 0;
let totalChanged = 0;

for (const file of files) {
    const path = join(levelsDir, file);
    const lvl = JSON.parse(readFileSync(path, 'utf8'));

    // Decode RLE
    const data = new Uint8Array(W * H);
    let idx = 0;
    for (const [v, c] of lvl.terrain)
        for (let i = 0; i < c && idx < data.length; i++) data[idx++] = v;

    // Apply steel borders
    let changed = 0;
    function steel(x1, y1, x2, y2) {
        for (let y = y1; y < y2; y++)
            for (let x = x1; x < x2; x++) {
                const i = y * W + x;
                if (data[i] !== STEEL) { data[i] = STEEL; changed++; }
            }
    }

    steel(0,       0,       LEFT,    H);      // left wall
    steel(W-RIGHT, 0,       W,       H);      // right wall
    steel(0,       0,       W,       TOP);    // top ceiling
    steel(0,       H-BOTTOM, W,      H);      // bottom floor

    if (changed === 0) {
        console.log(`  ✔ ${file} — already steel`);
        continue;
    }

    // Re-encode RLE
    const terrain = [];
    let ri = 0;
    while (ri < data.length) {
        const val = data[ri];
        let count = 1;
        while (ri + count < data.length && data[ri + count] === val) count++;
        terrain.push([val, count]);
        ri += count;
    }

    // Verify sum
    const sum = terrain.reduce((s, [, c]) => s + c, 0);
    if (sum !== W * H) throw new Error(`${file}: RLE sum ${sum} ≠ ${W * H}`);

    lvl.terrain = terrain;
    writeFileSync(path, JSON.stringify(lvl, null, 2));
    console.log(`  ✔ ${file} — ${changed} pixels → steel`);
    patched++;
    totalChanged += changed;
}

console.log(`\n=== Done: ${patched} file(s) updated, ${totalChanged} pixels hardened to titanium ===\n`);
