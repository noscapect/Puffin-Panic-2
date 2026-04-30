// =============================================================
// Puffins Panic! — Level Editor v2
// Touch-first (pointer events), predefined asset stamps,
// tabbed mobile UI, always starts on a blank canvas.
// =============================================================

// ─── Predefined Asset Library ────────────────────────────────
// Each asset defines its pixel dimensions and a build() function
// that returns a flat Uint8Array (row-major, 1 = solid, 0 = empty).

function _buildRect(w, h) {
    return new Uint8Array(w * h).fill(1);
}

function _buildOutlineRect(w, h) {
    const buf = new Uint8Array(w * h);
    for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++)
            if (x === 0 || x === w - 1 || y === 0 || y === h - 1)
                buf[y * w + x] = 1;
    return buf;
}

function _buildStairRight(w, h) {
    const buf = new Uint8Array(w * h);
    const steps = 8;
    const stepW = Math.max(1, Math.round(w / steps));
    const stepH = Math.max(1, Math.round(h / steps));
    for (let col = 0; col < w; col++) {
        const step = Math.floor(col / stepW);
        const topY = h - (step + 1) * stepH;
        for (let y = Math.max(0, topY); y < h; y++)
            buf[y * w + col] = 1;
    }
    return buf;
}

function _buildStairLeft(w, h) {
    const right = _buildStairRight(w, h);
    const buf = new Uint8Array(w * h);
    for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++)
            buf[y * w + x] = right[y * w + (w - 1 - x)];
    return buf;
}

function _buildArch(w, h) {
    const buf = new Uint8Array(w * h);
    const wallW = Math.max(3, Math.round(w * 0.1));
    const archThick = Math.max(2, Math.round(h * 0.15));
    // Left and right legs (lower half)
    for (let y = Math.round(h * 0.4); y < h; y++) {
        for (let x = 0; x < wallW; x++) buf[y * w + x] = 1;
        for (let x = w - wallW; x < w; x++) buf[y * w + x] = 1;
    }
    // Arch crown (thick rounded top)
    const cx = w / 2, cy = h * 0.45;
    const rx = (w - wallW * 2) / 2, ry = h * 0.45;
    for (let y = 0; y < Math.round(h * 0.5); y++) {
        for (let x = 0; x < w; x++) {
            const dx = (x - cx) / rx, dy = (y - cy) / ry;
            const d = dx * dx + dy * dy;
            if (d <= 1.0 && d >= (1 - archThick / Math.max(rx, ry)) ** 2)
                buf[y * w + x] = 1;
        }
    }
    return buf;
}

function _buildPillar(w, h) {
    const buf = new Uint8Array(w * h);
    const capH = Math.max(2, Math.round(h * 0.08));
    const shaftW = Math.max(2, Math.round(w * 0.5));
    const shaftX = Math.floor((w - shaftW) / 2);
    // Cap and base (full width)
    for (let y = 0; y < capH; y++)
        for (let x = 0; x < w; x++) buf[y * w + x] = 1;
    for (let y = h - capH; y < h; y++)
        for (let x = 0; x < w; x++) buf[y * w + x] = 1;
    // Shaft
    for (let y = capH; y < h - capH; y++)
        for (let x = shaftX; x < shaftX + shaftW; x++) buf[y * w + x] = 1;
    return buf;
}

function _buildRampRight(w, h) {
    const buf = new Uint8Array(w * h);
    for (let x = 0; x < w; x++) {
        const topY = Math.round(h - 1 - (x / (w - 1)) * (h - 1));
        for (let y = topY; y < h; y++) buf[y * w + x] = 1;
    }
    return buf;
}

function _buildRampLeft(w, h) {
    const right = _buildRampRight(w, h);
    const buf = new Uint8Array(w * h);
    for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++)
            buf[y * w + x] = right[y * w + (w - 1 - x)];
    return buf;
}

function _buildBridge(w, h) {
    const buf = new Uint8Array(w * h);
    const deckH = Math.max(2, Math.round(h * 0.4));
    const postW = Math.max(2, Math.round(w * 0.06));
    // Deck
    for (let y = 0; y < deckH; y++)
        for (let x = 0; x < w; x++) buf[y * w + x] = 1;
    // Hanging posts
    const numPosts = 4;
    for (let i = 0; i <= numPosts; i++) {
        const px = Math.round((i / numPosts) * (w - postW));
        for (let y = deckH; y < h; y++)
            for (let x = px; x < px + postW && x < w; x++) buf[y * w + x] = 1;
    }
    return buf;
}

const EDITOR_ASSETS = [
    { id: 'platform_s',  label: 'Platform S',   w: 32,  h: 4,  build: () => _buildRect(32, 4) },
    { id: 'platform_l',  label: 'Platform L',   w: 64,  h: 4,  build: () => _buildRect(64, 4) },
    { id: 'floor',       label: 'Thick Floor',  w: 48,  h: 10, build: () => _buildRect(48, 10) },
    { id: 'wall_s',      label: 'Wall S',       w: 4,   h: 30, build: () => _buildRect(4, 30) },
    { id: 'wall_l',      label: 'Wall L',       w: 4,   h: 60, build: () => _buildRect(4, 60) },
    { id: 'wall_w',      label: 'Wall Wide',    w: 10,  h: 40, build: () => _buildRect(10, 40) },
    { id: 'block',       label: 'Block',        w: 20,  h: 20, build: () => _buildRect(20, 20) },
    { id: 'frame',       label: 'Frame',        w: 24,  h: 20, build: () => _buildOutlineRect(24, 20) },
    { id: 'stair_r',     label: 'Stair →',      w: 40,  h: 40, build: () => _buildStairRight(40, 40) },
    { id: 'stair_l',     label: 'Stair ←',      w: 40,  h: 40, build: () => _buildStairLeft(40, 40) },
    { id: 'ramp_r',      label: 'Ramp →',       w: 40,  h: 24, build: () => _buildRampRight(40, 24) },
    { id: 'ramp_l',      label: 'Ramp ←',       w: 40,  h: 24, build: () => _buildRampLeft(40, 24) },
    { id: 'arch',        label: 'Arch',         w: 44,  h: 32, build: () => _buildArch(44, 32) },
    { id: 'pillar',      label: 'Pillar',       w: 12,  h: 50, build: () => _buildPillar(12, 50) },
    { id: 'bridge',      label: 'Bridge',       w: 60,  h: 16, build: () => _buildBridge(60, 16) },
];

// Pixel cache per asset id
const _assetCache = {};
function _getAssetPixels(assetId) {
    if (!_assetCache[assetId]) {
        const def = EDITOR_ASSETS.find(a => a.id === assetId);
        if (!def) return null;
        _assetCache[assetId] = def.build();
    }
    return _assetCache[assetId];
}

// ─── Editor State ─────────────────────────────────────────────
let editorMode = false;
let _edTool   = 'pencil';   // pencil | eraser | rect | line | fill | entrance | exit | asset-place | asset-move
let _edTab    = 'draw';     // draw | objects | setup | file
let _edBrush  = 4;
let _edGrid   = false;
let _edActiveAsset = null;  // assetId currently selected for placement
let _edGhost  = null;       // { assetId, x, y } — ghost following pointer
let _edMoving = null;       // { inst, offX, offY } — asset being dragged to new spot

let _edBase   = null;       // Uint8Array — free-drawn terrain pixels
let _edPlacements = [];     // [{ uid, assetId, x, y }]
let _edNextUid = 1;
let editorLevelData = null; // composite view buffer (base + stamps)

let editorEntrance = { x: 30, y: 40 };
let editorExit     = { x: 340, y: 150, w: 20, h: 12 };

let _edSettings = {
    name: 'My Level',
    total: 20,
    required: 15,
    spawnRate: 75,
    time: 9600,
    theme: 'grass',
    skills: { climber: 5, floater: 5, bomber: 3, blocker: 3, builder: 5, basher: 5, miner: 5, digger: 5 }
};

