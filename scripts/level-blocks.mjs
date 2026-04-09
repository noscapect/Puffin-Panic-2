/**
 * level-blocks.mjs
 *
 * Reusable terrain building-block library for Puffin Panic 2 level design.
 *
 * Coordinate system:
 *   x = 0..GAME_WIDTH-1  (left → right)
 *   y = 0..GAME_HEIGHT-1  (top → bottom)
 *   terrain value 0 = air, 1 = solid (diggable), 10 = steel (indestructible)
 *
 * Usage:
 *   import * as B from './level-blocks.mjs';
 *   const d = new Uint8Array(B.GW * B.GH);
 *   B.borders(d);
 *   B.platform(d, 50, 200, 100);
 *   // ... more blocks
 */

export const GW = 400;
export const GH = 220;

// ─── Core primitive ───────────────────────────────────────────────────────────

/** Fill a rectangle with value v (default 1 = solid). Clamps to canvas bounds. */
export function rect(d, x1, y1, x2, y2, v = 1) {
    const cx1 = Math.max(0, Math.min(GW, x1 | 0));
    const cx2 = Math.max(0, Math.min(GW, x2 | 0));
    const cy1 = Math.max(0, Math.min(GH, y1 | 0));
    const cy2 = Math.max(0, Math.min(GH, y2 | 0));
    for (let y = cy1; y < cy2; y++)
        for (let x = cx1; x < cx2; x++)
            d[y * GW + x] = v;
}

// ─── Standard level boundaries ────────────────────────────────────────────────

/**
 * Draw unbreakable steel (value 10) borders on all four sides.
 * lw / rw = left/right wall width (px). bh = bottom height (px). th = top height (px).
 * Steel cannot be dug, bashed, mined, or bombed — puffins cannot escape the playfield.
 */
export function borders(d, lw = 5, rw = 5, bh = 15, th = 5) {
    rect(d, 0,       0,       lw,     GH, 10); // left wall  — steel
    rect(d, GW - rw, 0,       GW,     GH, 10); // right wall — steel
    rect(d, 0,       GH - bh, GW,     GH, 10); // floor      — steel
    rect(d, 0,       0,       GW, th,     10); // ceiling    — steel
}

/**
 * Full ceiling slab from y=0 down to y (exclusive).
 * Optionally limited to x1..x2 horizontal range.
 */
export function ceiling(d, y, x1 = 0, x2 = GW) {
    rect(d, x1, 0, x2, y);
}

/**
 * Solid ground column: fills x1..x2, y..GH.
 * Use this to create ground-level terrain sections.
 */
export function ground(d, x1, x2, y) {
    rect(d, x1, y, x2, GH);
}

// ─── Platformer shapes ────────────────────────────────────────────────────────

/**
 * Thin horizontal platform slab.
 * h defaults to 5 for a solid walkable surface.
 */
export function platform(d, x1, x2, y, h = 5) {
    rect(d, x1, y, x2, y + h);
}

/**
 * Vertical wall / pillar.
 * x = left edge, y1..y2 = top to bottom. w = thickness.
 */
export function vwall(d, x, y1, y2, w = 8) {
    rect(d, x, y1, x + w, y2);
}

/**
 * Diagonal ramp: ground rises from (x,y) upward over 'len' pixels by 'rise' total.
 * Creates solid fill from the computed top edge down to GH (connects to bottom).
 */
export function rampUp(d, x, y, len, rise) {
    for (let i = 0; i < len; i++) {
        const top = y - Math.round((i / Math.max(len - 1, 1)) * rise);
        rect(d, x + i, top, x + i + 1, GH);
    }
}

/**
 * Diagonal ramp: ground drops from (x,y) downward over 'len' pixels by 'drop' total.
 */
export function rampDown(d, x, y, len, drop) {
    for (let i = 0; i < len; i++) {
        const top = y + Math.round((i / Math.max(len - 1, 1)) * drop);
        rect(d, x + i, top, x + i + 1, GH);
    }
}

/**
 * Staircase stepping UP to the right.
 * x,y = left edge at floor level; steps = step count; sw = step width; sh = step height.
 * Each step rises sh pixels.
 */
export function stairsUp(d, x, y, steps, sw, sh) {
    for (let i = 0; i < steps; i++)
        rect(d, x + i * sw, y - i * sh, x + (i + 1) * sw, GH);
}

/**
 * Staircase stepping DOWN to the right.
 */
export function stairsDown(d, x, y, steps, sw, sh) {
    for (let i = 0; i < steps; i++)
        rect(d, x + i * sw, y + i * sh, x + (i + 1) * sw, GH);
}

/**
 * Hanging stalactite from a ceiling or top of terrain block.
 * x = left edge, ceilY = attachment y, w = width, h = length downward.
 */
export function stalactite(d, x, ceilY, w, h) {
    rect(d, x, ceilY, x + w, ceilY + h);
}

/**
 * Rising stalagmite from a floor surface.
 * x = left edge, floorY = surface y (top of solid), w = width, h = height upward.
 */
