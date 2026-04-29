#!/usr/bin/env node
/**
 * Generates a 10-level AI-designed campaign for Puffin Panic 2.
 *
 * Each level follows a carefully crafted puzzle concept that teaches one new
 * skill, then combines skills progressively — matching the quality arc of the
 * original Lemmings game.
 *
 * Output: levels/generated/level_NNN_<slug>.json
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... node scripts/generate-campaign.mjs
 *   ANTHROPIC_API_KEY=sk-... node scripts/generate-campaign.mjs --from 3   # resume at level 3
 *   ANTHROPIC_API_KEY=sk-... node scripts/generate-campaign.mjs --only 5   # single level
 *
 * Environment:
 *   ANTHROPIC_API_KEY   required
 *   CLAUDE_MODEL        optional, default claude-sonnet-4-6
 */

import { mkdirSync, writeFileSync } from 'fs';
import { resolve, dirname }         from 'path';
import { fileURLToPath }            from 'url';
import { generateLevel }            from './generate-level.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, '..');
const OUT_DIR   = resolve(ROOT, 'levels', 'generated');

// ─── 10-level progressive curriculum ─────────────────────────────────────────
//
// Design arc:
//   1  Flat walk (no skills)  → learn basic controls
//   2  Builder gap            → teach builder
//   3  Tall drop              → teach floater
//   4  Horizontal wall        → teach basher
//   5  Vertical descent       → teach digger
//   6  Traffic fork           → teach blocker
//   7  Wall-climb challenge   → teach climber
//   8  Diagonal obstruction   → teach miner
//   9  Gap + high drop        → combine builder + floater
//   10 Three-skill gauntlet   → basher + digger + builder
//
const CURRICULUM = [
    {
        slug: 'just_walk',
        concept: `\
Design level 1 of 10 in a beginner campaign. Difficulty: trivial.

PUZZLE CONCEPT: "Just Walk" — no skills required, pure introduction.

CONSTRAINTS:
• NO skills (all zero). Puffins must walk unaided from entrance to exit.
• The entire path is clear air above a continuous flat floor.
• Save ALL 10 puffins (required = 10).
• Theme: grass. Welcoming, cheerful feel.

LAYOUT GUIDE:
• Entrance: x=30, y=148 (puffins appear here, fall ~12px to floor below)
• Floor: one solid platform from x=5 to x=394, y=160..168 (8px thick)
• Exit portal top-left at x=355, y=148 (exit sits ON the floor at y=160)
• The 12px drop from entrance.y=148 to floor at y=160 is safe (< 70px).
• Wide open space above the floor — no obstacles at all.

Name the level something welcoming like "Just Walk" or "First Steps".
Puffins spawn, walk right, stroll into the exit. Tutorial feel.`,
    },

    {
        slug: 'mind_the_gap',
        concept: `\
Design level 2 of 10 in a beginner campaign. Difficulty: easy.

PUZZLE CONCEPT: "Mind the Gap" — introduce the BUILDER skill.

CONSTRAINTS:
• ONE skill: builder=3 (solution uses 2, 1 spare).
• There is ONE gap in the floor that puffins cannot cross by walking.
• Without builders the puffins fall through and die (gap depth > 70px).
• The gap must be 40–55px wide so exactly 2 builder uses are needed to bridge it.
• Save 8 of 10 puffins (required=8, forgiving for early levels).
• Theme: grass.

LAYOUT GUIDE:
• Continuous flat floor at y=165, interrupted by a gap.
• Left platform: x=5..159, y=165..174 (solid type-1, 8px thick)
• Gap: x=160..215, y=165..214 (void — drop to bottom border, depth > 70px → fatal)
• Right platform: x=216..394, y=165..174 (solid type-1, 8px thick)
• Entrance: x=30, y=152 (13px above the left platform)
• Exit: x=355, y=153, w=20, h=12 (exit.y+12=165 = top of right platform)

SOLUTION: puffins walk right, reach gap edge at x=159. Player assigns builder.
Puffin lays 2×24px staircases spanning the ~56px gap, landing on the right platform.
Remaining puffins follow across the bridge.

Make the gap depth clearly fatal (add a deadly-looking visual by keeping the gap
all the way to the bottom border — no floor at the bottom of the gap).`,
    },

    {
        slug: 'leap_of_faith',
        concept: `\
Design level 3 of 10. Difficulty: easy-medium.

PUZZLE CONCEPT: "Leap of Faith" — introduce the FLOATER skill.

CONSTRAINTS:
• ONE skill: floater=2 (solution uses 1 required, 1 spare).
• The path leads to a DROP of exactly 90px (well over 70px death threshold).
• Without floater the puffin splatters. With floater it drifts safely to the floor below.
• NOT ALL puffins need floaters — only 1 assignment is required if timed right
  (but give 2 floaters for comfort). Save 7 of 10 (required=7).
• Theme: rock. Conveys height and danger.

LAYOUT GUIDE:
• Upper platform: x=5..200, y=100..108 (8px thick solid)
• Entrance: x=30, y=88 (12px above upper platform → safe landing)
• Lower floor: x=150..394, y=195..203 (8px thick solid)
• The drop from y=108 (edge of upper platform) to y=195 (top of lower floor) = 87px → fatal
• There must be NO terrain between y=108 and y=195 at x=150..200 (the drop zone)
• Exit: x=355, y=183, w=20, h=12 (exit.y+12=195 = top of lower floor)

SOLUTION: puffins walk right off the upper platform at x=200. They start falling.
Player assigns floater to one puffin early in the fall. That puffin drifts safely.
Others splat, but 7 is the required count with 2 floaters available.

Consider adding a decorative raised wall on the left of the upper platform to prevent
puffins from running off the left edge (a type-10 wall at x=5, y=88..108).`,
    },

    {
        slug: 'knock_knock',
        concept: `\
Design level 4 of 10. Difficulty: easy-medium.

PUZZLE CONCEPT: "Knock Knock" — introduce the BASHER skill.

CONSTRAINTS:
• ONE skill: basher=2 (solution uses 1, 1 spare).
• A thick type-1 wall (10–15px wide) completely blocks the horizontal path.
• Without bashing, puffins turn around and never reach the exit.
• Save 8 of 10 (required=8). Theme: rock or cave.

LAYOUT GUIDE:
• Continuous flat floor at y=165..173 (8px thick solid, x=5..394).
• Entrance: x=30, y=152 (13px above floor — safe landing).
• A solid type-1 wall, 12px wide: x=175..186, y=80..174 (from ceiling to floor, 94px tall)
  This completely bisects the level horizontally.
• Open air to the right of the wall: x=187..394, y=80..164.
• Exit: x=355, y=153, w=20, h=12 (exit.y+12=165 = floor top).

SOLUTION: puffin walks right, hits wall at x=175, turns back. Player assigns basher.
Puffin punches through the 12px type-1 wall and emerges on the right side, then walks to exit.

Important: the wall must be TYPE 1 (diggable), NOT type 10. Basher cannot breach type-10.`,
    },

    {
        slug: 'dig_deep',
        concept: `\
Design level 5 of 10. Difficulty: medium.

PUZZLE CONCEPT: "Dig Deep" — introduce the DIGGER skill.

CONSTRAINTS:
• ONE skill: digger=2 (solution uses 1, 1 spare).
• Puffins arrive at a raised plateau. The exit is below and to the right.
• A solid floor connects the left and right sections, but the left section is ELEVATED.
• Puffins need to dig a vertical shaft DOWN through the elevated left floor to reach the lower
  right section where the exit is.
• Drop through the shaft must be ≤ 70px (digger opens the floor but puffins fall through it).
• Save 8 of 10 (required=8). Theme: rock.

LAYOUT GUIDE:
• Upper-left platform: x=5..180, y=100..110 (10px thick solid, elevated)
• Entrance: x=30, y=88 (12px above upper platform → safe)
• Lower-right floor: x=130..394, y=165..173 (8px thick solid)
• Drop from upper platform top (y=100) to lower floor top (y=165) = 65px → SAFE (just under 70!)
• There must be NO terrain between the two platforms at x=130..180, y=110..164.
• Exit: x=355, y=153, w=20, h=12

SOLUTION: puffins walk right on the upper platform. At ~x=160 they approach the right edge.
Player assigns digger to one puffin at ~x=150. Puffin digs straight down, creating a shaft.
Puffin falls 65px and lands on the lower floor. Remaining puffins follow through the shaft.
They walk right to the exit.

Make the right edge of the upper platform (x=180) a clean cliff so puffins walk right off
if the digger is assigned too late.`,
    },

    {
        slug: 'fork_in_road',
        concept: `\
Design level 6 of 10. Difficulty: medium.

PUZZLE CONCEPT: "Fork in the Road" — introduce the BLOCKER skill.

CONSTRAINTS:
• ONE skill: blocker=2 (solution uses 1).
• Puffins spawn and can walk in two directions. The LEFT direction leads to the exit.
  The RIGHT direction leads to a fatal drop (>70px cliff).
• Without a blocker, some puffins walk off the right cliff and die. With a blocker
  placed at the fork, ALL puffins turn left and reach the exit.
• Save 9 of 10 (required=9). Theme: grass.

LAYOUT GUIDE:
• Main floor at y=120..128 (8px thick, x=5..394).
• Entrance: x=195, y=107 — puffins spawn in the MIDDLE of the floor (13px above floor).
• Left side: floor continues to x=5. Exit is on the far left wall.
• Right side: floor ends at x=280 with a sharp cliff. Below the cliff (x=280..394, y=128..)
  is a fatal drop — no floor at all until the bottom border (drop >80px, fatal).
• Exit: x=15, y=108, w=20, h=12 (exit.y+12=120 = floor top, placed left-side against left wall)

SOLUTION: puffins spawn at x=195, walk both left and right.
Puffins going right reach x=280 and fall to their death.
Player assigns a blocker at x=270 (before the cliff). Puffins going right now turn back left.
All puffins walk left and enter the exit.

Note: puffins spawn facing right (vx=+1 by default), so the FIRST puffins will walk right
toward the cliff. Player must act quickly to place a blocker.`,
    },

    {
        slug: 'going_vertical',
        concept: `\
Design level 7 of 10. Difficulty: medium.

PUZZLE CONCEPT: "Going Vertical" — introduce the CLIMBER skill.

CONSTRAINTS:
• ONE skill: climber=3 (solution needs 1 assigned climber to scout the path;
  give 3 so the player can ensure enough climbers reach the top).
• A tall type-1 vertical wall (NOT type-10) blocks the horizontal path.
• Puffins turn back at the wall. A climber scales it and continues on the far side.
• The wall must be at least 50px tall so walking around is impossible.
• Save 6 of 10 (required=6). Theme: rock or cave.

LAYOUT GUIDE:
• Continuous flat floor at y=175..183 (8px thick, x=5..394).
• Entrance: x=30, y=162 (13px above floor → safe).
• Tall type-1 wall: x=165..175, y=80..183 (103px tall, 10px wide)
  This wall sits on the floor and reaches high above. Puffins turn at x=165.
• Open air: x=176..394, y=80..174.
• Exit: x=355, y=163, w=20, h=12.
• IMPORTANT: The wall is TYPE 1 (diggable/climbable), NOT type-10.
  A climber can scale its left face (x=165) from bottom to top.

SOLUTION: puffins walk right, hit the wall at x=165, and turn back.
Player assigns climber to one puffin. It scales the left face of the wall up to y=80,
then walks right over the top and down the right side, heading to the exit.
Non-climbers keep bouncing back and forth — only climbers make it through.

Consider placing a short ledge on the right side of the wall top (x=175, y=75..80)
so the climber lands safely without a fatal drop.`,
    },

    {
        slug: 'diagonal_cut',
        concept: `\
Design level 8 of 10. Difficulty: medium-hard.

PUZZLE CONCEPT: "Diagonal Cut" — introduce the MINER skill.

CONSTRAINTS:
• ONE skill: miner=2 (solution uses 1, 1 spare).
• A DIAGONAL terrain mass blocks the direct path — puffins cannot walk through it.
• The miner tunnels diagonally down-forward through the mass, creating a path.
• Save 8 of 10 (required=8). Theme: rock or sandstone.

LAYOUT GUIDE:
• Left starting platform: x=5..150, y=100..108 (8px thick).
• Entrance: x=30, y=88 (12px above left platform → safe).
• A large diagonal terrain mass (approximate a diagonal with staircase rectangles):
    Block 1: x=145..200, y=100..114 (top of the mass)
    Block 2: x=200..240, y=114..128
    Block 3: x=240..280, y=128..142
    Block 4: x=280..320, y=142..156
  This creates a ~175px wide, ~56px tall diagonal wedge that descends right-downward.
  All type 1 (diggable).
• Right exit platform: x=300..394, y=155..163 (8px thick solid, below the wedge).
• Exit: x=355, y=143, w=20, h=12 (exit.y+12=155).
• The mass is too tall to jump over (puffins cannot jump) and too wide to walk around.

SOLUTION: puffin walks right, enters the mass at ~x=150 y=100.
Player assigns miner. Puffin digs diagonally down-right, cutting through the mass.
Emerges on the right floor around x=300, y=155. Walks to exit.`,
    },

    {
        slug: 'two_step',
        concept: `\
Design level 9 of 10. Difficulty: hard.

PUZZLE CONCEPT: "Two-Step" — combine BUILDER and FLOATER.

CONSTRAINTS:
• TWO skills: builder=3, floater=2.
• The path requires BOTH: a gap that must be bridged (needs builders) AND
  a drop on the far side that exceeds 70px (needs floater).
• Save 7 of 10 (required=7). Theme: crystal or ice.

LAYOUT GUIDE (two-stage puzzle):
Stage 1 — The Gap:
• Left upper platform: x=5..145, y=100..108 (8px thick)
• Entrance: x=30, y=88 (12px above → safe)
• Gap (fatal depth): x=146..215, y=100..214 (no floor — falls to bottom border)
• Middle island: x=216..280, y=100..108 (same height as left platform)

Stage 2 — The Drop:
• From the middle island (y=108), the right side drops 85px to the exit floor.
• Exit floor: x=260..394, y=190..198 (8px thick)
• Exit: x=355, y=178, w=20, h=12 (exit.y+12=190 = exit floor top)
• Drop from y=108 to y=190 = 82px → FATAL without floater.
• No terrain between y=108 and y=190 at x=260..280.

SOLUTION:
• Player uses 2 builders to bridge the 70px gap (left platform → middle island).
• Puffins cross to the middle island at x=216.
• From the middle island right edge at x=280, puffins walk off.
• Player assigns floater to puffins before they fall 70px.
• Floaters drift safely 82px down to the exit floor.

Both skills are REQUIRED. Forgetting either skill means deaths.`,
    },

    {
        slug: 'full_house',
        concept: `\
Design level 10 of 10 — the finale. Difficulty: hard.

PUZZLE CONCEPT: "Full House" — three-skill gauntlet using BASHER + DIGGER + BUILDER.

CONSTRAINTS:
• THREE skills: basher=2, digger=2, builder=3.
• The path requires all three in sequence: first bash through a wall, then dig down
  through a floor, then build across a gap.
• Each obstacle is clearly distinct so the player knows which skill to use.
• Save 6 of 10 (required=6). Theme: cave or volcanic_ash. Dramatic finale feel.

LAYOUT GUIDE (three-stage puzzle):
Stage 1 — Bash:
• Starting platform: x=5..150, y=80..88 (8px thick)
• Entrance: x=30, y=68 (12px above → safe)
• Thick type-1 wall (12px): x=150..161, y=20..88 (blocking the right path)

Stage 2 — Dig:
• Middle platform (right of wall): x=162..280, y=80..88 (same height)
• At ~x=240, the floor continues but 65px below is a lower floor.
• Wait — instead: the middle platform ENDS at x=280. Below (x=240..280)
  there is a thick floor section (x=240..280, y=88..155) that must be dug through.
• Dig-through floor section: x=240..280, y=88..155, type=1 (68px thick vertical block)
• Lower passage: x=240..394, y=155..163 (8px thick lower floor)

Stage 3 — Build:
• The lower passage has a gap at x=320..369 (50px wide, fatal depth below → bottom border).
• Left lower section: x=240..319, y=155..163 (solid)
• Gap: x=320..369 (no floor, falls to border)
• Right lower section: x=370..394, y=155..163 (solid)
• Exit: x=372, y=143, w=20, h=12 (exit.y+12=155)

SOLUTION:
Step 1: puffins walk right, hit wall at x=150. Assign basher → tunnels through 12px wall.
Step 2: puffins on middle platform reach x=240, start walking over the thick floor.
        Assign digger to dig through the 68px floor section. Fall 67px → SAFE (< 70).
Step 3: puffins reach gap at x=319. Assign 2-3 builders to bridge the 50px gap.
        Puffins cross to right section and enter exit.

All three skills essential, none wasted.`,
    },
];

