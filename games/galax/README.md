# GALAX — browser playtest

A standalone 2–4 player hotseat/bot game using the actual September 20 Dextrous card faces. Human-playable development maturity; source conflicts are documented in [DECISIONS.md](DECISIONS.md). See [SOURCE_AUDIT.md](SOURCE_AUDIT.md) for the imported content and verification boundaries.

## Play locally

From this directory:

```sh
npm ci
npm run dev
```

Use npm.cmd on Windows if PowerShell blocks npm scripts. Select 2–4 human/bot seats and a seed. Choose a home card, deploy your forces, then use the map and guided action panel. Click a card's inspection button for the readable full face and structured text. The in-game rules reference describes the implemented edition and rulings.

## Build and verify

```sh
npm run browser:install
npm run verify
```

Set CHROMIUM_PATH to an existing Chromium executable if needed. Build output is dist/. Vite uses relative assets, so the existing repository Pages workflow publishes it at /BG-Prototypes/galax/. No server, secrets, Dextrous connection or spreadsheet connection is needed while playing. The original working checkout's uncommitted top-level upgrade is not part of this change.

## Simulate

```sh
npm run sim -- --games 100 --players 2 --seed 20260920 --json artifacts/simulation-2p.json
npm run sim -- --games 100 --players 3 --seed 20260920 --json artifacts/simulation-3p.json
npm run sim -- --games 100 --players 4 --seed 20260920 --json artifacts/simulation-4p.json
```

Each command writes JSON and a readable HTML report. The setup screen's Simulation lab runs in a background worker and downloads JSON. Reports include starting-color points/win share, sample counts, turn-order results, technologies/discoveries used, associated outcomes, score sources, actions, combat and completion statistics. They are basic-bot diagnostics rather than proof of competitive balance.

## Refresh cards

Add Python 3.10+ and Pillow to a local environment, export TTS JSON after syncing Dextrous, and save the matching bounded spreadsheet values as JSON with a values array (header plus c01–c44 rows).

```sh
python scripts/import-dextrous.py --tts path/to/export.json --sheet path/to/cards-sheet.json
npm run assets
```

Review the images and structured data together. The importer crops sprite cells using each deck's NumWidth/NumHeight and CardID mapping, joins via Nickname, and saves local WebP faces with hashes and copy counts. It does not execute export scripts. Anomaly metadata is explicitly transcribed and must be reviewed if the anomaly faces change. Bearer image URLs and raw personal design notes are ignored by Git.

## Save and resume

Use Save / replay to export a versioned full replay; load it from setup or in-game. Full replays reveal hidden information, so share after a game or with player agreement. Undo rewinds both state and action history. Local hotseat privacy does not protect against someone inspecting the browser's runtime memory.
