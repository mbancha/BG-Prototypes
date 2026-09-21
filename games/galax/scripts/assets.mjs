import { readFileSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
const cards = JSON.parse(readFileSync("src/data/cards.json")),
  manifest = JSON.parse(readFileSync("sources/asset-manifest.json"));
for (const c of cards)
  if (!manifest[c.id]) throw Error("Missing image mapping: " + c.id);
let bytes = 0;
for (const [id, a] of Object.entries(manifest)) {
  const buffer = readFileSync("public/" + a.file);
  bytes += buffer.length;
  if (createHash("sha256").update(buffer).digest("hex") !== a.sha256)
    throw Error("Asset hash mismatch: " + id);
  if (a.width < 400 || a.height < 600)
    throw Error("Insufficient readable image size: " + id);
}
for (const name of readdirSync("public/cards"))
  if (!name.startsWith("back-") && !manifest[name.replace(".webp", "")])
    throw Error("Untracked card asset: " + name);
if (bytes > 12 * 1024 * 1024) throw Error("Card asset budget exceeded");
console.log(
  Object.keys(manifest).length +
    " verified faces; " +
    (bytes / 1024 / 1024).toFixed(2) +
    " MiB; 57 gameplay mappings.",
);
