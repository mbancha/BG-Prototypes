---
name: board-game-prototype
description: Playbook for building and iterating on digital board-game prototypes in this repo. Use when starting a new prototype from a design spec, or when making rule/mechanic changes to an existing game under games/. Covers the engine architecture, the kernel primitives, required artifacts, tuning workflow, bots, simulation and verification.
---

# Board game prototyping

This repo exists to turn a written game idea into something playable within
one session, and then to survive dozens of rounds of "actually, change the
core mechanic". Optimize for **iteration speed and legibility**, not polish.

## Before touching anything

1. Read the root `CLAUDE.md` for the game index.
2. For an existing game, read `games/<name>/ARCHITECTURE.md` (rules as
   built, module map, recipes) and skim `DECISIONS.md` (rulings already
   made). These replace the conversation you weren't part of. Do not
   re-derive the rules from code.
3. For a new game, copy `kernel/template/` to `games/<name>/` — it is a
   runnable hotseat prototype (snapshot undo, bots, seeded simulation,
   pan/zoom board, prompts, telemetry dump, replay, fuzz tests) with the
   game-specific parts marked `TODO`. Rename it in `package.json` and
   `index.html`, then build the real rules on top. Don't start from scratch;
   don't import across games — copy and diverge.

## The architecture (non-negotiable parts)

These five rules are what make everything else cheap. Keep them in every
prototype:

- **State is plain serializable data.** No classes, Maps, Sets or functions
  inside the game state. This is what gives you undo (`structuredClone`
  snapshots), JSON telemetry, and headless simulation for free.
- **One public API: `newGame` + `applyAction(state, action)`.** The engine
  mutates the state it's handed and returns `null` or a rejection string.
  The app always passes a fresh clone, so rejection = discard the clone and
  undo = drop the last snapshot.
- **Rules never block or prompt.** Anything a player must decide goes into
  `state.pending`; the answer arrives as another action. Multi-step effects
  run as a stack of small frames (`kernel/decide.ts`).
- **Randomness lives INSIDE the state** (`state.rng`, seeded — see
  `kernel/rng.ts`). Never `Math.random` in the engine, and don't pass a
  generator function in either: an external generator isn't rewound by undo,
  so redoing a turn deals different cards and bug reports stop reproducing.
  A seed plus the action list must replay a game exactly.
- **`legalActions(state)` is a required export.** It enumerates everything
  that would be accepted right now, including answers to an open decision.
  Bots pick from it, the fuzzer walks it, the simulator drives it. A rule the
  bot can't see is a rule that never gets tested.

Bots are ordinary players with `isBot: true` whose decision function returns
the *same actions a human's clicks would*, chosen from `legalActions`. That
constraint means bots can't cheat, undo keeps working, and simulation is just
"run the bot with a seed".

## The kernel

`src/kernel/` is a toolbox of game-agnostic primitives, **copied into each
game** (not shared at runtime — a generic engine across games is an
anti-pattern here). Edit it freely; delete what your game doesn't use. Each
module stands alone except `zones` → `rng`.

| Module | What it owns |
|---|---|
| `rng.ts` | Seeded PRNG stored in state, dice, shuffles, weighted picks |
| `zones.ts` | Every container as a named ordered list: deck, hand@2, market, supply, tableau, bag. Draw-with-reshuffle, deal, market refill, component census |
| `flow.ts` | Rounds, phases, turn order, action points, passing, simultaneous play, extra turns, elimination |
| `decide.ts` | `state.pending` prompts + the frame stack for multi-step effects; answer validation and enumeration |
| `board.ts` | Topologies (fixed grid, open grid, hex, point-to-point graph, track) and the algorithms over them: flood, groups, perimeter/sealed, distances, paths, n-in-a-row lines, majority, floating extent |
| `outcome.ts` | Ranking with cascading tiebreakers, ties as first-class, lowest-wins, explicit winners, co-op |
| `econ.ts` | Resource pools with atomic payment, income, caps, player-to-player transfer |
| `harness.ts` | `fuzz()` random-legal play with invariant checks, and `replay()` from seed + actions |

## Mechanism cookbook

Find your mechanism, use that seam. Every row has a worked, runnable example
in `kernel/template/tests/mechanisms.test.ts` — read it before inventing
something.

