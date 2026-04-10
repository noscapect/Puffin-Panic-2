// --- Puffin Body Sprite Cache ---
// Pre-renders each body variant to a tiny offscreen canvas so draw calls
// replace 25+ ellipse/arc ops with a single drawImage per puffin per frame.
const _puffinBodyCache = {};
const _BODY_CACHE_W = 12; // PUFFIN_W + room for beak overhang
const _BODY_CACHE_H = 14; // PUFFIN_H + room for shadow

function _buildBodyCacheEntry(state, animFrameVal) {
    const c = document.createElement('canvas');
    c.width  = _BODY_CACHE_W;
    c.height = _BODY_CACHE_H;
    const cctx = c.getContext('2d');
    // Create a minimal proxy object that satisfies drawIllustratedBody
    const proxy = {
        state,
        animFrame: animFrameVal,
        actionTicks: 0,
    };
    proxy.drawIllustratedBody = Puffin.prototype.drawIllustratedBody.bind(proxy);
    proxy.drawIllustratedBody(cctx);
    return c;
}

function buildPuffinBodyCache() {
    // Normal body – two walk strides (feet / bob vary by animFrame % 10)
    _puffinBodyCache['normal_0'] = _buildBodyCacheEntry(ST_WALK, 0);  // stride A
    _puffinBodyCache['normal_1'] = _buildBodyCacheEntry(ST_WALK, 5);  // stride B
    // Static normal body for all non-walking, non-panic states
    _puffinBodyCache['static']   = _buildBodyCacheEntry(ST_FALL, 0);
    // Panic body – eye-beam blink on/off (period 12 frames)
    _puffinBodyCache['panic_0']  = _buildBodyCacheEntry(ST_PANIC, 0); // beam on
    _puffinBodyCache['panic_1']  = _buildBodyCacheEntry(ST_PANIC, 6); // beam off
}

// --- Puffin Class ---
class Puffin {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = 1; // 1 = right, -1 = left
        this.vy = 0;
        this.state = ST_FALL;
        this.animFrame = 0;
        this.fallStartY = y;
        
