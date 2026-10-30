# Battlescrap architecture — holder-elements-v13
Verified against the current live sources on 30 October 2026. General rules live in the linked documents; this file describes implementation rather than duplicating them.

## Modules
- `src/data/config.ts`: tunable budgets, both queue curves, faction element pairs/colors, modifiers, rewards and upgrade cost.
- `src/data/hero-snapshot.json`: current Heroes/Regions/Rules & notes snapshot from the authoritative sheet, with source URL/date.
- `src/content.ts`: header-position snapshot adapter, ten complete starters, mirrored elemental tactic definitions, upgrades, objectives, equipment and calibrated full-hex map.
- `src/engine.ts`: serializable state, seeded RNG, authoritative actions/validation, bidding, setup, AP/RAP, combat, status/terrain resolution, effect/Cancel queues, objectives, campaign settlement/upgrades, projection, bots and replay.
- `src/icons.tsx`: shared red sword/bow, element silhouettes and rainbow generic icon, distance hexes, HP/status rendering.
- `src/App.tsx`: component interaction, private handoff, tableaus, queue, highlighted board targets, save/replay, undo barriers and automatic bots. `styles.css` and `update.css` own presentation.
- `src/simulation*`: worker-backed optional analysis; `scripts/` runs simulations, fixtures, assets and browser acceptance.

## Contracts
`newGame(seed, config)` and `applyAction/dispatch(state, action)` form the engine API. `legalActions/actions` enumerates decisions for UI, bots and tests. Validate a clone before committing; rejected actions leave the input unchanged. All random choices use state RNG. Effects, multi-target movement, combat, response stacks and overflow are serializable. Saves are schema 2/version holder-elements-v13; incompatible versions are rejected.

State separates faction draw/discard/hand piles, objective deck, per-game holder elements, AP/RAP, hero action counters, shared Recruit counters, ongoing tokens, five statuses, modifier/Wind state, permanent Xs, traps/stones and persistent campaign RP/wins/upgrades. Cards have stable instance IDs and one owning faction zone. PP/RP use integer half-units; other numeric resources use native integers.

A paid ability/tactic commits costs and opens a Cancel stack before effects. A shared effect queue pauses on real choices. Combat snapshots participating statuses at roll, resolves damage once, preserves new tokens, and stops on victory. Setup and terrain use the supplied 21 October map with partial hexes excluded.

`playerView` removes deck order, RNG/seed, bids, history, pending private effects and opponent hand/objective faces. Bot choice uses its projected view plus legal actions; no hidden-card lookups. Public discard counts remain visible. File exports are explicitly private.

## Current scope
Local 1v1 and shared-faction 1v2/2v2 tests, three/four heroes per faction, ten complete starter abilities, separate mirrored upgradeable decks, six modifiers on subsequent scenarios, full turn/combat/objective/reward migration. Regional recruits marked incomplete stay unavailable. Approved portraits are preserved; Bisti uses initials.

## Migration
30 October 2026: replaced the older turn-rules-v8 engine/content and UI rule descriptions with the full current rules. Removed linked hero cards, suit-for-AP discard, group queue cards, basic Push/Cleanse, old statuses, heavy attack halving and old objectives. Added the holder-element rules and current sheet abilities. Historical v8 fixtures are archived in `sources/tests-v8/`; current regression coverage is in `tests/current.test.ts`.
