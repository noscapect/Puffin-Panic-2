// Dynamic Game State
let currentLevelIndex = 0;
let TOTAL_PUFFINS = 20;
let REQUIRED_PUFFINS = 15;
let SPAWN_RATE = FPS * 2;
let currentReleaseRate = 50;
const MIN_RELEASE_RATE = 1;
const MAX_RELEASE_RATE = 99;
const MIN_SPAWN_INTERVAL = 3;
const MAX_SPAWN_INTERVAL = FPS * 2;
let ENTRANCE = { x: 70, y: 20 };
let EXIT = { x: 340, y: 78, w: 20, h: 12 };
let loopId = null;
let inputsSetup = false;
let gameSpeed = 1;
let soundEnabled = true;

function toggleSound() {
    Sound.init();
    soundEnabled = !soundEnabled;
    let btn = document.getElementById('btn-sound');
    if (btn) btn.innerText = soundEnabled ? '🔊 Sound' : '🔇 Muted';
    if (soundEnabled) {
        Sound.startBGM();
    } else {
        Sound.stopBGM();
    }
}

function playSound(soundName) {
    if (soundEnabled && Sound[soundName]) {
        Sound[soundName]();
    }
}

function toggleSpeed() {
    if (gameSpeed === 1) gameSpeed = 2;
    else if (gameSpeed === 2) gameSpeed = 4;
    else gameSpeed = 1;
    let btn = document.getElementById('btn-speed');
    if (btn) btn.innerText = 'Speed: ' + gameSpeed + 'x';
}

function clampReleaseRate(value) {
    return Math.max(MIN_RELEASE_RATE, Math.min(MAX_RELEASE_RATE, Number(value) || MIN_RELEASE_RATE));
}

function spawnIntervalFromReleaseRate(value) {
    const rate = clampReleaseRate(value);
    const t = (rate - MIN_RELEASE_RATE) / (MAX_RELEASE_RATE - MIN_RELEASE_RATE);
    return Math.max(MIN_SPAWN_INTERVAL, Math.round(MAX_SPAWN_INTERVAL - (MAX_SPAWN_INTERVAL - MIN_SPAWN_INTERVAL) * t));
}

function releaseRateFromSpawnInterval(interval) {
    const clampedInterval = Math.max(MIN_SPAWN_INTERVAL, Math.min(MAX_SPAWN_INTERVAL, Number(interval) || MAX_SPAWN_INTERVAL));
    const t = (MAX_SPAWN_INTERVAL - clampedInterval) / (MAX_SPAWN_INTERVAL - MIN_SPAWN_INTERVAL);
    return clampReleaseRate(Math.round(MIN_RELEASE_RATE + t * (MAX_RELEASE_RATE - MIN_RELEASE_RATE)));
}

function syncReleaseRateControls() {
    const rateSlider = document.getElementById('release-rate');
    const rateVal = document.getElementById('release-rate-val');
    if (rateSlider) rateSlider.value = String(currentReleaseRate);
    if (rateVal) rateVal.innerText = String(currentReleaseRate);
}

function updateReleaseRate(value) {
    const nextRate = clampReleaseRate(value);
    currentReleaseRate = nextRate;
    SPAWN_RATE = spawnIntervalFromReleaseRate(nextRate);
    if (gameState && typeof gameState.spawnCountdown === 'number') {
        gameState.spawnCountdown = Math.min(gameState.spawnCountdown, SPAWN_RATE);
    }
    syncReleaseRateControls();
}

function changeReleaseRate(delta) {
    updateReleaseRate(currentReleaseRate + delta);
}

function refreshTextureControls() {
    if (!window.TerrainTextures || typeof window.TerrainTextures.status !== 'function') return;
    const status = window.TerrainTextures.status();

    const btn = document.getElementById('btn-texture-mode');
    if (btn) {
        btn.innerText = status.enabled ? 'Textures: ON' : 'Textures: OFF';
    }

    const blendSlider = document.getElementById('texture-blend');
    const blendVal = document.getElementById('texture-blend-val');
    const blendPct = Math.round((status.blend || 0) * 100);
    if (blendSlider) blendSlider.value = String(blendPct);
    if (blendVal) blendVal.innerText = `${blendPct}%`;

    // Optional tooltip text for quick verification.
    if (btn) {
        btn.title = `Loaded textures: ${status.loaded}/${status.total}`;
    }
}

function toggleTextureMode() {
    if (!window.TerrainTextures || typeof window.TerrainTextures.status !== 'function') return;
    const status = window.TerrainTextures.status();
    window.TerrainTextures.setEnabled(!status.enabled);
    refreshTextureControls();
}

function updateTextureBlend(value) {
    if (!window.TerrainTextures || typeof window.TerrainTextures.setBlend !== 'function') return;
    const blend = Math.max(0, Math.min(100, Number(value))) / 100;
    window.TerrainTextures.setBlend(blend);
    const blendVal = document.getElementById('texture-blend-val');
    if (blendVal) blendVal.innerText = `${Math.round(blend * 100)}%`;
}


// --- Game Engine Variables ---
let canvas, ctx, offscreenCanvas, offCtx;
let renderer = null;
let terrainData = new Uint8Array(GAME_WIDTH * GAME_HEIGHT);
let terrainImgData;
// --- Volumetric liquid state (parallel to terrainData) ---
let liquidData    = new Uint8Array(GAME_WIDTH * GAME_HEIGHT);
let liquidCanvas, liquidCtx, liquidImgData;
let _liquidDirty  = false; // set true whenever liquid changes
// --- Falling sand state (filled by digHole in sand-theme levels) ---
let sandData      = new Uint8Array(GAME_WIDTH * GAME_HEIGHT);
// --- Liquid lava state (filled from level lavaZones; deadly to puffins) ---
let lavaData      = new Uint8Array(GAME_WIDTH * GAME_HEIGHT);
// --- Bridge stress (puffin-frames accumulated on each unsupported cell) ---
let bridgeStress  = new Uint16Array(GAME_WIDTH * GAME_HEIGHT);
// --- Horizontal wind force (theme-driven; affects floaters + particles) ---
let _windX = 0;
let puffins = [];
let particles = [];
let activeSkill = null;
let currentSkillCounts = {};
let gameState = {
    ticks: 0,
    spawned: 0,
    saved: 0,
    dead: 0,
    active: true,
    paused: false,
    timeLeft: 5 * 60 * FPS,
    spawnCountdown: spawnIntervalFromReleaseRate(currentReleaseRate)
};
let mouseX = 0, mouseY = 0;
let hoveredPuffin = null;
let nukeActivated = false;
let nukeCountdown = -1;
let screenShake = 0;
let screenShakeIntensity = 0;
let _phase3Layers = { scene: null, mist: null, atmBehind: null, atmFront: null, weatherAtmos: null, entities: null };
let _weatherSeeds = null;
const WEATHER_PARTICLE_CAP = 180;

// --- Atmosphere cache (updated every 2 ticks to save draw calls on mobile) ---
let _atmCache = { behind: null, front: null, lastTick: -999, theme: '' };
let _terrainFxCache = { theme: '', lastTick: -999, points: [] };

// --- GameContext ---
// Single access point for the mutable engine state that Puffin methods need.
// Using getters/setters means Puffin always sees the live values, and the
// dependency on shared state is explicit rather than scattered bare globals.
const GameContext = {
    get puffins()               { return puffins; },
    get particles()             { return particles; },
    get gameState()             { return gameState; },
    get EXIT()                  { return EXIT; },
    get LEVELS()                { return typeof LEVELS !== 'undefined' ? LEVELS : []; },
    get currentLevelIndex()     { return currentLevelIndex; },
    get liquidData()            { return liquidData; },
    get windX()                 { return _windX; },
    get hoveredPuffin()         { return hoveredPuffin; },
    get activeSkill()           { return activeSkill; },
    get currentSkillCounts()    { return currentSkillCounts; },
    get screenShake()           { return screenShake; },
    set screenShake(v)          { screenShake = v; },
    get screenShakeIntensity()  { return screenShakeIntensity; },
    set screenShakeIntensity(v) { screenShakeIntensity = v; },
};

// Optional WebGL effect switches.
// Keep baseline hybrid features enabled by default and future additions disabled.
const WEBGL_EFFECT_DEFAULTS = {
    skyLayer: true,
    terrainComposite: true,
    layerStack: true,
    puffinBodies: true,
    particles: true,
    weatherParticles: true,
    postProcess: true,
    dynamicLights: true,
    ringwaves: true,
    portalEffect: true,
    portalSparkles: true,
    bomberTrailWisps: true,
    caveAmbientMotes: true,
    exitRefractionRing: true,

    // Add-on effects (enabled by default).
    weatherField: true,
    terrainEdgeFx: true,
    spriteFx: true,
    shadows: true,
    distortion: true,
    postAtmosphere: true
};

let _webglEffectState = null;

function _initWebGLEffectState() {
    if (_webglEffectState) return;
    _webglEffectState = Object.assign({}, WEBGL_EFFECT_DEFAULTS);
}

function _isWebGLEffectEnabled(effectId) {
    _initWebGLEffectState();
    return !!_webglEffectState[effectId];
}

function _setWebGLEffectEnabled(effectId, enabled) {
    _initWebGLEffectState();
    if (!Object.prototype.hasOwnProperty.call(_webglEffectState, effectId)) return;
    _webglEffectState[effectId] = !!enabled;
}

function _runWebGLEffect(effectId, renderFn) {
    if (!_isWebGLEffectEnabled(effectId)) return false;
    try {
        return !!renderFn();
    } catch (err) {
        _setWebGLEffectEnabled(effectId, false);
        console.warn(`[Renderer] Disabled WebGL effect "${effectId}" after runtime error.`, err);
        return false;
    }
}

window.WebGLEffects = {
    list() {
        _initWebGLEffectState();
        return Object.assign({}, _webglEffectState);
    },
    enable(effectId, enabled = true) {
        _setWebGLEffectEnabled(effectId, enabled);
    },
    reset() {
        _webglEffectState = Object.assign({}, WEBGL_EFFECT_DEFAULTS);
    }
};

function _getOrUpdateAtmosphereCache(layer) {
    const t = gameState.ticks;
    const theme = getCurrentThemeName();
    if (theme !== _atmCache.theme) {
        // Theme changed — invalidate
        _atmCache.behind = null;
        _atmCache.front  = null;
        _atmCache.lastTick = -999;
        _atmCache.theme = theme;
    }
    if (t - _atmCache.lastTick >= 2) {
        // Re-render both layers at game resolution
        for (const lyr of ['behind', 'front']) {
            if (!_atmCache[lyr]) {
                const c = document.createElement('canvas');
                c.width = GAME_WIDTH; c.height = GAME_HEIGHT;
                _atmCache[lyr] = { c, cx: c.getContext('2d') };
            }
            _atmCache[lyr].cx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
            drawThemeAtmosphere(_atmCache[lyr].cx, lyr);
        }
        _atmCache.lastTick = t;
    }
    return _atmCache[layer] ? _atmCache[layer].c : null;
}

function _getPhase3Layer(name) {
    if (!_phase3Layers[name]) {
        const c = document.createElement('canvas');
        c.width = GAME_WIDTH;
        c.height = GAME_HEIGHT;
        _phase3Layers[name] = { c, cx: c.getContext('2d') };
    }
    return _phase3Layers[name];
}

function _initWeatherSeeds() {
    if (_weatherSeeds) return;
    _weatherSeeds = new Array(WEATHER_PARTICLE_CAP);
    for (let i = 0; i < WEATHER_PARTICLE_CAP; i++) {
        _weatherSeeds[i] = {
            a: Math.random(),
            b: Math.random(),
            c: Math.random(),
            d: Math.random()
        };
    }
}

function _getWeatherTypeForTheme(theme) {
    if (['snow', 'packed_snow', 'black_ice', 'frozen_mud', 'ice'].includes(theme)) return 'snow';
    if (['desert', 'sandstone', 'salt_flats'].includes(theme)) return 'sandstorm';
    if (['lava', 'volcanic_ash', 'obsidian_floor'].includes(theme)) return 'ash';
    if (['water', 'deep_sea', 'coral', 'wet_cave_stone'].includes(theme)) return 'bubbles';
    if (['grass', 'cliff_chalk', 'slate_ledge', 'wood_planks', 'rusty_metal', 'mossy_ruin'].includes(theme)) return 'rain';
    return null;
}

function _getWeatherFlash(theme, ticks) {
    return 0;
}

function _buildWeatherParticleCloud(theme, ticks, width, height, windX) {
    _initWeatherSeeds();
    const type = _getWeatherTypeForTheme(theme);
    if (!type) return [];

    let count = 120;
    if (type === 'rain') count = 170;
    else if (type === 'snow') count = 145;
    else if (type === 'sandstorm') count = 130;
    else if (type === 'ash') count = 115;

    const points = [];
    const t = ticks;
    const wrap = (v, m) => ((v % m) + m) % m;

    for (let i = 0; i < count && i < _weatherSeeds.length; i++) {
        const s = _weatherSeeds[i];
        let x = 0, y = 0, size = 1, alpha = 0.3, color = [220, 230, 240];

        if (type === 'snow') {
            const fall = 0.18 + s.b * 0.34;
            const drift = (s.c - 0.5) * 0.5 + windX * 0.7;
            x = wrap(s.a * width + t * drift + Math.sin(t * 0.01 + s.d * 6.28) * 5, width);
            y = wrap(s.d * height + t * fall, height);
            size = s.b > 0.66 ? 2 : 1;
            alpha = 0.35 + s.c * 0.35;
            color = [220 + Math.floor(s.a * 30), 235 + Math.floor(s.b * 20), 245 + Math.floor(s.c * 10)];
        } else if (type === 'sandstorm') {
            const dir = windX >= 0 ? 1 : -1;
            const speed = (1.2 + s.b * 2.2 + Math.abs(windX) * 1.1) * dir;
            x = wrap(s.a * width + t * speed, width);
            y = wrap(s.d * height + Math.sin(t * 0.02 + s.c * 9) * 8, height);
            size = s.a > 0.72 ? 2 : 1;
            alpha = 0.20 + s.b * 0.22;
            color = [205 + Math.floor(s.a * 35), 170 + Math.floor(s.c * 35), 90 + Math.floor(s.d * 35)];
        } else if (type === 'ash') {
            const fall = 0.16 + s.b * 0.36;
            const swirl = (s.c - 0.5) * 0.7 + Math.sin(t * 0.01 + s.a * 5) * 0.4;
            x = wrap(s.a * width + t * swirl, width);
            y = wrap(s.d * height + t * fall, height);
            size = s.d > 0.75 ? 2 : 1;
            alpha = 0.24 + s.c * 0.25;
            color = [130 + Math.floor(s.a * 50), 90 + Math.floor(s.b * 40), 80 + Math.floor(s.c * 35)];
        } else if (type === 'rain') {
            const fall = 2.0 + s.b * 3.2;
            const slant = windX * 2.2 + (s.c - 0.5) * 1.2;
            x = wrap(s.a * width + t * slant, width);
            y = wrap(s.d * height + t * fall, height);
            size = s.a > 0.5 ? 2 : 1;
            alpha = 0.22 + s.c * 0.20;
            color = [130 + Math.floor(s.a * 35), 185 + Math.floor(s.b * 45), 245 + Math.floor(s.d * 10)];
        } else if (type === 'bubbles') {
            const rise = 0.30 + s.b * 0.72;
            const drift = Math.sin(t * 0.018 + s.c * 6.28) * 0.8 + windX * 0.2;
            x = wrap(s.a * width + drift * 6, width);
            y = height - wrap(s.d * height + t * rise, height);
            size = 1 + Math.floor(s.b * 2);
            alpha = 0.16 + s.c * 0.28;
            color = [120 + Math.floor(s.a * 45), 210 + Math.floor(s.b * 40), 255];
        }

        points.push({ x, y, size, alpha, color });
    }

    return points;
}

function _drawWeatherParticleFallback(ctx, points) {
    for (let i = 0; i < points.length; i++) {
        const p = points[i];
        if (!p) continue;
        ctx.fillStyle = `rgba(${p.color[0]}, ${p.color[1]}, ${p.color[2]}, ${p.alpha})`;
        ctx.fillRect(Math.floor(p.x), Math.floor(p.y), p.size, p.size);
    }
}

