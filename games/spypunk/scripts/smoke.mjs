// Browser smoke test: boots the built app in headless Chromium, starts a
// 2-player game, makes the opening placement, then player 2 places a card.
// Run with:  node scripts/smoke.mjs   (after `npm run build`)
import { chromium } from "playwright";
import { preview } from "vite";

const OUT = process.env.SMOKE_OUT ?? "smoke";

const server = await preview({ preview: { port: 4173, strictPort: true } });
const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium",
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error" && !/404/.test(m.text())) errors.push(m.text());
});

async function shot(name) {
  await page.screenshot({ path: `${OUT}-${name}.png` });
}

try {
  await page.goto("http://localhost:4173/", { waitUntil: "networkidle" });

  // setup screen → start
  await page.getByRole("button", { name: /START GAME/ }).click();
  await shot("1-setup-done");

  // pass screen → continue as P1
  await page.locator(".passover button.primary").click();

  // opening placement: pick first hand card, click origin cell
  await page.locator(".hcard button", { hasText: "place" }).first().click();
  const grid = page.locator(".gridvp");
  const box = await grid.boundingBox();
  // origin cell center: view initialized to (w/2 - CS/2, h/2 - CS), CS=84
  const ox = box.x + box.width / 2 - 42 + 42;
  const oy = box.y + box.height / 2 - 84 + 42;
  await page.mouse.move(ox, oy);
  await page.mouse.click(ox, oy);
  await page.waitForSelector(".gcard", { timeout: 5000 });
  await shot("2-opening-placed");

  // pass to P2, place adjacent (one cell right of origin)
  await page.locator(".passover button.primary").click();
  await page.locator(".hcard button", { hasText: "place" }).first().click();
  await page.mouse.move(ox + 84, oy);
  await page.mouse.click(ox + 84, oy);
  await page.waitForTimeout(400);
  await shot("3-p2-turn");

  // resolve any pending prompts (up to 8 clicks of first option)
  for (let i = 0; i < 8; i++) {
    const btn = page.locator(".pendbox .opts button, .pendbox .cardchips button").first();
    if ((await btn.count()) === 0) break;
    await btn.click();
    await page.waitForTimeout(150);
  }

  const cards = await page.locator(".gcard").count();
  if (cards < 2) throw new Error(`expected 2 cards on grid, saw ${cards}`);

  // end turn should now be possible
  await page.getByRole("button", { name: /END TURN/ }).click();
  await page.waitForSelector(".passover", { timeout: 5000 });
  await shot("4-endturn-pass");

  if (errors.length) throw new Error("console errors:\n" + errors.join("\n"));
  console.log("SMOKE OK — 2 placements, matches resolved, turn passed");
} finally {
  await browser.close();
  await server.close();
}
