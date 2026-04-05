// --- Level Editor ---

let editorMode = false;
let editorTool = 'terrain'; // terrain, erase, entrance, exit
let editorBrushSize = 1;
let editorLevelData = null;
let editorEntrance = { x: 70, y: 20 };
let editorExit = { x: 340, y: 78, w: 20, h: 12 };

function enterEditorMode() {
    editorMode = true;
    editorLevelData = new Uint8Array(GAME_WIDTH * GAME_HEIGHT);
    
    // Create basic ground
    for (let y = 90; y < GAME_HEIGHT; y++) {
        for (let x = 0; x < GAME_WIDTH; x++) {
            editorLevelData[y * GAME_WIDTH + x] = 1;
        }
    }
    
    // Walls
    for (let y = 0; y < GAME_HEIGHT; y++) {
        for (let x = 0; x < 10; x++) editorLevelData[y * GAME_WIDTH + x] = 1;
        for (let x = GAME_WIDTH - 10; x < GAME_WIDTH; x++) editorLevelData[y * GAME_WIDTH + x] = 1;
    }
    
    editorEntrance = { x: 70, y: 20 };
    editorExit = { x: 340, y: 78, w: 20, h: 12 };
    
    renderTerrainToOffscreen();
    showEditorUI();
}

function exitEditorMode() {
    editorMode = false;
    hideEditorUI();
}

