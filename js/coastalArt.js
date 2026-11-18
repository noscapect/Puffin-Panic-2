// Level-specific presentation drawn above the simulation's collision bitmap.
const CoastalArt = (() => {
    const terrain = document.createElement('canvas');
    const plants = document.createElement('canvas');
    terrain.width = plants.width = GAME_WIDTH * 2;
    terrain.height = plants.height = GAME_HEIGHT * 2;
    let dirty = true;

    function coastStyle() {
        return CoastStyles[LEVELS[currentLevelIndex]?.coast];
    }

    function enabled() {
        return !Editor.isActive() && LEVELS[currentLevelIndex]?.artStyle === 'coastal-remake';
    }

    function solid(x, y) {
        return x >= 0 && x < GAME_WIDTH && y >= 0 && y < GAME_HEIGHT &&
            terrainData[Math.floor(y) * GAME_WIDTH + Math.floor(x)] !== 0;
    }

    function rebuild() {
        const ctx = terrain.getContext('2d');
        const foliage = plants.getContext('2d');
        const style = coastStyle();
        const image = ctx.createImageData(terrain.width, terrain.height);
        foliage.clearRect(0, 0, plants.width, plants.height);
        foliage.save();
        foliage.scale(2, 2);
        // Half-cell visual pixels keep the simulation grid readable at HD sizes.
        for (let py = 0; py < terrain.height; py++) {
            for (let px = 0; px < terrain.width; px++) {
                const x = px / 2, y = py / 2;
                if (!solid(x, y)) continue;
                let above = 22, below = 15;
                for (let d = 1; d <= 22; d++) {
                    if (!solid(x, y - d)) { above = d; break; }
                }
                for (let d = 1; d <= 15; d++) {
                    if (!solid(x, y + d)) { below = d; break; }
                }
                const bend = 3 * Math.sin(x * 0.027) + Math.sin(x * 0.09);
                const layer = Math.floor((y + bend) / 16);
                const block = Math.floor((x + (layer % 2) * 17) / 39);
                const facet = hashNoise2D(block, layer) * 13;
                const waves = Math.sin(x * 0.018 + y * 0.054) * 7;
                const grain = (hashNoise2D(px, py) - 0.5) * 3;
                const seam = (y + bend) % 16;
                const fracture = seam < 0.5 ? -12 : seam < 1 ? 5 : 0;
                const sun = Math.max(0, 15 - above) * 1.7;
                const shade = Math.max(0, 10 - below) * 2.8;
                const side = !solid(x - 1, y) ? 12 : !solid(x + 1, y) ? -12 : 0;
                const light = facet + waves + grain + fracture + sun - shade + side;
                const i = (py * terrain.width + px) * 4;
                let color = [167 + light, 135 + light * 0.9, 98 + light * 0.65];
                if (above <= 2 && below > 3) {
                    color = above === 1 ? [110 + facet, 155 + facet, 61 + facet] : [91 + facet, 112 + facet, 52 + facet];
                }
                if (style) {
                    const surface = above <= 2 && below > 3;
                    const base = surface ? style.rim : style.stone;
                    const tint = surface ? facet : light + style.texture(x, y);
                    color = [base[0] + tint, base[1] + tint, base[2] + tint];
                }
                const material = terrainData[Math.floor(y) * GAME_WIDTH + Math.floor(x)];
                if (material === 12 && above > 3) {
                    const chevron = (x + Math.abs(y % 10 - 5)) % 14;
                    if (chevron < 2) color = [125, 78, 58];
                }
                image.data[i] = color[0];
                image.data[i + 1] = color[1];
                image.data[i + 2] = color[2];
                image.data[i + 3] = 255;
            }
        }
        ctx.putImageData(image, 0, 0);
        // Clumps rather than an even fringe: leave clear stretches of walking edge.
        for (let x = 2; x < GAME_WIDTH - 2; x++) {
            const patch = Math.sin(x * 0.15) + Math.sin(x * 0.041);
            for (let y = 8; y < GAME_HEIGHT - 2; y++) {
                if (!solid(x, y) || solid(x, y - 1) || !solid(x, y + 3)) continue;
                const seed = hashNoise2D(x, y);
                if (style === CoastStyles.harbour || style === CoastStyles.basalt) continue;
                if (patch > 0.2 && seed > 0.3) {
                    foliage.fillStyle = seed > 0.7 ? '#799b3d' : '#557c36';
                    foliage.fillRect(x, y - 1 - seed * 3, 0.5, 2 + seed * 3);
                    foliage.fillRect(x - 0.5, y - 1.5, 1.5, 0.5);
                }
                if (patch > 0.8 && seed > 0.88) {
                    foliage.fillStyle = '#65883d';
                    foliage.fillRect(x, y - 4, 0.5, 4);
                    foliage.fillStyle = style === CoastStyles.flowers ? '#f399bb' : seed > 0.96 ? '#dd997c' : '#fff0c1';
                    foliage.fillRect(x - 0.5, y - 4.5, 1.5, 1);
                    foliage.fillStyle = '#e2b64e';
                    foliage.fillRect(x, y - 4, 0.5, 0.5);
                }
            }
        }
        foliage.restore();
        dirty = false;
    }

    function background(ctx, ticks) {
        const style = coastStyle();
        const sky = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
        sky.addColorStop(0, style?.sky[0] ?? '#72bddb');
        sky.addColorStop(0.54, style?.sky[1] ?? '#d0e7df');
        sky.addColorStop(1, style?.sky[2] ?? '#66b1b9');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        const sun = ctx.createRadialGradient(63, 22, 3, 63, 22, 45);
        sun.addColorStop(0, 'rgba(255, 246, 204, 0.85)');
        sun.addColorStop(0.3, 'rgba(255, 239, 190, 0.2)');
        sun.addColorStop(1, 'rgba(255, 239, 190, 0)');
        ctx.fillStyle = sun;
        ctx.fillRect(10, 0, 100, 75);
        // Soft, stepped cloud silhouettes; their movement is independent of collision.
        for (const [cx, cy, width] of [[14, 20, 37], [222, 24, 52], [319, 56, 41]]) {
            const x = cx + Math.sin(ticks / 2500) * 4;
            ctx.fillStyle = 'rgba(255, 250, 228, 0.65)';
            ctx.fillRect(x, cy + 4, width, 3);
            ctx.fillRect(x + 5, cy + 1, width - 12, 5);
            ctx.fillRect(x + 13, cy - 1, width - 26, 4);
            ctx.fillStyle = 'rgba(221, 237, 227, 0.65)';
            ctx.fillRect(x + 2, cy + 7, width - 3, 1);
        }
        const sea = ctx.createLinearGradient(0, 107, 0, GAME_HEIGHT);
        sea.addColorStop(0, style?.sea[0] ?? '#96c8c9');
        sea.addColorStop(0.45, style?.sea[1] ?? '#67aeb8');
        sea.addColorStop(1, style?.sea[2] ?? '#3c859a');
        ctx.fillStyle = sea;
        ctx.fillRect(0, 107, GAME_WIDTH, GAME_HEIGHT - 107);
        for (const [x, y, w] of [[10, 95, 40], [45, 100, 26], [274, 96, 41], [321, 87, 77]]) {
            ctx.fillStyle = '#94b5b5';
            ctx.fillRect(x, y, w, 108 - y);
            ctx.fillStyle = '#adc9ba';
            ctx.fillRect(x + 4, y - 1, w - 9, 2);
        }
        const harbourView = LEVELS[currentLevelIndex]?.scenery === 'harbour-view';
        const horizonStyle = harbourView ? CoastStyles.harbour : style;
        if (horizonStyle) {
            const rect = (x, y, w, h, color) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); };
            ctx.save();
            if (harbourView) {
                ctx.translate(321, 38);
                ctx.scale(0.65, 0.65);
            }
            horizonStyle.horizon(rect, ctx, ticks);
            ctx.restore();
        }
        for (let row = 0; row < 22; row++) {
            const y = 109 + row * 5;
            for (let col = 0; col < 9; col++) {
                const seed = hashNoise2D(row, col);
                const x = col * 49 + seed * 30 + Math.sin(ticks * 0.008 + row) * 1.5;
                ctx.fillStyle = row % 3 ? 'rgba(215, 239, 217, 0.25)' : 'rgba(39, 111, 134, 0.15)';
                ctx.fillRect(x, y, 3 + seed * 15, 0.5);
            }
        }
    }

    function entrance(ctx, ticks, countdown, spawned) {
        const x = Math.round(ENTRANCE.x + PUFFIN_W / 2), y = Math.round(ENTRANCE.y);
        const opening = spawned ? 1 : Math.max(0, 1 - countdown / 15);
        let anchor = y - 13;
        while (anchor > 0 && !solid(x, anchor)) anchor--;
        ctx.save();
        ctx.fillStyle = '#9e865a';
        ctx.fillRect(x - 9, anchor, 0.5, y - anchor - 10);
        ctx.fillRect(x + 9, anchor, 0.5, y - anchor - 10);
        const timber = ctx.createLinearGradient(0, y - 12, 0, y);
        timber.addColorStop(0, '#c79962');
        timber.addColorStop(0.45, '#926341');
        timber.addColorStop(1, '#654a37');
        ctx.fillStyle = '#473e35';
        ctx.fillRect(x - 13, y - 13, 26, 13);
        ctx.fillStyle = timber;
        ctx.fillRect(x - 12, y - 12, 24, 3);
        ctx.fillRect(x - 12, y - 9, 4, 9);
        ctx.fillRect(x + 8, y - 9, 4, 9);
        ctx.fillStyle = '#e3bd84';
        ctx.fillRect(x - 11, y - 12, 22, 0.5);
        ctx.fillRect(x - 12, y - 9, 0.5, 8);
        ctx.fillStyle = '#343f43';
        ctx.fillRect(x - 8, y - 9, 16, 9);
        for (const side of [-1, 1]) {
            ctx.save();
            ctx.translate(x + side * 10, y);
            ctx.scale(-side, 1);
            ctx.rotate(opening * Math.PI / 2);
            ctx.fillStyle = timber;
            ctx.fillRect(0, 0, 10, 2);
            ctx.fillStyle = '#dcac70';
            ctx.fillRect(0, 0, 10, 0.5);
            ctx.fillStyle = '#444c49';
            ctx.fillRect(0, -1, 2, 3);
            ctx.fillStyle = '#c2c6b5';
            ctx.fillRect(0.5, -0.5, 0.5, 0.5);
            ctx.restore();
            ctx.fillStyle = '#545d58';
            ctx.fillRect(x + side * 10 - 1, y - 12, 2, 4);
            ctx.fillStyle = '#d5d4af';
            ctx.fillRect(x + side * 10 - 0.5, y - 11, 0.5, 0.5);
        }
        ctx.restore();
    }

    function nest(ctx) {
        const { x, y, w, h } = EXIT;
        const base = y + h;
        ctx.save();
        ctx.fillStyle = 'rgba(39, 62, 41, 0.25)';
        ctx.fillRect(x - 4, base - 1, w + 8, 2);
        ctx.fillStyle = '#7c633e';
        ctx.fillRect(x - 2, base - 6, w + 4, 4);
        ctx.fillRect(x + 1, base - 2, w - 2, 2);
        ctx.fillStyle = '#4b4731';
        ctx.fillRect(x + 1, base - 6, w - 2, 2);
        for (let i = 0; i < 27; i++) {
            const seed = hashNoise2D(i, 9);
            const sx = x - 2 + seed * (w + 2);
            const sy = base - 1 - hashNoise2D(i, 7) * 5;
            ctx.fillStyle = i % 3 ? '#c6a167' : '#efd29b';
            ctx.fillRect(Math.round(sx * 2) / 2, Math.round(sy * 2) / 2, 2 + seed * 2, 0.5);
        }
        ctx.fillStyle = '#e8e4c9';
        ctx.fillRect(x + 4, base - 8, 3, 4);
        ctx.fillRect(x + 8, base - 9, 3, 5);
        ctx.fillStyle = '#fcf3d4';
        ctx.fillRect(x + 4.5, base - 8.5, 2, 1);
        ctx.fillRect(x + 8.5, base - 9.5, 2, 1);
        ctx.restore();
    }

    function drawTerrain(ctx) {
        if (dirty) rebuild();
        ctx.drawImage(terrain, 0, 0, GAME_WIDTH, GAME_HEIGHT);
    }

    function foreground(ctx) {
        if (dirty) rebuild();
        ctx.drawImage(plants, 0, 0, GAME_WIDTH, GAME_HEIGHT);
    }

    return { enabled, background, drawTerrain, foreground, entrance, nest, invalidate() { dirty = true; } };
})();
