# SPYPUNK — digital playtest prototype

Hotseat (2–4 players, one device) prototype of the SPYPUNK domino-placement
card game. Any seat can be a 🤖 bot (simple, functional AI for solo testing).
Vite + React + TypeScript, no backend, all state in memory.

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
```

Windows note: run these in **cmd.exe** (PowerShell blocks npm scripts by
default unless you loosen its execution policy).

## Tuning between playtests

- **`src/data/config.ts`** — every global number: starting money, hand size
  (refill-to-5), influence supply, symbol match values, double-match bonus,
  tie divisor, final-turn count, bot pacing — **plus** `TYPE_SYMBOLS` (which
  symbol pair each card type shows) and `SYMBOL_VP` (what each symbol scores).
- **`src/data/cards.json`** — the 60 cards: costs, effect parameters, rules
  text. Symbols and point values are NOT here — they derive from the card's
  type (config). Set `"disabled": true` on any card to bench its effect
  mid-playtest (stays in the deck; can't be deployed; Ongoing stops working).

## Rules cheat-sheet (current build)

- Card VP = its two symbols: credit/intel/favor **1**, whisper **2**,
  muscle **3** (so Assassin 5, Enforcer 4, Hacker 3, others 2).
- Symbol pairs are fixed per type; top ≠ bottom always.
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