function showEditorUI() {
    let html = `
    <div id="editor-overlay" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);z-index:50;display:flex;flex-direction:column;align-items:center;justify-content:center;">
        <h2 style="color:#fff;margin-bottom:20px;">🛠️ Level Editor</h2>
        <div style="display:flex;gap:10px;margin-bottom:20px;">
            <button onclick="setEditorTool('terrain')" id="tool-terrain" class="editor-tool-btn" style="padding:10px 20px;font-family:inherit;background:#4CAF50;color:white;border:none;cursor:pointer;">🪨 Terrain</button>
            <button onclick="setEditorTool('erase')" id="tool-erase" class="editor-tool-btn" style="padding:10px 20px;font-family:inherit;background:#f44336;color:white;border:none;cursor:pointer;">🧹 Erase</button>
            <button onclick="setEditorTool('entrance')" id="tool-entrance" class="editor-tool-btn" style="padding:10px 20px;font-family:inherit;background:#2196F3;color:white;border:none;cursor:pointer;">🚪 Entrance</button>
            <button onclick="setEditorTool('exit')" id="tool-exit" class="editor-tool-btn" style="padding:10px 20px;font-family:inherit;background:#FF9800;color:white;border:none;cursor:pointer;">🏁 Exit</button>
        </div>
        <div style="display:flex;gap:10px;align-items:center;margin-bottom:20px;">
            <span style="color:#fff;">Brush Size:</span>
            <input type="range" id="brush-size" min="1" max="10" value="1" oninput="editorBrushSize=parseInt(this.value)" style="width:150px;">
            <span id="brush-size-val" style="color:#5f5;">1</span>
        </div>
        <div style="display:flex;gap:10px;align-items:center;margin-bottom:20px;">
            <span style="color:#fff;">Level Name:</span>
            <input type="text" id="level-name" value="Custom Level" style="padding:5px;font-family:inherit;background:#334;color:#fff;border:1px solid #556;">
        </div>
        <div style="display:flex;gap:10px;">
            <button onclick="testLevel()" style="padding:10px 20px;font-family:inherit;background:#4CAF50;color:white;border:none;cursor:pointer;">▶ Test Level</button>
            <button onclick="exportLevel()" style="padding:10px 20px;font-family:inherit;background:#2196F3;color:white;border:none;cursor:pointer;">📋 Export</button>
            <button onclick="clearEditor()" style="padding:10px 20px;font-family:inherit;background:#f44336;color:white;border:none;cursor:pointer;">🗑️ Clear</button>
            <button onclick="exitEditorMode()" style="padding:10px 20px;font-family:inherit;background:#666;color:white;border:none;cursor:pointer;">✖ Close</button>
        </div>
        <div style="color:#888;margin-top:15px;font-size:12px;">
            Left-click to draw | Right-click to erase | Scroll to change brush size
        </div>
    </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
    
    // Add editor click handler
    canvas.addEventListener('mousedown', editorClickHandler);
    canvas.addEventListener('wheel', editorWheelHandler);
}

function hideEditorUI() {
    const overlay = document.getElementById('editor-overlay');
    if (overlay) overlay.remove();
    canvas.removeEventListener('mousedown', editorClickHandler);
    canvas.removeEventListener('wheel', editorWheelHandler);
}

function setEditorTool(tool) {
    editorTool = tool;
    document.querySelectorAll('.editor-tool-btn').forEach(btn => {
        btn.style.border = 'none';
        btn.style.boxShadow = 'none';
    });
    const activeBtn = document.getElementById(`tool-${tool}`);
    if (activeBtn) {
        activeBtn.style.border = '2px solid #fff';
        activeBtn.style.boxShadow = '0 0 10px rgba(255,255,255,0.5)';
    }
}

function editorClickHandler(e) {
    if (!editorMode) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / SCALE);
    const y = Math.floor((e.clientY - rect.top) / SCALE);
    
    if (editorTool === 'entrance') {
        editorEntrance = { x: x, y: y };
        renderTerrainToOffscreen();
    } else if (editorTool === 'exit') {
        editorExit = { x: x, y: y, w: 20, h: 12 };
        renderTerrainToOffscreen();
    } else {
        paintTerrain(x, y, e.button === 2 || e.button === 0);
    }
}

function editorWheelHandler(e) {
    if (!editorMode) return;
    e.preventDefault();
    editorBrushSize = Math.max(1, Math.min(10, editorBrushSize + (e.deltaY > 0 ? -1 : 1)));
    const slider = document.getElementById('brush-size');
    const val = document.getElementById('brush-size-val');
    if (slider) slider.value = editorBrushSize;
    if (val) val.innerText = editorBrushSize;
}

function paintTerrain(x, y, add) {
    const val = add ? 1 : 0;
    const half = Math.floor(editorBrushSize / 2);
    
    for (let dy = -half; dy < editorBrushSize - half; dy++) {
        for (let dx = -half; dx < editorBrushSize - half; dx++) {
            const tx = x + dx;
            const ty = y + dy;
            if (tx >= 0 && tx < GAME_WIDTH && ty >= 0 && ty < GAME_HEIGHT) {
                editorLevelData[ty * GAME_WIDTH + tx] = val;
            }
        }
    }
    
    // Update offscreen canvas
    const startX = Math.max(0, x - half);
    const startY = Math.max(0, y - half);
    const w = Math.min(GAME_WIDTH - startX, editorBrushSize);
    const h = Math.min(GAME_HEIGHT - startY, editorBrushSize);
    updateTerrainPixels(startX, startY, w, h);
}

function clearEditor() {
    if (confirm('Clear all terrain?')) {
        editorLevelData.fill(0);
        renderTerrainToOffscreen();
    }
}

function testLevel() {
    // Save current editor state and load level
    const levelData = exportLevelData();
    const customLevel = {
        name: document.getElementById('level-name').value || 'Custom Level',
        total: 20,
        required: 15,
        spawnRate: FPS * 2,
        time: 5 * 60 * FPS,
        entrance: { ...editorEntrance },
        exit: { ...editorExit },
        skills: { floater: 5, bomber: 3, blocker: 3, builder: 8, basher: 5, digger: 5, climber: 5, miner: 5, platformer: 5 },
        buildTerrain: null,
        _terrainData: levelData
    };
    
    // Temporarily add as a level
    const tempIndex = LEVELS.length;
    LEVELS.push(customLevel);
    
    exitEditorMode();
    loadLevel(tempIndex);
    
    // Remove temp level after playing
    setTimeout(() => {
        LEVELS.pop();
    }, 1000);
}

function exportLevelData() {
    // Compress terrain data - run-length encoding
    const compressed = [];
    let current = editorLevelData[0];
    let count = 1;
    
    for (let i = 1; i < editorLevelData.length; i++) {
        if (editorLevelData[i] === current && count < 255) {
            count++;
        } else {
            compressed.push(current, count);
            current = editorLevelData[i];
            count = 1;
        }
    }
    compressed.push(current, count);
    
    return {
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
        data: compressed,
        entrance: editorEntrance,
        exit: editorExit
    };
}

function exportLevel() {
    const levelData = exportLevelData();
    const json = JSON.stringify(levelData);
    
    // Copy to clipboard
    navigator.clipboard.writeText(json).then(() => {
        alert('Level data copied to clipboard!');
    }).catch(() => {
        // Fallback
        prompt('Copy this level data:', json);
    });
}

function importLevel(jsonString) {
    try {
        const data = JSON.parse(jsonString);
        
        // Decompress
        editorLevelData = new Uint8Array(GAME_WIDTH * GAME_HEIGHT);
        let idx = 0;
        for (let i = 0; i < data.data.length; i += 2) {
            const val = data.data[i];
            const count = data.data[i + 1];
            for (let j = 0; j < count; j++) {
                editorLevelData[idx++] = val;
            }
        }
        
        editorEntrance = data.entrance || { x: 70, y: 20 };
        editorExit = data.exit || { x: 340, y: 78, w: 20, h: 12 };
        
        renderTerrainToOffscreen();
        return true;
    } catch (e) {
        console.error('Failed to import level:', e);
        return false;
    }
}

// Override renderTerrainToOffscreen for editor mode
const originalRenderTerrain = renderTerrainToOffscreen;

function renderTerrainForEditor() {
    if (editorMode && editorLevelData) {
        // Temporarily swap terrain data
        const temp = terrainData;
        terrainData = editorLevelData;
        originalRenderTerrain();
        
        // Draw entrance
        offCtx.fillStyle = '#2196F3';
        offCtx.fillRect(editorEntrance.x - 10, editorEntrance.y - 5, 20, 10);
        offCtx.fillStyle = '#000';
        offCtx.fillRect(editorEntrance.x - 8, editorEntrance.y - 3, 16, 6);
        
        // Draw exit
        offCtx.fillStyle = '#FF9800';
        offCtx.fillRect(editorExit.x, editorExit.y, editorExit.w, editorExit.h);
        offCtx.fillStyle = '#0f0';
        offCtx.fillRect(editorExit.x + editorExit.w/2 - 2, editorExit.y - 4, 4, 4);
        
        // Draw brush preview
        if (editorTool !== 'entrance' && editorTool !== 'exit') {
            const mx = Math.floor(mouseX);
            const my = Math.floor(mouseY);
            const half = Math.floor(editorBrushSize / 2);
            offCtx.strokeStyle = 'rgba(255,255,255,0.5)';
            offCtx.lineWidth = 1;
            offCtx.strokeRect(mx - half, my - half, editorBrushSize, editorBrushSize);
        }
        
        terrainData = temp;
    } else {
        originalRenderTerrain();
    }
}

// Export for global access
window.Editor = {
    enter: enterEditorMode,
    exit: exitEditorMode,
    import: importLevel,
    setTool: setEditorTool,
    isActive: () => editorMode
};