> Portability audit, 22 October 2026: this file describes the older turn-rules-v8 digital implementation. Current design authority is starter-test-v11 in the live Drive documents. Read [START-HERE.md](START-HERE.md) before development. No digital rules update is authorized in this handoff.

# Battlescrap — Three Fires

Standalone digital tactical prototype built from the authored 19 October 2026 plan in `sources/`, using the supplied scenario raster.

Run `npm.cmd install`, then `npm.cmd run dev -- --host 127.0.0.1`. Open the address printed by Vite. `npm.cmd test` checks rules; `npm.cmd run build` compiles a portable static build; `npm.cmd run smoke` runs desktop/tablet browser journeys and automatic bot play. `CHROMIUM_PATH` may point to an installed Chrome/Chromium executable.

Choose human-vs-bot, two-human hotseat or watchable bots. Inspect the zones and bid, select an affordable three-hero army, assign one Fire/Lightning/Water holder each, shop, assign starting queue slots and deploy. Click a visible queue card to activate; click its piece and a marked destination to move. Select Attack for enemy targets or use an ability button. Click hand cards to inspect printed effects and the +1 AP alternate. Pending choices remain visible until resolved; optional effects can be skipped.

Autosave resumes pending choices. Export/import a save for portability. Private replay export contains the seed and complete action history; importing it reconstructs the match. Both file types reveal secrets. Undo is available only before an information reveal and pauses bots.

Current maturity: human-playable development scope, subject to recorded browser verification. Target: playtest release. All authored heroes, linked cards, tactics, objectives and equipment are implemented. Map edge acceptance, portrait approval, broader bot-policy tuning and an independent unfamiliar-player playthrough remain release work. Full campaign travel, regional-offer generation, print sheets and networking are outside the digital plan.

Read `DECISIONS.md` for provisional map and recruitment fixtures, `SOURCE_AUDIT.md` for counts, and `VERIFICATION.md` for observed checks rather than assuming a clean build proves every rule correct.


## 20 October regional redesign — v5

The user’s supplied regional redesign supersedes the previous roster, cards and tactical objectives. Current/target maturity remains human playable / playtest release. Ten heroes and twenty linked cards now cover Windlands, Highholm, Cinder’s Rim, Timberwood and Port Windlass. Each starter roster includes all five regions and main jobs; the two heroes of each region have different main roles. Kalawi’s counterpart is Niala, Controller/Support (confirmed by user). Regions do not permanently lock allegiance.

Baseline tactics: 6 attack-favored, 6 defense-favored, 2 extra-wound, 2 counterattack, 1 cleanse, 1 queue-Dazed. Exposure counts: 3/3/2/2/1/1. Both have equal suit counts and retain matching-suit +1 AP. Six effects use ten suit-specific definitions (30 Battle card definitions including abilities).

Engine additions: pre-activation queue snapshots, Kalawi’s activation-latched ambush, direct swaps, temporary defense, Ketu’s Dazed conversion, temporary fire/timber edges, counterattack decisions and cumulative combat objective records. Fire crossings affect both sides at most once per unit per activation; swaps cross no edges. Terrain expires at its source’s next activation or defeat. Timber blocks travel/melee/Push and grants directional ranged cover. No Burning status or sight-blocking rule was added. All new decisions serialize and are handled by the GUI and bots.

Riposte is committed before defense and grants one optional free return attack after a block, if normal range permits. No counterattack chains or stacked Riposte on one defense. Negative-status cleanse removes all Dazed/Stunned and preserves Boosted; Haste/Slow are immediate shifts. Wrong Foot compares the captured pre-selection queue, with recruits using their group tile. These timing details are explicit TEST interpretations.

Objectives count eligible attacks and defenses, including enemy-turn defense/counterattacks; no control, deployment-zone or pickup predicates remain. Push contests and fire wounds never count. Only Press the Advantage resets its success window each activation; other progress persists while held. Trade Blows requires the same hero alive at claim. Rewards/privacy/hand limits stay unchanged.

Costs remain provisional whole player prices, with private half-point estimates. At 40 PP, A has 10/10 affordable triples and B 5/10; card valuation is still excluded. Pair seat/zone/roster swaps before claiming balance. Version regional-redesign-v5 rejects earlier saves because h01–h10 now identify revised characters.

Existing portrait assets are preserved as historical concepts, but hidden in the current GUI; temporary hero initials and region labels identify the new roster until new art is commissioned. This is an explicit release gap, not finished art. No deployment or publication was performed.
