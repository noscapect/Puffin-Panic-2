// gen-levels-redesign-unsolvable-v2.mjs
// Batch-regenerate only the remaining unsolvable levels with new, distinct templates.
// Uses level-blocks.mjs for terrain construction.

import fs from 'fs';
import * as B from './level-blocks.mjs';

const GW = B.GW, GH = B.GH;

const targets = [
  { num: 17, theme: 'grass', skills: { builder: 2, digger: 2, climber: 2 } },
  { num: 25, theme: 'desert', skills: { builder: 2, miner: 2, floater: 2 } },
  { num: 27, theme: 'grass', skills: { builder: 2, basher: 2, climber: 2 } },
  { num: 39, theme: 'desert', skills: { builder: 2, miner: 2, digger: 2 } },
  { num: 40, theme: 'grass', skills: { builder: 2, digger: 2, basher: 2 } },
  { num: 53, theme: 'desert', skills: { builder: 2, miner: 2, climber: 2 } },
  { num: 59, theme: 'grass', skills: { builder: 2, digger: 2, floater: 2 } },
  { num: 67, theme: 'desert', skills: { builder: 2, miner: 2, basher: 2 } },
  { num: 68, theme: 'grass', skills: { builder: 2, digger: 2, basher: 2 } },
  { num: 80, theme: 'desert', skills: { builder: 2, miner: 2, floater: 2 } },
];

function buildTerrain(num, theme) {
  const d = new Uint8Array(GW * GH);
  B.borders(d);
  // Vary archetype by level number for diversity
  switch (num % 5) {
    case 0:
      B.platform(d, 40, 360, 180);
      B.platform(d, 80, 320, 120);
      B.platform(d, 120, 280, 60);
      break;
    case 1:
      B.ground(d, 40, 360, 180);
      B.vwall(d, 200, 60, 180);
      B.platform(d, 200, 360, 120);
      break;
    case 2:
      B.platform(d, 40, 360, 180);
      B.stairsUp(d, 40, 180, 6, 20, 10);
      break;
    case 3:
      B.platform(d, 40, 360, 180);
      B.colonnade(d, 60, 340, 100, 180, 12, 32);
      break;
    case 4:
      B.platform(d, 40, 360, 180);
      B.rampUp(d, 40, 180, 100, 60);
      B.rampDown(d, 300, 120, 60, 60);
      break;
  }
  return d;
}

targets.forEach(({ num, theme, skills }) => {
  const entrance = { x: 30, y: 60 };
  const exit = { x: 360, y: 180, w: 20, h: 12 };
  const d = buildTerrain(num, theme);
  B.clearZones(d, entrance, exit);
  const terrain = B.encodeRLE(d);
  const level = {
    version: 1,
    name: `Redesigned Level ${num} (v2)`,
    total: 12,
    required: 10,
    spawnRate: 72,
    time: 9600,
    entrance,
    exit,
    theme,
    skills: Object.assign({
      floater: 0, bomber: 0, blocker: 0, builder: 0, basher: 0, digger: 0, climber: 0, miner: 0, platformer: 0
    }, skills),
    terrain
  };
  fs.writeFileSync(`./levels/level_${num.toString().padStart(3, '0')}.json`, JSON.stringify(level, null, 2));
  console.log(`Redesigned level_${num.toString().padStart(3, '0')}.json`);
});
