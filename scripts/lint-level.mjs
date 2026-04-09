import fs from "node:fs/promises";
import path from "node:path";

const GAME_WIDTH = 400;
const GAME_HEIGHT = 220;

function parseArgs() {
  const args = {};
  for (let i = 2; i < process.argv.length; i++) {
    const tok = process.argv[i];
    if (!tok.startsWith("--")) continue;
    const [k, v] = tok.slice(2).split("=");
    if (v !== undefined) args[k] = v;
    else if (i + 1 < process.argv.length && !process.argv[i + 1].startsWith("--")) args[k] = process.argv[++i];
    else args[k] = true;
  }
  return args;
}

function getTerrainPairs(level) {
  const src = Array.isArray(level.terrain) ? level.terrain : Array.isArray(level.data) ? level.data : [];
  if (src.length === 0) return [];

  if (Array.isArray(src[0])) {
    return src
      .filter((p) => Array.isArray(p) && p.length >= 2)
      .map((p) => [Number(p[0]) || 0, Math.max(0, Number(p[1]) || 0)]);
  }

  const pairs = [];
  for (let i = 0; i < src.length; i += 2) {
    const a = Number(src[i]) || 0;
    const b = Math.max(0, Number(src[i + 1]) || 0);
    if (i + 1 >= src.length) break;

    if (a > 1 && (b === 0 || b === 1)) pairs.push([b, a]);
    else pairs.push([a, b]);
  }
  return pairs;
}

function decodeTerrain(pairs, size) {
  const out = new Uint8Array(size);
  let idx = 0;
  for (const [value, count] of pairs) {
    for (let i = 0; i < count && idx < size; i++) out[idx++] = value ? 1 : 0;
    if (idx >= size) break;
  }
  return { out, decodedCount: idx };
}

function idx(x, y, w) {
  return y * w + x;
}

function isSolid(data, w, h, x, y) {
  if (x < 0 || x >= w || y < 0 || y >= h) return false;
  return data[idx(x, y, w)] !== 0;
}

function countIsolatedFragments(data, w, h, minArea = 6) {
  const vis = new Uint8Array(w * h);
  const small = [];
  let components = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i0 = idx(x, y, w);
      if (vis[i0] || data[i0] === 0) continue;
      components++;

      const qx = [x];
      const qy = [y];
      vis[i0] = 1;
      let qi = 0;
      let area = 0;
      let minX = x;
      let minY = y;
      let maxX = x;
      let maxY = y;

      while (qi < qx.length) {
        const cx = qx[qi];
        const cy = qy[qi];
        qi++;
        area++;
        if (cx < minX) minX = cx;
        if (cy < minY) minY = cy;
        if (cx > maxX) maxX = cx;
        if (cy > maxY) maxY = cy;

        const neighbors = [
          [cx + 1, cy],
          [cx - 1, cy],
          [cx, cy + 1],
          [cx, cy - 1]
        ];
        for (const [nx, ny] of neighbors) {
          if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
          const ni = idx(nx, ny, w);
          if (vis[ni] || data[ni] === 0) continue;
          vis[ni] = 1;
          qx.push(nx);
          qy.push(ny);
        }
      }

      if (area < minArea) {
        small.push({ area, minX, minY, maxX, maxY });
      }
    }
  }

  return { components, small };
}

function rowTopSpikes(data, w, h) {
  let spikes = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (!isSolid(data, w, h, x, y)) continue;
      const top = !isSolid(data, w, h, x, y - 1);
      if (!top) continue;

      const leftTop = !isSolid(data, w, h, x - 1, y - 1);
      const rightTop = !isSolid(data, w, h, x + 1, y - 1);
      const left = isSolid(data, w, h, x - 1, y);
      const right = isSolid(data, w, h, x + 1, y);
      if ((leftTop && rightTop) && (!left || !right)) spikes++;
    }
  }
  return spikes;
}

function sampleWalkableCoverage(data, w, h) {
  let topSurface = 0;
  let flatTopSurface = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (!isSolid(data, w, h, x, y) || isSolid(data, w, h, x, y - 1)) continue;
      topSurface++;
      if (isSolid(data, w, h, x - 1, y) && isSolid(data, w, h, x + 1, y)) flatTopSurface++;
    }
  }
  return { topSurface, flatTopSurface };
}

