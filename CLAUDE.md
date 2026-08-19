# Repo context — board game prototypes

Monorepo of playable digital prototypes for tabletop games in design. Each
game under `games/` is a standalone Vite + React + TypeScript app; nothing
is shared at runtime.

## Default for every session

**Before changing a game, read its `ARCHITECTURE.md`.** It holds the rules
as actually implemented, the module map, and a dated list of rule changes —
it exists so a fresh session never has to re-derive the design from code or
from a conversation it wasn't part of. Skim `DECISIONS.md` too when the task
touches rules; the question you're about to answer may already be settled.

Then follow the `board-game-prototype` skill (`.claude/skills/`) — the
architecture rules, required artifacts and verification steps live there.

## Games

| Path | What it is |
|---|---|
| `games/galax/` | GALAX — 2–4p space civilization prototype with bots, Science capacity and global Blue defense. |
| `games/spypunk/` | SPYPUNK — 2–4p domino-placement influence game. 60 unique ability cards, symbol matching, enclosure scoring. Also contains a stripped-down **color-groups** mode for testing the core loop without abilities, with variant toggles and a 10k-game simulator. |

`kernel/template/` is the starting point for a **new** prototype: copy it to
`games/<name>/`, rename it, build on top. It is a runnable hotseat game with
undo, bots, player prompts, seeded simulation, replay and telemetry already
wired up, on top of a **kernel** of board-game primitives (`src/kernel/`:
turn flow, zones, board topologies, decisions, resources, scoring, fuzzing).
The kernel is copied per game and is yours to edit or delete — copy and
diverge, never import across games.

Which primitive fits which mechanism is tabulated in the skill, and every
row has a runnable micro-game in `kernel/template/tests/mechanisms.test.ts`.

## House rules

- **All tunable numbers live in `src/data/config.ts`** for each game, and
  component data in JSON/data files. A balance change should be a data edit,
  not a code hunt.
- **Rulings get logged.** Where a spec is silent, decide, implement, and add
  a numbered entry to that game's `DECISIONS.md` in the same change.
- **Variants are runtime toggles**, chosen on the setup screen — not forks
  or branches, so two rules can be compared in one sitting.
- **Randomness lives in the state** (`state.rng`), never `Math.random` and
  never an injected `rnd` function — otherwise undo doesn't rewind luck and
  a seed stops reproducing a game.
- **Verify before pushing**: `npm test` and `npm run build` inside the game
  folder; drive the browser (`scripts/*smoke.mjs`) for UI-visible changes
  and actually look at the screenshot.
- Keep `ARCHITECTURE.md` current in the same commit as the rule change.

## Environment notes

- npm commands run **inside a game folder**, not the repo root
  (`cd games/spypunk && npm run dev`).
- The designer is on Windows and runs commands in **cmd.exe** (PowerShell
  blocks npm scripts by default); they update with `git pull`.
- Pushing to `main` publishes every game to GitHub Pages (see
  `.github/workflows/deploy.yml`), which is how playtesters get a link.
