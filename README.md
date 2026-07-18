# SPYPUNK — digital playtest prototype

Hotseat (2–4 players, one device) prototype of the SPYPUNK domino-placement
card game. Vite + React + TypeScript, no backend, all state in memory.

## Run

```bash
npm install
npm run dev        # → http://localhost:5173
npm test           # engine tests (enclosure, scoring, protections, …)
npm run build      # typecheck + production build
```

## Tuning between playtests

- **`src/data/config.ts`** — every global number: starting money, hand sizes,
  influence supply, baseline influence, symbol match values, tie divisor,
  final-turn count.
- **`src/data/cards.json`** — all 60 cards: costs, points, symbols, effect
  parameters. Set `"disabled": true` on any card to bench its effect
  mid-playtest (the card stays in the deck; symbols and points still work,
  but it can't be deployed and its Ongoing stops contributing).

## Playtest telemetry

STATS tab (right panel): matches per symbol, influence added/removed/moved,
fizzles, money per source, deploys vs placements, enclosures, turn count,
live scores. **⬇ DUMP JSON** downloads the full dump (config + telemetry +
plain-language log) for offline analysis.

## Controls

- Click a hand card's **⌗ place**, move the ghost on the grid, **R** rotates,
  click to confirm, **Esc** cancels. Matching edges are flagged before you
  commit, with the effect preview in the bottom-left box.
- **⚡ deploy $x** pays and resolves an effect (Instant) or adds it to your
  tableau (Ongoing). Max one deploy per turn, before or after placing.
- Targeting prompts appear top-center; highlighted cards on the grid are
  clickable directly.
- **⎌ UNDO** steps back through every action (full history).
- Grid: drag to pan, wheel to zoom.

Design rulings where the spec was silent: see **DECISIONS.md**.
