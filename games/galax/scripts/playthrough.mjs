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
const { newGame, legalActions, applyAction, seatOnClock } =
  await loader.ssrLoadModule("/src/game/engine.ts");
const { botDecide } = await loader.ssrLoadModule("/src/game/bot.ts");
const { playerView } = await loader.ssrLoadModule("/src/game/views.ts");
const {
  decisionStep,
  cardActions,
  planetActions,
  waypointActions,
  actionLocation,
  actionKey,
  valueKey,
} = await loader.ssrLoadModule("/src/game/interaction.ts");
const { CONFIG } = await loader.ssrLoadModule("/src/data/config.ts");
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH }
    : {},
);
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }),
  errors = [],
  seen = new Set();
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const players = [
  { name: "Empire 1", color: "#f5a276", isBot: false },
  { name: "Empire 2", color: "#79d7df", isBot: false },
];
const s = newGame(players, { seed: 20260920 }),
  replay = [];
const attr = (name, value) =>
  page.locator(`[${name}=${JSON.stringify(String(value))}]`);
async function reveal() {
  const gate = page.getByRole("dialog", { name: "Private handoff" });
  if (await gate.count()) {
    if (await page.locator(".hand .card-select").count())
      throw Error("Private cards leaked");
    await gate.getByRole("button").click();
  }
}
async function enter(a) {
  const all = legalActions(s);
  let options = all;
  if (s.pending) {
    await page
      .locator("dialog[open],.map-prompt")
      .first()
      .waitFor({ state: "visible" });
    return options;
  }
  const hand =
    a.card &&
    a.card !== "r01" &&
    ["home", "play", "dual", "invent", "boost"].includes(a.a)
      ? a.card
      : a.a === "wild"
        ? a.cards[0]
        : null;
  if (hand) {
    options = cardActions(all, hand);
    await attr("data-hand-card", hand).click();
  } else if (a.planet !== undefined || a.planets) {
    const planet = a.planet ?? a.planets[0],
      loc = actionLocation(s, a);
    options = planetActions(s, all, loc, planet);
    await attr("data-planet", loc + ":" + planet).click();
  } else if (a.a === "move" || a.a === "setupFleet" || a.a === "upgrade") {
    const wp = a.from ?? s.fleets.find((f) => f.id === a.fleet)?.wp ?? a.to;
    options = waypointActions(s, all, wp);
    await attr("data-waypoint", wp).click();
  } else if (a.location !== undefined) {
    options = all.filter((x) => actionLocation(s, x) === a.location);
    await attr("data-location", a.location).click();
  } else {
    options = all.filter((x) => x.a === a.a);
    const b = attr("data-family", a.a);
    if (!(await b.isVisible()))
      await page.locator(".action-reference summary").click();
    await b.click();
  }
  return options;
}
async function choose(a) {
  let options = await enter(a);
  const view = playerView(s, seatOnClock(s));
  for (let depth = 0; depth < 24; depth++) {
    const step = decisionStep(view, options);
    if (!step) break;
    if (
      !seen.has("options-" + step.key) &&
      ["a", "mode", "fleets", "cards"].includes(step.key)
    ) {
      await page.locator(".choice-grid").waitFor();
      await page.screenshot({
        path: "artifacts/options-" + step.key + ".png",
        fullPage: true,
      });
      seen.add("options-" + step.key);
    }
    const g = step.groups.find((g) =>
      g.actions.some((x) => actionKey(x) === actionKey(a)),
    );
    if (!g) throw Error("Missing GUI branch");
    if (
      (await page.locator(".map-prompt").count()) &&
      !(await page.locator("dialog[open]").count())
    ) {
      if (step.key === "location") await attr("data-location", g.value).click();
      else if (step.key === "planet")
        await attr("data-planet", actionLocation(s, a) + ":" + g.value).click();
      else await attr("data-waypoint", g.value).click();
    } else if (
      ["cards", "fleets", "planets"].includes(step.key) &&
      step.groups.every((g) => Array.isArray(g.value))
    ) {
      for (const value of g.value) {
        const pick = attr("data-pick", valueKey(value));
        if ((await pick.getAttribute("aria-pressed")) !== "true")
          await pick.click();
      }
      await page
        .getByRole("button", { name: "Use selection", exact: true })
        .click();
    } else
      await page
        .locator(
          `[data-choice-key=${JSON.stringify(step.key)}][data-choice-value=${JSON.stringify(valueKey(g.value))}]`,
        )
        .click();
    options = g.actions;
  }
  const confirm = attr("data-action", actionKey(a));
  await confirm.waitFor();
  if (
    !seen.has(a.a) &&
    ["home", "play", "invent", "move", "exploit", "build", "choose"].includes(
      a.a,
    )
  ) {
    await page.screenshot({
      path: "artifacts/choice-" + a.a + ".png",
      fullPage: true,
    });
    seen.add(a.a);
    await page.keyboard.press("Escape");
    if (s.pending) await attr("data-family", "choose").click();
    await choose(a);
    return;
  }
  await confirm.click();
}
try {
  await page.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });
  await page.screenshot({ path: "artifacts/setup-desktop.png" });
  await page.getByLabel("Empire 2 controller").selectOption("human");
  await page.getByRole("button", { name: "Start expedition" }).click();
  for (let n = 0; n < 1600 && !s.over; n++) {
    await reveal();
    if (await page.locator(".game select").count())
      throw Error("In-game dropdown remains");
    if (n === 20) {
      if (await page.locator("dialog[open]").count())
        await page.keyboard.press("Escape");
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
          throw Error("Document horizontal overflow");
      }
      await page.setViewportSize({ width: 1440, height: 900 });
      if (s.pending) await attr("data-family", "choose").click();
    }
    const a = botDecide(s);
    await choose(a);
    const err = applyAction(s, a);
    if (err) throw Error(err);
    replay.push(a);
  }
  if (!s.over) throw Error("GUI journey did not finish");
  await page.getByText("EXPEDITION COMPLETE", { exact: true }).waitFor();
  await page.screenshot({ path: "artifacts/result.png", fullPage: true });
  await writeFile(
    "artifacts/gui-replay.json",
    JSON.stringify({
      schemaVersion: 1,
      rulesVersion: CONFIG.RULES_VERSION,
      initial: { players, seed: 20260920 },
      actions: replay,
    }),
  );
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await reveal();
  if (await page.getByText("EXPEDITION COMPLETE", { exact: true }).count())
    throw Error("Undo failed");
  if (await page.locator("dialog[open]").count())
    await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Table references", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Current table references" })
    .waitFor();
  await page.screenshot({ path: "artifacts/references.png", fullPage: true });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "New game", exact: true }).click();
  await page
    .getByLabel("Load replay", { exact: true })
    .setInputFiles("artifacts/gui-replay.json");
  await page.getByText("EXPEDITION COMPLETE", { exact: true }).waitFor();
  await page.getByRole("button", { name: "New game", exact: true }).click();
  await page
    .getByRole("button", { name: "Simulation lab", exact: true })
    .click();
  await page.getByLabel("Games", { exact: true }).fill("5");
  await page.getByLabel("Player count", { exact: true }).selectOption("4");
  await page.getByRole("button", { name: "Run 4-player simulation" }).click();
  await page.getByText(/5 completed · 0 truncated/).waitFor({ timeout: 60000 });
  await page.keyboard.press("Escape");
  await page.getByLabel("Empire 1 controller").selectOption("bot");
  await page.getByRole("button", { name: "Start expedition" }).click();
  await page.getByText(/TURN 2 ·/).waitFor({ timeout: 60000 });
  await page.getByRole("button", { name: "Pause bots", exact: true }).click();
  if (await page.locator(".hand .card-select").count())
    throw Error("Bot hand leaked");
  if (
    await page
      .locator("button")
      .evaluateAll((bs) =>
        bs.some(
          (b) =>
            !b.textContent.trim() &&
            !b.getAttribute("aria-label") &&
            !b.querySelector("img[alt]"),
        ),
      )
  )
    throw Error("Unnamed button");
  if (
    await page
      .locator("img")
      .evaluateAll((imgs) => imgs.some((i) => !i.complete || !i.naturalWidth))
  )
    throw Error("Missing image");
  if (errors.length) throw Error(errors.join("\n"));
  console.log(
    `GUI PASS: ${replay.length} actions through card, planet and fleet clicks; option tiles, cancellation, scoring, undo, replay, tablet, worker and bots. No gameplay dropdowns.`,
  );
} catch (e) {
  await page.screenshot({ path: "artifacts/failure.png", fullPage: true });
  throw e;
} finally {
  await browser.close();
  await server.close();
  await loader.close();
}
