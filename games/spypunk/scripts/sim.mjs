// Headless color-groups simulation from the command line.
//
//   npm run sim                          10,000 games, 2 players, defaults
//   npm run sim -- --games 50000 --players 3 --powers --specials
//   npm run sim -- --scoring fixed --size 8 --json out.json
//
// Flags: --games N  --players N  --size N (or --width/--height)
//        --scoring size|fixed  --specials  --powers  --seed N  --json FILE
// Loads the TypeScript sources through Vite's SSR loader, so there is no
// build step and it always runs the same code the app does.

import { writeFileSync } from "node:fs";
import { createServer } from "vite";

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const opt = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? def : argv[i + 1];
};

const server = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error",
});

try {
  const { runSimulation } = await server.ssrLoadModule("/src/color/sim.ts");
  const { defaultBoardSize, COLOR_CFG } = await server.ssrLoadModule(
    "/src/data/config.ts",
  );

  const players = +opt("players", 2);
  const size = +opt("size", defaultBoardSize(players));
  const variant = {
    scoring: opt("scoring", "size"),
    specials: flag("specials"),
    powers: flag("powers"),
    width: +opt("width", size),
    height: +opt("height", size),
  };
  const games = +opt("games", COLOR_CFG.SIM_GAMES);
  const seed = +opt("seed", COLOR_CFG.SIM_SEED);

  process.stdout.write(
    `simulating ${games} games · ${players}p · ${variant.width}x${variant.height} · ${variant.scoring}` +
      `${variant.specials ? " · stars" : ""}${variant.powers ? " · powers" : ""}\n`,
  );

  const res = runSimulation({ games, players, variant, seed }, (done, total) => {
    process.stdout.write(`\r  ${done}/${total}`);
  });
  process.stdout.write("\r".padEnd(30) + "\r");

  const pct = (v) => (v * 100).toFixed(1).padStart(5) + "%";
  console.log(
    `\n${res.games} games in ${(res.elapsedMs / 1000).toFixed(1)}s · avg score ${res.avgScore.toFixed(2)} · ties ${pct(res.tieRate)}`,
  );
  console.log(
    `avg tiles placed ${res.avgPlacements.toFixed(1)} · groups scored ${res.avgGroupsScored.toFixed(1)} · empty seals ${res.avgEmptySeals.toFixed(1)}`,
  );
  console.log(`\nWIN RATE BY COLOUR PLAYED (baseline ${pct(res.baselineWinRate)})`);
  console.log("  colour    lead-win     Δ   win-avg  lose-avg   pts/plr  share");
  for (const c of res.byColor) {
    const d =
      c.leaderWinRate === null ? null : c.leaderWinRate - res.baselineWinRate;
    console.log(
      `  ${c.name.padEnd(8)} ${c.leaderWinRate === null ? "    —" : pct(c.leaderWinRate)} ` +
        `${d === null ? "    —" : ((d >= 0 ? "+" : "") + (d * 100).toFixed(1)).padStart(5)} ` +
        `${c.winnerAvgPlaced.toFixed(2).padStart(9)} ${c.loserAvgPlaced.toFixed(2).padStart(9)} ` +
        `${c.avgPtsFromColor.toFixed(2).padStart(9)} ${pct(c.ptsShare)}`,
    );
  }
  console.log("\nBY SEAT");
  res.winRateBySeat.forEach((w, i) =>
    console.log(
      `  P${i + 1}  win ${pct(w)} · avg score ${res.avgScoreBySeat[i].toFixed(2)}`,
    ),
  );

  const jsonPath = opt("json", null);
  if (jsonPath) {
    writeFileSync(jsonPath, JSON.stringify(res, null, 2));
    console.log(`\nwrote ${jsonPath}`);
  }
} finally {
  await server.close();
}
