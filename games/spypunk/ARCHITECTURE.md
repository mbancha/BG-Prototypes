# ARCHITECTURE.md — orientation for whoever edits this next (human or AI)

This file replaces the conversation that produced the codebase. Read it top to
bottom once and you can make any change the designer asks for. Companion
files: **DECISIONS.md** (rules judgment calls), **README.md** (run/tune/dump).

---

## 1. What this is

A hotseat digital playtest prototype of **SPYPUNK**, a competitive card game
for 2–4 players (any seat can be a simple bot). Vite + React + TypeScript
single-page app; no backend, no persistence — all state is in-memory
snapshots. It exists so the designer can play, tweak numbers, and export
telemetry between sessions. Code favors *editability over polish*.

It now contains **two selectable game modes** (setup screen):

- **CLASSIC** — the full ability game described in §2 below.
- **COLOR GROUPS** — a stripped-down core experiment described in §2b:
  no abilities/money/prompts; color dominoes form contiguous groups that
  score only when fully sealed. Its whole engine is `src/color/engine.ts`
  and its whole UI is `src/ui/ColorScreen.tsx`, deliberately isolated so
  either mode can be forked or deleted without touching the other.

## 2. The game, as implemented

- **Deck:** 60 unique cards (`src/data/cards.json`), one copy each, shuffled
  once. No reshuffle. Each card is a **domino**: two grid cells, top half and
  bottom half, each half showing one edge **symbol**.
- **Symbols are per-card**, stored in cards.json and hand-picked to fit the
  card's *name* (Silent Needle = muscle/whisper, Margin Call =
  credit/credit, …). The same symbol on both halves is common; the card's
  *type* is flavor plus a hook for type-referencing effects (Union Boss,
  Wingman) — it does NOT determine symbols.
- **Card points are derived, not stored:** `pts = SYMBOL_VP[top] +
  SYMBOL_VP[bottom]` where credit/intel/favor = 1, whisper = 2, muscle = 3
  (`SYMBOL_VP` in config.ts, applied in `src/game/cards.ts`). Editing a
  card's symbols in cards.json therefore also changes its score value.
- **Turn:** optional **deploy** (pay cost; ⚡ Instant resolves once, ⟳ Ongoing
  sits in your tableau), mandatory **place** one card from hand onto the grid
  (must touch an existing card; the very first card covers the origin), then
  **end turn** — you *always* draw back up to your hand size
  (`CONFIG.HAND_REFILL`, 5).
- **Placement resolution:** your placed card enters with 1 of your influence
  (`BASELINE_INFLUENCE`). Each outer edge of your domino that touches a
  neighbor showing the **same symbol** triggers that symbol's match effect
  (muscle removes, intel adds to neighbor, favor adds to your card, credit
  pays $, whisper moves — base values in config). If **both halves** matched
  at least one neighbor each, you also gain **$1**
  (`DOUBLE_MATCH_BONUS`). Matches + any on-place triggers queue in a "hub"
  and the placing player picks resolution order.
- **Enclosure scoring:** when all cells around a domino are occupied, it
  scores: most influence on it wins its `pts` (ties split, rounded down —
  see DECISIONS 10–12), all tokens return to their owners' supplies.
- **Game end:** deck empties → every player gets `FINAL_TURNS_PER_PLAYER`
  more turns; rank by pts, then money, then influence on grid.
- **Influence is conserved:** each player owns `INFLUENCE_SUPPLY` (15)
  tokens total, on-grid + in-supply. Adds fizzle when the supply is empty.

### Rule changes from playtest rounds 2–3 (2026-07)

If a doc/test/comment contradicts this list, the list wins:

1. **Symbols are per-card and thematic to the card's name** (round 3 —
   this *reverted* round 2's type-fixed symbol pairs). Roughly random
   distribution; same-symbol doubles allowed.
2. Matching **both** of your placed card's symbols pays **$1**.
3. End of turn **always refills to hand size 5** (starting hand also 5).
4. ⚡ / ⟳ glyphs replace the words Instant / Ongoing in the UI.
5. **Card VP comes from its symbols** (1/1/1, whisper 2, muscle 3) — kept
   through the round-3 revert, so per-card symbols now mean per-card VP
   (muscle/whisper cards are 5-point targets, favor/favor cards are 2).
