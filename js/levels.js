// Level Manager - Handles level data
const LEVELS = [];
const TOTAL_LEVELS = 22;
const EXTERNAL_LEVEL_FILES = [
    'levels/level_001.json'
];
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
    return {
        name: data.name || `[Imported] ${fileName}`,
        total: Number(data.total) || 20,
        required: Number(data.required) || 15,
        spawnRate: Number(data.spawnRate) || FPS * 2,
        time: Number(data.time) || 5 * 60 * FPS,
        entrance: data.entrance || { x: 70, y: 20 },
        exit: data.exit || { x: 340, y: 78, w: 20, h: 12 },
        theme: data.theme || 'rock',
        skills: Object.assign({}, defaultSkills, data.skills || {}),
        importedFromFile: fileName,
        buildTerrain: function(runtimeData, gw, gh) {
            runtimeData.set(decoded);
        }
    };
}

async function loadExternalLevels() {
    if (_externalLevelsLoaded) return;
    _externalLevelsLoaded = true;

    for (const file of EXTERNAL_LEVEL_FILES) {
        try {
            const response = await fetch(file);
            if (!response.ok) continue;
            const data = await response.json();
            const fileName = file.split('/').pop() || file;
            const already = LEVELS.some(l => l && l.importedFromFile === fileName);
            if (!already) LEVELS.push(buildRuntimeLevelFromJson(data, fileName));
        } catch (e) {
            // Ignore missing/broken files so built-in maps still work.
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

// Level 1: Just a Walk in the Park - Tutorial
LEVELS.push({
    name: "1: Just a Walk in the Park",
    total: 20, required: 18, spawnRate: FPS * 3, time: 5 * 60 * FPS,
    entrance: { x: 40, y: 30 },
    exit: { x: 350, y: 78, w: 20, h: 12 },
    theme: 'grass',
    skills: { floater: 0, bomber: 0, blocker: 0, builder: 0, basher: 5, digger: 0, climber: 0, miner: 0, platformer: 0 },
    buildTerrain: (data, gw, gh) => {
        // Simple ground with a wall to bash through
        for (let y = 90; y < gh; y++) for (let x = 0; x < gw; x++) data[y * gw + x] = 1;
        for (let y = 0; y < gh; y++) { for (let x = 0; x < 5; x++) data[y * gw + x] = 1; for (let x = gw - 5; x < gw; x++) data[y * gw + x] = 1; }
        // Wall to bash through - but leave ground clear for walking
        for (let y = 50; y < 90; y++) for (let x = 250; x < 270; x++) data[y * gw + x] = 1;
    },
    props: [
        { type: 'sign', x: 237, y: 88, text: '→', dir: 'right' }
    ]
});

// Level 2: Bridge Over Troubled Water
LEVELS.push({
    name: "2: Bridge Over Troubled Water",
    total: 20, required: 15, spawnRate: FPS * 2, time: 5 * 60 * FPS,
    entrance: { x: 30, y: 40 },
    exit: { x: 360, y: 40, w: 20, h: 12 },
    theme: 'wood_planks',
    skills: { floater: 0, bomber: 0, blocker: 0, builder: 12, basher: 0, digger: 0, climber: 0, miner: 0, platformer: 0 },
    buildTerrain: (data, gw, gh) => {
        // Two cliffs with a deadly gap
        for (let y = 50; y < gh; y++) for (let x = 0; x < 150; x++) data[y * gw + x] = 1;
        for (let y = 50; y < gh; y++) for (let x = 220; x < gw; x++) data[y * gw + x] = 1;
        for (let y = 0; y < gh; y++) { for (let x = 0; x < 5; x++) data[y * gw + x] = 1; for (let x = gw - 5; x < gw; x++) data[y * gw + x] = 1; }
        // Clear area around exit
        for (let y = 35; y < 50; y++) for (let x = 350; x < 380; x++) data[y * gw + x] = 0;
    },
    props: [
        { type: 'rope', x1: 150, y1: 50, x2: 220, y2: 50, sag: 14 }
    ]
});

// Level 3: The Great Escape
LEVELS.push({
    name: "3: The Great Escape",
    total: 20, required: 15, spawnRate: FPS * 2, time: 5 * 60 * FPS,
    entrance: { x: 30, y: 180 },
    exit: { x: 360, y: 30, w: 20, h: 12 },
    theme: 'mossy_ruin',
    skills: { floater: 5, bomber: 0, blocker: 3, builder: 10, basher: 3, digger: 0, climber: 5, miner: 0, platformer: 0 },
    buildTerrain: (data, gw, gh) => {
        // Underground escape with platforms
        for (let y = 190; y < gh; y++) for (let x = 0; x < gw; x++) data[y * gw + x] = 1;
        for (let y = 0; y < gh; y++) { for (let x = 0; x < 5; x++) data[y * gw + x] = 1; for (let x = gw - 5; x < gw; x++) data[y * gw + x] = 1; }
        // Ceiling
        for (let y = 0; y < 15; y++) for (let x = 0; x < gw; x++) data[y * gw + x] = 1;
        // Platforms going up
        for (let y = 160; y < 165; y++) for (let x = 50; x < 180; x++) data[y * gw + x] = 1;
        for (let y = 130; y < 135; y++) for (let x = 150; x < 300; x++) data[y * gw + x] = 1;
        for (let y = 95; y < 100; y++) for (let x = 80; x < 220; x++) data[y * gw + x] = 1;
        for (let y = 55; y < 60; y++) for (let x = 200; x < 370; x++) data[y * gw + x] = 1;
        // Clear area around exit
        for (let y = 20; y < 35; y++) for (let x = 350; x < 380; x++) data[y * gw + x] = 0;
    },
    props: [
        { type: 'sign', x: 42, y: 188, text: '↑', dir: 'right' }
    ]
});

// Level 4: Sandstorm
LEVELS.push({
    name: "4: Sandstorm",
    total: 20, required: 15, spawnRate: FPS * 2, time: 5 * 60 * FPS,
    entrance: { x: 30, y: 20 },
    exit: { x: 360, y: 78, w: 20, h: 12 },
    theme: 'desert',
    skills: { floater: 3, bomber: 2, blocker: 3, builder: 6, basher: 3, digger: 5, climber: 3, miner: 3, platformer: 3 },
    buildTerrain: (data, gw, gh) => {
        for (let y = 90; y < gh; y++) for (let x = 0; x < gw; x++) data[y * gw + x] = 1;
        for (let y = 0; y < gh; y++) { for (let x = 0; x < 5; x++) data[y * gw + x] = 1; for (let x = gw - 5; x < gw; x++) data[y * gw + x] = 1; }
        // Sand dune
        for (let x = 150; x < 250; x++) {
            let h = 90 - Math.floor(Math.sin((x-150)/100 * Math.PI) * 30);
            for (let y = h; y < 90; y++) data[y * gw + x] = 1;
        }
    }
});

// Level 5: Salt Pyramid
LEVELS.push({
    name: "5: Salt Pyramid",
    total: 25, required: 20, spawnRate: FPS * 2, time: 6 * 60 * FPS,
    entrance: { x: 30, y: 20 },
    exit: { x: 200, y: 55, w: 20, h: 12 },
    theme: 'salt_flats',
    skills: { floater: 5, bomber: 3, blocker: 4, builder: 8, basher: 4, digger: 3, climber: 5, miner: 3, platformer: 3 },
    buildTerrain: (data, gw, gh) => {
        for (let y = 90; y < gh; y++) for (let x = 0; x < gw; x++) data[y * gw + x] = 1;
        for (let y = 0; y < gh; y++) { for (let x = 0; x < 5; x++) data[y * gw + x] = 1; for (let x = gw - 5; x < gw; x++) data[y * gw + x] = 1; }
        // Pyramid structure - stepped
        for (let row = 0; row < 6; row++) {
            let y = 90 - row * 6;
            let startX = 130 + row * 10;
            let endX = 270 - row * 10;
            for (let x = startX; x < endX; x++) {
                for (let dy = 0; dy < 6; dy++) {
                    if (y + dy >= 0 && y + dy < gh) data[(y + dy) * gw + x] = 1;
                }
            }
        }
        // Clear exit area inside pyramid
        for (let y = 55; y < 90; y++) for (let x = 195; x < 215; x++) data[y * gw + x] = 0;
    },
    props: [
        { type: 'sign', x: 104, y: 88, text: 'SALT', dir: 'right' },
        { type: 'sign', x: 232, y: 58, text: 'PYRAMID', dir: 'left' }
    ]
});

// Level 6: Oasis Trap
LEVELS.push({
    name: "6: Oasis Trap",
    total: 20, required: 15, spawnRate: FPS * 2, time: 5 * 60 * FPS,
    entrance: { x: 30, y: 20 },
    exit: { x: 360, y: 20, w: 20, h: 12 },
    theme: 'desert',
    skills: { floater: 8, bomber: 2, blocker: 3, builder: 5, basher: 2, digger: 2, climber: 3, miner: 2, platformer: 4 },
    buildTerrain: (data, gw, gh) => {
        for (let y = 90; y < gh; y++) for (let x = 0; x < gw; x++) data[y * gw + x] = 1;
        for (let y = 0; y < gh; y++) { for (let x = 0; x < 5; x++) data[y * gw + x] = 1; for (let x = gw - 5; x < gw; x++) data[y * gw + x] = 1; }
        // Oasis gaps - need floaters to cross
        for (let x = 100; x < 150; x++) for (let y = 50; y < 90; y++) data[y * gw + x] = 0;
        for (let x = 220; x < 280; x++) for (let y = 40; y < 90; y++) data[y * gw + x] = 0;
        // Small land bridges
        for (let y = 85; y < 90; y++) for (let x = 100; x < 150; x++) data[y * gw + x] = 1;
        for (let y = 85; y < 90; y++) for (let x = 220; x < 280; x++) data[y * gw + x] = 1;
    }
});

// Level 7: Blizzard
LEVELS.push({
    name: "7: Blizzard",
    total: 20, required: 15, spawnRate: FPS * 2, time: 5 * 60 * FPS,
    entrance: { x: 30, y: 20 },
    exit: { x: 360, y: 78, w: 20, h: 12 },
    theme: 'packed_snow',
    skills: { floater: 5, bomber: 3, blocker: 4, builder: 7, basher: 3, digger: 3, climber: 4, miner: 3, platformer: 3 },
    buildTerrain: (data, gw, gh) => {
        for (let y = 90; y < gh; y++) for (let x = 0; x < gw; x++) data[y * gw + x] = 1;
        for (let y = 0; y < gh; y++) { for (let x = 0; x < 5; x++) data[y * gw + x] = 1; for (let x = gw - 5; x < gw; x++) data[y * gw + x] = 1; }
        // Ice walls blocking path
        for (let y = 50; y < 90; y++) for (let x = 180; x < 185; x++) data[y * gw + x] = 1;
        for (let y = 60; y < 90; y++) for (let x = 280; x < 285; x++) data[y * gw + x] = 1;
    }
});

// Level 8: Avalanche
LEVELS.push({
    name: "8: Avalanche",
    total: 25, required: 18, spawnRate: FPS * 2, time: 5 * 60 * FPS,
    entrance: { x: 30, y: 20 },
    exit: { x: 360, y: 78, w: 20, h: 12 },
    theme: 'snow',
    skills: { floater: 6, bomber: 5, blocker: 4, builder: 6, basher: 3, digger: 3, climber: 4, miner: 3, platformer: 3 },
    buildTerrain: (data, gw, gh) => {
        for (let y = 90; y < gh; y++) for (let x = 0; x < gw; x++) data[y * gw + x] = 1;
        for (let y = 0; y < gh; y++) { for (let x = 0; x < 5; x++) data[y * gw + x] = 1; for (let x = gw - 5; x < gw; x++) data[y * gw + x] = 1; }
        // Snow overhangs - need bombers to clear
        for (let y = 50; y < 70; y++) for (let x = 120; x < 200; x++) data[y * gw + x] = 1;
        for (let y = 60; y < 85; y++) for (let x = 250; x < 320; x++) data[y * gw + x] = 1;
    }
});

// Level 9: Frostbite
LEVELS.push({
    name: "9: Frostbite",
    total: 20, required: 15, spawnRate: FPS * 2, time: 5 * 60 * FPS,
    entrance: { x: 360, y: 78 },
    exit: { x: 30, y: 78, w: 20, h: 12 },
    theme: 'black_ice',
    skills: { floater: 4, bomber: 3, blocker: 3, builder: 6, basher: 3, digger: 4, climber: 6, miner: 3, platformer: 3 },
    buildTerrain: (data, gw, gh) => {
        for (let y = 90; y < gh; y++) for (let x = 0; x < gw; x++) data[y * gw + x] = 1;
        for (let y = 0; y < gh; y++) { for (let x = 0; x < 5; x++) data[y * gw + x] = 1; for (let x = gw - 5; x < gw; x++) data[y * gw + x] = 1; }
        // Ice cave with narrow passages
        for (let y = 50; y < 90; y++) for (let x = 150; x < 155; x++) data[y * gw + x] = 1;
        for (let y = 60; y < 90; y++) for (let x = 250; x < 255; x++) data[y * gw + x] = 1;
    }
});

// Level 10: The Summit
LEVELS.push({
    name: "10: The Summit",
    total: 25, required: 20, spawnRate: FPS * 2, time: 6 * 60 * FPS,
    entrance: { x: 30, y: 78 },
    exit: { x: 200, y: 35, w: 20, h: 12 },
    theme: 'cliff_chalk',
    skills: { floater: 6, bomber: 4, blocker: 5, builder: 8, basher: 4, digger: 4, climber: 6, miner: 4, platformer: 4 },
    buildTerrain: (data, gw, gh) => {
        for (let y = 90; y < gh; y++) for (let x = 0; x < gw; x++) data[y * gw + x] = 1;
        for (let y = 0; y < gh; y++) { for (let x = 0; x < 5; x++) data[y * gw + x] = 1; for (let x = gw - 5; x < gw; x++) data[y * gw + x] = 1; }
        // Mountain - stepped platforms going up
        for (let y = 80; y < 90; y++) for (let x = 80; x < 150; x++) data[y * gw + x] = 1;
        for (let y = 65; y < 75; y++) for (let x = 120; x < 200; x++) data[y * gw + x] = 1;
        for (let y = 50; y < 60; y++) for (let x = 150; x < 250; x++) data[y * gw + x] = 1;
        for (let y = 45; y < 55; y++) for (let x = 170; x < 230; x++) data[y * gw + x] = 1;
        // Clear exit area
        for (let y = 35; y < 45; y++) for (let x = 190; x < 220; x++) data[y * gw + x] = 0;
    }
});

// Level 11: Stone Cold
LEVELS.push({
    name: "11: Stone Cold",
    total: 20, required: 15, spawnRate: FPS * 2, time: 5 * 60 * FPS,
    entrance: { x: 30, y: 20 },
    exit: { x: 360, y: 78, w: 20, h: 12 },
    theme: 'slate_ledge',
    skills: { floater: 4, bomber: 4, blocker: 3, builder: 5, basher: 4, digger: 3, climber: 4, miner: 4, platformer: 3 },
    buildTerrain: (data, gw, gh) => {
        for (let y = 90; y < gh; y++) for (let x = 0; x < gw; x++) data[y * gw + x] = 1;
        for (let y = 0; y < gh; y++) { for (let x = 0; x < 5; x++) data[y * gw + x] = 1; for (let x = gw - 5; x < gw; x++) data[y * gw + x] = 1; }
        // Rock walls - maze-like
        for (let y = 50; y < 90; y++) for (let x = 120; x < 125; x++) data[y * gw + x] = 1;
        for (let y = 60; y < 90; y++) for (let x = 200; x < 205; x++) data[y * gw + x] = 1;
        for (let y = 50; y < 90; y++) for (let x = 280; x < 285; x++) data[y * gw + x] = 1;
        // Openings at top
        for (let y = 45; y < 55; y++) for (let x = 115; x < 130; x++) data[y * gw + x] = 0;
        for (let y = 55; y < 65; y++) for (let x = 195; x < 210; x++) data[y * gw + x] = 0;
        for (let y = 45; y < 55; y++) for (let x = 275; x < 290; x++) data[y * gw + x] = 0;
    }
});

// Level 12: Rusted Quarry
LEVELS.push({
    name: "12: Rusted Quarry",
    total: 25, required: 18, spawnRate: FPS * 2, time: 6 * 60 * FPS,
    entrance: { x: 30, y: 20 },
    exit: { x: 360, y: 78, w: 20, h: 12 },
    theme: 'rusty_metal',
    skills: { floater: 5, bomber: 6, blocker: 4, builder: 6, basher: 4, digger: 4, climber: 4, miner: 5, platformer: 3 },
    buildTerrain: (data, gw, gh) => {
        for (let y = 90; y < gh; y++) for (let x = 0; x < gw; x++) data[y * gw + x] = 1;
        for (let y = 0; y < gh; y++) { for (let x = 0; x < 5; x++) data[y * gw + x] = 1; for (let x = gw - 5; x < gw; x++) data[y * gw + x] = 1; }
        // Quarry terraces
        for (let y = 70; y < 90; y++) for (let x = 100; x < 200; x++) data[y * gw + x] = 1;
        for (let y = 55; y < 75; y++) for (let x = 150; x < 280; x++) data[y * gw + x] = 1;
        // Thick wall needing bombers
        for (let y = 40; y < 90; y++) for (let x = 300; x < 315; x++) data[y * gw + x] = 1;
    },
    props: [
        { type: 'sign', x: 108, y: 88, text: 'RUST', dir: 'right' },
        { type: 'sign', x: 246, y: 62, text: 'BLAST', dir: 'right' }
    ]
});

// Level 13: Crystal Caves
LEVELS.push({
    name: "13: Crystal Caves",
    total: 20, required: 15, spawnRate: FPS * 2, time: 5 * 60 * FPS,
    entrance: { x: 30, y: 100 },
    exit: { x: 360, y: 100, w: 20, h: 12 },
    theme: 'crystal_dense',
    skills: { floater: 5, bomber: 3, blocker: 3, builder: 5, basher: 3, digger: 4, climber: 5, miner: 4, platformer: 4 },
    buildTerrain: (data, gw, gh) => {
        // Underground cave - open middle
        for (let y = 0; y < 80; y++) for (let x = 0; x < gw; x++) data[y * gw + x] = 1;
        for (let y = 130; y < gh; y++) for (let x = 0; x < gw; x++) data[y * gw + x] = 1;
        for (let y = 0; y < gh; y++) { for (let x = 0; x < 5; x++) data[y * gw + x] = 1; for (let x = gw - 5; x < gw; x++) data[y * gw + x] = 1; }
        // Crystal pillars
        for (let y = 80; y < 110; y++) for (let x = 150; x < 160; x++) data[y * gw + x] = 1;
        for (let y = 90; y < 130; y++) for (let x = 250; x < 260; x++) data[y * gw + x] = 1;
    }
});

// Level 14: Frozen Lake
LEVELS.push({
    name: "14: Frozen Lake",
    total: 25, required: 20, spawnRate: FPS * 2, time: 5 * 60 * FPS,
    entrance: { x: 30, y: 40 },
    exit: { x: 360, y: 40, w: 20, h: 12 },
    theme: 'frozen_mud',
    skills: { floater: 6, bomber: 3, blocker: 4, builder: 6, basher: 2, digger: 2, climber: 4, miner: 2, platformer: 5 },
    buildTerrain: (data, gw, gh) => {
        for (let y = 50; y < gh; y++) for (let x = 0; x < gw; x++) data[y * gw + x] = 1;
        for (let y = 0; y < 30; y++) for (let x = 0; x < gw; x++) data[y * gw + x] = 1;
        for (let y = 0; y < gh; y++) { for (let x = 0; x < 5; x++) data[y * gw + x] = 1; for (let x = gw - 5; x < gw; x++) data[y * gw + x] = 1; }
        // Frozen lake gaps
        for (let x = 120; x < 180; x++) for (let y = 30; y < 50; y++) data[y * gw + x] = 0;
        for (let x = 240; x < 310; x++) for (let y = 30; y < 50; y++) data[y * gw + x] = 0;
        // Thin ice bridges
        for (let y = 45; y < 50; y++) for (let x = 120; x < 180; x++) data[y * gw + x] = 1;
        for (let y = 45; y < 50; y++) for (let x = 240; x < 310; x++) data[y * gw + x] = 1;
    }
});

// Level 15: Glacier
LEVELS.push({
    name: "15: Glacier",
    total: 30, required: 22, spawnRate: FPS * 2, time: 6 * 60 * FPS,
    entrance: { x: 30, y: 20 },
    exit: { x: 360, y: 78, w: 20, h: 12 },
    theme: 'ice',
    skills: { floater: 6, bomber: 5, blocker: 5, builder: 8, basher: 4, digger: 4, climber: 5, miner: 4, platformer: 4 },
    buildTerrain: (data, gw, gh) => {
        for (let y = 90; y < gh; y++) for (let x = 0; x < gw; x++) data[y * gw + x] = 1;
        for (let y = 0; y < gh; y++) { for (let x = 0; x < 5; x++) data[y * gw + x] = 1; for (let x = gw - 5; x < gw; x++) data[y * gw + x] = 1; }
        // Glacier crevasse
        for (let x = 160; x < 210; x++) for (let y = 50; y < 90; y++) data[y * gw + x] = 0;
        // Ice bridges
        for (let y = 85; y < 90; y++) for (let x = 160; x < 210; x++) data[y * gw + x] = 1;
        // Ice walls
        for (let y = 60; y < 85; y++) for (let x = 260; x < 265; x++) data[y * gw + x] = 1;
    }
});

// Level 16: Inferno
LEVELS.push({
    name: "16: Inferno",
    total: 25, required: 18, spawnRate: FPS * 2, time: 5 * 60 * FPS,
    entrance: { x: 30, y: 20 },
    exit: { x: 360, y: 78, w: 20, h: 12 },
    theme: 'volcanic_ash',
    skills: { floater: 6, bomber: 5, blocker: 4, builder: 6, basher: 4, digger: 4, climber: 5, miner: 4, platformer: 4 },
    buildTerrain: (data, gw, gh) => {
        for (let y = 90; y < gh; y++) for (let x = 0; x < gw; x++) data[y * gw + x] = 1;
        for (let y = 0; y < gh; y++) { for (let x = 0; x < 5; x++) data[y * gw + x] = 1; for (let x = gw - 5; x < gw; x++) data[y * gw + x] = 1; }
        // Lava gaps
        for (let x = 110; x < 150; x++) for (let y = 60; y < 90; y++) data[y * gw + x] = 0;
        for (let x = 220; x < 270; x++) for (let y = 50; y < 90; y++) data[y * gw + x] = 0;
        // Rock bridges
        for (let y = 85; y < 90; y++) for (let x = 110; x < 150; x++) data[y * gw + x] = 1;
        for (let y = 85; y < 90; y++) for (let x = 220; x < 270; x++) data[y * gw + x] = 1;
    }
});

// Level 17: Volcano
LEVELS.push({
    name: "17: Volcano",
    total: 25, required: 18, spawnRate: FPS * 2, time: 5 * 60 * FPS,
    entrance: { x: 30, y: 20 },
    exit: { x: 360, y: 78, w: 20, h: 12 },
    theme: 'obsidian_floor',
    skills: { floater: 5, bomber: 6, blocker: 4, builder: 6, basher: 4, digger: 4, climber: 5, miner: 4, platformer: 3 },
    buildTerrain: (data, gw, gh) => {
        for (let y = 90; y < gh; y++) for (let x = 0; x < gw; x++) data[y * gw + x] = 1;
        for (let y = 0; y < gh; y++) { for (let x = 0; x < 5; x++) data[y * gw + x] = 1; for (let x = gw - 5; x < gw; x++) data[y * gw + x] = 1; }
        // Volcano cone
        for (let row = 0; row < 8; row++) {
            let y = 90 - row * 5;
            let halfW = 70 - row * 8;
            for (let x = 160 - halfW; x < 160 + halfW; x++) {
                if (x >= 0 && x < gw && y >= 0) {
                    for (let dy = 0; dy < 5; dy++) {
                        if (y + dy >= 0 && y + dy < gh) data[(y + dy) * gw + x] = 1;
                    }
                }
            }
        }
        // Clear crater
        for (let y = 50; y < 90; y++) for (let x = 150; x < 180; x++) data[y * gw + x] = 0;
    }
});

// Level 18: Magma Chamber
LEVELS.push({
    name: "18: Magma Chamber",
    total: 30, required: 22, spawnRate: FPS * 2, time: 6 * 60 * FPS,
    entrance: { x: 30, y: 100 },
    exit: { x: 360, y: 100, w: 20, h: 12 },
    theme: 'toxic_sludge',
    skills: { floater: 5, bomber: 6, blocker: 5, builder: 7, basher: 4, digger: 4, climber: 5, miner: 5, platformer: 4 },
    buildTerrain: (data, gw, gh) => {
        // Underground magma chamber
        for (let y = 0; y < 80; y++) for (let x = 0; x < gw; x++) data[y * gw + x] = 1;
        for (let y = 130; y < gh; y++) for (let x = 0; x < gw; x++) data[y * gw + x] = 1;
        for (let y = 0; y < gh; y++) { for (let x = 0; x < 5; x++) data[y * gw + x] = 1; for (let x = gw - 5; x < gw; x++) data[y * gw + x] = 1; }
        // Magma pools at bottom
        for (let x = 100; x < 150; x++) for (let y = 125; y < 130; y++) data[y * gw + x] = 1;
        for (let x = 220; x < 280; x++) for (let y = 125; y < 130; y++) data[y * gw + x] = 1;
        // Rock pillars
        for (let y = 80; y < 125; y++) for (let x = 180; x < 190; x++) data[y * gw + x] = 1;
        for (let y = 80; y < 125; y++) for (let x = 300; x < 310; x++) data[y * gw + x] = 1;
    }
});

// Level 19: Glowing Kingdom
LEVELS.push({
    name: "19: Glowing Kingdom",
    total: 30, required: 24, spawnRate: FPS * 2, time: 6 * 60 * FPS,
    entrance: { x: 30, y: 20 },
    exit: { x: 360, y: 78, w: 20, h: 12 },
    theme: 'fungus_glow',
    skills: { floater: 6, bomber: 5, blocker: 5, builder: 8, basher: 4, digger: 4, climber: 5, miner: 5, platformer: 5 },
    buildTerrain: (data, gw, gh) => {
        for (let y = 90; y < gh; y++) for (let x = 0; x < gw; x++) data[y * gw + x] = 1;
        for (let y = 0; y < gh; y++) { for (let x = 0; x < 5; x++) data[y * gw + x] = 1; for (let x = gw - 5; x < gw; x++) data[y * gw + x] = 1; }
        // Crystal spires
        for (let i = 0; i < 4; i++) {
            let cx = 100 + i * 65;
            let ch = 30 + (i % 3) * 15;
            for (let y = 90 - ch; y < 90; y++) {
                let w = ((y - (90 - ch)) / ch) * 10;
                for (let x = cx - w; x < cx + w; x++) {
                    if (x >= 0 && x < gw) data[y * gw + Math.floor(x)] = 1;
                }
            }
        }
        // Crystal wall with gap
        for (let y = 60; y < 90; y++) for (let x = 280; x < 285; x++) data[y * gw + x] = 1;
    },
    props: [
        { type: 'sign', x: 86, y: 88, text: 'GLOW', dir: 'right' },
        { type: 'sign', x: 320, y: 86, text: 'KINGDOM', dir: 'left' }
    ]
});

// Level 21: The Ice Shard Ascent - Custom Level
LEVELS.push({
    name: "21: The Ice Shard Ascent",
    total: 20,
    required: 15,
    spawnRate: FPS * 2,
    time: 5 * 60 * FPS,
    entrance: { x: 40, y: 80 },
    exit: { x: 350, y: 188, w: 20, h: 12 },
    theme: 'black_ice',
    skills: { floater: 5, bomber: 2, blocker: 3, builder: 2, basher: 0, digger: 0, climber: 10, miner: 10, platformer: 0 },
    buildTerrain: function(data, gw, gh) {
        // Upper Ledge (y: 140 to 150, x: 0 to 130)
        for (let y = 140; y < 150; y++) {
            for (let x = 0; x < 130; x++) {
                data[y * gw + x] = 1;
            }
        }
        
        // Middle Landing (y: 180 to 190, x: 160 to 210)
        for (let y = 180; y < 190; y++) {
            for (let x = 160; x < 210; x++) {
                data[y * gw + x] = 1;
            }
        }
        
        // Central Ice Shard Pillar (x: 200 to 250, y: 20 to 180)
        for (let y = 20; y < 180; y++) {
            for (let x = 200; x < 250; x++) {
                data[y * gw + x] = 1;
            }
        }
        
        // Exit Floor (y: 200 to bottom, x: 280 to end)
        for (let y = 200; y < gh; y++) {
            for (let x = 280; x < gw; x++) {
                data[y * gw + x] = 1;
            }
        }
        
        // Boundary Walls (10px wide)
        for (let y = 0; y < gh; y++) {
            for (let x = 0; x < 10; x++) {
                data[y * gw + x] = 1;
            }
            for (let x = gw - 10; x < gw; x++) {
                data[y * gw + x] = 1;
            }
        }
    }
});

// Level 22: Flooded Grotto
LEVELS.push({
    name: "22: Flooded Grotto",
    total: 25,
    required: 20,
    spawnRate: FPS * 2,
    time: 6 * 60 * FPS,
    entrance: { x: 36, y: 64 },
    exit: { x: 356, y: 98, w: 20, h: 12 },
    theme: 'wet_cave_stone',
    skills: { floater: 0, bomber: 2, blocker: 2, builder: 5, basher: 2, digger: 2, climber: 0, miner: 6, platformer: 0 },
    waterZones: [
        { x: 118, y: 122, w: 168, h: 66 }
    ],
    buildTerrain: function(data, gw, gh) {
        // Deep floor to catch poor routing choices.
        for (let y = 188; y < gh; y++) {
            for (let x = 0; x < gw; x++) data[y * gw + x] = 1;
        }

        // Boundary walls.
        for (let y = 0; y < gh; y++) {
            for (let x = 0; x < 5; x++) data[y * gw + x] = 1;
            for (let x = gw - 5; x < gw; x++) data[y * gw + x] = 1;
        }

        // Spawn shelf and early corridor.
        for (let y = 76; y < 92; y++) {
            for (let x = 18; x < 150; x++) data[y * gw + x] = 1;
        }

        // Left retaining wall to force a drop into the basin.
        for (let y = 92; y < 188; y++) {
            for (let x = 112; x < 120; x++) data[y * gw + x] = 1;
        }

        // Floodgate wall in the middle: miners must open a channel.
        for (let y = 96; y < 188; y++) {
            for (let x = 224; x < 236; x++) data[y * gw + x] = 1;
        }

        // Right shoreline and climb to exit.
        // Wide shoreline catches swimmers and prevents cliff-edge soft-locks.
        for (let y = 120; y < 132; y++) {
            for (let x = 286; x < 396; x++) data[y * gw + x] = 1;
        }

        // Upper approach to the exit.
        for (let y = 108; y < 120; y++) {
            for (let x = 330; x < 396; x++) data[y * gw + x] = 1;
        }

        // Solid backing below shoreline removes the lower-right stuck zone entirely.
        for (let y = 132; y < 188; y++) {
            for (let x = 286; x < 396; x++) data[y * gw + x] = 1;
        }

        // Ceiling cap to keep the route constrained.
        for (let y = 0; y < 18; y++) {
            for (let x = 0; x < gw; x++) data[y * gw + x] = 1;
        }
    },
    props: [
        { type: 'water', x: 118, y: 122, w: 168, h: 66 },
        { type: 'sign', x: 84, y: 76, text: 'GROTTO GATE', dir: 'right' },
        { type: 'sign', x: 334, y: 128, text: 'SHORELINE', dir: 'right' }
    ]
});

// Export LevelManager for custom level loading
window.LevelManager = {
    TOTAL_LEVELS: TOTAL_LEVELS,
    getDifficulty: (n) => n <= 5 ? 'fun' : n <= 10 ? 'tribal' : n <= 15 ? 'desert' : n <= 20 ? 'snow' : 'hard',
    getTheme: getLevelTheme,
    loadExternalLevels: loadExternalLevels
};
