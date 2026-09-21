import { reportHTML } from "./report.mjs";
import { writeFileSync, mkdirSync } from "node:fs";
import { createServer } from "vite";
const args = process.argv.slice(2),
  opt = (name, d) => {
    const i = args.indexOf("--" + name);
    return i < 0 ? d : args[i + 1];
  };
const server = await createServer({
  server: { middlewareMode: true, hmr: { port: 0 } },
  appType: "custom",
  logLevel: "error",
});
try {
  const { runSimulation } = await server.ssrLoadModule("/src/sim/sim.ts");
  const result = runSimulation({
    games: +opt("games", 100),
    players: +opt("players", 2),
    seed: +opt("seed", 20260920),
  });
  mkdirSync("artifacts", { recursive: true });
  const output = opt("json", "artifacts/simulation.json");
  writeFileSync(output, JSON.stringify(result, null, 2));
  writeFileSync(output.replace(/\.json$/, ".html"), reportHTML(result));
  console.log(
    JSON.stringify(
      { ...result, games: undefined, technologies: undefined },
      null,
      2,
    ),
  );
  console.log("Report: " + output);
} finally {
  await server.close();
}
