# Galax architecture

## Scope

Standalone Vite/React/TypeScript browser game, copied and diverged from the original Galax app. Current maturity: human-playable development playtest. See SOURCE_AUDIT.md and DECISIONS.md for source precedence and provisional interpretations. The prior twelve-sector ring, repeated 64-card sample deck, turn-24 Supernova and negative Civ scoring have been replaced.

## Rules and data

57 physical gameplay cards: 44 multi-use systems, 12 anomalies, one Super Nova. The four permanent zero cards and tableau references are UI components outside the shuffled deck. All system card text, color, rank, technology type and planet resources join to authored Dextrous images by stable c01–c44 IDs. Anomaly data is explicitly transcribed from the supplied faces. Technology effects are explicit TypeScript branches, not natural-language interpretation at runtime.

Plain JSON state owns a seeded RNG, setup, deck/discard/resolving zones, locations, fleets, Civs, pending decisions, battle commitments, effects queue, scores and telemetry. The public API is newGame / legalActions / applyAction. Rejected actions leave the supplied state unchanged; the app commits a fresh clone on success. Legal actions include pending decisions for the player currently on the clock, including opponents during combat or coercive effects.

## Space and interaction

The 2/3/4-player layouts reproduce the rulebook's staggered card arrangement. Logical card coordinates are independent of CSS pixel dimensions. Each location has six semantic waypoint keys; shared keys occupy both neighboring locations. Fleets belong to waypoints, not to an arbitrary single system. Civs and exploitation markers belong to individual planets. Movement crosses explored cards, checks enemy waypoint occupancy, blocks travel across nebulae, and connects wormholes to anomalies.

The browser renders authored cards with token overlays, highlighted legal locations/waypoints, selectable hands, enlarged card inspection and accessible structured text. The action tray filters engine-provided actions by family, selected card, location or waypoint and displays costs before confirmation. Multiple-Civ construction is one activation. Public technology inspection is available for every empire. Desktop and tablet layouts offer map zoom and internal scrolling.

## Privacy, replay and bots

playerView/publicView omit opponent hands, concealed card identities and planets, deck order, seed/RNG, execution queue and other players' secret commitments. The root app retains authoritative state locally: this is hotseat privacy, not a hostile-client security boundary. Native modal handoffs remove private cards from the DOM and trap focus during secret decisions.

Undo restores state and action history together. Versioned replay contains original setup/seed and all actions, and rejects illegal sequences. Full replay exports are explicitly labeled private. Load is available on setup and in-game. Basic deterministic heuristic bots rank the same legal actions as humans, using only projected public/own information. They receive no RNG state or deck order. Public per-turn movement visitation discourages cycling through free routes.

## Simulations

Headless runs use the same engine. A bounded action count reports censored/truncated games separately and excludes them from win and score denominators. Ties receive fractional win share. Preferred home colors rotate across seeds and seats; unavailable colors fall back to dealt cards. Reports include sample counts, mean points and win share by starting color and turn order, technology/discovery use, user-associated outcomes, explicit activation counters, point sources, action counts, combat, end reason, turn counts and per-game seed records. These are descriptive heuristic-bot results, not causal balance estimates.

## Module map

- src/data/cards.json: imported structured cards; src/data/config.ts: main tuning constants.
- src/game/model.ts: state, component and action types.
- src/game/spatial.ts: map layouts, shared waypoints and movement geometry.
- src/game/engine.ts: legality, transitions, explicit card effects, pending choices and invariants.
- src/game/views.ts: private/public projection seam.
- src/game/bot.ts: legal-action heuristic bot.
- src/game/presentation.ts: human labels and instructions.
- src/App.tsx: snapshots, undo, private handoff, replay and bot scheduling.
- src/ui/: setup, map/hand/action display, dialogs and downloads.
- src/sim/: DOM-free simulation and browser worker.
- scripts/: TTS importer, asset validation, browser journeys, CLI simulation and HTML reports.

## Change log

2026-09-21: Replace the prior representative scaffold with the source-backed spatial game, local Dextrous card faces, hotseat/private combat, unique effects, basic bots and shared-engine simulation. Existing top-level architecture work and other games were left untouched in the original checkout.
