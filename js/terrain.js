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
    const i = y * GAME_WIDTH + x;
    // If a cell is made solid, any liquid inside it is displaced.
    if (val !== 0 && liquidData && liquidData[i] > 0) {
        liquidData[i] = 0;
        _liquidDirty = true;
    }
    // If a cell is cleared (becomes air), liquid above it should flow in on next tick.
    if (val === 0 && liquidData) _liquidDirty = true;
    terrainData[i] = val;
}

function isSolidTerrain(val) {
    return val !== 0;
}

function isSolidAt(x, y) {
    return isSolidTerrain(getTerrain(x, y));
}

function isOneWayTerrain(val) {
    return val === 11 || val === 12;
}

function isDiggableTerrain(val, digDir = 0) {
    if (val === 1) return true;
    // One-way right (11) can only be excavated when moving right.
    if (val === 11) return digDir > 0;
    // One-way left (12) can only be excavated when moving left.
    if (val === 12) return digDir < 0;
    return false; // Steel and other solid materials are not diggable.
}

function canDigAt(x, y, digDir = 0) {
    return isDiggableTerrain(getTerrain(x, y), digDir);
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
    // In editor mode, use the editor's chosen theme rather than the game level's theme.
    if (typeof window.Editor !== 'undefined' && window.Editor.isActive()) {
        const edTheme = typeof _edSettings !== 'undefined' ? _edSettings.theme : null;
        if (edTheme) return edTheme;
    }
    return (typeof getLevelTheme === 'function') ? getLevelTheme(currentLevelIndex + 1) : 'grass';
}

function renderTerrainForEditor() {
    // Called by renderTerrainToOffscreen() when the editor is active.
    // _edRecompute() has already synced editorLevelData into terrainData before calling here.
    if (!terrainImgData) terrainImgData = new ImageData(GAME_WIDTH, GAME_HEIGHT);
    terrainImgData = _renderTerrainCore(terrainImgData, terrainImgData, offCtx);
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
        'wood_planks', 'mossy_ruin', 'crystal_dense', 'fungus_glow', 'toxic_sludge', 'concept_999',
        'sandstone', 'deep_sea', 'iron_ore', 'coral', 'amber', 'bone_white'
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
            } catch (e) {
                console.error(`[Terrain] getImageData failed for ${theme} â€” likely CORS/security block. Try serving via HTTP instead of file://.`, e);
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
    toxic_sludge:  4,
    concept_999:   4,
    sandstone:     3,
    deep_sea:      3,
    iron_ore:      3,
    coral:         3,
    amber:         3,
    bone_white:    3
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
    // surfaceBlend: how strongly the themed surface colour overrides the texture on the top row (0â€“1).
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
        toxic_sludge:  { noiseAmp: 12, depthTint: 0.11, crackChance: 0.02,  rimBoost: [14, 22, 10],  glaze: false, surfaceBlend: 0.62, surfaceRows: 2 },
        concept_999:   { noiseAmp: 11, depthTint: 0.10, crackChance: 0.02,  rimBoost: [18, 16, 10],  glaze: false, surfaceBlend: 0.74, surfaceRows: 3 },
        sandstone:     { noiseAmp: 12, depthTint: 0.10, crackChance: 0.03,  rimBoost: [22, 18, 12],  glaze: false, surfaceBlend: 0.68, surfaceRows: 2 },
        deep_sea:      { noiseAmp: 9,  depthTint: 0.06, crackChance: 0.015, rimBoost: [18, 24, 32],  glaze: true,  surfaceBlend: 0.45, surfaceRows: 1 },
        iron_ore:      { noiseAmp: 14, depthTint: 0.13, crackChance: 0.045, rimBoost: [20, 14, 10],  glaze: false, surfaceBlend: 0.48, surfaceRows: 1 },
        coral:         { noiseAmp: 10, depthTint: 0.07, crackChance: 0.02,  rimBoost: [24, 18, 14],  glaze: true,  surfaceBlend: 0.74, surfaceRows: 3 },
        amber:         { noiseAmp: 11, depthTint: 0.08, crackChance: 0.025, rimBoost: [24, 18, 8],   glaze: true,  surfaceBlend: 0.72, surfaceRows: 2 },
        bone_white:    { noiseAmp: 9,  depthTint: 0.06, crackChance: 0.02,  rimBoost: [24, 22, 18],  glaze: false, surfaceBlend: 0.60, surfaceRows: 2 }
    };
    return profiles[themeName] || profiles.grass;
}

