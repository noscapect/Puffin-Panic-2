# Engine Overhaul: Classic Lemmings Architecture

To achieve the precise, deterministic, and polished feel of the original 1991 Lemmings engine, we need to strip away modern procedural approximations and implement strict pixel-logic and masking. This overhaul will touch three core pillars of the engine:

## 1. Terrain Construction & Stamping (Replaces `terrain.js`)
Currently, Puffin Panic relies on either a full-screen AI image or procedural noise drawn inside geometric rectangles. 
**The Overhaul:**
- **Terrain Spritesheet**: We will introduce a modular spritesheet containing classic puzzle pieces (dirt blobs, stone pillars, metal grates, mossy ledges).
- **Stamping on Load**: At level load, the engine reads a list of `objects` (e.g., `{ type: 'pillar', x: 20, y: 50 }`) and physically blits their image data onto an off-screen `foregroundCanvas`, while simultaneously writing `1`s into a flat `Uint8Array` collision bitmask.
- **Background Layer**: A separate `backgroundCanvas` is rendered behind the level.

## 2. Mask-Based Destructibility (Replaces `digHole` & Math Carving)
Currently, a Puffin blowing up or bashing calculates a mathematical circle or rectangle to erase pixels, then forces the engine to recalculate procedural noise on the edges.
**The Overhaul:**
- **Boolean AND NOT Masks**: We will create pre-defined pixel-arrays (masks). For example, a "Basher Swing Mask" is an exact $8\times10$ array of `1`s and `0`s representing the exact curve of the Puffin's arm.
- **Erase Logic**: When a Basher swings, the engine iterates over the mask. If mask pixel is `1`, it sets `collisionMask[i] = 0` and uses `clearRect` on the `foregroundCanvas` at that coordinate. The background automatically shows through. This matches the exact visual destructibility of the original game.

## 3. Column-Based Physics & Collision (Rewrites `puffin.js` movement)
Currently, Puffins probe specific Y-coordinates (`wallMid` and `wallBottom`), which causes them to clip into terrain or get stuck on single floating pixels.
**The Overhaul:**
- **The Foot Pixel**: A Puffin's logical position will be driven entirely by the exact X/Y coordinate of the single pixel exactly under the center of its leading foot.
- **Column Probing**: When moving horizontally (`nextX`), the engine will check a vertical column of pixels at `nextX` from `y - 6` (head) to `y + 1` (below feet). 
- **Deterministic Step-Up**: If the terrain rises, the engine finds the *highest* solid pixel in that column. If it is `<= 6` pixels high, the Puffin's Y-coordinate instantly snaps up. If `> 6`, it's an impassable wall and the Puffin flips direction.

## 4. Special Zones via Bounding Boxes (COMPLETED)
Currently, steel is written directly into the terrain array as `10`.
**The Overhaul:**
- **Abstract Trigger Zones**: Steel plates, water traps, and the exit are now defined by exact mathematical `rect` bounds independent of the pixel array (`globalSteelZones`).
- **Steel Checks**: Before a destructible mask (Basher/Digger/Bomber) clears a pixel, it performs a lightweight check against `globalSteelZones` inside `canDigAt(x, y)`. The pixel remains untouched, fulfilling the classic "clink" logic, allowing designers to even create hidden/invisible steel zones behind normal dirt sprites!

---

### Execution Plan
1. **Step 1: Physics Rewrite** - Rewrite `puffin.js` to use the Column-Based Step-Up physics and decouple Steel. This immediately fixes all movement bugs.
2. **Step 2: Mask Destructibility** - Replace mathematical digging with exact Sprite Mask erasure logic in the terrain engine.
3. **Step 3: Level Stamping Pipeline (COMPLETED)** - Deprecated the massive PNG loader and built a new level system (`level.json` "objects" array) that natively loads and stamps modular terrain piece geometries directly into `terrainData`, which are then procedurally skinned by the engine for zero anti-aliasing noise and mathematically perfect surfaces.