let _edDrawing = false;
let _edLastX = -1, _edLastY = -1;
let _edShapeStart = null;
let _edSolverResult = null; // { solvable, reachable, expiry }

const SAVED_LEVEL_INDEX_KEY = 'puffinLevels';
const SAVED_LEVEL_KEY_PREFIX = 'puffinLevel:';
const MAX_UNDO = 40;
let _edUndo = [], _edRedo = [];
let _edImported = false; // true when this session loaded a shared (exported) map

// ─── Undo / Redo ─────────────────────────────────────────────
function _edSaveUndo() {
    _edUndo.push({
        base:      new Uint8Array(_edBase),
        placements: JSON.stringify(_edPlacements),
        entrance:  { ...editorEntrance },
        exit:      { ...editorExit },
    });
    if (_edUndo.length > MAX_UNDO) _edUndo.shift();
    _edRedo = [];
}

function _edApply(state) {
    _edBase.set(state.base);
    _edPlacements = JSON.parse(state.placements);
    editorEntrance = { ...state.entrance };
    editorExit     = { ...state.exit };
    _edRecompute();
}

function editorUndo() {
    if (!_edUndo.length) return;
    _edRedo.push({ base: new Uint8Array(_edBase), placements: JSON.stringify(_edPlacements), entrance: { ...editorEntrance }, exit: { ...editorExit } });
    _edApply(_edUndo.pop());
}

function editorRedo() {
    if (!_edRedo.length) return;
    _edUndo.push({ base: new Uint8Array(_edBase), placements: JSON.stringify(_edPlacements), entrance: { ...editorEntrance }, exit: { ...editorExit } });
    _edApply(_edRedo.pop());
}

// ─── Terrain Computation ─────────────────────────────────────
function _edRecompute() {
    // Composite: base + all placed stamps
    editorLevelData.set(_edBase);
    for (const inst of _edPlacements) {
        _edStamp(inst.assetId, inst.x, inst.y, editorLevelData);
    }
    // Sync rendering
    for (let i = 0; i < GAME_WIDTH * GAME_HEIGHT; i++) terrainData[i] = editorLevelData[i];
    renderTerrainToOffscreen();
}

function _edStamp(assetId, ax, ay, target) {
    const def = EDITOR_ASSETS.find(a => a.id === assetId);
    if (!def) return;
    const pix = _getAssetPixels(assetId);
    for (let dy = 0; dy < def.h; dy++) {
        for (let dx = 0; dx < def.w; dx++) {
            if (!pix[dy * def.w + dx]) continue;
            const tx = ax + dx, ty = ay + dy;
            if (tx >= 0 && tx < GAME_WIDTH && ty >= 0 && ty < GAME_HEIGHT)
                target[ty * GAME_WIDTH + tx] = 1;
        }
    }
}

// ─── Entry / Exit ─────────────────────────────────────────────
function openLevelEditor() { enterEditorMode(); }

function enterEditorMode() {
    editorMode = true;
    gameState.active = false;
    document.getElementById('start-overlay').style.display = 'none';
    hideGameUI();

    // Blank canvas always
    _edBase        = new Uint8Array(GAME_WIDTH * GAME_HEIGHT);
    editorLevelData = new Uint8Array(GAME_WIDTH * GAME_HEIGHT);
    _edPlacements  = [];
    _edMoving      = null;
    _edGhost       = null;
    _edActiveAsset = null;
    _edTool        = 'pencil';
    _edTab         = 'draw';
    _edDrawing     = false;
    _edLastX       = _edLastY = -1;
    _edShapeStart  = null;
    _edUndo        = [];
    _edRedo        = [];
    _edSolverResult = null;
    _edImported    = false;
    editorEntrance = { x: 30, y: 40 };
    editorExit     = { x: 340, y: 150, w: 20, h: 12 };
    _edSettings = {
        name: 'My Level', total: 20, required: 15,
        spawnRate: 75, time: 9600, theme: 'grass',
        skills: { climber: 5, floater: 5, bomber: 3, blocker: 3, builder: 5, basher: 5, miner: 5, digger: 5 }
    };

    _edSaveUndo();
    _edRecompute();
    _edBuildUI();
    document.addEventListener('keydown', _edKeyDown);
    requestAnimationFrame(_edLoop);
}

function exitEditorMode() {
    editorMode = false;
    _edDestroyUI();
    document.removeEventListener('keydown', _edKeyDown);
    document.getElementById('start-overlay').style.display = 'flex';
}

// ─── Keyboard Shortcuts ───────────────────────────────────────
function _edKeyDown(e) {
    if (!editorMode) return;
    if (e.ctrlKey && e.key === 'z') { e.preventDefault(); editorUndo(); return; }
    if (e.ctrlKey && e.key === 'y') { e.preventDefault(); editorRedo(); return; }
    if (e.key === 'g') { _edGrid = !_edGrid; return; }
    if (e.key === 'Escape') {
        _edGhost = null; _edActiveAsset = null;
        _edMoving = null; _edTool = 'pencil'; _edRefreshToolUI();
    }
}

// ─── Render Loop ─────────────────────────────────────────────
function _edLoop() {
    if (!editorMode) return;

    const dpr  = window._canvasDPR || 1;
    const drawW = canvas.width  / dpr;
    const drawH = canvas.height / dpr;

    ctx.fillStyle = '#0e1520';
    ctx.fillRect(0, 0, drawW, drawH);

    ctx.save();
    ctx.scale(SCALE, SCALE);

    // Terrain
    ctx.drawImage(offscreenCanvas, 0, 0);

    // Grid
    if (_edGrid) {
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 0.5;
        for (let x = 0; x < GAME_WIDTH; x += 10) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, GAME_HEIGHT); ctx.stroke();
        }
        for (let y = 0; y < GAME_HEIGHT; y += 10) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(GAME_WIDTH, y); ctx.stroke();
        }
    }

    // Placed asset outlines
    for (const inst of _edPlacements) {
        const def = EDITOR_ASSETS.find(a => a.id === inst.assetId);
        if (!def) continue;
        const isSelected = _edMoving && _edMoving.inst.uid === inst.uid;
        ctx.strokeStyle = isSelected ? 'rgba(255,200,0,0.9)' : 'rgba(80,180,255,0.4)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(inst.x + 0.25, inst.y + 0.25, def.w - 0.5, def.h - 0.5);
    }

    // Ghost preview while placing
    if (_edGhost) {
        const def = EDITOR_ASSETS.find(a => a.id === _edGhost.assetId);
        if (def) {
            ctx.fillStyle = 'rgba(255,255,160,0.3)';
            ctx.fillRect(_edGhost.x, _edGhost.y, def.w, def.h);
            ctx.strokeStyle = 'rgba(255,255,0,0.85)';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(_edGhost.x + 0.25, _edGhost.y + 0.25, def.w - 0.5, def.h - 0.5);
        }
    }

    // Shape preview
    if (_edShapeStart) {
        ctx.strokeStyle = 'rgba(255,255,0,0.7)';
        ctx.lineWidth = 0.5;
        ctx.setLineDash([2, 2]);
        const gx = mouseX, gy = mouseY;
        if (_edTool === 'line') {
            ctx.beginPath(); ctx.moveTo(_edShapeStart.x, _edShapeStart.y); ctx.lineTo(gx, gy); ctx.stroke();
        } else {
            ctx.strokeRect(_edShapeStart.x, _edShapeStart.y, gx - _edShapeStart.x, gy - _edShapeStart.y);
        }
        ctx.setLineDash([]);
    }

    // Entrance marker
    ctx.fillStyle = '#1565C0';
    ctx.fillRect(editorEntrance.x - 12, editorEntrance.y - 3, 24, 8);
    ctx.fillStyle = '#fff';
    ctx.font = '5px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('IN', editorEntrance.x, editorEntrance.y + 3);

    // Exit marker
    ctx.fillStyle = '#E65100';
    ctx.fillRect(editorExit.x, editorExit.y, editorExit.w, editorExit.h);
    ctx.fillStyle = '#fff';
    ctx.fillText('OUT', editorExit.x + editorExit.w / 2, editorExit.y + editorExit.h / 2 + 2);
    ctx.textAlign = 'left';

    // Tool cursor (pencil / eraser)
    if (_edTool === 'pencil' || _edTool === 'eraser') {
        const half = Math.ceil(_edBrush / 2);
        ctx.strokeStyle = _edTool === 'eraser' ? 'rgba(255,80,80,0.85)' : 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(mouseX - half, mouseY - half, _edBrush, _edBrush);
    }

    // Solver reachability overlay
    if (_edSolverResult && _edSolverResult.reachable && Date.now() < _edSolverResult.expiry) {
        const r = _edSolverResult;
        // Batch-draw reachable pixels as a thin semi-transparent plane
        const imgd = ctx.createImageData(GAME_WIDTH, GAME_HEIGHT);
        const col  = r.solvable ? [0, 220, 100] : [255, 80, 60];
        for (let i = 0; i < r.reachable.length; i++) {
            if (!r.reachable[i]) continue;
            const base = i * 4;
            imgd.data[base]     = col[0];
            imgd.data[base + 1] = col[1];
            imgd.data[base + 2] = col[2];
            imgd.data[base + 3] = 70;
        }
        ctx.putImageData(imgd, 0, 0);
        // Pulse the exit zone if solvable
        if (r.solvable) {
            const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 200);
            ctx.strokeStyle = `rgba(0,255,120,${0.5 + 0.4 * pulse})`;
            ctx.lineWidth = 1;
            ctx.strokeRect(editorExit.x - 1, editorExit.y - 1, editorExit.w + 2, editorExit.h + 2);
        }
    } else if (_edSolverResult && Date.now() >= _edSolverResult.expiry) {
        _edSolverResult = null;
    }

    ctx.restore();
    requestAnimationFrame(_edLoop);
}

