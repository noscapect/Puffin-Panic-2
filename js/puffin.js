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
        this.actionTicks = 0;
        this.bricksLayed = 0;
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
        if (skill === 'platformer' && this.state !== ST_WALK) return false;
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
            // Check if already at a wall to start bashing immediately
            let nx = Math.floor(this.x + this.vx);
            let wallMid = getTerrain(nx, Math.floor(this.y + PUFFIN_H/2));
            if (wallMid === 1) {
                this.state = ST_BASH;
                this.actionTicks = 0;
            }
        } else if (skill === 'digger') {
            this.state = ST_DIG;
            this.actionTicks = 0;
        } else if (skill === 'climber') {
            this.isClimber = true;
        } else if (skill === 'miner') {
            this.state = ST_MINE;
            this.actionTicks = 0;
        } else if (skill === 'platformer') {
            this.state = ST_PLATFORM;
            this.actionTicks = 0;
            this.bricksLayed = 0;
        }
    }
    
    update() {
        if (this.state === ST_DEAD || this.state === ST_EXITED) return;
        
        this.animFrame++;
        
        // Play footstep sounds and create dust particles while walking
        if ((this.state === ST_WALK || this.state === ST_BASH) && this.animFrame % 10 === 0) {
            if (typeof playSound === 'function') playSound('footstep');
            // Create dust particles when walking on ground
            if (getTerrain(Math.floor(this.x), Math.floor(this.y + PUFFIN_H + 1)) !== 0) {
                if (typeof createDustParticles === 'function') createDustParticles(this.x, this.y + PUFFIN_H);
            }
        }
        
        // Bomber logic
        if (this.bomberTicks > 0) {
            this.bomberTicks--;
            if (this.bomberTicks === Math.floor(FPS * 1.5) && this.state !== ST_FALL && this.state !== ST_FLOAT) {
                this.state = ST_PANIC;
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
                if (getTerrain(Math.floor(this.x), Math.floor(this.y + PUFFIN_H + 1)) === 0) {
                    this.state = ST_FALL;
                    this.fallStartY = this.y;
                    this.vy = 0;
                }
                break;
            case ST_NUKE_PANIC:
                // Nuke panic - shake and flash before exploding
                if (getTerrain(Math.floor(this.x), Math.floor(this.y + PUFFIN_H + 1)) === 0) {
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
            case ST_PLATFORM:
                this.doPlatform();
                break;
            case ST_SPLAT:
                this.actionTicks++;
                if (this.actionTicks > FPS) this.state = ST_DEAD;
                break;
        }
        
        // Check Exit
        if (this.state !== ST_DEAD && this.state !== ST_SPLAT && this.state !== ST_FALL) {
            let cx = this.x;
            let cy = this.y + PUFFIN_H; // feet
            if (cx >= EXIT.x && cx <= EXIT.x + EXIT.w && cy >= EXIT.y && cy <= EXIT.y + EXIT.h) {
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
    
    doFall() {
        this.vy += 0.2; // gravity
        if (this.state === ST_FLOAT && this.vy > 1.0) this.vy = 1.0;
        if (this.state === ST_FALL && this.vy > 3.0) this.vy = 3.0; // max fall speed
        
        let steps = Math.ceil(this.vy);
        let landed = false;
        
        for (let i = 0; i < steps; i++) {
            this.y += this.vy / steps;
            
            // Check landing at feet
            let fx = Math.floor(this.x);
            let fy = Math.floor(this.y + PUFFIN_H);
            
            if (getTerrain(fx, fy) !== 0 || this.checkBlocker(fx, fy)) {
                // Snap to top of terrain
                this.y = fy - PUFFIN_H - 1;
                while (getTerrain(Math.floor(this.x), Math.floor(this.y + PUFFIN_H)) !== 0) {
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
                this.state = ST_WALK;
            }
        }
    }
    
    doWalk() {
        // Climber: Check if we can climb vertical walls
        if (this.isClimber) {
            let wallCheckX = Math.floor(this.x + this.vx);
            let wallAtMid = getTerrain(wallCheckX, Math.floor(this.y + PUFFIN_H/2));
            let wallAtHead = getTerrain(wallCheckX, Math.floor(this.y - 1));
            
            // If there's a wall at mid-body and clear space above, try climbing
            if (wallAtMid !== 0 && wallAtHead === 0) {
                // Check if we can climb up (there's ground at the top)
                let climbY = Math.floor(this.y - 2 + PUFFIN_H);
                if (climbY >= 0 && getTerrain(wallCheckX, climbY) !== 0) {
                    // Start climbing - move up and over
                    this.y -= 2;
                    this.x += this.vx;
                    return;
                }
            }
        }

        // Fall off edge check
        let fx = Math.floor(this.x);
        let fy = Math.floor(this.y + PUFFIN_H + 1);
        if (getTerrain(fx, fy) === 0) {
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
            let wallMid = getTerrain(nx, Math.floor(this.y + PUFFIN_H/2));
            let wallBottom = getTerrain(nx, Math.floor(this.y + PUFFIN_H - 1));
            
            if (wallMid !== 0 || this.checkBlocker(nx, this.y + PUFFIN_H/2)) {
                if (this.isBasher && wallMid !== 0) {
                    this.state = ST_BASH;
                    this.actionTicks = 0;
                    this.isBasher = false; // Task started
                } else {
                    this.vx *= -1; // Turn around
                }
            } else if (wallBottom !== 0) {
                // Step up 1 pixel
                let topClear = getTerrain(nx, Math.floor(this.y - 1)) === 0;
                if (topClear) {
                    this.x = nextX;
                    this.y -= 1;
                } else {
                    if (this.isBasher) {
                        this.state = ST_BASH;
                        this.actionTicks = 0;
                        this.isBasher = false; // Task started
                    } else {
                        this.vx *= -1;
                    }
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
            // Carve terrain
            let carved = false;
            let cx = Math.floor(this.x + (this.vx * 2));
            let cy = Math.floor(this.y + PUFFIN_H/2);
            for (let y = -5; y <= 5; y++) {
                for (let x = -2; x <= 2; x++) {
                    if (getTerrain(cx+x, cy+y) !== 0) {
                        setTerrain(cx+x, cy+y, 0);
                        carved = true;
                    }
                }
            }
            if (carved) {
                updateTerrainPixels(cx - 2, cy - 5, 5, 11);
                createParticles(cx, cy, 3, [150,150,150]);
                // Visual polish: Create spark particles when bashing
                if (typeof createSparkParticles === 'function') createSparkParticles(cx, cy);
                if (typeof playSound === 'function') playSound('bash');
            } else {
                // Done bashing if hitting thin air
                this.state = ST_WALK;
            }
        }
    }
    
    doDig() {
        this.actionTicks++;
        if (this.actionTicks % 10 === 0) {
            this.y += 1;
            let cx = Math.floor(this.x);
            let cy = Math.floor(this.y + PUFFIN_H);
            let carved = false;
            for (let y = 0; y <= 3; y++) {
                for (let x = -3; x <= 3; x++) {
                    if (getTerrain(cx+x, cy+y) !== 0) {
                        setTerrain(cx+x, cy+y, 0);
                        carved = true;
                    }
                }
            }
            if (carved) {
                updateTerrainPixels(cx - 3, cy, 7, 4);
                createParticles(cx, cy, 3, [150,150,150]);
                if (typeof playSound === 'function') playSound('dig');
            } else {
                this.state = ST_FALL;
                this.fallStartY = this.y;
                this.vy = 0;
            }
        }
    }

    doMine() {
        // Diagonal digging - digs down and forward
        this.actionTicks++;
        if (this.actionTicks % 12 === 0) {
            this.y += 1;
            this.x += this.vx * 0.5;
            let cx = Math.floor(this.x + this.vx * 3);
            let cy = Math.floor(this.y + PUFFIN_H);
            let carved = false;
            // Dig diagonally downward in the direction we're facing
            for (let y = 0; y <= 4; y++) {
                for (let x = 0; x <= 4; x++) {
                    let tx = cx + (this.vx * x);
                    let ty = cy + y;
                    if (getTerrain(tx, ty) !== 0) {
                        setTerrain(tx, ty, 0);
                        carved = true;
                    }
                }
            }
            if (carved) {
                let startX = Math.min(cx, cx + this.vx * 4);
                updateTerrainPixels(startX, cy, 5, 5);
                createParticles(cx, cy, 3, [150,150,150]);
            } else {
                // Check if we hit empty space below
                let below = getTerrain(Math.floor(this.x), Math.floor(this.y + PUFFIN_H + 2));
                if (below === 0) {
                    this.state = ST_FALL;
                    this.fallStartY = this.y;
                    this.vy = 0;
                }
            }
        }
    }

    doPlatform() {
        // Place small platform segments that puffins can walk on
        this.actionTicks++;
        if (this.actionTicks % 15 === 0) {
            let px = Math.floor(this.x + (this.vx * 3));
            let py = Math.floor(this.y + PUFFIN_H);
            
            // Place a small platform segment (3 pixels wide, 1 pixel tall)
            for (let i = 0; i < 3; i++) {
                setTerrain(px + (this.vx * i), py, 10);
            }
            
            let startX = Math.min(px, px + this.vx * 2);
            updateTerrainPixels(startX, py, 3, 1);
            
            // Move puffin up slightly and forward
            this.x += this.vx * 2;
            this.y -= 1;
            this.bricksLayed++;
            
            // Platform skill places up to 8 segments
            if (this.bricksLayed >= 8) {
                this.state = ST_WALK;
            }
        }
    }
    
    doBuild() {
        this.actionTicks++;
        if (this.actionTicks % 20 === 0) {
            let bx = Math.floor(this.x + (this.vx * 4));
            let by = Math.floor(this.y + PUFFIN_H);
            
            // Smart Builder: Stop building if hitting a wall
            let checkX = Math.floor(this.x + this.vx * 4);
            let checkY = Math.floor(this.y - 1 + PUFFIN_H / 2);
            if (getTerrain(checkX, checkY) !== 0) {
                this.state = ST_WALK;
                this.vx *= -1; // Turn around
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
            
            if (this.bricksLayed >= 12) {
                this.state = ST_WALK;
            }
            
            if (typeof playSound === 'function') playSound('build');
        }
    }
    
    getSprite() {
        let spr = SPRITE_WALK[0];
        if (this.state === ST_WALK || this.state === ST_BASH || this.state === ST_BUILD || this.state === ST_DIG) {
            spr = SPRITE_WALK[Math.floor(this.animFrame / 5) % 2];
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
        } else if (this.state === ST_MINE) {
            spr = SPRITE_MINE;
        } else if (this.state === ST_PLATFORM) {
            spr = SPRITE_PLATFORM;
        }
        return spr;
    }

    explode() {
        // Play explosion sound
        if (typeof playSound === 'function') playSound('explosion');
        
        // Visual polish: Screen shake on explosion
        screenShake = 8;
        screenShakeIntensity = 5;
        
        // Visual polish: Create shockwave particles
        if (typeof createShockwave === 'function') createShockwave(this.x + PUFFIN_W/2, this.y + PUFFIN_H/2);
        
        // Fix: Ensure entrance and exit remain accessible after explosion
        ensurePathClear();
        
        let spr = this.getSprite();
        for (let i = 0; i < spr.length; i++) {
            let col = spr[i];
            if (col !== 0) {
                let px = i % PUFFIN_W;
                let py = Math.floor(i / PUFFIN_W);
                let actualX = this.vx < 0 ? (PUFFIN_W - 1 - px) : px;
                let x = this.x + actualX;
                let y = this.y + py;
                let color = PALETTE[col];
                if (color) {
                    let p = new Particle(x, y, color, true, col);
                    // Give explosion pixels some extra kick
                    p.vx = (Math.random() - 0.5) * 8;
                    p.vy = (Math.random() - 1) * 8 - 2;
                    particles.push(p);
                }
            }
        }
        digHole(Math.floor(this.x), Math.floor(this.y + PUFFIN_H/2), 15);
        this.state = ST_DEAD;
        gameState.dead++;
    }
    
    checkBlocker(tx, ty) {
        // Check if hitting another blocking puffin
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
    
    // Fix: Allow removing blockers by clicking them again
    toggleBlocker() {
        if (this.state === ST_BLOCK) {
            this.state = ST_WALK;
            this.vx = 1; // Reset direction
            return true;
        }
        return false;
    }
    
    draw(ctx) {
        if (this.state === ST_DEAD || this.state === ST_EXITED) return;
        
        let spr = this.getSprite();
        
        ctx.save();
        ctx.translate(Math.floor(this.x), Math.floor(this.y));
        if (this.vx < 0) {
            ctx.scale(-1, 1);
            ctx.translate(-PUFFIN_W, 0); // adjust for flip
        }
        
        // Draw Sprite
        for (let i = 0; i < spr.length; i++) {
            let col = spr[i];
            if (col !== 0) {
                let px = i % PUFFIN_W;
                let py = Math.floor(i / PUFFIN_W);
                let color = PALETTE[col];
                ctx.fillStyle = `rgba(${color[0]},${color[1]},${color[2]},${color[3]/255})`;
                ctx.fillRect(px, py, 1, 1);
            }
        }
        
        // Floater umbrella
        if (this.state === ST_FLOAT) {
            ctx.fillStyle = '#ff5';
            ctx.fillRect(0, -6, 8, 4);
            ctx.fillStyle = '#555';
            ctx.fillRect(3, -2, 2, 4);
        } else if (this.isFloater && this.state !== ST_DEAD) {
            // Closed umbrella on the back
            ctx.fillStyle = '#cc0';
            ctx.fillRect(4, 0, 2, 8);
        }

        if (this.state === ST_BASH || this.isBasher) {
            // Boxing glove
            ctx.fillStyle = '#f00';
            let gloveX = (this.state === ST_BASH && this.animFrame % 10 < 5) ? 6 : 4; // Punching vs walking
            ctx.fillRect(gloveX, 4, 4, 4);
        } else if (this.state === ST_DIG) {
            // Pickaxe
            ctx.fillStyle = '#555'; // Handle
            let pickY = (this.animFrame % 10 < 5) ? 6 : 9; // Swinging animation
            ctx.fillRect(2, pickY - 4, 2, 8);
            ctx.fillStyle = '#aaa'; // Head
            ctx.fillRect(0, pickY - 5, 6, 2);
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
        }

        // Hover highlight
        if (hoveredPuffin === this && activeSkill && currentSkillCounts[activeSkill] > 0) {
            ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
            ctx.strokeRect(Math.floor(this.x)-1, Math.floor(this.y)-1, PUFFIN_W+2, PUFFIN_H+2);
        }
    }
}

