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
npm test         # unit tests + seeded full games
npm run build    # typecheck + production build (static files in dist/)
npm run sim      # headless bot games, aggregate telemetry
```

Windows: run these in **cmd.exe** (PowerShell blocks npm scripts by default).
Always `cd` into this folder first.

The placeholder rule (1 point per adjacent piece) is deliberately broken —
run `npm run sim` on the fresh template and you'll see the second player win
100% of the time. That's the tooling proving itself before you've written a
real rule: replace the rule, re-run, watch the number move.

## Tuning between playtests

- **`src/data/config.ts`** — every global number. Edit, save, the browser
  hot-reloads.
- Component data files — costs, values, effects.

## Controls

- Click a piece in hand, then click a cell to place it.
- Drag to pan, wheel to zoom.
- **⎌ UNDO** steps back through every action.
- **⬇ DUMP JSON** exports config + telemetry + the full log.
