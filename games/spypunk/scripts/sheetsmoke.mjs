// Browser smoke for the classic cheat sheet + classic board limit control:
// starts a classic game, opens the sheet, screenshots it.
// Run with:  npm run smoke:sheet   (after `npm run build`)
import { chromium } from "playwright";
import { preview } from "vite";

const OUT = process.env.SMOKE_OUT ?? "smoke-sheet";

const server = await preview({ preview: { port: 4176, strictPort: true } });
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
  await page.goto("http://localhost:4176/", { waitUntil: "networkidle" });

  // classic mode now exposes its own column/row limit, defaulting to 12 at 2p
  const w = page.locator(".variantbox .sizein").first();
  if ((await w.inputValue()) !== "12")
    throw new Error(`expected a 12-column default at 2p, saw ${await w.inputValue()}`);

  await page.getByRole("button", { name: /START GAME/ }).click();
  await page.locator(".passover button.primary").click();
  await page.getByRole("button", { name: /CHEAT SHEET/ }).click();
  await page.waitForSelector(".sheet", { timeout: 5000 });
  await page.screenshot({ path: `${OUT}.png` });

  const heads = await page.locator(".sheet h4").allTextContents();
  for (const need of ["SYMBOL MATCHES", "SCORING", "CARD TYPES"])
    if (!heads.includes(need)) throw new Error(`cheat sheet missing ${need}`);

  // closes with Escape too
  await page.keyboard.press("Escape");
  if ((await page.locator(".sheet").count()) !== 0)
    throw new Error("Escape should close the cheat sheet");

  if (errors.length) throw new Error("console errors:\n" + errors.join("\n"));
  console.log(`SHEET SMOKE OK — ${heads.length} sections, Escape closes it`);
} finally {
  await browser.close();
  await server.close();
}
