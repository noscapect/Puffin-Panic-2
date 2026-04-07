// --- Particles ---
class Particle {
    constructor(x, y, color, isPermanent = false, paletteIndex = 0) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 6;
        this.vy = (Math.random() - 1) * 6;
        this.color = color;
        this.life = 20 + Math.random() * 20;
        this.isPermanent = isPermanent;
        this.paletteIndex = paletteIndex;
        this.settled = false;
        this.bounciness = 0.5;
        this.friction = 0.8;
        this.gravityScale = 1;
        this.collisionEnabled = true;
        this.fadeRate = 1;
    }
    update() {
        if (this.settled) return;

        if (!this.isPermanent) {
            this.life -= this.fadeRate;
        }

        this.vy += 0.3 * this.gravityScale; // grav

        if (!this.collisionEnabled) {
            this.x += this.vx;
            this.y += this.vy;
            if (this.y > GAME_HEIGHT + 20 || this.y < -20) {
                this.life = 0;
                this.isPermanent = false;
            }
            return;
        }

        // Y collision
        let nextY = this.y + this.vy;
        if (getTerrain(Math.floor(this.x), Math.floor(nextY)) !== 0) {
            this.vy = -this.vy * this.bounciness;
            this.vx *= this.friction;
            if (Math.abs(this.vy) < 0.5) {
                this.vy = 0;
                this.y = Math.floor(this.y); // Prevent sinking
                if (this.isPermanent && Math.abs(this.vx) < 0.1) {
                    this.settled = true;
                    if (this.paletteIndex > 0) {
                        setTerrain(Math.floor(this.x), Math.floor(this.y), this.paletteIndex + 10);
                        updateTerrainPixels(Math.floor(this.x), Math.floor(this.y), 1, 1);
                        this.life = 0;
                        this.isPermanent = false; // Let it be culled, it's terrain now
                    }
                }
            }
        } else {
            this.y = nextY;
        }

        // X collision
        let nextX = this.x + this.vx;
        if (getTerrain(Math.floor(nextX), Math.floor(this.y)) !== 0) {
            this.vx = -this.vx * this.bounciness;
        } else {
            this.x = nextX;
        }

        if (this.y > GAME_HEIGHT + 20) {
            this.life = 0;
            this.isPermanent = false;
        }
    }
    draw(ctx) {
        if (this.life > 0 || this.isPermanent) {
            let alpha = this.isPermanent ? 1 : Math.max(0, this.life / 40);
            ctx.fillStyle = `rgba(${this.color[0]},${this.color[1]},${this.color[2]},${alpha})`;
            ctx.fillRect(Math.floor(this.x), Math.floor(this.y), 1, 1);
        }
    }
}

function createParticles(x, y, count, color, isPermanent = false) {
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(x, y, color, isPermanent));
    }
}

// Visual Polish: Create dust particles when walking
function createDustParticles(x, y) {
    for (let i = 0; i < 2; i++) {
        let p = new Particle(x + (Math.random() - 0.5) * 6, y, [180, 170, 160, 150], false);
        p.vx = (Math.random() - 0.5) * 1;
        p.vy = -Math.random() * 2;
        p.life = 10 + Math.random() * 10;
        particles.push(p);
    }
}

// Visual Polish: Create spark particles when bashing
function createSparkParticles(x, y) {
    for (let i = 0; i < 5; i++) {
        let p = new Particle(x + (Math.random() - 0.5) * 8, y + (Math.random() - 0.5) * 8, [255, 200 + Math.random() * 55, 50], false);
        p.vx = (Math.random() - 0.5) * 6;
        p.vy = (Math.random() - 0.5) * 6;
        p.life = 5 + Math.random() * 10;
        particles.push(p);
    }
}

// Visual Polish: Create explosion shockwave particles
function createShockwave(x, y) {
    for (let i = 0; i < 12; i++) {
        let angle = (i / 12) * Math.PI * 2;
        let p = new Particle(x, y, [255, 100, 0], false);
        p.vx = Math.cos(angle) * 4;
        p.vy = Math.sin(angle) * 4;
        p.life = 10 + Math.random() * 5;
        particles.push(p);
    }
}

// Visual polish: Exit portal ambience wisps
function createPortalParticles(x, y, count = 2) {
    const portalColors = [
        [110, 255, 190],
        [80, 230, 255],
        [145, 255, 230]
    ];

    for (let i = 0; i < count; i++) {
        let color = portalColors[Math.floor(Math.random() * portalColors.length)];
        let p = new Particle(x + (Math.random() - 0.5) * 6, y + (Math.random() - 0.5) * 5, color, false);
        p.vx = (Math.random() - 0.5) * 0.45;
        p.vy = -0.45 - Math.random() * 0.75;
        p.gravityScale = -0.04;
        p.collisionEnabled = false;
        p.fadeRate = 0.85;
        p.life = 20 + Math.random() * 24;
        particles.push(p);
    }
}