// ─── Coordinate Helper ────────────────────────────────────────
function _edToGame(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: Math.floor((clientX - rect.left) * (GAME_WIDTH  / rect.width)),
        y: Math.floor((clientY - rect.top)  * (GAME_HEIGHT / rect.height)),
    };
}

// ─── Pointer Handlers ─────────────────────────────────────────
function _edPointerDown(e) {
    if (!editorMode) return;
    e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}

    const g = _edToGame(e.clientX, e.clientY);
    mouseX = g.x; mouseY = g.y;

    if (_edTool === 'entrance') {
        _edSaveUndo();
        editorEntrance = { x: g.x, y: g.y };
        return;
    }
    if (_edTool === 'exit') {
        _edSaveUndo();
        editorExit = { x: g.x - 10, y: g.y - 6, w: 20, h: 12 };
        return;
    }
    if (_edTool === 'asset-place' && _edActiveAsset) {
        const def = EDITOR_ASSETS.find(a => a.id === _edActiveAsset);
        if (def) _edGhost = { assetId: _edActiveAsset, x: g.x - (def.w >> 1), y: g.y - (def.h >> 1) };
        return;
    }
    if (_edTool === 'asset-move') {
        const hit = _edFindAsset(g.x, g.y);
        if (hit) { _edSaveUndo(); _edMoving = { inst: hit, offX: g.x - hit.x, offY: g.y - hit.y }; }
        return;
    }
    if (_edTool === 'fill') {
        _edSaveUndo();
        _edFloodFill(g.x, g.y, 1);
        _edRecompute();
        return;
    }
    if (_edTool === 'line' || _edTool === 'rect') {
        _edSaveUndo();
        _edShapeStart = { x: g.x, y: g.y };
        return;
    }
    // pencil / eraser
    _edSaveUndo();
    _edDrawing = true;
    _edLastX = g.x; _edLastY = g.y;
    _edPaintAt(g.x, g.y);
    _edRecompute();
}

function _edPointerMove(e) {
    if (!editorMode) return;
    const g = _edToGame(e.clientX, e.clientY);
    mouseX = g.x; mouseY = g.y;

    if (_edTool === 'asset-place' && _edGhost) {
        const def = EDITOR_ASSETS.find(a => a.id === _edGhost.assetId);
        if (def) { _edGhost.x = g.x - (def.w >> 1); _edGhost.y = g.y - (def.h >> 1); }
        return;
    }
    if (_edMoving) {
        _edMoving.inst.x = g.x - _edMoving.offX;
        _edMoving.inst.y = g.y - _edMoving.offY;
        _edRecompute();
        return;
    }
    if (_edDrawing && (_edTool === 'pencil' || _edTool === 'eraser')) {
        if (_edLastX >= 0) _edDrawLine(_edLastX, _edLastY, g.x, g.y);
        _edLastX = g.x; _edLastY = g.y;
        _edRecompute();
    }
}

function _edPointerUp(e) {
    if (!editorMode) return;
    const g = _edToGame(e.clientX, e.clientY);

    if (_edTool === 'asset-place' && _edGhost) {
        _edSaveUndo();
        _edPlacements.push({ uid: _edNextUid++, assetId: _edGhost.assetId, x: _edGhost.x, y: _edGhost.y });
        _edGhost = null;
        _edRecompute();
        return;
    }
    if (_edMoving) {
        _edMoving = null;
        _edRecompute();
        return;
    }
    if (_edShapeStart && (_edTool === 'line' || _edTool === 'rect')) {
        if (_edTool === 'line') _edDrawLine(_edShapeStart.x, _edShapeStart.y, g.x, g.y);
        else                    _edFillRect(_edShapeStart.x, _edShapeStart.y, g.x, g.y);
        _edShapeStart = null;
        _edRecompute();
        return;
    }
    if (_edDrawing) {
        _edDrawing = false;
        _edLastX = _edLastY = -1;
        _edRecompute();
    }
}

function _edWheel(e) {
    if (!editorMode) return;
    e.preventDefault();
    _edBrush = Math.max(1, Math.min(20, _edBrush + (e.deltaY > 0 ? -1 : 1)));
    const sl = document.getElementById('ed-brush-slider');
    const vl = document.getElementById('ed-brush-val');
    if (sl) sl.value = _edBrush;
    if (vl) vl.innerText = _edBrush;
}

// ─── Drawing Primitives ───────────────────────────────────────
function _edPaintAt(x, y) {
    if (_edTool === 'eraser') {
        _edEraseAt(x, y);
    } else {
        const half = Math.ceil(_edBrush / 2);
        for (let dy = -half; dy < _edBrush - half; dy++)
            for (let dx = -half; dx < _edBrush - half; dx++)
                _edSetBase(x + dx, y + dy, 1);
    }
}

function _edEraseAt(x, y) {
    // Remove placed assets whose bounding box overlaps the brush
    const half = Math.ceil(_edBrush / 2);
    _edPlacements = _edPlacements.filter(inst => {
        const def = EDITOR_ASSETS.find(a => a.id === inst.assetId);
        if (!def) return true;
        const overlap =
            x + half >= inst.x && x - half <= inst.x + def.w &&
            y + half >= inst.y && y - half <= inst.y + def.h;
        return !overlap;
    });
    // Erase base terrain pixels
    for (let dy = -half; dy < _edBrush - half; dy++)
        for (let dx = -half; dx < _edBrush - half; dx++)
            _edSetBase(x + dx, y + dy, 0);
}

function _edSetBase(x, y, v) {
    if (x >= 0 && x < GAME_WIDTH && y >= 0 && y < GAME_HEIGHT)
        _edBase[y * GAME_WIDTH + x] = v;
}

function _edDrawLine(x0, y0, x1, y1) {
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    while (true) {
        _edPaintAt(x0, y0);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 > -dy) { err -= dy; x0 += sx; }
        if (e2 <  dx) { err += dx; y0 += sy; }
    }
}