function getTerrainPixelColor(x, y, theme, profile, themeName) {
    const i = y * GAME_WIDTH + x;
    const v = terrainData[i];

    if (v === 0) return [0, 0, 0, 0];

    if (v === 10) {
        // Steel
        return [130, 94, 60, 255];
    }

    if (v === 11 || v === 12) {
        // One-way terrain with subtle directional chevrons.
        const base = [72, 102, 138];
        const brighten = ((x + y) % 6) < 2;
        let r = base[0] + (brighten ? 18 : 0);
        let g = base[1] + (brighten ? 20 : 0);
        let b = base[2] + (brighten ? 24 : 0);

        const mod = 10;
        const shifted = v === 11
            ? ((x - y) % mod + mod) % mod
            : ((x + y) % mod + mod) % mod;
        if (shifted <= 1 || shifted >= mod - 2) {
            r += 34;
            g += 38;
            b += 44;
        }

        return [clampColor(r), clampColor(g), clampColor(b), 255];
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
            // Count how many rows above this pixel are exposed air (â‰¡ distance from top edge).
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
    // Activate sand cascade above the blast zone for sand-theme levels.
    // Only the row at the top of the blast circle is enough — updateSand propagates upward.
    if (typeof SAND_THEMES !== 'undefined' && SAND_THEMES.has(getCurrentThemeName())) {
        for (let dx = -radius; dx <= radius; dx++) {
            _activateSandAbove(cx + dx, cy - radius);
        }
    }
    // Extend rect by 1 row above to cover sand cells that just became air.
    updateTerrainPixels(cx - radius, cy - radius - 1, radius * 2 + 1, radius * 2 + 2);
    // Splash liquid out of the blast zone; it will flow back into the cavity naturally.
    if (typeof displaceLiquidInRadius === 'function') {
        displaceLiquidInRadius(cx, cy, radius);
    }
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
        toxic_sludge:   { surface: [122, 152, 78],  terrain: [78, 98, 52] },
        sandstone:      { surface: [212, 176, 118], terrain: [168, 132, 80] },
        deep_sea:       { surface: [48,  84, 118],  terrain: [28,  54, 80]  },
        iron_ore:       { surface: [108, 86,  72],  terrain: [68,  58, 56]  },
        coral:          { surface: [220, 140, 100], terrain: [158, 88, 64]  },
        amber:          { surface: [224, 172, 72],  terrain: [160, 110, 40] },
        bone_white:     { surface: [220, 212, 196], terrain: [164, 148, 124] }
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

// =============================================================
// VOLUMETRIC LIQUID SIMULATION
// Cellular automaton: each cell stores 0-LIQUID_MAX units of water.
// Liquid falls under gravity then equalises sideways. Terrain
// erosion (digHole, basher, etc.) opens gaps that liquid floods
// on the next simulation step automatically.
// =============================================================

// liquidData and liquidCanvas/Ctx are declared in engine.js as globals,
// just like terrainData and offscreenCanvas.

// â”€â”€â”€ One simulation step â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// u{2500}u{2500}u{2500} Initialise from rectangular water zones (level load) u{2500}u{2500}u{2500}u{2500}
function initLiquidFromZones(zones) {
    if (!zones || !zones.length) return;
    for (const zone of zones) {
        const x0 = Math.max(0, zone.x);
        const y0 = Math.max(0, zone.y);
        const x1 = Math.min(GAME_WIDTH  - 1, zone.x + zone.w - 1);
        const y1 = Math.min(GAME_HEIGHT - 1, zone.y + zone.h - 1);
        for (let y = y0; y <= y1; y++) {
            for (let x = x0; x <= x1; x++) {
                const i = y * GAME_WIDTH + x;
                // Only fill air cells (don't overwrite solid terrain).
                if (terrainData[i] === 0) liquidData[i] = LIQUID_MAX;
            }
        }
    }
    _liquidDirty = true;
}

let _liquidSimTick = 0;  // used to alternate sweep direction
function updateLiquid() {
    let anyChanged = false;
    const W = GAME_WIDTH, H = GAME_HEIGHT;

    // â”€â”€ Pass 1: gravity (bottom-to-top row order) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Processing bottom-to-top lets liquid cascade down in a single tick.
    for (let y = H - 2; y >= 0; y--) {
        for (let x = 0; x < W; x++) {
            const i = y * W + x;
            let amt = liquidData[i];
            if (amt === 0) continue;
            // Solid terrain should never hold liquid (cleanup guard).
            if (terrainData[i] !== 0) { liquidData[i] = 0; anyChanged = true; continue; }

            const bi = i + W; // cell directly below
            if (terrainData[bi] !== 0) continue; // floor is solid
            const space = LIQUID_MAX - liquidData[bi];
            if (space <= 0) continue;
            const flow = Math.min(amt, space, LIQUID_FLOW);
            liquidData[bi] += flow;
            liquidData[i]  -= flow;
            anyChanged = true;
        }
    }

    // â”€â”€ Pass 2: sideways equalisation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Alternate sweep direction each tick to prevent left-bias.
    const leftFirst = (_liquidSimTick % 2 === 0);
    for (let y = H - 1; y >= 0; y--) {
        const xStart = leftFirst ? 0        : W - 1;
        const xEnd   = leftFirst ? W        : -1;
        const xStep  = leftFirst ? 1        : -1;
        for (let x = xStart; x !== xEnd; x += xStep) {
            const i = y * W + x;
            let amt = liquidData[i];
            if (amt <= 1) continue;
            if (terrainData[i] !== 0) continue;

            // Don't spread sideways if liquid can still fall (prefer gravity).
            const bi = i + W;
            const canFallBelow = (y + 1 < H) && terrainData[bi] === 0 && liquidData[bi] < LIQUID_MAX;
            if (canFallBelow) continue;

            // Try both neighbours, prefer the direction of sweep first.
            for (let dx = -1; dx <= 1; dx += 2) {
                const nx = x + (leftFirst ? dx : -dx);
                if (nx < 0 || nx >= W) continue;
                const ni = i + (leftFirst ? dx : -dx);
                if (terrainData[ni] !== 0) continue;
                const diff = liquidData[i] - liquidData[ni];
                if (diff <= 1) continue;
                const flow = Math.min(Math.floor(diff / 2), LIQUID_FLOW);
                if (flow === 0) continue;
                liquidData[ni] += flow;
                liquidData[i]  -= flow;
                anyChanged = true;
            }
        }
    }

    _liquidSimTick++;
    _liquidDirty = anyChanged;
    if (anyChanged) renderLiquidLayer();
}

// â”€â”€â”€ Render liquid pixels to liquidCanvas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//
// Visual rules (pixel art style):
//   Surface pixel (cell above has no liquid): bright aqua crest
//   Body pixel (submerged):                   deep translucent blue
//   Alpha scales with liquid amount so partial cells look shallower.
function renderLiquidLayer() {
    if (!liquidCtx || !liquidImgData) return;
    const d = liquidImgData.data;
    const W = GAME_WIDTH, H = GAME_HEIGHT;
    const t = typeof gameState !== 'undefined' ? (gameState.ticks || 0) : 0;

    // Clear to fully transparent
    for (let i = 0, n = d.length; i < n; i++) d[i] = 0;

    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const i   = y * W + x;
            const amt = liquidData[i];
            if (amt === 0) continue;

            const isSurface = (y === 0) || liquidData[(y - 1) * W + x] === 0;
            // Alpha: full cell = 210, partial proportionally less (min 80 so thin layers are visible)
            const alpha = Math.max(80, Math.floor((amt / LIQUID_MAX) * 210));
            const base = i << 2; // i * 4

            if (isSurface) {
                // Animated crest: sine wave on x to give a ripple effect
                const wave = Math.sin(x * 0.35 + t * 0.07) > 0.5 ? 20 : 0;
                d[base]     = 150 + wave;
                d[base + 1] = 230 + wave;
                d[base + 2] = 255;
                d[base + 3] = Math.min(255, alpha + 30);
            } else {
                // Depth tint â€” gradually darker further from surface
                const depthY = y - _liquidSurfaceYAt(x, y);
                const depthT = Math.min(1, depthY / 20);
                d[base]     = Math.round(40  - depthT * 20);
                d[base + 1] = Math.round(148 - depthT * 60);
                d[base + 2] = Math.round(215 - depthT * 40);
                d[base + 3] = alpha;
            }
        }
    }

    // ── Falling sand (opaque, terrain-surface tone) ───────────────
    if (typeof sandData !== 'undefined') {
        const sc = getThemeColors().surface;
        for (let i = 0; i < W * H; i++) {
            if (sandData[i] !== 1) continue;
            const b = i << 2;
            d[b]   = Math.max(0, sc[0] - 12);
            d[b+1] = Math.max(0, sc[1] - 10);
            d[b+2] = Math.max(0, sc[2] - 8);
            d[b+3] = 255;
        }
    }

    // ── Liquid lava (glowing orange, brighter at surface) ─────────
    if (typeof lavaData !== 'undefined') {
        for (let ly = 0; ly < H; ly++) {
            for (let lx = 0; lx < W; lx++) {
                const i = ly * W + lx;
                if (lavaData[i] !== 1) continue;
                const isSurface = (ly === 0) || lavaData[(ly - 1) * W + lx] === 0;
                const b = i << 2;
                const flicker = Math.sin(lx * 0.4 + t * 0.13) > 0.3 ? 18 : 0;
                if (isSurface) {
                    d[b]   = 255;
                    d[b+1] = 170 + flicker;
                    d[b+2] = 0;    d[b+3] = 252;
                } else {
                    d[b]   = 200 - flicker;
                    d[b+1] = 40;
                    d[b+2] = 0;    d[b+3] = 235;
                }
            }
        }
    }

    liquidCtx.putImageData(liquidImgData, 0, 0);
}
function _liquidSurfaceYAt(x, fromY) {
    for (let y = fromY; y >= 0; y--) {
        if (liquidData[y * GAME_WIDTH + x] === 0) return y + 1;
    }
    return 0;
}

