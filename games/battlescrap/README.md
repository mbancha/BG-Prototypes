# Battlescrap
A local tabletop skirmish prototype using **holder-elements-v13**. Play Three Fires with three heroes per faction, or the four-hero shared-faction team test.

## Run
```powershell
npm.cmd ci
npm.cmd run dev -- --host 127.0.0.1
```
Open Vite’s local address. Choose human/bot, hotseat or watch bots. Bid, choose heroes, assign holder elements, purchase equipment, then deploy by clicking highlighted full hexes. Select a queue portrait to activate; select a piece and a highlighted hex to move, or choose Attack and a target. Click a tactic to choose its printed effect or a matching-element hero ability. Private hotseat handoffs hide both hands.

The in-app **How to play** reference explains the current rules. Export/import private saves or replays; these files contain hidden information. Older saves are rejected rather than reinterpreted.

## Sources of truth
- [Design Draft and Rules Quick Sheet](https://docs.google.com/document/d/1PlwHc5BWQdSv77xgSlSmNEiZIhgJ40cii22NKibvcFM): general rules; second tab is the quick reference and modifier table.
- [Hero spreadsheet](https://docs.google.com/spreadsheets/d/1hfWFhxm-Su-qtR_hVrzFt6GBW1ure8W4xmp1o8hF-Rg/edit): identities, stats, abilities, availability and regional wording.
- [Build Specification](https://docs.google.com/document/d/16-weAaDa4W7e4gC2jeiv_NN0cSAS_bcd_WATxPcDSAU): contracts, provisional rulings and acceptance.
- `src/data/hero-snapshot.json` is the implementation snapshot. `planning/` contains offline document readbacks.

## Checks
```powershell
npm.cmd test
npm.cmd run build
npm.cmd run assets
npm.cmd run sim
npm.cmd run smoke
```
Browser checks use installed Chrome by default; set CHROMIUM_PATH for another Chromium executable. Evidence and limits are in [VERIFICATION.md](VERIFICATION.md). Tests establish specified behavior, not balance.

Bisti’s new portrait remains a labeled placeholder. Incomplete regional heroes are unavailable. Team mode shares faction resources and control; separate networked seats and campaign travel/recruitment offers are future work. Existing print kit PDFs retain their historical rules and are not the current digital reference.
