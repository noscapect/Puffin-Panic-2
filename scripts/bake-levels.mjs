/**
 * bake-levels.mjs
 *
 * Evaluates js/levels.js in a Node vm sandbox to extract all inline level
 * definitions, runs each buildTerrain function, RLE-encodes the result, and
 * writes one JSON file per level into the levels/ directory.
 *
 * Also creates levels/manifest.json with the ordered file list.
 *
 * Usage:
 *   node scripts/bake-levels.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';

const __dir = dirname(fileURLToPath(import.meta.url));
const root  = join(__dir, '..');

const GW  = 400;
const GH  = 220;
const FPS_VAL = 30;

// ─── RLE helpers ──────────────────────────────────────────────────────────────
function encodeRLE(data) {
    const pairs = [];
    let i = 0;
    while (i < data.length) {
        const val = data[i];
        let count = 1;
        while (i + count < data.length && data[i + count] === val) count++;
        pairs.push([val, count]);
        i += count;
    }
    return pairs;
}

function rleSum(pairs) {
    return pairs.reduce((s, p) => s + p[1], 0);
}

// ─── Load levels.js via vm ────────────────────────────────────────────────────
const bakedLevels = [];
const sandbox = {
    __LEVELS:    bakedLevels,
    FPS:         FPS_VAL,
    GAME_WIDTH:  GW,
    GAME_HEIGHT: GH,
    window:      {},
    console,
    Math, Array, Number, Object, Boolean, String,
    Uint8Array, Float32Array, Int32Array,
    parseInt, parseFloat, isNaN, isFinite,
    JSON, Promise,
};
createContext(sandbox);

const levelsJs = readFileSync(join(root, 'js', 'levels.js'), 'utf8');

// Patch: redirect LEVELS constant to our shared array so .push() populates it.
const patchedJs = levelsJs.replace(
    'const LEVELS = [];',
    'var LEVELS = __LEVELS;'
);

try {
    runInContext(patchedJs, sandbox, { filename: 'levels.js' });
} catch (e) {
    console.error('Failed to evaluate levels.js:', e.message);
    process.exit(1);
}

console.log(`Loaded ${bakedLevels.length} inline levels from levels.js.\n`);

// ─── Inject missing Level 20 ──────────────────────────────────────────────────
// Levels 1-19 exist at indices 0-18.  Level 21 is at index 19 (gap!).
// Splice a new Level 20 in so indices stay aligned with level numbers.
const level20 = {
    name: '20: Cavern of Echoes',
    total: 25,
    required: 20,
    spawnRate: FPS_VAL * 2,
    time: 6 * 60 * FPS_VAL,
    entrance: { x: 30, y: 20 },
    exit: { x: 370, y: 78, w: 20, h: 12 },
    theme: 'crystal',
    skills: {
        floater: 5, bomber: 3, blocker: 3, builder: 7,
        basher: 4,  digger:  5, climber: 5, miner: 4, platformer: 3,
    },
    buildTerrain: (data, gw, gh) => {
        // Ground floor
        for (let y = 90; y < gh; y++) for (let x = 0; x < gw; x++) data[y * gw + x] = 1;
        // Side walls
        for (let y = 0; y < gh; y++) {
            for (let x = 0; x < 5; x++) data[y * gw + x] = 1;
            for (let x = gw - 5; x < gw; x++) data[y * gw + x] = 1;
        }
        // Crystal shelf near entrance
        for (let y = 70; y < 90; y++) for (let x = 60; x < 150; x++) data[y * gw + x] = 1;
        // Upper stepped platform
        for (let y = 55; y < 75; y++) for (let x = 120; x < 220; x++) data[y * gw + x] = 1;
        // Tall crystal pillar (bashers or miners)
        for (let y = 35; y < 90; y++) for (let x = 240; x < 260; x++) data[y * gw + x] = 1;
        // Right landing ledge before exit
        for (let y = 60; y < 70; y++) for (let x = 280; x < 395; x++) data[y * gw + x] = 1;
        // Hanging stalactite above mid-section
        for (let y = 0; y < 30; y++) for (let x = 155; x < 195; x++) data[y * gw + x] = 1;
    },
};

// Find the insertion point: between last level-19 entry and level-21 entry.
// After evaluation, LEVELS[0..17] = levels 1-18, LEVELS[18] = Level 19,
// LEVELS[19] = Level 21 (no 20).  Insert at index 19.
bakedLevels.splice(19, 0, level20);
console.log('  + Injected missing Level 20 at index 19.');

// ─── Fix Level 6 – exit is unreachable (y:20 in the sky) ──────────────────────
{
    const l6 = bakedLevels[5]; // index 5 → Level 6
    if (l6 && l6.name && l6.name.includes('Oasis')) {
        l6.exit = { x: 360, y: 78, w: 20, h: 12 };
        console.log('  ✏ Fixed exit position for Level 6 (exit was unreachable at y=20).');
    }
}

// ─── Fix Level 2 – exit can be inside cliff (make sure it's in clear space) ───
{
    // Level 2 index=1: "Bridge Over Troubled Water"
    // exit {x:360,y:40}, buildTerrain clears x:350-379,y:35-49. Fine.
    // Entrance {x:30,y:40} – the left cliff covers y:50-gh,x:0-149 and entrance y=40 is
    // above that cliff. Puffins spawn at y=40 (above the cliff top y=50) and walk right.
    // That is within the game boundary – ok.
}

// ─── Ensure output directory exists ──────────────────────────────────────────
const outDir = join(root, 'levels');
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

// ─── Bake every level ─────────────────────────────────────────────────────────
const manifest = [];
let errors = 0;

for (let i = 0; i < bakedLevels.length; i++) {
    const level   = bakedLevels[i];
    const levelNum = i + 1;
    const filename = `level_${String(levelNum).padStart(3, '0')}.json`;
    const filepath = join(outDir, filename);

    // Run buildTerrain
    const terrainBuf = new Uint8Array(GW * GH);
    if (typeof level.buildTerrain === 'function') {
        try {
            level.buildTerrain(terrainBuf, GW, GH);
        } catch (e) {
            console.error(`  ✗ buildTerrain failed for Level ${levelNum}: ${e.message}`);
            errors++;
        }
    } else {
        console.warn(`  ⚠ Level ${levelNum} has no buildTerrain function – will be all-air.`);
    }

    // Ensure entrance and exit areas are clear (mirrors terrain.js ensurePathClear)
    const ent = level.entrance || { x: 30, y: 20 };
    const ext = level.exit     || { x: 370, y: 78, w: 20, h: 12 };
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const ex = ent.x + dx, ey = ent.y + dy;
        if (ex >= 0 && ex < GW && ey >= 0 && ey < GH) terrainBuf[ey * GW + ex] = 0;
    }
    for (let dy = -2; dy <= ext.h + 2; dy++) for (let dx = -2; dx <= ext.w + 2; dx++) {
        const ex = ext.x + dx, ey = ext.y + dy;
        if (ex >= 0 && ex < GW && ey >= 0 && ey < GH) terrainBuf[ey * GW + ex] = 0;
    }

    const terrain = encodeRLE(terrainBuf);
    const total   = rleSum(terrain);
    if (total !== GW * GH) {
        console.error(`  ✗ RLE sum mismatch for Level ${levelNum}: ${total} vs ${GW * GH}`);
        errors++;
    }

    // Build JSON structure (matching loader's buildRuntimeLevelFromJson expectations)
    const json = {
        version: 1,
        name:       level.name      || `Level ${levelNum}`,
        total:      Number(level.total)    || 20,
        required:   Number(level.required) || 15,
        spawnRate:  Number(level.spawnRate) || FPS_VAL * 2,
        time:       Number(level.time)      || 5 * 60 * FPS_VAL,
        entrance:   level.entrance  || { x: 30, y: 20 },
        exit:       level.exit      || { x: 370, y: 78, w: 20, h: 12 },
        theme:      level.theme     || 'grass',
        skills: Object.assign(
            { floater: 0, bomber: 0, blocker: 0, builder: 0,
              basher: 0, digger: 0, climber: 0, miner: 0, platformer: 0 },
            level.skills || {}
        ),
        terrain,
    };

    if (Array.isArray(level.waterZones) && level.waterZones.length) json.waterZones = level.waterZones;
    if (Array.isArray(level.props)      && level.props.length)      json.props      = level.props;

    writeFileSync(filepath, JSON.stringify(json, null, 2));
    manifest.push(filename);

    const solidPct = ((terrainBuf.filter(v => v).length / terrainBuf.length) * 100).toFixed(1);
    console.log(`  ✔ ${filename}  — ${terrain.length} RLE pairs  ${solidPct}% solid  "${json.name}"`);
}

// ─── Always include level_999 in manifest ─────────────────────────────────────
manifest.push('level_999.json');

// ─── Write manifest ───────────────────────────────────────────────────────────
writeFileSync(
    join(outDir, 'manifest.json'),
    JSON.stringify({ levels: manifest }, null, 2)
);

console.log(`\nManifest written: ${manifest.length} levels (${bakedLevels.length} baked + 1 bonus).`);
if (errors) {
    console.error(`\n${errors} error(s) encountered. Review output above.`);
    process.exit(1);
} else {
    console.log('All levels baked successfully.');
}