6. Grid cards render as: name along the side, enlarged type icon in the
   center (serves as the card's art), edge symbols at the outer ends.
7. **Bot seats**: any player can be a bot (setup screen toggle). Bots place
   for matches AND actively play enclosures: they seek seals they'd score,
   avoid gifting opponents a score, and sometimes seal neutral cards to
   deny them (more eagerly in 2-player). See `src/game/bot.ts`.

## 2b. COLOR GROUPS mode (the core experiment)

Rules: tiles are dominoes with a **color** per half (5 colors; every tile
two *different* colors; deck = all 10 pairs × `COPIES_PER_PAIR`). Same-color
halves that touch form contiguous **groups** (merging freely). When a
placed half joins an existing group, the placer adds influence to that
GROUP (`MATCH_INFLUENCE`); fresh singleton halves add nothing. A group
scores the moment **every cell around it is occupied** — most influence
takes the value, ties split, influence returns to supply. Turns are just
"place one tile" (auto-advance); groups left open at the end score per
`ENDGAME_OPEN_GROUPS` (default: nothing).

Board limit: see §2c — the same floating column/row cap both modes use.

Variant toggles (chosen per game on the setup screen, numbers in
`COLOR_CFG`):

1. **Group value: BY SIZE** — worth cells × `GROUP_SCORE_PER_TILE`.
2. **Group value: FIXED** — every group worth `GROUP_SCORE_FIXED`.
3. **★ bonus tiles** — colored tiles carrying bonus points on ONE half.
   +1 tiles are two different colors (both orientations per pair); +2
   tiles are one color on both halves (`BONUS_PLUS1`/`BONUS_PLUS2`). They
   match, merge and add the normal +1 influence like any tile; the bonus
   half additionally adds its points to its group's value at scoring.
   The deck is kept color-balanced (see `newColorGame`).
4. **Color powers** — a match ALWAYS adds the base +1; the color's rule
   then layers on top: green +1 more (net 2) · gold +2 value · violet also
   +1 to each group adjacent to the violet group · cyan pays the runner-up
   half · red also removes 1 (placer's choice) from a group adjacent to
   the matched red group.

Red is the one power that needs a choice, so it is the only thing in this
mode that parks an `s.pending` decision (`redQueue` holds pending red
groups; the placement finishes via `continuePlacement`/`finishPlacement`
once every removal is answered). Everything else resolves synchronously.
Bots answer red prompts and place greedily (match + seal-what-you'd-win,
avoid gifting, sometimes deny neutral groups) in `colorBotDecide`.

### Simulation mode

`src/color/sim.ts` exports `runSimulation({games, players, variant, seed})`,
a pure, seeded, DOM-free function that plays whole bot-vs-bot games and
aggregates telemetry — above all **win rate by colour played**: for each
colour it reports the win rate of whichever player placed the most of it
(`leaderWinRate`, compare to `baselineWinRate` = 1/players), the winners'
vs losers' average counts, and the points each colour's groups paid out.
Ties split win credit. Three front ends, all calling the same function:

- **UI** — the ⚗ SIMULATE button on the setup screen opens `SimPanel`,
  which runs it in a Web Worker (`sim.worker.ts`) with progress + cancel,
  so 10,000 games never freeze the page (~1.5 min at 2p/6×6).
- **CLI** — `npm run sim -- --games 10000 --players 2 --powers --specials`
  (`scripts/sim.mjs` loads the TS through Vite's SSR loader; `--json out`
  to save the raw numbers).
- **tests** — `tests/colors.test.ts` runs short simulations and asserts
  determinism and that seat win rates sum to 1.

Bot search is kept cheap enough for this: `legalPlacements` enumerates
candidates from the frontier (both orientations, so nothing is missed
despite tiles being two-colored) instead of scanning the board, seal
evaluation only visits groups adjacent to the two new cells, and cell-key
parsing is memoized.

## 2c. The board limit (both modes)

There is **no drawn board**. Cards/tiles may be played anywhere until the
layout *spans* the configured number of columns and rows, after which
nothing may extend it further. The cap is **relative**: it is measured
against the bounding box of what is already on the table (`state.extent`,
grown on every placement), so the first card pins nothing and the playable
region slides until the layout grows into it.

Shared helpers live in `src/data/config.ts` and are used by both engines:
`growExtent`, `cellWithinLimit` (could this cell ever be played?) and
`playableEnvelope` (the rectangle still in reach — what the UI draws as a
dashed box). Defaults come from `defaultBoardSize` (color: 4 + 1/player →
2p 6×6) and `defaultClassicBoardSize` (classic: 8 + 2/player → 2p 12×12,
generous because classic's 60-card deck wants ~120 cells; shrink it on the
setup screen to make space a real constraint).

Two consequences, identical in both modes:

- **Unplayable cells seal.** A cell that would over-span the limit can
  never be filled, so `openPerimeter` (color) and `isEnclosed` (classic)
  treat it exactly like an occupied neighbour — cards and groups at the
  edge of the span close with fewer tiles. This is sound because the
  extent only grows: an unplayable cell can never become playable again.
- **Running out of room ends the game.** `hasLegalPlacement` is checked
  after the turn advances (so the opening "cover the origin" rule isn't
  still in force); classic also stops requiring the mandatory placement
  when nothing fits.

## 3. Module map

```
src/data/config.ts     every tunable number + SYMBOL_VP (symbol → points)
src/data/cards.json    the 60 cards: name/type/cost/top/bottom symbols/
                       kind/text/spec/disabled
src/game/types.ts      all state & data types; GameState is pure JSON-able data
src/game/cards.ts      loads cards.json, derives pts from symbols; glyph maps
src/game/grid.ts       domino geometry: rotations, matches, adjacency,
                       placement legality, enclosure detection
src/game/rules.ts      primitive mutations with ALL legality baked in:
                       add/remove/move token, money, draw, scoreCard
src/game/ongoing.ts    queries over tableaus: modifiers (Guild Mentor…),
                       protections (The Wall…), listeners, trigger lists
src/game/runtime.ts    the frame-stack machine (pump/pending/answer), the hub,
                       shared pickRemove/pickMove child frames, m_* matches
src/game/effects.ts    one handler per instant effect op (e_*) and per
                       ongoing trigger op (t_*)  ← START HERE to add effects
src/game/turn.ts       newGame + applyAction (beginTurn/deploy/place/endTurn/
                       answer), double-match bonus, enclosure frame, game end
src/game/bot.ts        botDecide(state) → next Action; decisionOwner helper
src/color/engine.ts    ENTIRE color-groups mode: rules + bot (see §2b)
src/color/sim.ts       headless simulation + colour win-rate telemetry
src/color/sim.worker.ts  Web Worker wrapper so the UI stays responsive
src/App.tsx            session = mode + snapshot array (undo), dispatch,
                       mode-agnostic bot driver
src/ui/*.tsx           SetupScreen (mode/variants/board limit/players) /
                       GameScreen / GridView / PendingPanel / SidePanel /
                       CheatSheet (classic rules reference, 📖 or "?") —
                       plus ColorScreen (whole color-mode UI in one file)
                       and SimPanel (simulation modal)
tests/engine.test.ts   targeted classic rules tests (forcePlace helpers)
tests/simulation.test.ts  24 seeded random full games, invariants each step
tests/bots.test.ts     all-bot seeded classic games + enclosure behavior
tests/colors.test.ts   color mode: grouping/merges/sealing/variants/powers,
                       bounded board, simulation + all-bot games
scripts/smoke.mjs      headless-Chromium boot-and-click check (needs build)
scripts/colorsmoke.mjs same for color mode: all-bot game, board fills up
scripts/simsmoke.mjs   board defaults + in-browser simulation run
scripts/sheetsmoke.mjs classic cheat sheet + classic limit control
scripts/sim.mjs        CLI simulation (npm run sim)
```

## 4. How state flows

1. UI (or bot driver) builds an `Action` and calls `dispatch` (App.tsx).
2. `dispatch` clones the newest snapshot (`structuredClone`) and runs
   `applyAction(clone, action)` — **the engine mutates the clone freely**.
   Error string → toast, clone discarded. Success → clone appended to
   `history`. Undo = drop the last snapshot (bots: keeps dropping until a
   human is on the clock).
3. Long effects run as **frames** on `s.exec` (see runtime.ts header for the
   handler protocol). When a frame needs input it fills `s.pending` and the
   engine stops; the UI renders it (PendingPanel / grid highlights) and sends
   the reply via `{a:"answer", ans}`. `s.pending.who` marks decisions that
   belong to a non-active player (Ransomware's victim).
4. Bots: `App.tsx` watches the newest snapshot; if `isBotTurn` it dispatches
   `botDecide(state)` after `BOT_DELAY_MS`. Bots emit the same Actions a
   human would — the engine can't tell the difference.

**Hard constraint:** everything inside `GameState` stays plain serializable
data (no classes/Maps/functions) — undo and the JSON dump depend on it.

## 5. Recipes

- **Tune a number** → `src/data/config.ts`. Card costs / effect magnitudes →
  `cards.json` spec fields. Dev server hot-reloads.
- **Change a card's symbols** → its `top`/`bottom` in cards.json (its VP
  follows automatically). **Change what a symbol scores** → `SYMBOL_VP` in
  config.ts.
- **Bench a misbehaving card mid-playtest** → `"disabled": true` in
  cards.json (stays in deck, effect off — DECISIONS 45).
- **Add a new card** → new entry in cards.json (unique id). Reuse an
  existing `spec` op if one fits (removeOne, addInf, move, money, modifier,
  listen, startOfTurn, onPlace…). New behavior → next bullet.
- **Add a new effect** → follow the step-by-step guide at the top of
  `src/game/effects.ts`. New ongoing *modifiers* instead get a key in
  `ongoing.ts` plus a query call at the rule point they alter.
- **Make bots smarter** → `scorePlacement` / `enclosureValue` / `botAnswer`
  in bot.ts only.
- **Verify** → `npm test` (unit + random sims + bot games), `npm run build`
  (typecheck), `npm run smoke` after a build for a real-browser pass.

## 6. Invariants the tests enforce

- Per player: `supply + tokens on board == INFLUENCE_SUPPLY`, money ≥ 0,
  hand ≤ `HAND_LIMIT`; scored cards hold zero influence.
- `cellOwner` map and `board` cells agree exactly.
- Every random/bot game terminates (< 6000 actions) with a ranking.
- Protections beat removals/moves (The Wall, Untouchable, Firewall, Bouncer
  — DECISIONS 15–18); locked/scored cards fizzle all influence changes.
