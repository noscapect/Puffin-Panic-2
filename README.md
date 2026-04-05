# Puffin Panic 2

A Lemmings-inspired puzzle game where you guide puffins to safety through dangerous terrain. Built with vanilla JavaScript and HTML5 Canvas.

![Puffin Panic 2](https://img.shields.io/badge/Genre-Puzzle%20%2F%20Strategy-blue)
![JavaScript](https://img.shields.io/badge/Language-JavaScript-yellow)
![License](https://img.shields.io/badge/License-MIT-green)

## 🎮 Game Overview

In **Puffin Panic 2**, puffins emerge from an entrance and walk blindly through hazardous environments. Your job is to assign special skills to individual puffins to help them overcome obstacles and reach the exit safely. Guide enough puffins to the exit before time runs out to complete each level!

## ✨ Features

- **10 Challenging Levels** - From simple tutorials to complex multi-obstacle challenges
- **9 Unique Skills** - Each with specific use cases and strategic applications
- **Pixel Art Graphics** - Retro-styled visuals with animated puffin sprites
- **Destructible Terrain** - Modify the environment to create paths
- **Speed Control** - Toggle between 1x and 2x game speed
- **Release Rate Control** - Adjust how quickly puffins emerge
- **Nuke Mode** - Emergency option to eliminate all remaining puffins
- **Pause & Retry** - Full game state control

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
| **Platform** | 🪜 | Places small platform segments that puffins can walk across gaps |

## 🎯 How to Play

### Controls

- **Left Click** - Assign the selected skill to a puffin
- **Right Click** - Deselect the current skill
- **N Key** - Activate the nuke (emergency elimination of all puffins)
- **Escape** - Pause the game / Deselect skill
- **Speed Button** - Toggle between 1x and 2x game speed
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
- **Platforms** help bridge small gaps with segmented platforms

## 📁 Project Structure

```
Puffin Panic 2/
├── index.html          # Main HTML file with game canvas and UI
├── js/
│   ├── constants.js    # Game constants, sprite data, skill definitions
│   ├── engine.js       # Main game loop, input handling, UI management
│   ├── levels.js       # Level definitions (10 levels with terrain)
│   ├── particle.js     # Particle system for effects and explosions
│   ├── puffin.js       # Puffin class with AI and skill behaviors
│   └── terrain.js      # Terrain rendering and modification system
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
- **Rendering**: Pixel-perfect rendering with `image-rendering: pixelated`
- **Terrain System**: Pixel-based destructible terrain with surface shading
- **Sprite System**: 8×12 pixel puffin sprites with multiple animation frames
- **No Dependencies**: Pure vanilla JavaScript, no external libraries

## 📜 Level List

1. **Breaking Through** - Learn to bash through walls
2. **Mind the Gap** - Use builders to bridge gaps
3. **Down We Go** - Dig downward to reach lower exits
4. **Stop Right There** - Use blockers to redirect puffins
5. **Mary Poppins** - Floaters save puffins from deadly falls
6. **Explosive Solutions** - Combine blockers and bombers
7. **Climbing High** - Climbers scale vertical obstacles
8. **Mine Cart Madness** - Miners dig diagonal paths
9. **Platform Party** - Platforms bridge multiple gaps
10. **The Ultimate Challenge** - Use all skills to overcome a complex maze

## 🤝 Contributing

Feel free to fork this repository and submit pull requests! Suggestions for new levels, skills, or improvements are welcome.

## 📄 License

MIT License - Feel free to use, modify, and distribute this code.

## 🙏 Acknowledgments

This game is inspired by the classic **Lemmings** game by DMA Design (1991). All code and assets in this project are original implementations created for educational purposes.

---

**Enjoy guiding those puffins to safety! 🐧**