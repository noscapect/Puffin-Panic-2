// Replays real pointer assignments against the live simulation.
// Run from the game page with await import('./scripts/replay-classic.mjs').then(m => m.play(3)).
// DOS Fun "Intended Solution" skill assignments, in campaign order.
const solutions = [
    { digger: 1 }, { floater: 10 }, { blocker: 3 }, { climber: 10, miner: 1 },
    { basher: 9 }, { blocker: 2, bomber: 2 }, { builder: 7 }, { blocker: 1 },
    { basher: 1, blocker: 1 }, { floater: 20, blocker: 1 },
    { climber: 2, floater: 2, blocker: 1, basher: 1, bomber: 1 },
    { basher: 1, blocker: 1, builder: 2 }, { digger: 20 },
    { miner: 1, builder: 4, basher: 2 },
    { basher: 3, blocker: 1, builder: 7, bomber: 1 }
];

export async function play(number, { renderEvery = 12 } = {}) {
    if (!Number.isInteger(number) || number < 1 || number > solutions.length) throw new Error('Choose a level from 1 to 15.');
    document.getElementById('debug-level-select').value = String(number - 1);
    startGame();
    cancelAnimationFrame(loopId);
    const used = new Set();
    const actions = [];
    function assign(p, skill, key) {
        if (used.has(key) || !p.canAcceptSkill(skill)) return;
        selectSkill(skill);
        const before = currentSkillCounts[skill];
        handleGamePointerDown(p.x + 4, p.y + 6);
        if (currentSkillCounts[skill] < before) {
            used.add(key);
            actions.push({ tick: gameState.ticks, skill, x: p.x + 4, y: p.y + 6 });
        }
    }
    while (gameState.active && !gameState.ending && gameState.ticks <= LEVELS[number - 1].time) {
        const leader = puffins[0];
        puffins.forEach((p, index) => {
            if (number === 2 && p.state === ST_WALK) assign(p, 'floater', index);
            if (number === 4) {
                if (!p.isClimber) assign(p, 'climber', 'climber-' + index);
                if (!index && p.state === ST_WALK && p.x >= 145 && p.vx > 0) assign(p, 'miner', 'mine');
            }
            if (number === 10 && !p.isFloater) assign(p, 'floater', index);
            if (number === 11 && index < 2) {
                if (!p.isClimber) assign(p, 'climber', 'climb-' + index);
                if (!p.isFloater) assign(p, 'floater', 'float-' + index);
            }
        });
        const walker = (condition) => puffins.find(p => p.state === ST_WALK && condition(p));
        const use = (p, skill, key) => { if (p) assign(p, skill, key); };
        if (number === 1) use(walker(p => p.x >= 210), 'digger', 'shaft');
        if (number === 3) {
            for (const [key, x, y, direction] of [[0, 307, 52, 1], [1, 83, 82, -1], [2, 293, 112, 1]]) {
                const p = puffins.find(p => p.state === ST_WALK && Math.abs(p.y - y) < 3 &&
                    p.vx === direction && (direction > 0 ? p.x >= x : p.x <= x));
                if (p) assign(p, 'blocker', key);
            }
        }
        if (number === 5) {
            for (const wall of [94, 118, 142, 166, 185, 226, 250, 274, 298]) {
                use(walker(p => !p.isBasher && p.vx > 0 && p.x >= wall - 18 && p.x <= wall - 6), 'basher', wall);
            }
        }
        if (number === 6) {
            for (const x of [168, 229]) {
                use(walker(p => p.vx > 0 && p.x >= x && p.x < x+5), 'blocker', x);
                use(puffins.find(p => p.state === ST_BLOCK && p.x >= x && p.x < x+5), 'bomber', 'bomb-' + x);
            }
        }
        if (number === 7 && leader?.state === ST_WALK && leader.vx > 0 && leader.x >= 133 && leader.x < 299)
            assign(leader, 'builder', 'flight-' + currentSkillCounts.builder);
        if (number === 8) use(walker(p => p.x >= 285 && p.y < 120 && p.vx > 0), 'blocker', 'turn');
        if (number === 9 || number === 12) {
            const wall = number === 9 ? 166 : 98;
            use(walker(p => p.vx > 0 && p.x >= wall), 'basher', 'bash');
            use(walker(p => p.vx < 0 && p.x < ENTRANCE.x - 5), 'blocker', 'turn');
        }
        if (number === 10) use(walker(p => p.x >= 262 && p.y > 150), 'blocker', 'turn');
        if (number === 11) {
            use(walker(p => p.x >= 242 && p.y > 130), 'blocker', 'turn');
            use(walker(p => p.vx < 0 && p.x > 210), 'basher', 'return-tunnel');
            if (used.has('return-tunnel')) use(puffins.find(p => p.state === ST_BLOCK), 'bomber', 'release');
        }
        if (number === 12) {
            for (const x of [196, 257]) use(walker(p => p.vx > 0 && p.x >= x && p.x < x+5), 'builder', x);
        }
        if (number === 13) {
            const x = 302 - used.size * 13;
            use(walker(p => p.y < 85 && p.x >= x), 'digger', 'shaft-' + used.size);
        }
        if (number === 14 || number === 15) {
            const right = condition => walker(p => p.vx > 0 && condition(p));
            if (number === 14)
                use(right(p => p.x >= 50 && p.y < 105), 'miner', 'down');
            const walls = number === 14 ? [196, 316] : [67, 98, 147];
            for (const x of walls)
                use(right(p => p.x >= x-17 && p.x <= x-7 && !p.isBasher), 'basher', x);
            if (number === 15)
                use(right(p => p !== leader && p.x >= 127 && p.x < 135), 'blocker', 'hold');
            const flights = number === 14 ? [[124,2],[241,2]] : [[175,4],[275,3]];
            for (const [x,count] of flights) {
                for (let i=0; i<count; i++) {
                    if (i && !used.has('stairs-' + x + '-' + (i-1))) break;
                    if (leader?.state === ST_WALK && leader.vx > 0 && leader.x >= x+i*24 && leader.x < x+count*24)
                        assign(leader,'builder','stairs-' + x + '-' + i);
                }
            }
            if (number === 15 && used.has('stairs-275-2'))
                use(puffins.find(p => p.state === ST_BLOCK), 'bomber', 'release');
        }
        if (gameState.spawned === TOTAL_PUFFINS && puffins.every(p => [ST_BLOCK, ST_EXITED, ST_DEAD, ST_SPLAT].includes(p.state))) {
            // End the attempt using the normal nuke control after all walkers have finished.
            if (puffins.some(p => p.state === ST_BLOCK) && !nukeActivated) triggerNuke();
        }
        update();
        if (renderEvery && gameState.ticks % renderEvery === 0) {
            draw();
            await new Promise(resolve => requestAnimationFrame(resolve));
        }
    }
    draw();
    if (gameState.saved < REQUIRED_PUFFINS) throw new Error('Replay failed for level ' + number + ': ' + gameState.saved + '/' + REQUIRED_PUFFINS);
    const expected = solutions[number - 1];
    const counts = {};
    for (const { skill } of actions) counts[skill] = (counts[skill] || 0) + 1;
    for (const skill of new Set([...Object.keys(expected), ...Object.keys(counts)])) {
        if (counts[skill] !== expected[skill]) throw new Error('Unexpected ' + skill + ' count in level ' + number);
    }
    return { number, saved: gameState.saved, total: TOTAL_PUFFINS, dead: gameState.dead, actions };
}
