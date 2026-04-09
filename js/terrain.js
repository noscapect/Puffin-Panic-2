// --- Terrain System ---
function getTerrain(x, y) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || x >= GAME_WIDTH || y < 0 || y >= GAME_HEIGHT) return 0;
    return terrainData[y * GAME_WIDTH + x];
}

function setTerrain(x, y, val) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || x >= GAME_WIDTH || y < 0 || y >= GAME_HEIGHT) return;
    terrainData[y * GAME_WIDTH + x] = val;
}

function isSolidTerrain(val) {
    return val !== 0;
}

function isSolidAt(x, y) {
    return isSolidTerrain(getTerrain(x, y));
}

function isDiggableTerrain(val) {
    return val === 1; // Only type 1 is diggable; type 10 (steel) is not
}

function canDigAt(x, y) {
    return isDiggableTerrain(getTerrain(x, y));
}

// Fix: Ensure terrain modifications don't create unreachable areas
// by keeping entrance and exit paths clear
function ensurePathClear() {
    // Clear area around entrance
    for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
            let ex = ENTRANCE.x + dx;
            let ey = ENTRANCE.y + dy;
            if (ex >= 0 && ex < GAME_WIDTH && ey >= 0 && ey < GAME_HEIGHT) {
                setTerrain(ex, ey, 0);
            }
        }
    }
    
    // Clear area around exit
    for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
            let ex = EXIT.x + dx;
            let ey = EXIT.y + dy;
            if (ex >= 0 && ex < GAME_WIDTH && ey >= 0 && ey < GAME_HEIGHT) {
                setTerrain(ex, ey, 0);
            }
        }
    }
    
    updateTerrainPixels(ENTRANCE.x - 2, ENTRANCE.y - 2, 5, 5);
    updateTerrainPixels(EXIT.x - 2, EXIT.y - 2, EXIT.w + 4, EXIT.h + 4);
}

function clampColor(v) {
    return Math.max(0, Math.min(255, Math.round(v)));
}

function hashNoise2D(x, y) {
    let n = (x * 374761393 + y * 668265263) | 0;
    n = (n ^ (n >> 13)) | 0;
    n = (n * 1274126177) | 0;
    return (((n ^ (n >> 16)) >>> 0) / 4294967295);
}

function getCurrentThemeName() {
    return (typeof getLevelTheme === 'function') ? getLevelTheme(currentLevelIndex + 1) : 'grass';
}

// --- Photo-texture cache ---
// Keyed by theme name. Each entry: { data: Uint8ClampedArray, w: number, h: number }
const _terrainTexCache = {};
const _terrainTexState = {
    enabled: true,
    blend: 0.92,
    loaded: 0,
    total: 0
};

function preloadTerrainTextures(callback) {
    const themes = [
        'grass', 'desert', 'snow', 'rock', 'ice', 'lava', 'crystal', 'water', 'mud', 'cave', 'mossy',
        'cliff_chalk', 'slate_ledge', 'frozen_mud', 'packed_snow', 'black_ice',
        'volcanic_ash', 'obsidian_floor', 'salt_flats', 'wet_cave_stone', 'rusty_metal',
        'wood_planks', 'mossy_ruin', 'crystal_dense', 'fungus_glow', 'toxic_sludge'
    ];
    let pending = themes.length;
    _terrainTexState.total = themes.length;
    _terrainTexState.loaded = 0;
    themes.forEach(theme => {
        const img = new Image();
        img.onload = () => {
            try {
                const c = document.createElement('canvas');
                c.width = img.naturalWidth;
                c.height = img.naturalHeight;
                const cx = c.getContext('2d');
                cx.drawImage(img, 0, 0);
                const id = cx.getImageData(0, 0, img.naturalWidth, img.naturalHeight);
                _terrainTexCache[theme] = { data: id.data, w: img.naturalWidth, h: img.naturalHeight };
                _terrainTexState.loaded++;
                console.log(`[Terrain] Loaded texture: ${theme} (${img.naturalWidth}x${img.naturalHeight})`);
            } catch (e) {
                console.error(`[Terrain] getImageData failed for ${theme} — likely CORS/security block. Try serving via HTTP instead of file://.`, e);
            }
            pending--;
            if (pending === 0 && callback) callback();
        };
        img.onerror = () => {
            console.error(`[Terrain] Failed to load texture file: img/generated/${theme}.png`);
            pending--;
            if (pending === 0 && callback) callback();
        };
        img.src = `img/generated/${theme}.png`;
    });
}

