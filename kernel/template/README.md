# PROTOTYPE — playtest build

> TEMPLATE. Rename the game, describe it in a sentence, and keep the tuning
> section honest — this is the page a playtester reads.

Hotseat (2–4 players, one device) prototype. Any seat can be a 🤖 bot.
Vite + React + TypeScript, no backend, all state in memory.

**New here (or an AI picking this up cold)? Read `ARCHITECTURE.md` first.**
`DECISIONS.md` holds the rulings.

## Run

```bash
npm install
npm run dev      # → http://localhost:5173
npm test         # unit tests + random-play fuzzing + replay
npm run build    # typecheck + production build (static files in dist/)
npm run sim      # headless bot games, aggregate telemetry
npm run smoke    # after a build: drive the real UI in headless Chromium
```

Windows: run these in **cmd.exe** (PowerShell blocks npm scripts by default).
Always `cd` into this folder first.

The placeholder rule (1 point per adjacent piece, plus a bonus choice when
you touch two) is deliberately broken — run `npm run sim` on the fresh
template and you'll see the second player win essentially every game. That's
the tooling proving itself before you've written a real rule: replace the
rule, re-run, watch the number move.

## What you get before writing any rules

- Hotseat pass screens, bot seats, snapshot undo (including undo *inside* a
  multi-step decision)
- A prompt system: park a question in `state.pending`, and `PendingPrompt`
  renders it — no UI work per decision
- Seeded games: type a seed on the setup screen to replay the exact same deal
- A JSON dump carrying the seed and the full action log, so a playtester's
  bug report replays exactly
- Random-play fuzzing that checks your invariants after every single action
- A kernel of board-game primitives (zones, turn flow, topologies, resources,
  scoring) — see `ARCHITECTURE.md` §3

## Tuning between playtests

- **`src/data/config.ts`** — every global number. Edit, save, the browser
  hot-reloads.
- Component data files — costs, values, effects.

## Controls

- Click a piece in hand, then click a cell to place it.
- Drag to pan, wheel to zoom.
- **⎌ UNDO** steps back through every action.
- **⬇ DUMP JSON** exports config + telemetry + log + seed + action log.

## Starting your game

1. Rename in `package.json` and `index.html`.
2. Replace the rules in `src/game/engine.ts` (the `TODO` markers).
3. Delete the kernel modules you don't need, and
   `tests/mechanisms.test.ts` once you've taken what you want from it.
4. Fill in `ARCHITECTURE.md` as you go.
