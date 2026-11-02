# Verification — holder-elements-v13
Checked 30 October 2026. Content/save schema 2. Source authority and provisional rulings are recorded in SOURCE_AUDIT.md and DECISIONS.md.

## Automated rules and build
- **65 current tests passed**, including all six/eight queue entitlements/endpoints, separate/shared action costs, RAP spending, no respawn reset, opposed dice/ties/zero pools, status snapshots, last-HP/Heat, healing/Poison, hero-only death rewards, Cancel-on-Cancel, all ten starter abilities, objective positive/near-miss cases, every modifier, upgrades, card conservation, rejected-action atomicity, privacy and deterministic replay.
- Current invariant walks test random legal choices interleaved with the projected-view bot, checking occupancy, resources and card uniqueness after each command, then exact replay.
- **Production build passed**: TypeScript plus Vite, 40 modules.
- **Asset check passed**: current map, nine approved current starter portraits, explicit Bisti initials placeholder and eleven new vector icons. Approved faction masters are copied for the browser.
- **Diff whitespace check passed** after normalizing changed text files.

Commands: `npm.cmd test`, `npm.cmd run build`, `npm.cmd run assets`.

## Seeded full matches
`npm.cmd run sim`: **50 completed matches**, 25 paired seeds with starter rosters and deployment preference swapped; **0 unfinished/stalled**, including **10 four-hero games**. Scenario 2 runs cover **Heat, Snow, Storm, Wind, Plague and Moonfall**. Mean **21.62 activations**; largest observed hit **9 damage**. Resource/occupancy/faction-card invariants run throughout; initial paired cases replay exactly.

Seeds 1–25, two seat/zone variants per pair, rotating omitted element pair, same equipment/team setting within each pair. Full rows/config are generated in `artifacts/simulation.json`. These are heuristic-bot implementation checks, not measured human balance. No balance claim follows from completion or observed burst damage.

## Browser acceptance
`npm.cmd run smoke` passed using installed Chrome against the production build:
- **Desktop 1440×1000 and tablet 820×1180**: secret bidding/privacy, roster selection, equipment preparation availability, full-hex deployment/overflow, six-card queue, six persistent tableaus, activation, piece selection/movement, undo, tactic inspection, red ranged icon, end turn and concealed private faces.
- Saved **combat** and **Cancel** decisions import/resume; roll and resolution complete without errors.
- Saved **objective claim**, **RP tactic upgrade**, settlement and next-scenario modifier pass.
- Automatic **4v4 bot** game completes with eight queue cards.
- **No browser page/console errors; no horizontal page overflow** at either size.

Report: `artifacts/browser-report-current.json`; inspected screenshots: `desktop-battle-current.png`, `tablet-battle-current.png`, plus combat/setup captures. Manual Edge checks also covered setup, hotseat, deployment, activation, movement/undo, sheet wording and the native Docs quick sheet/modifier table. The Edge extension’s file-upload capability was unavailable; the ordinary application import was independently exercised by the automated Chrome suite without changing browser permissions.

## Map and documents
Compared full-hex sample centers to the supplied 21 October raster: exactly **five full blue hexes** and **eight full stone hexes**, including the isolated southeast stone hex. Partial hexes are excluded; extra north deployments use legal overflow. X and fire coordinates remain separate from shuffled trap/stone contents.

Live Docs readback confirms native bullets/bold labels, current element/deck wording, the endpoint-preserving eight-slot curve and a native six-result modifier table. The table was visually checked for wrapping/width. Live sheet readback agrees with the current starter snapshot; local spreadsheet export refreshed. Current text sources use Port Cutlass.

## Limits
Bisti’s final portrait is not supplied. Incomplete regional recruits and campaign travel/offers remain unavailable. 1v2/2v2 uses shared faction control and hand, not networked individual seats. Historical print PDFs retain earlier rules; the current quick sheet is the Design Draft’s second tab and the in-app reference. New balance choices remain labeled TEST. No independent unfamiliar-player session or proof of perfect balance/absence of every defect is claimed.

## shared-elements-v15 — 30 October 2026
Implemented locally; no public deployment. 68 current Vitest tests pass, including shared card conservation, deterministic replay, hero-only pickup, random assignment and rejection of tactic upgrade actions. Production TypeScript/Vite build and current asset validation pass. Fifty paired seeded simulations completed with zero unfinished games, all six modifiers, ten four-hero games, mean 16.52 activations; largest observed hit 7. These runs establish completion/invariants, not balance.

The current browser smoke is scripts/current-ui-check.mjs (npm run smoke). Human/bot bidding, roster lock, deployment, automatic bot response, save import, eight-card hand and ALT card/hero inspection were exercised at 1366×768, 1920×1080 and 1024×768. All three showed viewport-sized document width/height and no script errors. Actual full-hand and hero-inspector screenshots under artifacts/v15-* were opened and inspected. Damage, Focus, Poison and active ability marker rendered from imported current state. ALT release dismissed inspection. Historical smoke evidence below/above is not evidence for v15; the previous broader hotseat journey was not rerun in full. Privacy, pending responses, undo/replay and objective boundaries remain covered by current engine tests.

Source and portability: runtime tactics come from the dated live Tactics snapshot. Browser copies of original heroes match approved-v9 masters; Bisti uses her dedicated identity-correct portrait. Historical print PDFs were not regenerated. Prior-content saves are rejected. At small widths, short card summaries use ALT/full-card inspection for long text; the decision sidebar can scroll internally when expanded.
