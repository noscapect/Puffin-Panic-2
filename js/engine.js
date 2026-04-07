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
    gameSpeed = gameSpeed === 1 ? 2 : 1;
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

function triggerNuke() {
    if (!gameState.active || gameState.paused || nukeActivated) return;
    nukeActivated = true;
    nukeCountdown = FPS * 5; // 5 seconds countdown
    playSound('nukeWarning');
    
    // Disable nuke button
    let nukeBtn = document.getElementById('btn-nuke');
    if (nukeBtn) nukeBtn.classList.add('disabled');
    
    // Set all active puffins to nuke panic state
    puffins.forEach(p => {
        if (p.state !== ST_DEAD && p.state !== ST_EXITED && p.state !== ST_SPLAT) {
            p.nukePanicTicks = nukeCountdown;
            p.state = ST_NUKE_PANIC;
        }
    });
    
    // Create warning particles for each puffin
    puffins.forEach(p => {
        if (p.state !== ST_DEAD && p.state !== ST_EXITED && p.state !== ST_SPLAT) {
            createParticles(p.x + PUFFIN_W/2, p.y, 3, [255, 0, 0]);
        }
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


// --- Main Game Logic ---

window.onload = function() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    
    offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = GAME_WIDTH;
    offscreenCanvas.height = GAME_HEIGHT;
    offCtx = offscreenCanvas.getContext('2d');
    
    setupInputs();

    let levelSelect = document.getElementById('debug-level-select');
    if (levelSelect) {
        LEVELS.forEach((lvl, index) => {
            let opt = document.createElement('option');
            opt.value = index;
            opt.innerText = lvl.name;
            levelSelect.appendChild(opt);
        });
    }
    
    // Draw initial background
    ctx.fillStyle = '#111a22';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
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

function draw() {
    // Clear canvas
    ctx.fillStyle = '#111a22'; // Sky
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
    
    // Draw Stars (with twinkling animation)
    const stars = [
        {x: 100, y: 30, speed: 0.02},
        {x: 250, y: 80, speed: 0.03},
        {x: 350, y: 20, speed: 0.015},
        {x: 50, y: 120, speed: 0.025},
        {x: 180, y: 50, speed: 0.035},
        {x: 300, y: 100, speed: 0.02},
        {x: 80, y: 60, speed: 0.04},
        {x: 220, y: 30, speed: 0.015}
    ];
    
    stars.forEach(star => {
        let brightness = 0.5 + Math.sin(gameState.ticks * star.speed) * 0.5;
        ctx.fillStyle = `rgba(255, 255, 255, ${brightness})`;
        ctx.fillRect(star.x, star.y, 1, 1);
    });
    
    // Draw Moon (with subtle glow)
    ctx.fillStyle = 'rgba(255, 238, 221, 0.3)';
    ctx.beginPath();
    ctx.arc(320, 40, 20, 0, Math.PI*2);
    ctx.fill();
    
    ctx.fillStyle = '#ffeedd';
    ctx.beginPath();
    ctx.arc(320, 40, 15, 0, Math.PI*2);
    ctx.fill();

    // Draw Aurora (with subtle animation)
    let auroraOffset = Math.sin(gameState.ticks * 0.01) * 10;
    ctx.fillStyle = `rgba(0, 255, 100, ${0.08 + Math.sin(gameState.ticks * 0.005) * 0.03})`;
    ctx.beginPath();
    ctx.moveTo(0, 80 + auroraOffset);
    ctx.quadraticCurveTo(200, 30 + auroraOffset, 400, 90 + auroraOffset);
    ctx.lineTo(400, 0);
    ctx.lineTo(0, 0);
    ctx.fill();
    
    // Second aurora layer
    ctx.fillStyle = `rgba(0, 150, 255, ${0.05 + Math.sin(gameState.ticks * 0.008 + 1) * 0.03})`;
    ctx.beginPath();
    ctx.moveTo(0, 100 + auroraOffset);
    ctx.quadraticCurveTo(150, 50 + auroraOffset, 400, 110 + auroraOffset);
    ctx.lineTo(400, 0);
    ctx.lineTo(0, 0);
    ctx.fill();
    
    // Draw Entrance
    ctx.fillStyle = '#333';
    ctx.fillRect(ENTRANCE.x - 10, ENTRANCE.y - 5, 20, 10);
    ctx.fillStyle = '#000';
    ctx.fillRect(ENTRANCE.x - 8, ENTRANCE.y - 3, 16, 6);
    
    // Draw Exit Door (with animated glow)
    let exitGlow = 0.5 + Math.sin(gameState.ticks * 0.1) * 0.3;
    
    // Exit glow effect
    ctx.fillStyle = `rgba(0, 255, 0, ${exitGlow * 0.2})`;
    ctx.beginPath();
    ctx.arc(EXIT.x + EXIT.w/2, EXIT.y + EXIT.h/2, 15, 0, Math.PI*2);
    ctx.fill();
    
    // Door frame
    ctx.fillStyle = '#422';
    ctx.fillRect(EXIT.x, EXIT.y, EXIT.w, EXIT.h);
    ctx.fillStyle = '#211';
    ctx.fillRect(EXIT.x + 2, EXIT.y + 2, EXIT.w - 4, EXIT.h - 2);
    
    // Animated exit light (pulsing)
    ctx.fillStyle = `rgba(0, 255, 0, ${exitGlow})`;
    ctx.fillRect(EXIT.x + EXIT.w/2 - 2, EXIT.y - 4, 4, 4);
    
    // Exit arrow indicator
    let arrowBlink = Math.floor(gameState.ticks / 15) % 2;
    if (arrowBlink) {
        ctx.fillStyle = '#0f0';
        ctx.fillRect(EXIT.x + EXIT.w/2 - 1, EXIT.y - 8, 2, 3);
    }
    
    // Draw Terrain
    ctx.drawImage(offscreenCanvas, 0, 0);
    
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
    
    // Draw achievement notification
    if (typeof Achievements !== 'undefined') {
        Achievements.draw(ctx);
    }
}

