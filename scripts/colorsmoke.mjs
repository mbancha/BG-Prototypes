// Browser smoke test for COLOR-GROUPS mode: starts an all-bot game with the
// specials + powers variants on, lets the bots play, and checks the board
// filled up without page errors.
// Run with:  npm run smoke:colors   (after `npm run build`)
import { chromium } from "playwright";
import { preview } from "vite";

const OUT = process.env.SMOKE_OUT ?? "smoke-colors";

const server = await preview({ preview: { port: 4174, strictPort: true } });
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
  await page.goto("http://localhost:4174/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "◼ COLOR GROUPS" }).click();
  // flip toggles until none are left in their off state (clicking one
  // re-renders the list, so always re-query and take the first)
  const flipAll = async (sel, text) => {
    for (;;) {
      const b = page.locator(sel, { hasText: text }).first();
      if ((await b.count()) === 0) break;
      await b.click();
      await page.waitForTimeout(80);
    }
  };
  await flipAll(".variantbox button", "OFF"); // ★ tiles + color powers on
  await flipAll(".prow .bottoggle", "HUMAN"); // both seats → bots
  await page.getByRole("button", { name: /START GAME/ }).click();
  await page.waitForTimeout(14000);
  await page.screenshot({ path: `${OUT}-midgame.png` });

  const halves = await page.locator(".chalf").count();
  if (halves < 10)
    throw new Error(`expected a busy board, saw ${halves} tile halves`);
  if (errors.length) throw new Error("console errors:\n" + errors.join("\n"));
  console.log(`COLOR SMOKE OK — ${halves} halves on the board, bots running`);
} finally {
  await browser.close();
  await server.close();
}
