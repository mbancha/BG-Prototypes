# ARCHITECTURE.md — orientation for whoever edits this next

> TEMPLATE. Fill this in as you build; keep it current as the game changes.
> It is the file every new session reads first, and it replaces the
> conversation that produced the code. If a doc, comment or test disagrees
> with this file, this file is the truth and the others get fixed.

Companion files: **DECISIONS.md** (rulings where the spec was silent),
**README.md** (how to run and tune).

---

## 1. What this is

<!-- One paragraph: the game, player count, what stage it's at, and what the
prototype is FOR (usually: tune numbers, test rule interactions, export
telemetry). -->

## 2. The game, as implemented

<!-- The rules the code actually enforces, tersely. Components, turn
structure, scoring, game end. This is what a new session reads instead of
re-deriving the rules from the code. Include a dated list of rule CHANGES so
the history is legible: -->

### Rule changes (dated)

1. …

## 3. Module map

```
src/data/config.ts     every tunable number
src/game/engine.ts     rules + the public action API (newGame/applyAction)
src/game/bot.ts        botDecide(state) → next Action
src/sim/sim.ts         headless simulation + telemetry aggregates
src/App.tsx            snapshot history (undo), dispatch, bot driver
src/ui/*.tsx           SetupScreen / GameScreen / BoardView — presentation
tests/engine.test.ts   targeted rules tests + seeded full games
scripts/sim.mjs        CLI simulation (npm run sim)
```

## 4. How state flows

1. UI (or the bot driver) builds an `Action` and calls `dispatch`.
2. `dispatch` clones the newest snapshot and runs `applyAction` on the
   clone. Error string → toast, clone discarded. Success → appended.
   Undo = drop the last snapshot.
3. Decisions a player must make go in `s.pending`; the reply comes back as
   an action. The engine never blocks or prompts.
4. Bots emit the same actions a human would, so they can't cheat and undo
   keeps working.

**Hard constraint:** everything inside the state stays plain serializable
data (no classes/Maps/functions) — undo, telemetry dumps and simulation all
depend on it.

## 5. Recipes

- **Tune a number** → `src/data/config.ts`; the dev server hot-reloads.
- **Add a component/card** → its data file; reuse an existing effect shape
  if one fits.
- **Add a new rule** → engine first, then a test, then the UI.
- **Make bots smarter** → the scoring function in `bot.ts`, nothing else.
- **Answer a balance question** → `npm run sim`.
- **Verify** → `npm test` (unit + seeded full games) and `npm run build`
  (typecheck).

## 6. Invariants the tests enforce

<!-- e.g. token conservation, board/index maps agree, every seeded game
terminates, scores are non-negative. List them so the next editor knows
what must not break. -->
