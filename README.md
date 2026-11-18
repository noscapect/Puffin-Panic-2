# Puffins Panic!

A Lemmings-inspired puzzle game about guiding cheerful puffins to safety across grassy coastal cliffs and seaside ruins. Built with vanilla JavaScript, HTML5 Canvas and optional WebGL rendering.

The browser game needs no build step. Serve the repository over HTTP and play.

## Running the game

With Python installed, run this from the repository root:

```bash
python -m http.server 8000
```

Or use Node.js and npm:

```bash
npx serve . --listen 8000
```

Open [http://localhost:8000](http://localhost:8000). Keep the terminal running while playing. Opening `index.html` directly with `file://` prevents the campaign files from loading correctly.

On Windows, `Puffins_Panic.bat` starts a local server with Windows PowerShell and opens the game in your default browser. Close the launcher window to stop it.

## Campaign

Ten levels adapt the first ten Fun levels from the original DOS Lemmings. The original layouts and skill progression provide the puzzle references. Distances and release timing are adapted to the 400 × 220 collision grid and larger puffins.

The setting is an outdoor coast, with bright skies, sea views, grass-edged rocks, carved ruins and open straw nests. Arriving puffins dive into the nest while a chick greets them. A wooden entrance hatch opens before the first puffin drops.

| Level | Name | Main skill or decision |
|-------|------|------------------------|
| 1 | Just dig! | Dig through the upper ledge |
| 2 | Only floaters can survive this | Prepare for a high drop |
| 3 | Tailor-made for blockers | Redirect the crowd along alternating ledges |
| 4 | Now use miners and climbers | Mine down and climb the final obstacle |
| 5 | You need bashers this time | Open a passage through the wall |
| 6 | A task for blockers and bombers | Open the holding area with a timed explosion |
| 7 | Builders will help you here | Bridge the gap |
| 8 | Not as complicated as it looks | Turn the crowd towards the nest |
| 9 | As long as you try your best | Choose a way through the dividing wall |
| 10 | Smile if you love lemmings | Combine skills among suspended masonry |

Counts, rescue targets and skill inventories follow the DOS references. The builder tutorial gives builders a longer staircase to allow earlier placement. The active campaign is defined by `levels/manifest.json`. Other level files are excluded from that list.

## How to play

Choose a level on the start screen and click **Start Game**. Select a skill, then click or tap a puffin to assign it. Save the required number before time runs out.

| Input | Action |
|-------|--------|
| Left click / tap | Assign the selected skill |
| Right click / Cancel | Deselect the skill |
| Click a blocker with no skill selected | Release it back into the crowd |
| Long press on a puffin | Show its state |
| Escape | Deselect the skill, or pause/resume |
| Minus / plus, or square brackets | Lower / raise the release rate |
| Speed button | Switch between 1×, 2× and 4× |
| Sound button | Toggle sound |
| N | Activate nuke |

The release rate controls how quickly new puffins enter the level. Audio starts with the game. If the browser has suspended audio, starting a level or enabling sound attempts to resume it.

## Skills

| Skill | Effect |
|-------|--------|
| Climber | Scales vertical walls |
| Floater | Opens an umbrella to survive high falls |
| Bomber | Explodes after five seconds, destroying nearby terrain |
| Blocker | Stands still and turns other puffins around |
| Builder | Constructs a staircase |
| Basher | Opens horizontal passages through walls |
| Miner | Digs diagonally downward |
| Digger | Digs straight down |
| Platformer | Builds a horizontal platform |

Falls exceeding 70 simulation pixels are fatal without a floater. Assign skills before the danger, and allow the crowd time to follow a newly opened route. Hovering over a puffin with a skill selected shows its direction.

## Level editor and engine features

Choose **Level Editor** from the start screen to draw and erase terrain, place entrance and exit points, configure skills and rescue targets, and import or export JSON maps. Editor saves use browser localStorage.

The engine also supports terrain themes and image-based terrain, flowing water and lava, swimming, falling sand, ice melting, wind, bridge stress, achievements, procedural sound and high-DPI rendering. These features are available for custom levels and are used according to each map's configuration.

For image import, install the script dependency with `npm install`, then run:

```bash
node scripts/import-image-level.mjs --input img/levels/my-level.png --output levels/my-level.json --name "My Level"
```

Add the resulting filename to `levels/manifest.json` to include it in the campaign. The importer creates the terrain bitmap and `imageSource` reference. Custom maps use the 400 × 220 grid.

## Verification and replays

Run the available checks from the repository root with Node.js:

```bash
# Structural checks for the ten campaign files
node scripts/verify-levels.mjs

# Release-rate control checks
node scripts/release-rate-qc.mjs

# Approximate route analysis
node scripts/route-analyze.mjs --file levels/level_001.json

# Geometry-based campaign playtester
node scripts/playtest-agent.mjs --campaign
```

The geometry playtester estimates routes using a simplified model. Its results complement testing in the actual game engine.

To replay a strategy in the actual engine, open the running game's developer console and run:

```js
await import('./scripts/replay-classic.mjs').then(module => module.play(7))
```

Choose any level number from 1 through 15. The replay starts that level and replaces the current attempt. It advances the simulation and assigns skills through normal pointer targeting, then checks the rescue target and the skill assignments for the reference route.

For each new campaign level, identify the corresponding level in the original DOS campaign and consult its Intended Solution in the [Lemmings Level Database](https://lldb.camanis.net/levelpack/473/DOS-Fun). Preserve the release population, rescue target, skill inventory, obstacle sequence and role of each skill. Keep coastal artwork and tune placement tolerance around that route. Add the reference skill counts and pointer replay to the campaign test, run it in the game, and try bypassing the defining obstacle before accepting the level. For Fun 13, specifically test one shared shaft as well as twenty individual diggers.

Recent fixes initialize audio when levels start and check ground support before walking puffins turn at walls. The latter prevents puffins from hovering in narrow dug shafts.

## Project structure

| Path | Purpose |
|------|---------|
| `index.html` | Game page and controls |
| `level-editor.html` | Standalone editor page |
| `js/engine.js` | Game loop, rendering, controls and level transitions |
| `js/puffin.js` | Movement, skill behavior and puffin drawing |
| `js/terrain.js` | Terrain rendering and environmental simulation |
| `js/levels.js` | JSON campaign loader |
| `js/sound.js` | Procedural Web Audio sound and music |
| `js/levelEditor.js` | Editor logic |
| `levels/manifest.json` | Ordered list of the ten campaign levels |
| `img/` | Start-screen art and terrain assets |
| `scripts/replay-classic.mjs` | Real-engine browser replays for levels 1–15 |
| `scripts/verify-levels.mjs` | Structural campaign checks |
| `package.json` | Node.js tooling and scripts |

The simulation runs at 30 ticks per second on a 400 × 220 destructible bitmap. The canvas uses a 4× base scale and high-DPI adjustments. The browser game has no third-party JavaScript runtime dependencies. `pngjs` supports image-processing scripts.

## References and licensing

Inspired by **Lemmings**, developed by DMA Design in 1991. Campaign layouts and parameters reference the [DOS Fun levels in the Lemmings Level Database](https://lldb.camanis.net/levelpack/473/DOS-Fun). Puffins Panic provides its own engine and coastal presentation.

The previous README described the project as MIT licensed. This checkout has no LICENSE file declaring those terms.
