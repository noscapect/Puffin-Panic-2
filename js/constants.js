// Game Constants
const GAME_WIDTH = 400;
const GAME_HEIGHT = 220;
const SCALE = 4; // Canvas is 1600x880
const FPS = 30;
const FRAME_MS = 1000 / FPS;
const FALL_DEATH_DIST = 70;

// --- Volumetric liquid constants ---
const LIQUID_MAX   = 8;   // full cell (0 = dry, 1-8 = water units)
const LIQUID_FLOW  = 4;   // max units transferred per simulation step

// --- Falling sand themes (loose material that pours when dislodged) ---
const SAND_THEMES = new Set(['desert', 'sandstone', 'mud', 'toxic_sludge']);

// --- Bridge crumble threshold (puffin-frames of stress on an unsupported cell) ---
// 600 ≈ 10 puffins each spending ~2 seconds stationary on the same span.
const BRIDGE_COLLAPSE_THRESHOLD = 600;

// --- Per-theme wind (positive = rightward, negative = leftward) ---
// Floaters and airborne particles are nudged by this each frame.
const THEME_WIND = {
    desert:      0.13,
    sandstone:   0.10,
    salt_flats:  0.08,
    snow:       -0.07,
    packed_snow:-0.06,
    ice:        -0.10,
    black_ice:   0.11,
};



// Puffin States
const ST_FALL = 0;
const ST_WALK = 1;
const ST_BLOCK = 2;
const ST_BUILD = 3;
const ST_BASH = 4;
const ST_DIG = 5;
const ST_FLOAT = 6;
const ST_DEAD = 7;
const ST_EXITED = 8;
const ST_SPLAT = 9;
const ST_PANIC = 10;
const ST_CLIMB = 11;
const ST_MINE = 12;
const ST_NUKE_PANIC = 13;
const ST_PLATFORM = 14;

// Skills definition — Original 8 Lemmings skills + Platformer
const SKILLS = [
    { id: 'climber',    name: 'Climber',    icon: '🧗' },
    { id: 'floater',    name: 'Floater',    icon: '☂️' },
    { id: 'bomber',     name: 'Bomber',     icon: '💣' },
    { id: 'blocker',    name: 'Blocker',    icon: '🛑' },
    { id: 'builder',    name: 'Builder',    icon: '🧱' },
    { id: 'basher',     name: 'Basher',     icon: '🥊' },
    { id: 'miner',      name: 'Miner',      icon: '⚒️' },
    { id: 'digger',     name: 'Digger',     icon: '⛏️' },
    { id: 'platformer', name: 'Platformer', icon: '🏗' },
];

// Palette for rendering
const PALETTE = {
    0: null,                       // transparent
    1: [14, 16, 28, 255],          // soft charcoal outline
    2: [252, 252, 255, 255],       // warm white belly / face
    3: [232, 130, 32, 255],        // softer orange feet
    4: [188, 198, 214, 255],       // gentle belly shadow
    5: [255, 224, 92, 255],        // beak highlight
    6: [215, 40, 40, 255],         // red (alarm / bomb)
    7: [0, 220, 80, 255],          // green exit
    8: [34, 40, 74, 255],          // softer navy back / wings
    9: [245, 120, 42, 255]         // friendlier orange beak
};

// Sprite data — 8×12 pixels, row-major, 96 values each
// Colour key: 0=transparent 1=black 2=white 3=orange-feet 4=gray
//             5=gold 6=red 8=dark-navy(back) 9=orange-red(beak)

