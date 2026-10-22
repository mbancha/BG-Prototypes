# Battlescrap — resume on another computer

Verified 22 October 2026. This folder contains the standalone digital prototype, current design readbacks, approved art, and current print kit. No chat history or files from the original computer are required. Current design is **starter-test-v11**; application code remains **turn-rules-v8**. Continue design changes before updating the digital game.

## Sources of truth

- [Design Draft](https://docs.google.com/document/d/1PlwHc5BWQdSv77xgSlSmNEiZIhgJ40cii22NKibvcFM): all current rules, selected abilities, world/region direction, TEST balance, and open design decisions.
- [Digital Prototype Build Specification](https://docs.google.com/document/d/16-weAaDa4W7e4gC2jeiv_NN0cSAS_bcd_WATxPcDSAU): digital implementation instructions and required regressions. Read the entire live document before the next update.
- [Game Drive folder](https://drive.google.com/drive/folders/1bG1iWyarj6E-Z0bPOh4x-9TX1_PcYJUF): keep all Google files here and visual uploads in its assets folder. The document simply titled Battlescrap contains original designer material; the consolidated Design Draft and Build Specification govern current implementation.
- planning/design-draft-current.txt and planning/build-spec-current.txt are connector readbacks saved on 22 October, for offline reference. They can become stale; refresh from live documents after further design changes.
- sources/, ARCHITECTURE.md, DECISIONS.md, SOURCE_AUDIT.md and VERIFICATION.md describe the older implemented game. They preserve its behavior and evidence, and do not override live design.

Keep design notes in the one Design Draft, digital instructions in the one Build Specification, and any future authoritative data reference in one game Google Sheet. No new authoritative data Sheet was created for this backup. Local data and manifests are implementation/build records.

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

Read both live documents afresh after the remaining design changes. At this snapshot: 15 PP, exactly three heroes plus three free recruits per side; six hero queue portraits with separate persistent tableau cards; AP and recruit-only RAP; selected single unique starter abilities; four statuses; generic elemental tactics; no element-assignment holders or linked ability cards. Seven regions exist; Highholm and Timberwood are later recruits. TEST values and campaign progression still require design/playtesting. The full documents define timing and exceptions.

The authoring work covers documents, art, and the current PnP; Sol retains digital implementation. Uploading the older prototype does not implement or validate the current design. Before coding, compare the installed v8 engine with the live Build Specification, update source audit/decisions, preserve stable IDs, and run its required regressions. Do not use the historical v9 options/handoff as a current selection list.

## Assets and print sources

- assets/heroes/approved-v9: ten approved existing portraits, including later recruits. Preserve these characters; do not regenerate them.
- assets/heroes/new-starters: Hester h11, Perrin h12, Demea h13, Ilex h14 and provenance.
- assets/factions: Concord maroon angular sun and Wildmoon sky-blue antler crescent. Ownership only, not ability elements.
- assets/maps: original supplied map and 21 October map. Current print build selects its intended map explicitly.
- planning/hero-refresh-v9/review.html: current ten-starter gallery. Its folder name is historical; links point to current root assets.
- public/: older installed digital assets, retained for the existing application. Original absolute paths in provenance manifests are historical attribution; packaged relative paths provide the usable files.
- print-and-play/current/Battlescrap-print-and-play.pdf: current 19-page print kit. COMPONENTS.md and manifest.json describe assembly and contents. Print Actual size, US Letter, single-sided.
- print-and-play/build_current.py and verify_current.py: regenerate/check the current kit. See its README and requirements.txt. Windows Arial is a documented font dependency; opening/printing existing PDFs does not require Python.

PORTABILITY-MANIFEST.json records file sizes and SHA-256 hashes for packaged assets, current design snapshots and print files. Keep artwork cohesive, icons distinct in shape/color, and player components concise. Keep future visual masters under the game-root assets folder; avoid creating competing design/handoff documents.
