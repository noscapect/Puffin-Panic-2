# Puffin Panic 2

A Lemmings-inspired puzzle game where you guide puffins to safety through dangerous terrain. Built with vanilla JavaScript and HTML5 Canvas.

![Puffin Panic 2](https://img.shields.io/badge/Genre-Puzzle%20%2F%20Strategy-blue)
![JavaScript](https://img.shields.io/badge/Language-JavaScript-yellow)
![License](https://img.shields.io/badge/License-MIT-green)

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
Puffin Panic 2/
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