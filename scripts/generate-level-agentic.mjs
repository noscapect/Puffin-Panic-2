#!/usr/bin/env node
/**
 * Agentic Level Generator Prototype.
 * 
 * Concept: "Adversarial Design Loop"
 * 1. Architect builds a simple path.
 * 2. Route Analyzer finds the solution.
 * 3. Saboteur breaks the path at a critical point.
 * 4. Architect adds a skill requirement to bypass the break.
 */

import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, '..');

async function generateAgentic() {
    console.log("🚀 Starting Agentic Adversarial Design Loop...");

    // 1. Initial State: Simple floating platform and an exit
    const level = {
        version: 1,
        name: "999: Agentic Synthesis",
        total: 20,
        required: 15,
        spawnRate: 80,
        time: 9600,
        entrance: { x: 50, y: 50 },
        exit: { x: 350, y: 150, w: 20, h: 12 },
        theme: "concept_999",
        skills: { builder: 0, basher: 0 }, // Start with NO skills
        objects: [
            { type: "dirt_slab_long", x: 40, y: 100 },
            { type: "dirt_slab_long", x: 170, y: 100 },
            { type: "dirt_slab_long", x: 300, y: 150 }
        ],
        terrain: []
    };

    console.log("Step 1: Architect placed 3 platforms.");

    // 2. The Saboteur identifies the gap between platforms 1 and 2.
    // Instead of just leaving it, the Saboteur adds a STEEL PILLAR to block the path.
    console.log("Step 2: Saboteur identified a direct walk path. Adding Steel Blockade at x=160.");
    level.objects.push({ type: "steel_block", x: 160, y: 70 });

    // 3. The Architect realizes the path is blocked. 
    // It must provide a skill to go OVER or UNDER.
    console.log("Step 3: Architect provides 5 Bashers to punch through the block.");
    level.skills.basher = 5;

    // 4. Saboteur adds a PIT after the block.
    console.log("Step 4: Saboteur creates a 50px gap at x=280.");
    // (In a real agentic loop, this would be done by modifying the terrain array or removing a stamp)
    level.objects = level.objects.filter(o => o.x !== 300); // Remove the third platform
    level.objects.push({ type: "dirt_slab", x: 320, y: 150 }); // Re-add it further away

    // 5. Architect provides Builders.
    console.log("Step 5: Architect provides 5 Builders to bridge the new gap.");
    level.skills.builder = 5;

    const outputPath = resolve(ROOT, 'levels/level_999.json');
    writeFileSync(outputPath, JSON.stringify(level, null, 2));
    console.log(`\n✅ Level 999 Generated via Agentic Loop → ${outputPath}`);
}

generateAgentic();
