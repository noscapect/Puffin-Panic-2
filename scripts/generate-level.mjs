#!/usr/bin/env node
/**
 * AI-driven level generator for Puffin Panic 2.
 *
 * Uses Claude to design puzzle-first levels in original Lemmings style,
 * then converts the high-level description to the game's RLE terrain format.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... node scripts/generate-level.mjs \
 *     --concept "bridge a 50px gap with builders" \
 *     --output levels/level_042.json
 *
 * Environment:
 *   ANTHROPIC_API_KEY   required
 *   CLAUDE_MODEL        optional, default claude-sonnet-4-6
 */

import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, '..');

// ─── Grid constants (must match engine) ──────────────────────────────────────
const GRID_W    = 400;
const GRID_H    = 220;
const BORDER    = 5;           // indestructible border thickness on all sides
const TOTAL     = GRID_W * GRID_H; // 88,000 cells

// ─── Claude system prompt ─────────────────────────────────────────────────────
const SYSTEM_PROMPT = `\
You are an expert level designer for "Puffins Panic 2", a Lemmings-inspired puzzle game.
Your job is to produce puzzle-first levels that match the quality of the original Lemmings game:
one clear intended solution, spatially precise, satisfying "aha" moment.

════════════════════════════════════
GRID & COORDINATE SYSTEM
════════════════════════════════════
• Grid: 400 × 220 pixels. (0,0) is top-left. X increases right, Y increases DOWN.
• Indestructible border: rows y=0..4 and y=215..219 (type 10 auto-filled).
  Columns x=0..4 and x=395..399 (type 10 auto-filled).
• Safe playable interior: x=5..394, y=5..214. All your terrain_blocks must stay here.
• Every coordinate is an integer pixel.

════════════════════════════════════
SPAWN MECHANICS
════════════════════════════════════
• Puffins appear at exactly (entrance.x, entrance.y) and immediately fall under gravity.
• They fall until they land on terrain. If the fall exceeds 70 pixels → SPLAT (death).
• Rule: (first_terrain_y_below_entrance_x − entrance.y) MUST be ≤ 70
  UNLESS a Floater skill is provided (floater survives any height).
• After landing, puffins walk horizontally in one direction until turned by a wall.
  They walk at x=1 per tick and turn when hitting a solid cell.

════════════════════════════════════
TERRAIN TYPES
════════════════════════════════════
• 0  = air (empty)
• 1  = diggable terrain (destroyed by bash / dig / mine / bomb)
• 10 = indestructible solid (use sparingly inside the level — mostly for decorative hard walls)
• 11 = one-way terrain, blocks left-to-right only
• 12 = one-way terrain, blocks right-to-left only

════════════════════════════════════
SKILL MECHANICS (exact values)
════════════════════════════════════
BUILDER:
  • 1 use = 12 bricks. Each brick: 4px wide × 2px tall, puffin advances 2px forward, rises 1px.
  • Per use: 24px horizontal span, 12px height gain.
  • Puffin must have ≥4px flat ground to START building.
  • After 12 bricks, puffin shrugs ~0.6s then resumes walking.
  • Gap bridging capacity by skill count:
      1 builder → bridge ≤ 20px gap (flat)
      2 builders → bridge ≤ 44px gap
      3 builders → bridge ≤ 68px gap
  • Staircase rises while spanning, so the puffin lands HIGHER on the far side:
      1 use: arrives 12px higher than start
      2 uses: arrives 24px higher
      3 uses: arrives 36px higher

FLOATER:
  • Permanent once assigned. Puffin deploys umbrella on any fall, survives any height.
  • Essential for drops > 70px.

BASHER:
  • Tunnels horizontally through type-1 terrain. Stops at type-10.
  • One use clears a channel ~10px tall and up to 40px deep before stopping or hitting air.
  • Plan walls to be 6–20px thick for basher levels.

DIGGER:
  • Removes terrain directly below puffin (vertical shaft, ~6px wide).
  • Continues downward until hitting type-10 or air.

MINER:
  • Digs diagonally down-forward at ~45°. Removes type-1 terrain.
  • Stops at type-10 or air.

CLIMBER:
  • Allows puffin to scale VERTICAL type-1 terrain faces.
  • Does NOT work on type-10 walls.
  • After reaching the top, puffin continues walking in original direction.

BLOCKER:
  • Stands still permanently (until nuked). Turns any puffin that walks into it around.
  • Use to prevent puffins from walking off a deadly ledge, or to create a "turnaround zone".

BOMBER:
  • 5-second fuse, then destroys terrain in ~12px radius. Kills itself.
  • Useful for removing isolated walls or creating holes.

════════════════════════════════════
ENTRANCE & EXIT RULES
════════════════════════════════════
ENTRANCE:
  • entrance.x, entrance.y = pixel where puffins spawn.
  • There must be a solid platform (type 1 or 10) within 70px BELOW entrance.x.
  • Ideal: place entrance 10–30px above the first landing platform.
  • Puffins land and immediately start walking RIGHT (vx=+1 by default).
  • Typically place entrance in left portion: x=20..60.

EXIT:
  • exit.x, exit.y is top-left of a 20×12 portal. exit.w=20, exit.h=12.
  • Puffins WALK into the exit from the side — it must sit at ground level.
  • The floor under the exit is at y = exit.y + 12. That row must be solid terrain.
  • Typically place exit in right portion: x=320..370, or wherever the puzzle leads.

════════════════════════════════════
LEVEL DESIGN PRINCIPLES
════════════════════════════════════
1. PUZZLE-FIRST: decide the SOLUTION PATH first, then build terrain that forces it.
2. SINGLE SOLUTION: the given skill counts should yield exactly one elegant solution.
   Every skill provided must be used. Zero unused skills.
3. TIGHT BUDGET: provide the minimum skills needed + at most 1 spare of each type.
   Never give 5+ of a skill unless the puzzle demands chaining.
4. SPATIAL PRECISION:
   - Gaps for builders must be wide enough to require building (≥26px) but bridgeable.
   - Falls requiring a floater must be >70px. Falls without floater must be ≤70px.
   - Walls for bashers must be thick enough to need bashing (≥6px wide type-1 wall).
5. VISUAL CLARITY: player sees entrance top-left, exit somewhere reachable, obstacle between.
6. VARIETY: 2–4 terrain "features" (gap, wall, drop, raised platform). Avoid mazes.
7. AHA MOMENT: solution feels clever but obvious in hindsight.

════════════════════════════════════
PLATFORM DESIGN TIPS
════════════════════════════════════
• Main floor typically at y=155..175 (30–60px from bottom border at y=215).
• Platforms 8–15px thick is comfortable. Thin platforms (4–6px) look fragile/risky.
• Entrance platform: place at entrance_y + 15px (puffin lands safely, <70px drop).
• The exit platform must be solid under the exit portal.
• Leave at least 20px vertical clearance above platforms (puffin is 12px tall, needs head room).

════════════════════════════════════
OUTPUT FORMAT
════════════════════════════════════
Respond with ONLY a valid JSON object — no markdown fences, no commentary before or after.

{
  "meta": {
    "name": "string (short, evocative, Lemmings-style)",
    "total": 10,
    "required": 8,
    "spawnRate": 75,
    "time": 9600,
    "theme": "grass",
    "skills": {
      "floater":0,"bomber":0,"blocker":0,"builder":0,
      "basher":0,"digger":0,"climber":0,"miner":0,"platformer":0
    }
  },
  "entrance": { "x": 30, "y": 55 },
  "exit": { "x": 350, "y": 152, "w": 20, "h": 12 },
  "terrain_blocks": [
    { "x":5, "y":165, "w":390, "h":10, "type":1 }
  ],
  "waterZones": [],
  "design_notes": "2–3 sentences: puzzle concept, intended solution path, what makes it fun"
}

terrain_blocks rules:
• All blocks must be within x=5..394, y=5..214.
• type must be 1 (diggable) or 10 (indestructible). Use 10 only for special hard walls.
• Blocks may overlap; later blocks overwrite earlier ones.
• Always include a ground block under the exit so puffins can walk into it.
• Always include a landing platform below the entrance within 70px.

Available themes: grass, rock, ice, snow, desert, crystal, cave, mud, lava, deep_sea,
wood_planks, mossy_ruin, volcanic_ash, sandstone, frozen_mud, salt_flats
`;

