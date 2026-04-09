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
  for (let i = 0; i + 1 < src.length; i += 2) {
    const a = Number(src[i]) || 0;
    const b = Math.max(0, Number(src[i + 1]) || 0);
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
  return out;
}

function getThemeColors(theme) {
  const map = {
    grass: { skyTop: "#6cc6ff", skyBottom: "#d8f4ff", terrain: "#7a4b2a", grass: "#38c44a" },
    concept_999: { skyTop: "#4da7e8", skyBottom: "#e2f7ff", terrain: "#8a532d", grass: "#42d44d" },
    desert: { skyTop: "#f2c782", skyBottom: "#fef3d6", terrain: "#a26d3b", grass: "#e8c774" },
    snow: { skyTop: "#8bc4ff", skyBottom: "#f3fbff", terrain: "#8a949d", grass: "#e8f4ff" },
    rock: { skyTop: "#8394ad", skyBottom: "#dce5f2", terrain: "#686460", grass: "#b4c9a2" }
  };
  return map[theme] || map.grass;
}

function isSolid(data, w, h, x, y) {
  if (x < 0 || x >= w || y < 0 || y >= h) return false;
  return data[y * w + x] !== 0;
}

function makeSvg(level, data, w, h) {
  const colors = getThemeColors(level.theme || "grass");

  let terrainRects = "";
  for (let y = 0; y < h; y++) {
    let runStart = -1;
    for (let x = 0; x <= w; x++) {
      const solid = x < w && isSolid(data, w, h, x, y);
      if (solid && runStart < 0) runStart = x;
      if (!solid && runStart >= 0) {
        const rw = x - runStart;
        terrainRects += `<rect x=\"${runStart}\" y=\"${y}\" width=\"${rw}\" height=\"1\" fill=\"${colors.terrain}\"/>`;
        runStart = -1;
      }
    }
  }

  let grassLines = "";
  for (let y = 1; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (isSolid(data, w, h, x, y) && !isSolid(data, w, h, x, y - 1)) {
        grassLines += `<rect x=\"${x}\" y=\"${y}\" width=\"1\" height=\"1\" fill=\"${colors.grass}\"/>`;
      }
    }
  }

  const ent = level.entrance || { x: 40, y: 40 };
  const ex = level.exit || { x: w - 25, y: h - 30, w: 20, h: 12 };

  const grid = [];
  for (let x = 0; x <= w; x += 50) grid.push(`<line x1=\"${x}\" y1=\"0\" x2=\"${x}\" y2=\"${h}\" stroke=\"rgba(0,0,0,0.08)\" stroke-width=\"1\"/>`);
  for (let y = 0; y <= h; y += 50) grid.push(`<line x1=\"0\" y1=\"${y}\" x2=\"${w}\" y2=\"${y}\" stroke=\"rgba(0,0,0,0.08)\" stroke-width=\"1\"/>`);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w * 3}" height="${h * 3}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="sky" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0%" stop-color="${colors.skyTop}"/>
      <stop offset="100%" stop-color="${colors.skyBottom}"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${w}" height="${h}" fill="url(#sky)"/>
  ${grid.join("")}
  ${terrainRects}
  ${grassLines}
  <rect x="${ent.x - 2}" y="${ent.y - 6}" width="8" height="10" fill="#5a3319" stroke="#1f1209" stroke-width="1"/>
  <text x="${ent.x - 2}" y="${ent.y - 8}" font-size="5" fill="#0b0b0b">IN</text>
  <rect x="${ex.x}" y="${ex.y}" width="${ex.w || 20}" height="${ex.h || 12}" fill="#5d3a20" stroke="#1f1209" stroke-width="1"/>
  <rect x="${ex.x + 3}" y="${ex.y + 2}" width="${Math.max(4, (ex.w || 20) - 6)}" height="${Math.max(4, (ex.h || 12) - 4)}" fill="#7f5130"/>
  <text x="${ex.x + 1}" y="${ex.y - 2}" font-size="5" fill="#0b0b0b">EXIT</text>
</svg>`;
}

async function main() {
  const args = parseArgs();
  const file = args.file || "levels/level_999.json";
  const width = Number(args.width || GAME_WIDTH);
  const height = Number(args.height || GAME_HEIGHT);
  const outSvg = args.out || `reports/${path.basename(file, path.extname(file))}.preview.svg`;
  const outJson = args.metrics || `reports/${path.basename(file, path.extname(file))}.preview.json`;

  const raw = await fs.readFile(file, "utf8");
  const level = JSON.parse(raw.replace(/^\uFEFF/, ""));
  const pairs = getTerrainPairs(level);
  const data = decodeTerrain(pairs, width * height);

  let solids = 0;
  let topSurface = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!isSolid(data, width, height, x, y)) continue;
      solids++;
      if (y > 0 && !isSolid(data, width, height, x, y - 1)) topSurface++;
    }
  }

  const svg = makeSvg(level, data, width, height);

  await fs.mkdir(path.dirname(outSvg), { recursive: true });
  await fs.mkdir(path.dirname(outJson), { recursive: true });
  await fs.writeFile(outSvg, svg, "utf8");

  const metrics = {
    file: path.resolve(file),
    preview: path.resolve(outSvg),
    mapSize: { width, height, cells: width * height },
    terrain: {
      pairCount: pairs.length,
      solidCells: solids,
      solidPct: Number(((solids / (width * height)) * 100).toFixed(2)),
      topSurfaceCells: topSurface
    },
    entrance: level.entrance || null,
    exit: level.exit || null,
    theme: level.theme || "grass"
  };

  await fs.writeFile(outJson, JSON.stringify(metrics, null, 2), "utf8");
  console.log(`Preview SVG: ${path.resolve(outSvg)}`);
  console.log(`Preview metrics: ${path.resolve(outJson)}`);
}

main().catch((err) => {
  console.error(err?.stack || err?.message || String(err));
  process.exit(1);
});
