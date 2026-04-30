# Puffins Panic!

A Lemmings-inspired puzzle game where you guide puffins to safety through dangerous terrain. Built with vanilla JavaScript and HTML5 Canvas. No dependencies, no build step — serve via HTTP and play.

![Puffins Panic!](https://img.shields.io/badge/Genre-Puzzle%20%2F%20Strategy-blue)
![JavaScript](https://img.shields.io/badge/Language-JavaScript-yellow)
![Status](https://img.shields.io/badge/Status-Beta-orange)
![License](https://img.shields.io/badge/License-MIT-green)

## 🎮 Game Overview

Puffins emerge from an entrance and walk blindly through hazardous environments. Your job is to assign special skills to individual puffins to help them navigate obstacles and reach the exit safely. Save enough puffins before time runs out to complete each level.

## ✨ Features

- **99 Playable Campaign Levels** across a wide range of themes and difficulties
- **Image-Based Level Art** — levels can use a full-resolution PNG as their terrain texture, converting pixel artwork directly into playable terrain
- **9 Classic Lemmings-Style Skills** — Climber, Floater, Bomber, Blocker, Builder, Basher, Miner, Digger, Platformer
- **34 Terrain Themes** with AI-generated pixel textures (grass, snow, lava, crystal, deep sea, and more)
- **Volumetric Liquid Simulation** — Water flows, pools, and floods cavities; ice levels melt into water on explosion
- **Falling Sand Simulation** — Desert/mud terrain pours downward when dislodged by explosions
- **Liquid Lava** — Lava flows slowly, reacts with water (creates stone + steam), kills puffins on contact
- **Crumbling Bridges** — Unsupported terrain spans collapse under repeated puffin weight
- **Theme Wind** — Floaters and airborne particles are drifted by the level's ambient wind direction
- **Built-in Level Editor** — Create, tweak, export and import custom maps as JSON
- **High-DPI Rendering** — Crisp pixel art on Retina / high-density displays
- **Touch Controls** — Full touch support for mobile and tablet
- **Procedural Audio** — Sound effects and background music via Web Audio API (no external files)
- **Speed Control** — 1x / 2x / 4x game speed
- **Nuke Mode** — Emergency option to clear remaining puffins
- **Achievements System** — Tracks in-game milestones

## 🛠️ Skills

| Skill | Icon | Description |
|-------|------|-------------|
| **Climber** | 🧗 | Scales vertical walls instead of turning around |
| **Floater** | ☂️ | Deploys an umbrella — survives any fall height |
| **Bomber** | 💣 | Becomes a timed bomb; explodes after 5 seconds, destroying terrain |
| **Blocker** | 🛑 | Stands still and turns other puffins around |
| **Builder** | 🧱 | Lays a brick staircase that other puffins can walk up |
| **Basher** | 🥊 | Punches horizontally through walls |
| **Miner** | ⚒️ | Digs diagonally downward |
| **Digger** | ⛏️ | Digs straight down |
| **Platformer** | 🏗 | Lays a horizontal platform |

## 🎯 How to Play

### Controls

| Input | Action |
|-------|--------|
| **Left click / Tap** | Assign selected skill to a puffin |
| **Right click / ✕ Cancel button** | Deselect the current skill |
| **Long-press a puffin** | Show puffin state tooltip |
| **Escape** | Deselect skill, or pause the game |
| **N** | Activate nuke |
| **[ − / ] +** | Decrease / increase release rate |

### Gameplay Loop

1. Select a skill from the skill panel
2. Click or tap a puffin to assign the skill
3. Watch the puffins react and adapt as needed
4. Guide enough puffins through the exit before time runs out

### Tips

- Puffins splat after falling more than ~70 pixels — use **Floaters** on high drops
- **Blockers** redirect traffic; combine with a **Bomber** for a one-way door
- **Builders** create ramps that every puffin behind them will use
- **Climbers** can permanently scale walls — pair with Floater for full vertical freedom
- **Miners** are ideal for diagonal shortcuts through thick terrain
- In ice levels, explosion craters fill with meltwater — plan swim routes accordingly
- Bombing in desert/mud levels causes sand to cascade into newly-opened gaps
- **Floaters** are affected by wind — account for drift when aiming at the exit

## 🌊 Physics & Environment Simulation

### Volumetric Water
Water is a full cellular automaton stored in a parallel pixel grid. It falls under gravity, equalises sideways, and floods newly-dug cavities. Puffins swim at the live surface.

| Mechanic | Details |
|----------|---------|
| Flow rate | 4 units/cell/simulation step; runs every 2 game ticks |
| Gravity | Bottom-to-top sweep — liquid cascades the full column in one pass |
| Equalisation | Alternating-direction sideways pass prevents left/right bias |
| Puffin swim | Buoyant at live surface; seeks exit; climbs shore automatically |
| Explosion | Liquid in blast radius is displaced outward; water flows into the cavity on next tick |

### Ice Melting
Bombing an ice-theme level converts the blast crater into meltwater:

| Theme | Water yield |
|-------|------------|
| `ice`, `black_ice` | Full (100%) |
| `packed_snow` | ~65% |
| `frozen_mud` | ~50% |
| `snow` | ~35% |

### Falling Sand
`desert`, `sandstone`, `mud`, and `toxic_sludge` themes have loose material. An explosion dislodges cells above the blast; each grain falls straight down or slides diagonally if blocked.

### Liquid Lava
Levels may define `"lavaZones": [{x,y,w,h}]`. Lava flows at 1/8th water speed. Cross-material reactions:
- **Lava + water** → both consumed; lava cell becomes solid rock + steam particle burst
- **Lava + puffin** → instant death + fire particles

### Crumbling Bridges
Every puffin walking or blocking on a terrain cell accumulates *bridge stress*. Once stress exceeds **600 puffin-frames** and the cell has no solid support below, it crumbles with a debris burst.

### Wind

| Theme | Direction |
|-------|-----------|
| `desert`, `sandstone`, `black_ice` | Rightward |
| `snow`, `packed_snow`, `ice` | Leftward |
| All others | Calm |

## 🗺️ Level Editor & Custom Maps

Press **🛠️ Level Editor** on the start screen to enter the editor.

- **Draw / Erase** terrain with mouse or touch
- **Set** entrance, exit, theme, skill counts, puffin totals and time limit
- **📋 Export** — copies the level as JSON to clipboard
- **📥 Import** — paste any JSON to load a shared level
- **💾 Save / 📂 Load** — stores levels in browser localStorage

### Adding Water or Lava to Custom Levels

Add a `waterZones` or `lavaZones` array to the exported JSON before importing:

```json
{
  "waterZones": [{ "x": 120, "y": 180, "w": 80, "h": 20 }],
  "lavaZones":  [{ "x": 300, "y": 160, "w": 60, "h": 30 }]
}
```

## 🖼️ Image-Based Level Import

Levels can use a full pixel-art PNG as their terrain texture instead of the procedural theme system. The image's non-background pixels become solid terrain; its artwork is rendered directly in-game at 1:1 fidelity.

### How it works

1. Drop a PNG into `img/levels/` (e.g. `level_05.png`)
2. Run the importer:

```bash
node scripts/import-image-level.mjs \
  --input  img/levels/level_05.png \
  --output levels/level_005.json \
  --name   "5: My Level"
```

3. Add the output filename to `levels/manifest.json`

The script:
- Detects the checkerboard background by colour (near-gray pixels with low saturation) and marks those cells as air
- Area-averages the source image down to the 400×220 grid
- RLE-encodes the resulting collision bitmap
- Writes a `"imageSource"` field into the JSON so the engine loads the original PNG as the visual texture

At runtime the engine downscales the PNG to 400×220 in a temp canvas and samples each solid cell's pixel directly — no procedural rendering at all.

**Requirements:** the game must be served via HTTP (not `file://`) for `getImageData` to work on the loaded image.

### Level JSON fields added by the importer

| Field | Description |
|-------|-------------|
| `imageSource` | Web-root-relative path to the PNG (`img/levels/level_05.png`) |
| `terrain` | RLE-encoded 400×220 collision bitmap |
| `theme` | Fallback theme used when no image is loaded |

## 🧱 Terrain Themes

34 themes, each with a generated texture and matching sky/atmosphere:

`grass` · `desert` · `snow` · `rock` · `ice` · `lava` · `crystal` · `water` · `mud` · `cave` · `mossy` · `cliff_chalk` · `slate_ledge` · `frozen_mud` · `packed_snow` · `black_ice` · `volcanic_ash` · `obsidian_floor` · `salt_flats` · `wet_cave_stone` · `rusty_metal` · `wood_planks` · `mossy_ruin` · `crystal_dense` · `fungus_glow` · `toxic_sludge` · `sandstone` · `deep_sea` · `iron_ore` · `coral` · `amber` · `bone_white`

Textures are loaded from `img/generated/` at runtime.

## 🖼️ Texture Generation

Texture prompts are managed in `scripts/texture-presets.json` and generated via ComfyUI:

```bash
python scripts/generate-textures.py --preset black_ice
```

This writes a canonical in-game texture to `img/generated/<theme>.png`.

## 🧪 Level QA Tools

```bash
# Lint a level (validates RLE, spawn/exit clearance, fragments)
npm run level:lint -- --file levels/level_001.json

# Generate SVG preview + metrics JSON
npm run level:preview -- --file levels/level_001.json

# Heuristic route analysis (estimates required skills)
npm run level:route -- --file levels/level_001.json

# Run all three in one go
npm run level:qa:full

# Lint + preview all campaign levels
npm run levels:qa

# Finalize campaign maps (portal fixes + solvability QA + budget tuning)
npm run levels:finalize
```

Reports are written to `reports/` (gitignored).

## 📁 Project Structure

```
Puffin-Panic-2/
├── index.html              # Game shell — canvas, UI, script tags
├── img/
│   ├── background.jpeg     # Start screen background
│   ├── generated/          # Terrain textures (one PNG per theme)
│   └── levels/             # Source artwork for image-based levels
├── js/
│   ├── constants.js        # Game constants, sprites, skill defs, physics thresholds
│   ├── engine.js           # Game loop, rendering, input, UI, bridge collapse, wind
│   ├── levels.js           # Campaign level loader (fetches levels/ JSON files)
│   ├── levelEditor.js      # Built-in level editor with export/import
│   ├── particle.js         # Particle system (sparks, dust, shockwave, portals, steam)
│   ├── puffin.js           # Puffin class — AI state machine, skills, swimming, drawing
│   ├── sound.js            # Procedural audio (Web Audio API)
│   └── terrain.js          # Terrain rendering, image texture, liquid/lava/sand simulation
├── levels/
│   ├── manifest.json       # Ordered list of campaign level files
│   └── level_001.json … level_099.json
├── scripts/
│   ├── import-image-level.mjs  # Convert a PNG into a playable level JSON
│   ├── generate-level.mjs      # AI-driven level generator (requires ANTHROPIC_API_KEY)
│   ├── generate-campaign.mjs   # Batch AI campaign generator
│   ├── qa-all-levels.mjs       # Batch lint + preview all campaign levels
│   ├── lint-level.mjs          # Level validator
│   ├── preview-level.mjs       # SVG preview generator
│   ├── route-analyze.mjs       # Heuristic path solver
│   ├── generate-texture.mjs    # Single texture generator (Node)
│   ├── generate-textures.py    # ComfyUI texture pipeline
│   └── texture-presets.json    # Prompt presets per theme
├── package.json
└── README.md
```

## 🚀 Running the Game

**Quickest way — double-click `Puffins_Panic.bat`** (Windows). This runs `npx serve .` and opens a local server.

Or start a server manually:

```bash
# Node.js
npx serve .

# Python
python -m http.server 8000
```

Then open `http://localhost:8000` in a browser.

> Serving via HTTP is required — browser security blocks `getImageData` on `file://` URLs.

## 🏗️ Technical Notes

| Detail | Value |
|--------|-------|
| Internal resolution | 400 × 220 |
| Canvas resolution | 1600 × 880 (4× scale) |
| High-DPI | Canvas rescaled by `devicePixelRatio` (capped at 2×) |
| Game loop | `requestAnimationFrame` with elapsed-time pacing at 30 FPS |
| Rendering | `imageSmoothingEnabled = false` + CSS `image-rendering: pixelated` |
| Terrain | Pixel-based destructible bitmap with RLE-compressed level storage |
| Image levels | Source PNG downscaled to 400×220 via canvas; solid cells sample it directly |
| Liquid/lava/sand | Parallel `Uint8Array` grids; rendered to offscreen canvas, blit at 4× scale |
| Puffin sprites | Pre-rendered to offscreen canvases per animation variant |
| Bridge stress | `Uint16Array` — accumulated per cell, checked every 30 ticks |
| Touch | `touchstart/move/end` with `passive: false`; 44px minimum tap targets |
| Audio | Web Audio API, procedural — no external sound files |
| Dependencies | `pngjs` (level import script only) — game itself is pure vanilla JS |

## 🤝 Contributing

Fork the repository and submit pull requests. Custom levels built with the editor or image importer are especially welcome.

## 📄 License

MIT — free to use, modify, and distribute.

## 🙏 Acknowledgments

Inspired by **Lemmings** by DMA Design (1991). All code and assets are original implementations.

---

**Enjoy guiding those puffins to safety! 🐧**
