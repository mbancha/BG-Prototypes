import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { preview, createServer } from "vite";
await mkdir("artifacts", { recursive: true });
const server = await preview({
  preview: { host: "127.0.0.1", port: 4173, strictPort: true },
});
const loader = await createServer({
  server: { middlewareMode: true, hmr: { port: 0 } },
  appType: "custom",
  logLevel: "error",
});
const { newGame, applyAction, legalActions } = await loader.ssrLoadModule(
  "/src/game/engine.ts",
);
const { botDecide } = await loader.ssrLoadModule("/src/game/bot.ts");
const browser = await chromium.launch(
    process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : {},
  ),
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } }),
  errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const input = [
  { name: "Empire 1", color: "#f5a276", isBot: false },
  { name: "Empire 2", color: "#79d7df", isBot: false },
];
const s = newGame(input, { seed: 20260920 });
const actions = [];
const seen = new Set();
const reveal = async () => {
  const gate = page.getByRole("dialog", { name: "Private handoff" });
  if (await gate.count()) {
    if (await page.locator(".hand .card-select").count())
      throw Error("Private cards leaked during handoff");
    await gate.getByRole("button").click();
  }
};
try {
  await page.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });
  await page.screenshot({ path: "artifacts/setup-desktop.png" });
  await page.getByLabel("Empire 2 controller").selectOption("human");
  await page.getByRole("button", { name: "Start expedition" }).click();
  for (let step = 0; step < 1300 && !s.over; step++) {
    await reveal();
    const a = botDecide(s);
    await page.getByLabel("Action", { exact: true }).selectOption(a.a);
    const options = legalActions(s).filter((o) => o.a === a.a),
      idx = options.findIndex((o) => JSON.stringify(o) === JSON.stringify(a));
    await page
      .getByLabel("Action options", { exact: true })
      .selectOption(String(idx));
    if (
      !seen.has(a.a) &&
      ["move", "conquer", "invent", "reveal", "choose"].includes(a.a)
    ) {
      await page.screenshot({
        path: "artifacts/action-" + a.a + ".png",
        fullPage: true,
      });
      seen.add(a.a);
    }
    if (step === 17) {
      await page.screenshot({
        path: "artifacts/board-desktop.png",
        fullPage: true,
      });
      for (const size of [
        { width: 1024, height: 768 },
        { width: 768, height: 1024 },
      ]) {
        await page.setViewportSize(size);
        await page.screenshot({
          path: "artifacts/tablet-" + size.width + ".png",
          fullPage: true,
        });
        if (
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth + 2,
          )
        )
          throw Error("Horizontal document overflow");
      }
      await page.setViewportSize({ width: 1440, height: 900 });
    }
    await page.getByRole("button", { name: /^Confirm / }).click();
    const err = applyAction(s, a);
    if (err) throw Error(err);
    actions.push(a);
  }
  if (!s.over) throw Error("GUI journey failed to reach scoring");
  await page.getByText("EXPEDITION COMPLETE", { exact: true }).waitFor();
  await page.screenshot({ path: "artifacts/result.png", fullPage: true });
  await writeFile(
    "artifacts/gui-replay.json",
    JSON.stringify({
      schemaVersion: 1,
      rulesVersion: "dextrous-2026-09-20",
      initial: { players: input, seed: 20260920 },
      actions,
    }),
  );
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await reveal();
  if (await page.getByText("EXPEDITION COMPLETE", { exact: true }).count())
    throw Error("Undo failed");
  await page.getByRole("button", { name: "How to play" }).click();
  await page.getByRole("dialog", { name: "How to play Galax" }).waitFor();
  await page.keyboard.press("Escape");
  const bad = await page
    .locator("button")
    .evaluateAll(
      (bs) =>
        bs.filter(
          (b) =>
            !b.textContent.trim() &&
            !b.getAttribute("aria-label") &&
            !b.querySelector("img[alt]"),
        ).length,
    );
  if (bad) throw Error("Unnamed controls: " + bad);
  await page.getByRole("button", { name: "New game", exact: true }).click();
  await page.getByLabel("Load replay", { exact: true }).setInputFiles("artifacts/gui-replay.json");
  await page.getByText("EXPEDITION COMPLETE", { exact: true }).waitFor();
  await page.getByRole("button", { name: "New game", exact: true }).click();
  await page.getByRole("button", { name: "Simulation lab", exact: true }).click();
  await page.getByLabel("Games", { exact: true }).fill("5");
  await page.getByLabel("Player count", { exact: true }).selectOption("4");
  await page.getByRole("button", { name: "Run 4-player simulation" }).click();
  await page.getByText(/5 completed · 0 truncated/).waitFor({ timeout: 60000 });
  await page.screenshot({ path: "artifacts/simulation-lab.png", fullPage: true });
  await page.keyboard.press("Escape");
  await page.getByLabel("Empire 1 controller").selectOption("bot");
  await page.getByRole("button", { name: "Start expedition" }).click();
  await page.getByText(/TURN 2 ·/).waitFor({ timeout: 60000 });
  await page.getByRole("button", { name: "Pause bots", exact: true }).click();
  if (await page.getByRole("dialog", { name: "Private handoff" }).count())
    throw Error("Bot spectator game incorrectly requested a private handoff");
  if (await page.locator(".hand .card-select").count())
    throw Error("Bot private cards leaked to spectator");
  if (
    await page
      .locator("img")
      .evaluateAll((imgs) =>
        imgs.some((i) => !i.complete || i.naturalWidth === 0),
      )
  )
    throw Error("Missing card image");
  if (errors.length) throw Error(errors.join("\n"));
  console.log(
    "GUI PASS: " +
      actions.length +
      " actions through setup, scoring, undo, replay reload, desktop/tablet, private handoffs; worker simulation and live bots passed.",
  );
} finally {
  await browser.close();
  await server.close();
  await loader.close();
}
