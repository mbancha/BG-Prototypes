# Galax implementation decisions

1. **Blue is represented internally by the `Science` action color.** The prompt uses both labels for the same system category, so this avoids a fifth incompatible color.
2. **The initial map is twelve sectors, three of each color, with one planet each.** No current map asset/rules were present in the repository; the data shape deliberately permits replacing this without changing actions.
3. **The representative card rows are expanded into a 64-card deck.** The referenced current spreadsheet was not present. `cards.json` preserves every requested column and includes all specifically converted named cards that affect the initial engine.
4. **Supernova occurs after turn 24 for short prototype sessions.** The spec does not provide its trigger; this is exposed in config.
5. **A starting sector has one Fleet I and one Civ, consuming two of 15 tokens.** Starting placement was unspecified and this makes every player operational immediately.
6. **Commerce Civ construction currently chooses one planet per action.** The engine state supports system-level extension, but multi-select UI is deferred until the canonical map and planet spreadsheet are supplied.

## Not built
Secret battle-card commitment, every unique legacy card text, anomaly-specific movement graph effects, multi-planet Commerce activation, and production/exploitation flows require the absent legacy rules/map/spreadsheet. State seams and constants are present for iterative addition.
