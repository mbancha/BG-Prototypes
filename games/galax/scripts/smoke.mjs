import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { preview } from "vite";

const OUT_DIR = process.env.SMOKE_OUT ?? "artifacts";
const server = await preview({ preview: { host: "127.0.0.1", port: 4173, strictPort: true } });
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", error => errors.push(String(error)));
page.on("console", message => {
  if (message.type() === "error" && !/favicon|404/.test(message.text())) errors.push(message.text());
});
try {
  await page.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });
  await page.locator('input[placeholder="random"]').fill("12345");
  await page.getByRole("button", { name: /START GAME/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "free: Science" }).click();
  await page.getByRole("button", { name: "advanceScience" }).click();
  await page.getByRole("button", { name: "endTurn" }).click();
  await page.getByText("Turn 2 · Bo").waitFor();
  await page.getByRole("button", { name: "Undo" }).click();
  await page.getByText("Turn 1 · Ada").waitFor();
  await mkdir(OUT_DIR, { recursive: true });
  const screenshot = `${OUT_DIR}/galax-smoke.png`;
  await page.screenshot({ path: screenshot, fullPage: true });
  if (errors.length) throw new Error(`Browser console errors:\n${errors.join("\n")}`);
  console.log(`SMOKE OK — setup, Science action, turn transition, and undo; screenshot: ${screenshot}`);
} finally {
  await browser.close();
  await server.close();
}