// Walk — 2 frames (feet differ for stride cycle)
const SPRITE_WALK = [
    [   // Frame 0 — right foot forward
        0,0,0,1,1,0,0,0,
        0,0,1,8,8,1,0,0,
        0,1,8,2,2,9,9,0,
        1,8,2,2,2,5,5,0,
        1,8,8,2,2,2,1,0,
        0,1,8,8,2,2,1,0,
        0,1,8,8,2,2,1,0,
        0,1,8,8,2,2,1,0,
        0,1,8,8,4,2,1,0,
        0,0,1,8,8,1,0,0,
        0,0,3,0,0,3,0,0,
        0,3,3,0,0,0,3,0
    ],
    [   // Frame 1 — left foot forward
        0,0,0,1,1,0,0,0,
        0,0,1,8,8,1,0,0,
        0,1,8,2,2,9,9,0,
        1,8,2,2,2,5,5,0,
        1,8,8,2,2,2,1,0,
        0,1,8,8,2,2,1,0,
        0,1,8,8,2,2,1,0,
        0,1,8,8,2,2,1,0,
        0,1,8,8,4,2,1,0,
        0,0,1,8,8,1,0,0,
        0,0,3,0,0,3,0,0,
        0,0,3,0,0,3,3,0
    ]
];

// Fall / Float — wings spread wide, legs dangling
const SPRITE_FALL = [
    0,0,0,1,1,0,0,0,
    0,0,1,8,8,1,0,0,
    0,1,8,2,2,9,9,0,
    1,8,2,2,2,5,5,0,
    1,8,8,2,2,2,1,0,
    1,8,8,2,2,2,1,1,
    1,8,8,2,2,2,2,1,
    0,1,8,8,2,2,1,0,
    0,1,8,8,4,2,1,0,
    0,0,1,8,8,1,0,0,
    0,3,3,0,3,3,0,0,
    0,0,0,0,0,0,0,0
];

// Block — arms stretched wide, feet planted
const SPRITE_BLOCK = [
    0,0,0,1,1,0,0,0,
    0,0,1,8,8,1,0,0,
    0,1,8,2,2,9,9,0,
    1,8,2,2,2,5,5,0,
    1,8,8,2,2,2,1,0,
    1,1,8,8,2,2,1,1,
    1,1,8,2,2,2,1,1,
    0,1,8,8,2,2,1,0,
    0,1,8,8,4,2,1,0,
    0,0,1,8,8,1,0,0,
    0,0,3,3,3,3,0,0,
    3,3,3,0,0,3,3,3
];

// Builder — hard hat and carried brick so the role reads instantly
const SPRITE_BUILD = [
    0,0,5,5,5,5,0,0,
    0,0,0,1,1,0,0,0,
    0,0,1,8,8,1,0,0,
    0,1,8,2,2,9,9,0,
    1,8,2,2,2,5,5,0,
    1,8,8,2,2,2,1,5,
    0,1,8,8,2,2,1,5,
    0,1,8,8,2,2,1,0,
    0,1,8,8,4,2,1,0,
    0,0,1,8,8,1,0,0,
    0,0,3,0,0,3,0,0,
    0,3,3,0,0,0,3,0
];

// Basher — crouched forward with extended striking arm
const SPRITE_BASH = [
    0,0,0,1,1,0,0,0,
    0,0,1,8,8,1,0,0,
    0,1,8,2,2,9,9,0,
    1,8,2,2,2,5,5,1,
    1,8,8,2,2,2,6,6,
    0,1,8,8,2,2,6,6,
    0,1,8,8,2,2,1,0,
    0,1,8,8,2,2,1,0,
    0,1,8,8,4,4,1,0,
    0,0,1,8,8,1,0,0,
    0,0,3,0,0,3,0,0,
    0,3,3,0,0,3,3,0
];

// Digger — shovel raised over the head for vertical digging
const SPRITE_DIG = [
    0,0,0,1,1,1,0,0,
    0,0,1,8,8,1,1,0,
    0,1,8,2,2,9,9,1,
    1,8,2,2,2,5,5,1,
    1,8,8,2,2,2,1,1,
    0,1,8,8,2,2,1,0,
    0,1,8,8,2,2,1,0,
    0,1,8,8,2,2,1,0,
    0,1,8,8,4,2,1,0,
    0,0,1,8,8,1,0,0,
    0,0,3,0,0,3,0,0,
    0,3,3,0,0,3,3,0
];

