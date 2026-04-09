// Dynamic Game State
let currentLevelIndex = 0;
let TOTAL_PUFFINS = 20;
let REQUIRED_PUFFINS = 15;
let SPAWN_RATE = FPS * 2;
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

function updateReleaseRate(value) {
    // Value 1-10, where 10 = fastest (spawn every frame), 1 = slowest
    // Map to spawn rate multiplier: 10 -> 0.5, 1 -> 10
    let baseRate = FPS * 2; // Base spawn rate
    let multiplier = (11 - value) / 5; // 10 -> 0.2, 1 -> 2.0
    SPAWN_RATE = Math.max(1, Math.floor(baseRate * multiplier));
    document.getElementById('release-rate-val').innerText = value;
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
let terrainData = new Uint8Array(GAME_WIDTH * GAME_HEIGHT);
let terrainImgData;
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
    timeLeft: 5 * 60 * FPS
};
let mouseX = 0, mouseY = 0;
let hoveredPuffin = null;
let nukeActivated = false;
let nukeCountdown = -1;
let screenShake = 0;
let screenShakeIntensity = 0;

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
        concept_999:    { top: '#1f4f88', mid: '#3e7db0', bot: '#215079', veil: 'rgba(188, 230, 255, 0.14)' }
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
    
    // Handle window resize for responsive scaling
    window.addEventListener('resize', updateCanvasScale);
    updateCanvasScale();
    
    canvas.addEventListener('mousemove', e => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = GAME_WIDTH / rect.width;
        const scaleY = GAME_HEIGHT / rect.height;
        mouseX = Math.floor((e.clientX - rect.left) * scaleX);
        mouseY = Math.floor((e.clientY - rect.top) * scaleY);
    });

    canvas.addEventListener('mousedown', e => {
        // Skip if in editor mode, game not active, or paused
        if (editorMode || !gameState.active || gameState.paused) return;
        
        // Right-click to cancel active skill
        if (e.button === 2) {
            activeSkill = null;
            updateUI();
            return;
        }
        
        // Left-click to assign skill or toggle blocker/builder
        if (e.button === 0) {
            // If no skill selected, try to toggle a blocker, builder, or miner
            if (!activeSkill && hoveredPuffin) {
                if (hoveredPuffin.toggleBlocker()) {
                    playSound('click');
                    return;
                }
                if (hoveredPuffin.toggleBuilder()) {
                    playSound('click');
                    return;
                }
                if (hoveredPuffin.toggleMiner()) {
                    playSound('click');
                    return;
                }
            }
            
            // Assign skill if one is selected
            if (activeSkill) {
                if (currentSkillCounts[activeSkill] <= 0) return;
                if (hoveredPuffin && hoveredPuffin.canAcceptSkill(activeSkill)) {
                    hoveredPuffin.assignSkill(activeSkill);
                    currentSkillCounts[activeSkill]--;
                    // Track skill use for achievements
                    if (typeof Achievements !== 'undefined') {
                        Achievements.trackSkill(activeSkill);
                    }
                    updateUI();
                    playSound('skillAssign');
                }
            }
        }
    });

    // Prevent context menu on right-click
    canvas.addEventListener('contextmenu', e => e.preventDefault());

    window.addEventListener('keydown', e => {
        if (e.key === 'Escape' && gameState.active) {
            if (activeSkill) {
                activeSkill = null;
                updateUI();
            } else {
                togglePause();
            }
        }
        // N key for nuke
        if (e.key === 'n' && gameState.active && !gameState.paused) {
            triggerNuke();
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

window.onload = function() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    
    offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = GAME_WIDTH;
    offscreenCanvas.height = GAME_HEIGHT;
    offCtx = offscreenCanvas.getContext('2d');
    offCtx.imageSmoothingEnabled = true;

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

    document.title = "Puffin Panic - " + lvl.name;
    showGameUI();

    // Reset achievements stats
    if (typeof Achievements !== 'undefined') {
        Achievements.resetStats();
        Achievements.stats.total = lvl.total;
        Achievements.stats.required = lvl.required;
    }
    
    TOTAL_PUFFINS = lvl.total;
    REQUIRED_PUFFINS = lvl.required;
    SPAWN_RATE = lvl.spawnRate;
    ENTRANCE = lvl.entrance;
    EXIT = lvl.exit;

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
        timeLeft: lvl.time
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
    
    // Reset release rate slider
    let rateSlider = document.getElementById('release-rate');
    if (rateSlider) {
        rateSlider.value = 5;
        updateReleaseRate(5);
    }
    
    terrainData.fill(0);
    lvl.buildTerrain(terrainData, GAME_WIDTH, GAME_HEIGHT);
    renderTerrainToOffscreen();
    
    buildUI();
    
    if (loopId !== null) {
        clearTimeout(loopId);
        loopId = null;
    }
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
    document.getElementById('lbl-out').innerText = gameState.spawned;
    document.getElementById('lbl-in').innerText = `${gameState.saved} / ${REQUIRED_PUFFINS}`;
    
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

function gameLoop() {
    for (let i = 0; i < gameSpeed; i++) {
        if (gameState.active && !gameState.paused) update();
    }
    draw();
    if (gameState.active) {
        loopId = setTimeout(() => requestAnimationFrame(gameLoop), FRAME_MS);
    }
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
    if (gameState.ticks % SPAWN_RATE === 0 && gameState.spawned < TOTAL_PUFFINS) {
        puffins.push(new Puffin(ENTRANCE.x, ENTRANCE.y));
        gameState.spawned++;
    }
    
    // Hover logic
    hoveredPuffin = null;
    let minDist = 15;
    for (let p of puffins) {
        if (p.state !== ST_DEAD && p.state !== ST_EXITED) {
            let cx = p.x + PUFFIN_W/2;
            let cy = p.y + PUFFIN_H/2;
            let d = Math.hypot(cx - mouseX, cy - mouseY);
            if (d < minDist) {
                minDist = d;
                hoveredPuffin = p;
            }
        }
    }
    
    // Update entities
    puffins.forEach(p => p.update());
    particles.forEach(p => p.update());
    
    // Cleanup particles
    particles = particles.filter(p => p.life > 0 || p.isPermanent);
    
    // UI
    if (gameState.ticks % 10 === 0) updateUI();
    
    // Update achievement display timer
    if (typeof Achievements !== 'undefined') {
        Achievements.update();
    }
    
    checkEndCondition();
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

    if (lvl && lvl.waterZones) {
        for (const zone of lvl.waterZones) {
            drawWaterZone(ctx, zone, gameState.ticks);
        }
    }

    // Level-specific declared props
    if (lvl && lvl.props) {
        for (const prop of lvl.props) {
            if (prop.type === 'rope')      drawRopeBridge(ctx, prop);
            else if (prop.type === 'sign') drawSignPost(ctx, prop);
            else if (prop.type === 'water') drawWaterZone(ctx, prop, gameState.ticks);
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

function draw() {
    const sky = getThemeSkyColors();
    let skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    skyGrad.addColorStop(0, sky.top);
    skyGrad.addColorStop(0.55, sky.mid);
    skyGrad.addColorStop(1, sky.bot);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = sky.veil;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.save();
    
    // Visual polish: Apply screen shake
    if (screenShake > 0) {
        let shakeX = (Math.random() - 0.5) * screenShakeIntensity * 2;
        let shakeY = (Math.random() - 0.5) * screenShakeIntensity * 2;
        ctx.translate(shakeX, shakeY);
        screenShake--;
        screenShakeIntensity *= 0.9; // Decay intensity
        if (screenShakeIntensity < 0.5) screenShakeIntensity = 0;
    }
    
    ctx.scale(SCALE, SCALE);
    
    // Star field — varied sizes and twinkle speeds
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
        let brightness = 0.35 + Math.sin(gameState.ticks * star.sp + star.x * 0.1) * 0.45;
        ctx.fillStyle = `rgba(240, 245, 255, ${brightness})`;
        ctx.fillRect(star.x, star.y, star.s, star.s);
    });
    
    // Moon — outer glow halo
    ctx.fillStyle = 'rgba(255, 245, 220, 0.12)';
    ctx.beginPath(); ctx.arc(320, 38, 22, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = 'rgba(255, 245, 220, 0.20)';
    ctx.beginPath(); ctx.arc(320, 38, 18, 0, Math.PI*2); ctx.fill();
    // Moon surface
    ctx.fillStyle = '#ede8d8';
    ctx.beginPath(); ctx.arc(320, 38, 14, 0, Math.PI*2); ctx.fill();
    // Mare craters (dark patches)
    ctx.fillStyle = 'rgba(0,0,0,0.10)';
    ctx.beginPath(); ctx.arc(315, 34, 3.5, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.beginPath(); ctx.arc(323, 41, 2.5, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(312, 42, 1.5, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(326, 33, 1.0, 0, Math.PI*2); ctx.fill();

    // Aurora borealis — layered curtains
    let auroraOffset = Math.sin(gameState.ticks * 0.01) * 10;
    ctx.fillStyle = `rgba(0, 255, 100, ${0.07 + Math.sin(gameState.ticks * 0.005) * 0.03})`;
    ctx.beginPath();
    ctx.moveTo(0, 80 + auroraOffset);
    ctx.quadraticCurveTo(200, 28 + auroraOffset, 400, 88 + auroraOffset);
    ctx.lineTo(400, 0); ctx.lineTo(0, 0); ctx.fill();
    ctx.fillStyle = `rgba(0, 150, 255, ${0.05 + Math.sin(gameState.ticks * 0.008 + 1) * 0.025})`;
    ctx.beginPath();
    ctx.moveTo(0, 100 + auroraOffset);
    ctx.quadraticCurveTo(150, 48 + auroraOffset, 400, 108 + auroraOffset);
    ctx.lineTo(400, 0); ctx.lineTo(0, 0); ctx.fill();
    ctx.fillStyle = `rgba(180, 0, 255, ${0.03 + Math.sin(gameState.ticks * 0.006 + 2) * 0.02})`;
    ctx.beginPath();
    ctx.moveTo(0, 90 + auroraOffset);
    ctx.quadraticCurveTo(280, 38 + auroraOffset, 400, 95 + auroraOffset);
    ctx.lineTo(400, 0); ctx.lineTo(0, 0); ctx.fill();

    // Layered parallax ridges
    const driftFar = Math.sin(gameState.ticks * 0.002) * 4;
    const driftMid = Math.sin(gameState.ticks * 0.003 + 0.8) * 6;

    // Far ridge
    ctx.save();
    ctx.translate(driftFar, 0);
    ctx.fillStyle = 'rgba(20, 36, 60, 0.45)';
    ctx.beginPath();
    ctx.moveTo(-12, 126);
    ctx.lineTo(24, 94); ctx.lineTo(60, 102); ctx.lineTo(92, 78);
    ctx.lineTo(126, 88); ctx.lineTo(162, 66); ctx.lineTo(198, 82);
    ctx.lineTo(235, 62); ctx.lineTo(275, 78); ctx.lineTo(312, 58);
    ctx.lineTo(350, 74); ctx.lineTo(388, 64); ctx.lineTo(420, 80);
    ctx.lineTo(420, 126);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Mid ridge
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
    ctx.lineTo(420, 140);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Snow caps on visible peaks
    ctx.fillStyle = 'rgba(215, 233, 255, 0.22)';
    const peaks = [[78,92],[138,82],[202,78],[266,74],[328,84]];
    peaks.forEach(([px, py]) => {
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + 11, py + 11);
        ctx.lineTo(px - 11, py + 11);
        ctx.closePath();
        ctx.fill();
    });

    // Broad haze layer behind gameplay geometry
    let hazeAlpha = 0.08 + Math.sin(gameState.ticks * 0.006) * 0.02;
    ctx.fillStyle = `rgba(170, 210, 255, ${hazeAlpha})`;
    ctx.fillRect(0, 84, GAME_WIDTH, 46);
    
    // Draw Entrance — wooden trapdoor hatch
    let ex = ENTRANCE.x, ey = ENTRANCE.y;
    // Frame
    ctx.fillStyle = '#5a3010';
    ctx.fillRect(ex - 12, ey - 10, 24, 5);
    // Plank left
    ctx.fillStyle = '#7a4820';
    ctx.fillRect(ex - 10, ey - 9, 9, 3);
    // Plank right
    ctx.fillStyle = '#8a5528';
    ctx.fillRect(ex + 1, ey - 9, 9, 3);
    // Gap between planks (open hatch)
    ctx.fillStyle = '#1a0800';
    ctx.fillRect(ex - 1, ey - 9, 2, 3);
    // Dark opening hole
    ctx.fillStyle = '#030308';
    ctx.fillRect(ex - 9, ey - 4, 18, 9);
    // Warm glow from inside
    let hatchWarmth = 0.18 + Math.sin(gameState.ticks * 0.07) * 0.06;
    ctx.fillStyle = `rgba(255, 200, 80, ${hatchWarmth})`;
    ctx.fillRect(ex - 7, ey - 3, 14, 7);
    // Bobbing down-arrow indicator
    let arrowBob = Math.floor(Math.sin(gameState.ticks * 0.12) * 2);
    ctx.fillStyle = '#ffee00';
    ctx.fillRect(ex - 1, ey - 17 + arrowBob, 2, 5);
    ctx.fillRect(ex - 3, ey - 14 + arrowBob, 6, 2);
    
    // Draw Exit — glowing stone doorway
    let exitGlow = 0.5 + Math.sin(gameState.ticks * 0.08) * 0.28;
    // Wide outer halo
    ctx.fillStyle = `rgba(0, 255, 80, ${exitGlow * 0.10})`;
    ctx.fillRect(EXIT.x - 6, EXIT.y - 8, EXIT.w + 12, EXIT.h + 12);
    // Stone arch / door frame (two layers for depth)
    ctx.fillStyle = '#3a2a18';
    ctx.fillRect(EXIT.x - 3, EXIT.y - 2, EXIT.w + 6, EXIT.h + 3);
    ctx.fillStyle = '#553c24';
    ctx.fillRect(EXIT.x - 2, EXIT.y - 1, EXIT.w + 4, EXIT.h + 2);
    // Portal interior — vivid green
    let g = Math.floor(160 + 90 * exitGlow);
    ctx.fillStyle = `rgb(0, ${g}, ${Math.floor(30 + 20 * exitGlow)})`;
    ctx.fillRect(EXIT.x, EXIT.y, EXIT.w, EXIT.h);
    // Shine highlight on left edge
    ctx.fillStyle = `rgba(200, 255, 200, ${0.12 + exitGlow * 0.08})`;
    ctx.fillRect(EXIT.x + 1, EXIT.y + 1, Math.floor(EXIT.w / 2) - 1, EXIT.h - 2);
    // Sign panel above door
    ctx.fillStyle = '#221508';
    ctx.fillRect(EXIT.x - 1, EXIT.y - 6, EXIT.w + 2, 4);
    // Pulsing green indicator on sign
    if (Math.floor(gameState.ticks / 12) % 2) {
        ctx.fillStyle = `rgba(0, 255, 80, ${exitGlow})`;
        ctx.fillRect(EXIT.x + EXIT.w / 2 - 3, EXIT.y - 5, 6, 2);
    }

    // Soft bloom around the portal (additive pass).
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
    
    // Draw Terrain
    ctx.drawImage(offscreenCanvas, 0, 0);

    // Scene props: icicles, grass tufts, rope bridges, signs
    drawSceneProps(ctx);

    // Theme atmosphere behind actors
    drawThemeAtmosphere(ctx, 'behind');

    // Foreground mist pass in front of terrain, behind actors
    let mistBase = 0.14 + Math.sin(gameState.ticks * 0.009) * 0.03;
    let mistGrad = ctx.createLinearGradient(0, 126, 0, GAME_HEIGHT);
    mistGrad.addColorStop(0, `rgba(185, 225, 255, ${mistBase * 0.12})`);
    mistGrad.addColorStop(0.55, `rgba(140, 198, 245, ${mistBase * 0.35})`);
    mistGrad.addColorStop(1, `rgba(95, 160, 220, ${mistBase * 0.55})`);
    ctx.fillStyle = mistGrad;
    ctx.fillRect(0, 124, GAME_WIDTH, GAME_HEIGHT - 124);

    // Horizontal drifting mist strips
    const mistDrift = Math.sin(gameState.ticks * 0.01) * 3;
    ctx.fillStyle = 'rgba(205, 235, 255, 0.08)';
    ctx.fillRect(14 + mistDrift, 138, 145, 10);
    ctx.fillRect(188 - mistDrift * 0.6, 146, 130, 8);
    ctx.fillStyle = 'rgba(185, 222, 250, 0.06)';
    ctx.fillRect(78 - mistDrift * 0.4, 156, 170, 9);

    // Theme atmosphere in front of terrain haze, still behind puffins
    drawThemeAtmosphere(ctx, 'front');
    
    // Draw Puffins
    puffins.forEach(p => p.draw(ctx));
    
    // Draw Particles
    particles.forEach(p => p.draw(ctx));
    
    // Draw Cursor Reticle
    if (activeSkill && currentSkillCounts[activeSkill] > 0) {
        ctx.strokeStyle = hoveredPuffin ? '#0f0' : '#fff';
        ctx.strokeRect(mouseX - 5, mouseY - 5, 10, 10);
        ctx.beginPath();
        ctx.moveTo(mouseX, mouseY - 7); ctx.lineTo(mouseX, mouseY + 7);
        ctx.moveTo(mouseX - 7, mouseY); ctx.lineTo(mouseX + 7, mouseY);
        ctx.stroke();
    }

    // Draw Nuke Countdown Warning
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

    // Subtle post-process: cold grade + vignette.
    ctx.fillStyle = 'rgba(120, 170, 230, 0.055)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let vignette = ctx.createRadialGradient(
        canvas.width * 0.5,
        canvas.height * 0.48,
        canvas.height * 0.25,
        canvas.width * 0.5,
        canvas.height * 0.5,
        canvas.width * 0.62
    );
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(0.72, 'rgba(6, 12, 24, 0.10)');
    vignette.addColorStop(1, 'rgba(4, 8, 18, 0.30)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw achievement notification
    if (typeof Achievements !== 'undefined') {
        Achievements.draw(ctx);
    }
}