// ─── API call (fetch-based, no SDK dependency) ────────────────────────────────
async function callClaude(userPrompt, apiKey) {
    const model = process.env.CLAUDE_MODEL ?? 'claude-sonnet-4-6';

    const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type':    'application/json',
            'anthropic-version': '2023-06-01',
            'x-api-key':       apiKey,
        },
        body: JSON.stringify({
            model,
            max_tokens: 4096,
            system:   SYSTEM_PROMPT,
            messages: [{ role: 'user', content: userPrompt }],
        }),
    });

    if (!res.ok) {
        const body = await res.text();
        throw new Error(`Claude API ${res.status}: ${body}`);
    }

    const data = await res.json();
    return data.content[0].text;
}

// ─── Extract the JSON object from a Claude response ───────────────────────────
function extractJSON(text) {
    // Find the outermost {...} block
    const start = text.indexOf('{');
    if (start === -1) throw new Error('No JSON object found in response');
    let depth = 0;
    for (let i = start; i < text.length; i++) {
        if (text[i] === '{') depth++;
        else if (text[i] === '}') {
            depth--;
            if (depth === 0) return JSON.parse(text.slice(start, i + 1));
        }
    }
    throw new Error('Unterminated JSON object in response');
}

// ─── Rasterise terrain blocks onto an 88,000-cell grid ───────────────────────
function buildGrid(blocks) {
    const grid = new Uint8Array(TOTAL); // all 0 = air

    // Indestructible border
    for (let y = 0; y < GRID_H; y++) {
        for (let x = 0; x < GRID_W; x++) {
            if (y < BORDER || y >= GRID_H - BORDER ||
                x < BORDER || x >= GRID_W - BORDER) {
                grid[y * GRID_W + x] = 10;
            }
        }
    }

    // Terrain blocks (later blocks overwrite earlier ones)
    for (const { x, y, w, h, type } of blocks) {
        for (let dy = 0; dy < h; dy++) {
            for (let dx = 0; dx < w; dx++) {
                const px = x + dx;
                const py = y + dy;
                if (px >= 0 && px < GRID_W && py >= 0 && py < GRID_H) {
                    grid[py * GRID_W + px] = type;
                }
            }
        }
    }

    return grid;
}