// ─── helpers ──────────────────────────────────────────────────────────────────
function pad(n) { return String(n).padStart(3, '0'); }

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── main ─────────────────────────────────────────────────────────────────────
async function main() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) { console.error('Set ANTHROPIC_API_KEY'); process.exit(1); }

    const args    = process.argv.slice(2);
    const fromIdx = args.indexOf('--from');
    const onlyIdx = args.indexOf('--only');
    const fromNum = fromIdx !== -1 ? parseInt(args[fromIdx + 1], 10) : 1;
    const onlyNum = onlyIdx !== -1 ? parseInt(args[onlyIdx + 1], 10) : null;

    mkdirSync(OUT_DIR, { recursive: true });

    const levels = onlyNum !== null
        ? CURRICULUM.filter((_, i) => i + 1 === onlyNum)
        : CURRICULUM.filter((_, i) => i + 1 >= fromNum);

    const startNum = onlyNum ?? fromNum;

    console.log(`Puffin Panic 2 — AI Campaign Generator`);
    console.log(`Output directory: ${OUT_DIR}`);
    console.log(`Generating ${levels.length} level(s)...\n`);

    for (let i = 0; i < levels.length; i++) {
        const num  = startNum + i;
        const spec = levels[i];
        const file = `level_${pad(num)}_${spec.slug}.json`;
        const path = resolve(OUT_DIR, file);

        console.log(`[${num}/10] ${spec.slug}`);

        try {
            const lvl = await generateLevel(spec.concept, apiKey);

            // Strip internal _designNotes before saving
            const notes = lvl._designNotes;
            delete lvl._designNotes;

            writeFileSync(path, JSON.stringify(lvl, null, 2));
            console.log(`       ✓ ${file}`);
            console.log(`         ${lvl.name} | theme=${lvl.theme}`);
            const skillStr = Object.entries(lvl.skills)
                .filter(([, v]) => v > 0)
                .map(([k, v]) => `${k}×${v}`)
                .join(', ') || 'none';
            console.log(`         skills: ${skillStr}`);
            if (notes) console.log(`         ${notes}`);
        } catch (err) {
            console.error(`       ✗ FAILED: ${err.message}`);
        }

        console.log();

        // Polite delay between API calls (avoid rate-limit; skip after last item)
        if (i < levels.length - 1) await sleep(1500);
    }

    console.log('Done. Review levels in:', OUT_DIR);
    console.log('Copy them to levels/ and update js/levels.js to include them in the campaign.');
}

main();
