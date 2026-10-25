# Battlescrap continuation instructions

Read START-HERE.md first. Current general rules are digital-update-v12 in the live Design Draft; the live Build Specification section 15 contains Sol’s next implementation plan and acceptance criteria. The bundled application remains turn-rules-v8 until code is updated and verified.

The [Battlescrap spreadsheet](https://docs.google.com/spreadsheets/d/1hfWFhxm-Su-qtR_hVrzFt6GBW1ure8W4xmp1o8hF-Rg/edit) is the source of truth for hero identities, stats, costs, ability wording, availability and regional rules. Read Heroes, Regions and Rules & notes immediately before implementation and again before delivery. Match stable hero IDs and header names, not column positions. Do not overwrite the sheet from stale documents, print manifests or code. Capture a versioned implementation snapshot for deterministic saves/replay; flag internal sheet conflicts for the designer.

Keep general design in the linked Design Draft and digital instructions in the linked Build Specification. Keep Google files in the existing Battlescrap Drive folder and visual masters under assets/. This documentation update authorizes the plan; Sol owns the subsequent digital implementation. PnP files, print assets, generation scripts and outputs remain unchanged and out of scope. No public deployment is requested.

Before implementation, read the live sources, then ARCHITECTURE.md, SOURCE_AUDIT.md and DECISIONS.md for existing behavior. Preserve approved art and distinguish CONFIRMED decisions, TEST balance/interpretations and OPEN questions. Ask numbered clarification questions before substantial ambiguous rule changes. New designer rulings override historical source mirrors. Keep changes within Battlescrap.

Standalone commands are in START-HERE.md. Old tests do not validate v12 or balance. Update implementation records only after actual code changes and checks, and report evidence and limitations.