function _buildPortalSparkleCloud(ticks, portalCharge) {
    const points = [];
    const cx = EXIT.x + EXIT.w * 0.5;
    const cy = EXIT.y + EXIT.h * 0.5;
    const count = 18 + Math.floor(portalCharge * 10);
    const rBase = 5 + portalCharge * 4;

    for (let i = 0; i < count; i++) {
        const a = ((i / count) * Math.PI * 2) + ticks * 0.03 + i * 0.27;
        const orbit = rBase + Math.sin(ticks * 0.05 + i * 1.4) * 2;
        const x = cx + Math.cos(a) * orbit;
        const y = cy + Math.sin(a * 1.2) * (orbit * 0.55);
        const pulse = 0.55 + 0.45 * Math.sin(ticks * 0.11 + i * 0.9);
        const cyanBlend = ((i * 13 + ticks) % 29) / 28;
        points.push({
            x,
            y,
            size: (i % 3 === 0) ? 2 : 1,
            alpha: (0.08 + portalCharge * 0.12) * pulse,
            color: [
                Math.round(90 - cyanBlend * 20),
                Math.round(230 + cyanBlend * 25),
                Math.round(200 + cyanBlend * 55)
            ]
        });
    }

    return points;
}

function _buildExitRefractionEffects(portalEffect, portalCharge, ticks) {
    if (!portalEffect) return [];

    const wobble = 0.9 + Math.sin(ticks * 0.09) * 0.08;
    return [{
        x: portalEffect.x,
        y: portalEffect.y,
        radius: Math.max(22, portalEffect.radius * 0.72 * wobble),
        strength: 0.075 + portalCharge * 0.06,
        kind: 'shockwave'
    }];
}

function _buildSceneDistortionEffects(theme, ticks, portalEffect) {
    const effects = [];

    if (nukeActivated && nukeCountdown > 0) {
        const life = Math.max(0, Math.min(1, nukeCountdown / (FPS * 5)));
        const pulse = 0.5 + 0.5 * Math.sin(ticks * 0.18);
        effects.push({
            x: GAME_WIDTH * SCALE * 0.5,
            y: GAME_HEIGHT * SCALE * 0.45,
            radius: (40 + (1 - life) * 100) * SCALE * 0.45,
            strength: 0.024 + pulse * 0.024,
            kind: 'pulse'
        });
    }

    for (let i = 0; i < puffins.length && effects.length < 6; i++) {
        const p = puffins[i];
        if (!p || p.state === ST_DEAD || p.state === ST_EXITED || p.state === ST_SPLAT) continue;
        if (!(p.bomberTicks > 0 && p.bomberTicks <= FPS * 2)) continue;
        const urgency = 1 - Math.max(0, Math.min(1, p.bomberTicks / (FPS * 2)));
        effects.push({
            x: (p.x + PUFFIN_W * 0.5) * SCALE,
            y: (p.y + PUFFIN_H * 0.4) * SCALE,
            radius: (8 + urgency * 16) * SCALE * 0.55,
            strength: 0.010 + urgency * 0.026,
            kind: 'swirl'
        });
    }

    if (portalEffect) {
        effects.push({
            x: portalEffect.x,
            y: portalEffect.y,
            radius: portalEffect.radius * 0.84,
            strength: 0.011,
            kind: 'swirl'
        });
    }

    if (['water', 'deep_sea', 'coral', 'wet_cave_stone'].includes(theme)) {
        effects.push({
            x: GAME_WIDTH * SCALE * 0.30,
            y: GAME_HEIGHT * SCALE * 0.28,
            radius: 36,
            strength: 0.010,
            kind: 'shockwave'
        });
        effects.push({
            x: GAME_WIDTH * SCALE * 0.72,
            y: GAME_HEIGHT * SCALE * 0.32,
            radius: 32,
            strength: 0.009,
            kind: 'shockwave'
        });
    }

    return effects;
}

function _buildBomberTrailCloud(ticks) {
    const points = [];
    for (let i = 0; i < puffins.length; i++) {
        const p = puffins[i];
        if (!p || p.state === ST_DEAD || p.state === ST_EXITED || p.state === ST_SPLAT) continue;
        if (!(p.bomberTicks > 0)) continue;

        const urgency = 1 - Math.max(0, Math.min(1, p.bomberTicks / (FPS * 5)));
        const baseX = p.x + PUFFIN_W * 0.5;
        const baseY = p.y + PUFFIN_H * 0.45;
        const count = 2 + Math.floor(urgency * 2);

        for (let j = 0; j < count; j++) {
            const swirl = Math.sin(ticks * 0.10 + i * 0.9 + j * 1.7);
            const x = baseX + (Math.random() - 0.5) * 2.8 + swirl * 0.9;
            const y = baseY - j * 1.2 - (Math.random() * 1.8);
            const hot = j === 0 && urgency > 0.45;
            points.push({
                x,
                y,
                size: hot ? 2 : 1,
                alpha: (0.12 + urgency * 0.20) * (0.8 - j * 0.16),
                color: hot ? [255, 130, 70] : [180, 190, 205]
            });
        }
    }
    return points;
}

function _buildCaveAmbientMotes(theme, ticks) {
    if (!['cave', 'wet_cave_stone', 'iron_ore', 'mud', 'mossy_ruin'].includes(theme)) return [];

    const points = [];
    const count = 46;
    for (let i = 0; i < count; i++) {
        const phase = ticks * (0.012 + (i % 5) * 0.002);
        const x = ((i * 37.3 + Math.sin(phase + i * 0.3) * 12) % GAME_WIDTH + GAME_WIDTH) % GAME_WIDTH;
        const y = ((i * 19.7 + phase * 15 + Math.cos(phase * 0.8 + i * 0.4) * 9) % GAME_HEIGHT + GAME_HEIGHT) % GAME_HEIGHT;
        const glow = 0.5 + 0.5 * Math.sin(phase * 2.4 + i * 0.8);
        points.push({
            x,
            y,
            size: (i % 7 === 0) ? 2 : 1,
            alpha: 0.035 + glow * 0.045,
            color: [130 + Math.floor(glow * 20), 150 + Math.floor(glow * 25), 170 + Math.floor(glow * 30)]
        });
    }
    return points;
}

function _getThemeFxColors(theme) {
    if (['snow', 'packed_snow', 'black_ice', 'ice', 'frozen_mud'].includes(theme)) {
        return { a: [186, 225, 255], b: [236, 247, 255] };
    }
    if (['desert', 'sandstone', 'salt_flats'].includes(theme)) {
        return { a: [226, 184, 108], b: [255, 216, 148] };
    }
    if (['lava', 'volcanic_ash', 'obsidian_floor'].includes(theme)) {
        return { a: [255, 116, 52], b: [255, 188, 80] };
    }
    if (['water', 'deep_sea', 'coral', 'wet_cave_stone'].includes(theme)) {
        return { a: [72, 196, 255], b: [142, 244, 255] };
    }
    if (['crystal', 'crystal_dense', 'amber', 'fungus_glow', 'toxic_sludge'].includes(theme)) {
        return { a: [126, 238, 184], b: [148, 164, 255] };
    }
    return { a: [136, 186, 232], b: [205, 236, 255] };
}

function _getTerrainEdgeGlowProfile(theme) {
    if (['lava', 'volcanic_ash', 'obsidian_floor'].includes(theme)) {
        return { alpha: 0.26, size: 2, density: 0.24, step: 2, maxPoints: 900, lightIntensity: 0.15 };
    }
    if (['water', 'deep_sea', 'coral', 'wet_cave_stone'].includes(theme)) {
        return { alpha: 0.16, size: 2, density: 0.20, step: 2, maxPoints: 720, lightIntensity: 0.10 };
    }
    if (['crystal', 'crystal_dense', 'amber', 'fungus_glow', 'toxic_sludge'].includes(theme)) {
        return { alpha: 0.18, size: 2, density: 0.22, step: 2, maxPoints: 760, lightIntensity: 0.12 };
    }
    if (['snow', 'packed_snow', 'black_ice', 'ice', 'frozen_mud'].includes(theme)) {
        return { alpha: 0.11, size: 2, density: 0.17, step: 3, maxPoints: 480, lightIntensity: 0.07 };
    }
    return { alpha: 0.07, size: 1, density: 0.12, step: 3, maxPoints: 360, lightIntensity: 0.05 };
}

function _getTerrainEdgeGlowPoints(theme, ticks) {
    if (_terrainFxCache.theme === theme && ticks - _terrainFxCache.lastTick < 4) {
        return _terrainFxCache.points;
    }

    const profile = _getTerrainEdgeGlowProfile(theme);
    const colors = _getThemeFxColors(theme);
    const points = [];

    for (let y = 1; y < GAME_HEIGHT - 1; y += profile.step) {
        for (let x = 1; x < GAME_WIDTH - 1; x += profile.step) {
            const val = getTerrain(x, y);
            if (val === 0) continue;

            const airAbove = getTerrain(x, y - 1) === 0;
            const airLeft = getTerrain(x - 1, y) === 0;
            const airRight = getTerrain(x + 1, y) === 0;
            if (!airAbove && !airLeft && !airRight) continue;

            const hash = (((x * 17 + y * 31 + ticks * 3) % 101) + 101) % 101 / 100;
            if (hash > profile.density) continue;

            const pulse = 0.7 + 0.3 * Math.sin(ticks * 0.05 + x * 0.13 + y * 0.09);
            const blend = (((x * 11 + y * 7) % 19) + 19) % 19 / 18;
            const edgeBoost = airAbove ? 1 : 0.68;
            points.push({
                x: x + 0.5,
                y: y + 0.5,
                size: profile.size + (airAbove && hash > 0.65 ? 1 : 0),
                alpha: profile.alpha * edgeBoost * pulse,
                color: [
                    Math.round(colors.a[0] + (colors.b[0] - colors.a[0]) * blend),
                    Math.round(colors.a[1] + (colors.b[1] - colors.a[1]) * blend),
                    Math.round(colors.a[2] + (colors.b[2] - colors.a[2]) * blend)
                ]
            });

            if (points.length >= profile.maxPoints) {
                _terrainFxCache = { theme, lastTick: ticks, points };
                return points;
            }
        }
    }

    _terrainFxCache = { theme, lastTick: ticks, points };
    return points;
}

function _buildTerrainContactLights(edgePoints, theme) {
    const lights = [];
    if (!edgePoints || edgePoints.length === 0) return lights;

    const profile = _getTerrainEdgeGlowProfile(theme);
    const stride = Math.max(1, Math.floor(edgePoints.length / 4));
    for (let i = 0; i < edgePoints.length && lights.length < 4; i += stride) {
        const p = edgePoints[i];
        if (!p || p.alpha < profile.alpha * 0.7) continue;
        lights.push({
            x: p.x * SCALE,
            y: p.y * SCALE,
            radius: (10 + p.size * 4) * SCALE * 0.25,
            intensity: profile.lightIntensity + p.alpha * 0.18,
            color: p.color
        });
    }

    return lights;
}

function _getPuffinWebGLEffect(p, theme) {
    const colors = _getThemeFxColors(theme);
    const effect = {
        tint: [255, 255, 255],
        tintStrength: 0,
        rimColor: colors.a.slice(),
        rimStrength: 0.08,
        glow: 0.04
    };

    if (p.bomberTicks > 0) {
        const urgency = 1 - Math.max(0, Math.min(1, p.bomberTicks / (FPS * 5)));
        effect.tint = [255, 126, 94];
        effect.tintStrength = 0.16 + urgency * 0.34;
        effect.rimColor = [255, 118, 70];
        effect.rimStrength = 0.20 + urgency * 0.55;
        effect.glow = 0.12 + urgency * 0.55 + (p.bomberPulseTicks > 0 ? 0.18 : 0) + (p.bomberFinalCueTicks > 0 ? 0.24 : 0);
        return effect;
    }

    if (p.state === ST_PANIC || p.state === ST_NUKE_PANIC) {
        effect.tint = [255, 150, 150];
        effect.tintStrength = 0.15;
        effect.rimColor = [255, 92, 92];
        effect.rimStrength = 0.28;
        effect.glow = 0.12;
        return effect;
    }

    if (p.state === ST_FLOAT || p.isFloater) {
        effect.rimColor = [255, 222, 96];
        effect.rimStrength = 0.18;
        effect.glow = 0.10;
    } else if (p.state === ST_MINE || p.state === ST_DIG || p.state === ST_BUILD) {
        effect.rimColor = [255, 236, 168];
        effect.rimStrength = 0.20;
        effect.glow = 0.08;
    } else if (['lava', 'volcanic_ash', 'obsidian_floor'].includes(theme)) {
        effect.rimColor = [255, 150, 86];
        effect.rimStrength = 0.14;
        effect.glow = 0.08;
    } else if (['water', 'deep_sea', 'coral', 'wet_cave_stone'].includes(theme)) {
        effect.rimColor = [132, 228, 255];
        effect.rimStrength = 0.14;
        effect.glow = 0.06;
    } else if (['crystal', 'crystal_dense', 'amber', 'fungus_glow', 'toxic_sludge'].includes(theme)) {
        effect.rimColor = colors.b.slice();
        effect.rimStrength = 0.16;
        effect.glow = 0.07;
    }

    return effect;
}

function _buildShadowBlobs() {
    const blobs = [];
    const maxShadowPuffins = 18;
    const puffinStep = Math.max(1, Math.floor(puffins.length / maxShadowPuffins));

    for (let i = 0; i < puffins.length; i += puffinStep) {
        const p = puffins[i];
        if (!p || p.state === ST_DEAD || p.state === ST_EXITED || p.state === ST_SPLAT) continue;
        if (p.state === ST_FALL || p.state === ST_FLOAT || p.state === ST_CLIMB) continue;

        const stateBoost = (p.state === ST_BLOCK ? 5 : 0) + (p.state === ST_BUILD ? 2 : 0);
        blobs.push({
            x: (p.x + PUFFIN_W / 2) * SCALE,
            y: (p.y + PUFFIN_H + 1) * SCALE,
            radius: (12 + stateBoost) * SCALE * 0.34,
            intensity: 0.06 + (p.bomberTicks > 0 ? 0.04 : 0)
        });
    }

    blobs.push({
        x: (EXIT.x + EXIT.w / 2) * SCALE,
        y: (EXIT.y + EXIT.h + 2) * SCALE,
        radius: 22,
        intensity: 0.08
    });

    return blobs;
}

