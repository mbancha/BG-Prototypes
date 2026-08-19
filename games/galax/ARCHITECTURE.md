# Galax architecture

## What this is
A seeded, hotseat/bot 2–4 player Galax rules prototype. It emphasizes inspectable state, undo/replay, science-capacity and global Blue-defense experiments over presentation.

## Rules implemented
Players select an action-generation method, then spend typed pools. Science advances to 15; Technology and Discovery ranks share per-turn capacity while each Invent spends one Science action. Technologies remain in tableau and Discoveries resolve then return through discard reshuffling. Science milestones are queried from current level. Civ resistance is calculated live as 3 plus civilized Blue (Science) systems. Conquer spends Military, flips from the state-owned seeded deck, and compares fleet/red/science power against resistance plus rank. Culture is checked at turn start and Supernova scores trophies, control, technologies and Science VP less Civs.

The twelve-sector prototype map is a ring-shaped logical sector list with three systems per color. The card source is `src/data/cards.json`; until the designer supplies the referenced spreadsheet, the deck expands those representative rows into a balanced 64-card test deck.

### Rule changes
1. 2026-08-19 — Initial implementation of the updated Science system, Blue global resistance, Conquer probability, milestones, configurable limits, bots, logging and telemetry.

## Module map
- `src/data/config.ts`: all balance constants and bot Science utilities.
- `src/data/cards.json`: representative imported-schema card records.
- `src/game/engine.ts`: serializable state and `newGame`/`applyAction`/`legalActions` API.
- `src/game/bot.ts`: milestone-aware Science, Blue and exact Conquer valuation.
- `src/ui/GameScreen.tsx`: state-first playtest interface.
- `tests/engine.test.ts`: Science capacity/milestone and Blue/Conquer tests.

## State flow and invariants
The app clones before applying an action, preserving undo. Random flips and shuffles use `state.rng`. Bots submit only enumerated legal actions. Player token supply is 15, hands cap at 7, Science caps at 15, and resistance is never cached.

## Verification automation

`npm run verify` runs the full tests, production build, and browser smoke journey. The smoke test covers setup, a Science advance, turn transition, undo, and screenshot capture. GitHub repeats this inside the official Playwright container and uploads the screenshot.