// â”€â”€â”€ API helpers used by the rest of the engine â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// Returns the liquid amount at a game-coordinate pixel.
function getLiquidAt(x, y) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || x >= GAME_WIDTH || y < 0 || y >= GAME_HEIGHT) return 0;
    return liquidData[y * GAME_WIDTH + x];
}

// Find the Y of the liquid surface at a given column (returns -1 if none).
function getLiquidSurfaceY(x) {
    x = Math.floor(x);
    if (x < 0 || x >= GAME_WIDTH) return -1;
    for (let y = 0; y < GAME_HEIGHT; y++) {
        if (liquidData[y * GAME_WIDTH + x] > 0) return y;
    }
    return -1;
}

// Returns approximate bottom of continuously-liquid column at x, from startY down.
function getLiquidBottomY(x, startY) {
    x = Math.floor(x);
    startY = Math.floor(startY);
    let last = startY;
    for (let y = startY; y < GAME_HEIGHT; y++) {
        if (liquidData[y * GAME_WIDTH + x] > 0) last = y;
        else break;
    }
    return last;
}

// Displace liquid in a circular region (used by explosions).
// Removes liquid from the blast radius and splashes it outward.
function displaceLiquidInRadius(cx, cy, radius) {
    cx = Math.floor(cx); cy = Math.floor(cy);
    const r2 = radius * radius;
    let displaced = 0;
    for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
            if (dx * dx + dy * dy > r2) continue;
            const x = cx + dx, y = cy + dy;
            if (x < 0 || x >= GAME_WIDTH || y < 0 || y >= GAME_HEIGHT) continue;
            const i = y * GAME_WIDTH + x;
            if (liquidData[i] > 0) {
                displaced += liquidData[i];
                liquidData[i] = 0;
            }
        }
    }
    if (displaced > 0) {
        // Try to redistribute displaced volume to cells just outside the radius
        // (simulates water splashing outward from explosion)
        const outerR = radius + 3;
        const outerR2 = outerR * outerR;
        let slots = [];
        for (let dy = -outerR; dy <= outerR; dy++) {
            for (let dx = -outerR; dx <= outerR; dx++) {
                const dist2 = dx * dx + dy * dy;
                if (dist2 <= r2 || dist2 > outerR2) continue;
                const x = cx + dx, y = cy + dy;
                if (x < 0 || x >= GAME_WIDTH || y < 0 || y >= GAME_HEIGHT) continue;
                const i = y * GAME_WIDTH + x;
                if (terrainData[i] === 0 && liquidData[i] < LIQUID_MAX) slots.push(i);
            }
        }
        if (slots.length > 0) {
            const share = Math.floor(displaced / slots.length);
            const extra = displaced % slots.length;
            for (let s = 0; s < slots.length; s++) {
                const add = share + (s < extra ? 1 : 0);
                liquidData[slots[s]] = Math.min(LIQUID_MAX, liquidData[slots[s]] + add);
            }
        }
        _liquidDirty = true;
        renderLiquidLayer();
    }
}

