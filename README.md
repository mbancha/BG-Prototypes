# Board game prototypes

Playable digital prototypes for tabletop games in design. Each game is a
self-contained hotseat app (2–4 players, one device, optional bot seats)
built to answer rules questions fast: change a number, reload, play, export
the numbers, repeat.

```
games/spypunk/     SPYPUNK — domino placement, influence, enclosure scoring
                   (+ a stripped-down color-groups mode and a 10k-game simulator)
kernel/template/   starting point for a new prototype — copy it to games/<name>/
.claude/skills/    the prototyping playbook Claude follows in this repo
```

## Running a game

Everything runs **inside a game folder**, not the repo root. On Windows use
**cmd.exe** (PowerShell blocks npm scripts by default):

```bash
cd games/spypunk
npm install        # once per clone
npm run dev        # → http://localhost:5173
```

Other scripts (same folder): `npm test`, `npm run build`, `npm run sim`
(headless bot games + telemetry), `npm run smoke` (browser check).

To get the latest changes: `git pull` from the repo root. If the dev server
is running, Vite hot-reloads the moment the files land — no restart.

## Starting a new prototype

Copy `kernel/template/` to `games/<your-game>/`, rename it in
`package.json` and `index.html`, then `npm install && npm run dev`. It boots
as a working (if pointless) tile-laying game with undo, hotseat pass
screens, bot seats, a seeded simulator and a telemetry dump already wired
up — replace the placeholder rules in `src/game/engine.ts`.

Fastest path in practice: write the spec (see
`.claude/skills/board-game-prototype/references/spec-template.md`), hand it
to Claude, and let it do the copy-and-build.

## Playtest links

Pushing to `main` builds every game and publishes it to GitHub Pages, so
playtesters get a URL instead of a toolchain. **One-time setup:** repo
Settings → Pages → Source: **GitHub Actions**. After that the games live at
`https://<user>.github.io/<repo>/<game>/`.

## Per-game docs

Each game folder carries its own:

- `ARCHITECTURE.md` — the rules as implemented, module map, recipes. Read
  this first when picking a game back up.
- `DECISIONS.md` — numbered rulings for everything the design spec left open.
- `README.md` — how to run and tune that specific game.