function _drawWeatherAtmosphereOverlay(ctx, theme, ticks, windX) {
    const type = _getWeatherTypeForTheme(theme);
    if (!type) return;

    if (type === 'snow') {
        const drift = Math.sin(ticks * 0.01) * 4 + windX * 6;
        const fog = ctx.createLinearGradient(0, 80, 0, GAME_HEIGHT);
        fog.addColorStop(0, 'rgba(195, 225, 245, 0.04)');
        fog.addColorStop(1, 'rgba(210, 235, 255, 0.12)');
        ctx.fillStyle = fog;
        ctx.fillRect(0, 72, GAME_WIDTH, GAME_HEIGHT - 72);
        ctx.fillStyle = 'rgba(220, 240, 255, 0.05)';
        ctx.fillRect(-18 + drift, 124, 170, 14);
        ctx.fillRect(162 - drift * 0.7, 138, 180, 12);
    } else if (type === 'sandstorm') {
        const drift = (ticks * (0.8 + Math.abs(windX) * 2.6)) % (GAME_WIDTH + 120);
        ctx.fillStyle = 'rgba(210, 170, 96, 0.09)';
        ctx.fillRect(0, 90, GAME_WIDTH, 40);
        ctx.fillStyle = 'rgba(190, 140, 78, 0.08)';
        ctx.fillRect(-120 + drift, 92, 130, 10);
        ctx.fillRect(-40 + drift * 0.85, 108, 145, 12);
        ctx.fillRect(40 + drift * 0.72, 120, 140, 10);
        ctx.fillRect(170 + drift * 0.63, 100, 150, 13);
    } else if (type === 'ash') {
        const wave = Math.sin(ticks * 0.012) * 5;
        const haze = ctx.createLinearGradient(0, 84, 0, GAME_HEIGHT);
        haze.addColorStop(0, 'rgba(120, 78, 62, 0.04)');
        haze.addColorStop(1, 'rgba(85, 55, 48, 0.14)');
        ctx.fillStyle = haze;
        ctx.fillRect(0, 84, GAME_WIDTH, GAME_HEIGHT - 84);
        ctx.fillStyle = 'rgba(170, 110, 82, 0.07)';
        ctx.fillRect(8 + wave, 118, GAME_WIDTH - 16, 11);
        ctx.fillStyle = 'rgba(145, 96, 70, 0.06)';
        ctx.fillRect(22 - wave * 0.8, 136, GAME_WIDTH - 44, 13);
    } else if (type === 'rain') {
        const cloud = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT * 0.6);
        cloud.addColorStop(0, 'rgba(28, 50, 78, 0.16)');
        cloud.addColorStop(1, 'rgba(18, 30, 56, 0.03)');
        ctx.fillStyle = cloud;
        ctx.fillRect(0, 0, GAME_WIDTH, Math.floor(GAME_HEIGHT * 0.62));
    } else if (type === 'bubbles') {
        const drift = Math.sin(ticks * 0.02) * 6;
        const caustic = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
        caustic.addColorStop(0, 'rgba(90, 205, 255, 0.05)');
        caustic.addColorStop(1, 'rgba(42, 138, 202, 0.07)');
        ctx.fillStyle = caustic;
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        ctx.fillStyle = 'rgba(140, 240, 255, 0.04)';
        ctx.fillRect(12 + drift, 30, 140, 7);
        ctx.fillRect(175 - drift * 0.7, 54, 150, 8);
        ctx.fillRect(70 + drift * 0.35, 84, 165, 7);
    }
}

// --- Touch long-press tooltip ---
let _touchTooltip = null; // { sx, sy, label } in game coords
let _touchLongPressTimer = null;
let _touchStartGX = 0, _touchStartGY = 0;

function getBestPuffinAt(x, y, skillId = activeSkill) {
    let best = null;
    let bestScore = Infinity;

    for (let p of puffins) {
        if (p.state === ST_DEAD || p.state === ST_EXITED) continue;

        const cx = p.x + PUFFIN_W / 2;
        const cy = p.y + PUFFIN_H / 2;
        const dist = Math.hypot(cx - x, cy - y);
        const inExpandedBox =
            x >= p.x - 4 && x <= p.x + PUFFIN_W + 4 &&
            y >= p.y - 4 && y <= p.y + PUFFIN_H + 4;
        const maxDist = inExpandedBox ? 28 : 20; // larger for comfortable touch taps
        if (dist > maxDist) continue;

        let score = dist;
        if (inExpandedBox) score -= 5;
        if (skillId && p.canAcceptSkill(skillId)) score -= 3;
        if (p.state === ST_WALK || p.state === ST_BUILD || p.state === ST_BASH || p.state === ST_MINE || p.state === ST_DIG) {
            score -= 1;
        }

        if (score < bestScore) {
            bestScore = score;
            best = p;
        }
    }

    return best;
}

function getThemeSkyColors() {
    const theme = getCurrentThemeName();
    const skies = {
        grass:   { top: '#1f4f88', mid: '#254d74', bot: '#1b3858', veil: 'rgba(145, 195, 235, 0.12)' },
        desert:  { top: '#6a3f3a', mid: '#8a5a3f', bot: '#4e3329', veil: 'rgba(255, 188, 120, 0.10)' },
        snow:    { top: '#223954', mid: '#2a4869', bot: '#1f3148', veil: 'rgba(176, 218, 255, 0.16)' },
        rock:    { top: '#2a2e39', mid: '#3a3d4a', bot: '#232532', veil: 'rgba(165, 180, 205, 0.10)' },
        ice:     { top: '#123b67', mid: '#1c4f7f', bot: '#16385b', veil: 'rgba(120, 205, 255, 0.14)' },
        lava:    { top: '#401515', mid: '#5a1f17', bot: '#2b0f0f', veil: 'rgba(255, 110, 60, 0.12)' },
        crystal: { top: '#2f1f4f', mid: '#3a2f69', bot: '#23183f', veil: 'rgba(190, 140, 255, 0.12)' },
        water:   { top: '#0c3a63', mid: '#135684', bot: '#0b2f4a', veil: 'rgba(120, 220, 255, 0.14)' },
        cliff_chalk:    { top: '#445768', mid: '#5d6f7d', bot: '#394957', veil: 'rgba(220, 214, 188, 0.10)' },
        slate_ledge:    { top: '#262c35', mid: '#343d49', bot: '#202833', veil: 'rgba(175, 188, 205, 0.10)' },
        frozen_mud:     { top: '#2b3d4f', mid: '#405468', bot: '#273849', veil: 'rgba(180, 205, 228, 0.11)' },
        packed_snow:    { top: '#2a4159', mid: '#3a5978', bot: '#28435d', veil: 'rgba(210, 225, 240, 0.14)' },
        black_ice:      { top: '#183a5c', mid: '#245278', bot: '#183a58', veil: 'rgba(136, 197, 242, 0.15)' },
        volcanic_ash:   { top: '#3a2522', mid: '#4f312c', bot: '#2a1b19', veil: 'rgba(216, 126, 92, 0.10)' },
        obsidian_floor: { top: '#2d2637', mid: '#3d324b', bot: '#241f2c', veil: 'rgba(184, 140, 205, 0.11)' },
        salt_flats:     { top: '#6c5f52', mid: '#847564', bot: '#4f473d', veil: 'rgba(238, 218, 186, 0.10)' },
        wet_cave_stone: { top: '#1e303f', mid: '#2b4256', bot: '#1a2a36', veil: 'rgba(132, 180, 214, 0.10)' },
        rusty_metal:    { top: '#4f3a34', mid: '#6b4b40', bot: '#3b2e2a', veil: 'rgba(216, 138, 100, 0.10)' },
        wood_planks:    { top: '#524437', mid: '#6f5a46', bot: '#3f3429', veil: 'rgba(210, 168, 118, 0.10)' },
        mossy_ruin:     { top: '#284232', mid: '#355843', bot: '#22382d', veil: 'rgba(134, 186, 138, 0.10)' },
        crystal_dense:  { top: '#352553', mid: '#47326c', bot: '#281b3f', veil: 'rgba(206, 156, 248, 0.12)' },
        fungus_glow:    { top: '#1d3f3d', mid: '#2c5a52', bot: '#183532', veil: 'rgba(112, 236, 188, 0.12)' },
        toxic_sludge:   { top: '#394028', mid: '#4f5c33', bot: '#2a311f', veil: 'rgba(186, 225, 86, 0.10)' },
        concept_999:    { top: '#1f4f88', mid: '#3e7db0', bot: '#215079', veil: 'rgba(188, 230, 255, 0.14)' },
        sandstone:  { top: '#6b4c1a', mid: '#8a611f', bot: '#4f3612', veil: 'rgba(245, 195, 100, 0.12)' },
        deep_sea:   { top: '#071a2e', mid: '#0d2840', bot: '#050f1e', veil: 'rgba(60, 140, 200, 0.12)' },
        iron_ore:   { top: '#232323', mid: '#2e2e2e', bot: '#1a1a1a', veil: 'rgba(185, 100, 50, 0.10)' },
        coral:      { top: '#0d4a5e', mid: '#146378', bot: '#0a3848', veil: 'rgba(120, 220, 210, 0.14)' },
        amber:      { top: '#5a3a0a', mid: '#7a5218', bot: '#40280a', veil: 'rgba(255, 200, 80, 0.14)' },
        bone_white: { top: '#5a5a5a', mid: '#707070', bot: '#484848', veil: 'rgba(230, 225, 210, 0.10)' }
    };
    return skies[theme] || skies.grass;
}

function emitPortalAmbience() {
    if (!gameState.active || gameState.paused) return;
    if (typeof createPortalParticles !== 'function') return;

    // Spawn a gentle stream of particles around the exit portal.
    const px = EXIT.x + EXIT.w / 2 + (Math.random() - 0.5) * 8;
    const py = EXIT.y + EXIT.h / 2 + (Math.random() - 0.5) * 8;
    createPortalParticles(px, py, 1 + (Math.random() > 0.7 ? 1 : 0));
}

function triggerNuke() {
    if (!gameState.active || gameState.paused || nukeActivated) return;
    nukeActivated = true;
    nukeCountdown = FPS * 5; // 5 seconds countdown
    playSound('nukeWarning');
    
    // Disable nuke button
    let nukeBtn = document.getElementById('btn-nuke');
    if (nukeBtn) nukeBtn.classList.add('disabled');
    
    // Set all active puffins to nuke panic with 1-second staggered explosions.
    const livePuffins = puffins.filter(p => p.state !== ST_DEAD && p.state !== ST_EXITED && p.state !== ST_SPLAT);
    livePuffins.forEach((p, index) => {
        p.nukePanicTicks = nukeCountdown + (index * FPS);
        p.state = ST_NUKE_PANIC;
    });
    
    // Create warning particles for each affected puffin.
    livePuffins.forEach(p => {
        createParticles(p.x + PUFFIN_W/2, p.y, 3, [255, 0, 0]);
    });
}

function togglePause() {
    if (!gameState.active) return;
    gameState.paused = !gameState.paused;
    document.getElementById('pause-overlay').style.display = gameState.paused ? 'flex' : 'none';
}

// Input Handlers
function setupInputs() {
    if (inputsSetup) return;
    inputsSetup = true;

    // Helper: convert client coords to game coords
    function toGameCoords(clientX, clientY) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: Math.floor((clientX - rect.left) * (GAME_WIDTH  / rect.width)),
            y: Math.floor((clientY - rect.top)  * (GAME_HEIGHT / rect.height))
        };
    }

    // Handle window resize for responsive scaling
    window.addEventListener('resize', updateCanvasScale);
    updateCanvasScale();

    // ── Mouse ──────────────────────────────────────────────────────────────
    canvas.addEventListener('mousemove', e => {
        const g = toGameCoords(e.clientX, e.clientY);
        mouseX = g.x; mouseY = g.y;
    });

    canvas.addEventListener('mousedown', e => {
        if (e.button === 2) { cancelSkill(); return; }
        if (e.button === 0) handleGamePointerDown(mouseX, mouseY);
    });

    // Prevent context menu on right-click
    canvas.addEventListener('contextmenu', e => e.preventDefault());

    // ── Touch ──────────────────────────────────────────────────────────────
    // State names for the long-press tooltip
    const _stateNames = {
        [ST_WALK]:       'Walking',
        [ST_FALL]:       'Falling',
        [ST_FLOAT]:      'Floating',
        [ST_BLOCK]:      'Blocker',
        [ST_BUILD]:      'Builder',
        [ST_BASH]:       'Basher',
        [ST_DIG]:        'Digger',
        [ST_MINE]:       'Miner',
        [ST_CLIMB]:      'Climber',
        [ST_PANIC]:      'Panicking',
        [ST_NUKE_PANIC]: 'Nuke!',
        [ST_SPLAT]:      'Splat',
    };

    canvas.addEventListener('touchstart', e => {
        e.preventDefault();
        const touch = e.touches[0];
        const g = toGameCoords(touch.clientX, touch.clientY);
        mouseX = g.x; mouseY = g.y;
        _touchStartGX = g.x; _touchStartGY = g.y;
        _touchTooltip = null;

        // Long-press: show puffin state after 320 ms
        clearTimeout(_touchLongPressTimer);
        _touchLongPressTimer = setTimeout(() => {
            const p = getBestPuffinAt(_touchStartGX, _touchStartGY, null);
            if (p) {
                let label = _stateNames[p.state] || 'Puffin';
                if (p.isFloater)  label += ' ☂';
                if (p.isClimber)  label += ' 🧗';
                if (p.isBasher)   label += ' 🥊';
                if (p.bomberTicks > 0) label = `Bomb ${Math.ceil(p.bomberTicks / FPS)}s`;
                _touchTooltip = { sx: _touchStartGX, sy: _touchStartGY, label };
            }
        }, 320);
    }, { passive: false });

    canvas.addEventListener('touchmove', e => {
        e.preventDefault();
        clearTimeout(_touchLongPressTimer);
        const touch = e.touches[0];
        const g = toGameCoords(touch.clientX, touch.clientY);
        mouseX = g.x; mouseY = g.y;
    }, { passive: false });

    canvas.addEventListener('touchend', e => {
        e.preventDefault();
        clearTimeout(_touchLongPressTimer);
        // Short tap = game click (only if tooltip wasn't shown)
        if (!_touchTooltip) {
            handleGamePointerDown(_touchStartGX, _touchStartGY);
        }
        // Tooltip auto-hides after 1.5 s
        setTimeout(() => { _touchTooltip = null; }, 1500);
    }, { passive: false });

    // ── Keyboard ────────────────────────────────────────────────────────────
    window.addEventListener('keydown', e => {
        if (e.key === 'Escape' && gameState.active) {
            if (activeSkill) {
                cancelSkill();
            } else {
                togglePause();
            }
        }
        if (!gameState.active || gameState.paused) return;

        // N key for nuke
        if (e.key === 'n' || e.key === 'N') {
            triggerNuke();
        }

        // Classic-style release-rate control.
        if (e.key === '[' || e.key === '-' || e.key === '_') {
            changeReleaseRate(-1);
        }
        if (e.key === ']' || e.key === '=' || e.key === '+') {
            changeReleaseRate(1);
        }
    });
}

function selectSkill(skillId) {
    if (currentSkillCounts[skillId] > 0) {
        activeSkill = skillId;
        updateUI();
        playSound('click');
    }
}

function cancelSkill() {
    activeSkill = null;
    updateUI();
    playSound('click');
}

// Shared pointer-down logic used by both mouse and touch
function handleGamePointerDown(gameX, gameY) {
    if (editorMode || !gameState.active || gameState.paused) return;
    const target = getBestPuffinAt(gameX, gameY, activeSkill);

    if (!activeSkill && target) {
        if (target.toggleBlocker()) { playSound('click'); return; }
        if (target.toggleBuilder()) { playSound('click'); return; }
        if (target.toggleMiner())   { playSound('click'); return; }
    }

    if (activeSkill) {
        if (currentSkillCounts[activeSkill] <= 0) return;
        if (target && target.canAcceptSkill(activeSkill)) {
            target.assignSkill(activeSkill);
            currentSkillCounts[activeSkill]--;
            if (typeof Achievements !== 'undefined') Achievements.trackSkill(activeSkill);
            updateUI();
            playSound('skillAssign');
        }
    }
}

function updateCanvasScale() {
    // Update overlay sizes to match canvas display size
    const overlays = ['message-overlay', 'pause-overlay', 'start-overlay'];
    const canvasRect = canvas.getBoundingClientRect();
    
    overlays.forEach(id => {
        const overlay = document.getElementById(id);
        if (overlay) {
            overlay.style.width = canvasRect.width + 'px';
            overlay.style.height = canvasRect.height + 'px';
        }
    });
}

function populateLevelSelect() {
    let levelSelect = document.getElementById('debug-level-select');
    if (!levelSelect) return;
    const previous = parseInt(levelSelect.value || '0', 10);
    levelSelect.innerHTML = '';
    LEVELS.forEach((lvl, index) => {
        let opt = document.createElement('option');
        opt.value = index;
        opt.innerText = lvl.name;
        levelSelect.appendChild(opt);
    });
    if (LEVELS.length > 0) {
        levelSelect.value = String(Math.max(0, Math.min(previous, LEVELS.length - 1)));
    }
}


// --- Main Game Logic ---

// Re-subscribes each time so we always track the current DPR value correctly
// (matchMedia queries are one-shot for a specific resolution).
function _watchForDprChange() {
    const mql = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    mql.addEventListener('change', () => {
        window._canvasDPR = Math.min(Math.round(window.devicePixelRatio || 1), 2);
        buildPuffinBodyCache();
        _watchForDprChange();
    }, { once: true });
}

