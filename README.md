# Puffins Panic!

A Lemmings-inspired puzzle game where you guide puffins to safety through dangerous terrain. Built with vanilla JavaScript and HTML5 Canvas. No dependencies, no build step — open `index.html` and play.

![Puffins Panic!](https://img.shields.io/badge/Genre-Puzzle%20%2F%20Strategy-blue)
![JavaScript](https://img.shields.io/badge/Language-JavaScript-yellow)
![Status](https://img.shields.io/badge/Status-Beta-orange)
![License](https://img.shields.io/badge/License-MIT-green)

## 🎮 Game Overview

Puffins emerge from an entrance and walk blindly through hazardous environments. Your job is to assign special skills to individual puffins to help them navigate obstacles and reach the exit safely. Save enough puffins before time runs out to complete each level.

## ✨ Features

- **99 Playable Campaign Levels** across a wide range of themes and difficulties
- **8 Classic Lemmings-Style Skills** — Climber, Floater, Bomber, Blocker, Builder, Basher, Miner, Digger
- **34 Terrain Themes** with AI-generated pixel textures (grass, snow, lava, crystal, deep sea, and more)
- **Volumetric Liquid Simulation** — Water flows, pools, and floods cavities; ice levels melt into water on explosion
- **Falling Sand Simulation** — Desert/mud terrain pours downward when dislodged by explosions
- **Liquid Lava** — Lava flows slowly, reacts with water (creates stone + steam), kills puffins on contact
- **Crumbling Bridges** — Unsupported terrain spans collapse under repeated puffin weight
- **Theme Wind** — Floaters and airborne particles are drifted by the level's ambient wind direction
- **Built-in Level Editor** — Create, tweak, export and import custom maps as JSON; share them with other players
- **High-DPI Rendering** — Crisp pixel art on Retina / high-density displays
- **Touch Controls** — Full touch support for mobile and tablet (tap, long-press for puffin info, cancel skill button)
- **Procedural Audio** — Sound effects and background music via Web Audio API (no external files)
- **Speed Control** — 1x / 2x / 4x game speed
- **Release Rate Control** — Slider and +/− buttons to adjust puffin spawn speed
- **Nuke Mode** — Emergency option to clear remaining puffins
- **Achievements System** — Tracks in-game milestones
- **Pause & Retry** — Full game state control at any time

## 🌊 Physics & Environment Simulation

### Volumetric Water
Water is a full cellular automaton stored in a parallel pixel grid (`liquidData`). It falls under gravity, equalises sideways, and floods newly-dug cavities. Puffins swim at the live surface. Water zones are initialised from `waterZones` in the level JSON and immediately simulated from there.

| Mechanic | Details |
|----------|---------|
| Flow rate | 4 units/cell/simulation step; runs every 2 game ticks |
| Gravity | Bottom-to-top sweep — liquid cascades the full column in one pass |
| Equalisation | Alternating-direction sideways pass prevents left/right bias |
| Puffin swim | Buoyant at live surface; seeks exit; climbs shore automatically |
| Explosion | Liquid in blast radius is displaced outward; water flows into the cavity on next tick |

### Ice Melting
Bombing an ice-theme level converts the blast crater into meltwater. Water yield depends on theme:

| Theme | Water yield |
|-------|------------|
| `ice`, `black_ice` | Full (100%) |
| `packed_snow` | ~65% |
| `frozen_mud` | ~50% |
| `snow` | ~35% |

### Falling Sand
`desert`, `sandstone`, `mud`, and `toxic_sludge` themes have loose material. An explosion dislodges cells above the blast; each grain falls straight down, or slides diagonally if blocked, and solidifies again when fully stuck.

### Liquid Lava
Levels may define `"lavaZones": [{x,y,w,h}]` (same format as `waterZones`). Lava flows like water but at 1/8th the speed. Cross-material reactions:
- **Lava + water** → both consumed; lava cell becomes solid rock + steam particle burst
- **Lava + puffin** → instant death + fire particles

### Crumbling Bridges
Every puffin walking or blocking on a terrain cell accumulates *bridge stress* on that cell. Once stress exceeds **600 puffin-frames** and the cell has no solid support below (genuine spans only — floors are immune), it crumbles with a debris burst.

### Wind
Each theme has a baseline wind speed. Floaters drift at 50% of wind strength; falling puffins at 15%; all airborne particles are nudged each frame.

| Theme | Direction |
|-------|-----------|
| `desert`, `sandstone`, `black_ice` | Rightward |
| `snow`, `packed_snow`, `ice` | Leftward |
| All others | Calm |

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

- Puffins splat after falling more than ~70 pixels — use **Floaters** on high-drops
- **Blockers** redirect traffic; combine with a **Bomber** for a one-way door
- **Builders** create ramps that every puffin behind them will use
- **Climbers** can permanently scale walls — pair with Floater for full vertical freedom
- **Miners** are ideal for diagonal shortcuts through thick terrain
- In ice levels, explosion craters fill with meltwater — plan swim routes accordingly
- Bombing in desert/mud levels causes sand to cascade into newly-opened gaps
- **Floaters** are affected by wind — account for drift when aiming at the exit

## 🗺️ Level Editor & Custom Maps

Press **🛠️ Level Editor** on the start screen to enter the editor.

- **Draw / Erase** terrain with mouse or touch
- **Set** entrance, exit, theme, skill counts, puffin totals and time limit
- **📋 Export** — copies the level as JSON to clipboard
- **📥 Import** — paste any JSON to load a shared level
- **💾 Save / 📂 Load** — stores levels in browser localStorage

Share maps by copying the exported JSON text and sending it to another player. They paste it into Import to play your level.

### Adding Water or Lava to Custom Levels

Add a `waterZones` or `lavaZones` array to the exported JSON before importing:

```json
{
  "waterZones": [{ "x": 120, "y": 180, "w": 80, "h": 20 }],
  "lavaZones":  [{ "x": 300, "y": 160, "w": 60, "h": 30 }]
}
```

Both systems simulate immediately on level load. `lavaZones` is optional and ignored on levels/themes that don't need it.

## 🧱 Terrain Themes

34 themes available, each with a generated texture and matching sky/atmosphere:

`grass` · `desert` · `snow` · `rock` · `ice` · `lava` · `crystal` · `water` · `cliff_chalk` · `slate_ledge` · `frozen_mud` · `packed_snow` · `black_ice` · `volcanic_ash` · `obsidian_floor` · `salt_flats` · `wet_cave_stone` · `rusty_metal` · `wood_planks` · `mossy_ruin` · `crystal_dense` · `fungus_glow` · `toxic_sludge` · `sandstone` · `deep_sea` · `iron_ore` · `coral` · `amber` · `bone_white` · `cave` · `mud` · `mossy` · `desert` · `fungus_glow`

Textures are loaded from `img/generated/` at runtime. New textures can be generated with the scripts below.

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

# Lint + preview all 99 campaign levels
npm run levels:qa

# Finalize campaign maps automatically (portal fixes + solvability QA + budget tuning)
npm run levels:finalize
```

Reports are written to `reports/` (gitignored — regenerate any time).

`levels:finalize` is the recommended pre-release pass for campaign quality. It runs:
1. Portal audit
2. Automatic portal correction scripts
3. Post-fix portal audit
4. Full route/lint QA with optional budget auto-fix
5. Final QA summary in `reports/qa-summary.json`

## 📁 Project Structure

```
Puffin-Panic-2/
├── index.html          # Game shell — canvas, UI, script tags
├── img/
│   ├── background.jpeg  # Start screen background
│   ├── start-bg.png     # Start screen overlay
│   └── generated/       # Terrain textures (one PNG per theme)
├── js/
│   ├── constants.js     # Game constants, sprites, skill defs, physics thresholds, wind table
│   ├── engine.js        # Game loop, rendering, input, UI, bridge collapse, wind
│   ├── levels.js        # Campaign level loader (fetches levels/ JSON files)
│   ├── levelEditor.js   # Built-in level editor with export/import
│   ├── particle.js      # Particle system (sparks, dust, shockwave, portals, steam)
│   ├── puffin.js        # Puffin class — AI state machine, skills, swimming, drawing
│   ├── sound.js         # Procedural audio (Web Audio API)
│   └── terrain.js       # Terrain rendering, liquid/lava/sand simulation, ice melting
├── levels/
│   └── level_001.json … level_099.json   # 99 campaign levels
├── scripts/
│   ├── qa-all-levels.mjs       # Batch lint + preview all campaign levels
│   ├── lint-level.mjs          # Level validator
│   ├── preview-level.mjs       # SVG preview generator
│   ├── route-analyze.mjs       # Heuristic path solver
│   ├── bake-levels.mjs         # Terrain baking utility
│   ├── generate-texture.mjs    # Single texture generator (Node)
│   ├── generate-textures.py    # ComfyUI texture pipeline
│   └── texture-presets.json    # Prompt presets per theme
├── .gitignore
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

> Serving via HTTP is required for terrain textures to load (browser security blocks `getImageData` on `file://`).

## 🏗️ Technical Notes

| Detail | Value |
|--------|-------|
| Internal resolution | 400 × 220 |
| Canvas resolution | 1600 × 880 (4× scale) |
| High-DPI | Canvas rescaled by `devicePixelRatio` (capped at 2×) |
| Game loop | `requestAnimationFrame` with elapsed-time pacing at 30 FPS |
| Rendering | `imageSmoothingEnabled = false` + CSS `image-rendering: pixelated` |
| Terrain | Pixel-based destructible bitmap with RLE-compressed level storage |
| Liquid/lava/sand | Parallel `Uint8Array` grids; rendered to a shared offscreen canvas, blit at 4× scale |
| Puffin sprites | Pre-rendered to offscreen canvases per animation variant |
| Atmosphere | Cached to offscreen canvas, refreshed every 2 ticks |
| Bridge stress | `Uint16Array` — accumulated per cell, checked every 30 ticks |
| Touch | `touchstart/move/end` with `passive: false`; 44px minimum tap targets |
| Audio | Web Audio API, procedural — no external sound files |
| Dependencies | None — pure vanilla JS |

## 🤝 Contributing

Fork the repository and submit pull requests. Custom levels built with the editor are especially welcome — export your JSON and open an issue or PR to have it considered for the campaign.

## 📄 License

MIT — free to use, modify, and distribute.

## 🙏 Acknowledgments

Inspired by **Lemmings** by DMA Design (1991). All code and assets are original implementations.


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

- Puffins splat after falling more than ~70 pixels — use **Floaters** on high-drops
- **Blockers** redirect traffic; combine with a **Bomber** for a one-way door
- **Builders** create ramps that every puffin behind them will use
- **Climbers** can permanently scale walls — pair with Floater for full vertical freedom
- **Miners** are ideal for diagonal shortcuts through thick terrain

## 🗺️ Level Editor & Custom Maps

Press **🛠️ Level Editor** on the start screen to enter the editor.

- **Draw / Erase** terrain with mouse or touch
- **Set** entrance, exit, theme, skill counts, puffin totals and time limit
- **📋 Export** — copies the level as JSON to clipboard
- **📥 Import** — paste any JSON to load a shared level
- **💾 Save / 📂 Load** — stores levels in browser localStorage

Share maps by copying the exported JSON text and sending it to another player. They paste it into Import to play your level.

## 🧱 Terrain Themes

34 themes available, each with a generated texture and matching sky/atmosphere:

`grass` · `desert` · `snow` · `rock` · `ice` · `lava` · `crystal` · `water` · `cliff_chalk` · `slate_ledge` · `frozen_mud` · `packed_snow` · `black_ice` · `volcanic_ash` · `obsidian_floor` · `salt_flats` · `wet_cave_stone` · `rusty_metal` · `wood_planks` · `mossy_ruin` · `crystal_dense` · `fungus_glow` · `toxic_sludge` · `sandstone` · `deep_sea` · `iron_ore` · `coral` · `amber` · `bone_white` · `cave` · `mud` · `mossy` · `desert` · `fungus_glow`

Textures are loaded from `img/generated/` at runtime. New textures can be generated with the scripts below.

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

# Lint + preview all 99 campaign levels
npm run levels:qa
```

Reports are written to `reports/` (gitignored — regenerate any time).

## 📁 Project Structure

```
Puffin-Panic-2/
├── index.html          # Game shell — canvas, UI, script tags
├── img/
│   ├── background.jpeg  # Start screen background
│   ├── start-bg.png     # Start screen overlay
│   └── generated/       # Terrain textures (one PNG per theme)
├── js/
│   ├── constants.js     # Game constants, sprites, skill definitions, palette
│   ├── engine.js        # Game loop, rendering, input (mouse + touch), UI
│   ├── levels.js        # Campaign level loader (fetches levels/ JSON files)
│   ├── levelEditor.js   # Built-in level editor with export/import
│   ├── particle.js      # Particle system (sparks, dust, shockwave, portals)
│   ├── puffin.js        # Puffin class — AI state machine, skills, drawing
│   ├── sound.js         # Procedural audio (Web Audio API)
│   └── terrain.js       # Terrain rendering, texture blending, modification
├── levels/
│   └── level_001.json … level_099.json   # 99 campaign levels
├── scripts/
│   ├── qa-all-levels.mjs       # Batch lint + preview all campaign levels
│   ├── lint-level.mjs          # Level validator
│   ├── preview-level.mjs       # SVG preview generator
│   ├── route-analyze.mjs       # Heuristic path solver
│   ├── bake-levels.mjs         # Terrain baking utility
│   ├── generate-texture.mjs    # Single texture generator (Node)
│   ├── generate-textures.py    # ComfyUI texture pipeline
│   └── texture-presets.json    # Prompt presets per theme
├── .gitignore
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

> Serving via HTTP is required for terrain textures to load (browser security blocks `getImageData` on `file://`).

## 🏗️ Technical Notes

| Detail | Value |
|--------|-------|
| Internal resolution | 400 × 220 |
| Canvas resolution | 1600 × 880 (4× scale) |
| High-DPI | Canvas rescaled by `devicePixelRatio` (capped at 2×) |
| Game loop | `requestAnimationFrame` with elapsed-time pacing at 30 FPS |
| Rendering | `imageSmoothingEnabled = false` + CSS `image-rendering: pixelated` |
| Terrain | Pixel-based destructible bitmap with RLE-compressed level storage |
| Puffin sprites | Pre-rendered to offscreen canvases per animation variant |
| Atmosphere | Cached to offscreen canvas, refreshed every 2 ticks |
| Touch | `touchstart/move/end` with `passive: false`; 44px minimum tap targets |
| Audio | Web Audio API, procedural — no external sound files |
| Dependencies | None — pure vanilla JS |

## 🤝 Contributing

Fork the repository and submit pull requests. Custom levels built with the editor are especially welcome — export your JSON and open an issue or PR to have it considered for the campaign.

## 📄 License

MIT — free to use, modify, and distribute.

## 🙏 Acknowledgments

Inspired by **Lemmings** by DMA Design (1991). All code and assets are original implementations.

---

**Enjoy guiding those puffins to safety! 🐧**

## 🎮 Game Overview

In **Puffin Panic 2**, puffins emerge from an entrance and walk blindly through hazardous environments. Your job is to assign special skills to individual puffins to help them overcome obstacles and reach the exit safely. Guide enough puffins to the exit before time runs out to complete each level!

## ✨ Features

- **21 Playable Campaign Levels** - Includes handcrafted stages 1-19 plus advanced stages 21 and 22
- **8 Classic Lemmings-Style Skills** - Tactical toolkit for route solving and rescue optimization
- **Pixel Art Graphics** - Retro-styled visuals with animated puffin sprites
- **Destructible Terrain** - Modify the environment to create paths
- **AI-Generated Terrain Texture Themes** - ComfyUI-generated materials are integrated directly into gameplay
- **Sound Effects & Music** - Procedural audio using Web Audio API (no external files needed!)
- **Speed Control** - Toggle between 1x, 2x, and 4x game speed
- **Release Rate Control** - Adjust how quickly puffins emerge
- **Nuke Mode** - Emergency option to eliminate all remaining puffins
- **Pause & Retry** - Full game state control
- **Level Editor & External Level Loading** - Import JSON levels and iterate quickly

## 🛠️ Skills

| Skill | Icon | Description |
|-------|------|-------------|
| **Floater** | ☂️ | Deploys an umbrella, allowing the puffin to float safely down from any height |
| **Bomber** | 💣 | Turns the puffin into a timed bomb that explodes after 5 seconds, destroying surrounding terrain |
| **Blocker** | 🛑 | Makes the puffin stand still, blocking other puffins who will then turn around |
| **Builder** | 🧱 | Constructs a 4-pixel-wide brick staircase that puffins can walk up |
| **Basher** | 🥊 | Equips boxing gloves to bash through walls horizontally |
| **Digger** | ⛏️ | Digs straight down through terrain |
| **Climber** | 🧗 | Allows the puffin to climb vertical walls and traverse over obstacles |
| **Miner** | ⚒️ | Digs diagonally downward in the direction the puffin is facing |

## 🎯 How to Play

### Controls

- **Left Click** - Assign the selected skill to a puffin
- **Right Click** - Deselect the current skill
- **N Key** - Activate the nuke (emergency elimination of all puffins)
- **Escape** - Pause the game / Deselect skill
- **Speed Button** - Toggle between 1x, 2x, and 4x game speed
- **Sound Button** - Toggle sound effects and background music on/off
- **Release Rate Slider** - Adjust puffin spawn speed (1 = slowest, 10 = fastest)

### Gameplay

1. **Select a Skill** - Click on a skill button in the UI panel to select it
2. **Target a Puffin** - Click on a puffin in the game area to assign the skill
3. **Watch & Adapt** - Observe the puffins' behavior and assign more skills as needed
4. **Reach the Exit** - Guide puffins to the green-lit exit door
5. **Complete the Level** - Save the required number of puffins before time runs out

### Tips

- **Floaters** are essential for high falls - without them, puffins splat after falling ~70 pixels
- **Blockers** can redirect traffic, and pairing them with **Bombers** creates strategic explosions
- **Builders** create stairs that multiple puffins can use
- **Climbers** can scale any vertical wall if there's space above
- **Miners** are great for diagonal paths through thick terrain

## 🧱 Terrain Themes

The game supports both classic and generated texture themes. Recent additions include:

- `cliff_chalk`, `slate_ledge`, `frozen_mud`, `packed_snow`, `black_ice`
- `volcanic_ash`, `obsidian_floor`, `salt_flats`, `wet_cave_stone`
- `rusty_metal`, `wood_planks`, `mossy_ruin`, `crystal_dense`, `fungus_glow`, `toxic_sludge`

Generated textures are loaded from `img/generated` and used automatically when their theme is assigned to a level.

## 🖼️ Texture Generation (ComfyUI)

Texture prompts are managed in `scripts/texture-presets.json` and can be generated with ComfyUI via:

```bash
python scripts/generate-textures.py --preset black_ice
```

This writes both a historical seed-stamped image and a canonical in-game texture in `img/generated`.

## 🧪 Level Quality Tools

The project includes lightweight quality scripts for external JSON levels:

- `npm run level:lint -- --file levels/level_999.json --out reports/level_999.lint.json`
	- Validates terrain RLE counts, spawn/exit clearance, tiny fragments, and surface jaggedness.
	- Add `--strict` to treat spawn/exit issues as hard errors. Add `--no-fail` to always exit successfully while still writing reports.
- `npm run level:preview -- --file levels/level_999.json --out reports/level_999.preview.svg --metrics reports/level_999.preview.json`
	- Generates an SVG silhouette preview plus a metrics JSON summary.
- `npm run level:qa`
	- Runs both lint + preview for `levels/level_999.json` and writes reports under `reports/`.
- `npm run level:route -- --file levels/level_999.json --out reports/level_999.route.json`
	- Runs heuristic path analysis from entrance to exit and estimates required core skills (`builder`, `basher`, `climber`, `floater`).
- `npm run level:qa:full`
	- Runs lint + preview + route analysis and writes all reports for `levels/level_999.json`.

## 📁 Project Structure

```
Puffins-Panic/
├── index.html          # Main HTML file with game canvas and UI
├── img/
│   └── generated/       # Generated terrain textures used by themes
├── js/
│   ├── constants.js    # Game constants, sprite data, skill definitions
│   ├── engine.js       # Main game loop, input handling, UI management
│   ├── levels.js       # Campaign level definitions + theme assignments
│   ├── levelEditor.js  # Built-in level editor and export/import helpers
│   ├── particle.js     # Particle system for effects and explosions
│   ├── puffin.js       # Puffin class with AI and skill behaviors
│   ├── sound.js        # Procedural audio system (Web Audio API)
│   └── terrain.js      # Terrain rendering and modification system
├── levels/
│   └── level_001.json  # Example external/imported level
├── scripts/
│   ├── generate-textures.py # ComfyUI zImageTurbo texture pipeline
│   ├── generate-texture.py  # Single-shot texture generator
│   └── texture-presets.json # Prompt presets by theme
└── README.md           # This file
```

## 🚀 Running the Game

### Option 1: Direct Browser
Simply open `index.html` in a modern web browser. No server required!

### Option 2: Local Server
For development or if you encounter CORS issues:

```bash
# Using Python
python -m http.server 8000

# Using Node.js (npx)
npx serve

# Using PHP
php -S localhost:8000
```

Then navigate to `http://localhost:8000` in your browser.

## 🏗️ Technical Details

- **Canvas Resolution**: 1600×880 pixels (scaled 4x from 400×220 internal resolution)
- **Game Loop**: 30 FPS with frame-based timing
- **Rendering**: Layered canvas rendering with dynamic atmosphere, props, and terrain overlays
- **Terrain System**: Pixel-based destructible terrain with theme-aware texture blending
- **Sprite System**: 8×12 pixel puffin sprites with multiple animation frames
- **No Dependencies**: Pure vanilla JavaScript, no external libraries

## 📜 Level List

1. **Just a Walk in the Park**
2. **Bridge Over Troubled Water**
3. **The Great Escape**
4. **Sandstorm**
5. **Salt Pyramid**
6. **Oasis Trap**
7. **Blizzard**
8. **Avalanche**
9. **Frostbite**
10. **The Summit**
11. **Stone Cold**
12. **Rusted Quarry**
13. **Crystal Caves**
14. **Frozen Lake**
15. **Glacier**
16. **Inferno**
17. **Volcano**
18. **Magma Chamber**
19. **Glowing Kingdom**
20. *(reserved for future stage)*
21. **The Ice Shard Ascent**
22. **Flooded Grotto**

## 🤝 Contributing

Feel free to fork this repository and submit pull requests! Suggestions for new levels, skills, or improvements are welcome.

## 📄 License

MIT License - Feel free to use, modify, and distribute this code.

## 🙏 Acknowledgments

This game is inspired by the classic **Lemmings** game by DMA Design (1991). All code and assets in this project are original implementations created for educational purposes.

---

**Enjoy guiding those puffins to safety! 🐧**