// Tile-scale: how many times the texture repeats across its own width.
// Higher = finer / smaller-looking detail. 1 = one tile per texture-width.
const _texTileScale = {
    grass:   4,
    desert:  3,
    snow:    3,
    rock:    3,
    ice:     3,
    lava:    3,
    crystal: 3,
    water:   3,
    mud:     4,
    cave:    3,
    mossy:   3,
    cliff_chalk:   3,
    slate_ledge:   3,
    frozen_mud:    4,
    packed_snow:   3,
    black_ice:     3,
    volcanic_ash:  3,
    obsidian_floor: 3,
    salt_flats:    3,
    wet_cave_stone: 3,
    rusty_metal:   4,
    wood_planks:   4,
    mossy_ruin:    3,
    crystal_dense: 3,
    fungus_glow:   3,
    toxic_sludge:  4
};

function sampleTerrainTexture(themeName, x, y) {
    if (!_terrainTexState.enabled) return null;
    const t = _terrainTexCache[themeName];
    if (!t) return null;
    const scale = _texTileScale[themeName] || 3;
    const tx = (((x * scale) % t.w) + t.w) % t.w;
    const ty = (((y * scale) % t.h) + t.h) % t.h;
    const i = (Math.floor(ty) * t.w + Math.floor(tx)) * 4;
    return [t.data[i], t.data[i + 1], t.data[i + 2]];
}