function getRequestedRenderBackend() {
    try {
        const params = new URLSearchParams(window.location.search || '');
        const fromQuery = (params.get('renderer') || '').toLowerCase();
        if (fromQuery === 'webgl' || fromQuery === 'canvas2d') return fromQuery;
    } catch (err) {
        // Ignore malformed URLs and continue with default.
    }
    const fromStorage = (window.localStorage && window.localStorage.getItem('pp2_renderer') || '').toLowerCase();
    if (fromStorage === 'webgl' || fromStorage === 'canvas2d') return fromStorage;
    return 'canvas2d';
}

window.onload = function() {
    canvas = document.getElementById('gameCanvas');
    const requestedBackend = getRequestedRenderBackend();
    try {
        if (window.RendererFactory && typeof window.RendererFactory.createRenderer === 'function') {
            renderer = window.RendererFactory.createRenderer(canvas, {
                backend: requestedBackend,
                gameWidth: GAME_WIDTH,
                gameHeight: GAME_HEIGHT,
                scale: SCALE,
                maxDpr: 2
            });
        }
    } catch (err) {
        console.error('[Renderer] Failed to initialize renderer backend, falling back to Canvas2D.', err);
        renderer = null;
    }

    if (!renderer) {
        ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        const _dpr = Math.min(Math.round(window.devicePixelRatio || 1), 2);
        if (_dpr > 1) {
            canvas.width  = GAME_WIDTH  * SCALE * _dpr;
            canvas.height = GAME_HEIGHT * SCALE * _dpr;
            canvas.style.width  = (GAME_WIDTH  * SCALE) + 'px';
            canvas.style.height = (GAME_HEIGHT * SCALE) + 'px';
            ctx.scale(_dpr, _dpr);
            window._canvasDPR = _dpr;
        } else {
            window._canvasDPR = 1;
        }
    } else {
        ctx = renderer.getContext2D();
        if (!ctx) {
            // WebGL path is scaffolded but draw pipeline still uses a 2D context in phase 1.
            console.warn('[Renderer] Active backend does not provide a 2D context yet; falling back to Canvas2D pipeline.');
            renderer = window.RendererFactory.createRenderer(canvas, {
                backend: 'canvas2d',
                gameWidth: GAME_WIDTH,
                gameHeight: GAME_HEIGHT,
                scale: SCALE,
                maxDpr: 2
            });
            ctx = renderer.getContext2D();
        }
        window._canvasDPR = renderer.getDpr();
    }
    
    offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = GAME_WIDTH;
    offscreenCanvas.height = GAME_HEIGHT;
    offCtx = offscreenCanvas.getContext('2d');
    offCtx.imageSmoothingEnabled = true; // terrain texture blending uses smoothing

    // Liquid layer canvas — same resolution as terrain, drawn on top
    liquidCanvas = document.createElement('canvas');
    liquidCanvas.width  = GAME_WIDTH;
    liquidCanvas.height = GAME_HEIGHT;
    liquidCtx = liquidCanvas.getContext('2d');
    liquidImgData = new ImageData(GAME_WIDTH, GAME_HEIGHT);

    // Build puffin body sprite cache now that canvas APIs are available
    buildPuffinBodyCache();
    _watchForDprChange();

    setupInputs();

    populateLevelSelect();

    if (window.LevelManager && typeof window.LevelManager.loadExternalLevels === 'function') {
        window.LevelManager.loadExternalLevels().then(() => {
            populateLevelSelect();
        });
    }
    
    // Draw initial background
    ctx.fillStyle = '#111a22';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    refreshTextureControls();

    // Preload photo textures in background; re-render terrain once ready
    preloadTerrainTextures(() => {
        // Re-render the terrain with newly loaded textures.
        // offscreenCanvas is always ready here (created above in window.onload).
        // If no level is loaded yet this is a no-op visually; loadLevel() will
        // pick up the cached textures when the player presses Start.
        // If a level IS already loaded (race: Start pressed before textures finished)
        // this re-render applies the textures immediately.
        if (typeof terrainData !== 'undefined' && offscreenCanvas) {
            renderTerrainToOffscreen();
        }
        refreshTextureControls();
    });
};

function startGame() {
    document.getElementById('start-overlay').style.display = 'none';
    let levelSelect = document.getElementById('debug-level-select');
    let levelIndex = levelSelect ? parseInt(levelSelect.value) : 0;
    loadLevel(levelIndex);
}

function openLevelEditor() {
    document.getElementById('start-overlay').style.display = 'none';
    if (typeof Editor !== 'undefined') {
        Editor.enter();
    }
}

function showGameUI() {
    document.getElementById('ui-panel').style.display = 'flex';
}

function hideGameUI() {
    document.getElementById('ui-panel').style.display = 'none';
}

function loadLevel(index) {
    currentLevelIndex = index;
    const lvl = LEVELS[currentLevelIndex];

    document.title = "Puffins Panic! - " + lvl.name;
    showGameUI();

    // Reset achievements stats
    if (typeof Achievements !== 'undefined') {
        Achievements.resetStats();
        Achievements.stats.total = lvl.total;
        Achievements.stats.required = lvl.required;
    }
    
    TOTAL_PUFFINS = lvl.total;
    REQUIRED_PUFFINS = lvl.required;
    currentReleaseRate = releaseRateFromSpawnInterval(lvl.spawnRate);
    SPAWN_RATE = spawnIntervalFromReleaseRate(currentReleaseRate);
    // Copy spawn objects so runtime physics does not mutate level definitions.
    ENTRANCE = { ...lvl.entrance };
    EXIT = { ...lvl.exit };

    document.getElementById('message-overlay').style.display = 'none';
    document.getElementById('pause-overlay').style.display = 'none';

    // Reset State
    puffins = [];
    particles = [];
    gameState = {
        ticks: 0,
        spawned: 0,
        saved: 0,
        dead: 0,
        active: true,
        paused: false,
        timeLeft: lvl.time,
        spawnCountdown: SPAWN_RATE
    };
    
    // Init skills
    SKILLS.forEach(s => { currentSkillCounts[s.id] = lvl.skills[s.id] || 0; });
    
    // Always add the same amount of bombers to a level as there are blockers
    if (currentSkillCounts['blocker'] > 0) {
        currentSkillCounts['bomber'] += currentSkillCounts['blocker'];
    }

    activeSkill = null;
    gameSpeed = 1;
    nukeActivated = false;
    let btnSpeed = document.getElementById('btn-speed');
    if (btnSpeed) btnSpeed.innerText = 'Speed: 1x';
    
    // Reset nuke button
    let nukeBtn = document.getElementById('btn-nuke');
    if (nukeBtn) nukeBtn.classList.remove('disabled');
    
    // Reset release rate controls to the level's default.
    syncReleaseRateControls();
    
    terrainData.fill(0);
    lvl.buildTerrain(terrainData, GAME_WIDTH, GAME_HEIGHT);

    // Pre-settle exit portal before gameplay starts so players see the final
    // physics-valid position immediately on level start.
    settleExitAtSpawn();

    renderTerrainToOffscreen();

    // ── Volumetric liquid: reset then fill from level waterZones ──
    liquidData.fill(0);
    _liquidDirty = false;
    if (liquidCtx) liquidCtx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    if (Array.isArray(lvl.waterZones) && lvl.waterZones.length) {
        initLiquidFromZones(lvl.waterZones);
        renderLiquidLayer();
    }

    // ── Sand, lava, bridge stress reset ───────────────────────────
    sandData.fill(0);
    lavaData.fill(0);
    bridgeStress.fill(0);
    _windX = 0; // will be recomputed every tick in update()
    if (Array.isArray(lvl.lavaZones) && lvl.lavaZones.length) {
        initLavaFromZones(lvl.lavaZones);
        renderLiquidLayer(); // lava is rendered on the same layer
    }
    
    buildUI();
    
    if (loopId !== null) {
        cancelAnimationFrame(loopId);
        loopId = null;
    }
    _lastFrameTime = 0;
    gameLoop();
}

function retryLevel() {
    loadLevel(currentLevelIndex);
}

function nextLevel() {
    if (currentLevelIndex + 1 < LEVELS.length) {
        loadLevel(currentLevelIndex + 1);
    }
}

function buildUI() {
    const container = document.getElementById('skills-panel');
    container.innerHTML = '';
    
    SKILLS.forEach(skill => {
        const btn = document.createElement('div');
        btn.className = 'skill-btn';
        btn.id = `btn-${skill.id}`;
        btn.onclick = () => selectSkill(skill.id);
        
        let count = currentSkillCounts[skill.id];
        
        btn.innerHTML = `
            <div class="skill-count" id="count-${skill.id}">${count}</div>
            <div class="skill-icon">${skill.icon}</div>
            <div class="skill-name">${skill.name}</div>
        `;
        container.appendChild(btn);
    });
    updateUI();
}

function updateUI() {
    document.getElementById('lbl-out').innerText = `${gameState.spawned}/${TOTAL_PUFFINS}`;
    document.getElementById('lbl-in').innerText = `${gameState.saved}/${REQUIRED_PUFFINS}`;
    syncReleaseRateControls();
    
    let secs = Math.floor(gameState.timeLeft / FPS);
    let m = Math.floor(secs / 60);
    let s = secs % 60;
    document.getElementById('lbl-time').innerText = `${m}:${s.toString().padStart(2, '0')}`;
    
    SKILLS.forEach(skill => {
        let count = currentSkillCounts[skill.id];
        let btn = document.getElementById(`btn-${skill.id}`);
        document.getElementById(`count-${skill.id}`).innerText = count;
        
        btn.className = 'skill-btn';
        if (count <= 0) btn.classList.add('empty');
        if (activeSkill === skill.id && count > 0) btn.classList.add('selected');
    });

    // Show/hide cancel-skill button for touch users
    const cancelBtn = document.getElementById('btn-cancel-skill');
    if (cancelBtn) cancelBtn.style.display = activeSkill ? 'inline-flex' : 'none';
}

function checkEndCondition() {
    if (!gameState.active || gameState.ending) return;
    
    let activePuffins = puffins.filter(p => p.state !== ST_DEAD && p.state !== ST_EXITED).length;
    
    if (gameState.timeLeft <= 0 || (gameState.spawned === TOTAL_PUFFINS && activePuffins === 0)) {
        gameState.ending = true;
    setTimeout(() => {
            gameState.active = false;
            
            // Cleanup custom level from editor test
            if (typeof window._customLevelCleanup === 'function') {
                window._customLevelCleanup();
            }
            
            // Sync achievement stats before checking
            if (typeof Achievements !== 'undefined') {
                Achievements.stats.saved = gameState.saved;
                Achievements.stats.dead = gameState.dead;
                Achievements.stats.timeTaken = LEVELS[currentLevelIndex].time - gameState.timeLeft;
                
                // Check if nuke was survived (at least 5 puffins alive after nuke)
                if (nukeActivated) {
                    let survivingAfterNuke = puffins.filter(p => p.state !== ST_DEAD && p.state !== ST_SPLAT).length;
                    Achievements.stats.nukeSurvived = survivingAfterNuke >= 5;
                }
                
                // Check achievements
                Achievements.check(Achievements.stats);
            }
            
            let overlay = document.getElementById('message-overlay');
            let title = document.getElementById('message-title');
            let desc = document.getElementById('message-desc');
            let btnNext = document.getElementById('btn-next');
            
            overlay.style.display = 'flex';
            if (gameState.saved >= REQUIRED_PUFFINS) {
                title.innerText = 'LEVEL COMPLETE!';
                title.style.color = '#5f5';
                desc.innerText = `You saved ${gameState.saved} puffins. Target was ${REQUIRED_PUFFINS}.`;
                playSound('levelComplete');
                if (currentLevelIndex + 1 < LEVELS.length) {
                    btnNext.style.display = 'inline-block';
                } else {
                    btnNext.style.display = 'none';
                    desc.innerText += " You beat the game!";
                }
            } else {
                title.innerText = 'LEVEL FAILED';
                title.style.color = '#f55';
                desc.innerText = `You only saved ${gameState.saved} puffins. Needed ${REQUIRED_PUFFINS}.`;
                playSound('levelFail');
                btnNext.style.display = 'none';
            }
        }, 1500); // 1.5 seconds pause before showing the end screen
    }
}

// Pure requestAnimationFrame loop — no setTimeout latency
let _lastFrameTime = 0;
function gameLoop(timestamp = 0) {
    if (!gameState.active) {
        loopId = null;
        return;
    }
    const elapsed = timestamp - _lastFrameTime;
    if (elapsed >= FRAME_MS || _lastFrameTime === 0) {
        _lastFrameTime = timestamp - (elapsed % FRAME_MS);
        for (let i = 0; i < gameSpeed; i++) {
            if (gameState.active && !gameState.paused) update();
        }
        draw();
    }
    loopId = requestAnimationFrame(gameLoop);
}

function update() {
    gameState.ticks++;
    if (gameState.timeLeft > 0) gameState.timeLeft--;

    if (nukeActivated && nukeCountdown > 0) {
        nukeCountdown--;
    }

    // Exit portal ambience particles.
    if (gameState.ticks % 3 === 0) {
        emitPortalAmbience();
    }
    
    // Spawning
    if (gameState.spawned < TOTAL_PUFFINS) {
        gameState.spawnCountdown--;
        if (gameState.spawnCountdown <= 0) {
            puffins.push(new Puffin(ENTRANCE.x, ENTRANCE.y));
            gameState.spawned++;
            gameState.spawnCountdown = SPAWN_RATE;
        }
    }
    
    // Hover logic
    hoveredPuffin = getBestPuffinAt(mouseX, mouseY, activeSkill);
    
    // Update entities
    // ── Wind (gentle oscillation around theme base value) ──────────
    _windX = (THEME_WIND[getCurrentThemeName()] || 0) * (0.9 + 0.2 * Math.sin(gameState.ticks * 0.009));

    // Apply wind drag to airborne, non-settled particles before they update.
    if (_windX !== 0) {
        particles.forEach(p => {
            if (!p.settled && p.collisionEnabled) p.vx += _windX * 0.1;
        });
    }

    // ── Exit portal gravity: falls when unsupported ──────────
    updateExitGravity();

    puffins.forEach(p => p.update());
    particles.forEach(p => p.update());

    // Accumulate bridge stress: walking/blocking puffins stress the terrain cell
    // under their feet. Only cells with no solid support below can crumble.
    puffins.forEach(p => {
        if (p.state !== ST_WALK && p.state !== ST_BLOCK) return;
        const footX = Math.floor(p.x + PUFFIN_W / 2);
        const footY = Math.floor(p.y + PUFFIN_H);
        if (footX < 0 || footX >= GAME_WIDTH || footY < 0 || footY >= GAME_HEIGHT) return;
        const idx = footY * GAME_WIDTH + footX;
        if (bridgeStress[idx] < 65535) bridgeStress[idx]++;
    });

    // Cleanup particles
    particles = particles.filter(p => p.life > 0 || p.isPermanent);

    // UI
    if (gameState.ticks % 10 === 0) updateUI();

    // Simulation subsystems (staggered across ticks to spread CPU cost)
    if (gameState.ticks % 2  === 0) updateLiquid();
    if (gameState.ticks % 3  === 0) updateSand();
    updateLava();   // internally throttled by LAVA_FLOW_INTERVAL
    if (gameState.ticks % 30 === 0) checkBridgeCollapse();
    
    // Update achievement display timer
    if (typeof Achievements !== 'undefined') {
        Achievements.update();
    }
    
    checkEndCondition();
}