// â”€â”€â”€ Ice melting â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// How many liquid units each ice-like theme yields per cell when melted.
// Themes not listed here don't melt at all.
const _ICE_MELT_AMT = {
    ice:          LIQUID_MAX,                    // pure ice â€” full water
    black_ice:    LIQUID_MAX,                    // black ice â€” full water
    packed_snow:  Math.round(LIQUID_MAX * 0.65), // compacted snow â€” ~2/3 water
    frozen_mud:   Math.round(LIQUID_MAX * 0.50), // half ice, half mud
    snow:         Math.round(LIQUID_MAX * 0.35), // loose snow â€” ~1/3 water
};

// Call this AFTER digHole so cells are already air.
// Fills every newly-empty cell in the radius with meltwater, then spawns
// a small steam / droplet particle burst at the blast centre.
function meltIceInRadius(cx, cy, radius) {
    const meltAmt = _ICE_MELT_AMT[getCurrentThemeName()];
    if (!meltAmt) return; // not a meltable ice theme

    cx = Math.floor(cx); cy = Math.floor(cy);
    const r2 = radius * radius;
    let melted = 0;

    for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
            if (dx * dx + dy * dy > r2) continue;
            const x = cx + dx, y = cy + dy;
            if (x < 0 || x >= GAME_WIDTH || y < 0 || y >= GAME_HEIGHT) continue;
            const i = y * GAME_WIDTH + x;
            // Only fill cells that are now air (just dug by digHole).
            if (terrainData[i] === 0) {
                liquidData[i] = Math.max(liquidData[i], meltAmt);
                melted++;
            }
        }
    }

    if (melted > 0) {
        _liquidDirty = true;
        renderLiquidLayer();

        // Visual: spawn a burst of blue-white steam/water-droplet particles
        // so the player can see that ice melted rather than just debris flying.
        if (typeof particles !== 'undefined' && typeof Particle !== 'undefined') {
            const steamColors = [
                [200, 235, 255],
                [170, 215, 250],
                [255, 255, 255],
            ];
            const count = Math.min(30, Math.floor(melted * 0.4));
            for (let i = 0; i < count; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = 1.5 + Math.random() * 4;
                const col   = steamColors[Math.floor(Math.random() * steamColors.length)];
                const p = new Particle(cx + (Math.random() - 0.5) * radius,
                                       cy + (Math.random() - 0.5) * radius,
                                       col, false);
                p.vx   = Math.cos(angle) * speed;
                p.vy   = Math.sin(angle) * speed - 2.5; // bias upward (steam rises)
                p.life = 18 + Math.random() * 22;
                p.size = 1 + (Math.random() > 0.6 ? 1 : 0);
                particles.push(p);
            }
        }
    }
}