function _edFillRect(x0, y0, x1, y1) {
    const minX = Math.min(x0, x1), maxX = Math.max(x0, x1);
    const minY = Math.min(y0, y1), maxY = Math.max(y0, y1);
    for (let x = minX; x <= maxX; x++) { _edSetBase(x, minY, 1); _edSetBase(x, maxY, 1); }
    for (let y = minY; y <= maxY; y++) { _edSetBase(minX, y, 1); _edSetBase(maxX, y, 1); }
}

function _edFloodFill(sx, sy, newVal) {
    if (sx < 0 || sx >= GAME_WIDTH || sy < 0 || sy >= GAME_HEIGHT) return;
    const oldVal = _edBase[sy * GAME_WIDTH + sx];
    if (oldVal === newVal) return;
    const vis = new Uint8Array(GAME_WIDTH * GAME_HEIGHT);
    const stack = [[sx, sy]];
    while (stack.length) {
        const [x, y] = stack.pop();
        if (x < 0 || x >= GAME_WIDTH || y < 0 || y >= GAME_HEIGHT) continue;
        const idx = y * GAME_WIDTH + x;
        if (vis[idx] || _edBase[idx] !== oldVal) continue;
        vis[idx] = 1;
        _edBase[idx] = newVal;
        stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
}

function _edFindAsset(gx, gy) {
    for (let i = _edPlacements.length - 1; i >= 0; i--) {
        const inst = _edPlacements[i];
        const def  = EDITOR_ASSETS.find(a => a.id === inst.assetId);
        if (!def) continue;
        if (gx >= inst.x && gx < inst.x + def.w && gy >= inst.y && gy < inst.y + def.h) return inst;
    }
    return null;
}

// ─── UI Construction ──────────────────────────────────────────
function _b(bg, bdr) {
    return `background:${bg};color:#fff;border:1px solid ${bdr};border-radius:5px;padding:10px 14px;font-family:inherit;font-size:13px;cursor:pointer;touch-action:manipulation;`;
}

function _edBuildUI() {
    const tabDefs = [
        { id: 'draw',    icon: '✏️', label: 'Draw'    },
        { id: 'objects', icon: '🧱', label: 'Objects'  },
        { id: 'setup',   icon: '⚙️', label: 'Setup'   },
        { id: 'file',    icon: '💾', label: 'File'    },
    ];

    const html = `
<div id="ed-overlay" style="
    position:fixed;top:0;left:0;width:100%;height:100%;z-index:50;
    display:flex;flex-direction:column;pointer-events:none;
    font-family:inherit;box-sizing:border-box;
">
    <!-- Header (pointer-events: auto) -->
    <div style="
        pointer-events:auto;
        background:rgba(8,12,20,0.94);
        border-bottom:1px solid #1e3050;
        display:flex;align-items:center;justify-content:space-between;
        padding:6px 14px;gap:10px;flex-shrink:0;
    ">
        <span style="color:#5af;font-weight:bold;font-size:15px;">🛠️ Level Editor</span>
        <div style="display:flex;gap:8px;">
            <button onclick="_edAutoTest()" style="${_b('#1a3a4a','#2a7a9a')}min-width:80px;">🤖 Analyse</button>
            <button onclick="testLevel()" style="${_b('#1a4a1a','#3a8a3a')}min-width:70px;">▶ Test</button>
            <button onclick="exitEditorMode()" style="${_b('#2a2a2a','#555')}">✖ Close</button>
        </div>
    </div>

    <!-- Canvas pass-through zone -->
    <div style="flex:1;min-height:0;"></div>

    <!-- Bottom panel (pointer-events: auto) -->
    <div style="pointer-events:auto;flex-shrink:0;">

        <!-- Tab bar -->
        <div id="ed-tab-bar" style="
            background:rgba(8,12,20,0.97);
            border-top:2px solid #1e3050;
            display:flex;
        ">
            ${tabDefs.map(t => `
            <button id="ed-tab-${t.id}" onclick="_edSwitchTab('${t.id}')" style="
                flex:1;padding:10px 6px 8px;font-size:12px;font-family:inherit;
                background:transparent;color:#667;
                border:none;border-top:2px solid transparent;
                cursor:pointer;touch-action:manipulation;
                transition:color 0.15s;
            ">${t.icon}<br>${t.label}</button>
            `).join('')}
        </div>

        <!-- Tab panel -->
        <div id="ed-panel" style="
            background:rgba(8,12,20,0.99);
            border-top:1px solid #1a2840;
            padding:12px 14px;
            max-height:36vh;overflow-y:auto;
            -webkit-overflow-scrolling:touch;
        ">
            ${_edPanelHTML('draw')}
        </div>
    </div>
</div>`;

    document.body.insertAdjacentHTML('beforeend', html);
    _edActivateTab('draw');

    canvas.addEventListener('pointerdown',   _edPointerDown);
    canvas.addEventListener('pointermove',   _edPointerMove);
    canvas.addEventListener('pointerup',     _edPointerUp);
    canvas.addEventListener('pointercancel', _edPointerUp);
    canvas.addEventListener('contextmenu',   e => e.preventDefault());
    canvas.addEventListener('wheel',         _edWheel, { passive: false });
}

function _edDestroyUI() {
    const ov = document.getElementById('ed-overlay');
    if (ov) ov.remove();
    canvas.removeEventListener('pointerdown',   _edPointerDown);
    canvas.removeEventListener('pointermove',   _edPointerMove);
    canvas.removeEventListener('pointerup',     _edPointerUp);
    canvas.removeEventListener('pointercancel', _edPointerUp);
    canvas.removeEventListener('wheel',         _edWheel);
}

function _edSwitchTab(tab) {
    _edTab = tab;
    _edActivateTab(tab);
    const panel = document.getElementById('ed-panel');
    if (panel) panel.innerHTML = _edPanelHTML(tab);
    if (tab === 'objects') { _edRenderThumbnails(); _edRefreshToolUI(); }
    if (tab !== 'objects') {
        // Cancel asset placement when leaving objects tab
        _edGhost = null;
        if (_edTool === 'asset-place' || _edTool === 'asset-move') {
            _edActiveAsset = null; _edTool = 'pencil';
        }
    }
    if (tab === 'draw') _edRefreshToolUI();
}

function _edActivateTab(active) {
    ['draw', 'objects', 'setup', 'file'].forEach(t => {
        const btn = document.getElementById(`ed-tab-${t}`);
        if (!btn) return;
        const on = t === active;
        btn.style.color      = on ? '#5af' : '#667';
        btn.style.background = on ? '#0d1f35' : 'transparent';
        btn.style.borderTop  = `2px solid ${on ? '#4af' : 'transparent'}`;
    });
}

// ─── Panel HTML Builders ─────────────────────────────────────

function _edPanelHTML(tab) {
    if (tab === 'draw')    return _edDrawPanel();
    if (tab === 'objects') return _edObjectsPanel();
    if (tab === 'setup')   return _edSetupPanel();
    if (tab === 'file')    return _edFilePanel();
    return '';
}

// ── Draw tab ──
function _edDrawPanel() {
    const tools = [
        { id: 'pencil', label: '✏️ Draw'   },
        { id: 'eraser', label: '⌫ Erase'  },
        { id: 'rect',   label: '⬜ Rect'   },
        { id: 'line',   label: '📏 Line'   },
        { id: 'fill',   label: '🪣 Fill'   },
    ];
    return `
<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;">
    ${tools.map(t => `
    <button id="ed-drawbtn-${t.id}" onclick="_edPickDrawTool('${t.id}')" style="
        ${_b('#111e2e','#2a4060')}min-width:80px;min-height:48px;font-size:14px;
    ">${t.label}</button>
    `).join('')}
</div>
<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
    <label style="color:#889;font-size:12px;white-space:nowrap;">Brush size</label>
    <input id="ed-brush-slider" type="range" min="1" max="20" value="${_edBrush}"
        oninput="_edBrush=parseInt(this.value);document.getElementById('ed-brush-val').innerText=this.value"
        style="width:120px;accent-color:#4af;flex-shrink:0;">
    <span id="ed-brush-val" style="color:#4af;font-size:13px;min-width:24px;">${_edBrush}</span>
    <label style="color:#889;font-size:12px;cursor:pointer;display:flex;align-items:center;gap:5px;">
        <input type="checkbox" ${_edGrid ? 'checked' : ''} onchange="_edGrid=this.checked">
        Grid
    </label>
</div>
<div style="color:#445;font-size:11px;margin-top:8px;">
    Scroll / pinch canvas to adjust brush · Right-click = erase · Ctrl+Z/Y = undo/redo
</div>`;
}

function _edPickDrawTool(tool) {
    _edTool = tool;
    _edActiveAsset = null; _edGhost = null; _edMoving = null;
    _edRefreshToolUI();
}

function _edRefreshToolUI() {
    // Draw buttons
    ['pencil','eraser','rect','line','fill'].forEach(id => {
        const btn = document.getElementById(`ed-drawbtn-${id}`);
        if (!btn) return;
        const on = _edTool === id;
        btn.style.background  = on ? '#0d3055' : '#111e2e';
        btn.style.borderColor = on ? '#4af'    : '#2a4060';
    });
    // Asset buttons
    EDITOR_ASSETS.forEach(a => {
        const btn = document.getElementById(`ed-abtn-${a.id}`);
        if (!btn) return;
        const on = _edActiveAsset === a.id;
        btn.style.background  = on ? '#0a3520' : '#111e2e';
        btn.style.borderColor = on ? '#3b8'    : '#2a4060';
    });
    // Move button
    const mv = document.getElementById('ed-abtn-move');
    if (mv) {
        const on = _edTool === 'asset-move';
        mv.style.background  = on ? '#332800' : '#111e2e';
        mv.style.borderColor = on ? '#ba0'    : '#2a4060';
    }
}

// ── Objects tab ──
function _edObjectsPanel() {
    return `
<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap;">
    <button id="ed-abtn-move" onclick="_edPickMoveTool()" style="
        ${_b('#111e2e','#2a4060')}min-height:48px;min-width:120px;
    ">↖️ Move Object</button>
    <span style="color:#445;font-size:11px;">Tap canvas to pick &amp; drag placed objects</span>
</div>
<div style="display:flex;flex-wrap:wrap;gap:8px;">
    ${EDITOR_ASSETS.map(a => `
    <button id="ed-abtn-${a.id}" onclick="_edPickAsset('${a.id}')" style="
        ${_b('#111e2e','#2a4060')}
        min-width:80px;min-height:68px;
        display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;
        font-size:11px;
    ">
        <canvas id="ed-thumb-${a.id}" width="52" height="36"
            style="image-rendering:pixelated;background:#080f18;border-radius:3px;"></canvas>
        <span>${a.label}</span>
    </button>
    `).join('')}
</div>`;
}

function _edRenderThumbnails() {
    EDITOR_ASSETS.forEach(a => {
        const tc = document.getElementById(`ed-thumb-${a.id}`);
        if (!tc) return;
        const tctx = tc.getContext('2d');
        const pix  = _getAssetPixels(a.id);
        const tw = tc.width, th = tc.height;
        tctx.clearRect(0, 0, tw, th);
        const s  = Math.min((tw * 0.92) / a.w, (th * 0.92) / a.h);
        const ox = Math.floor((tw - a.w * s) / 2);
        const oy = Math.floor((th - a.h * s) / 2);
        tctx.fillStyle = '#5bbfdc';
        for (let py = 0; py < a.h; py++)
            for (let px = 0; px < a.w; px++)
                if (pix[py * a.w + px])
                    tctx.fillRect(ox + px * s, oy + py * s, Math.max(1, s), Math.max(1, s));
    });
    _edRefreshToolUI();
}

function _edPickAsset(id) {
    _edActiveAsset = id;
    _edTool = 'asset-place';
    _edMoving = null;
    _edRefreshToolUI();
}

function _edPickMoveTool() {
    _edTool = 'asset-move';
    _edActiveAsset = null; _edGhost = null;
    _edRefreshToolUI();
}

// ── Setup tab ──
function _edSetupPanel() {
    const THEMES = [
        'grass','desert','snow','rock','ice','lava','crystal','water',
        'cliff_chalk','slate_ledge','frozen_mud','packed_snow','black_ice',
        'volcanic_ash','obsidian_floor','salt_flats','wet_cave_stone',
        'rusty_metal','wood_planks','mossy_ruin','crystal_dense',
        'fungus_glow','toxic_sludge','sandstone','deep_sea','iron_ore',
        'coral','amber','bone_white','cave','mud','mossy',
    ];
    const row = (label, el) => `
        <label style="color:#889;font-size:12px;display:flex;flex-direction:column;gap:3px;">
            ${label} ${el}
        </label>`;
    const num = (key, val, min, max) =>
        `<input type="number" value="${val}" min="${min}" max="${max}"
            oninput="_edSettings.${key}=parseInt(this.value)||${val}"
            style="padding:6px 8px;background:#0d1a28;color:#dde;border:1px solid #2a4060;border-radius:4px;font-size:12px;font-family:inherit;width:100%;box-sizing:border-box;">`;
    const _esc = s => String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const inp = (key, val) =>
        `<input type="text" value="${_esc(val)}"
            oninput="_edSettings.${key}=this.value"
            style="padding:6px 8px;background:#0d1a28;color:#dde;border:1px solid #2a4060;border-radius:4px;font-size:12px;font-family:inherit;width:100%;box-sizing:border-box;">`;

    const themeOpts = THEMES.map(t => `<option value="${t}" ${_edSettings.theme === t ? 'selected' : ''}>${t}</option>`).join('');

    return `
<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;">
    <button onclick="_edPickEntrance()" style="${_b('#0a2a5a','#29f')}min-height:48px;">🚪 Place Entrance</button>
    <button onclick="_edPickExit()"     style="${_b('#4a1a00','#f62')}min-height:48px;">🏁 Place Exit</button>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 14px;margin-bottom:12px;">
    ${row('Level Name', inp('name', _edSettings.name))}
    <label style="color:#889;font-size:12px;display:flex;flex-direction:column;gap:3px;">Theme
        <select onchange="_edSettings.theme=this.value"
            style="padding:6px 8px;background:#0d1a28;color:#dde;border:1px solid #2a4060;border-radius:4px;font-size:12px;font-family:inherit;">
            ${themeOpts}
        </select>
    </label>
    ${row('Total Puffins', num('total', _edSettings.total, 1, 100))}
    ${row('Save Required', num('required', _edSettings.required, 1, 100))}
    ${row('Spawn Rate (ticks)', num('spawnRate', _edSettings.spawnRate, 1, 180))}
    ${row('Time Limit (ticks)', num('time', _edSettings.time, 600, 36000))}
</div>
<div style="color:#889;font-size:12px;margin-bottom:6px;">Skill counts</div>
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;">
    ${Object.entries(_edSettings.skills).map(([sk, cv]) => `
        <label style="color:#889;font-size:11px;display:flex;flex-direction:column;gap:3px;">
            ${sk}
            <input type="number" value="${cv}" min="0" max="99"
                oninput="_edSettings.skills['${sk}']=parseInt(this.value)||0"
                style="padding:5px 6px;background:#0d1a28;color:#dde;border:1px solid #2a4060;border-radius:4px;font-size:11px;font-family:inherit;width:100%;box-sizing:border-box;">
        </label>
    `).join('')}
</div>`;
}

function _edPickEntrance() { _edTool = 'entrance'; _edActiveAsset = null; _edGhost = null; }
function _edPickExit()     { _edTool = 'exit';     _edActiveAsset = null; _edGhost = null; }

// ── File tab ──
function _edFilePanel() {
    return `
<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px;">
    <button onclick="editorUndo()" style="${_b('#111e2e','#2a4060')}min-height:48px;">↩ Undo</button>
    <button onclick="editorRedo()" style="${_b('#111e2e','#2a4060')}min-height:48px;">↪ Redo</button>
    <button onclick="_edClearAll()" style="${_b('#2a0a0a','#844')}min-height:48px;">🗑️ Clear All</button>
</div>
<div style="display:flex;flex-wrap:wrap;gap:8px;">
    <button onclick="saveLevelToStorage()"  style="${_b('#0a2a0a','#3a7')}min-height:48px;">💾 Save</button>
    <button onclick="loadLevelFromStorage()" style="${_b('#0a1a3a','#37a')}min-height:48px;">📂 Load</button>
    <button onclick="exportLevel()"         style="${_b('#0a1a3a','#37a')}min-height:48px;">📋 Export</button>
    <button onclick="importLevelPrompt()"   style="${_b('#1a0a2a','#67a')}min-height:48px;">📥 Import</button>
    <button onclick="_edImportFile()"       style="${_b('#1a0a2a','#67a')}min-height:48px;">📁 File Import</button>
</div>
<div style="color:#445;font-size:11px;margin-top:10px;">
    Export copies JSON to clipboard. Import pastes it back in. Share your map as text! Or use File Import to load a JSON file.
</div>`;
}

function _edClearAll() {
    if (!confirm('Clear all terrain and placed objects?')) return;
    _edSaveUndo();
    _edBase.fill(0);
    _edPlacements = [];
    _edSolverResult = null;
    _edRecompute();
}

// ─── Export / Import ─────────────────────────────────────────
function exportLevelData() {
    // Bake base + placed assets into one buffer
    const baked = new Uint8Array(GAME_WIDTH * GAME_HEIGHT);
    baked.set(_edBase);
    for (const inst of _edPlacements) _edStamp(inst.assetId, inst.x, inst.y, baked);

    // RLE compress
    const data = [];
    let cur = baked[0], cnt = 1;
    for (let i = 1; i < baked.length; i++) {
        if (baked[i] === cur && cnt < 255) { cnt++; }
        else { data.push(cur, cnt); cur = baked[i]; cnt = 1; }
    }
    data.push(cur, cnt);

    return {
        version:  1,
        width:    GAME_WIDTH,
        height:   GAME_HEIGHT,
        name:     _edSettings.name,
        total:    _edSettings.total,
        required: _edSettings.required,
        spawnRate: _edSettings.spawnRate,
        time:     _edSettings.time,
        theme:    _edSettings.theme,
        skills:   { ..._edSettings.skills },
        entrance: { ...editorEntrance },
        exit:     { ...editorExit },
        data,
        // Preserve asset layout so the level can be re-edited
        placements: _edPlacements.map(p => ({ assetId: p.assetId, x: p.x, y: p.y })),
        // Flag marks this JSON as a shared export — AI solver is disabled on import
        shared: true,
    };
}

function exportLevel() {
    const json = JSON.stringify(exportLevelData());
    navigator.clipboard.writeText(json)
        .then(() => alert('Level copied to clipboard!'))
        .catch(() => prompt('Copy this level data:', json));
}

function importLevelData(data) {
    _edBase        = new Uint8Array(GAME_WIDTH * GAME_HEIGHT);
    editorLevelData = new Uint8Array(GAME_WIDTH * GAME_HEIGHT);

    // Decompress RLE
    let idx = 0;
    const src = data.data || [];
    for (let i = 0; i < src.length - 1; i += 2) {
        const val = src[i], cnt = src[i + 1];
        for (let j = 0; j < cnt && idx < _edBase.length; j++) _edBase[idx++] = val;
    }

    editorEntrance = data.entrance || { x: 30, y: 40 };
    editorExit     = data.exit     || { x: 340, y: 150, w: 20, h: 12 };

    // Restore named assets if present
    _edPlacements = [];
    (data.placements || data.assets || []).forEach(p => {
        if (EDITOR_ASSETS.find(a => a.id === p.assetId))
            _edPlacements.push({ uid: _edNextUid++, assetId: p.assetId, x: p.x, y: p.y });
    });

    // Level settings
    if (data.name)     _edSettings.name     = data.name;
    if (data.total)    _edSettings.total    = data.total;
    if (data.required) _edSettings.required = data.required;
    if (data.spawnRate) _edSettings.spawnRate = data.spawnRate;
    if (data.time)     _edSettings.time     = data.time;
    if (data.theme)    _edSettings.theme    = data.theme;
    if (data.skills)   _edSettings.skills   = { ..._edSettings.skills, ...data.skills };
    if (window.TerrainImage) window.TerrainImage.load(data.imageSource || null);

    // Lock solver if this JSON was exported/shared by another player
    _edImported = data.shared === true;

    _edUndo = []; _edRedo = [];
    _edSaveUndo();
    _edRecompute();

    // Refresh setup panel if open
    if (_edTab === 'setup') {
        const panel = document.getElementById('ed-panel');
        if (panel) panel.innerHTML = _edPanelHTML('setup');
    }
}

function importLevel(jsonString) {
    try {
        importLevelData(JSON.parse(jsonString));
        alert('Level imported!');
        return true;
    } catch (e) {
        alert('Failed to import — invalid JSON.');
        return false;
    }
}

function importLevelPrompt() {
    const json = prompt('Paste level JSON to import:');
    if (json) importLevel(json);
}

function _edImportFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => importLevel(ev.target.result);
        reader.readAsText(file);
    };
    input.click();
}

