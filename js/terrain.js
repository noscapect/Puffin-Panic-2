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

function getThemeRenderProfile(themeName) {
    const profiles = {
        grass:   { noiseAmp: 12, depthTint: 0.08, crackChance: 0.02, rimBoost: [18, 22, 26], glaze: false },
        desert:  { noiseAmp: 11, depthTint: 0.10, crackChance: 0.03, rimBoost: [16, 14, 10], glaze: false },
        snow:    { noiseAmp: 10, depthTint: 0.06, crackChance: 0.015, rimBoost: [26, 30, 34], glaze: true },
        rock:    { noiseAmp: 14, depthTint: 0.12, crackChance: 0.04, rimBoost: [14, 16, 18], glaze: false },
        ice:     { noiseAmp: 9,  depthTint: 0.05, crackChance: 0.018, rimBoost: [30, 36, 44], glaze: true },
        lava:    { noiseAmp: 16, depthTint: 0.15, crackChance: 0.05, rimBoost: [22, 10, 4],  glaze: false },
        crystal: { noiseAmp: 12, depthTint: 0.08, crackChance: 0.03, rimBoost: [20, 18, 26], glaze: true },
        water:   { noiseAmp: 10, depthTint: 0.06, crackChance: 0.02, rimBoost: [22, 30, 36], glaze: true }
    };
    return profiles[themeName] || profiles.grass;
}

function getTerrainPixelColor(x, y, theme, profile) {
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
    const noise = coarse * (profile.noiseAmp * 0.5) + fine * (profile.noiseAmp * 0.5);
    const depth = (y / GAME_HEIGHT) * profile.depthTint * 255;

    let r = theme.terrain[0] + noise - depth;
    let g = theme.terrain[1] + noise * 0.95 - depth * 0.9;
    let b = theme.terrain[2] + noise * 0.9 - depth * 0.8;

    if (isSurface) {
        const crust = 8 + Math.sin(x * 0.4) * 5 + (hashNoise2D(x * 2, y * 2) - 0.5) * 6;
        r = theme.surface[0] + crust;
        g = theme.surface[1] + crust;
        b = theme.surface[2] + crust;
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
            const pxColor = getTerrainPixelColor(cx, cy, theme, profile);
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

        const pxColor = getTerrainPixelColor(x, y, theme, profile);
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
        water: { surface: [126, 210, 236], terrain: [56, 122, 166] }
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


