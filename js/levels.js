// Levels
const LEVELS = [
    {
        name: "Level 1: Breaking Through",
        total: 20, required: 15, spawnRate: FPS * 2, time: 5 * 60 * FPS,
        entrance: { x: 70, y: 20 },
        exit: { x: 340, y: 78, w: 20, h: 12 },
        skills: { floater: 0, bomber: 0, blocker: 0, builder: 0, basher: 5, digger: 0, climber: 0, miner: 0, platformer: 0 },
        buildTerrain: (data, gw, gh) => {
            for (let y = 90; y < gh; y++) for (let x = 0; x < gw; x++) data[y * gw + x] = 1;
            for (let y = 0; y < gh; y++) {
                for (let x = 0; x < 10; x++) data[y * gw + x] = 1;
                for (let x = gw - 10; x < gw; x++) data[y * gw + x] = 1;
            }
            for (let y = 40; y < 90; y++) for (let x = 255; x < 270; x++) data[y * gw + x] = 1;
        }
    },
    {
        name: "Level 2: Mind the Gap",
        total: 20, required: 15, spawnRate: FPS * 2, time: 5 * 60 * FPS,
        entrance: { x: 40, y: 20 },
        exit: { x: 340, y: 78, w: 20, h: 12 },
        skills: { floater: 0, bomber: 0, blocker: 0, builder: 10, basher: 0, digger: 0, climber: 0, miner: 0, platformer: 0 },
        buildTerrain: (data, gw, gh) => {
            for (let y = 90; y < gh; y++) for (let x = 0; x < 150; x++) data[y * gw + x] = 1;
            for (let y = 90; y < gh; y++) for (let x = 200; x < gw; x++) data[y * gw + x] = 1;
            for (let y = 0; y < gh; y++) {
                for (let x = 0; x < 10; x++) data[y * gw + x] = 1;
                for (let x = gw - 10; x < gw; x++) data[y * gw + x] = 1;
            }
        }
    },
    {
        name: "Level 3: Down We Go",
        total: 20, required: 15, spawnRate: FPS * 2, time: 5 * 60 * FPS,
        entrance: { x: 50, y: 20 },
        exit: { x: 340, y: 178, w: 20, h: 12 },
        skills: { floater: 0, bomber: 0, blocker: 0, builder: 0, basher: 0, digger: 5, climber: 0, miner: 0, platformer: 0 },
        buildTerrain: (data, gw, gh) => {
            for (let y = 90; y < 140; y++) for (let x = 0; x < gw; x++) data[y * gw + x] = 1;
            for (let y = 190; y < gh; y++) for (let x = 0; x < gw; x++) data[y * gw + x] = 1;
            for (let y = 0; y < gh; y++) {
                for (let x = 0; x < 10; x++) data[y * gw + x] = 1;
                for (let x = gw - 10; x < gw; x++) data[y * gw + x] = 1;
            }
        }
    },
    {
        name: "Level 4: Stop Right There",
        total: 20, required: 15, spawnRate: FPS * 2, time: 5 * 60 * FPS,
        entrance: { x: 150, y: 20 },
        exit: { x: 40, y: 78, w: 20, h: 12 },
        skills: { floater: 0, bomber: 0, blocker: 5, builder: 0, basher: 0, digger: 0, climber: 0, miner: 0, platformer: 0 },
        buildTerrain: (data, gw, gh) => {
            for (let y = 90; y < gh; y++) for (let x = 0; x < 300; x++) data[y * gw + x] = 1;
            for (let y = 0; y < gh; y++) {
                for (let x = 0; x < 10; x++) data[y * gw + x] = 1;
            }
        }
    },
    {
        name: "Level 5: Mary Poppins",
        total: 15, required: 10, spawnRate: FPS * 3, time: 5 * 60 * FPS,
        entrance: { x: 50, y: 20 },
        exit: { x: 340, y: 198, w: 20, h: 12 },
        skills: { floater: 15, bomber: 0, blocker: 0, builder: 0, basher: 0, digger: 0, climber: 0, miner: 0, platformer: 0 },
        buildTerrain: (data, gw, gh) => {
            for (let y = 90; y < gh; y++) for (let x = 0; x < 120; x++) data[y * gw + x] = 1;
            for (let y = 210; y < gh; y++) for (let x = 120; x < gw; x++) data[y * gw + x] = 1;
            for (let y = 0; y < gh; y++) {
                for (let x = 0; x < 10; x++) data[y * gw + x] = 1;
                for (let x = gw - 10; x < gw; x++) data[y * gw + x] = 1;
            }
        }
    },
    {
        name: "Level 6: Explosive Solutions",
        total: 20, required: 15, spawnRate: FPS * 2, time: 5 * 60 * FPS,
        entrance: { x: 50, y: 20 },
        exit: { x: 340, y: 78, w: 20, h: 12 },
        skills: { floater: 0, bomber: 5, blocker: 5, builder: 10, basher: 0, digger: 0, climber: 0, miner: 0, platformer: 0 },
        buildTerrain: (data, gw, gh) => {
            for (let y = 90; y < gh; y++) for (let x = 0; x < gw; x++) data[y * gw + x] = 1;
            for (let y = 0; y < gh; y++) {
                for (let x = 0; x < 10; x++) data[y * gw + x] = 1;
                for (let x = gw - 10; x < gw; x++) data[y * gw + x] = 1;
            }
            for (let y = 40; y < 90; y++) for (let x = 200; x < 210; x++) data[y * gw + x] = 1;
        }
    },
    {
        name: "Level 7: Climbing High",
        total: 15, required: 10, spawnRate: FPS * 2, time: 5 * 60 * FPS,
        entrance: { x: 30, y: 180 },
        exit: { x: 360, y: 30, w: 20, h: 12 },
        skills: { floater: 5, bomber: 0, blocker: 3, builder: 5, basher: 3, digger: 0, climber: 5, miner: 0, platformer: 0 },
        buildTerrain: (data, gw, gh) => {
            // Ground floor
            for (let y = 190; y < gh; y++) for (let x = 0; x < gw; x++) data[y * gw + x] = 1;
            // Walls
            for (let y = 0; y < gh; y++) {
                for (let x = 0; x < 10; x++) data[y * gw + x] = 1;
                for (let x = gw - 10; x < gw; x++) data[y * gw + x] = 1;
            }
            // Multiple platforms to climb
            for (let y = 150; y < 155; y++) for (let x = 50; x < 150; x++) data[y * gw + x] = 1;
            for (let y = 110; y < 115; y++) for (let x = 120; x < 250; x++) data[y * gw + x] = 1;
            for (let y = 70; y < 75; y++) for (let x = 80; x < 200; x++) data[y * gw + x] = 1;
            for (let y = 40; y < 45; y++) for (let x = 180; x < 350; x++) data[y * gw + x] = 1;
            // Tall wall blocking the way - climber needed!
            for (let y = 45; y < 190; y++) for (let x = 280; x < 290; x++) data[y * gw + x] = 1;
        }
    },
    {
        name: "Level 8: Mine Cart Madness",
        total: 20, required: 15, spawnRate: FPS * 2, time: 5 * 60 * FPS,
        entrance: { x: 50, y: 20 },
        exit: { x: 350, y: 190, w: 20, h: 12 },
        skills: { floater: 0, bomber: 0, blocker: 3, builder: 5, basher: 3, digger: 3, climber: 0, miner: 8, platformer: 3 },
        buildTerrain: (data, gw, gh) => {
            // Ground
            for (let y = 90; y < 150; y++) for (let x = 0; x < gw; x++) data[y * gw + x] = 1;
            // Lower ground with gap
            for (let y = 190; y < gh; y++) for (let x = 0; x < gw; x++) data[y * gw + x] = 1;
            // Walls
            for (let y = 0; y < gh; y++) {
                for (let x = 0; x < 10; x++) data[y * gw + x] = 1;
                for (let x = gw - 10; x < gw; x++) data[y * gw + x] = 1;
            }
            // Thick wall that needs diagonal mining
            for (let y = 40; y < 190; y++) for (let x = 200; x < 230; x++) data[y * gw + x] = 1;
        }
    },
    {
        name: "Level 9: Platform Party",
        total: 15, required: 10, spawnRate: FPS * 3, time: 5 * 60 * FPS,
        entrance: { x: 30, y: 20 },
        exit: { x: 370, y: 100, w: 20, h: 12 },
        skills: { floater: 3, bomber: 0, blocker: 2, builder: 3, basher: 0, digger: 0, climber: 0, miner: 0, platformer: 10 },
        buildTerrain: (data, gw, gh) => {
            // Small ground platforms with big gaps
            for (let y = 90; y < 95; y++) for (let x = 0; x < 60; x++) data[y * gw + x] = 1;
            for (let y = 90; y < 95; y++) for (let x = 120; x < 180; x++) data[y * gw + x] = 1;
            for (let y = 90; y < 95; y++) for (let x = 240; x < 300; x++) data[y * gw + x] = 1;
            for (let y = 100; y < 105; y++) for (let x = 340; x < gw; x++) data[y * gw + x] = 1;
            // Walls
            for (let y = 0; y < gh; y++) {
                for (let x = 0; x < 10; x++) data[y * gw + x] = 1;
                for (let x = gw - 10; x < gw; x++) data[y * gw + x] = 1;
            }
            // Deep pit below
            for (let y = 200; y < gh; y++) for (let x = 0; x < gw; x++) data[y * gw + x] = 1;
        }
    },
    {
        name: "Level 10: The Ultimate Challenge",
        total: 25, required: 20, spawnRate: FPS * 2, time: 6 * 60 * FPS,
        entrance: { x: 30, y: 20 },
        exit: { x: 370, y: 190, w: 20, h: 12 },
        skills: { floater: 5, bomber: 3, blocker: 5, builder: 8, basher: 5, digger: 5, climber: 5, miner: 5, platformer: 5 },
        buildTerrain: (data, gw, gh) => {
            // Complex multi-level terrain
            for (let y = 0; y < gh; y++) {
                for (let x = 0; x < 10; x++) data[y * gw + x] = 1;
                for (let x = gw - 10; x < gw; x++) data[y * gw + x] = 1;
            }
            // Multiple platforms
            for (let y = 60; y < 65; y++) for (let x = 30; x < 120; x++) data[y * gw + x] = 1;
            for (let y = 100; y < 105; y++) for (let x = 80; x < 200; x++) data[y * gw + x] = 1;
            for (let y = 140; y < 145; y++) for (let x = 150; x < 280; x++) data[y * gw + x] = 1;
            for (let y = 180; y < 185; y++) for (let x = 250; x < 380; x++) data[y * gw + x] = 1;
            // Bottom floor
            for (let y = 200; y < gh; y++) for (let x = 0; x < gw; x++) data[y * gw + x] = 1;
            // Tall wall requiring climber or basher
            for (let y = 65; y < 200; y++) for (let x = 170; x < 180; x++) data[y * gw + x] = 1;
            // Another wall
            for (let y = 105; y < 200; y++) for (let x = 300; x < 310; x++) data[y * gw + x] = 1;
        }
    }
];

