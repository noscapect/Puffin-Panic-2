
// --- Enhanced Level Editor ---

let editorMode = false;
let editorTool = 'terrain'; // terrain, erase, fill, line, rect, entrance, exit
let editorBrushSize = 1;
let editorLevelData = null;
let editorEntrance = { x: 70, y: 20 };
let editorExit = { x: 340, y: 78, w: 20, h: 12 };
let originalGameActive = false;
let showGrid = false;
let gridSize = 10;
let isDrawing = false;
let lastDrawX = -1, lastDrawY = -1;

// Undo/Redo system
let undoStack = [];
let redoStack = [];
const MAX_UNDO = 50;

// Shape drawing state
let shapeStart = null;

function saveUndoState() {
    undoStack.push(new Uint8Array(editorLevelData));
    if (undoStack.length > MAX_UNDO) {
        undoStack.shift();
    }
    redoStack = []; // Clear redo on new action
}

function undo() {
    if (undoStack.length === 0) return;
    redoStack.push(new Uint8Array(editorLevelData));
    editorLevelData = undoStack.pop();
    renderTerrainToOffscreen();
}

function redo() {
    if (redoStack.length === 0) return;
    undoStack.push(new Uint8Array(editorLevelData));
    editorLevelData = redoStack.pop();
    renderTerrainToOffscreen();
}

function enterEditorMode() {
    editorMode = true;
    originalGameActive = gameState.active;
    gameState.active = false;
    hideGameUI();
    
    undoStack = [];
    redoStack = [];
    isDrawing = false;
    shapeStart = null;
    
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
    
    // Save initial state
    saveUndoState();
    
    // Copy editor data to terrain for rendering
    for (let i = 0; i < GAME_WIDTH * GAME_HEIGHT; i++) {
        terrainData[i] = editorLevelData[i];
    }
    
    renderTerrainToOffscreen();
    showEditorUI();
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', editorKeyDown);
    
    // Start editor render loop
    editorLoop();
}

function editorKeyDown(e) {
    if (!editorMode) return;
    
    // Ctrl+Z for undo, Ctrl+Y for redo
    if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        undo();
        return;
    }
    if (e.ctrlKey && e.key === 'y') {
        e.preventDefault();
        redo();
        return;
    }
    
    // G for grid toggle
    if (e.key === 'g') {
        showGrid = !showGrid;
    }
    
    // Number keys for brush size
    if (e.key >= '1' && e.key <= '9') {
        editorBrushSize = parseInt(e.key);
        const slider = document.getElementById('brush-size');
        const val = document.getElementById('brush-size-val');
        if (slider) slider.value = editorBrushSize;
        if (val) val.innerText = editorBrushSize;
    }
}

