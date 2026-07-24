# SPYPUNK — digital playtest prototype

Hotseat (2–4 players, one device) prototype of the SPYPUNK domino-placement
card game. Any seat can be a 🤖 bot (simple, functional AI for solo testing).
Vite + React + TypeScript, no backend, all state in memory.

Two game modes on the setup screen:

- **♠ CLASSIC** — the full 60-card ability game.
- **◼ COLOR GROUPS** — stripped-down core experiment: color dominoes form
  contiguous groups; matching a side adds influence to the group; a group
  scores only when every cell around it is sealed. Played on a bounded
  board (default 4 + 1 per player, so 6×6 at 2p) whose **walls count as
  sealed edges**. Variant toggles at setup: group value BY SIZE vs FIXED,
  ★ bonus tiles, per-color powers — plus **⚗ SIMULATE**, which plays
  10,000 headless bot games on the current settings and reports win rate
  by colour played, average scores and points per colour.

**New here (or an AI picking this up cold)? Read `ARCHITECTURE.md` first** —
it summarizes the game rules as built, every module, and the recipes for
common edits. `DECISIONS.md` holds the rules judgment calls.

## Run

```bash
npm install
npm run dev        # → http://localhost:5173
npm test           # engine tests + random full-game sims + bot games
npm run build      # typecheck + production build (static files in dist/)
npm run smoke      # headless-browser boot check (run after a build)
npm run sim        # 10,000 headless color games, colour win-rate report
```

Simulation flags: `npm run sim -- --games 50000 --players 3 --powers
--specials --scoring fixed --size 8 --seed 42 --json out.json`. The same
report is available in-app via ⚗ SIMULATE on the setup screen (runs in a
Web Worker with progress + cancel). Read `lead win%` against the baseline
(1 / players): above it means playing that colour more went with winning
more.

Windows note: run these in **cmd.exe** (PowerShell blocks npm scripts by
default unless you loosen its execution policy).

## Tuning between playtests

- **`src/data/config.ts`** — every global number: starting money, hand size
  (refill-to-5), influence supply, symbol match values, double-match bonus,
  tie divisor, final-turn count, bot pacing — **plus** `SYMBOL_VP` (what
  each symbol scores).
- **`src/data/cards.json`** — the 60 cards: costs, **edge symbols**
  (per-card, thematic to the name, doubles allowed), effect parameters,
  rules text. Point values are NOT stored — a card is worth the sum of its
  two symbols' `SYMBOL_VP`. Set `"disabled": true` on any card to bench its
  effect mid-playtest (stays in the deck; can't be deployed; Ongoing stops
  working).

## Rules cheat-sheet (current build)

- Card VP = its two symbols: credit/intel/favor **1**, whisper **2**,
  muscle **3** (muscle/whisper cards are 5-point prizes; favor/favor is 2).
- Symbols are per-card, matched to the card's name; doubles are common.
- Both halves of your placement matching ⇒ **+$1**.
- End of turn: always draw back up to **5**.
- ⚡ = Instant (resolves on deploy) · ⟳ = Ongoing (sits in your tableau).

## Playtest telemetry

STATS tab (right panel): matches per symbol, influence added/removed/moved,
fizzles, money per source (incl. "Double match"), deploys vs placements,
enclosures, turn count, live scores. **⬇ DUMP JSON** downloads the full dump
(config + telemetry + plain-language log) for offline analysis.

## Controls

- Click a hand card's **⌗ place**, move the ghost on the grid, **R** rotates,
  click to confirm, **Esc** cancels. Matching edges are flagged before you
  commit, with the effect preview in the bottom-left box.
- **▲ deploy $x** pays and resolves an effect (⚡) or adds it to your tableau
  (⟳). Max one deploy per turn, before or after placing.
- Targeting prompts appear top-center; highlighted cards on the grid are
  clickable directly.
- **⎌ UNDO** steps back through every action (skips back over bot moves).
- Grid: drag to pan, wheel to zoom. Grid cards: big icon = type, name runs
  along the card's side, edge symbols sit at the two outer ends.
- 🤖 seats play themselves after a short delay; their hands stay hidden.
  Bots chase matches and enclosures (sealing cards they'd score, denying
  neutral ones) but stay intentionally beatable.
