# Battlescrap continuation
Read START-HERE.md, the repository AGENTS.md and prototyping skill. Current implementation is **shared-elements-v15**, schema 2.

The live Battlescrap spreadsheet is authoritative for hero identities, stats, costs, effects, availability and regional wording. Read Heroes, Regions and the card-content tabs before coding and before delivery. Match stable IDs and header names, preserve designer edits, and capture a versioned implementation snapshot. Flag conflicting sheet entries instead of silently substituting old values.

The Design Draft owns general rules and its Rules Quick Sheet tab is the concise player reference. The Build Specification owns contracts and acceptance. Keep Google files in the existing Battlescrap folder; approved art masters under assets/. Current implementation and source checks are documented in ARCHITECTURE.md, DECISIONS.md, SOURCE_AUDIT.md and VERIFICATION.md.

Keep games standalone. State and RNG must serialize; UI, tests and bots share authoritative legal actions. Preserve private hands, bids and deck order. Keep tunable values in src/data/config.ts and hero content in the snapshot. Current spatial text uses {hex:x}, rendered as a cream/black flat-top distance hex with accessible text. Hero abilities use first-person wording.

Label provisional rulings TEST and unfinished design OPEN. Ask numbered questions before substantial ambiguous rule changes unless the user has already authorized defaults. Preserve approved art and incomplete regional entries; do not present historical print PDFs as current. Do not publish publicly without scope.

Run tests/build, assets, simulation and current browser acceptance after relevant code changes. Record actual evidence and limits; tests do not certify balance or total absence of defects.