function getThemeRenderProfile(themeName) {
    // surfaceBlend: how strongly the themed surface colour overrides the texture on the top row (0–1).
    // surfaceRows: how many rows below the top edge also get a fading surface crust.
    const profiles = {
        grass:   { noiseAmp: 12, depthTint: 0.08, crackChance: 0.02, rimBoost: [18, 22, 26], glaze: false, surfaceBlend: 0.82, surfaceRows: 3 },
        desert:  { noiseAmp: 11, depthTint: 0.10, crackChance: 0.03, rimBoost: [16, 14, 10], glaze: false, surfaceBlend: 0.55, surfaceRows: 2 },
        snow:    { noiseAmp: 10, depthTint: 0.06, crackChance: 0.015, rimBoost: [26, 30, 34], glaze: true,  surfaceBlend: 0.70, surfaceRows: 3 },
        rock:    { noiseAmp: 14, depthTint: 0.12, crackChance: 0.04, rimBoost: [14, 16, 18], glaze: false, surfaceBlend: 0.45, surfaceRows: 1 },
        ice:     { noiseAmp: 9,  depthTint: 0.05, crackChance: 0.018, rimBoost: [30, 36, 44], glaze: true,  surfaceBlend: 0.60, surfaceRows: 2 },
        lava:    { noiseAmp: 16, depthTint: 0.15, crackChance: 0.05, rimBoost: [22, 10, 4],  glaze: false, surfaceBlend: 0.80, surfaceRows: 2 },
        crystal: { noiseAmp: 12, depthTint: 0.08, crackChance: 0.03, rimBoost: [20, 18, 26], glaze: true,  surfaceBlend: 0.65, surfaceRows: 2 },
        water:   { noiseAmp: 10, depthTint: 0.06, crackChance: 0.02, rimBoost: [22, 30, 36], glaze: true,  surfaceBlend: 0.60, surfaceRows: 2 },
        mud:     { noiseAmp: 10, depthTint: 0.09, crackChance: 0.01, rimBoost: [12, 10,  6],  glaze: false, surfaceBlend: 0.50, surfaceRows: 2 },
        cave:    { noiseAmp: 15, depthTint: 0.14, crackChance: 0.05, rimBoost: [10, 12, 14],  glaze: false, surfaceBlend: 0.35, surfaceRows: 1 },
        mossy:   { noiseAmp: 11, depthTint: 0.08, crackChance: 0.02, rimBoost: [10, 18, 10],  glaze: false, surfaceBlend: 0.75, surfaceRows: 3 },
        cliff_chalk:   { noiseAmp: 11, depthTint: 0.08, crackChance: 0.025, rimBoost: [24, 24, 20], glaze: false, surfaceBlend: 0.62, surfaceRows: 2 },
        slate_ledge:   { noiseAmp: 13, depthTint: 0.12, crackChance: 0.04,  rimBoost: [14, 16, 18],  glaze: false, surfaceBlend: 0.45, surfaceRows: 1 },
        frozen_mud:    { noiseAmp: 11, depthTint: 0.10, crackChance: 0.02,  rimBoost: [18, 20, 24],  glaze: true,  surfaceBlend: 0.55, surfaceRows: 2 },
        packed_snow:   { noiseAmp: 9,  depthTint: 0.06, crackChance: 0.015, rimBoost: [26, 30, 34],  glaze: true,  surfaceBlend: 0.68, surfaceRows: 3 },
        black_ice:     { noiseAmp: 8,  depthTint: 0.05, crackChance: 0.02,  rimBoost: [30, 36, 44],  glaze: true,  surfaceBlend: 0.58, surfaceRows: 2 },
        volcanic_ash:  { noiseAmp: 14, depthTint: 0.13, crackChance: 0.04,  rimBoost: [18, 12, 10],  glaze: false, surfaceBlend: 0.52, surfaceRows: 2 },
        obsidian_floor:{ noiseAmp: 15, depthTint: 0.14, crackChance: 0.05,  rimBoost: [22, 16, 18],  glaze: true,  surfaceBlend: 0.56, surfaceRows: 1 },
        salt_flats:    { noiseAmp: 10, depthTint: 0.08, crackChance: 0.03,  rimBoost: [24, 22, 18],  glaze: false, surfaceBlend: 0.62, surfaceRows: 2 },
        wet_cave_stone:{ noiseAmp: 14, depthTint: 0.14, crackChance: 0.05,  rimBoost: [12, 16, 18],  glaze: true,  surfaceBlend: 0.42, surfaceRows: 1 },
        rusty_metal:   { noiseAmp: 10, depthTint: 0.08, crackChance: 0.02,  rimBoost: [20, 14, 10],  glaze: false, surfaceBlend: 0.50, surfaceRows: 1 },
        wood_planks:   { noiseAmp: 11, depthTint: 0.09, crackChance: 0.018, rimBoost: [18, 12, 8],   glaze: false, surfaceBlend: 0.58, surfaceRows: 2 },
        mossy_ruin:    { noiseAmp: 11, depthTint: 0.09, crackChance: 0.025, rimBoost: [12, 18, 12],  glaze: false, surfaceBlend: 0.72, surfaceRows: 3 },
        crystal_dense: { noiseAmp: 12, depthTint: 0.08, crackChance: 0.03,  rimBoost: [22, 20, 28],  glaze: true,  surfaceBlend: 0.67, surfaceRows: 2 },
        fungus_glow:   { noiseAmp: 10, depthTint: 0.07, crackChance: 0.02,  rimBoost: [16, 28, 22],  glaze: true,  surfaceBlend: 0.70, surfaceRows: 3 },
        toxic_sludge:  { noiseAmp: 12, depthTint: 0.11, crackChance: 0.02,  rimBoost: [14, 22, 10],  glaze: false, surfaceBlend: 0.62, surfaceRows: 2 }
    };
    return profiles[themeName] || profiles.grass;
}