// =============================================================
// FALLING SAND SIMULATION
// sandData[i] = 1: this air cell holds a displaced sand grain
// that is in freefall. Grains fall under gravity, slide diag-
// onally if blocked, and solidify back into terrain when stuck.
// Activated when terrain is dug in a SAND_THEMES level.
// =============================================================

// Convert cells immediately above (x, y) into falling sand.
// Called after terrain is cleared so the cells above now hang unsupported.
function _activateSandAbove(x, y) {
    for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y - 1;
        if (nx < 0 || nx >= GAME_WIDTH || ny < 0) continue;
        const i = ny * GAME_WIDTH + nx;
        // Only dislodge diggable solid — not air, not steel (10), not already sand.
        if (terrainData[i] !== 0 && terrainData[i] !== 10 && sandData[i] === 0) {
            terrainData[i] = 0;
            sandData[i] = 1;
            updateTerrainPixels(nx, ny, 1, 1); // show the cell as air immediately
        }
    }
}

// One sand simulation step (call every 3 ticks from engine.js).
function updateSand() {
    if (typeof SAND_THEMES === 'undefined' || !SAND_THEMES.has(getCurrentThemeName())) return;
    if (typeof sandData === 'undefined') return;
    const W = GAME_WIDTH, H = GAME_HEIGHT;
    // Bottom-to-top sweep so grains fall the full distance in one pass.
    for (let y = H - 2; y >= 0; y--) {
        for (let x = 0; x < W; x++) {
            const i = y * W + x;
            if (sandData[i] !== 1) continue;

            const bi = i + W; // cell directly below

            // 1. Fall straight down into empty air.
            if (terrainData[bi] === 0 && sandData[bi] === 0 && (typeof liquidData === 'undefined' || liquidData[bi] === 0)) {
                sandData[i] = 0;
                sandData[bi] = 1;
                _activateSandAbove(x, y); // cascade: expose cells above old position
                continue;
            }

            // 2. Slide diagonally (random-preferred direction to prevent bias).
            let moved = false;
            const dx0 = (Math.random() < 0.5) ? -1 : 1;
            for (let a = 0; a < 2; a++) {
                const dx = (a === 0) ? dx0 : -dx0;
                const nx = x + dx;
                if (nx < 0 || nx >= W) continue;
                const di = (y + 1) * W + nx;
                if (terrainData[di] === 0 && sandData[di] === 0 && (typeof liquidData === 'undefined' || liquidData[di] === 0)) {
                    sandData[i] = 0;
                    sandData[di] = 1;
                    _activateSandAbove(x, y);
                    moved = true;
                    break;
                }
            }
            if (moved) continue;

            // 3. Completely blocked — solidify back into terrain.
            sandData[i] = 0;
            terrainData[i] = 1;
            updateTerrainPixels(x, y, 1, 1);
        }
    }
}

