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

function updateTerrainPixels(x, y, w, h) {
    if (x === undefined) {
        renderTerrainToOffscreen();
        return;
    }
    
    if (!terrainImgData) terrainImgData = new ImageData(GAME_WIDTH, GAME_HEIGHT);
    const data = terrainImgData.data;
    
    let startX = Math.max(0, Math.floor(x));
    let startY = Math.max(0, Math.floor(y));
    let endX = Math.min(GAME_WIDTH, Math.ceil(x + w));
    // Expand by 1 pixel downwards to properly update the surface "snow" crust on the blocks directly below the changed area
    let endY = Math.min(GAME_HEIGHT, Math.ceil(y + h) + 1);

    for (let cy = startY; cy < endY; cy++) {
        for (let cx = startX; cx < endX; cx++) {
            let i = cy * GAME_WIDTH + cx;
            let idx = i * 4;
            if (terrainData[i] === 1) {
                let isSurface = (cy > 0 && terrainData[i - GAME_WIDTH] === 0);
                if (isSurface) {
                    // Enhanced snow surface with subtle texture
                    let surfaceNoise = Math.sin(cx * 0.3) * 5 + Math.cos(cy * 0.5) * 3;
                    data[idx] = 235 + surfaceNoise; 
                    data[idx+1] = 240 + surfaceNoise; 
                    data[idx+2] = 255; 
                    data[idx+3] = 255;
                } else {
                    // Enhanced terrain with more natural noise pattern
                    let noise = (Math.sin(cx*0.15) * Math.cos(cy*0.12) * 25) + 
                                (Math.sin(cx*0.05 + cy*0.03) * 15) + 95;
                    data[idx] = noise * 0.75; 
                    data[idx+1] = noise * 0.65; 
                    data[idx+2] = noise * 0.55; 
                    data[idx+3] = 255;
                }
            } else if (terrainData[i] >= 10) {
                let color = PALETTE[terrainData[i] - 10];
                if (color) {
                    data[idx] = color[0]; data[idx+1] = color[1]; data[idx+2] = color[2]; data[idx+3] = color[3];
                } else {
                    data[idx] = 0; data[idx+1] = 0; data[idx+2] = 0; data[idx+3] = 0;
                }
            } else {
                data[idx] = 0; data[idx+1] = 0; data[idx+2] = 0; data[idx+3] = 0;
            }
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
    const theme = getThemeColors();
    
    for (let i = 0; i < terrainData.length; i++) {
        let x = i % GAME_WIDTH;
        let y = Math.floor(i / GAME_WIDTH);
        let idx = i * 4;
        
        if (terrainData[i] === 1) {
            let isSurface = (y > 0 && terrainData[i - GAME_WIDTH] === 0);
            if (isSurface) {
                // Surface color with subtle texture based on theme
                let surfaceNoise = Math.sin(x * 0.3) * 5 + Math.cos(y * 0.5) * 3;
                d[idx] = Math.min(255, theme.surface[0] + surfaceNoise); 
                d[idx+1] = Math.min(255, theme.surface[1] + surfaceNoise); 
                d[idx+2] = Math.min(255, theme.surface[2] + surfaceNoise); 
                d[idx+3] = 255;
            } else {
                // Terrain color with natural noise pattern based on theme
                let noise = (Math.sin(x*0.15) * Math.cos(y*0.12) * 15) + 
                            (Math.sin(x*0.05 + y*0.03) * 10);
                d[idx] = Math.max(0, Math.min(255, theme.terrain[0] + noise)); 
                d[idx+1] = Math.max(0, Math.min(255, theme.terrain[1] + noise)); 
                d[idx+2] = Math.max(0, Math.min(255, theme.terrain[2] + noise)); 
                d[idx+3] = 255;
            }
        } else if (terrainData[i] >= 10) {
            let color = PALETTE[terrainData[i] - 10];
            if (color) {
                d[idx] = color[0]; d[idx+1] = color[1]; d[idx+2] = color[2]; d[idx+3] = color[3];
            } else {
                d[idx] = 0; d[idx+1] = 0; d[idx+2] = 0; d[idx+3] = 0;
            }
        } else {
            d[idx] = 0; d[idx+1] = 0; d[idx+2] = 0; d[idx+3] = 0;
        }
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
        crystal: { surface: [224, 176, 255], terrain: [148, 103, 189] }
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