// Panic — 2 frames (flailing arms, red distress marks on face)
const SPRITE_PANIC = [
    [   // Frame 0
        0,0,1,1,1,1,0,0,
        0,1,8,8,8,8,1,0,
        1,8,8,6,2,9,9,0,
        1,8,6,2,2,5,5,0,
        0,1,8,8,2,2,1,0,
        1,8,8,2,2,2,1,1,
        0,1,8,2,2,2,1,0,
        0,1,8,8,2,2,1,0,
        0,1,8,8,4,4,1,0,
        0,0,1,8,8,1,0,0,
        0,0,3,0,0,3,0,0,
        0,3,3,0,0,3,3,0
    ],
    [   // Frame 1
        0,0,1,1,1,1,0,0,
        0,1,8,8,8,8,1,0,
        1,8,8,2,6,9,9,0,
        1,8,2,6,2,5,5,0,
        0,1,8,8,2,2,1,0,
        0,1,8,2,2,2,1,1,
        1,8,8,2,2,2,1,0,
        0,1,8,8,2,2,1,0,
        0,1,8,8,4,4,1,0,
        0,0,1,8,8,1,0,0,
        0,0,3,0,0,3,0,0,
        0,3,3,0,0,3,3,0
    ]
];

// Climber — arms raised, feet braced on wall
const SPRITE_CLIMB = [
    0,0,0,1,1,0,0,0,
    0,0,1,8,8,1,0,0,
    0,1,8,2,2,9,9,0,
    1,8,2,2,2,5,5,0,
    1,8,8,2,2,2,1,1,
    0,1,8,8,2,2,1,1,
    0,1,8,8,2,2,1,0,
    0,1,8,8,2,2,1,0,
    0,1,8,8,4,2,1,0,
    0,0,1,8,8,1,0,0,
    0,3,0,0,0,0,3,0,
    0,3,0,0,0,0,3,0
];

// Miner — arm extended for diagonal pickaxe swing
const SPRITE_MINE = [
    0,0,1,1,1,1,0,0,
    0,1,8,8,8,8,1,0,
    1,8,8,2,2,9,9,0,
    1,8,2,2,2,5,5,0,
    0,1,8,8,2,2,1,0,
    0,1,8,8,2,2,1,0,
    0,1,8,8,2,2,1,0,
    0,1,8,8,2,2,4,1,
    0,1,8,8,4,4,1,0,
    0,0,1,8,8,1,0,0,
    0,0,3,0,0,3,0,0,
    0,3,3,0,0,3,3,0
];

// Nuke panic — 2 frames (alternates red body flash ↔ wide red eyes)
const SPRITE_NUKE_PANIC = [
    [   // Frame 0 — full red body
        0,0,1,1,1,1,0,0,
        0,1,6,6,6,6,1,0,
        1,6,6,2,2,9,9,0,
        1,6,2,2,2,5,5,0,
        0,1,6,6,2,2,1,0,
        1,6,6,2,2,2,1,1,
        1,6,6,2,2,2,1,1,
        0,1,6,6,2,2,1,0,
        0,1,6,6,4,4,1,0,
        0,0,1,6,6,1,0,0,
        0,0,3,0,0,3,0,0,
        0,3,3,0,0,3,3,0
    ],
    [   // Frame 1 — normal back, wide red eyes, arms up
        0,0,1,1,1,1,0,0,
        0,1,8,8,8,8,1,0,
        1,8,8,6,6,9,9,0,
        1,8,6,6,2,5,5,0,
        0,1,8,8,2,2,1,0,
        1,8,8,2,2,2,1,1,
        1,8,2,2,2,2,1,1,
        0,1,8,8,2,2,1,0,
        0,1,8,8,4,4,1,0,
        0,0,1,8,8,1,0,0,
        0,0,3,0,0,3,0,0,
        0,3,3,0,0,3,3,0
    ]
];

const PUFFIN_W = 8;
const PUFFIN_H = 12;