function getTerrainPixelColor(x, y, theme, profile, themeName) {
    const i = y * GAME_WIDTH + x;
    const v = terrainData[i];

    if (v === 0) return [0, 0, 0, 0];

    if (v === 10) {
        return [130, 94, 60, 255];
    }

    if (v >= 10) {
        const color = PALETTE[v - 10];
        return color ? [color[0], color[1], color[2], color[3]] : [0, 0, 0, 0];
    }

    const top = (y > 0) ? terrainData[i - GAME_WIDTH] : 0;
    const bottom = (y < GAME_HEIGHT - 1) ? terrainData[i + GAME_WIDTH] : 0;
    const left = (x > 0) ? terrainData[i - 1] : 0;
    const right = (x < GAME_WIDTH - 1) ? terrainData[i + 1] : 0;

    const isSurface = top === 0;
    const edgeLeft = left === 0;
    const edgeRight = right === 0;
    const edgeBottom = bottom === 0;

    const coarse = Math.sin(x * 0.11 + y * 0.05) + Math.cos(x * 0.07 - y * 0.13);
    const fine = (hashNoise2D(x, y) - 0.5) * 2;
    const noise = coarse * (profile.noiseAmp * 0.03) + fine * (profile.noiseAmp * 0.03);
    const depth = (y / GAME_HEIGHT) * profile.depthTint * 12;

    let r, g, b;

    // Use photo texture as base if loaded; fall back to procedural
    const texSample = sampleTerrainTexture(themeName || '', x, y);
    if (texSample) {
        const proceduralR = theme.terrain[0] + noise - depth;
        const proceduralG = theme.terrain[1] + noise * 0.95 - depth * 0.9;
        const proceduralB = theme.terrain[2] + noise * 0.9 - depth * 0.8;

        const blend = _terrainTexState.blend;
        r = texSample[0] * blend + proceduralR * (1 - blend);
        g = texSample[1] * blend + proceduralG * (1 - blend);
        b = texSample[2] * blend + proceduralB * (1 - blend);

        // Surface crust: blend in the theme's surface colour on the top rows so
        // each theme's identity colour (green for grass, white for snow, orange
        // for lava, etc.) is clearly visible even with photo textures active.
        if (isSurface) {
            const crust = 8 + Math.sin(x * 0.4) * 5 + (hashNoise2D(x * 2, y * 2) - 0.5) * 6;
            const sr = theme.surface[0] + crust;
            const sg = theme.surface[1] + crust;
            const sb = theme.surface[2] + crust;
            const sb2 = profile.surfaceBlend;
            r = sr * sb2 + r * (1 - sb2);
            g = sg * sb2 + g * (1 - sb2);
            b = sb * sb2 + b * (1 - sb2);
        } else if (profile.surfaceRows > 1) {
            // Count how many rows above this pixel are exposed air (≡ distance from top edge).
            let depthFromSurface = 0;
            for (let dy = 1; dy <= profile.surfaceRows; dy++) {
                const above = (y - dy >= 0) ? terrainData[(y - dy) * GAME_WIDTH + x] : 1;
                if (above === 0) { depthFromSurface = dy; break; }
            }
            if (depthFromSurface > 0 && depthFromSurface < profile.surfaceRows) {
                const fade = 1 - depthFromSurface / profile.surfaceRows;
                const crust = 8 + Math.sin(x * 0.4) * 5 + (hashNoise2D(x * 2, y * 2) - 0.5) * 6;
                const sr = theme.surface[0] + crust;
                const sg = theme.surface[1] + crust;
                const sb3 = theme.surface[2] + crust;
                const sb2 = profile.surfaceBlend * fade * 0.6;
                r = sr * sb2 + r * (1 - sb2);
                g = sg * sb2 + g * (1 - sb2);
                b = sb3 * sb2 + b * (1 - sb2);
            }
        }
    } else {
        r = theme.terrain[0] + noise - depth;
        g = theme.terrain[1] + noise * 0.95 - depth * 0.9;
        b = theme.terrain[2] + noise * 0.9 - depth * 0.8;
        if (isSurface) {
            const crust = 8 + Math.sin(x * 0.4) * 5 + (hashNoise2D(x * 2, y * 2) - 0.5) * 6;
            r = theme.surface[0] + crust;
            g = theme.surface[1] + crust;
            b = theme.surface[2] + crust;
        }
    }

    // Rim-light and edge beveling to make chunks feel authored.
    if (edgeLeft) {
        r += profile.rimBoost[0];
        g += profile.rimBoost[1];
        b += profile.rimBoost[2];
    }
    if (edgeRight) {
        r -= 10;
        g -= 12;
        b -= 14;
    }
    if (edgeBottom) {
        r -= 16;
        g -= 18;
        b -= 20;
    }

    // Crack decals (dark tiny fissures).
    if (!isSurface) {
        const crackA = hashNoise2D(x * 3 + 17, y * 2 + 9) < profile.crackChance;
        const crackB = ((x + y) % 11 === 0) && hashNoise2D(x * 5 + 3, y * 7 + 5) < profile.crackChance * 1.5;
        if (crackA || crackB) {
            r -= 30;
            g -= 32;
            b -= 34;
        }
    }

    // Gloss streaks for icy/snow/crystal themes.
    if (profile.glaze) {
        const streak = (Math.abs((x * 13 + y * 7 + 9) % 37 - 18) <= 1);
        if (streak && !edgeBottom) {
            r += 12;
            g += 16;
            b += 22;
        }
    }

    return [clampColor(r), clampColor(g), clampColor(b), 255];
}