// ─── Test Level ───────────────────────────────────────────────
function testLevel() {
    // Snapshot baked terrain
    const baked = new Uint8Array(GAME_WIDTH * GAME_HEIGHT);
    baked.set(_edBase);
    for (const inst of _edPlacements) _edStamp(inst.assetId, inst.x, inst.y, baked);

    const entrance = { ...editorEntrance };
    const exit     = { ...editorExit };
    const s        = { ..._edSettings, skills: { ..._edSettings.skills } };

    exitEditorMode();

    const customLevel = {
        name:      s.name || 'Custom Level',
        total:     s.total,
        required:  s.required,
        spawnRate: s.spawnRate,
        time:      s.time,
        theme:     s.theme,
        entrance, exit,
        skills:    s.skills,
        buildTerrain: (data) => { for (let i = 0; i < baked.length; i++) data[i] = baked[i]; },
        isCustom:  true,
    };

    window._customLevelCleanup = () => {
        if (window._customLevelIndex != null && LEVELS[window._customLevelIndex]?.isCustom)
            LEVELS.splice(window._customLevelIndex, 1);
        window._customLevelIndex = null;
        window._customLevelCleanup = null;
    };
    window._customLevelIndex = LEVELS.length;
    LEVELS.push(customLevel);
    loadLevel(window._customLevelIndex);
}

