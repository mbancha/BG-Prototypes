---
name: board-game-prototype
description: Playbook for building and iterating on digital board-game prototypes in this repo. Use when starting a new prototype from a design spec, or when making rule/mechanic changes to an existing game under games/. Covers the engine architecture, required artifacts, tuning workflow, bots, simulation and verification.
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
   pan/zoom board, telemetry dump, tests) with the game-specific parts
   marked `TODO`. Rename it in `package.json` and `index.html`, then build
   the real rules on top. Don't start from scratch; don't import across
   games — copy and diverge.

## The architecture (non-negotiable parts)

These four rules are what make everything else cheap. Keep them in every
prototype:

- **State is plain serializable data.** No classes, Maps, Sets or functions
  inside the game state. This is what gives you undo (`structuredClone`
  snapshots), JSON telemetry, and headless simulation for free.
- **One public API: `newGame` + `applyAction(state, action)`.** The engine
  mutates the state it's handed and returns `null` or a rejection string.
  The app always passes a fresh clone, so rejection = discard the clone and
  undo = drop the last snapshot.
- **Rules never block or prompt.** Anything a player must decide goes into
  `state.pending`; the answer arrives as another action. If a game needs
  long multi-step effects, run them as a stack of small frames (see
  `games/spypunk/src/game/runtime.ts` for a worked example).
- **Randomness is injected** (`rnd: () => number = Math.random`) so a seed
  reproduces a game exactly.

Bots are ordinary players with `isBot: true` whose decision function returns
the *same actions a human's clicks would*. They must always return a legal
action. That constraint means bots can't cheat, undo keeps working, and
simulation is just "run the bot with a seed".

## What every prototype must have

| Artifact | Why |
|---|---|
| `src/data/config.ts` | Every tunable number in one file. No game-numeric literals anywhere else. |
| Component data file (`cards.json` etc.) | Data-driven pieces; derive what can be derived (points from symbols, etc.) rather than storing it twice. |
| `ARCHITECTURE.md` | Rules as built + module map + dated rule-change list. The next session's context. |
| `DECISIONS.md` | Numbered rulings where the spec was silent, with the reasoning. Mark superseded ones "(amended)". |
| Tests | Targeted rules cases + a seeded full game with bots asserting invariants after every action. |
| Simulation | Seeded headless runs answering balance questions ("does seat 1 win too much?"). |
| Telemetry dump | A button that exports config + counters + log as JSON. |

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
- **Big mechanic pivots are normal.** When one lands, update
  ARCHITECTURE.md's rule list in the same commit, and fix the tests that
  encoded the old rule rather than working around them.
- **Verify before pushing**: `npm test` and `npm run build` at minimum; for
  UI-visible changes, drive it in a real browser (see `scripts/*smoke.mjs`)
  and look at the screenshot. Report what you actually ran.

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

- Rebuilding the shell (setup screen, undo, hotseat, bots) per game instead
  of copying the template.
- A "generic" engine shared across games — prototypes diverge fast, and
  coupling them makes every change a compatibility problem.
- Deep-cloning state inside the engine, or hiding rules in React components.
- Bots that call internal helpers instead of emitting actions.
- Balance claims from vibes when a 10,000-game simulation takes 90 seconds.
- Chasing visual polish while a mechanic is still moving.
