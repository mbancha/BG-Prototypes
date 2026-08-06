// Browser smoke test: boots the built app in headless Chromium, plays a few
// real turns through the actual UI, and fails on any console error.
//
// This is the house rule for UI-visible changes — tests prove the rules, this
// proves the thing a playtester will open actually works. Run it after a
// build, and LOOK AT THE SCREENSHOTS it writes (smoke-*.png); "no exception
// thrown" is not the same as "renders correctly".
//
//   npm run build && npm run smoke
//
// Adapt the selectors as your UI diverges. Keep the shape: boot → setup →
// take a turn → exercise whatever changed → assert something visible.

import { chromium } from "playwright";
import { preview } from "vite";

const OUT = process.env.SMOKE_OUT ?? "smoke";
const CS = 76; // cell size in px — must match BoardView's CS

const server = await preview({ preview: { port: 4173, strictPort: true } });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium",
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error" && !/404/.test(m.text())) errors.push(m.text());
});

const shot = (name) => page.screenshot({ path: `${OUT}-${name}.png` });

/** Click the hand tile at `index`, then the board cell at grid (gx, gy). */
async function placeAt(index, gx, gy) {
  await page.locator(".ctile").nth(index).click();
  const box = await page.locator(".gridvp").boundingBox();
  // BoardView centres the view on the origin cell: x = w/2 - CS/2, y = h/2 - CS/2
  const ox = box.x + box.width / 2;
  const oy = box.y + box.height / 2;
  await page.mouse.click(ox + gx * CS, oy + gy * CS);
  await page.waitForTimeout(150);
}

/** Dismiss the hotseat pass screen and wait for it to actually go away —
 *  clicking through a still-mounted overlay is the classic flaky smoke test. */
async function continueTurn() {
  await page.locator(".passover button.primary").click();
  await page.waitForSelector(".passover", { state: "detached", timeout: 5000 });
}

try {
  await page.goto("http://localhost:4173/", { waitUntil: "networkidle" });

  // setup screen → fix the seed so the smoke test is reproducible, then start
  await page.locator('input[placeholder="random"]').fill("12345");
  await page.getByRole("button", { name: /START GAME/ }).click();
  await shot("1-setup-done");

  // P1 opening placement at the origin
  await continueTurn();
  await placeAt(0, 0, 0);
  if ((await page.locator(".gcard").count()) !== 1)
    throw new Error("opening placement did not land");
  await shot("2-opening-placed");

  // P2 places to the right of it, P1 below the origin
  await continueTurn();
  await placeAt(0, 1, 0);
  await continueTurn();
  await placeAt(0, 0, 1);

  // P2 fills the corner — touching two tiles, which opens the bonus prompt
  await continueTurn();
  await placeAt(0, 1, 1);
  await page.waitForSelector(".prompt", { timeout: 5000 });
  await shot("3-prompt-open");

  const promptText = await page.locator(".prompttext").innerText();
  if (!promptText) throw new Error("prompt rendered with no text");
  await page.locator(".prompt .promptopts button").first().click();
  await page.waitForTimeout(200);
  if ((await page.locator(".prompt").count()) !== 0)
    throw new Error("prompt did not close after answering");

  const tiles = await page.locator(".gcard").count();
  if (tiles !== 4) throw new Error(`expected 4 tiles on the board, saw ${tiles}`);
  await shot("4-after-answer");

  // Answering ended the turn, so the pass screen is up — undo from there.
  // One undo steps back the ANSWER (the prompt reopens, mid-decision state
  // restored); a second steps back the placement itself.
  await page.waitForSelector(".passover", { timeout: 5000 });
  await page.locator(".passover button", { hasText: /undo/i }).click();
  await page.waitForSelector(".prompt", { timeout: 5000 });
  if ((await page.locator(".gcard").count()) !== tiles)
    throw new Error("undoing the answer should not remove a tile");
  await shot("5-undo-reopens-prompt");

  await page.getByRole("button", { name: /UNDO/ }).click();
  await page.waitForTimeout(200);
  if ((await page.locator(".gcard").count()) !== tiles - 1)
    throw new Error("second undo did not step back the placement");
  await shot("6-undo-removes-tile");

  if (errors.length) throw new Error("console errors:\n" + errors.join("\n"));
  console.log(`SMOKE OK — 4 placements, prompt answered, undo works`);
} finally {
  await browser.close();
  await server.close();
}
