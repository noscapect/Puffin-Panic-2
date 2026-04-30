// Level Manager â€” all levels are loaded from individual JSON files via manifest.
// Run  node scripts/bake-levels.mjs  to regenerate the JSON files from source.

const LEVELS = [];
const TOTAL_LEVELS = 99; // campaign levels loaded from manifest
let _externalLevelsLoaded = false;

function decodeRLETerrain(rlePairs, size) {
    const out = new Uint8Array(size);
    if (!Array.isArray(rlePairs)) return out;
    let idx = 0;
    for (let i = 0; i < rlePairs.length; i++) {
        const pair = rlePairs[i];
        if (!Array.isArray(pair) || pair.length < 2) continue;
        const val = Number(pair[0]) || 0;
        const count = Number(pair[1]) || 0;
        for (let j = 0; j < count && idx < size; j++) out[idx++] = val;
        if (idx >= size) break;
    }
    return out;
}

function buildRuntimeLevelFromJson(data, fileName) {
    const terrainRLE = Array.isArray(data.terrain) ? data.terrain : (Array.isArray(data.data) ? data.data : []);
    const defaultSkills = { floater: 0, bomber: 0, blocker: 0, builder: 0, basher: 0, digger: 0, climber: 0, miner: 0, platformer: 0 };
    const decoded = decodeRLETerrain(terrainRLE, GAME_WIDTH * GAME_HEIGHT);
    const lvl = {
        name:       data.name      || `[Level] ${fileName}`,
        total:      Number(data.total)     || 20,
        required:   Number(data.required)  || 15,
        spawnRate:  Number(data.spawnRate) || FPS * 2,
        time:       Number(data.time)      || 5 * 60 * FPS,
        entrance:   data.entrance  || { x: 70, y: 20 },
        exit:       data.exit      || { x: 340, y: 78, w: 20, h: 12 },
        theme:      data.theme     || 'grass',
        imageSource: data.imageSource || null,
        skills:     Object.assign({}, defaultSkills, data.skills || {}),
        importedFromFile: fileName,
        buildTerrain: function(runtimeData) { runtimeData.set(decoded); },
    };
    if (Array.isArray(data.waterZones)) lvl.waterZones = data.waterZones;
    if (Array.isArray(data.props))      lvl.props      = data.props;
    return lvl;
}

async function loadExternalLevels() {
    if (_externalLevelsLoaded) return;
    _externalLevelsLoaded = true;

    // Load ordered level list from manifest; fall back to a minimal hard-coded list.
    let files = [];
    try {
        const resp = await fetch('levels/manifest.json');
        if (resp.ok) {
            const manifest = await resp.json();
            if (Array.isArray(manifest.levels)) {
                files = manifest.levels.map(f => `levels/${f}`);
            }
        }
    } catch (_) { /* network error */ }

    if (!files.length) {
        files = ['levels/level_001.json', 'levels/level_999.json'];
        console.warn('[Levels] manifest.json not found - using fallback list.');
    }

    for (const file of files) {
        try {
            const response = await fetch(file);
            if (!response.ok) continue;
            const data     = await response.json();
            const fileName = file.split('/').pop() || file;
            const already  = LEVELS.some(l => l && l.importedFromFile === fileName);
            if (!already) LEVELS.push(buildRuntimeLevelFromJson(data, fileName));
        } catch (e) {
            console.warn(`[Levels] Skipping ${file}:`, e.message);
        }
    }
}

// Get theme for a level
function getLevelTheme(levelNum) {
    const level = LEVELS[levelNum - 1];
    if (level && level.theme) return level.theme;
    if (levelNum <= 3) return 'grass';
    if (levelNum <= 6) return 'desert';
    if (levelNum <= 9) return 'snow';
    if (levelNum <= 12) return 'rock';
    if (levelNum <= 15) return 'ice';
    if (levelNum <= 18) return 'lava';
    if (levelNum <= 21) return 'mud';
    if (levelNum <= 24) return 'cave';
    if (levelNum <= 27) return 'mossy';
    return 'crystal';
}

// â”€â”€â”€ Inline level definitions removed â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// All levels are now loaded from levels/level_NNN.json via levels/manifest.json.
// To regenerate those files run:  node scripts/bake-levels.mjs
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// --- Public API ---
window.LevelManager = {
    TOTAL_LEVELS,
    getDifficulty: (n) => n <= 5 ? 'fun' : n <= 10 ? 'tribal' : n <= 15 ? 'desert' : n <= 20 ? 'snow' : 'hard',
    getTheme:      getLevelTheme,
    loadExternalLevels,
};