        // Skill trackers
        this.bomberTicks = -1;
        this.bomberPulseTicks = 0;
        this.bomberFinalCueTicks = 0;
        this.actionTicks = 0;
        this.bricksLayed = 0;
        this.shrugTicks = 0;
        this.builderFailTicks = 0;
        this.turnCooldown = 0;
        this.isFloater = false;
        this.isBasher = false;
        this.isClimber = false;
        this.nukePanicTicks = -1;
    }
    
    canAcceptSkill(skill) {
        if (this.state === ST_DEAD || this.state === ST_EXITED || this.state === ST_SPLAT) return false;
        if (skill === 'bomber' && this.bomberTicks > 0) return false;
        if (skill === 'floater' && this.state !== ST_FALL && this.state !== ST_WALK) return false;
        if (skill === 'climber' && this.isClimber) return false; // Already a climber
        if (skill === 'miner' && this.state !== ST_WALK) return false;
        return true;
    }
    
    assignSkill(skill) {
        if (skill === 'bomber') {
            this.bomberTicks = FPS * 5; // 5 seconds
        } else if (skill === 'floater') {
            this.isFloater = true;
            if (this.state === ST_FALL) this.state = ST_FLOAT;
        } else if (skill === 'blocker') {
            this.state = ST_BLOCK;
            this.vx = 0;
        } else if (skill === 'builder') {
            this.state = ST_BUILD;
            this.actionTicks = 0;
            this.bricksLayed = 0;
        } else if (skill === 'basher') {
            this.isBasher = true;
            // Will transition to ST_BASH when hitting a wall during walk
        } else if (skill === 'digger') {
            this.state = ST_DIG;
            this.actionTicks = 0;
        } else if (skill === 'climber') {
            this.isClimber = true;
        } else if (skill === 'miner') {
            this.state = ST_MINE;
            this.actionTicks = 0;
        }
    }
    
    update() {
        if (this.state === ST_DEAD || this.state === ST_EXITED) return;
        
        this.animFrame++;

        if (this.turnCooldown > 0) this.turnCooldown--;
        if (this.bomberPulseTicks > 0) this.bomberPulseTicks--;
        if (this.bomberFinalCueTicks > 0) this.bomberFinalCueTicks--;
        
        // Play footstep sounds and create dust particles while walking
        if ((this.state === ST_WALK || this.state === ST_BASH) && this.animFrame % 10 === 0) {
            if (typeof playSound === 'function') playSound('footstep');
            // Create dust particles when walking on ground
            if (isSolidAt(Math.floor(this.x), Math.floor(this.y + PUFFIN_H + 1))) {
                if (typeof createDustParticles === 'function') createDustParticles(this.x, this.y + PUFFIN_H);
            }
        }
        
        // Bomber logic — canonical: keeps walking/acting until the moment of explosion
        if (this.bomberTicks > 0) {
            this.bomberTicks--;
            if (this.bomberTicks > 0 && this.bomberTicks % FPS === 0) {
                this.bomberPulseTicks = 8;
            }
            if (this.bomberTicks <= FPS && this.animFrame % 3 === 0) {
                this.bomberFinalCueTicks = 2;
            }
            if (this.bomberTicks === 0) {
                this.explode();
                return;
            }
        }

        // Nuke panic logic
        if (this.nukePanicTicks > 0) {
            this.nukePanicTicks--;
            if (this.nukePanicTicks === 0) {
                this.explode();
                return;
            }
        }

        // State Machine
        switch (this.state) {
            case ST_FALL:
            case ST_FLOAT:
                this.doFall();
                break;
            case ST_WALK:
                this.doWalk();
                break;
            case ST_BLOCK:
                // Just stand there
                break;
            case ST_PANIC:
                // Just shake in panic! But fall if ground disappears
                if (!isSolidAt(Math.floor(this.x), Math.floor(this.y + PUFFIN_H + 1))) {
                    this.state = ST_FALL;
                    this.fallStartY = this.y;
                    this.vy = 0;
                }
                break;
            case ST_NUKE_PANIC:
                // Nuke panic - shake and flash before exploding
                if (!isSolidAt(Math.floor(this.x), Math.floor(this.y + PUFFIN_H + 1))) {
                    this.state = ST_FALL;
                    this.fallStartY = this.y;
                    this.vy = 0;
                }
                break;
            case ST_BUILD:
                this.doBuild();
                break;
            case ST_BASH:
                this.doBash();
                break;
            case ST_DIG:
                this.doDig();
                break;
            case ST_MINE:
                this.doMine();
                break;
            case ST_CLIMB:
                this.doClimb();
                break;
            case ST_SPLAT:
                this.actionTicks++;
                if (this.actionTicks > FPS) this.state = ST_DEAD;
                break;
        }
        
        // Check Exit (use box overlap to avoid precision misses with fractional positions)
        if (this.state !== ST_DEAD && this.state !== ST_SPLAT && this.state !== ST_EXITED) {
            const puffinLeft = this.x;
            const puffinRight = this.x + PUFFIN_W;
            const puffinTop = this.y;
            const puffinBottom = this.y + PUFFIN_H;

            const pad = 1;
            const exitLeft = EXIT.x - pad;
            const exitRight = EXIT.x + EXIT.w + pad;
            const exitTop = EXIT.y - pad;
            const exitBottom = EXIT.y + EXIT.h + pad;

            const overlapsExit =
                puffinRight >= exitLeft &&
                puffinLeft <= exitRight &&
                puffinBottom >= exitTop &&
                puffinTop <= exitBottom;

            if (overlapsExit) {
                this.state = ST_EXITED;
                gameState.saved++;
                createParticles(this.x, this.y, 20, PALETTE[7], true, 7);
                if (typeof playSound === 'function') playSound('exitCheer');
            }
        }
        
        // Bounds check
        if (this.y > GAME_HEIGHT) {
            this.state = ST_DEAD;
            gameState.dead++;
        }
    }

    getWaterZoneAt(px, py) {
        const lvl = LEVELS[currentLevelIndex];
        if (!lvl || !lvl.waterZones) return null;
        for (const zone of lvl.waterZones) {
            const inX = px >= zone.x && px <= zone.x + zone.w;
            const bodyTouchesWater = (this.y + PUFFIN_H) >= zone.y && this.y <= (zone.y + zone.h + 2);
            const pointInWater = py >= zone.y && py <= zone.y + zone.h;
            if (inX && (bodyTouchesWater || pointInWater)) {
                return zone;
            }
        }
        return null;
    }

    doSwim(zone) {
        // Keep puffins buoyant at the surface with a tiny bob.
        const bob = Math.sin(this.animFrame * 0.18) * 0.35;
        const targetY = zone.y - Math.floor(PUFFIN_H * 0.55) + bob;
        const dy = targetY - this.y;
        this.y += Math.max(-1.2, Math.min(1.2, dy));

        // Safety clamp so they cannot sink to the bottom of the water zone.
        const maxDepthY = zone.y + zone.h - PUFFIN_H + 1;
        if (this.y > maxDepthY) this.y = maxDepthY;

        // Swim toward the exit by default; this keeps puzzle flow deterministic.
        const exitCenterX = EXIT.x + EXIT.w / 2;
        const desiredDir = this.x <= exitCenterX ? 1 : -1;
        if (this.vx !== desiredDir && this.animFrame % 6 === 0) {
            this.vx = desiredDir;
        }

        if (this.animFrame % 2 === 0) {
            const swimSpeed = 0.9;
            const nextX = this.x + this.vx * swimSpeed;
            const centerY = Math.floor(this.y + PUFFIN_H / 2);
            const probeX = Math.floor(nextX + (this.vx > 0 ? PUFFIN_W : 0));
            const leadX = Math.floor(nextX + (this.vx > 0 ? PUFFIN_W - 1 : 0));

            const tryShoreExit = () => {
                const shorelineX = leadX + this.vx * 2;
                const testXs = [leadX, shorelineX];
                for (const tx of testXs) {
                    let landingY = null;
                    // Allow a much larger upward search so puffins can climb onto banks.
                    for (let dy = -20; dy <= 18; dy++) {
                        const testY = Math.floor(this.y + dy);
                        const testCenterY = Math.floor(testY + PUFFIN_H / 2);
                        const clearBody = !isSolidAt(tx, testCenterY) && !isSolidAt(tx + this.vx, testCenterY);
                        const clearFeet = !isSolidAt(tx, testY + PUFFIN_H);
                        const floorUnderFeet = isSolidAt(tx, testY + PUFFIN_H + 1);
                        if (clearBody && clearFeet && floorUnderFeet) {
                            landingY = testY;
                            break;
                        }
                    }
                    if (landingY !== null && !this.checkBlocker(tx, landingY + PUFFIN_H / 2)) {
                        this.x = nextX;
                        this.y = landingY;
                        this.state = ST_WALK;
                        this.vy = 0;
                        return true;
                    }
                }
                return false;
            };

            const outOfPool = nextX < zone.x + 1 || nextX > (zone.x + zone.w - PUFFIN_W - 1);
            const nearRightEdge = this.vx > 0 && (this.x + PUFFIN_W) >= (zone.x + zone.w - 3);
            const nearLeftEdge = this.vx < 0 && this.x <= (zone.x + 3);

            if (outOfPool || nearRightEdge || nearLeftEdge) {
                if (tryShoreExit()) return;

                // If no valid shoreline, stay in water and keep paddling at edge.
                this.vx = desiredDir;
            } else if (!isSolidAt(probeX, centerY) && !this.checkBlocker(probeX, centerY)) {
                this.x = nextX;
            } else {
                // Stay afloat while waiting for terrain to be opened.
                this.vx = desiredDir;
            }

            // Small surface splashes while paddling.
            if (typeof createSwimSplashParticles === 'function' && this.animFrame % 6 === 0) {
                createSwimSplashParticles(
                    this.x + PUFFIN_W / 2,
                    zone.y + 1,
                    this.vx
                );
            }
        }
    }
    
    doFall() {
        this.vy += 0.2; // gravity
        if (this.state === ST_FLOAT && this.vy > 1.0) this.vy = 1.0;
        if (this.state === ST_FALL && this.vy > 3.0) this.vy = 3.0; // max fall speed
        
        let steps = Math.ceil(this.vy);
        let landed = false;
        
        for (let i = 0; i < steps; i++) {
            this.y += this.vy / steps;

            const swimZone = this.getWaterZoneAt(
                Math.floor(this.x + PUFFIN_W / 2),
                Math.floor(this.y + PUFFIN_H / 2)
            );
            if (swimZone) {
                this.state = ST_WALK;
                this.vy = 0;
                this.doSwim(swimZone);
                return;
            }
            
            // Check landing at feet
            let fx = Math.floor(this.x);
            let fy = Math.floor(this.y + PUFFIN_H);
            
            if (isSolidAt(fx, fy)) {
                // Snap to top of terrain
                this.y = fy - PUFFIN_H - 1;
                while (isSolidAt(Math.floor(this.x), Math.floor(this.y + PUFFIN_H))) {
                    this.y--;
                }
                landed = true;
                break;
            }
        }
        
        if (landed) {
            let fallDist = this.y - this.fallStartY;
            if (fallDist > FALL_DEATH_DIST && !this.isFloater && this.state !== ST_FLOAT) {
                this.state = ST_SPLAT;
                this.actionTicks = 0;
                gameState.dead++;
                createParticles(this.x, this.y+PUFFIN_H, 10, PALETTE[6], true, 6);
            } else {
                // Track floater save: if puffin had floater and fell from a fatal distance
                if (this.isFloater && fallDist > FALL_DEATH_DIST) {
                    if (typeof Achievements !== 'undefined') {
                        Achievements.stats.floaterSaves++;
                    }
                }
                this.state = ST_WALK;
            }
        }
    }
    
    doWalk() {
        if (this.builderFailTicks > 0) {
            this.builderFailTicks--;
            return;
        }

        // Builder shrug: brief frozen pause before resuming walk after 12 bricks
        if (this.shrugTicks > 0) {
            this.shrugTicks--;
            return;
        }

        const swimZone = this.getWaterZoneAt(
            Math.floor(this.x + PUFFIN_W / 2),
            Math.floor(this.y + PUFFIN_H / 2)
        );
        if (swimZone) {
            this.doSwim(swimZone);
            return;
        }

        // Fall off edge check
        let fx = Math.floor(this.x);
        let fy = Math.floor(this.y + PUFFIN_H + 1);
        if (!isSolidAt(fx, fy)) {
            this.state = this.isFloater ? ST_FLOAT : ST_FALL;
            this.fallStartY = this.y;
            this.vy = 0;
            return;
        }
        
        // Move horizontal
        if (this.animFrame % 2 === 0) {
            let nextX = this.x + this.vx;
            let nx = Math.floor(nextX);
            
            // Check wall at mid-body and feet
            let wallMid = isSolidAt(nx, Math.floor(this.y + PUFFIN_H/2));
            let wallBottom = isSolidAt(nx, Math.floor(this.y + PUFFIN_H - 1));
            let hitBlocker = this.checkBlocker(nx, this.y + PUFFIN_H/2);
            
            if (wallMid || wallBottom || hitBlocker) {
                // Try stepping up (ramp climbing) — up to 6 pixels
                let stepped = false;
                if (!hitBlocker) {
                    const MAX_STEP = 6;
                    for (let step = 1; step <= MAX_STEP; step++) {
                        let testY = this.y - step;
                        let headClear = !isSolidAt(nx, Math.floor(testY));
                        let midClear  = !isSolidAt(nx, Math.floor(testY + PUFFIN_H/2));
                        let feetClear = !isSolidAt(nx, Math.floor(testY + PUFFIN_H - 1));
                        let floorSolid = isSolidAt(nx, Math.floor(testY + PUFFIN_H));
                        if (headClear && midClear && feetClear && floorSolid) {
                            this.x = nextX;
                            this.y = testY;
                            stepped = true;
                            break;
                        }
                        // Also accept stepping onto open air (will fall next frame)
                        if (headClear && midClear && feetClear && !floorSolid) {
                            this.x = nextX;
                            this.y = testY;
                            stepped = true;
                            break;
                        }
                    }
                }

                if (!stepped) {
                    if (hitBlocker) {
                        // Tiny turn buffer to avoid jittering crowds around blockers.
                        if (this.turnCooldown <= 0) {
                            this.vx *= -1;
                            this.turnCooldown = 7;
                        }
                        return;
                    }

                    // Climbers scale vertical walls
                    if (this.isClimber && wallMid) {
                        this.state = ST_CLIMB;
                        this.actionTicks = 0;
                        return;
                    }
                    
                    // Bashers start digging when hitting wall
                    if (this.isBasher && wallMid) {
                        this.state = ST_BASH;
                        this.actionTicks = 0;
                        return;
                    }

                    // Otherwise turn around
                    this.vx *= -1;
                }
            } else {
                this.x = nextX; // Path clear
            }
        }
    }
    
    doBash() {
        this.actionTicks++;
        if (this.actionTicks % 10 === 0) {
            this.x += this.vx;
            // Carve terrain horizontally
            let carved = false;
            let cx = Math.floor(this.x + (this.vx * 2));
            let cy = Math.floor(this.y + PUFFIN_H/2);
            for (let y = -5; y <= 5; y++) {
                for (let x = -2; x <= 2; x++) {
                    if (canDigAt(cx+x, cy+y, this.vx)) {
                        setTerrain(cx+x, cy+y, 0);
                        carved = true;
                    }
                }
            }
            if (carved) {
                updateTerrainPixels(cx - 2, cy - 5, 5, 11);
                createParticles(cx, cy, 3, [150,150,150]);
                if (typeof createSparkParticles === 'function') createSparkParticles(cx, cy);
                if (typeof playSound === 'function') playSound('bash');
            } else {
                // Check if there's still solid terrain ahead - only exit if truly clear
                let ahead = isSolidAt(Math.floor(this.x + this.vx), Math.floor(this.y + PUFFIN_H/2));
                if (ahead) {
                    // Steel impact: spark, stop bashing, and turn away.
                    if (typeof createSparkParticles === 'function') createSparkParticles(cx, cy);
                    if (typeof playSound === 'function') playSound('bash');
                    this.state = ST_WALK;
                    this.isBasher = false;
                    this.vx *= -1;
                } else {
                    // Path is clear, return to normal walking (basher is consumed)
                    this.state = ST_WALK;
                    this.isBasher = false;
                }
            }
        }
    }
    
    doDig() {
        this.actionTicks++;
        if (this.actionTicks % 10 === 0) {
            // Blockers turn active diggers away before the next dig stroke.
            if (this.checkBlocker(Math.floor(this.x + this.vx * 2), this.y + PUFFIN_H / 2)) {
                this.state = ST_WALK;
                this.vx *= -1;
                return;
            }

            this.y += 1;
            let cx = Math.floor(this.x);
            let cy = Math.floor(this.y + PUFFIN_H);
            let carved = false;
            let blockedBySteel = false;
            for (let y = 0; y <= 3; y++) {
                for (let x = -3; x <= 3; x++) {
                    const tx = cx + x;
                    const ty = cy + y;
                    if (canDigAt(tx, ty, this.vx)) {
                        setTerrain(tx, ty, 0);
                        carved = true;
                    } else if (isSolidAt(tx, ty)) {
                        blockedBySteel = true;
                    }
                }
            }
            if (carved) {
                updateTerrainPixels(cx - 3, cy, 7, 4);
                createParticles(cx, cy, 3, [150,150,150]);
                if (typeof playSound === 'function') playSound('dig');
            } else {
                if (blockedBySteel) {
                    if (typeof createSparkParticles === 'function') createSparkParticles(cx, cy);
                    if (typeof playSound === 'function') playSound('bash');
                }
                // Stop digging: walk if standing, otherwise fall.
                if (isSolidAt(Math.floor(this.x), Math.floor(this.y + PUFFIN_H + 1))) {
                    this.state = ST_WALK;
                } else {
                    this.state = ST_FALL;
                    this.fallStartY = this.y;
                    this.vy = 0;
                }
            }
        }
    }

    doMine() {
        // Diagonal digging downward and forward
        this.actionTicks++;
        if (this.actionTicks % 12 === 0) {
            // Blockers should repel miners too.
            if (this.checkBlocker(Math.floor(this.x + this.vx * 4), this.y + PUFFIN_H / 2)) {
                this.state = ST_WALK;
                this.vx *= -1;
                return;
            }

            this.y += 1;
            this.x += this.vx * 0.5;
            let cx = Math.floor(this.x + this.vx * 3);
            let cy = Math.floor(this.y + PUFFIN_H);
            let carved = false;
            let blockedBySteel = false;
            // Dig diagonally downward in direction facing
            for (let y = 0; y <= 4; y++) {
                for (let x = 0; x <= 4; x++) {
                    let tx = cx + (this.vx * x);
                    let ty = cy + y;
                    if (canDigAt(tx, ty, this.vx)) {
                        setTerrain(tx, ty, 0);
                        carved = true;
                    } else if (isSolidAt(tx, ty)) {
                        blockedBySteel = true;
                    }
                }
            }
            if (carved) {
                let startX = Math.min(cx, cx + this.vx * 4);
                updateTerrainPixels(startX, cy, 5, 5);
                createParticles(cx, cy, 3, [150,150,150]);
            } else {
                if (blockedBySteel) {
                    if (typeof createSparkParticles === 'function') createSparkParticles(cx, cy);
                    if (typeof playSound === 'function') playSound('bash');
                }
                // Stop mining: walk if standing, otherwise fall.
                if (isSolidAt(Math.floor(this.x), Math.floor(this.y + PUFFIN_H + 1))) {
                    this.state = ST_WALK;
                } else {
                    this.state = ST_FALL;
                    this.fallStartY = this.y;
                    this.vy = 0;
                }
            }
        }
    }

    doClimb() {
        // Climbers scale vertical walls
        this.actionTicks++;
        
        // Check if still on wall in front
        let checkX = Math.floor(this.x + this.vx);
        let feetY = Math.floor(this.y + PUFFIN_H - 1);
        let wallStillThere = 
            isSolidAt(checkX, feetY) ||
            isSolidAt(checkX, feetY - 1) ||
            isSolidAt(checkX, feetY - 2);
        
        if (!wallStillThere) {
            // Reached top! Pull up and walk
            this.x += this.vx;
            this.y -= 1;
            this.state = ST_WALK;
            return;
        }
        
        // Check for ceiling
        if (isSolidAt(Math.floor(this.x), Math.floor(this.y - 1))) {
            // Hit ceiling - turn around and fall
            this.state = ST_FALL;
            this.vx *= -1;
            this.fallStartY = this.y;
            this.vy = 0;
            return;
        }
        
        // Climb up
        if (this.actionTicks % 2 === 0) {
            this.y -= 1;
        }
    }
    
    doBuild() {
        this.actionTicks++;
        // Faster cadence so trailing puffins are less likely to outrun the builder.
        if (this.actionTicks % 6 === 0) {
            let bx = Math.floor(this.x + (this.vx * 4));
            let by = Math.floor(this.y + PUFFIN_H);

            const failBuild = () => {
                this.state = ST_WALK;
                this.vx *= -1;
                this.builderFailTicks = 12;
                if (typeof createSparkParticles === 'function') createSparkParticles(bx, by - 1);
                if (typeof playSound === 'function') playSound('bash');
            };
            
            // Smart Builder: Stop building if hitting a wall
            let checkX = Math.floor(this.x + this.vx * 4);
            let checkY = Math.floor(this.y - 1 + PUFFIN_H / 2);
            if (isSolidAt(checkX, checkY)) {
                failBuild();
                return;
            }

            // Only the *leading edge* must be clear.
            // Interior overlap is expected when extending a staircase.
            const leadX = bx + (this.vx * 3);
            if (isSolidAt(leadX, by) || isSolidAt(leadX, by - 1)) {
                failBuild();
                return;
            }

            // Lay brick
            for(let i=0; i<4; i++) {
                setTerrain(bx + (this.vx * i), by, 1);
                setTerrain(bx + (this.vx * i), by-1, 1);
            }
            
            let startX = Math.min(bx, bx + this.vx * 3);
            updateTerrainPixels(startX, by - 1, 4, 2);
            
            this.x += this.vx * 2;
            this.y -= 1;
            this.bricksLayed++;
            
            // Track build for achievements
            if (typeof Achievements !== 'undefined') {
                Achievements.trackBuild();
            }

            // Canonical Lemmings: hard stop at 12 bricks, shrug, then resume walking
            if (this.bricksLayed >= 12) {
                this.shrugTicks = 20; // ~0.6s shrug pause
                this.state = ST_WALK;
                if (typeof createDustParticles === 'function') createDustParticles(this.x, this.y + PUFFIN_H);
                if (typeof playSound === 'function') playSound('build');
                return;
            }
            
            if (typeof playSound === 'function') playSound('build');
        }
    }
    
    getSprite() {
        let spr = SPRITE_WALK[0];
        if (this.state === ST_WALK) {
            spr = SPRITE_WALK[Math.floor(this.animFrame / 5) % 2];
        } else if (this.state === ST_BUILD) {
            spr = SPRITE_BUILD;
        } else if (this.state === ST_BASH) {
            spr = SPRITE_BASH;
        } else if (this.state === ST_DIG) {
            spr = SPRITE_DIG;
        } else if (this.state === ST_FALL || this.state === ST_FLOAT) {
            spr = SPRITE_FALL;
        } else if (this.state === ST_BLOCK) {
            spr = SPRITE_BLOCK;
        } else if (this.state === ST_SPLAT) {
            spr = SPRITE_FALL;
        } else if (this.state === ST_PANIC) {
            spr = SPRITE_PANIC[Math.floor(this.animFrame / 2) % 2];
        } else if (this.state === ST_NUKE_PANIC) {
            spr = SPRITE_NUKE_PANIC[Math.floor(this.animFrame / 2) % 2];
        } else if (this.state === ST_CLIMB) {
            spr = SPRITE_CLIMB;
        } else if (this.state === ST_MINE) {
            spr = SPRITE_MINE;
        }
        return spr;
    }

    explode() {
        // Play explosion sound
        if (typeof playSound === 'function') playSound('explosion');
        
        // Visual polish: Screen shake on explosion
        screenShake = 12;
        screenShakeIntensity = 8;
        
        // Visual polish: Create shockwave particles
        if (typeof createShockwave === 'function') createShockwave(this.x + PUFFIN_W/2, this.y + PUFFIN_H/2);
        
        // Fix: Ensure entrance and exit remain accessible after explosion
        ensurePathClear();
        
        // Explosion colors - more varied palette for dramatic effect
        const explosionColors = [
            [255, 100, 0],   // Orange-red
            [255, 200, 0],   // Golden yellow
            [255, 50, 0],    // Deep red
            [255, 150, 50],  // Light orange
            [200, 50, 50],   // Dark red
            [255, 255, 100], // Bright yellow
            [180, 30, 30]    // Blood red
        ];
        
        let spr = this.getSprite();
        for (let i = 0; i < spr.length; i++) {
            let col = spr[i];
            if (col !== 0) {
                let px = i % PUFFIN_W;
                let py = Math.floor(i / PUFFIN_W);
                let actualX = this.vx < 0 ? (PUFFIN_W - 1 - px) : px;
                let x = this.x + actualX;
                let y = this.y + py;
                
                // 50% chance to turn into fire/debris, 50% keep original color
                let color;
                if (Math.random() > 0.5) {
                    color = explosionColors[Math.floor(Math.random() * explosionColors.length)];
                } else {
                    color = PALETTE[col];
                }
                
                if (color) {
                    let p = new Particle(x, y, color, true, col);
                    // Give explosion pixels more dramatic kick
                    let angle = Math.random() * Math.PI * 2;
                    let speed = 3 + Math.random() * 10;
                    p.vx = Math.cos(angle) * speed;
                    p.vy = Math.sin(angle) * speed - 3;
                    p.bounciness = 0.3 + Math.random() * 0.4;
                    particles.push(p);
                }
            }
        }
        
        // Larger explosion radius with more debris
        digHole(Math.floor(this.x), Math.floor(this.y + PUFFIN_H/2), 20);
        
        // Add extra debris particles
        for (let i = 0; i < 15; i++) {
            let angle = Math.random() * Math.PI * 2;
            let dist = 5 + Math.random() * 15;
            let dx = Math.cos(angle) * dist;
            let dy = Math.sin(angle) * dist;
            let debrisColor = explosionColors[Math.floor(Math.random() * explosionColors.length)];
            let p = new Particle(this.x + PUFFIN_W/2 + dx, this.y + PUFFIN_H/2 + dy, debrisColor, false);
            p.vx = Math.cos(angle) * (2 + Math.random() * 5);
            p.vy = Math.sin(angle) * (2 + Math.random() * 5) - 2;
            p.life = 20 + Math.random() * 30;
            p.size = 2;
            particles.push(p);
        }
        
        this.state = ST_DEAD;
        gameState.dead++;
    }
    
    checkBlocker(tx, ty) {
        // Only walking/active ground skills are blocked; fallers pass through.
        if (this.state === ST_FALL || this.state === ST_FLOAT) return false;

        for (let p of puffins) {
            if (p === this) continue;
            if (p.state === ST_BLOCK) {
                let dx = Math.abs(tx - p.x);
                let dy = Math.abs(ty - (p.y + PUFFIN_H/2));
                if (dx < 6 && dy < 10) return true;
            }
        }
        return false;
    }
    
    // Allow removing blockers by clicking them again
    toggleBlocker() {
        if (this.state === ST_BLOCK) {
            this.state = ST_WALK;
            this.vx = 1; // Reset direction
            return true;
        }
        return false;
    }
    
    // Allow stopping builders by clicking them again
    toggleBuilder() {
        if (this.state === ST_BUILD) {
            this.state = ST_WALK;
            return true;
        }
        return false;
    }
    
    // Allow stopping miners by clicking them again
    toggleMiner() {
        if (this.state === ST_MINE) {
            this.state = ST_FALL;
            this.fallStartY = this.y;
            this.vy = 0;
            return true;
        }
        return false;
    }

    drawIllustratedBody(ctx) {
        // Splat: squished flat puffin
        if (this.state === ST_SPLAT) {
            const f = Math.min(1, (this.actionTicks || 0) / 8);
            ctx.fillStyle = '#1a2232';
            ctx.beginPath();
            ctx.ellipse(4.0, 10.5, 4.2 + f * 0.8, 1.8 - f * 0.5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#bfc3cb';
            ctx.beginPath();
            ctx.ellipse(4.5, 10.5, 2.6 + f * 0.5, 1.0 - f * 0.2, 0, 0, Math.PI * 2);
            ctx.fill();
            if ((this.actionTicks || 0) < 18) {
                ctx.strokeStyle = 'rgba(255, 255, 110, 0.65)';
                ctx.lineWidth = 0.5;
                for (let i = 0; i < 5; i++) {
                    const a = (i / 5) * Math.PI * 2;
                    const r = 2.5 + f * 2.5;
                    ctx.beginPath();
                    ctx.moveTo(4.0, 10.5);
                    ctx.lineTo(4.0 + Math.cos(a) * r, 10.5 + Math.sin(a) * r * 0.45);
                    ctx.stroke();
                }
            }
            return;
        }

        const pBob = this.state === ST_PANIC || this.state === ST_NUKE_PANIC;
        // Keep bobbing mostly downward so feet stay planted instead of hovering.
        const bob = pBob
            ? Math.abs(Math.sin(this.animFrame * 0.7)) * 0.45
            : (this.state === ST_WALK || this.state === ST_BASH || this.state === ST_BUILD)
                ? Math.abs(Math.sin(this.animFrame * 0.35)) * 0.28
                : 0;

        ctx.save();
        ctx.translate(0, bob);

        // Soft body shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
        ctx.beginPath();
        ctx.ellipse(4.0, 10.7, 3.0, 1.0, 0, 0, Math.PI * 2);
        ctx.fill();

        // Body gradient (deeper charcoal so face markings pop like a puffin)
        const bodyGrad = ctx.createLinearGradient(1.2, 2.0, 7.0, 11.2);
        bodyGrad.addColorStop(0, '#2d3746');
        bodyGrad.addColorStop(0.55, '#161f2d');
        bodyGrad.addColorStop(1, '#0d141f');
        ctx.fillStyle = bodyGrad;
        ctx.beginPath();
        ctx.ellipse(3.9, 6.35, 3.25, 5.15, 0, 0, Math.PI * 2);
        ctx.fill();

        // Belly
        const bellyGrad = ctx.createLinearGradient(2.0, 4.0, 5.8, 10.2);
        bellyGrad.addColorStop(0, '#fdfdfd');
        bellyGrad.addColorStop(1, '#ced6df');
        ctx.fillStyle = bellyGrad;
        ctx.beginPath();
        ctx.ellipse(4.0, 7.55, 1.95, 3.15, 0, 0, Math.PI * 2);
        ctx.fill();

        // Wing
        ctx.fillStyle = '#0f141d';
        ctx.beginPath();
        ctx.ellipse(2.45, 7.15, 1.2, 2.45, 0.22, 0, Math.PI * 2);
        ctx.fill();

        // Head cap (puffin crown)
        ctx.fillStyle = '#101722';
        ctx.beginPath();
        ctx.arc(3.9, 3.1, 2.15, 0, Math.PI * 2);
        ctx.fill();

        // White cheek mask to break the penguin-like look and read as puffin
        ctx.fillStyle = '#f7f9fc';
        ctx.beginPath();
        ctx.ellipse(4.95, 3.45, 1.7, 1.35, -0.08, 0, Math.PI * 2);
        ctx.fill();

        // Dark collar line between head and chest
        ctx.strokeStyle = 'rgba(12, 18, 28, 0.75)';
        ctx.lineWidth = 0.35;
        ctx.beginPath();
        ctx.arc(3.9, 4.7, 1.75, Math.PI * 0.18, Math.PI * 0.95);
        ctx.stroke();

        // Beak — larger, triangular, striped puffin beak
        const isPanic = this.state === ST_PANIC || this.state === ST_NUKE_PANIC;
        if (isPanic) {
            // Open beak shape
            ctx.fillStyle = '#ea8a20';
            ctx.beginPath();
            ctx.moveTo(5.0, 2.95);
            ctx.lineTo(9.05, 3.75);
            ctx.lineTo(8.45, 5.35);
            ctx.lineTo(5.25, 5.75);
            ctx.closePath();
            ctx.fill();

            // Lower mandible tint
            ctx.fillStyle = '#f7a43b';
            ctx.beginPath();
            ctx.moveTo(5.25, 4.35);
            ctx.lineTo(8.65, 5.05);
            ctx.lineTo(5.45, 5.65);
            ctx.closePath();
            ctx.fill();

            // Mouth interior
            ctx.fillStyle = '#cc2200';
            ctx.beginPath();
            ctx.ellipse(7.25, 4.45, 0.78, 0.48, 0.06, 0, Math.PI * 2);
            ctx.fill();

            // Puffin beak color bars
            ctx.fillStyle = '#ffd24f';
            ctx.fillRect(6.2, 3.35, 0.55, 1.9);
            ctx.fillStyle = '#7fc0ff';
            ctx.fillRect(5.6, 3.15, 0.42, 1.95);
        } else {
            ctx.fillStyle = '#ea8a20';
            ctx.beginPath();
            ctx.moveTo(5.05, 3.05);
            ctx.lineTo(8.85, 4.05);
            ctx.lineTo(5.25, 5.55);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = '#f5a036';
            ctx.beginPath();
            ctx.moveTo(5.25, 4.25);
            ctx.lineTo(8.45, 5.0);
            ctx.lineTo(5.4, 5.55);
            ctx.closePath();
            ctx.fill();

            // Signature puffin beak stripes
            ctx.fillStyle = '#ffd24f';
            ctx.fillRect(6.1, 3.45, 0.55, 1.7);
            ctx.fillStyle = '#6fb4ff';
            ctx.fillRect(5.5, 3.2, 0.42, 1.8);
            ctx.fillStyle = '#f55d3a';
            ctx.fillRect(7.75, 4.0, 0.65, 0.82);
        }

        // Eye + pupil + glint — anchored on the white face mask
        if (isPanic) {
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(4.55, 3.0, 0.9, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#111';
            ctx.beginPath();
            ctx.arc(4.4, 3.15, 0.28, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.90)';
            ctx.fillRect(4.2, 2.65, 0.22, 0.22);
            if (Math.floor(this.animFrame / 6) % 2 === 0) {
                ctx.fillStyle = 'rgba(100, 185, 255, 0.75)';
                ctx.beginPath();
                ctx.arc(3.55, 1.85, 0.36, 0, Math.PI * 2);
                ctx.fill();
            }
        } else {
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(4.58, 3.18, 0.72, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#111';
            ctx.beginPath();
            ctx.arc(4.73, 3.24, 0.32, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
            ctx.fillRect(4.82, 2.88, 0.22, 0.22);
        }

        // Feet
        const step = (this.state === ST_WALK || this.state === ST_BASH) ? ((this.animFrame % 10 < 5) ? 0.35 : -0.35) : 0;
        ctx.fillStyle = '#e18c2a';
        ctx.fillRect(2.35, 10.9 + step * 0.25, 1.55, 0.9);
        ctx.fillRect(4.85, 10.9 - step * 0.25, 1.55, 0.9);

        ctx.restore();
    }

    // Returns the cache key for the current body variant
    _getBodyCacheKey() {
        const af = this.animFrame;
        const isPanic = this.state === ST_PANIC || this.state === ST_NUKE_PANIC;
        if (isPanic) {
            return Math.floor(af / 6) % 2 === 0 ? 'panic_0' : 'panic_1';
        }
        // Walk and bash share the stride animation
        if (this.state === ST_WALK || this.state === ST_BASH) {
            return af % 10 < 5 ? 'normal_0' : 'normal_1';
        }
        return 'static';
    }

    // Draws body from cache (falls back to direct draw for splat)
    _drawBodyFromCache(ctx) {
        if (this.state === ST_SPLAT) {
            this.drawIllustratedBody(ctx);
            return;
        }
        const cached = _puffinBodyCache[this._getBodyCacheKey()];
        if (cached) {
            ctx.drawImage(cached, 0, 0);
        } else {
            this.drawIllustratedBody(ctx);
        }
    }

    draw(ctx) {
        if (this.state === ST_DEAD || this.state === ST_EXITED) return;

        // Ground shadow (skipped when airborne)
        if (this.state !== ST_FALL && this.state !== ST_FLOAT && this.state !== ST_SPLAT) {
            ctx.fillStyle = 'rgba(0, 0, 20, 0.3)';
            ctx.fillRect(Math.floor(this.x) + 1, Math.floor(this.y) + PUFFIN_H, PUFFIN_W - 2, 1);
        }

        let spr = this.getSprite();
        
        ctx.save();
        ctx.translate(Math.floor(this.x), Math.floor(this.y));
        if (this.vx < 0) {
            ctx.scale(-1, 1);
            ctx.translate(-PUFFIN_W, 0); // adjust for flip
        }

        this._drawBodyFromCache(ctx);
        
        // Floater umbrella
        if (this.state === ST_FLOAT) {
            // Canopy — two-tone stripes
            ctx.fillStyle = '#ffdd00';
            ctx.fillRect(0, -7, 8, 2);
            ctx.fillStyle = '#ff8800';
            ctx.fillRect(-1, -5, 10, 2);
            ctx.fillStyle = '#ffdd00';
            ctx.fillRect(0, -3, 8, 1);
            // Wooden handle
            ctx.fillStyle = '#442200';
            ctx.fillRect(3, -2, 2, 5);
        } else if (this.isFloater && this.state !== ST_DEAD) {
            // Closed umbrella furled on the back
            ctx.fillStyle = '#cc8800';
            ctx.fillRect(4, 0, 2, 9);
            ctx.fillStyle = '#ffcc00';
            ctx.fillRect(4, 0, 1, 5); // highlight stripe
        }

        if (this.state === ST_DIG) {
            // Digger uses a shovel so it reads differently from the miner.
            ctx.fillStyle = '#8B4513';
            const shovelLift = this.animFrame % 10 < 5 ? 0 : 1;
            ctx.fillRect(3, 1 + shovelLift, 1, 8);
            ctx.fillStyle = '#b7c3ce';
            ctx.fillRect(1, 0 + shovelLift, 5, 2);
            ctx.fillRect(2, 8, 3, 2);
        } else if (this.state === ST_BUILD) {
            // Builder silhouette: hard hat plus the next brick in hand.
            ctx.fillStyle = '#f0c000';
            ctx.fillRect(-1, -4, PUFFIN_W + 2, 2); // brim
            ctx.fillRect(1, -6, PUFFIN_W - 2, 3);  // crown
            ctx.fillStyle = '#b09000'; // shadow line on hat
            ctx.fillRect(1, -4, 3, 1);
            ctx.fillStyle = '#d28c42';
            ctx.fillRect(6, 7, 3, 2);
            ctx.fillStyle = '#9f6130';
            ctx.fillRect(6, 8, 3, 1);
        } else if (this.state === ST_CLIMB) {
            // Climbing grip marks (pitons on wall side)
            ctx.fillStyle = '#aaaaaa';
            ctx.fillRect(5, 2, 3, 1);
            ctx.fillRect(5, 6, 3, 1);
        } else if (this.state === ST_MINE) {
            // Mining helmet: orange hardhat + headlamp
            ctx.fillStyle = '#f0a000';
            ctx.fillRect(-1, -4, PUFFIN_W + 2, 2); // brim
            ctx.fillRect(1, -7, PUFFIN_W - 2, 4);  // dome
            ctx.fillStyle = '#a86800';
            ctx.fillRect(1, -5, 3, 1); // shadow stripe
            ctx.fillStyle = '#ffff80';
            ctx.fillRect(3, -7, 2, 2); // headlamp lens
            ctx.fillStyle = 'rgba(255, 255, 160, 0.28)';
            ctx.fillRect(1, -9, 6, 7); // soft light cone
            // Angled pickaxe (45° swing animation)
            ctx.save();
            ctx.translate(4, 7);
            ctx.rotate(Math.PI * (0.22 + 0.1 * ((this.animFrame % 10 < 5) ? 1 : 0)));
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(-1, -6, 2, 9);
            ctx.fillStyle = '#C0C0C0';
            ctx.fillRect(-4, -6, 8, 2);
            ctx.fillStyle = '#555';
            ctx.fillRect(-4, -6, 2, 2);
            ctx.restore();
        } else if (this.state === ST_BLOCK) {
            // Arms outstretched as a living wall
            ctx.fillStyle = '#1a2332';
            ctx.fillRect(-4, 4, 4, 2);
            ctx.fillRect(PUFFIN_W, 4, 4, 2);
            ctx.fillStyle = '#ff5500';
            ctx.fillRect(-4, 4, 2, 2);
            ctx.fillRect(PUFFIN_W + 2, 4, 2, 2);
        }

        if (this.isClimber && this.state !== ST_DEAD) {
            // Climber kit: bright headband + harness so climbers read clearly at a glance.
            ctx.fillStyle = '#ff3b3b';
            ctx.fillRect(1, 1, 6, 1);
            ctx.fillStyle = '#ffd7d7';
            ctx.fillRect(2, 1, 1, 1);

            ctx.fillStyle = '#ff5a5a';
            ctx.fillRect(2, 5, 1, 4);
            ctx.fillRect(5, 5, 1, 4);
            ctx.fillRect(2, 7, 4, 1);

            // Tiny shoulder beacon that twinkles to signal the climber assignment.
            if (this.animFrame % 16 < 8) {
                ctx.fillStyle = '#fff2a8';
                ctx.fillRect(6, 3, 1, 1);
            }
        }

        if (this.isBasher && this.state !== ST_DEAD) {
            // Basher kit: heavier gloves and a helmet beacon so the role reads at a glance.
            ctx.fillStyle = '#d64545';
            ctx.fillRect(1, -5, 6, 2);
            ctx.fillStyle = '#fff1a8';
            ctx.fillRect(5, -5, 1, 1);
            ctx.fillStyle = '#ffcc00';
            
            if (this.state === ST_BASH) {
                // Animate punching during bash
                let punchedGlove = (this.animFrame % 10 < 5) ? 0 : 1; // alternate which glove extends
                let leftX = punchedGlove === 0 ? -3 : 0;
                let rightX = punchedGlove === 1 ? 8 : 6;
                
                ctx.fillRect(leftX, 7, 3, 4);
                ctx.fillRect(rightX, 7, 3, 4);
                ctx.fillStyle = '#ff8800'; // darker accent
                ctx.fillRect(leftX, 7, 1, 1);
                ctx.fillRect(rightX, 7, 1, 1);
            } else {
                // Resting position
                ctx.fillRect(0, 8, 2, 3);
                ctx.fillRect(6, 8, 2, 3);
                ctx.fillStyle = '#ff6600'; // darker accent
                ctx.fillRect(0, 8, 1, 1);
                ctx.fillRect(6, 8, 1, 1);
            }
            
            // Pulsing indicator glow when actively bashing
            if (this.state === ST_BASH && this.animFrame % 8 < 4) {
                ctx.fillStyle = 'rgba(255, 150, 0, 0.5)';
                ctx.strokeStyle = 'rgba(255, 200, 0, 0.7)';
                ctx.lineWidth = 1;
                ctx.strokeRect(-1, 7, PUFFIN_W + 2, 6);
            }
        }

        if (this.shrugTicks > 0) {
            // Builder shrug beat after the 12th brick.
            ctx.fillStyle = '#162233';
            ctx.fillRect(-2, 4, 3, 2);
            ctx.fillRect(PUFFIN_W - 1, 4, 3, 2);
            if (this.animFrame % 12 < 6) {
                ctx.fillStyle = 'rgba(255, 238, 160, 0.8)';
                ctx.fillRect(3, -8, 2, 2);
            }
        }

        if (this.builderFailTicks > 0) {
            ctx.strokeStyle = 'rgba(255, 90, 90, 0.9)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(2, -7);
            ctx.lineTo(6, -3);
            ctx.moveTo(6, -7);
            ctx.lineTo(2, -3);
            ctx.stroke();
        }
        
        ctx.restore();
        
        // Bomber text with flashing effect
        if (this.bomberTicks > 0) {
            // Flash faster as timer gets lower
            let flashRate = this.bomberTicks < FPS * 2 ? 3 : 6;
            if (this.animFrame % flashRate < flashRate / 2) {
                ctx.fillStyle = '#f00';
                ctx.font = 'bold 8px monospace';
                ctx.fillText(Math.ceil(this.bomberTicks / FPS), Math.floor(this.x)-2, Math.floor(this.y)-2);
                
                // Flashing red aura when about to explode
                if (this.bomberTicks < FPS * 2) {
                    ctx.strokeStyle = `rgba(255, 0, 0, ${0.5 + Math.sin(this.animFrame * 0.5) * 0.3})`;
                    ctx.lineWidth = 1;
                    ctx.strokeRect(Math.floor(this.x)-1, Math.floor(this.y)-1, PUFFIN_W+2, PUFFIN_H+2);
                }
            }

            if (this.bomberPulseTicks > 0) {
                const pulse = this.bomberPulseTicks / 8;
                const radius = 9 + (1 - pulse) * 10;
                ctx.strokeStyle = `rgba(255, 120, 80, ${pulse * 0.75})`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(Math.floor(this.x + PUFFIN_W / 2), Math.floor(this.y + PUFFIN_H / 2), radius, 0, Math.PI * 2);
                ctx.stroke();
            }

            if (this.bomberFinalCueTicks > 0) {
                const alpha = 0.55 + (this.bomberFinalCueTicks / 2) * 0.35;
                ctx.strokeStyle = `rgba(255, 255, 200, ${alpha})`;
                ctx.lineWidth = 2;
                ctx.strokeRect(Math.floor(this.x)-2, Math.floor(this.y)-2, PUFFIN_W+4, PUFFIN_H+4);
            }
        }

        // Hover highlight
        if (hoveredPuffin === this && activeSkill && currentSkillCounts[activeSkill] > 0) {
            ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
            ctx.strokeRect(Math.floor(this.x)-1, Math.floor(this.y)-1, PUFFIN_W+2, PUFFIN_H+2);
        }
    }
}

