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
    }
    update() {
        if (this.settled) return;

        if (!this.isPermanent) {
            this.life--;
        }

        this.vy += 0.3; // grav

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