// =============================================================
// LIQUID LAVA SIMULATION
// lavaData[i] = 1: this air cell contains flowing lava.
// Lava is much slower than water (throttled by LAVA_FLOW_INTERVAL).
// Lava + water → solid stone + steam (cross-reaction).
// Puffins touching lava cells die instantly.
// Lava zones are defined per-level (lavaZones array in JSON),
// so existing levels without lavaZones are completely unaffected.
// =============================================================

let _lavaTick = 0;
const LAVA_FLOW_INTERVAL = 8; // simulation steps between lava moves

function initLavaFromZones(zones) {
    if (!zones || !zones.length) return;
    for (const zone of zones) {
        const x0 = Math.max(0, zone.x);
        const y0 = Math.max(0, zone.y);
        const x1 = Math.min(GAME_WIDTH  - 1, zone.x + zone.w - 1);
        const y1 = Math.min(GAME_HEIGHT - 1, zone.y + zone.h - 1);
        for (let y = y0; y <= y1; y++) {
            for (let x = x0; x <= x1; x++) {
                const i = y * GAME_WIDTH + x;
                if (terrainData[i] === 0) lavaData[i] = 1;
            }
        }
    }
}

// Internal helper: emit a puff of steam-like particles at (x, y).
function _spawnSteamAt(x, y) {
    if (typeof particles === 'undefined' || typeof Particle === 'undefined') return;
    for (let n = 0; n < 5; n++) {
        const p = new Particle(x + Math.random() * 2, y, [210, 215, 225], false);
        p.vx = (Math.random() - 0.5) * 2;
        p.vy = -1.5 - Math.random() * 2;
        p.gravityScale = -0.04;
        p.collisionEnabled = false;
        p.fadeRate = 0.85;
        p.life = 14 + Math.random() * 14;
        particles.push(p);
    }
}

