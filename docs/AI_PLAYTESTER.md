# AI Playtester

`scripts/playtest-agent.mjs` is a deterministic level-testing agent for Puffin Panic 2.

It is not a full browser bot. It materializes level terrain, explores walking/falling states, tries available skill templates at reachable positions, mutates terrain with runtime-like masks, and reports whether it can produce a plausible route to the exit.

## Commands

```powershell
node scripts/playtest-agent.mjs --campaign
node scripts/playtest-agent.mjs --file levels/level_005.json
npm run level:playtest
```

## What It Can Prove

- Standard walking/falling routes.
- Floater-assisted drop routes.
- Blocker-style direction control.
- Basher passages through the first reachable wall.
- Vertical digger shafts with fatal-fall diagnostics.
- First-obstacle bomber routes.
- First-gap builder routes.
- Template-based miner and mixed-skill route attempts.

## Current Campaign Result

As of the latest pass, `npm run level:playtest` produces plausible route plans for levels 001-010. Pair it with:

```powershell
node scripts/verify-levels.mjs
node scripts/release-rate-qc.mjs
```

The AI playtester has already caught real design issues:

- Level 001's digger drop was 71px, just over the 70px death threshold.
- Level 006's bomber wall was too thick for a first-bomber lesson.
- Level 007's builder gap was beyond a practical first bridge.
- Level 008 had steel embedded in a wall that was supposed to teach bashing.
- Level 009 was retuned into a focused miner-under-steel lesson.

## What It Cannot Prove Yet

- Full multi-puffin timing with release-rate pressure.
- Browser-only runtime details such as exact click timing, animation cadence, sound, particles, or visual readability.
- All valid Lemmings-style solutions. A failure means "the agent did not find a route," not "the level is impossible."

Use this as a cold automated playtester before manual playtest. Levels that fail should either receive a design review, a level-data fix, or a stronger skill template in the agent.
