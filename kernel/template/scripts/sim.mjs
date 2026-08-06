// Headless simulation from the command line:
//   npm run sim
//   npm run sim -- --games 20000 --players 3 --size 8 --seed 42 --json out.json
//
// Loads the TypeScript sources through Vite's SSR loader, so there is no
// build step and it always runs exactly the code the app runs.

import { writeFileSync } from "node:fs";
import { createServer } from "vite";

const argv = process.argv.slice(2);
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
  const { runSimulation } = await server.ssrLoadModule("/src/sim/sim.ts");
  const { CONFIG, defaultBoardSize } = await server.ssrLoadModule(
    "/src/data/config.ts",
  );

  const playersN = +opt("players", 2);
  const size = +opt("size", defaultBoardSize(playersN));
  const games = +opt("games", CONFIG.SIM_GAMES);
  const res = runSimulation(
    {
      games,
      players: playersN,
      board: { width: size, height: size },
      seed: +opt("seed", CONFIG.SIM_SEED),
    },
    (done, total) => process.stdout.write(`\r  ${done}/${total}`),
  );
  process.stdout.write("\r".padEnd(30) + "\r");

  const pct = (v) => (v * 100).toFixed(1) + "%";
  console.log(
    `${res.games} games in ${(res.elapsedMs / 1000).toFixed(1)}s · avg score ${res.avgScore.toFixed(2)} · ties ${pct(res.tieRate)} · avg turns ${res.avgTurns.toFixed(1)}`,
  );
  console.log(`\nBY SEAT (baseline ${pct(res.baselineWinRate)})`);
  res.winRateBySeat.forEach((w, i) =>
    console.log(
      `  P${i + 1}  win ${pct(w)} · avg score ${res.avgScoreBySeat[i].toFixed(2)}`,
    ),
  );

  const totalPts = Object.values(res.pointsBySource).reduce((a, b) => a + b, 0);
  console.log("\nPOINTS BY SOURCE");
  for (const [src, v] of Object.entries(res.pointsBySource))
    console.log(
      `  ${src.padEnd(12)} ${(v / res.games).toFixed(2)} per game · ${pct(v / totalPts)} of all points`,
    );
  console.log("\nHOW GAMES ENDED");
  for (const [why, v] of Object.entries(res.endReasons))
    console.log(`  ${why.padEnd(12)} ${pct(v / res.games)}`);

  const json = opt("json", null);
  if (json) {
    writeFileSync(json, JSON.stringify(res, null, 2));
    console.log(`\nwrote ${json}`);
  }
} finally {
  await server.close();
}