| Mechanism | Reach for |
|---|---|
| Tile laying on an open table | `board.openGrid` + `growExtent`/`withinLimit` |
| Fixed printed board | `board.squareGrid(w, h)` |
| N-in-a-row / pattern win | `board.linesIn` + `outcome.finish({winners})` |
| Hex map | `board.hexGrid`, `hexDistance` |
| Point-to-point map, rail/route networks | `board.graph` + `pathTo` / `distances` |
| Rondel, race track, price track | `board.track` |
| Area majority / control | `board.groups` + `board.majority` |
| Enclosure, Go-style liberties, sealed regions | `board.perimeter` / `isSealed` |
| Hand management, decks, discards | `zones` + `drawTo` |
| Deck-building (personal deck + reshuffle) | `zones.draw({ reshuffleFrom, rng })` |
| Market / card row that refills | `zones.refillRow` |
| Trick-taking, follow suit | per-seat zones + legality in `legalActions` |
| Worker placement, blocking | a zone per action space + `flow.passSeat` / `allPassed` |
| Action points | `flow.spend` / `f.actions` |
| Phases in a turn (production, politics…) | `flow.setPhase` |
| Rounds, ages, eras | `flow.beginRound` (+ swap the deck feeding the row) |
| Variable turn order / initiative | `flow.beginRound(f, newOrder)`, `rotated`, `snake` |
| Simultaneous selection, drafting, sealed bids | `flow.beginSimultaneous` / `submit` |
| Extra turns, reactions, interrupts | `flow.grantTurn` |
| Player elimination / last one standing | `flow.eliminate` + `survivors` |
| Dice, push-your-luck, random events | `rng.roll` / `rollMany` on `state.rng` |
| Resource economies, production, corruption caps | `econ.pay` / `produce` / `clampTo` |
| Trading between players | `econ.transfer` |
| Auctions and bidding | a frame in `decide` asking each seat, `pending.who` |
| Targeted attacks, "victim discards" | `pending.who` ≠ the active player |
| Chained / multi-step card effects | frames: `pushFrame`, `f.ph`, `setReturn` |
| Co-operative games, solo | `outcome.finish({ coop })` |
| Teams | rank team totals, `winners` = all members |
| Scoring from many sources | `outcome.Breakdown` per player |

Nothing in that table is a promise: each one is exercised by a mini-game in
the conformance tests that plays to completion under the fuzzer.

## What every prototype must have

| Artifact | Why |
|---|---|
| `src/data/config.ts` | Every tunable number in one file. No game-numeric literals anywhere else. |
| Component data file (`cards.json` etc.) | Data-driven pieces; derive what can be derived (points from symbols, etc.) rather than storing it twice. |
| `legalActions(state)` | The action space. Bots, fuzzing and simulation all depend on it. |
| `ARCHITECTURE.md` | Rules as built + module map + dated rule-change list. The next session's context. |
| `DECISIONS.md` | Numbered rulings where the spec was silent, with the reasoning. Mark superseded ones "(amended)". |
| Tests | Targeted rules cases, plus `fuzz()` with invariants checked after every action, plus a replay test. |
| Simulation | Seeded headless runs answering balance questions ("does seat 1 win too much?"). |
| Telemetry dump | A button that exports config + counters + log + **seed and action log** as JSON. |
| `scripts/smoke.mjs` | Headless-browser boot-and-play check for UI-visible changes. |

## Working rituals

- **Tune through config/data, not code.** If a request is "make X worth 2",
  it should be a one-line data edit. If it isn't, that's a signal the value
  is hardcoded in the wrong place — fix that first.
- **Variants are runtime toggles, not branches or forks.** The designer
  wants to A/B two scoring rules in one sitting; a setup-screen switch beats
  a git branch every time.
- **Every silent-spec question becomes a `DECISIONS.md` entry** in the same
  edit that implements it.
- **Make illegal states unrepresentable at the rule layer.** Legality
  (protections, limits, supply) belongs in the primitive mutation helpers so
  every effect inherits it, rather than being re-checked per effect.
- **Never park a prompt whose only legal answers are unaffordable.** Filter
  the options when you build the `Pending`, not when the answer arrives.
- **Big mechanic pivots are normal.** When one lands, update
  ARCHITECTURE.md's rule list in the same commit, and fix the tests that
  encoded the old rule rather than working around them.
- **Verify before pushing**: `npm test` and `npm run build` at minimum; for
  UI-visible changes, drive it in a real browser (`npm run smoke`) and
  actually look at the screenshot. Report what you actually ran.

## Turning a spec into a build

`references/spec-template.md` is the format that works. The essentials:
components, turn structure, every unique piece verbatim, win condition, and
explicit permission to make rulings where the spec is silent.

Photos are good for layouts, component shapes and board geometry; ask for
rules text to be typed rather than photographed. When something is
ambiguous, pick the interpretation that is easiest to change later, ship it,
and log it — don't stall the build on a question the designer can answer
faster by playing it.

Build order for a new game (each step playable before the next):
place-a-piece → scoring → end condition → the special rules → bots →
simulation → polish.

## Anti-patterns

- Rebuilding the shell (setup screen, undo, hotseat, bots, prompts) per game
  instead of copying the template.
- A "generic" engine **shared across games** — prototypes diverge fast, and
  coupling them makes every change a compatibility problem. (Copying the
  kernel into each game is the opposite of this: after the copy it is that
  game's code, to edit or delete.)
- Randomness from `Math.random`, or from a `rnd` function passed into the
  engine — both break undo and replay. It goes in the state.
- Deep-cloning state inside the engine, or hiding rules in React components.
- Bots that call internal helpers instead of emitting actions, or that read
  from anywhere other than `legalActions`.
- Balance claims from vibes when a 10,000-game simulation takes 90 seconds.
- Shipping a rule change without a fuzz run — the invariant checks catch the
  wedge you didn't think of.
- Chasing visual polish while a mechanic is still moving.
