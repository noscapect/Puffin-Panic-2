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
                    data[idx] = 240; data[idx+1] = 245; data[idx+2] = 255; data[idx+3] = 255;
                } else {
                    let noise = (Math.sin(cx*0.1) * Math.cos(cy*0.1) * 20) + 100;
                    data[idx] = noise * 0.8; data[idx+1] = noise * 0.7; data[idx+2] = noise * 0.6; data[idx+3] = 255;
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

function renderTerrainToOffscreen() {
    if (!terrainImgData) terrainImgData = new ImageData(GAME_WIDTH, GAME_HEIGHT);
    const data = terrainImgData.data;
    for (let i = 0; i < terrainData.length; i++) {
        let x = i % GAME_WIDTH;
        let y = Math.floor(i / GAME_WIDTH);
        let idx = i * 4;
        
        if (terrainData[i] === 1) {
            let isSurface = (y > 0 && terrainData[i - GAME_WIDTH] === 0);
            if (isSurface) {
                data[idx] = 240; data[idx+1] = 245; data[idx+2] = 255; data[idx+3] = 255;
            } else {
                let noise = (Math.sin(x*0.1) * Math.cos(y*0.1) * 20) + 100;
                data[idx] = noise * 0.8; data[idx+1] = noise * 0.7; data[idx+2] = noise * 0.6; data[idx+3] = 255;
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
    offCtx.putImageData(terrainImgData, 0, 0);
}


