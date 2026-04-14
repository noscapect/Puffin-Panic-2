/**
 * gen-levels-redesign-unsolvable.mjs
 *
 * Redesigns all remaining unsolvable levels using A-grade templates and terrain building blocks.
 *
 * Usage: node scripts/gen-levels-redesign-unsolvable.mjs
 */

import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as B from './level-blocks.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const root  = join(__dir, '..');
const GW = B.GW, GH = B.GH;

// List of unsolvable levels to redesign (from latest audit)
const UNSOLVABLE = [17, 18, 19, 25, 27, 29, 37, 39, 40, 44, 51, 53, 59, 60, 62, 67, 68, 72, 76, 80, 84, 87, 90, 92, 93, 94, 97, 98, 99];

// Template: simple multi-platform, gap, wall, or pit, with skills matching the tier
function redesignLevel(num) {
  // For variety, alternate archetypes by index
  const idx = UNSOLVABLE.indexOf(num);
  const archetype = idx % 4;
  const d = new Uint8Array(GW * GH);
  let entrance, exit, skills, theme;
  switch (archetype) {
    case 0: // Platforms + gaps (builder)
      entrance = { x: 30, y: 60 };
      exit = { x: 360, y: 160, w: 20, h: 12 };
      B.borders(d, 5, 5, 12);
      B.platform(d, 5, 120, 80, 6);
      B.platform(d, 140, 260, 120, 6);
      B.platform(d, 280, 395, 160, 6);
      skills = { builder: 3 };
      theme = 'grass';
      break;
    case 1: // Tall wall (climber/basher)
      entrance = { x: 40, y: 120 };
      exit = { x: 360, y: 120, w: 20, h: 12 };
      B.borders(d, 5, 5, 12);
      B.platform(d, 5, 180, 140, 6);
      B.vwall(d, 180, 60, 140, 16);
      B.platform(d, 196, 395, 140, 6);
      skills = { climber: 2, basher: 2 };
      theme = 'rock';
      break;
    case 2: // Pit + floater/digger
      entrance = { x: 200, y: 40 };
      exit = { x: 200, y: 180, w: 20, h: 12 };
      B.borders(d, 5, 5, 12);
      B.platform(d, 80, 320, 60, 6);
      B.platform(d, 80, 320, 180, 6);
      B.vwall(d, 80, 60, 180, 8);
      B.vwall(d, 312, 60, 180, 8);
      skills = { digger: 2, floater: 10 };
      theme = 'ice';
      break;
    case 3: // Pillars + miner
      entrance = { x: 30, y: 60 };
      exit = { x: 360, y: 180, w: 20, h: 12 };
      B.borders(d, 5, 5, 12);
      B.platform(d, 5, 395, 200, 6);
      B.colonnade(d, 80, 320, 60, 200, 12, 32);
      skills = { miner: 2, builder: 1 };
      theme = 'desert';
      break;
  }
  B.clearZones(d, entrance, exit);
  const terrain = B.encodeRLE(d);
  const json = {
    version: 1,
    name: `Redesigned Level ${num}`,
    total: 12,
    required: 10,
    spawnRate: 72,
    time: 9600,
    entrance,
    exit,
    theme,
    skills: Object.assign({ floater:0, bomber:0, blocker:0, builder:0, basher:0, digger:0, climber:0, miner:0, platformer:0 }, skills),
    terrain
  };
  const filename = `level_${String(num).padStart(3,'0')}.json`;
  writeFileSync(join(root, 'levels', filename), JSON.stringify(json, null, 2));
  console.log(`✔ Redesigned ${filename}`);
}

for (const num of UNSOLVABLE) redesignLevel(num);