// ─── localStorage Save / Load ─────────────────────────────────
function getSavedLevelNames() {
    try {
        const raw = localStorage.getItem(SAVED_LEVEL_INDEX_KEY);
        if (!raw) return [];
        const p = JSON.parse(raw);
        return Array.isArray(p) ? p.filter(n => typeof n === 'string' && n.trim()) : [];
    } catch { return []; }
}

function setSavedLevelNames(names) {
    localStorage.setItem(SAVED_LEVEL_INDEX_KEY, JSON.stringify(names));
}

function getSavedLevelKey(name) { return SAVED_LEVEL_KEY_PREFIX + name; }

function saveLevelToStorage() {
    const data = exportLevelData();
    const name = (_edSettings.name || 'Custom Level').trim();
    data.name  = name;
    try {
        localStorage.setItem(getSavedLevelKey(name), JSON.stringify(data));
        const names = getSavedLevelNames();
        if (!names.includes(name)) { names.push(name); setSavedLevelNames(names); }
        upsertSavedLevelInRuntime(name, data);
        alert(`Saved: ${name}`);
    } catch { alert('Save failed — storage may be full.'); }
}

function loadLevelFromStorage() {
    const names = getSavedLevelNames();
    if (!names.length) { alert('No saved levels found.'); return; }
    const req = prompt(`Load which map?\n${names.map((n, i) => `${i + 1}. ${n}`).join('\n')}`, names[names.length - 1]);
    if (req === null) return;
    let sel = req.trim();
    if (/^\d+$/.test(sel)) {
        const idx = parseInt(sel, 10) - 1;
        if (idx >= 0 && idx < names.length) sel = names[idx];
    }
    if (!names.includes(sel)) { alert('Map not found.'); return; }
    try {
        importLevelData(JSON.parse(localStorage.getItem(getSavedLevelKey(sel)) || '{}'));
        _edSettings.name = sel;
        alert(`Loaded: ${sel}`);
    } catch { alert('Load failed.'); }
}