let _lavaImgDirty = false;
function updateLava() {
    if (typeof lavaData === 'undefined') return;
    _lavaTick++;
    if (_lavaTick % LAVA_FLOW_INTERVAL !== 0) return;

    const W = GAME_WIDTH, H = GAME_HEIGHT;
    _lavaImgDirty = false;

    // ── Gravity pass (bottom-to-top) ─────────────────────────────
    for (let y = H - 2; y >= 0; y--) {
        for (let x = 0; x < W; x++) {
            const i = y * W + x;
            if (lavaData[i] !== 1) continue;
            if (terrainData[i] !== 0) { lavaData[i] = 0; continue; } // terrain reclaimed the cell

            const bi = i + W;

            // Lava + liquid water reaction: both consumed → stone + steam.
            if (typeof liquidData !== 'undefined' && liquidData[bi] > 0) {
                liquidData[bi] = 0;
                lavaData[i]    = 0;
                terrainData[i] = 1; // this lava cell solidifies into rock
                updateTerrainPixels(x, y, 1, 1);
                _spawnSteamAt(x, y);
                _lavaImgDirty = true;
                continue;
            }

            // Fall straight down into open air.
            if (terrainData[bi] === 0 && lavaData[bi] === 0) {
                lavaData[i]  = 0;
                lavaData[bi] = 1;
                _lavaImgDirty = true;
            }
        }
    }

    // ── Sideways spread (lava only sprawls if gravity is blocked) ─
    const leftFirst = (_lavaTick & 1) === 0;
    for (let y = H - 1; y >= 0; y--) {
        const xStart = leftFirst ? 0 : W - 1;
        const xEnd   = leftFirst ? W : -1;
        const xStep  = leftFirst ? 1 : -1;
        for (let x = xStart; x !== xEnd; x += xStep) {
            const i = y * W + x;
            if (lavaData[i] !== 1) continue;
            if (terrainData[i] !== 0) continue;

            // Don't spread sideways if lava can still fall.
            const bi = i + W;
            const canFall = (y + 1 < H) && terrainData[bi] === 0 && lavaData[bi] === 0;
            if (canFall) continue;

            for (const dx of (leftFirst ? [-1, 1] : [1, -1])) {
                const nx = x + dx;
                if (nx < 0 || nx >= W) continue;
                const ni = i + dx;

                // Lava + water sideways reaction.
                if (typeof liquidData !== 'undefined' && liquidData[ni] > 0) {
                    liquidData[ni] = 0;
                    lavaData[i]    = 0;
                    terrainData[i] = 1;
                    updateTerrainPixels(x, y, 1, 1);
                    _spawnSteamAt(x, y);
                    _lavaImgDirty = true;
                    break;
                }

                // Spread into open air (one cell at a time — very viscous).
                if (terrainData[ni] === 0 && lavaData[ni] === 0 &&
                    (typeof liquidData === 'undefined' || liquidData[ni] === 0)) {
                    lavaData[ni] = 1;
                    _lavaImgDirty = true;
                    break;
                }
            }
        }
    }
}

// Returns true if the game cell (x, y) holds liquid lava (for puffin hazard check).
function isLavaAt(x, y) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || x >= GAME_WIDTH || y < 0 || y >= GAME_HEIGHT) return false;
    if (typeof lavaData === 'undefined') return false;
    return lavaData[y * GAME_WIDTH + x] === 1;
}