function updateTerrainPixels(x, y, w, h) {
    if (x === undefined) {
        renderTerrainToOffscreen();
        return;
    }
    
    if (!terrainImgData) terrainImgData = new ImageData(GAME_WIDTH, GAME_HEIGHT);
    const data = terrainImgData.data;
    const themeName = getCurrentThemeName();
    const theme = getThemeColors();
    const profile = getThemeRenderProfile(themeName);
    
    let startX = Math.max(0, Math.floor(x));
    let startY = Math.max(0, Math.floor(y));
    let endX = Math.min(GAME_WIDTH, Math.ceil(x + w));
    // Expand by 1 pixel downwards to properly update the surface "snow" crust on the blocks directly below the changed area
    let endY = Math.min(GAME_HEIGHT, Math.ceil(y + h) + 1);

    for (let cy = startY; cy < endY; cy++) {
        for (let cx = startX; cx < endX; cx++) {
            let i = cy * GAME_WIDTH + cx;
            let idx = i * 4;
            const pxColor = getTerrainPixelColor(cx, cy, theme, profile, themeName);
            data[idx] = pxColor[0];
            data[idx+1] = pxColor[1];
            data[idx+2] = pxColor[2];
            data[idx+3] = pxColor[3];
        }
    }
    
    offCtx.putImageData(terrainImgData, 0, 0, startX, startY, endX - startX, endY - startY);
}

function digHole(cx, cy, radius) {
    for (let y = -radius; y <= radius; y++) {
        for (let x = -radius; x <= radius; x++) {
            if (x*x + y*y <= radius*radius) {
                setTerrain(cx + x, cy + y, 0);
            }
        }
    }
    updateTerrainPixels(cx - radius, cy - radius, radius * 2 + 1, radius * 2 + 1);
}

// Store the core rendering logic separately for editor override
function _renderTerrainCore(data, terrainImgDataRef, offCtxRef) {
    if (!terrainImgDataRef) terrainImgDataRef = new ImageData(GAME_WIDTH, GAME_HEIGHT);
    const d = terrainImgDataRef.data;
    
    // Get theme colors for current level
    const themeName = getCurrentThemeName();
    const theme = getThemeColors();
    const profile = getThemeRenderProfile(themeName);
    
    for (let i = 0; i < terrainData.length; i++) {
        let x = i % GAME_WIDTH;
        let y = Math.floor(i / GAME_WIDTH);
        let idx = i * 4;

        const pxColor = getTerrainPixelColor(x, y, theme, profile, themeName);
        d[idx] = pxColor[0];
        d[idx+1] = pxColor[1];
        d[idx+2] = pxColor[2];
        d[idx+3] = pxColor[3];
    }
    offCtxRef.putImageData(terrainImgDataRef, 0, 0);
    return terrainImgDataRef;
}

