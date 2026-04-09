#!/usr/bin/env node
/** Quick visual dump of terrain around entrance and exit for level 1 */
import { readFileSync } from 'fs';
import { join } from 'path';
const W = 400, H = 220;
function decode(rle) {
    const d = new Uint8Array(W*H); let i = 0;
    for (const [v,c] of rle) for (let j = 0; j < c && i < d.length; j++) d[i++] = v;
    return d;
}
const lvl = JSON.parse(readFileSync(join(process.cwd(), 'levels/level_001.json'), 'utf8'));
const t = decode(lvl.terrain);
const ent = lvl.entrance, ext = lvl.exit;

console.log(`\nEntrance area (${ent.x},${ent.y}): showing y=${ent.y-5}..${ent.y+20}, x=${ent.x-5}..${ent.x+15}`);
for (let y = ent.y - 5; y <= ent.y + 20; y++) {
    let row = String(y).padStart(3) + ': ';
    for (let x = ent.x - 5; x <= ent.x + 15; x++) {
        const v = (x>=0&&x<W&&y>=0&&y<H) ? t[y*W+x] : -1;
        if (x === ent.x && y === ent.y) row += 'S';
        else if (v === 0) row += '.';
        else if (v === 1) row += '#';
        else if (v === 10) row += 'X';
        else row += '?';
    }
    console.log(row);
}

console.log(`\nExit area (${ext.x},${ext.y} ${ext.w}x${ext.h}): showing y=${ext.y-5}..${ext.y+ext.h+10}, x=${ext.x-5}..${ext.x+ext.w+5}`);
for (let y = ext.y - 5; y <= ext.y + ext.h + 10; y++) {
    let row = String(y).padStart(3) + ': ';
    for (let x = ext.x - 5; x <= ext.x + ext.w + 5; x++) {
        const v = (x>=0&&x<W&&y>=0&&y<H) ? t[y*W+x] : -1;
        if (x >= ext.x && x < ext.x+ext.w && y >= ext.y && y < ext.y+ext.h) row += 'E';
        else if (v === 0) row += '.';
        else if (v === 1) row += '#';
        else if (v === 10) row += 'X';
        else row += '?';
    }
    console.log(row);
}

// Also check platform surfaces near entrance
console.log(`\nFull width scan at entrance Y=${ent.y+12} (puffin feet level):`);
let feetRow = '';
for (let x = 25; x < 45; x++) {
    const fy = ent.y + 12; // PUFFIN_H
    feetRow += t[fy*W+x] ? '#' : '.';
}
console.log(`  x=25..44: ${feetRow}`);

console.log(`\nPlatform surface at y=70 (platform starts at y=70):`);
let platRow = '';
for (let x = 0; x < 40; x++) {
    platRow += t[70*W+x] ? '#' : '.';
}
console.log(`  x=0..39: ${platRow}`);
