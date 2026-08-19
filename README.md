# Board game prototypes

Playable digital prototypes for tabletop games in design. Each game is a
self-contained hotseat app (2–4 players, one device, optional bot seats)
built to answer rules questions fast: change a number, reload, play, export
the numbers, repeat.

```
games/galax/       GALAX — 2–4p space-civilization Science prototype
games/spypunk/     SPYPUNK — domino placement, influence, enclosure scoring
                   (+ a stripped-down color-groups mode and a 10k-game simulator)
kernel/template/   starting point for a new prototype — copy it to games/<name>/
.claude/skills/    the prototyping playbook Claude follows in this repo
```

The template carries a **kernel** of board-game primitives — turn flow
(phases, action points, passing, simultaneous play), zones (decks, hands,
markets, supplies, reshuffles), board topologies (fixed grid, open grid, hex,
point-to-point map, track), player decisions, resources, scoring, and a
random-play fuzzer. It is copied into each game, not shared, so a prototype
can diverge as hard as it likes. `kernel/template/tests/mechanisms.test.ts`
has a runnable micro-game for each mechanism family, from tic-tac-toe to a
Through-the-Ages-shaped civ engine.

## Running a game

Everything runs **inside a game folder**, not the repo root. On Windows use
**cmd.exe** (PowerShell blocks npm scripts by default):

```bash
cd games/spypunk
npm install        # once per clone
npm run dev        # → http://localhost:5173
```

Other scripts (same folder): `npm test` (unit + fuzz + replay), `npm run
build`, `npm run sim` (headless bot games + telemetry), `npm run smoke`
(browser check).

To get the latest changes: `git pull` from the repo root. If the dev server
is running, Vite hot-reloads the moment the files land — no restart.

## Starting a new prototype

Copy `kernel/template/` to `games/<your-game>/`, rename it in
`package.json` and `index.html`, then `npm install && npm run dev`. It boots
as a working (if pointless) tile-laying game with undo, hotseat pass
screens, bot seats, player prompts, a seeded simulator, replay-from-seed and
a telemetry dump already wired up — replace the placeholder rules in
`src/game/engine.ts` and delete the kernel modules you don't need.

Fastest path in practice: write the spec (see
`.claude/skills/board-game-prototype/references/spec-template.md`), hand it
to Claude, and let it do the copy-and-build.

## Playtest links

Pushing to **`main`** builds every game and publishes it to GitHub Pages, so
playtesters get a URL instead of a toolchain:

<https://mbancha.github.io/BG-Prototypes/>

Every other branch **builds but does not publish** — a work-in-progress
branch can't overwrite the link you gave a playtester. Merge to `main` when
you want the site updated.

Pages is already configured (Settings → Pages → Source: **GitHub Actions**),
and the `github-pages` environment is set to **No restriction** under
Settings → Environments → Deployment branches. That second setting matters:
enabling Pages pins whatever branch was default at the time, and it does not
follow a later default-branch change — a deploy from a branch it doesn't
allow fails in about a second with no runner and no log.

Don't add a second Pages workflow: the "Configure" buttons on the Pages
settings page offer to write a Jekyll one, and two workflows publishing to
Pages fight over the same site.

## Per-game docs

Each game folder carries its own:

- `ARCHITECTURE.md` — the rules as implemented, module map, recipes. Read
  this first when picking a game back up.
- `DECISIONS.md` — numbered rulings for everything the design spec left open.
- `README.md` — how to run and tune that specific game.

## Automation

See [`AUTOMATION.md`](AUTOMATION.md) for the one-time GitHub setup and the plain-language workflow for requesting, testing, reviewing, and publishing prototypes.