function editorLoop() {
    if (!editorMode) return;
    
    // Copy editor data to terrain
    for (let i = 0; i < GAME_WIDTH * GAME_HEIGHT; i++) {
        terrainData[i] = editorLevelData[i];
    }
    
    // Draw the game view
    ctx.fillStyle = '#111a22';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(SCALE, SCALE);
    
    // Draw terrain
    ctx.drawImage(offscreenCanvas, 0, 0);
    
    // Draw grid if enabled
    if (showGrid) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 0.5;
        for (let x = 0; x < GAME_WIDTH; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, GAME_HEIGHT);
            ctx.stroke();
        }
        for (let y = 0; y < GAME_HEIGHT; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(GAME_WIDTH, y);
            ctx.stroke();
        }
    }
    
    // Draw entrance marker
    ctx.fillStyle = '#2196F3';
    ctx.fillRect(editorEntrance.x - 10, editorEntrance.y - 5, 20, 10);
    ctx.fillStyle = '#000';
    ctx.fillRect(editorEntrance.x - 8, editorEntrance.y - 3, 16, 6);
    ctx.fillStyle = '#fff';
    ctx.font = '6px monospace';
    ctx.fillText('IN', editorEntrance.x - 3, editorEntrance.y + 2);
    
    // Draw exit marker
    ctx.fillStyle = '#FF9800';
    ctx.fillRect(editorExit.x, editorExit.y, editorExit.w, editorExit.h);
    ctx.fillStyle = '#0f0';
    ctx.fillRect(editorExit.x + editorExit.w/2 - 2, editorExit.y - 4, 4, 4);
    ctx.fillStyle = '#fff';
    ctx.fillText('OUT', editorExit.x - 2, editorExit.y + editorExit.h + 8);
    
    // Draw shape preview
    if (shapeStart && (editorTool === 'line' || editorTool === 'rect')) {
        ctx.strokeStyle = 'rgba(255, 255, 0, 0.7)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        
        if (editorTool === 'line') {
            ctx.beginPath();
            ctx.moveTo(shapeStart.x, shapeStart.y);
            ctx.lineTo(mouseX, mouseY);
            ctx.stroke();
        } else if (editorTool === 'rect') {
            const w = mouseX - shapeStart.x;
            const h = mouseY - shapeStart.y;
            ctx.strokeRect(shapeStart.x, shapeStart.y, w, h);
        }
        ctx.setLineDash([]);
    }
    
    // Draw brush preview
    if (editorTool !== 'entrance' && editorTool !== 'exit' && editorTool !== 'line' && editorTool !== 'rect') {
        const half = Math.floor(editorBrushSize / 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 1;
        ctx.strokeRect(mouseX - half, mouseY - half, editorBrushSize, editorBrushSize);
    }
    
    // Draw terrain count info
    ctx.fillStyle = '#fff';
    ctx.font = '8px monospace';
    const terrainCount = Array.from(editorLevelData).filter(v => v === 1).length;
    const percentage = ((terrainCount / (GAME_WIDTH * GAME_HEIGHT)) * 100).toFixed(1);
    ctx.fillText(`Terrain: ${terrainCount} pixels (${percentage}%)`, 5, GAME_HEIGHT - 5);
    
    ctx.restore();
    
    requestAnimationFrame(editorLoop);
}

function exitEditorMode() {
    editorMode = false;
    gameState.active = originalGameActive;
    hideEditorUI();
    hideGameUI();
    
    // Remove keyboard shortcuts
    document.removeEventListener('keydown', editorKeyDown);
    
    // Return to start screen or game
    document.getElementById('start-overlay').style.display = 'flex';
}