// ─── Exit Portal Gravity ──────────────────────────────────────────────────────
// The portal needs at least 40% of its width supported by solid terrain to stay
// put.  When partially supported it tips toward the heavier side and slides off.
function updateExitGravity() {
    const bottomY = Math.floor(EXIT.y + EXIT.h);
    if (bottomY >= GAME_HEIGHT - 1) return; // already at the world floor

    const x0 = Math.floor(EXIT.x);
    const x1 = Math.floor(EXIT.x + EXIT.w);
    const portalW = x1 - x0;

    // Count solid pixels under the portal and track their weighted position.
    let solidCount = 0;
    let solidSumX = 0;
    for (let x = x0; x < x1; x++) {
        if (x < 0 || x >= GAME_WIDTH) continue;
        if (isSolidAt(x, bottomY)) {
            solidCount++;
            solidSumX += x;
        }
    }

    const supportRatio = solidCount / portalW;
    const MIN_SUPPORT = 0.4; // need 40 % of width supported

    if (supportRatio >= MIN_SUPPORT) return; // stable

    if (solidCount === 0) {
        // No support at all — fall straight down.
        EXIT.y += 1;
        return;
    }

    // Partially supported — tip toward the unsupported side.
    const supportCenterX = solidSumX / solidCount;
    const portalCenterX  = (x0 + x1) / 2;

    // Support is left of center → portal tips right, and vice-versa.
    if (supportCenterX < portalCenterX - 0.5) {
        EXIT.x += 1;
    } else if (supportCenterX > portalCenterX + 0.5) {
        EXIT.x -= 1;
    }
    EXIT.y += 1;
}

function settleExitAtSpawn(maxSteps = 240) {
    for (let i = 0; i < maxSteps; i++) {
        const prevX = EXIT.x;
        const prevY = EXIT.y;
        updateExitGravity();
        if (EXIT.x === prevX && EXIT.y === prevY) {
            return;
        }
    }
}

// ─── Bridge Collapse ──────────────────────────────────────────────────────────
// Scans for heavily-stressed terrain cells that have no solid support below.
// When stress exceeds threshold the cell crumbles — only spans/overhangs, never
// floor cells (those cells always have terrain beneath them).
function checkBridgeCollapse() {
    const W = GAME_WIDTH, H = GAME_HEIGHT;
    for (let y = 1; y < H - 1; y++) {
        for (let x = 0; x < W; x++) {
            const i = y * W + x;
            if (bridgeStress[i] < BRIDGE_COLLAPSE_THRESHOLD) continue;
            if (terrainData[i] === 0 || terrainData[i] === 10) continue; // air or steel
            // Only collapse if the cell immediately below is open air —
            // that means this cell is a span, not a supported floor.
            if (terrainData[i + W] !== 0) continue;

            bridgeStress[i] = 0;
            setTerrain(x, y, 0);
            updateTerrainPixels(x - 1, y - 1, 3, 3); // redraw neighbourhood
            // Debris particle burst
            const debrisColor = getThemeColors().terrain;
            for (let d = 0; d < 5; d++) {
                const p = new Particle(x + Math.random(), y + Math.random(), debrisColor, false);
                p.vx = (Math.random() - 0.5) * 4;
                p.vy = 0.5 + Math.random() * 3;
                p.life = 14 + Math.random() * 10;
                particles.push(p);
            }
        }
    }
}

// ─── Scene Props ──────────────────────────────────────────────────────────────
function drawIcicle(ctx, x, y, h, theme) {
    const n = hashNoise2D(x * 11 + 3, y * 7 + 5);
    const a = 0.60 + n * 0.30;
    ctx.fillStyle = theme === 'crystal'
        ? `rgba(195, 140, 255, ${a})`
        : theme === 'snow'
            ? `rgba(215, 238, 255, ${a})`
            : `rgba(148, 205, 255, ${a})`;
    ctx.fillRect(x, y, 1, h - 1);
    ctx.fillStyle = `rgba(220, 248, 255, ${a * 0.45})`;
    ctx.fillRect(x, y + h - 1, 1, 1);
    if (h >= 3) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
        ctx.fillRect(x, y, 1, 1);
    }
}

function drawRopeBridge(ctx, prop) {
    const { x1, y1, x2, y2, sag = 12 } = prop;
    const midX = (x1 + x2) / 2;
    // Anchor posts
    ctx.fillStyle = '#3a1e06';
    ctx.fillRect(x1 - 1, y1 - 12, 3, 13);
    ctx.fillRect(x2 - 1, y2 - 12, 3, 13);
    ctx.fillStyle = '#6a3a10';
    ctx.fillRect(x1 - 2, y1 - 13, 5, 2);
    ctx.fillRect(x2 - 2, y2 - 13, 5, 2);
    // Top rope
    ctx.strokeStyle = '#6a4418';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(x1 + 1, y1 - 10);
    ctx.quadraticCurveTo(midX, y1 - 10 + sag, x2 + 1, y2 - 10);
    ctx.stroke();
    // Lower rope
    ctx.beginPath();
    ctx.moveTo(x1 + 1, y1 - 4);
    ctx.quadraticCurveTo(midX, y1 - 4 + sag, x2 + 1, y2 - 4);
    ctx.stroke();
    // Planks with vertical hangers
    const steps = Math.round((x2 - x1) / 7);
    for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const bx   = x1 + (x2 - x1) * t;
        const byTop = (y1 - 10) + t * (y2 - y1) + 4 * sag * t * (1 - t);
        const byBot = (y1 -  4) + t * (y2 - y1) + 4 * sag * t * (1 - t);
        ctx.strokeStyle = 'rgba(100, 65, 25, 0.7)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(Math.floor(bx) + 1, Math.floor(byTop));
        ctx.lineTo(Math.floor(bx) + 1, Math.floor(byBot));
        ctx.stroke();
        ctx.fillStyle = '#8c5a28';
        ctx.fillRect(Math.floor(bx) - 3, Math.floor(byBot) - 1, 6, 2);
    }
}

function drawSignPost(ctx, prop) {
    const { x, y, text, dir = 'right' } = prop;

    // Choose the clearer side so sign text is less likely to overlap dense terrain.
    function scoreSide(side) {
        const boardX = side === 'right' ? x + 2 : x - 14;
        const startX = Math.max(0, boardX - 1);
        const endX = Math.min(GAME_WIDTH - 1, boardX + 14);
        const startY = Math.max(0, y - 13);
        const endY = Math.min(GAME_HEIGHT - 1, y + 2);
        let score = 0;

        for (let sy = startY; sy <= endY; sy++) {
            for (let sx = startX; sx <= endX; sx++) {
                if (terrainData[sy * GAME_WIDTH + sx] !== 0) score++;
            }
        }
        return score;
    }

    const preferredDir = prop.autoDir === false
        ? dir
        : (scoreSide('right') <= scoreSide('left') ? 'right' : 'left');

    const boardX = preferredDir === 'right' ? x + 2 : x - 14;
    // Post
    ctx.fillStyle = '#3a1e06';
    ctx.fillRect(x, y, 2, 14);
    // Board
    ctx.fillStyle = '#7a4818';
    ctx.fillRect(boardX, y - 11, 14, 9);
    ctx.fillStyle = '#5a320e';
    ctx.fillRect(boardX, y - 11, 14, 1);
    // Text
    ctx.fillStyle = '#ffe090';
    ctx.font = '6px monospace';
    ctx.textAlign = preferredDir === 'right' ? 'left' : 'right';
    ctx.fillText(text, boardX + (preferredDir === 'right' ? 2 : 12), y - 4);
    ctx.textAlign = 'left';
}

function drawWaterZone(ctx, prop, ticks) {
    const { x, y, w, h } = prop;
    const t = ticks * 0.06;

    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, 'rgba(80, 205, 245, 0.34)');
    grad.addColorStop(0.55, 'rgba(20, 125, 190, 0.42)');
    grad.addColorStop(1, 'rgba(8, 62, 118, 0.52)');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);

    // Crest line and small moving highlights to make water feel alive.
    const wave = Math.sin(t) * 1.8;
    ctx.fillStyle = 'rgba(200, 248, 255, 0.36)';
    ctx.fillRect(x, y + wave, w, 2);

    for (let i = 0; i < 18; i++) {
        const sx = x + ((i * 29 + ticks * 1.3) % w);
        const sy = y + 3 + (i % 3) * 2;
        ctx.fillStyle = 'rgba(230, 255, 255, 0.15)';
        ctx.fillRect(Math.floor(sx), Math.floor(sy), 6, 1);
    }
}

function drawSceneProps(ctx) {
    const theme = getCurrentThemeName();
    const lvl = LEVELS[currentLevelIndex];
    const icyThemes = new Set(['ice', 'snow', 'crystal', 'black_ice', 'packed_snow', 'frozen_mud', 'crystal_dense', 'cliff_chalk']);
    const grassThemes = new Set(['grass', 'mossy', 'mossy_ruin', 'fungus_glow', 'concept_999']);

    // Water zones are now handled by the volumetric liquid simulation.
    // drawWaterZone() calls are intentionally removed here.

    // Level-specific declared props (ropes, signs; water props now rendered via liquid layer)
    if (lvl && lvl.props) {
        for (const prop of lvl.props) {
            if (prop.type === 'rope')      drawRopeBridge(ctx, prop);
            else if (prop.type === 'sign') drawSignPost(ctx, prop);
            // 'water' props are handled by liquid simulation — skip them here
        }
    }

    // Auto terrain-edge details (every 3rd column)
    const isIcy  = icyThemes.has(theme);
    const isGrass = grassThemes.has(theme);
    for (let x = 1; x < GAME_WIDTH - 1; x += 3) {
        let passedTop = false;
        for (let y = 2; y < GAME_HEIGHT - 2; y++) {
            const v   = terrainData[y * GAME_WIDTH + x];
            const abv = terrainData[(y - 1) * GAME_WIDTH + x];
            const blw = terrainData[(y + 1) * GAME_WIDTH + x];

            // Top surface edge → grass tufts or snow cap
            if (!passedTop && v !== 0 && abv === 0) {
                passedTop = true;
                if (isGrass) {
                    const n = hashNoise2D(x * 3 + 1, y + 2);
                    if (n > 0.2) {
                        ctx.fillStyle = `rgba(${(40 + n * 20) | 0}, ${(110 + n * 65) | 0}, 18, 0.82)`;
                        ctx.fillRect(x, y - 2, 1, 2);
                        if (n > 0.55) ctx.fillRect(x - 1, y - 1, 1, 1);
                        if (n > 0.75) ctx.fillRect(x + 1, y - 1, 1, 1);
                    }
                } else if (theme === 'snow' || theme === 'packed_snow') {
                    ctx.fillStyle = 'rgba(230, 245, 255, 0.72)';
                    ctx.fillRect(x, y - 1, 1, 1);
                    if (hashNoise2D(x + 5, y) > 0.52) ctx.fillRect(x, y - 2, 1, 1);
                }
            }

            // Bottom ledge edge → icicles for cold themes
            if (v !== 0 && blw === 0) {
                if (isIcy) {
                    let air = 0;
                    for (let dy = 1; dy <= 6 && y + dy < GAME_HEIGHT; dy++) {
                        if (terrainData[(y + dy) * GAME_WIDTH + x] === 0) air++;
                        else break;
                    }
                    if (air >= 4) {
                        const n = hashNoise2D(x * 7 + 5, y * 3 + 11);
                        if (n > 0.35) {
                            drawIcicle(ctx, x, y + 1, 2 + ((n * 5) | 0), theme);
                        }
                    }
                }
            }
        }
    }
}

function drawThemeAtmosphere(ctx, layer) {
    const theme = getCurrentThemeName();
    const t = gameState.ticks;
    const isFront = layer === 'front';
    const snowThemes = new Set(['snow', 'packed_snow', 'black_ice', 'frozen_mud', 'cliff_chalk']);
    const lavaThemes = new Set(['lava', 'volcanic_ash', 'obsidian_floor', 'toxic_sludge']);
    const crystalThemes = new Set(['crystal', 'crystal_dense', 'fungus_glow']);
    const desertThemes = new Set(['desert', 'salt_flats']);
    const iceThemes = new Set(['ice', 'black_ice', 'packed_snow', 'frozen_mud']);
    const grassThemes = new Set(['grass', 'mossy', 'mossy_ruin', 'concept_999']);
    const rockThemes = new Set(['rock', 'slate_ledge', 'wet_cave_stone', 'rusty_metal', 'wood_planks', 'cave']);

    if (snowThemes.has(theme)) {
        const count = isFront ? 22 : 12;
        for (let i = 0; i < count; i++) {
            const seed = i * 17 + (isFront ? 200 : 40);
            const x = ((seed * 29 + t * (isFront ? 1.2 : 0.6)) % (GAME_WIDTH + 16)) - 8;
            const y = ((seed * 19 + t * (isFront ? 0.9 : 0.45)) % (GAME_HEIGHT + 30)) - 14;
            const drift = Math.sin((t + seed) * 0.03) * (isFront ? 2.2 : 1.2);
            ctx.fillStyle = isFront ? 'rgba(235, 246, 255, 0.34)' : 'rgba(220, 238, 255, 0.22)';
            ctx.fillRect(Math.floor(x + drift), Math.floor(y), 1, 1);
        }
        return;
    }

    if (lavaThemes.has(theme)) {
        // Heat shimmer
        const shimmer = 0.025 + Math.sin(t * 0.03) * 0.01;
        ctx.fillStyle = `rgba(255, 140, 70, ${isFront ? shimmer * 1.4 : shimmer})`;
        for (let y = 120; y < GAME_HEIGHT; y += 9) {
            const wobble = Math.sin((t * 0.05) + y * 0.12) * 3;
            ctx.fillRect(8 + wobble, y, GAME_WIDTH - 16, 2);
        }
        // Embers
        const count = isFront ? 16 : 9;
        for (let i = 0; i < count; i++) {
            const seed = i * 31 + (isFront ? 300 : 120);
            const x = (seed * 13 + t * 0.65) % GAME_WIDTH;
            const y = GAME_HEIGHT - ((seed * 11 + t * (isFront ? 1.35 : 0.95)) % 78);
            const glow = 0.25 + Math.abs(Math.sin((t + seed) * 0.08)) * 0.35;
            ctx.fillStyle = `rgba(255, ${120 + ((seed * 7) % 70)}, 40, ${glow * (isFront ? 1.0 : 0.7)})`;
            ctx.fillRect(Math.floor(x), Math.floor(y), 1, 1);
        }
        return;
    }

    if (crystalThemes.has(theme)) {
        const count = isFront ? 14 : 10;
        for (let i = 0; i < count; i++) {
            const seed = i * 23 + (isFront ? 420 : 180);
            const x = (seed * 37 + t * 0.25) % GAME_WIDTH;
            const y = 26 + ((seed * 17 + t * 0.18) % 150);
            const twinkle = Math.abs(Math.sin((t + seed) * 0.07));
            if (twinkle > (isFront ? 0.56 : 0.7)) {
                ctx.fillStyle = `rgba(210, 180, 255, ${isFront ? 0.34 : 0.22})`;
                ctx.fillRect(Math.floor(x), Math.floor(y), 1, 1);
                if (twinkle > 0.9) {
                    ctx.fillStyle = 'rgba(245, 236, 255, 0.38)';
                    ctx.fillRect(Math.floor(x) - 1, Math.floor(y), 3, 1);
                    ctx.fillRect(Math.floor(x), Math.floor(y) - 1, 1, 3);
                }
            }
        }
        return;
    }

    if (desertThemes.has(theme)) {
        const bandAlpha = isFront ? 0.08 : 0.05;
        for (let i = 0; i < 4; i++) {
            const y = 122 + i * 16;
            const drift = Math.sin(t * 0.018 + i * 1.4) * (isFront ? 7 : 4);
            ctx.fillStyle = `rgba(235, 190, 120, ${bandAlpha})`;
            ctx.fillRect(-20 + drift, y, GAME_WIDTH + 40, 5);
        }
        return;
    }

    if (iceThemes.has(theme)) {
        const glints = isFront ? 12 : 8;
        for (let i = 0; i < glints; i++) {
            const seed = i * 29 + (isFront ? 140 : 70);
            const x = (seed * 21 + t * 0.45) % GAME_WIDTH;
            const y = 110 + ((seed * 13 + t * 0.28) % 85);
            const pulse = Math.abs(Math.sin((t + seed) * 0.05));
            if (pulse > 0.62) {
                ctx.fillStyle = `rgba(170, 230, 255, ${isFront ? 0.28 : 0.18})`;
                ctx.fillRect(Math.floor(x), Math.floor(y), 2, 1);
            }
        }
        return;
    }

    if (grassThemes.has(theme)) {
        // Fireflies in front layer only
        if (!isFront) return;
        for (let i = 0; i < 10; i++) {
            const seed = i * 41 + 9;
            const x = (seed * 23 + t * 0.22) % GAME_WIDTH;
            const y = 120 + ((seed * 7 + t * 0.15) % 70);
            const glow = Math.abs(Math.sin((t + seed) * 0.065));
            if (glow > 0.58) {
                ctx.fillStyle = `rgba(255, 245, 145, ${0.18 + glow * 0.34})`;
                ctx.fillRect(Math.floor(x), Math.floor(y), 1, 1);
            }
        }
        return;
    }

    if (rockThemes.has(theme)) {
        const count = isFront ? 10 : 7;
        for (let i = 0; i < count; i++) {
            const seed = i * 33 + (isFront ? 230 : 90);
            const x = (seed * 19 + t * 0.3) % GAME_WIDTH;
            const y = 115 + ((seed * 11 + t * 0.22) % 90);
            ctx.fillStyle = isFront ? 'rgba(180, 185, 195, 0.14)' : 'rgba(150, 155, 165, 0.10)';
            ctx.fillRect(Math.floor(x), Math.floor(y), 1, 1);
        }
    }
}

