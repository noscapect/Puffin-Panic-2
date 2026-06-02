import fs from 'fs';
import path from 'path';

const LEVEL_WIDTH = 400;
const LEVEL_HEIGHT = 220;
const PUFFIN_HEIGHT = 12;
const ENTRANCE_MIN_Y = -PUFFIN_HEIGHT;
const FALL_DEATH_DIST = 70;

const TERRAIN_PIECES = {
  dirt_tiny: { w: 8, h: 8 },
  dirt_small: { w: 16, h: 16 },
  dirt_block: { w: 32, h: 32 },
  dirt_slab: { w: 64, h: 16 },
  dirt_slab_long: { w: 128, h: 16 },
  dirt_pillar: { w: 16, h: 64 },
  dirt_column: { w: 32, h: 128 },
  dirt_huge: { w: 128, h: 128 },
  dirt_floor: { w: 420, h: 32 },
  step_small: { w: 16, h: 8 },
  step_large: { w: 32, h: 16 },
  steel_plate: { w: 16, h: 32 },
  steel_plate_h: { w: 32, h: 16 },
  steel_block: { w: 32, h: 32 },
  steel_pillar: { w: 16, h: 64 },
  steel_column: { w: 32, h: 128 },
  steel_huge: { w: 64, h: 64 },
  steel_floor: { w: 420, h: 16 },
  bridge_wood: { w: 48, h: 8 }
};

function decodeRLE(rle) {
  const grid = new Uint8Array(LEVEL_WIDTH * LEVEL_HEIGHT);
  if (!Array.isArray(rle)) return grid;
  let offset = 0;
  for (const pair of rle) {
    if (!Array.isArray(pair) || pair.length < 2) continue;
    const val = Number(pair[0]) || 0;
    const count = Number(pair[1]) || 0;
    for (let i = 0; i < count && offset < grid.length; i++) {
      grid[offset++] = val;
    }
  }
  return grid;
}

function stampObjects(grid, objects, errors) {
  if (!Array.isArray(objects)) return;
  for (const obj of objects) {
    const piece = TERRAIN_PIECES[obj.type];
    if (!piece) {
      errors.push(`Unknown terrain object: ${obj.type}`);
      continue;
    }
    if (!Number.isFinite(obj.x) || !Number.isFinite(obj.y)) {
      errors.push(`Invalid coordinates for ${obj.type}.`);
      continue;
    }
    for (let y = 0; y < piece.h; y++) {
      for (let x = 0; x < piece.w; x++) {
        const tx = obj.x + x;
        const ty = obj.y + y;
        if (tx >= 0 && tx < LEVEL_WIDTH && ty >= 0 && ty < LEVEL_HEIGHT) {
          grid[ty * LEVEL_WIDTH + tx] = 1;
        }
      }
    }
  }
}

function isSolid(grid, x, y) {
  if (x < 0 || x >= LEVEL_WIDTH || y < 0 || y >= LEVEL_HEIGHT) return false;
  return grid[y * LEVEL_WIDTH + x] !== 0;
}

function countSolids(grid) {
  let count = 0;
  for (const cell of grid) if (cell !== 0) count++;
  return count;
}

function findLandingDistance(grid, x, y) {
  let cy = Math.max(0, Math.floor(y));
  let distance = Math.max(0, 0 - Math.floor(y));
  const cx = Math.floor(x);
  while (cy + 1 < LEVEL_HEIGHT && !isSolid(grid, cx, cy + 1)) {
    cy++;
    distance++;
  }
  return { y: cy, distance };
}

function hasExitSupport(grid, exit) {
  const y = Math.floor(exit.y + exit.h);
  const startX = Math.floor(exit.x);
  const endX = Math.floor(exit.x + exit.w);
  let supported = 0;
  for (let x = startX; x < endX; x++) {
    if (isSolid(grid, x, y)) supported++;
  }
  return supported >= Math.ceil((endX - startX) * 0.5);
}

console.log("Running QA Verification Sweep on first 10 levels...");

for (let i = 1; i <= 10; i++) {
  const filename = `level_${String(i).padStart(3, '0')}.json`;
  const filePath = path.join('levels', filename);
  
  if (fs.existsSync(filePath)) {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    let errors = [];
    const grid = decodeRLE(data.terrain);
    stampObjects(grid, data.objects, errors);
    
    // Check bounds. Entrances may sit just above the viewport as spawn hatches;
    // the runtime spawns puffins at ENTRANCE and lets gravity bring them in.
    if (data.entrance.x < 0 || data.entrance.x >= LEVEL_WIDTH) {
        errors.push("Entrance x out of bounds.");
    }
    if (data.entrance.y < ENTRANCE_MIN_Y || data.entrance.y >= LEVEL_HEIGHT) {
        errors.push(`Entrance y out of bounds. Expected ${ENTRANCE_MIN_Y} <= y < ${LEVEL_HEIGHT}.`);
    }
    if (data.exit.x < 0 || data.exit.x >= LEVEL_WIDTH || data.exit.y < 0 || data.exit.y >= LEVEL_HEIGHT) {
        errors.push("Exit out of bounds.");
    }
    if (data.exit.x + data.exit.w > LEVEL_WIDTH || data.exit.y + data.exit.h > LEVEL_HEIGHT) {
        errors.push("Exit rectangle exceeds level bounds.");
    }
    
    // Check logic
    if (data.required > data.total) {
        errors.push(`Unsolvable: required (${data.required}) > total (${data.total}).`);
    }
    if (data.total <= 0) {
        errors.push(`Unsolvable: 0 total puffins.`);
    }
    if (!data.skills || typeof data.skills !== 'object') {
        errors.push("Missing skills object.");
    }
    if (countSolids(grid) === 0 && !data.imageSource) {
        errors.push("Level has no terrain objects, no RLE terrain, and no imageSource.");
    }
    if (countSolids(grid) > 0) {
        const landing = findLandingDistance(grid, data.entrance.x, data.entrance.y);
        const hasFloater = data.skills && Number(data.skills.floater) > 0;
        if (landing.distance > FALL_DEATH_DIST && !hasFloater) {
            errors.push(`Entrance drop is ${landing.distance}px with no floaters.`);
        }
        if (!hasExitSupport(grid, data.exit)) {
            errors.push("Exit has insufficient terrain support.");
        }
    }
    
    if (errors.length > 0) {
        console.log(`\x1b[31m[FAIL] ${filename}\x1b[0m`);
        errors.forEach(e => console.log(`       - ${e}`));
    } else {
        console.log(`\x1b[32m[PASS] ${filename}\x1b[0m`);
    }
  } else {
    console.log(`\x1b[33m[WARN] ${filename} not found.\x1b[0m`);
  }
}