// ─── Runtime Level Registration ───────────────────────────────
function buildRuntimeLevelFromEditorData(levelName, data) {
    const compressed = Array.isArray(data.data) ? data.data : [];
    const entrance   = data.entrance || { x: 30, y: 40 };
    const exit       = data.exit     || { x: 340, y: 150, w: 20, h: 12 };
    const theme      = data.theme    || 'grass';
    const skills     = data.skills   || { climber:5, floater:5, bomber:3, blocker:3, builder:5, basher:5, miner:5, digger:5 };
    return {
        name:      `[Custom] ${levelName}`,
        total:     data.total     || 20,
        required:  data.required  || 10,
        spawnRate: data.spawnRate || 60,
        time:      data.time      || 9600,
        entrance, exit, theme, skills,
        isSavedCustom: true,
        savedName: levelName,
        buildTerrain: (runtimeData) => {
            runtimeData.fill(0);
            let idx = 0;
            for (let i = 0; i < compressed.length - 1; i += 2) {
                const val = compressed[i] || 0, cnt = compressed[i + 1] || 0;
                for (let j = 0; j < cnt; j++) { if (idx < runtimeData.length) runtimeData[idx++] = val; }
            }
        },
    };
}

function refreshDebugLevelSelect() {
    const sel = document.getElementById('debug-level-select');
    if (!sel) return;
    const prev = parseInt(sel.value || '0', 10);
    sel.innerHTML = '';
    LEVELS.forEach((lvl, i) => {
        const opt = document.createElement('option');
        opt.value = i; opt.innerText = lvl.name;
        sel.appendChild(opt);
    });
    if (LEVELS.length) sel.value = String(Math.max(0, Math.min(prev, LEVELS.length - 1)));
}

function upsertSavedLevelInRuntime(levelName, levelData) {
    if (typeof LEVELS === 'undefined') return;
    const rl = buildRuntimeLevelFromEditorData(levelName, levelData);
    const ei = LEVELS.findIndex(l => l?.isSavedCustom && l.savedName === levelName);
    if (ei >= 0) LEVELS[ei] = rl; else LEVELS.push(rl);
    refreshDebugLevelSelect();
}

function registerSavedLevelsIntoRuntime() {
    if (typeof LEVELS === 'undefined') return;
    // Migrate legacy single-key format
    try {
        const legacy = localStorage.getItem('puffinLevel');
        if (legacy) {
            const ld = JSON.parse(legacy);
            const ln = ld?.name ? String(ld.name) : 'Legacy Map';
            localStorage.setItem(getSavedLevelKey(ln), JSON.stringify(ld));
            const ns = getSavedLevelNames();
            if (!ns.includes(ln)) { ns.push(ln); setSavedLevelNames(ns); }
            localStorage.removeItem('puffinLevel');
        }
    } catch {}

    getSavedLevelNames().forEach(levelName => {
        try {
            const raw = localStorage.getItem(getSavedLevelKey(levelName));
            if (!raw) return;
            const ld = JSON.parse(raw);
            if (!LEVELS.some(l => l?.isSavedCustom && l.savedName === levelName))
                LEVELS.push(buildRuntimeLevelFromEditorData(levelName, ld));
        } catch {}
    });
}

// ─── Auto-Solver / Reachability Analysis ─────────────────────
// Runs a BFS physics simulation to determine if puffins can reach
// the exit using only the skills configured for this level.
// Results are drawn as a coloured overlay for 6 seconds.