// ─── RLE-encode a Uint8Array to [[value, count], ...] ─────────────────────────
function encodeRLE(grid) {
    const rle = [];
    let cur = grid[0], count = 1;
    for (let i = 1; i < grid.length; i++) {
        if (grid[i] === cur) {
            count++;
        } else {
            rle.push([cur, count]);
            cur = grid[i];
            count = 1;
        }
    }
    rle.push([cur, count]);
    return rle;
}

// ─── Validate that the level JSON looks sane ─────────────────────────────────
function validate(level) {
    const errors = [];

    // RLE total must equal grid size
    const total = level.terrain.reduce((s, [, c]) => s + c, 0);
    if (total !== TOTAL) errors.push(`Terrain total ${total} ≠ ${TOTAL}`);

    // Entrance inside playable area
    const { x: ex, y: ey } = level.entrance;
    if (ex < BORDER || ex >= GRID_W - BORDER) errors.push(`entrance.x ${ex} out of bounds`);
    if (ey < BORDER || ey >= GRID_H - BORDER) errors.push(`entrance.y ${ey} out of bounds`);

    // Exit inside playable area
    const { x: exitX, y: exitY, w: exitW, h: exitH } = level.exit;
    if (exitX < BORDER || exitX + exitW > GRID_W - BORDER)
        errors.push(`exit.x ${exitX}+${exitW} out of bounds`);
    if (exitY < BORDER || exitY + exitH > GRID_H - BORDER)
        errors.push(`exit.y ${exitY}+${exitH} out of bounds`);

    if (errors.length) throw new Error('Level validation failed:\n  ' + errors.join('\n  '));
}

// ─── Assemble the final level JSON from Claude's raw output ───────────────────
function assembleLevelJSON(raw) {
    const grid  = buildGrid(raw.terrain_blocks ?? []);
    const rle   = encodeRLE(grid);

    const level = {
        version:   1,
        name:      raw.meta.name,
        total:     raw.meta.total     ?? 10,
        required:  raw.meta.required  ?? 8,
        spawnRate: raw.meta.spawnRate ?? 75,
        time:      raw.meta.time      ?? 9600,
        entrance:  raw.entrance,
        exit:      { ...raw.exit, w: raw.exit.w ?? 20, h: raw.exit.h ?? 12 },
        theme:     raw.meta.theme     ?? 'grass',
        skills:    {
            floater:    0, bomber: 0, blocker: 0, builder: 0,
            basher:     0, digger: 0, climber: 0, miner:   0, platformer: 0,
            ...raw.meta.skills,
        },
        terrain: rle,
    };

    if (Array.isArray(raw.waterZones) && raw.waterZones.length > 0)
        level.waterZones = raw.waterZones;
    if (Array.isArray(raw.lavaZones)  && raw.lavaZones.length  > 0)
        level.lavaZones  = raw.lavaZones;

    return level;
}

// ─── Public API ───────────────────────────────────────────────────────────────
export async function generateLevel(concept, apiKey) {
    const text = await callClaude(concept, apiKey);
    const raw  = extractJSON(text);
    const lvl  = assembleLevelJSON(raw);
    validate(lvl);

    // Surface the design notes to stdout so the caller can log them
    lvl._designNotes = raw.design_notes ?? '';
    return lvl;
}

// ─── CLI entrypoint ───────────────────────────────────────────────────────────
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const args       = process.argv.slice(2);
    const conceptIdx = args.indexOf('--concept');
    const outputIdx  = args.indexOf('--output');

    if (conceptIdx === -1 || outputIdx === -1) {
        console.error('Usage: node scripts/generate-level.mjs --concept "..." --output levels/XXX.json');
        process.exit(1);
    }

    const concept = args[conceptIdx + 1];
    const output  = args[outputIdx  + 1];
    const apiKey  = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) { console.error('Set ANTHROPIC_API_KEY'); process.exit(1); }

    console.log(`Generating: "${concept}"`);
    try {
        const lvl = await generateLevel(concept, apiKey);
        const path = resolve(ROOT, output);
        writeFileSync(path, JSON.stringify(lvl, null, 2));
        console.log(`✓ Written to ${path}`);
        console.log(`  Name : ${lvl.name}`);
        console.log(`  Theme: ${lvl.theme}`);
        console.log(`  Skills: ${JSON.stringify(lvl.skills)}`);
        if (lvl._designNotes) console.log(`  Notes: ${lvl._designNotes}`);
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
}