// Get current level theme colors
function getThemeColors() {
    const theme = typeof getLevelTheme === 'function' ? getLevelTheme(currentLevelIndex + 1) : 'grass';
    const themes = {
        grass: { surface: [34, 139, 34], terrain: [139, 69, 19] },
        desert: { surface: [210, 180, 140], terrain: [188, 143, 143] },
        snow: { surface: [255, 250, 250], terrain: [112, 128, 144] },
        rock: { surface: [128, 128, 128], terrain: [64, 64, 64] },
        ice: { surface: [173, 216, 230], terrain: [70, 130, 180] },
        lava: { surface: [255, 69, 0], terrain: [139, 0, 0] },
        crystal: { surface: [224, 176, 255], terrain: [148, 103, 189] },
        water:   { surface: [126, 210, 236], terrain: [56, 122, 166] },
        mud:     { surface: [90,  70,  40],  terrain: [60,  45,  25]  },
        cave:    { surface: [80,  80,  85],  terrain: [45,  45,  50]  },
        mossy:   { surface: [60, 130,  50],  terrain: [70,  90,  60]  },
        cliff_chalk:    { surface: [225, 216, 188], terrain: [178, 166, 138] },
        slate_ledge:    { surface: [126, 132, 142], terrain: [82, 87, 96] },
        frozen_mud:     { surface: [152, 154, 164], terrain: [86, 75, 62] },
        packed_snow:    { surface: [236, 238, 240], terrain: [152, 162, 172] },
        black_ice:      { surface: [114, 144, 178], terrain: [52, 74, 98] },
        volcanic_ash:   { surface: [98, 84, 78], terrain: [58, 52, 50] },
        obsidian_floor: { surface: [118, 96, 112], terrain: [54, 43, 60] },
        salt_flats:     { surface: [228, 220, 198], terrain: [170, 158, 136] },
        wet_cave_stone: { surface: [88, 98, 108], terrain: [44, 52, 60] },
        rusty_metal:    { surface: [156, 106, 72], terrain: [92, 78, 72] },
        wood_planks:    { surface: [170, 128, 82], terrain: [108, 76, 48] },
        mossy_ruin:     { surface: [92, 132, 84], terrain: [84, 92, 82] },
        crystal_dense:  { surface: [210, 176, 238], terrain: [124, 92, 168] },
        fungus_glow:    { surface: [106, 178, 138], terrain: [64, 92, 78] },
        toxic_sludge:   { surface: [122, 152, 78], terrain: [78, 98, 52] }
    };
    return themes[theme] || themes.grass;
}

function renderTerrainToOffscreen() {
    // Check if editor override exists and editor mode is active
    if (typeof window.Editor !== 'undefined' && window.Editor.isActive()) {
        renderTerrainForEditor();
        return;
    }
    
    if (!terrainImgData) terrainImgData = new ImageData(GAME_WIDTH, GAME_HEIGHT);
    terrainImgData = _renderTerrainCore(terrainImgData, terrainImgData, offCtx);
}

// Expose core rendering for editor use
window._renderTerrainCore = _renderTerrainCore;

// Texture debug helpers (call from browser console if needed)
window.TerrainTextures = {
    setEnabled(enabled) {
        _terrainTexState.enabled = !!enabled;
        renderTerrainToOffscreen();
    },
    setBlend(blend) {
        _terrainTexState.blend = Math.max(0, Math.min(1, Number(blend)));
        renderTerrainToOffscreen();
    },
    status() {
        return {
            enabled: _terrainTexState.enabled,
            blend: _terrainTexState.blend,
            loaded: _terrainTexState.loaded,
            total: _terrainTexState.total,
            themesLoaded: Object.keys(_terrainTexCache)
        };
    }
};