function _edAutoTest() {
    if (_edImported) {
        const old = document.getElementById('ed-solver-banner');
        if (old) old.remove();
        const ban = document.createElement('div');
        ban.id = 'ed-solver-banner';
        Object.assign(ban.style, {
            position:'fixed', top:'60px', left:'50%', transform:'translateX(-50%)',
            zIndex:'200', background:'rgba(30,15,0,0.97)', border:'2px solid #a60',
            borderRadius:'10px', padding:'16px 22px', color:'#fff', fontFamily:'inherit',
            fontSize:'14px', maxWidth:'420px', width:'90%',
            boxShadow:'0 0 24px rgba(200,100,0,0.4)', textAlign:'center',
            lineHeight:'1.6', pointerEvents:'auto',
        });
        ban.innerHTML = `
            <div style="font-size:20px;margin-bottom:6px;">🔒 Solver Disabled</div>
            <div style="font-size:13px;color:#ca8;">The AI solver cannot be used on imported maps to prevent cheating.</div>
            <button onclick="document.getElementById('ed-solver-banner').remove()"
                style="margin-top:12px;padding:6px 18px;background:#1a2a3a;border:1px solid #456;
                       border-radius:5px;color:#fff;font-family:inherit;cursor:pointer;
                       font-size:13px;touch-action:manipulation;">OK</button>
        `;
        document.body.appendChild(ban);
        setTimeout(() => { if (ban.parentNode) ban.remove(); }, 4000);
        return;
    }
    _edSolverResult = null; // clear previous

    const W = GAME_WIDTH, H = GAME_HEIGHT;
    const FALL_DEATH = 70; // from constants.js

    // ── Bake terrain ──────────────────────────────────────────
    const terrain = new Uint8Array(W * H);
    terrain.set(_edBase);
    for (const inst of _edPlacements) _edStamp(inst.assetId, inst.x, inst.y, terrain);

    const sk        = _edSettings.skills;
    const hasFloater = (sk.floater || 0) > 0;
    const hasClimber = (sk.climber || 0) > 0;
    const hasBasher  = (sk.basher  || 0) > 0 || (sk.bomber || 0) > 0;
    const hasBuilder = (sk.builder || 0) > 0;
    const hasDigger  = (sk.digger  || 0) > 0;
    const hasMiner   = (sk.miner   || 0) > 0;

    const solid = (x, y) => {
        if (x < 0 || x >= W || y < 0) return true;
        if (y >= H) return false; // puffins fall off bottom
        return terrain[y * W + x] !== 0;
    };
    const empty = (x, y) => !solid(x, y);
    const inBounds = (x, y) => x >= 0 && x < W && y >= 0 && y < H;

    // ── BFS ───────────────────────────────────────────────────
    const reach = new Uint8Array(W * H);
    const queue = new Int16Array(W * H * 2); // flat [x,y,x,y,...]
    let qHead = 0, qTail = 0;

    const enq = (x, y) => {
        if (!inBounds(x, y)) return;
        if (solid(x, y)) return;
        if (reach[y * W + x]) return;
        reach[y * W + x] = 1;
        queue[qTail++] = x;
        queue[qTail++] = y;
    };

    // Drop puffin from entrance to find landing position
    let lx = Math.max(0, Math.min(W - 1, Math.round(editorEntrance.x)));
    let ly = Math.max(0, Math.min(H - 1, Math.round(editorEntrance.y)));
    while (ly > 0 && solid(lx, ly)) ly--;         // clear solid spawn
    let fallDist = 0;
    while (ly + 1 < H && empty(lx, ly + 1)) { ly++; fallDist++; }
    if (fallDist <= FALL_DEATH || hasFloater) enq(lx, ly);

    while (qHead < qTail) {
        const x = queue[qHead++];
        const y = queue[qHead++];

        const grounded = solid(x, y + 1) || y + 1 >= H;

        if (!grounded) {
            // Falling — propagate down
            enq(x, y + 1);
            // Climber grabs nearby wall while airborne
            if (hasClimber) {
                for (const ddx of [-1, 1]) {
                    if (solid(x + ddx, y)) {
                        // Climb upward pixel by pixel
                        let cy = y;
                        while (cy > 0 && empty(x, cy - 1) && (solid(x + ddx, cy) || solid(x + ddx, cy - 1))) {
                            enq(x, cy); cy--;
                        }
                        enq(x, cy);
                    }
                }
            }
            continue;
        }

        // ── On ground ──────────────────────────────────────────
        for (const dx of [-1, 1]) {
            const nx = x + dx;

            if (empty(nx, y)) {
                if (solid(nx, y + 1) || y + 1 >= H) {
                    enq(nx, y); // flat ground
                } else {
                    // Gap — fall
                    let fy = y, fd = 0;
                    while (fy + 1 < H && empty(nx, fy + 1)) { fy++; fd++; }
                    if (fd <= FALL_DEATH || hasFloater) enq(nx, fy);
                }
            } else {
                // Wall ahead
                // Step up 1 pixel (natural terrain slope)
                if (empty(nx, y - 1) && empty(x, y - 1)) enq(nx, y - 1);

                // Basher / Bomber: punch through walls
                if (hasBasher) {
                    let bx = nx, bc = 0;
                    while (inBounds(bx, y) && solid(bx, y) && bc < 30) { bx += dx; bc++; }
                    if (bc > 0 && inBounds(bx, y) && empty(bx, y)) {
                        if (solid(bx, y + 1) || y + 1 >= H) {
                            enq(bx, y);
                        } else {
                            let fy = y, fd = 0;
                            while (fy + 1 < H && empty(bx, fy + 1)) { fy++; fd++; }
                            if (fd <= FALL_DEATH || hasFloater) enq(bx, fy);
                        }
                    }
                }
            }

            // Climber: from ground, scale an adjacent wall upward
            if (hasClimber && solid(nx, y)) {
                let cy = y;
                while (cy > 0 && empty(x, cy - 1) && (solid(nx, cy) || solid(nx, cy - 1))) {
                    enq(x, cy); cy--;
                }
                enq(x, cy);
            }
        }

        // Builder: bridge open gaps (treats each skill use as unlimited here)
        if (hasBuilder) {
            for (const dx of [-1, 1]) {
                let bx = x + dx, gap = 0;
                while (inBounds(bx, y) && empty(bx, y) && empty(bx, y + 1) && gap < 14) { bx += dx; gap++; }
                if (gap > 0 && gap < 14 && inBounds(bx, y)) enq(bx, y);
            }
        }

        // Digger: dig straight down through solid terrain
        if (hasDigger) {
            let dy2 = y + 1, dc = 0;
            while (dy2 < H && solid(x, dy2) && dc < 40) { dy2++; dc++; }
            if (dc > 0 && dy2 < H) enq(x, dy2);
        }

        // Miner: dig diagonally downward
        if (hasMiner) {
            for (const dx of [-1, 1]) {
                let mx = x + dx, my = y + 1, mc = 0;
                while (inBounds(mx, my) && mc < 30) {
                    if (empty(mx, my)) { enq(mx, my); break; }
                    mx += dx; my++; mc++;
                }
            }
        }
    }

    // ── Check exit reachability ───────────────────────────────
    const ex = Math.round(editorExit.x);
    const ey = Math.round(editorExit.y);
    const ew = editorExit.w || 20;
    const eh = editorExit.h || 12;

    let exitFound = false;
    outer: for (let dy = -16; dy <= eh + 2; dy++) {
        for (let ddx = 0; ddx < ew; ddx++) {
            const gx2 = ex + ddx, gy2 = ey + dy;
            if (inBounds(gx2, gy2) && reach[gy2 * W + gx2]) { exitFound = true; break outer; }
        }
    }

    // Count reachable cells for info
    let reachCount = 0;
    for (let i = 0; i < reach.length; i++) if (reach[i]) reachCount++;

    // ── Build skill hint ─────────────────────────────────────
    const skillNames = [];
    if (hasFloater) skillNames.push('Floater');
    if (hasClimber) skillNames.push('Climber');
    if (hasBasher)  skillNames.push('Basher/Bomber');
    if (hasBuilder) skillNames.push('Builder');
    if (hasDigger)  skillNames.push('Digger');
    if (hasMiner)   skillNames.push('Miner');

    // ── Show result banner ───────────────────────────────────
    const old = document.getElementById('ed-solver-banner');
    if (old) old.remove();

    const banner = document.createElement('div');
    banner.id = 'ed-solver-banner';
    const ok = exitFound;
    Object.assign(banner.style, {
        position: 'fixed',
        top: '60px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: '200',
        background: ok ? 'rgba(0,50,20,0.97)' : 'rgba(50,10,10,0.97)',
        border: `2px solid ${ok ? '#2f9' : '#f44'}`,
        borderRadius: '10px',
        padding: '16px 22px',
        color: '#fff',
        fontFamily: 'inherit',
        fontSize: '14px',
        maxWidth: '420px',
        width: '90%',
        boxShadow: `0 0 24px ${ok ? 'rgba(0,200,100,0.4)' : 'rgba(255,60,60,0.4)'}`,
        textAlign: 'center',
        lineHeight: '1.6',
        pointerEvents: 'auto',
    });

    const reached_pct = ((reachCount / (W * H)) * 100).toFixed(1);
    let hint = '';
    if (!ok) {
        // Suggest what might help
        const missing = [];
        if (!hasBasher && !hasDigger) missing.push('Basher or Digger (to break through walls)');
        if (!hasBuilder) missing.push('Builder (to bridge gaps)');
        if (!hasClimber) missing.push('Climber (to scale walls)');
        if (!hasFloater) missing.push('Floater (to survive drops > 70px)');
        if (reachCount < 5) missing.unshift('an Entrance position that isn\'t buried in solid terrain');
        if (missing.length) hint = `<div style="font-size:12px;color:#fc8;margin-top:6px;">Try adding: ${missing.slice(0, 2).join(', ')}</div>`;
    }

    const usedSkills = skillNames.length ? `<div style="font-size:11px;color:#89b;margin-top:4px;">Skills considered: ${skillNames.join(', ')}</div>` : `<div style="font-size:11px;color:#89b;margin-top:4px;">No skills available</div>`;

    banner.innerHTML = `
        <div style="font-size:20px;margin-bottom:6px;">${ok ? '✅ Level is Solvable!' : '❌ No Valid Path Found'}</div>
        <div style="font-size:13px;color:#aac;">${reachCount} cells reachable (${reached_pct}% of map)</div>
        ${usedSkills}
        ${hint}
        <button onclick="document.getElementById('ed-solver-banner').remove();_edSolverResult=null;"
            style="margin-top:12px;padding:6px 18px;background:#1a2a3a;border:1px solid #456;border-radius:5px;color:#fff;font-family:inherit;cursor:pointer;font-size:13px;touch-action:manipulation;">
            Dismiss
        </button>
    `;

    document.body.appendChild(banner);

    // Auto-dismiss after 8 seconds
    setTimeout(() => { if (banner.parentNode) banner.remove(); _edSolverResult = null; }, 8000);

    // Store result for canvas overlay (6 second overlay duration)
    _edSolverResult = { solvable: ok, reachable: reach, expiry: Date.now() + 6000 };
}

// ─── Public API ───────────────────────────────────────────────
window.Editor = {
    enter:   enterEditorMode,
    exit:    exitEditorMode,
    import:  importLevel,
    isActive: () => editorMode,
    undo:    editorUndo,
    redo:    editorRedo,
};

// Register any previously saved custom levels into the runtime on startup
registerSavedLevelsIntoRuntime();
