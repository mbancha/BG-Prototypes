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
src/game/engine.ts     rules + the public API (newGame/applyAction/legalActions)
src/game/bot.ts        botDecide(state) → next Action, chosen from legalActions
src/sim/sim.ts         headless simulation + telemetry aggregates
src/App.tsx            snapshot history (undo), action log, dispatch, bot driver
src/ui/*.tsx           SetupScreen / GameScreen / BoardView / PendingPrompt
tests/engine.test.ts   targeted rules tests + fuzzing + replay
tests/kernel.test.ts   unit tests for the kernel primitives
tests/mechanisms.test.ts  worked micro-games per mechanism (safe to delete)
scripts/sim.mjs        CLI simulation (npm run sim)
scripts/smoke.mjs      headless-browser boot-and-play check (npm run smoke)
```

### The kernel

`src/kernel/` is a toolbox of game-agnostic primitives. It was **copied into
this folder** and belongs to this game — edit it, and delete the modules you
don't use. Nothing is shared with other games at runtime. Only dependency
between modules: `zones` uses `rng` to shuffle.

```
kernel/rng.ts       seeded PRNG kept IN the state; dice, shuffles, weighted picks
kernel/zones.ts     every container as a named ordered list (deck/hand@2/market/
                    supply/tableau); draw-with-reshuffle, deal, refill, census
kernel/flow.ts      rounds, phases, turn order, action points, passing,
                    simultaneous windows, extra turns, elimination
kernel/decide.ts    state.pending prompts + the frame stack for multi-step
                    effects; answer validation and enumeration
kernel/board.ts     topologies (fixed grid / open grid / hex / graph / track)
                    and the algorithms over them: flood, groups, perimeter,
                    distances, paths, n-in-a-row lines, majority, extent
kernel/outcome.ts   ranking with cascading tiebreakers, ties, co-op, teams
kernel/econ.ts      resource pools: atomic payment, income, caps, transfers
kernel/harness.ts   fuzz() random-legal play with invariants; replay()
kernel/types.ts     Seat, LogEntry, the log helpers
```

Which primitive fits which mechanism: see the cookbook table in
`.claude/skills/board-game-prototype/SKILL.md`, and the runnable examples in
`tests/mechanisms.test.ts`.

## 4. How state flows

1. UI (or the bot driver) builds an `Action` and calls `dispatch`.
2. `dispatch` clones the newest snapshot and runs `applyAction` on the
   clone. Error string → toast, clone discarded. Success → appended, and the
   action is appended to the action log. Undo = drop the last snapshot.
3. Decisions a player must make go in `s.pending`; the reply comes back as
   an action. The engine never blocks or prompts. Long effects run as frames
   on `s.exec` (see the header of `kernel/decide.ts` for the protocol).
4. Bots emit the same actions a human would — always chosen from
   `legalActions(s)` — so they can't cheat and undo keeps working.

**Hard constraints:**

- Everything inside the state stays plain serializable data (no
  classes/Maps/functions) — undo, telemetry dumps and simulation all depend
  on it.
- Randomness comes from `s.rng` only. That is what makes undo rewind luck and
  lets `replay(api, seed, actions)` rebuild a game exactly. A dump therefore
  IS a reproducible bug report.

## 5. Recipes

- **Tune a number** → `src/data/config.ts`; the dev server hot-reloads.
- **Add a component/card** → its data file; reuse an existing effect shape
  if one fits.
- **Add a new rule** → engine first, then a test, then the UI. If it adds a
  new kind of action, add it to `legalActions` in the same edit or bots and
  fuzzing will never exercise it.
- **Add a player decision** → build a `Pending` with the helpers in
  `kernel/decide.ts`; `PendingPrompt.tsx` renders it with no UI work. Only
  write custom UI when the prompt wants board highlighting.
- **Make bots smarter** → `scoreAction` in `bot.ts`, nothing else.
- **Answer a balance question** → `npm run sim`.
- **Reproduce a playtester's bug** → take `seed` and `actions` from their
  JSON dump, feed them to `replay()`.
- **Verify** → `npm test` (unit + fuzz + replay), `npm run build`
  (typecheck), `npm run smoke` after a build for a real-browser pass.

## 6. Invariants the tests enforce

The template ships with these; keep them and add your own. They are checked
after **every action** of every fuzzed game, so a violation comes with the
seed and step that produced it.

- Component conservation: the census over all zones always totals
  `DECK_SIZE`, with no piece in two places at once.
- `cellOwner` and `placedAt` agree exactly.
- No negative scores.
- Every pending decision belongs to a real seat.
- Every game terminates, and `legalActions` is empty only when it is over.

<!-- Add yours: token conservation per player, money ≥ 0, hand ≤ limit,
scored cards hold no influence, … -->
