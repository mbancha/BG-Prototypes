// Browser smoke test for the bounded board + simulation panel: opens COLOR
// GROUPS, checks the default board size follows the player count, runs a
// short in-browser simulation via the Web Worker, and screenshots the
// results table. Run with:  npm run smoke:sim   (after `npm run build`)
import { chromium } from "playwright";
import { preview } from "vite";

const OUT = process.env.SMOKE_OUT ?? "smoke-sim";

const server = await preview({ preview: { port: 4175, strictPort: true } });
const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium",
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error" && !/404/.test(m.text())) errors.push(m.text());
});

try {
  await page.goto("http://localhost:4175/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "◼ COLOR GROUPS" }).click();

  // default board is 4 + 1 per player → 6x6 at 2p, 8x8 at 4p
  const sizes = () => page.locator(".variantbox .sizein");
  if ((await sizes().first().inputValue()) !== "6")
    throw new Error("expected a 6x6 default board for 2 players");
  await page.getByRole("button", { name: "4 players" }).click();
  await page.waitForTimeout(100);
  if ((await sizes().first().inputValue()) !== "8")
    throw new Error("expected an 8x8 default board for 4 players");
  await page.getByRole("button", { name: "2 players" }).click();

  // turn on both variants, then run a short simulation
  for (;;) {
    const b = page.locator(".variantbox button", { hasText: "OFF" }).first();
    if ((await b.count()) === 0) break;
    await b.click();
    await page.waitForTimeout(60);
  }
  await page.getByRole("button", { name: /SIMULATE/ }).click();
  const gamesInput = page.locator(".simcard .sizein").first();
  await gamesInput.fill("300");
  await page.getByRole("button", { name: /RUN/ }).click();
  await page.waitForSelector(".simres", { timeout: 60000 });
  await page.screenshot({ path: `${OUT}-results.png` });

  const rows = await page.locator(".simres tbody tr").count();
  if (rows < 5) throw new Error(`expected per-colour rows, saw ${rows}`);

  // …and in a real game the playable envelope appears once the first tile
  // is down (it is relative, so there is nothing to draw before that)
  await page.getByRole("button", { name: /close/ }).click();
  await page.getByRole("button", { name: /START GAME/ }).click();
  await page.locator(".passover button.primary").click();
  if ((await page.locator(".boardwall").count()) !== 0)
    throw new Error("envelope should not exist before the first tile");
  await page.locator(".ctile").first().click();
  const grid = await page.locator(".gridvp").boundingBox();
  await page.mouse.click(grid.x + grid.width / 2, grid.y + grid.height / 2 - 42);
  await page.waitForSelector(".boardwall", { timeout: 5000 });
  await page.screenshot({ path: `${OUT}-board.png` });

  if (errors.length) throw new Error("console errors:\n" + errors.join("\n"));
  console.log(`SIM SMOKE OK — ${rows} colour rows, board walls rendered`);
} finally {
  await browser.close();
  await server.close();
}
