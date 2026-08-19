# Prototype automation: one-time setup and normal use

This repository is designed so the designer can provide a plain-English game
specification and receive a tested, deployable prototype. The coding agent owns
implementation, tests, browser verification, documentation, commits, and pull
requests.

## One-time GitHub setup

A repository administrator must perform these account-level steps once; an
agent cannot invent GitHub credentials or grant itself repository access.

1. Connect the workspace to this GitHub repository so `git remote -v` shows an
   `origin` URL.
2. Enable the workspace's GitHub/pull-request integration (`make_pr`) with
   permission to push branches and create pull requests.
3. In GitHub, open **Settings → Pages**, select **GitHub Actions** as the source.
4. In **Settings → Environments → github-pages**, permit deployments from
   `main`.
5. In **Settings → Actions → General**, allow GitHub Actions and grant workflows
   read/write permission where the hosting platform requires it.

If the workspace does not offer a `make_pr` integration, configure GitHub CLI
instead: provide a fine-grained `GH_TOKEN` with repository **Contents: read and
write** and **Pull requests: read and write**, add the repository as `origin`,
and tell the agent to use `gh pr create` after pushing.

## Normal designer workflow

Give the coding agent plain text such as:

> Build a new prototype called Example from this specification. Follow
> CLAUDE.md and the board-game-prototype skill. Make reasonable documented
> rulings where details are absent. Run the full verification command, inspect
> the browser screenshot, commit the changes, and create a pull request.

For an existing prototype, describe only the desired rule or UI change and add:

> Update tests and ARCHITECTURE.md, run full verification, inspect the browser
> screenshot, commit, and create a pull request.

## What automation now guarantees

`npm run verify` in `games/galax` runs unit/fuzz tests, the production build,
and a real headless-browser journey. GitHub verification runs in the official Playwright container, so CI does not
depend on downloading a browser during the job. Local verification uses the
Playwright browser installed on that machine. Pull requests and supported branch pushes repeat these checks
in `.github/workflows/verify.yml` and retain the browser screenshot as a build
artifact. Merging to `main` publishes every prototype through the existing
Pages workflow.

## Local commands (normally the agent runs these)

```bash
cd games/galax
npm ci
npm run verify
```

The smoke screenshot is written to `games/galax/artifacts/galax-smoke.png`.
