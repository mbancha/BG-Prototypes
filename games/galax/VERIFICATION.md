# Verification — September 21, 2026

This is a human-playable development playtest, with provisional source rulings in DECISIONS.md. Tests establish executable behavior and component integrity; they do not establish that every ambiguous rule matches the designer's intent.

## Automated checks

- `npm run assets`: 62 unique authored faces, 57 gameplay mappings, 4.33 MiB of faces, file hashes and import coverage verified.
- `npm test`: 102 passing checks across engine, effects, copied kernel and mechanism examples. Includes deterministic complete-game replay, randomized legal-action invariants, all 44 system-card invention paths, multi-Civ construction and hidden battle commitments.
- `npm run build`: TypeScript and production Vite build pass. Assets and worker use relative paths for GitHub Pages.
- `npm run smoke`: 228 GUI actions from two-human setup to final scoring, then undo, replay reload, a five-game four-player worker simulation, and automatic bot progress. Checks private handoffs, missing card images, unnamed controls, browser errors and document overflow. Captures desktop 1440×900, tablet 1024×768 and 768×1024 screenshots, plus representative action and result views.
- Existing Spypunk: 44 tests and production build pass. Unchanged template/kernel: 57 tests and production build pass.

Desktop and tablet screenshots were inspected visually. The map has separate fleet/Civ overlays, legal highlights, zoom/fit, and enlarged full-card inspection. Tablet layouts stack the action panel and provide an internally scrolling hand. This is basic accessibility verification, not a full WCAG audit or physical-touch-device test.

## Simulation baseline

Reproduce with `npm run sim -- --games 100 --players N --seed 20260920 --json artifacts/simulation-Np.json`, replacing N with 2, 3 or 4. Each command writes JSON and HTML. All 300 games completed; none hit the 5,000-action limit. Invariants are checked after every action.

| Players | Completed | Truncated | Mean player turns | Super Nova / Culture / Hegemony |
|---|---:|---:|---:|---|
| 2 | 100 | 0 | 24.24 | 63 / 27 / 10 |
| 3 | 100 | 0 | 30.41 | 58 / 37 / 5 |
| 4 | 100 | 0 | 33.63 | 75 / 25 / 0 |

Starting-color win share (fractional credit for tied winners):

| Players | Blue | Green | Red | Yellow |
|---|---:|---:|---:|---:|
| 2 | 47.9% (48) | 55.8% (52) | 37.0% (50) | 59.0% (50) |
| 3 | 25.7% (70) | 30.8% (78) | 31.9% (72) | 43.8% (80) |
| 4 | 20.5% (88) | 27.8% (106) | 18.1% (108) | 33.7% (98) |

Parentheses contain player samples. These are small, policy-dependent, conditional samples: color selection still depends on dealt cards. Yellow performs best under this bot policy in this batch, but that is a lead for human playtesting, not a recommendation to rebalance. Technology-user outcomes likewise measure association rather than causal effect.

## Release gates and remaining limits

Pull requests run asset checks, tests, build, full GUI journey and a small four-player simulation, uploading evidence. The Pages workflow tests every game before building and requires the Galax GUI journey before publishing.

All 44 invention paths are exercised, but not every pairwise technology interaction or every combat scenario has browser coverage. Bots are basic heuristics. Several interpretations remain provisional; see DECISIONS.md. Hotseat and private replay are local cooperative tools, not secure network multiplayer. Phones are not a supported playtesting target.