function drawThemeBackground(ctx) {
    const theme = getCurrentThemeName();
    const t = gameState.ticks;
    const arcticThemes   = new Set(['snow','ice','packed_snow','frozen_mud','black_ice']);
    const volcanicThemes = new Set(['lava','volcanic_ash','obsidian_floor']);
    const desertBgThemes = new Set(['desert','salt_flats','sandstone']);
    const caveThemes     = new Set(['cave','wet_cave_stone','iron_ore','mud']);
    const underThemes    = new Set(['water','deep_sea','coral']);
    const magicThemes    = new Set(['crystal','crystal_dense','fungus_glow','toxic_sludge','amber']);

    if (arcticThemes.has(theme)) {
        // Stars
        const stars = [
            {x:  15, y:  8, s:1, sp:0.018}, {x:  42, y: 22, s:1, sp:0.031},
            {x:  78, y: 12, s:2, sp:0.014}, {x: 105, y: 35, s:1, sp:0.022},
            {x: 138, y:  6, s:1, sp:0.028}, {x: 165, y: 48, s:2, sp:0.017},
            {x: 195, y: 18, s:1, sp:0.033}, {x: 230, y: 55, s:1, sp:0.025},
            {x: 258, y: 10, s:2, sp:0.019}, {x: 285, y: 32, s:1, sp:0.038},
            {x: 312, y: 68, s:1, sp:0.021}, {x: 345, y: 14, s:2, sp:0.016},
            {x: 372, y: 42, s:1, sp:0.029}, {x: 390, y: 22, s:1, sp:0.024},
            {x:  60, y: 75, s:1, sp:0.036}, {x: 210, y: 76, s:1, sp:0.020},
            {x: 330, y: 90, s:1, sp:0.027}, {x:  88, y: 50, s:1, sp:0.041}
        ];
        stars.forEach(star => {
            let brightness = 0.35 + Math.sin(t * star.sp + star.x * 0.1) * 0.45;
            ctx.fillStyle = `rgba(240, 245, 255, ${brightness})`;
            ctx.fillRect(star.x, star.y, star.s, star.s);
        });
        // Moon — outer glow halo
        ctx.fillStyle = 'rgba(255, 245, 220, 0.12)';
        ctx.beginPath(); ctx.arc(320, 38, 22, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = 'rgba(255, 245, 220, 0.20)';
        ctx.beginPath(); ctx.arc(320, 38, 18, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#ede8d8';
        ctx.beginPath(); ctx.arc(320, 38, 14, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.10)';
        ctx.beginPath(); ctx.arc(315, 34, 3.5, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.08)';
        ctx.beginPath(); ctx.arc(323, 41, 2.5, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(312, 42, 1.5, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(326, 33, 1.0, 0, Math.PI*2); ctx.fill();
        // Aurora borealis
        let auroraOffset = Math.sin(t * 0.01) * 10;
        ctx.fillStyle = `rgba(0, 255, 100, ${0.07 + Math.sin(t * 0.005) * 0.03})`;
        ctx.beginPath();
        ctx.moveTo(0, 80 + auroraOffset);
        ctx.quadraticCurveTo(200, 28 + auroraOffset, 400, 88 + auroraOffset);
        ctx.lineTo(400, 0); ctx.lineTo(0, 0); ctx.fill();
        ctx.fillStyle = `rgba(0, 150, 255, ${0.05 + Math.sin(t * 0.008 + 1) * 0.025})`;
        ctx.beginPath();
        ctx.moveTo(0, 100 + auroraOffset);
        ctx.quadraticCurveTo(150, 48 + auroraOffset, 400, 108 + auroraOffset);
        ctx.lineTo(400, 0); ctx.lineTo(0, 0); ctx.fill();
        ctx.fillStyle = `rgba(180, 0, 255, ${0.03 + Math.sin(t * 0.006 + 2) * 0.02})`;
        ctx.beginPath();
        ctx.moveTo(0, 90 + auroraOffset);
        ctx.quadraticCurveTo(280, 38 + auroraOffset, 400, 95 + auroraOffset);
        ctx.lineTo(400, 0); ctx.lineTo(0, 0); ctx.fill();
        // Parallax ridges
        const driftFar = Math.sin(t * 0.002) * 4;
        const driftMid = Math.sin(t * 0.003 + 0.8) * 6;
        ctx.save();
        ctx.translate(driftFar, 0);
        ctx.fillStyle = 'rgba(20, 36, 60, 0.45)';
        ctx.beginPath();
        ctx.moveTo(-12, 126);
        ctx.lineTo(24, 94); ctx.lineTo(60, 102); ctx.lineTo(92, 78);
        ctx.lineTo(126, 88); ctx.lineTo(162, 66); ctx.lineTo(198, 82);
        ctx.lineTo(235, 62); ctx.lineTo(275, 78); ctx.lineTo(312, 58);
        ctx.lineTo(350, 74); ctx.lineTo(388, 64); ctx.lineTo(420, 80);
        ctx.lineTo(420, 126); ctx.closePath(); ctx.fill();
        ctx.restore();
        ctx.save();
        ctx.translate(driftMid, 0);
        ctx.fillStyle = 'rgba(35, 58, 88, 0.58)';
        ctx.beginPath();
        ctx.moveTo(-16, 140);
        ctx.lineTo(22, 108); ctx.lineTo(48, 118); ctx.lineTo(78, 92);
        ctx.lineTo(108, 102); ctx.lineTo(138, 82); ctx.lineTo(170, 98);
        ctx.lineTo(202, 78); ctx.lineTo(236, 96); ctx.lineTo(266, 74);
        ctx.lineTo(298, 90); ctx.lineTo(328, 84); ctx.lineTo(360, 96);
        ctx.lineTo(390, 86); ctx.lineTo(420, 100);
        ctx.lineTo(420, 140); ctx.closePath(); ctx.fill();
        ctx.restore();
        // Snow caps on visible peaks
        ctx.fillStyle = 'rgba(215, 233, 255, 0.22)';
        [[78,92],[138,82],[202,78],[266,74],[328,84]].forEach(([px, py]) => {
            ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px+11, py+11); ctx.lineTo(px-11, py+11); ctx.closePath(); ctx.fill();
        });
        // Haze
        let hazeAlpha = 0.08 + Math.sin(t * 0.006) * 0.02;
        ctx.fillStyle = `rgba(170, 210, 255, ${hazeAlpha})`;
        ctx.fillRect(0, 84, GAME_WIDTH, 46);
        return;
    }

    if (volcanicThemes.has(theme)) {
        // Glowing lava horizon
        let horizonGlow = 0.18 + Math.sin(t * 0.022) * 0.06;
        ctx.fillStyle = `rgba(255, 80, 20, ${horizonGlow * 0.5})`;
        ctx.fillRect(0, 110, GAME_WIDTH, 35);
        ctx.fillStyle = `rgba(255, 130, 40, ${horizonGlow * 0.22})`;
        ctx.fillRect(0, 96, GAME_WIDTH, 20);
        // Jagged volcanic ridges
        ctx.save();
        ctx.translate(Math.sin(t * 0.002) * 3, 0);
        ctx.fillStyle = 'rgba(14, 8, 6, 0.82)';
        ctx.beginPath();
        ctx.moveTo(-10, 130);
        ctx.lineTo(18, 96); ctx.lineTo(35, 118); ctx.lineTo(58, 84);
        ctx.lineTo(80, 102); ctx.lineTo(105, 72); ctx.lineTo(130, 96);
        ctx.lineTo(158, 66); ctx.lineTo(185, 90); ctx.lineTo(215, 62);
        ctx.lineTo(245, 86); ctx.lineTo(272, 58); ctx.lineTo(298, 80);
        ctx.lineTo(325, 54); ctx.lineTo(355, 76); ctx.lineTo(385, 62);
        ctx.lineTo(420, 82); ctx.lineTo(420, 130); ctx.closePath(); ctx.fill();
        ctx.restore();
        // Distant embers on ridge line
        for (let i = 0; i < 5; i++) {
            const ex = (i * 87 + t * 0.22) % GAME_WIDTH;
            const ey = 66 + ((i * 23 + t * 0.10) % 28);
            const eg = 0.10 + Math.abs(Math.sin((t + i * 13) * 0.04)) * 0.18;
            ctx.fillStyle = `rgba(255, ${100 + i * 15}, 20, ${eg})`;
            ctx.fillRect(Math.floor(ex), Math.floor(ey), 2, 1);
        }
        return;
    }

    if (desertBgThemes.has(theme)) {
        // Warm glow near horizon
        ctx.fillStyle = 'rgba(240, 170, 60, 0.10)';
        ctx.fillRect(0, 88, GAME_WIDTH, 50);
        // Rounded dune silhouettes
        const driftFar = Math.sin(t * 0.0015) * 3;
        const driftMid = Math.sin(t * 0.0022 + 1.2) * 5;
        ctx.save();
        ctx.translate(driftFar, 0);
        ctx.fillStyle = 'rgba(80, 48, 16, 0.38)';
        ctx.beginPath();
        ctx.moveTo(-10, 130);
        ctx.bezierCurveTo(40, 130, 65, 90, 105, 96);
        ctx.bezierCurveTo(145, 102, 168, 80, 210, 86);
        ctx.bezierCurveTo(250, 92, 272, 70, 312, 78);
        ctx.bezierCurveTo(352, 86, 378, 76, 420, 84);
        ctx.lineTo(420, 130); ctx.closePath(); ctx.fill();
        ctx.restore();
        ctx.save();
        ctx.translate(driftMid, 0);
        ctx.fillStyle = 'rgba(110, 70, 24, 0.52)';
        ctx.beginPath();
        ctx.moveTo(-10, 142);
        ctx.bezierCurveTo(30, 142, 55, 112, 95, 118);
        ctx.bezierCurveTo(135, 124, 158, 102, 198, 108);
        ctx.bezierCurveTo(238, 114, 262, 92, 302, 100);
        ctx.bezierCurveTo(342, 108, 370, 96, 420, 106);
        ctx.lineTo(420, 142); ctx.closePath(); ctx.fill();
        ctx.restore();
        // Heat shimmer band
        let shimmerAlpha = 0.06 + Math.sin(t * 0.025) * 0.02;
        ctx.fillStyle = `rgba(255, 210, 110, ${shimmerAlpha})`;
        ctx.fillRect(0, 116, GAME_WIDTH, 18);
        return;
    }

    if (caveThemes.has(theme)) {
        // Darkness above with stalactite silhouettes
        ctx.fillStyle = 'rgba(5, 3, 2, 0.70)';
        ctx.fillRect(0, 0, GAME_WIDTH, 68);
        for (let i = 0; i < 12; i++) {
            const sx = 12 + i * 34 + ((i * 17) % 18) - 8;
            const sh = 10 + ((i * 11) % 20);
            ctx.fillStyle = 'rgba(18, 14, 12, 0.80)';
            ctx.beginPath();
            ctx.moveTo(sx - 6, 0); ctx.lineTo(sx + 6, 0); ctx.lineTo(sx, sh); ctx.closePath(); ctx.fill();
        }
        // Dripping water glints
        for (let i = 0; i < 6; i++) {
            const dx = (i * 67 + t * 0.3) % GAME_WIDTH;
            const dy = 16 + ((i * 13 + t * 0.8) % 22);
            ctx.fillStyle = 'rgba(130, 175, 210, 0.18)';
            ctx.fillRect(Math.floor(dx), Math.floor(dy), 1, 2);
        }
        return;
    }

    if (underThemes.has(theme)) {
        // Caustic light columns from above
        for (let i = 0; i < 8; i++) {
            const cx = (i * 54 + Math.sin(t * 0.018 + i * 0.9) * 12 + GAME_WIDTH) % GAME_WIDTH;
            const cw = 8 + ((i * 7) % 12);
            const alpha = 0.04 + Math.abs(Math.sin(t * 0.025 + i * 1.3)) * 0.07;
            ctx.fillStyle = `rgba(100, 210, 235, ${alpha})`;
            ctx.fillRect(Math.floor(cx), 0, cw, GAME_HEIGHT);
        }
        // Surface glow at top
        let surfaceGlow = 0.10 + Math.sin(t * 0.03) * 0.04;
        ctx.fillStyle = `rgba(80, 200, 230, ${surfaceGlow})`;
        ctx.fillRect(0, 0, GAME_WIDTH, 28);
        // Rising bubble trails
        for (let i = 0; i < 12; i++) {
            const bx = (i * 38 + t * 0.18) % GAME_WIDTH;
            const by = GAME_HEIGHT - ((i * 41 + t * (0.45 + (i % 4) * 0.18)) % GAME_HEIGHT);
            ctx.fillStyle = 'rgba(200, 240, 255, 0.10)';
            ctx.fillRect(Math.floor(bx), Math.floor(by), 1, 2);
        }
        return;
    }

    if (magicThemes.has(theme)) {
        const [r, g, b] = theme === 'amber'        ? [255, 190, 60]
                        : theme === 'fungus_glow'  ? [80, 255, 170]
                        : theme === 'toxic_sludge' ? [160, 230, 60]
                        : [200, 140, 255];
        // Tinted stars
        const starPositions = [
            {x:22,  y:12, s:1, sp:0.022}, {x:60,  y:26, s:1, sp:0.018},
            {x:96,  y:10, s:2, sp:0.031}, {x:138, y:38, s:1, sp:0.025},
            {x:175, y: 6, s:1, sp:0.019}, {x:215, y:50, s:2, sp:0.028},
            {x:252, y:18, s:1, sp:0.034}, {x:290, y:34, s:1, sp:0.021},
            {x:325, y:58, s:2, sp:0.017}, {x:358, y:22, s:1, sp:0.029},
            {x:385, y:46, s:1, sp:0.024}, {x:68,  y:64, s:1, sp:0.038}
        ];
        starPositions.forEach(star => {
            let brightness = 0.25 + Math.sin(t * star.sp + star.x * 0.08) * 0.38;
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${brightness})`;
            ctx.fillRect(star.x, star.y, star.s, star.s);
        });
        // Bioluminescent glow orbs
        for (let i = 0; i < 4; i++) {
            const bx = 45 + i * 88 + Math.sin(t * 0.012 + i) * 8;
            const by = 46 + Math.sin(t * 0.018 + i * 1.7) * 14;
            const ba = 0.05 + Math.sin(t * 0.02 + i * 2.3) * 0.035;
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${ba})`;
            ctx.beginPath(); ctx.arc(bx, by, 22, 0, Math.PI*2); ctx.fill();
        }
        return;
    }

    // Default: faint stars for remaining themes (grass, rock, mossy, cliff, etc.)
    const defaultStars = [
        {x: 32, y:14, s:1, sp:0.025}, {x: 82, y: 8, s:1, sp:0.019},
        {x:144, y:30, s:2, sp:0.031}, {x:202, y:12, s:1, sp:0.022},
        {x:262, y:36, s:1, sp:0.027}, {x:315, y:18, s:2, sp:0.015},
        {x:362, y:26, s:1, sp:0.033}
    ];
    defaultStars.forEach(star => {
        let brightness = 0.18 + Math.sin(t * star.sp + star.x * 0.1) * 0.28;
        ctx.fillStyle = `rgba(240, 245, 255, ${brightness})`;
        ctx.fillRect(star.x, star.y, star.s, star.s);
    });
}

function drawThemeMist(ctx) {
    const theme = getCurrentThemeName();
    const t = gameState.ticks;
    const mistBase  = 0.14 + Math.sin(t * 0.009) * 0.03;
    const mistDrift = Math.sin(t * 0.01) * 3;
    const volcanicThemes = new Set(['lava','volcanic_ash','obsidian_floor']);
    const desertBgThemes = new Set(['desert','salt_flats','sandstone']);
    const caveThemes     = new Set(['cave','wet_cave_stone','iron_ore','mud']);
    const underThemes    = new Set(['water','deep_sea','coral']);
    const magicThemes    = new Set(['crystal','crystal_dense','fungus_glow','toxic_sludge','amber']);
    let c1, c2, c3, s1, s2;
    if (volcanicThemes.has(theme)) {
        c1=[255,120,60]; c2=[220,80,30]; c3=[180,50,15]; s1=[255,140,80]; s2=[220,100,50];
    } else if (desertBgThemes.has(theme)) {
        c1=[235,185,100]; c2=[210,155,70]; c3=[185,130,50]; s1=[240,200,120]; s2=[220,175,90];
    } else if (caveThemes.has(theme)) {
        c1=[30,28,26]; c2=[22,20,18]; c3=[14,12,10]; s1=[40,36,32]; s2=[30,28,24];
    } else if (underThemes.has(theme)) {
        c1=[60,180,210]; c2=[40,160,195]; c3=[25,140,180]; s1=[80,200,230]; s2=[60,180,215];
    } else if (magicThemes.has(theme)) {
        const [r,g,b] = theme==='amber'?[220,160,50]:theme==='fungus_glow'?[60,200,140]:theme==='toxic_sludge'?[120,180,40]:[150,100,220];
        c1=[r,g,b]; c2=[r*.85|0,g*.85|0,b*.85|0]; c3=[r*.7|0,g*.7|0,b*.7|0]; s1=[r,g,b]; s2=[r*.9|0,g*.9|0,b*.9|0];
    } else {
        c1=[185,225,255]; c2=[140,198,245]; c3=[95,160,220]; s1=[205,235,255]; s2=[185,222,250];
    }
    let mistGrad = ctx.createLinearGradient(0, 126, 0, GAME_HEIGHT);
    mistGrad.addColorStop(0,    `rgba(${c1[0]},${c1[1]},${c1[2]},${mistBase * 0.12})`);
    mistGrad.addColorStop(0.55, `rgba(${c2[0]},${c2[1]},${c2[2]},${mistBase * 0.35})`);
    mistGrad.addColorStop(1,    `rgba(${c3[0]},${c3[1]},${c3[2]},${mistBase * 0.55})`);
    ctx.fillStyle = mistGrad;
    ctx.fillRect(0, 124, GAME_WIDTH, GAME_HEIGHT - 124);
    ctx.fillStyle = `rgba(${s1[0]},${s1[1]},${s1[2]},0.08)`;
    ctx.fillRect(14 + mistDrift, 138, 145, 10);
    ctx.fillRect(188 - mistDrift * 0.6, 146, 130, 8);
    ctx.fillStyle = `rgba(${s2[0]},${s2[1]},${s2[2]},0.06)`;
    ctx.fillRect(78 - mistDrift * 0.4, 156, 170, 9);
}

function draw() {
    // CSS-pixel dimensions for gradients (independent of DPR canvas scale)
    const dpr  = window._canvasDPR || 1;
    const drawW = canvas.width  / dpr; // = GAME_WIDTH  * SCALE
    const drawH = canvas.height / dpr; // = GAME_HEIGHT * SCALE

    const currentTheme = getCurrentThemeName();
    const frameTime = gameState.ticks / FPS;
    const sky = getThemeSkyColors();
    const useHybridWebGLBase = !!(renderer && typeof renderer.supportsHybridBasePass === 'function' && renderer.supportsHybridBasePass());
    let skyHandledByWebGL = false;
    if (useHybridWebGLBase && typeof renderer.renderSkyLayer === 'function') {
        skyHandledByWebGL = _runWebGLEffect('skyLayer', () => renderer.renderSkyLayer(ctx, sky, drawW, drawH));
    }
    if (!skyHandledByWebGL) {
        let skyGrad = ctx.createLinearGradient(0, 0, 0, drawH);
        skyGrad.addColorStop(0, sky.top);
        skyGrad.addColorStop(0.55, sky.mid);
        skyGrad.addColorStop(1, sky.bot);
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, drawW, drawH);
        ctx.fillStyle = sky.veil;
        ctx.fillRect(0, 0, drawW, drawH);
    }

    ctx.save();

    if (screenShake > 0) {
        let shakeX = (Math.random() - 0.5) * screenShakeIntensity * 2;
        let shakeY = (Math.random() - 0.5) * screenShakeIntensity * 2;
        ctx.translate(shakeX, shakeY);
        screenShake--;
        screenShakeIntensity *= 0.9;
        if (screenShakeIntensity < 0.5) screenShakeIntensity = 0;
    }

    ctx.scale(SCALE, SCALE);

    drawThemeBackground(ctx);

    let ex = ENTRANCE.x, ey = ENTRANCE.y;
    ctx.fillStyle = '#5a3010';
    ctx.fillRect(ex - 12, ey - 10, 24, 5);
    ctx.fillStyle = '#7a4820';
    ctx.fillRect(ex - 10, ey - 9, 9, 3);
    ctx.fillStyle = '#8a5528';
    ctx.fillRect(ex + 1, ey - 9, 9, 3);
    ctx.fillStyle = '#1a0800';
    ctx.fillRect(ex - 1, ey - 9, 2, 3);
    ctx.fillStyle = '#030308';
    ctx.fillRect(ex - 9, ey - 4, 18, 9);
    let hatchWarmth = 0.18 + Math.sin(gameState.ticks * 0.07) * 0.06;
    ctx.fillStyle = `rgba(255, 200, 80, ${hatchWarmth})`;
    ctx.fillRect(ex - 7, ey - 3, 14, 7);
    let arrowBob = Math.floor(Math.sin(gameState.ticks * 0.12) * 2);
    ctx.fillStyle = '#ffee00';
    ctx.fillRect(ex - 1, ey - 17 + arrowBob, 2, 5);
    ctx.fillRect(ex - 3, ey - 14 + arrowBob, 6, 2);

    let exitGlow = 0.5 + Math.sin(gameState.ticks * 0.08) * 0.28;
    ctx.fillStyle = `rgba(0, 255, 80, ${exitGlow * 0.10})`;
    ctx.fillRect(EXIT.x - 6, EXIT.y - 8, EXIT.w + 12, EXIT.h + 12);
    ctx.fillStyle = '#3a2a18';
    ctx.fillRect(EXIT.x - 3, EXIT.y - 2, EXIT.w + 6, EXIT.h + 3);
    ctx.fillStyle = '#553c24';
    ctx.fillRect(EXIT.x - 2, EXIT.y - 1, EXIT.w + 4, EXIT.h + 2);
    let exitG = Math.floor(160 + 90 * exitGlow);
    ctx.fillStyle = `rgb(0, ${exitG}, ${Math.floor(30 + 20 * exitGlow)})`;
    ctx.fillRect(EXIT.x, EXIT.y, EXIT.w, EXIT.h);
    ctx.fillStyle = `rgba(200, 255, 200, ${0.12 + exitGlow * 0.08})`;
    ctx.fillRect(EXIT.x + 1, EXIT.y + 1, Math.floor(EXIT.w / 2) - 1, EXIT.h - 2);
    ctx.fillStyle = '#221508';
    ctx.fillRect(EXIT.x - 1, EXIT.y - 6, EXIT.w + 2, 4);
    if (Math.floor(gameState.ticks / 12) % 2) {
        ctx.fillStyle = `rgba(0, 255, 80, ${exitGlow})`;
        ctx.fillRect(EXIT.x + EXIT.w / 2 - 3, EXIT.y - 5, 6, 2);
    }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    let portalGlow = ctx.createRadialGradient(
        EXIT.x + EXIT.w / 2,
        EXIT.y + EXIT.h / 2,
        2,
        EXIT.x + EXIT.w / 2,
        EXIT.y + EXIT.h / 2,
        18
    );
    portalGlow.addColorStop(0, `rgba(100, 255, 180, ${0.25 + exitGlow * 0.22})`);
    portalGlow.addColorStop(0.45, `rgba(40, 220, 150, ${0.12 + exitGlow * 0.16})`);
    portalGlow.addColorStop(1, 'rgba(0, 120, 90, 0)');
    ctx.fillStyle = portalGlow;
    ctx.beginPath();
    ctx.arc(EXIT.x + EXIT.w / 2, EXIT.y + EXIT.h / 2, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    let terrainHandledByWebGL = false;
    if (useHybridWebGLBase && typeof renderer.renderTerrainLiquidLayer === 'function') {
        terrainHandledByWebGL = _runWebGLEffect('terrainComposite', () =>
            renderer.renderTerrainLiquidLayer(ctx, offscreenCanvas, liquidCanvas, GAME_WIDTH, GAME_HEIGHT)
        );
    }
    if (!terrainHandledByWebGL) {
        ctx.drawImage(offscreenCanvas, 0, 0);
        // Draw volumetric liquid layer (rendered at game resolution, scaled up with terrain)
        if (liquidCanvas) ctx.drawImage(liquidCanvas, 0, 0);
    }

    const useHybridWebGLLayers = !!(
        useHybridWebGLBase &&
        _isWebGLEffectEnabled('layerStack') &&
        typeof renderer.renderGameLayerStack === 'function'
    );
    let layerStackHandledByWebGL = false;
    if (useHybridWebGLLayers) {
        const sceneLayer = _getPhase3Layer('scene');
        const mistLayer = _getPhase3Layer('mist');
        const atmBehindLayer = _getPhase3Layer('atmBehind');
        const atmFrontLayer = _getPhase3Layer('atmFront');
        const weatherAtmosLayer = _getPhase3Layer('weatherAtmos');

        sceneLayer.cx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        drawSceneProps(sceneLayer.cx);

        mistLayer.cx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        drawThemeMist(mistLayer.cx);

        weatherAtmosLayer.cx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        _drawWeatherAtmosphereOverlay(weatherAtmosLayer.cx, currentTheme, gameState.ticks, _windX);

        atmBehindLayer.cx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        const _atmBehind = _getOrUpdateAtmosphereCache('behind');
        if (_atmBehind) atmBehindLayer.cx.drawImage(_atmBehind, 0, 0);
        else drawThemeAtmosphere(atmBehindLayer.cx, 'behind');

        atmFrontLayer.cx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        const _atmFront = _getOrUpdateAtmosphereCache('front');
        if (_atmFront) atmFrontLayer.cx.drawImage(_atmFront, 0, 0);
        else drawThemeAtmosphere(atmFrontLayer.cx, 'front');

        layerStackHandledByWebGL = _runWebGLEffect('layerStack', () =>
            renderer.renderGameLayerStack(ctx, [
                sceneLayer.c,
                atmBehindLayer.c,
                mistLayer.c,
                weatherAtmosLayer.c,
                atmFrontLayer.c
            ], GAME_WIDTH, GAME_HEIGHT)
        );
    }
    if (!layerStackHandledByWebGL) {
        drawSceneProps(ctx);
        const _atmBehind = _getOrUpdateAtmosphereCache('behind');
        if (_atmBehind) ctx.drawImage(_atmBehind, 0, 0); else drawThemeAtmosphere(ctx, 'behind');
        drawThemeMist(ctx);
        _drawWeatherAtmosphereOverlay(ctx, currentTheme, gameState.ticks, _windX);
        const _atmFront = _getOrUpdateAtmosphereCache('front');
        if (_atmFront) ctx.drawImage(_atmFront, 0, 0); else drawThemeAtmosphere(ctx, 'front');
    }

    const terrainEdgePoints = _isWebGLEffectEnabled('terrainEdgeFx')
        ? _getTerrainEdgeGlowPoints(currentTheme, gameState.ticks)
        : [];
    let terrainEdgeHandledByWebGL = false;
    if (terrainEdgePoints.length > 0 && useHybridWebGLBase && typeof renderer.renderParticleCloud === 'function') {
        terrainEdgeHandledByWebGL = _runWebGLEffect('terrainEdgeFx', () =>
            renderer.renderParticleCloud(ctx, terrainEdgePoints, GAME_WIDTH, GAME_HEIGHT)
        );
    }
    if (!terrainEdgeHandledByWebGL && terrainEdgePoints.length > 0) {
        _drawWeatherParticleFallback(ctx, terrainEdgePoints);
    }

    const shadowBlobs = _isWebGLEffectEnabled('shadows')
        ? _buildShadowBlobs()
        : [];
    let shadowsHandledByWebGL = false;
    if (shadowBlobs.length > 0 && useHybridWebGLBase && typeof renderer.renderShadowBlobs === 'function') {
        shadowsHandledByWebGL = _runWebGLEffect('shadows', () =>
            renderer.renderShadowBlobs(ctx, drawW, drawH, shadowBlobs)
        );
    }
    if (!shadowsHandledByWebGL && shadowBlobs.length > 0) {
        ctx.save();
        for (let i = 0; i < shadowBlobs.length; i++) {
            const b = shadowBlobs[i];
            const grad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.radius);
            grad.addColorStop(0, `rgba(0, 0, 0, ${Math.min(0.24, b.intensity * 2.0)})`);
            grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = grad;
            ctx.fillRect(b.x - b.radius, b.y - b.radius, b.radius * 2, b.radius * 2);
        }
        ctx.restore();
    }

    let puffinBodiesHandledByWebGL = false;
    const puffinsWithWebGLBody = new Set();
    if (useHybridWebGLBase && _isWebGLEffectEnabled('puffinBodies') && typeof renderer.renderPuffinBodies === 'function' && window.PuffinRender) {
        const bodySize = (typeof window.PuffinRender.getBodyCacheSize === 'function')
            ? window.PuffinRender.getBodyCacheSize()
            : { w: 12, h: 14 };

        const instances = [];
        for (let i = 0; i < puffins.length; i++) {
            const p = puffins[i];
            if (!p || p.state === ST_DEAD || p.state === ST_EXITED || p.state === ST_SPLAT) continue;
            if (typeof p._getBodyCacheKey !== 'function') continue;
            const key = p._getBodyCacheKey();
            if (!key) continue;
            const spriteEffect = _isWebGLEffectEnabled('spriteFx')
                ? _getPuffinWebGLEffect(p, currentTheme)
                : null;
            instances.push({
                key,
                x: Math.floor(p.x),
                y: Math.floor(p.y),
                flipX: p.vx < 0,
                tint: spriteEffect ? spriteEffect.tint : [255, 255, 255],
                tintStrength: spriteEffect ? spriteEffect.tintStrength : 0,
                rimColor: spriteEffect ? spriteEffect.rimColor : [255, 255, 255],
                rimStrength: spriteEffect ? spriteEffect.rimStrength : 0,
                glow: spriteEffect ? spriteEffect.glow : 0,
                ref: p
            });
        }

        puffinBodiesHandledByWebGL = _runWebGLEffect('puffinBodies', () =>
            renderer.renderPuffinBodies(
                ctx,
                instances,
                (cacheKey) => window.PuffinRender.getBodyCacheCanvasByKey(cacheKey),
                GAME_WIDTH,
                GAME_HEIGHT,
                bodySize
            )
        );

        if (puffinBodiesHandledByWebGL) {
            for (let i = 0; i < instances.length; i++) {
                if (instances[i] && instances[i].ref) puffinsWithWebGLBody.add(instances[i].ref);
            }
        }
    }

    for (let i = 0; i < puffins.length; i++) {
        const p = puffins[i];
        if (!p) continue;
        if (puffinBodiesHandledByWebGL && puffinsWithWebGLBody.has(p)) {
            p.draw(ctx, { skipBody: true });
        } else {
            p.draw(ctx);
        }
    }

    let particlesHandledByWebGL = false;
    if (useHybridWebGLBase && typeof renderer.renderParticles === 'function') {
        particlesHandledByWebGL = _runWebGLEffect('particles', () =>
            renderer.renderParticles(ctx, particles, GAME_WIDTH, GAME_HEIGHT)
        );
    }
    if (!particlesHandledByWebGL) {
        particles.forEach(p => p.draw(ctx));
    }

    const bomberTrailPoints = _isWebGLEffectEnabled('bomberTrailWisps')
        ? _buildBomberTrailCloud(gameState.ticks)
        : [];
    let bomberTrailsHandledByWebGL = false;
    if (bomberTrailPoints.length > 0 && useHybridWebGLBase && typeof renderer.renderParticleCloud === 'function') {
        bomberTrailsHandledByWebGL = _runWebGLEffect('bomberTrailWisps', () =>
            renderer.renderParticleCloud(ctx, bomberTrailPoints, GAME_WIDTH, GAME_HEIGHT)
        );
    }
    if (!bomberTrailsHandledByWebGL && bomberTrailPoints.length > 0) {
        _drawWeatherParticleFallback(ctx, bomberTrailPoints);
    }

    const weatherType = _getWeatherTypeForTheme(currentTheme);
    const weatherPoints = weatherType
        ? _buildWeatherParticleCloud(currentTheme, gameState.ticks, GAME_WIDTH, GAME_HEIGHT, _windX)
        : [];
    let weatherHandledByWebGL = false;
    if (!weatherHandledByWebGL && useHybridWebGLBase && typeof renderer.renderParticleCloud === 'function') {
        weatherHandledByWebGL = _runWebGLEffect('weatherParticles', () =>
            renderer.renderParticleCloud(ctx, weatherPoints, GAME_WIDTH, GAME_HEIGHT)
        );
    }
    if (!weatherHandledByWebGL && weatherPoints.length > 0) {
        _drawWeatherParticleFallback(ctx, weatherPoints);
    }

    let weatherFieldHandledByWebGL = false;
    if (_isWebGLEffectEnabled('weatherField') && useHybridWebGLBase && typeof renderer.renderWeatherField === 'function') {
        weatherFieldHandledByWebGL = _runWebGLEffect('weatherField', () =>
            renderer.renderWeatherField(ctx, drawW, drawH, {
                theme: currentTheme,
                time: frameTime,
                wind: _windX,
                intensity: weatherType ? 0.34 : 0.14
            })
        );
    }

    const caveMotePoints = _isWebGLEffectEnabled('caveAmbientMotes')
        ? _buildCaveAmbientMotes(currentTheme, gameState.ticks)
        : [];
    let caveMotesHandledByWebGL = false;
    if (caveMotePoints.length > 0 && useHybridWebGLBase && typeof renderer.renderParticleCloud === 'function') {
        caveMotesHandledByWebGL = _runWebGLEffect('caveAmbientMotes', () =>
            renderer.renderParticleCloud(ctx, caveMotePoints, GAME_WIDTH, GAME_HEIGHT)
        );
    }
    if (!caveMotesHandledByWebGL && caveMotePoints.length > 0) {
        _drawWeatherParticleFallback(ctx, caveMotePoints);
    }

    if (activeSkill && currentSkillCounts[activeSkill] > 0) {
        ctx.strokeStyle = hoveredPuffin ? '#0f0' : '#fff';
        ctx.strokeRect(mouseX - 5, mouseY - 5, 10, 10);
        ctx.beginPath();
        ctx.moveTo(mouseX, mouseY - 7); ctx.lineTo(mouseX, mouseY + 7);
        ctx.moveTo(mouseX - 7, mouseY); ctx.lineTo(mouseX + 7, mouseY);
        ctx.stroke();
    }

    if (nukeActivated && nukeCountdown > 0) {
        let seconds = Math.ceil(nukeCountdown / FPS);
        ctx.fillStyle = `rgba(255, 0, 0, ${0.5 + Math.sin(gameState.ticks * 0.2) * 0.3})`;
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        ctx.fillStyle = '#f00';
        ctx.font = 'bold 24px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('NUKE IN ' + seconds + '...', GAME_WIDTH / 2, 30);
        ctx.textAlign = 'left';
    }

    ctx.restore();

    const postProcessGrades = {
        lava: [200, 70, 20], volcanic_ash: [180, 80, 30], obsidian_floor: [160, 60, 40],
        desert: [210, 150, 55], salt_flats: [200, 175, 100], sandstone: [215, 165, 70],
        cave: [12, 10, 8], wet_cave_stone: [18, 22, 28], iron_ore: [20, 18, 14], mud: [30, 22, 14],
        water: [20, 120, 180], deep_sea: [10, 60, 120], coral: [20, 140, 170],
        crystal: [120, 60, 200], crystal_dense: [100, 50, 180], amber: [220, 160, 40],
        fungus_glow: [60, 180, 100], toxic_sludge: [100, 160, 30]
    };
    const [gradeR, gradeG, gradeB] = postProcessGrades[getCurrentThemeName()] || [120, 170, 230];
    const postAtmosphereStrength = _isWebGLEffectEnabled('postAtmosphere') ? 0.55 : 0;
    let postProcessHandledByWebGL = false;
    if (useHybridWebGLBase && typeof renderer.renderPostProcessOverlay === 'function') {
        postProcessHandledByWebGL = _runWebGLEffect('postProcess', () =>
            renderer.renderPostProcessOverlay(ctx, drawW, drawH, {
                gradeRgb: [gradeR, gradeG, gradeB],
                gradeAlpha: 0.05,
                theme: currentTheme,
                time: frameTime,
                wind: _windX,
                atmosphereIntensity: postAtmosphereStrength
            })
        );
    }
    if (!postProcessHandledByWebGL) {
        ctx.fillStyle = `rgba(${gradeR}, ${gradeG}, ${gradeB}, 0.05)`;
        ctx.fillRect(0, 0, drawW, drawH);

        let vignette = ctx.createRadialGradient(
            drawW * 0.5,
            drawH * 0.48,
            drawH * 0.25,
            drawW * 0.5,
            drawH * 0.5,
            drawW * 0.62
        );
        vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
        vignette.addColorStop(0.72, 'rgba(6, 12, 24, 0.10)');
        vignette.addColorStop(1, 'rgba(4, 8, 18, 0.30)');
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, drawW, drawH);

        if (postAtmosphereStrength > 0) {
            const haze = ctx.createLinearGradient(0, drawH * 0.18, 0, drawH);
            haze.addColorStop(0, `rgba(${gradeR}, ${gradeG}, ${gradeB}, ${0.03 * postAtmosphereStrength})`);
            haze.addColorStop(1, `rgba(${gradeR}, ${gradeG}, ${gradeB}, ${0.08 * postAtmosphereStrength})`);
            ctx.fillStyle = haze;
            ctx.fillRect(0, 0, drawW, drawH);
        }
    }


    // Dynamic lighting (feature pass #1)
    const dynamicLights = [];
    const terrainContactLights = _isWebGLEffectEnabled('terrainEdgeFx')
        ? _buildTerrainContactLights(terrainEdgePoints, currentTheme)
        : [];
    for (let i = 0; i < terrainContactLights.length; i++) {
        dynamicLights.push(terrainContactLights[i]);
    }
    dynamicLights.push({
        x: (EXIT.x + EXIT.w / 2) * SCALE,
        y: (EXIT.y + EXIT.h / 2) * SCALE,
        radius: 46,
        intensity: 0.32 + Math.sin(gameState.ticks * 0.08) * 0.08,
        color: [80, 255, 170]
    });

    const maxPuffinLights = 10;
    const puffinStep = Math.max(1, Math.floor(puffins.length / maxPuffinLights));
    for (let i = 0; i < puffins.length; i += puffinStep) {
        const p = puffins[i];
        if (!p || p.state === ST_DEAD || p.state === ST_EXITED) continue;

        let radius = 0;
        let intensity = 0;
        let color = [255, 220, 120];

        if (p.bomberTicks > 0) {
            radius = 22;
            intensity = 0.18 + (1 - Math.min(1, p.bomberTicks / (FPS * 5))) * 0.32;
            color = [255, 120, 70];
        } else if (p.state === ST_MINE || p.state === ST_DIG) {
            radius = 16;
            intensity = 0.12;
            color = [255, 236, 160];
        } else if (p.state === ST_FLOAT) {
            radius = 14;
            intensity = 0.08;
            color = [255, 215, 90];
        }

        if (radius > 0 && intensity > 0) {
            dynamicLights.push({
                x: (p.x + PUFFIN_W / 2) * SCALE,
                y: (p.y + PUFFIN_H / 2) * SCALE,
                radius,
                intensity,
                color
            });
        }
    }

    let lightsHandledByWebGL = false;
    if (useHybridWebGLBase && typeof renderer.renderDynamicLights === 'function') {
        lightsHandledByWebGL = _runWebGLEffect('dynamicLights', () =>
            renderer.renderDynamicLights(ctx, drawW, drawH, dynamicLights)
        );
    }
    if (!lightsHandledByWebGL && dynamicLights.length > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < dynamicLights.length; i++) {
            const l = dynamicLights[i];
            const grad = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.radius);
            grad.addColorStop(0, `rgba(${l.color[0]}, ${l.color[1]}, ${l.color[2]}, ${Math.min(1, l.intensity)})`);
            grad.addColorStop(1, `rgba(${l.color[0]}, ${l.color[1]}, ${l.color[2]}, 0)`);
            ctx.fillStyle = grad;
            ctx.fillRect(l.x - l.radius, l.y - l.radius, l.radius * 2, l.radius * 2);
        }
        ctx.restore();
    }


    const bomberRingwaves = [];
    for (let i = 0; i < puffins.length; i++) {
        const p = puffins[i];
        if (!p || p.state === ST_DEAD || p.state === ST_EXITED) continue;
        if (!(p.bomberTicks > 0 && p.bomberTicks <= FPS * 2)) continue;

        const urgency = 1 - Math.max(0, Math.min(1, p.bomberTicks / (FPS * 2)));
        const cycle = 20 - Math.floor(urgency * 7);
        const phase = ((gameState.ticks + i * 9) % Math.max(6, cycle)) / Math.max(6, cycle);
        const radius = 5 + phase * (26 + urgency * 20);
        const width = 2.5 + urgency * 2.8;
        const intensity = 0.08 + urgency * 0.25;

        bomberRingwaves.push({
            x: (p.x + PUFFIN_W / 2) * SCALE,
            y: (p.y + PUFFIN_H / 2) * SCALE,
            radius,
            width,
            intensity,
            color: [255, 120, 55]
        });
    }

    let ringwavesHandledByWebGL = false;
    if (useHybridWebGLBase && typeof renderer.renderRingwaves === 'function') {
        ringwavesHandledByWebGL = _runWebGLEffect('ringwaves', () =>
            renderer.renderRingwaves(ctx, drawW, drawH, bomberRingwaves)
        );
    }
    if (!ringwavesHandledByWebGL && bomberRingwaves.length > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < bomberRingwaves.length; i++) {
            const w = bomberRingwaves[i];
            ctx.strokeStyle = `rgba(${w.color[0]}, ${w.color[1]}, ${w.color[2]}, ${Math.min(1, w.intensity)})`;
            ctx.lineWidth = Math.max(1, w.width * 0.6);
            ctx.beginPath();
            ctx.arc(w.x, w.y, w.radius, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.restore();
    }


    const portalCharge = Math.max(0, Math.min(1, gameState.saved / Math.max(1, REQUIRED_PUFFINS)));
    const portalEffect = {
        x: (EXIT.x + EXIT.w / 2) * SCALE,
        y: (EXIT.y + EXIT.h / 2) * SCALE,
        radius: (18 + portalCharge * 8) * SCALE,
        pulse: 0.45 + portalCharge * 0.55 + Math.sin(gameState.ticks * 0.08) * 0.18,
        intensity: 0.65 + portalCharge * 0.45,
        time: frameTime,
        colorA: [80, 255, 170],
        colorB: [40, 220, 255]
    };

    let portalFxHandledByWebGL = false;
    if (useHybridWebGLBase && typeof renderer.renderPortalEffect === 'function') {
        portalFxHandledByWebGL = _runWebGLEffect('portalEffect', () =>
            renderer.renderPortalEffect(ctx, drawW, drawH, portalEffect)
        );
    }
    if (!portalFxHandledByWebGL) {
        const px = portalEffect.x;
        const py = portalEffect.y;
        const pr = portalEffect.radius;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        const swirl = ctx.createRadialGradient(px, py, pr * 0.16, px, py, pr);
        swirl.addColorStop(0, `rgba(100, 255, 200, ${0.06 + portalEffect.pulse * 0.12})`);
        swirl.addColorStop(0.6, `rgba(60, 220, 255, ${0.05 + portalEffect.pulse * 0.10})`);
        swirl.addColorStop(1, 'rgba(20, 120, 170, 0)');
        ctx.fillStyle = swirl;
        ctx.fillRect(px - pr, py - pr, pr * 2, pr * 2);

        const ringAlpha = 0.18 + portalCharge * 0.18 + Math.sin(gameState.ticks * 0.15) * 0.06;
        ctx.strokeStyle = `rgba(90, 250, 210, ${Math.max(0.04, ringAlpha)})`;
        ctx.lineWidth = Math.max(1, pr * 0.12);
        ctx.beginPath();
        ctx.arc(px, py, pr * (0.62 + Math.sin(gameState.ticks * 0.07) * 0.08), 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
    }


    const exitRefractionEffects = _isWebGLEffectEnabled('exitRefractionRing')
        ? _buildExitRefractionEffects(portalEffect, portalCharge, gameState.ticks)
        : [];
    let exitRefractionHandledByWebGL = false;
    if (exitRefractionEffects.length > 0 && useHybridWebGLBase && typeof renderer.renderScreenDistortion === 'function') {
        exitRefractionHandledByWebGL = _runWebGLEffect('exitRefractionRing', () =>
            renderer.renderScreenDistortion(ctx, drawW, drawH, {
                theme: currentTheme,
                time: frameTime,
                globalStrength: 0,
                effects: exitRefractionEffects
            })
        );
    }

    const portalSparkles = _isWebGLEffectEnabled('portalSparkles')
        ? _buildPortalSparkleCloud(gameState.ticks, portalCharge)
        : [];
    let portalSparklesHandledByWebGL = false;
    if (portalSparkles.length > 0 && useHybridWebGLBase && typeof renderer.renderParticleCloud === 'function') {
        portalSparklesHandledByWebGL = _runWebGLEffect('portalSparkles', () =>
            renderer.renderParticleCloud(ctx, portalSparkles, GAME_WIDTH, GAME_HEIGHT)
        );
    }
    if (!portalSparklesHandledByWebGL && portalSparkles.length > 0) {
        _drawWeatherParticleFallback(ctx, portalSparkles);
    }

    const sceneDistortionEffects = _isWebGLEffectEnabled('distortion')
        ? _buildSceneDistortionEffects(currentTheme, gameState.ticks, portalEffect)
        : [];
    if (sceneDistortionEffects.length > 0 && useHybridWebGLBase && typeof renderer.renderScreenDistortion === 'function') {
        _runWebGLEffect('distortion', () =>
            renderer.renderScreenDistortion(ctx, drawW, drawH, {
                theme: currentTheme,
                time: frameTime,
                globalStrength: 0.004,
                effects: sceneDistortionEffects
            })
        );
    }

    // Long-press tooltip overlay
    if (_touchTooltip) {
        const tx = _touchTooltip.sx * SCALE;
        const ty = Math.max(20, _touchTooltip.sy * SCALE - 18);
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.78)';
        ctx.strokeStyle = '#7ec4ff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(tx - 28, ty - 12, 56, 16, 3);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#d3ebff';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(_touchTooltip.label, tx, ty);
        ctx.textAlign = 'left';
        ctx.restore();
    }

    if (typeof Achievements !== 'undefined') {
        Achievements.draw(ctx);
    }
}

