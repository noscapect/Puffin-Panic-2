const fs = require('fs');
const W = 400, H = 220;
const file = process.argv[2] || 'levels/level_084.json';
const raw = fs.readFileSync(file, 'utf8');
const level = JSON.parse(raw);

let pairs = level.terrain || level.data;
if (pairs && pairs.length > 0 && typeof pairs[0] === 'number') {
  const newPairs = [];
  for (let i = 0; i < pairs.length; i += 2) {
    newPairs.push([pairs[i], pairs[i+1]]);
  }
  pairs = newPairs;
}

const out = new Uint8Array(W * H);
let idx = 0;
for (let [val, count] of pairs) {
  for (let i = 0; i < count && idx < W * H; i++) {
    out[idx++] = val;
  }
}

for (let y = 0; y < H; y++) {
  let row = y.toString().padStart(3, ' ') + ' ';
  for (let x = 0; x < W; x++) {
    if (level.entrance && x === level.entrance.x && y === level.entrance.y) {
      row += 'S';
    } else if (level.exit && x >= level.exit.x && x < level.exit.x + (level.exit.w || 20) &&
               y >= level.exit.y && y < level.exit.y + (level.exit.h || 12)) {
      row += 'E';
    } else {
      row += out[y * W + x] > 0 ? '#' : '.';
    }
  }
  if (row.includes('#') || row.includes('S') || row.includes('E')) {
    console.log(row);
  }
}