function checkSpawnAndExit(level, data, w, h, strict = false) {
  const issues = [];

  const ent = level.entrance || { x: 0, y: 0 };
  const exit = level.exit || { x: w - 20, y: h - 20, w: 20, h: 12 };

  const ex = Math.max(0, Math.min(w - 1, Math.floor(ent.x)));
  const ey = Math.max(0, Math.min(h - 1, Math.floor(ent.y)));

  let blockedAroundEntrance = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (isSolid(data, w, h, ex + dx, ey + dy)) blockedAroundEntrance++;
    }
  }
  if (blockedAroundEntrance > 1) {
    issues.push({
      code: "ENTRANCE_BLOCKED",
      severity: strict ? "error" : "warn",
      detail: `Entrance has ${blockedAroundEntrance} blocked cells in 3x3 zone.`
    });
  }

  const lx = Math.max(0, Math.floor(exit.x));
  const rx = Math.min(w - 1, Math.floor(exit.x + (exit.w || 20)));
  const ty = Math.max(0, Math.floor(exit.y));
  const by = Math.min(h - 1, Math.floor(exit.y + (exit.h || 12)));
  let solidInExit = 0;
  for (let y = ty; y <= by; y++) {
    for (let x = lx; x <= rx; x++) {
      if (isSolid(data, w, h, x, y)) solidInExit++;
    }
  }
  if (solidInExit > 0) {
    issues.push({
      code: "EXIT_BLOCKED",
      severity: strict ? "error" : "warn",
      detail: `Exit rectangle contains ${solidInExit} solid cells.`
    });
  }

  return issues;
}

async function main() {
  const args = parseArgs();
  const file = args.file || "levels/level_999.json";
  const outPath = args.out || null;
  const strict = Boolean(args.strict);
  const noFail = Boolean(args["no-fail"] || args.noFail);
  const width = Number(args.width || GAME_WIDTH);
  const height = Number(args.height || GAME_HEIGHT);

  const raw = await fs.readFile(file, "utf8");
  const level = JSON.parse(raw.replace(/^\uFEFF/, ""));
  const pairs = getTerrainPairs(level);
  const expected = width * height;
  const { out: data, decodedCount } = decodeTerrain(pairs, expected);

  const counts = pairs.reduce((acc, p) => {
    acc.pairCount++;
    acc.totalCount += p[1];
    return acc;
  }, { pairCount: 0, totalCount: 0 });

  const issues = [];
  if (counts.totalCount !== expected) {
    issues.push({ code: "RLE_COUNT_MISMATCH", severity: "error", detail: `RLE count ${counts.totalCount} does not match ${expected}.` });
  }
  if (decodedCount !== expected) {
    issues.push({ code: "DECODE_SIZE_MISMATCH", severity: "error", detail: `Decoded ${decodedCount} cells, expected ${expected}.` });
  }

  const solids = data.reduce((a, v) => a + (v ? 1 : 0), 0);
  const { components, small } = countIsolatedFragments(data, width, height, 6);
  const spikes = rowTopSpikes(data, width, height);
  const walkability = sampleWalkableCoverage(data, width, height);
  issues.push(...checkSpawnAndExit(level, data, width, height, strict));

  if (small.length > 0) {
    issues.push({ code: "SMALL_FRAGMENTS", severity: "warn", detail: `${small.length} tiny components under 6 px.` });
  }
  if (spikes > 140) {
    issues.push({ code: "JAGGED_SURFACE", severity: "warn", detail: `High top-edge jaggedness score (${spikes}).` });
  }

  const summary = {
    file: path.resolve(file),
    mapSize: { width, height, expectedCells: expected },
    terrain: {
      pairCount: counts.pairCount,
      totalRLECount: counts.totalCount,
      solidCells: solids,
      solidPct: Number(((solids / expected) * 100).toFixed(2)),
      connectedComponents: components,
      tinyComponents: small.length,
      topSurface: walkability.topSurface,
      flatTopSurface: walkability.flatTopSurface,
      flatSurfacePct: walkability.topSurface ? Number(((walkability.flatTopSurface / walkability.topSurface) * 100).toFixed(2)) : 0,
      jaggednessScore: spikes
    },
    issues,
    score: {
      pass: issues.filter((i) => i.severity === "error").length === 0,
      errorCount: issues.filter((i) => i.severity === "error").length,
      warnCount: issues.filter((i) => i.severity === "warn").length
    }
  };

  if (outPath) {
    const outDir = path.dirname(outPath);
    await fs.mkdir(outDir, { recursive: true });
    await fs.writeFile(outPath, JSON.stringify(summary, null, 2), "utf8");
  }

  console.log(`Lint ${summary.score.pass ? "PASS" : "FAIL"}: ${path.basename(file)}`);
  console.log(`Errors: ${summary.score.errorCount}, Warnings: ${summary.score.warnCount}`);
  console.log(`Components: ${components}, Tiny: ${small.length}, Jaggedness: ${spikes}`);
  if (outPath) console.log(`Report: ${path.resolve(outPath)}`);

  if (!summary.score.pass && !noFail) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err?.stack || err?.message || String(err));
  process.exit(1);
});
