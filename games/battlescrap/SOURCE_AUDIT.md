# Source audit
Checked 30 October 2026.

- **General rules:** live Design Draft, document 1PlwHc5BWQdSv77xgSlSmNEiZIhgJ40cii22NKibvcFM; its second tab is the Rules Quick Sheet with a native d6 modifier table.
- **Implementation specification:** live document 16-weAaDa4W7e4gC2jeiv_NN0cSAS_bcd_WATxPcDSAU.
- **Hero authority:** live spreadsheet 1hfWFhxm-Su-qtR_hVrzFt6GBW1ure8W4xmp1o8hF-Rg, Heroes, Regions and the card-content tabs. Re-read after implementation: current starter values/effects agree with the implementation snapshot. Later hero rows are incomplete and not implemented.
- **New instructions:** red sword/red bow, Port Cutlass, holder-determined elements, mirrored upgradeable faction decks, six battlefield modifiers, concise bulleted references and the four-hero queue endpoints are implemented. Defaults are labeled TEST in DECISIONS.md and the live Build Specification.
- **Map/art:** supplied 21 October raster calibrated to full hexes; approved existing and four new starter portraits retained; Bisti explicitly uses initials. Faction raster masters preserved. New element and attack icons are vector assets.
- **Offline readbacks:** planning/design-draft-current.txt, planning/build-spec-current.txt, planning/rules-quick-sheet-current.txt and planning/source-revisions.json. Refresh these after live edits.
- **Historical scope:** sources/ and print-and-play/ preserve earlier mechanics. They cannot override the current live sources or certify current rules. The older test suite is archived as text; current regression fixtures replace obsolete behavior expectations.

30 October 2026 v15: live Heroes values checked; all 15 HP values are within 3–6, and incomplete regional heroes remain unavailable. Live Tactics A1:E30 captured in src/data/tactics.json with 28 definitions, nine copies per element. Obsolete rules-notes snapshot removed. Current map matches its 21 October master; approved-v9 originals copied to browser assets and Bisti uses her dedicated current file. Historical print outputs remain historical.