function showEditorUI() {
    let html = `
    <div id="editor-overlay" style="position:fixed;top:0;left:0;width:100%;height:100%;background:transparent;z-index:50;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;overflow-y:auto;pointer-events:none;">
        <div style="pointer-events:auto;background:rgba(0,0,0,0.9);padding:20px;border-radius:10px;max-width:600px;width:90%;">
            <h2 style="color:#fff;margin-bottom:15px;font-size:clamp(18px,3vw,24px);text-align:center;">🛠️ Level Editor</h2>
            
            <!-- Tools Row 1: Drawing Tools -->
            <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;justify-content:center;">
                <button onclick="setEditorTool('terrain')" id="tool-terrain" class="editor-tool-btn" style="padding:8px 14px;font-family:inherit;background:#4CAF50;color:white;border:none;cursor:pointer;font-size:13px;">🪨 Terrain</button>
                <button onclick="setEditorTool('erase')" id="tool-erase" class="editor-tool-btn" style="padding:8px 14px;font-family:inherit;background:#f44336;color:white;border:none;cursor:pointer;font-size:13px;">🧹 Erase</button>
                <button onclick="setEditorTool('fill')" id="tool-fill" class="editor-tool-btn" style="padding:8px 14px;font-family:inherit;background:#9C27B0;color:white;border:none;cursor:pointer;font-size:13px;">🪣 Fill</button>
            </div>
            
            <!-- Tools Row 2: Shape Tools -->
            <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;justify-content:center;">
                <button onclick="setEditorTool('line')" id="tool-line" class="editor-tool-btn" style="padding:8px 14px;font-family:inherit;background:#795548;color:white;border:none;cursor:pointer;font-size:13px;">📏 Line</button>
                <button onclick="setEditorTool('rect')" id="tool-rect" class="editor-tool-btn" style="padding:8px 14px;font-family:inherit;background:#607D8B;color:white;border:none;cursor:pointer;font-size:13px;">⬜ Rectangle</button>
            </div>
            
            <!-- Tools Row 3: Placement Tools -->
            <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;justify-content:center;">
                <button onclick="setEditorTool('entrance')" id="tool-entrance" class="editor-tool-btn" style="padding:8px 14px;font-family:inherit;background:#2196F3;color:white;border:none;cursor:pointer;font-size:13px;">🚪 Entrance</button>
                <button onclick="setEditorTool('exit')" id="tool-exit" class="editor-tool-btn" style="padding:8px 14px;font-family:inherit;background:#FF9800;color:white;border:none;cursor:pointer;font-size:13px;">🏁 Exit</button>
            </div>
            
            <!-- Settings Row -->
            <div style="display:flex;gap:15px;align-items:center;margin-bottom:12px;flex-wrap:wrap;justify-content:center;">
                <div style="display:flex;gap:6px;align-items:center;">
                    <span style="color:#fff;font-size:12px;">Brush:</span>
                    <input type="range" id="brush-size" min="1" max="20" value="1" oninput="editorBrushSize=parseInt(this.value)" style="width:100px;">
                    <span id="brush-size-val" style="color:#5f5;font-size:12px;">1</span>
                </div>
                <div style="display:flex;gap:6px;align-items:center;">
                    <label style="color:#fff;font-size:12px;cursor:pointer;">
                        <input type="checkbox" id="grid-toggle" ${showGrid ? 'checked' : ''} onchange="showGrid=this.checked"> Grid
                    </label>
                </div>
            </div>
            
            <!-- Level Name -->
            <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;justify-content:center;">
                <span style="color:#fff;font-size:12px;">Name:</span>
                <input type="text" id="level-name" value="Custom Level" style="padding:5px 8px;font-family:inherit;background:#334;color:#fff;border:1px solid #556;font-size:12px;width:150px;">
            </div>
            
            <!-- Action Buttons -->
            <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;justify-content:center;">
                <button onclick="undo()" style="padding:8px 14px;font-family:inherit;background:#607D8B;color:white;border:none;cursor:pointer;font-size:13px;" title="Ctrl+Z">↩ Undo</button>
                <button onclick="redo()" style="padding:8px 14px;font-family:inherit;background:#607D8B;color:white;border:none;cursor:pointer;font-size:13px;" title="Ctrl+Y">↪ Redo</button>
                <button onclick="saveLevelToStorage()" style="padding:8px 14px;font-family:inherit;background:#4CAF50;color:white;border:none;cursor:pointer;font-size:13px;">💾 Save</button>
                <button onclick="loadLevelFromStorage()" style="padding:8px 14px;font-family:inherit;background:#2196F3;color:white;border:none;cursor:pointer;font-size:13px;">📂 Load</button>
            </div>
            
            <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;justify-content:center;">
                <button onclick="testLevel()" style="padding:8px 16px;font-family:inherit;background:#4CAF50;color:white;border:none;cursor:pointer;font-size:14px;font-weight:bold;">▶ Test Level</button>
                <button onclick="exportLevel()" style="padding:8px 14px;font-family:inherit;background:#2196F3;color:white;border:none;cursor:pointer;font-size:13px;">📋 Export</button>
                <button onclick="importLevelPrompt()" style="padding:8px 14px;font-family:inherit;background:#9C27B0;color:white;border:none;cursor:pointer;font-size:13px;">📥 Import</button>
                <button onclick="clearEditor()" style="padding:8px 14px;font-family:inherit;background:#f44336;color:white;border:none;cursor:pointer;font-size:13px;">🗑️ Clear</button>
                <button onclick="exitEditorMode()" style="padding:8px 14px;font-family:inherit;background:#666;color:white;border:none;cursor:pointer;font-size:13px;">✖ Close</button>
            </div>
            
            <!-- Instructions -->
            <div style="color:#888;margin-top:10px;font-size:11px;text-align:center;line-height:1.6;">
                Left-click: Draw | Right-click: Erase | Scroll: Brush size<br>
                Ctrl+Z: Undo | Ctrl+Y: Redo | G: Toggle Grid | 1-9: Brush size
            </div>
        </div>
    </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
    
    // Add editor click handler
    canvas.addEventListener('mousedown', editorMouseDown);
    canvas.addEventListener('mouseup', editorMouseUp);
    canvas.addEventListener('mousemove', editorMouseMove);
    canvas.addEventListener('wheel', editorWheelHandler);
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    
    // Set initial tool highlight
    setEditorTool('terrain');
}

function hideEditorUI() {
    const overlay = document.getElementById('editor-overlay');
    if (overlay) overlay.remove();
    canvas.removeEventListener('mousedown', editorMouseDown);
    canvas.removeEventListener('mouseup', editorMouseUp);
    canvas.removeEventListener('mousemove', editorMouseMove);
    canvas.removeEventListener('wheel', editorWheelHandler);
}

function setEditorTool(tool) {
    editorTool = tool;
    shapeStart = null;
    document.querySelectorAll('.editor-tool-btn').forEach(btn => {
        btn.style.border = 'none';
        btn.style.boxShadow = 'none';
        btn.style.transform = 'none';
    });
    const activeBtn = document.getElementById(`tool-${tool}`);
    if (activeBtn) {
        activeBtn.style.border = '2px solid #fff';
        activeBtn.style.boxShadow = '0 0 10px rgba(255,255,255,0.5)';
        activeBtn.style.transform = 'scale(1.05)';
    }
}

function getCanvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = GAME_WIDTH / rect.width;
    const scaleY = GAME_HEIGHT / rect.height;
    return {
        x: Math.floor((e.clientX - rect.left) * scaleX),
        y: Math.floor((e.clientY - rect.top) * scaleY)
    };
}

function editorMouseDown(e) {
    if (!editorMode) return;
    e.preventDefault();
    
    const coords = getCanvasCoords(e);
    
    // Right-click always erases
    if (e.button === 2) {
        saveUndoState();
        paintTerrain(coords.x, coords.y, false);
        isDrawing = true;
        lastDrawX = coords.x;
        lastDrawY = coords.y;
        return;
    }
    
    if (e.button !== 0) return;
    
    // Entrance/Exit placement
    if (editorTool === 'entrance') {
        saveUndoState();
        editorEntrance = { x: coords.x, y: coords.y };
        renderTerrainToOffscreen();
        return;
    }
    
    if (editorTool === 'exit') {
        saveUndoState();
        editorExit = { x: coords.x, y: coords.y, w: 20, h: 12 };
        renderTerrainToOffscreen();
        return;
    }
    
    // Fill tool
    if (editorTool === 'fill') {
        saveUndoState();
        floodFill(coords.x, coords.y, 1);
        renderTerrainToOffscreen();
        return;
    }
    
    // Shape tools - start drawing
    if (editorTool === 'line' || editorTool === 'rect') {
        saveUndoState();
        shapeStart = { x: coords.x, y: coords.y };
        return;
    }
    
    // Regular drawing
    saveUndoState();
    paintTerrain(coords.x, coords.y, true);
    isDrawing = true;
    lastDrawX = coords.x;
    lastDrawY = coords.y;
}

function editorMouseUp(e) {
    if (!editorMode) return;
    
    // Complete shape drawing
    if (shapeStart && (editorTool === 'line' || editorTool === 'rect')) {
        const coords = getCanvasCoords(e);
        drawShape(shapeStart.x, shapeStart.y, coords.x, coords.y, editorTool === 'line');
        shapeStart = null;
        renderTerrainToOffscreen();
    }
    
    isDrawing = false;
    lastDrawX = -1;
    lastDrawY = -1;
}

function editorMouseMove(e) {
    if (!editorMode) return;
    
    // Update mouse position for preview
    const coords = getCanvasCoords(e);
    mouseX = coords.x;
    mouseY = coords.y;
    
    // Continuous drawing while holding mouse
    if (isDrawing && (editorTool === 'terrain' || editorTool === 'erase')) {
        if (lastDrawX !== -1) {
            // Interpolate between last and current position for smooth drawing
            drawLine(lastDrawX, lastDrawY, coords.x, coords.y, editorTool === 'terrain');
        }
        lastDrawX = coords.x;
        lastDrawY = coords.y;
    }
}

function drawLine(x0, y0, x1, y1, add) {
    // Bresenham's line algorithm for smooth drawing
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    
    while (true) {
        paintTerrain(x0, y0, add);
        
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 > -dy) { err -= dy; x0 += sx; }
        if (e2 < dx) { err += dx; y0 += sy; }
    }
}

function drawShape(x0, y0, x1, y1, isLine) {
    if (isLine) {
        drawLine(x0, y0, x1, y1, true);
    } else {
        // Draw rectangle outline
        const minX = Math.min(x0, x1);
        const maxX = Math.max(x0, x1);
        const minY = Math.min(y0, y1);
        const maxY = Math.max(y0, y1);
        
        for (let x = minX; x <= maxX; x++) {
            setPixel(x, minY, 1);
            setPixel(x, maxY, 1);
        }
        for (let y = minY; y <= maxY; y++) {
            setPixel(minX, y, 1);
            setPixel(maxX, y, 1);
        }
    }
}

function setPixel(x, y, val) {
    if (x >= 0 && x < GAME_WIDTH && y >= 0 && y < GAME_HEIGHT) {
        editorLevelData[y * GAME_WIDTH + x] = val;
    }
}

function editorWheelHandler(e) {
    if (!editorMode) return;
    e.preventDefault();
    editorBrushSize = Math.max(1, Math.min(20, editorBrushSize + (e.deltaY > 0 ? -1 : 1)));
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
    renderTerrainToOffscreen();
}

function floodFill(startX, startY, newVal) {
    if (startX < 0 || startX >= GAME_WIDTH || startY < 0 || startY >= GAME_HEIGHT) return;
    
    const oldVal = editorLevelData[startY * GAME_WIDTH + startX];
    if (oldVal === newVal) return;
    
    const stack = [[startX, startY]];
    const visited = new Set();
    
    while (stack.length > 0) {
        const [x, y] = stack.pop();
        const key = `${x},${y}`;
        
        if (visited.has(key)) continue;
        if (x < 0 || x >= GAME_WIDTH || y < 0 || y >= GAME_HEIGHT) continue;
        if (editorLevelData[y * GAME_WIDTH + x] !== oldVal) continue;
        
        visited.add(key);
        editorLevelData[y * GAME_WIDTH + x] = newVal;
        
        stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    
    renderTerrainToOffscreen();
}

function clearEditor() {
    if (confirm('Clear all terrain?')) {
        saveUndoState();
        editorLevelData.fill(0);
        renderTerrainToOffscreen();
    }
}

const SAVED_LEVEL_INDEX_KEY = 'puffinLevels';
const SAVED_LEVEL_KEY_PREFIX = 'puffinLevel:';

function getSavedLevelNames() {
    try {
        const raw = localStorage.getItem(SAVED_LEVEL_INDEX_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter(n => typeof n === 'string' && n.trim()) : [];
    } catch (e) {
        return [];
    }
}

function setSavedLevelNames(names) {
    localStorage.setItem(SAVED_LEVEL_INDEX_KEY, JSON.stringify(names));
}

function getSavedLevelKey(name) {
    return SAVED_LEVEL_KEY_PREFIX + name;
}

function buildRuntimeLevelFromEditorData(levelName, data) {
    const compressed = Array.isArray(data.data) ? data.data : [];
    const entrance = data.entrance || { x: 70, y: 20 };
    const exit = data.exit || { x: 340, y: 78, w: 20, h: 12 };
    const theme = data.theme || 'rock';
    const skills = data.skills || { floater: 5, bomber: 3, blocker: 3, builder: 8, basher: 5, digger: 5, climber: 5, miner: 5, platformer: 0 };

    return {
        name: `[Custom] ${levelName}`,
        total: data.total || 20,
        required: data.required || 15,
        spawnRate: data.spawnRate || FPS * 2,
        time: data.time || 5 * 60 * FPS,
        entrance,
        exit,
        theme,
        skills,
        isSavedCustom: true,
        savedName: levelName,
        buildTerrain: function(runtimeData, gw, gh) {
            runtimeData.fill(0);
            let idx = 0;
            for (let i = 0; i < compressed.length; i += 2) {
                const val = compressed[i] || 0;
                const count = compressed[i + 1] || 0;
                for (let j = 0; j < count; j++) {
                    if (idx < runtimeData.length) runtimeData[idx++] = val;
                }
            }
        }
    };
}

function refreshDebugLevelSelect() {
    const levelSelect = document.getElementById('debug-level-select');
    if (!levelSelect) return;
    const previous = parseInt(levelSelect.value || '0', 10);
    levelSelect.innerHTML = '';
    LEVELS.forEach((lvl, index) => {
        const opt = document.createElement('option');
        opt.value = index;
        opt.innerText = lvl.name;
        levelSelect.appendChild(opt);
    });
    if (LEVELS.length > 0) {
        levelSelect.value = String(Math.max(0, Math.min(previous, LEVELS.length - 1)));
    }
}

function upsertSavedLevelInRuntime(levelName, levelData) {
    if (typeof LEVELS === 'undefined') return;
    const runtimeLevel = buildRuntimeLevelFromEditorData(levelName, levelData);
    const existingIndex = LEVELS.findIndex(l => l && l.isSavedCustom && l.savedName === levelName);
    if (existingIndex >= 0) {
        LEVELS[existingIndex] = runtimeLevel;
    } else {
        LEVELS.push(runtimeLevel);
    }
    refreshDebugLevelSelect();
}

function registerSavedLevelsIntoRuntime() {
    if (typeof LEVELS === 'undefined') return;

    // Migrate legacy single-save key if present.
    try {
        const legacy = localStorage.getItem('puffinLevel');
        if (legacy) {
            const legacyData = JSON.parse(legacy);
            const legacyName = (legacyData && legacyData.name) ? String(legacyData.name) : 'Legacy Map';
            localStorage.setItem(getSavedLevelKey(legacyName), JSON.stringify(legacyData));
            const names = getSavedLevelNames();
            if (!names.includes(legacyName)) {
                names.push(legacyName);
                setSavedLevelNames(names);
            }
            localStorage.removeItem('puffinLevel');
        }
    } catch (e) {
        // Ignore malformed legacy payloads.
    }

    const names = getSavedLevelNames();
    names.forEach(levelName => {
        try {
            const savedRaw = localStorage.getItem(getSavedLevelKey(levelName));
            if (!savedRaw) return;
            const levelData = JSON.parse(savedRaw);
            const already = LEVELS.some(l => l && l.isSavedCustom && l.savedName === levelName);
            if (!already) LEVELS.push(buildRuntimeLevelFromEditorData(levelName, levelData));
        } catch (e) {
            // Ignore broken saved entries and continue.
        }
    });
}

function saveLevelToStorage() {
    const levelData = exportLevelData();
    const nameInput = document.getElementById('level-name');
    const levelName = ((nameInput ? nameInput.value : '') || 'Custom Level').trim();
    levelData.name = levelName;
    levelData.theme = getCurrentThemeName();
    levelData.skills = { floater: 5, bomber: 3, blocker: 3, builder: 8, basher: 5, digger: 5, climber: 5, miner: 5, platformer: 0 };
    try {
        localStorage.setItem(getSavedLevelKey(levelName), JSON.stringify(levelData));
        const names = getSavedLevelNames();
        if (!names.includes(levelName)) {
            names.push(levelName);
            setSavedLevelNames(names);
        }
        upsertSavedLevelInRuntime(levelName, levelData);
        alert(`Level saved: ${levelName}`);
    } catch (e) {
        alert('Failed to save level.');
    }
}

function loadLevelFromStorage() {
    try {
        const names = getSavedLevelNames();
        if (names.length === 0) {
            alert('No saved level found.');
            return;
        }

        const requested = prompt(`Load which map?\n${names.map((n, i) => `${i + 1}. ${n}`).join('\n')}`, names[names.length - 1]);
        if (requested === null) return;

        let selectedName = requested.trim();
        if (!selectedName) selectedName = names[names.length - 1];
        if (/^\d+$/.test(selectedName)) {
            const idx = parseInt(selectedName, 10) - 1;
            if (idx >= 0 && idx < names.length) selectedName = names[idx];
        }
        if (!names.includes(selectedName)) {
            alert('Saved map not found.');
            return;
        }

        const saved = localStorage.getItem(getSavedLevelKey(selectedName));
        if (!saved) {
            alert('Saved map data missing.');
            return;
        }

        const data = JSON.parse(saved);
        importLevelData(data);
        const nameInput = document.getElementById('level-name');
        if (nameInput) nameInput.value = selectedName;
        alert(`Level loaded: ${selectedName}`);
    } catch (e) {
        alert('Failed to load level.');
    }
}

function importLevelPrompt() {
    const json = prompt('Paste level data to import:');
    if (json) {
        importLevel(json);
    }
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

function importLevelData(data) {
    editorLevelData = new Uint8Array(GAME_WIDTH * GAME_HEIGHT);
    let idx = 0;
    for (let i = 0; i < data.data.length; i += 2) {
        const val = data.data[i];
        const count = data.data[i + 1];
        for (let j = 0; j < count; j++) {
            if (idx < editorLevelData.length) {
                editorLevelData[idx++] = val;
            }
        }
    }
    
    editorEntrance = data.entrance || { x: 70, y: 20 };
    editorExit = data.exit || { x: 340, y: 78, w: 20, h: 12 };
    
    undoStack = [];
    redoStack = [];
    saveUndoState();
    
    renderTerrainToOffscreen();
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
        importLevelData(data);
        alert('Level imported successfully!');
        return true;
    } catch (e) {
        console.error('Failed to import level:', e);
        alert('Failed to import level. Invalid data.');
        return false;
    }
}

function testLevel() {
    // Save current editor state
    const levelDataCopy = new Uint8Array(editorLevelData);
    const entranceCopy = { ...editorEntrance };
    const exitCopy = { ...editorExit };
    const levelName = document.getElementById('level-name') ? document.getElementById('level-name').value : 'Custom Level';
    
    exitEditorMode();
    
    // Create a custom level that uses the editor data
    const customLevel = {
        name: levelName,
        total: 20,
        required: 15,
        spawnRate: FPS * 2,
        time: 5 * 60 * FPS,
        entrance: entranceCopy,
        exit: exitCopy,
        skills: { floater: 5, bomber: 3, blocker: 3, builder: 8, basher: 5, digger: 5, climber: 5, miner: 5, platformer: 5 },
        buildTerrain: function(data, gw, gh) {
            // Copy the saved editor data
            for (let i = 0; i < levelDataCopy.length; i++) {
                data[i] = levelDataCopy[i];
            }
        },
        isCustom: true
    };
    
    // Temporarily add as a level
    const tempIndex = LEVELS.length;
    LEVELS.push(customLevel);
    
    // Store reference for cleanup
    window._customLevelIndex = tempIndex;
    window._customLevelCleanup = function() {
        if (window._customLevelIndex !== null && LEVELS[window._customLevelIndex] && LEVELS[window._customLevelIndex].isCustom) {
            LEVELS.splice(window._customLevelIndex, 1);
        }
        window._customLevelIndex = null;
        window._customLevelCleanup = null;
    };
    
    loadLevel(tempIndex);
}

// Editor-specific terrain rendering with entrance/exit markers
function renderTerrainForEditor() {
    if (editorMode && editorLevelData) {
        // Temporarily swap terrain data for rendering
        const temp = terrainData;
        terrainData = editorLevelData;
        
        // Use the core rendering function
        if (!terrainImgData) terrainImgData = new ImageData(GAME_WIDTH, GAME_HEIGHT);
        terrainImgData = _renderTerrainCore(terrainImgData, terrainImgData, offCtx);
        
        // Draw entrance marker on offscreen canvas
        offCtx.fillStyle = '#2196F3';
        offCtx.fillRect(editorEntrance.x - 10, editorEntrance.y - 5, 20, 10);
        offCtx.fillStyle = '#000';
        offCtx.fillRect(editorEntrance.x - 8, editorEntrance.y - 3, 16, 6);
        offCtx.fillStyle = '#fff';
        offCtx.font = '6px monospace';
        offCtx.fillText('IN', editorEntrance.x - 3, editorEntrance.y + 2);
        
        // Draw exit marker on offscreen canvas
        offCtx.fillStyle = '#FF9800';
        offCtx.fillRect(editorExit.x, editorExit.y, editorExit.w, editorExit.h);
        offCtx.fillStyle = '#0f0';
        offCtx.fillRect(editorExit.x + editorExit.w/2 - 2, editorExit.y - 4, 4, 4);
        offCtx.fillStyle = '#fff';
        offCtx.font = '6px monospace';
        offCtx.fillText('OUT', editorExit.x - 2, editorExit.y + editorExit.h + 8);
        
        // Restore original terrain data
        terrainData = temp;
    }
}

// Export for global access
window.Editor = {
    enter: enterEditorMode,
    exit: exitEditorMode,
    import: importLevel,
    setTool: setEditorTool,
    isActive: () => editorMode,
    undo: undo,
    redo: redo
};

// Load custom saved maps into LEVELS on startup so they appear in level select.
registerSavedLevelsIntoRuntime();