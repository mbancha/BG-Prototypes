# Battlescrap — resume on another computer

Verified 22 October 2026. This folder contains the standalone digital prototype, current design readbacks, approved art, and current print kit. No chat history or files from the original computer are required. Current design is **digital-update-v12** (25 October 2026); application code remains **turn-rules-v8**. The live Build Specification, section 15, contains Sol’s next digital update plan and acceptance criteria. PnP is frozen at the existing revision.

## Sources of truth

- [Battlescrap hero spreadsheet](https://docs.google.com/spreadsheets/d/1hfWFhxm-Su-qtR_hVrzFt6GBW1ure8W4xmp1o8hF-Rg/edit): source of truth for hero identities, stats, costs, abilities, availability, regional abilities and hero-specific wording. Read all tabs immediately before coding and recheck before delivery. Use stable hero IDs and header names; the designer may rearrange columns and edit wording. Do not overwrite it from old manifests or code.
- [Design Draft](https://docs.google.com/document/d/1PlwHc5BWQdSv77xgSlSmNEiZIhgJ40cii22NKibvcFM): current general rules, refined world/region theme, TEST balance and open decisions. Hero data belongs to the spreadsheet.
- [Digital Prototype Build Specification](https://docs.google.com/document/d/16-weAaDa4W7e4gC2jeiv_NN0cSAS_bcd_WATxPcDSAU): digital implementation instructions and required regressions. Read the entire live document before the next update.
- [Game Drive folder](https://drive.google.com/drive/folders/1bG1iWyarj6E-Z0bPOh4x-9TX1_PcYJUF): keep all Google files here and visual uploads in its assets folder. The document simply titled Battlescrap contains original designer material; the consolidated Design Draft and Build Specification govern current implementation.
- planning/design-draft-current.txt and planning/build-spec-current.txt are connector readbacks refreshed on 25 October, for offline reference. They can become stale; refresh from live documents after further design changes.
- sources/, ARCHITECTURE.md, DECISIONS.md, SOURCE_AUDIT.md and VERIFICATION.md describe the older implemented game. They preserve its behavior and evidence, and do not override live design.

Keep general design in the Design Draft, digital planning in the Build Specification and hero data in the linked Battlescrap spreadsheet. Local data/manifests are implementation snapshots. The source-revisions file identifies the latest document readbacks; live sources take precedence.

## Laptop setup

Install Git and Node.js 22 LTS or newer, sign into GitHub with repository access, then:

```powershell
git clone --branch codex/battlescrap-laptop-handoff https://github.com/mbancha/BG-Prototypes.git
cd BG-Prototypes/games/battlescrap
npm.cmd ci
npm.cmd run dev -- --host 127.0.0.1
```

Open the address printed by the development server. On macOS/Linux use npm in place of npm.cmd. Work from the named branch until the handoff is merged; a default-branch clone may not contain Battlescrap. Sign into the Google account that can access the linked documents. Codex/other assistant account connections and local tools must be set up on the laptop; credentials are intentionally not stored here.

For checks: npm.cmd test, npm.cmd run build, npm.cmd run assets, and npm.cmd run sim -- 50. Browser checks also require Chrome/Chromium and CHROMIUM_PATH set to its executable, then npm.cmd run smoke. Existing browser scripts default to the standard Windows Chrome path. The game is standalone; no root install or other game is needed to run it.

Existing match saves live in browser storage and are not in Git. Export any match you want from the old browser using the game's save controls, then import it on the laptop. Old saves belong to the older digital rules and may become incompatible after an update.

## Current direction and next digital update

Read both live documents and the hero spreadsheet. Section 15 of the Build Specification plans the complete v8 → v12 migration, not just the latest delta. It covers six hero queue slots with AP/RAP 1/1, 2/1, 3/1, 3/2, 4/3, 5/2; 15-PP preparation; updated recruits; Focus; per-winning-six rewards; owner-turn Poison and heal-plus-cleanse; 15-VP asymmetric fire scoring; six new objectives; seven tactic effects in one shared 27-card deck (9 per element: two +2 Attack dice, two +2 hit damage, one of each other effect), with shared draw/discard piles and private hands; Cancel covering tactic effects and ability payments; Enraged on every damage transition to exactly 1 HP; Heavy Attack(x) replacing the old mode; keywords; and the revised digital presentation/reference.

The designer supplies final hero ability wording in the spreadsheet. Read its current costs, effects and Notes together; ask about internal conflicts instead of restoring older values. General-rules TEST interpretations and OPEN decisions are labeled in the live docs. Resolve affected open decisions before implementing them.

This documentation pass does not implement or validate the new rules. Sol owns the code update and required tests, browser checks, deterministic replay and simulation evidence. Preserve stable IDs and private information. PnP sources, print assets, generated output, print manifests and print scripts are unchanged and out of scope. No public deployment is requested.

## Assets and print sources

- assets/heroes/approved-v9: ten approved existing portraits, including later recruits. Preserve these characters; do not regenerate them.
- assets/heroes/new-starters: Hester h11, Perrin h12, Demea h13, Ilex h14 and provenance.
- assets/factions: Concord maroon angular sun and Wildmoon sky-blue antler crescent. Ownership only, not ability elements.
- assets/maps: original supplied map and 21 October map. Current print build selects its intended map explicitly.
- planning/hero-refresh-v9/review.html: current ten-starter gallery. Its folder name is historical; links point to current root assets.
- public/: older installed digital assets, retained for the existing application. Original absolute paths in provenance manifests are historical attribution; packaged relative paths provide the usable files.
- print-and-play/current/Battlescrap-print-and-play.pdf: current 19-page print kit. COMPONENTS.md and manifest.json describe assembly and contents. Print Actual size, US Letter, single-sided.
- print-and-play/build_current.py and verify_current.py: regenerate/check the current kit. See its README and requirements.txt. Windows Arial is a documented font dependency; opening/printing existing PDFs does not require Python.

PORTABILITY-MANIFEST.json is the original 22 October package snapshot; its design-readback hashes predate the 25 October documentation update. Do not regenerate PnP to make that historical snapshot match. It records file sizes and SHA-256 hashes for packaged assets, current design snapshots and print files. Keep artwork cohesive, icons distinct in shape/color, and player components concise. Keep future visual masters under the game-root assets folder; avoid creating competing design/handoff documents.

## Spatial notation

CONFIRMED presentation standard: every number measuring board spaces uses {hex:x} in source text, including spreadsheet Move and Attack range values, movement allowances, targeting distances, exact ranges, Push/Pull and distance modifiers. Render it everywhere as a flat-top hex with black outline, cream background and centered black number. Keep action words and qualifiers (Move {hex:3}; within {hex:2}; exactly {hex:2}); omit redundant “spaces” after the icon. Dice, damage, HP, AP/RAP, prices, unit counts and queue positions are ordinary numbers. Use one shared token parser and vector icon across cards, tableaus, tooltips, prompts, logs, player references and future print exports. Parse numeric values from tokens at the content boundary; engine distances remain numbers. Provide accessible text such as “3 spaces”; never expose raw markup in player-facing output. Preserve this notation in exports, translating only at the renderer boundary. Future print work follows this standard when authorized; existing PnP outputs remain frozen.
