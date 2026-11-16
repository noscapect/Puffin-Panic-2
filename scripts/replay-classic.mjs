// Replays real pointer assignments against the live simulation.
// Run from the game page with await import('./scripts/replay-classic.mjs').then(m => m.play(3)).
export async function play(number, { renderEvery = 12 } = {}) {
    if (!Number.isInteger(number) || number < 2 || number > 10) throw new Error('Choose a level from 2 to 10.');
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
    while (gameState.active && !gameState.ending && gameState.ticks < 9000) {
        const leader = puffins[0];
        puffins.forEach((p, index) => {
            if (number === 2 && p.state === ST_WALK) assign(p, 'floater', index);
            if (number === 4) {
                if (!p.isClimber) assign(p, 'climber', 'climber-' + index);
                if (!index && p.state === ST_WALK && p.x >= 145 && p.vx > 0) assign(p, 'miner', 'mine');
            }
            if (number === 5 && !index && p.state === ST_WALK && !p.isBasher) assign(p, 'basher', index);
            if (number === 10 && !p.isFloater) assign(p, 'floater', index);
        });
        if (number === 3) {
            for (const [key, x, y, direction] of [[0, 307, 52, 1], [1, 83, 82, -1], [2, 293, 112, 1]]) {
                const p = puffins.find(p => p.state === ST_WALK && Math.abs(p.y - y) < 3 &&
                    p.vx === direction && (direction > 0 ? p.x >= x : p.x <= x));
                if (p) assign(p, 'blocker', key);
            }
        }
        if (number === 6 && leader) {
            if (leader.state === ST_WALK && leader.x >= 168) assign(leader, 'blocker', 'block');
            if (leader.state === ST_BLOCK) assign(leader, 'bomber', 'bomb');
        }
        if (number === 7) {
            const p = puffins.find(p => p.state === ST_WALK && p.vx > 0 && p.x >= 244 && p.x <= 254);
            if (p) assign(p, 'builder', 'bridge');
        }
        if (number === 8) {
            const p = puffins.find(p => p.state === ST_WALK && p.x >= 285 && p.y < 120 && p.vx > 0);
            if (p) assign(p, 'blocker', 'turn');
        }
        if (number === 9 && leader?.state === ST_WALK && leader.x >= 166) assign(leader, 'basher', 'bash');
        if (number === 10 && leader?.state === ST_WALK && leader.y < 170) assign(leader, 'digger', 'dig');
        if ((number === 3 || number === 8) && gameState.spawned === TOTAL_PUFFINS &&
            puffins.every(p => [ST_BLOCK, ST_EXITED, ST_DEAD, ST_SPLAT].includes(p.state))) {
            cancelSkill();
            puffins.filter(p => p.state === ST_BLOCK).forEach(p => handleGamePointerDown(p.x + 4, p.y + 6));
        }
        update();
        if (renderEvery && gameState.ticks % renderEvery === 0) {
            draw();
            await new Promise(resolve => requestAnimationFrame(resolve));
        }
    }
    draw();
    if (gameState.saved < REQUIRED_PUFFINS) throw new Error('Replay failed for level ' + number + ': ' + gameState.saved + '/' + REQUIRED_PUFFINS);
    return { number, saved: gameState.saved, total: TOTAL_PUFFINS, dead: gameState.dead, actions };
}