export function stalagmite(d, x, floorY, w, h) {
    rect(d, x, floorY - h, x + w, floorY);
}

/**
 * Equally-spaced row of vertical pillars (colonnade).
 * x1..x2 = horizontal span; y1..y2 = top/bottom; colW = pillar width; gapW = gap between pillars.
 */
export function colonnade(d, x1, x2, y1, y2, colW = 10, gapW = 20) {
    for (let x = x1; x + colW <= x2; x += colW + gapW)
        rect(d, x, y1, x + colW, y2);
}

/**
 * Rough/organic ground profile along x1..x2, centred around baseY.
 * amp = max deviation, freq = spatial frequency of the bumps.
 */
export function roughGround(d, x1, x2, baseY, amp = 8, freq = 0.18) {
    for (let x = x1; x < x2; x++) {
        const bump = Math.round(
            (Math.sin(x * freq) * 0.5 +
             Math.sin(x * freq * 1.73 + 1.2) * 0.3 +
             Math.sin(x * freq * 3.14 + 0.6) * 0.2) * amp
        );
        rect(d, x, baseY + bump, x + 1, GH);
    }
}

// ─── Cutting / hollowing ──────────────────────────────────────────────────────

/** Erase (carve air into) a horizontal tunnel through existing solid terrain. */
export function htunnel(d, x1, x2, y, h) {
    rect(d, x1, y, x2, y + h, 0);
}

/** Erase a vertical shaft through existing solid terrain. */
export function vtunnel(d, x, y1, y2, w) {
    rect(d, x, y1, x + w, y2, 0);
}

/** Erase a rectangular chamber (arch-cut). */
export function chamber(d, x, y, w, h) {
    rect(d, x, y, x + w, y + h, 0);
}

// ─── Compound shapes ──────────────────────────────────────────────────────────

/**
 * Draw a closed box room (four walls of thickness wallW).
 * The interior is NOT automatically cleared – call chamber() after if needed.
 */
export function roomWalls(d, x, y, w, h, wallW = 5) {
    rect(d, x,           y,           x + w,          y + wallW);     // top
    rect(d, x,           y + h - wallW, x + w,        y + h);         // bottom
    rect(d, x,           y,           x + wallW,      y + h);         // left
    rect(d, x + w - wallW, y,         x + w,          y + h);         // right
}

/**
 * Arched ceiling curve: pokes solid terrain from the top down with a parabolic profile.
 * midY = ceiling height at the sides; peakY = lowest ceiling height at x-centre.
 */
export function archCeiling(d, x1, x2, midY, peakY) {
    const half = (x2 - x1) / 2;
    const cx   = x1 + half;
    for (let x = x1; x < x2; x++) {
        const t  = (x - cx) / Math.max(half, 1);
        const y  = peakY + (midY - peakY) * (t * t);
        ceiling(d, Math.round(y), x, x + 1);
    }
}

/**
 * A series of floating platforms with uniform spacing.
 * list = [ {x1, x2, y, h?}, ... ]
 */
export function platforms(d, list) {
    for (const p of list) platform(d, p.x1, p.x2, p.y, p.h ?? 5);
}

// ─── Steel blocks (indestructible) ────────────────────────────────────────────

/** Fill a rectangle with steel (value 10 – cannot be dug/bashed). */
export function steel(d, x1, y1, x2, y2) {
    rect(d, x1, y1, x2, y2, 10);
}

// ─── Utility helpers ──────────────────────────────────────────────────────────

/**
 * Clear entrance zone (5px radius) and exit zone (full rect + 3px margin).
 * Call at the END of every buildTerrain to guarantee open spawn and goal points.
 */
export function clearZones(d, entrance, exit) {
    const { x: ex, y: ey } = entrance;
    for (let dy = -3; dy <= 3; dy++)
        for (let dx = -3; dx <= 6; dx++) {
            const px = ex + dx, py = ey + dy;
            if (px >= 0 && px < GW && py >= 0 && py < GH) d[py * GW + px] = 0;
        }
    const { x: zx, y: zy, w: zw = 20, h: zh = 12 } = exit;
    for (let dy = -3; dy <= zh + 3; dy++)
        for (let dx = -3; dx <= zw + 3; dx++) {
            const px = zx + dx, py = zy + dy;
            if (px >= 0 && px < GW && py >= 0 && py < GH) d[py * GW + px] = 0;
        }
}

/**
 * RLE-encode a Uint8Array into [[value,count], ...] pairs.
 */
export function encodeRLE(data) {
    const pairs = [];
    let i = 0;
    while (i < data.length) {
        const val = data[i];
        let count = 1;
        while (i + count < data.length && data[i + count] === val) count++;
        pairs.push([val, count]);
        i += count;
    }
    return pairs;
}

/**
 * Validate RLE sum equals expected pixel count.
 */
export function rleSum(pairs) {
    return pairs.reduce((s, p) => s + p[1], 0);
}
