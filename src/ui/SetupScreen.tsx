// =============================================================================
// Pre-game lobby: game MODE (classic abilities vs color-groups core),
// color-mode variant toggles, then player count / names / colors / bot
// toggles. Emits a SetupResult that App feeds into the right engine's
// newGame. Purely presentational — no game rules here.
// =============================================================================

import { useState } from "react";
import { CONFIG } from "../data/config";
import type { ColorVariant } from "../color/engine";

export const NEON_COLORS = [
  "#00e5ff",
  "#ff2ec4",
  "#b4ff39",
  "#ffb020",
  "#a78bfa",
  "#ff4d5e",
];

const DEFAULT_NAMES = ["Cipher", "Vesper", "Halcyon", "Marrow"];

export interface SetupResult {
  mode: "classic" | "colors";
  players: { name: string; color: string; isBot: boolean }[];
  variant?: ColorVariant;
}

export default function SetupScreen(props: {
  onStart: (r: SetupResult) => void;
}) {
  const [mode, setMode] = useState<"classic" | "colors">("classic");
  const [variant, setVariant] = useState<ColorVariant>({
    scoring: "size",
    specials: false,
    powers: false,
  });
  const [count, setCount] = useState(2);
  const [names, setNames] = useState<string[]>([...DEFAULT_NAMES]);
  const [bots, setBots] = useState<boolean[]>([false, false, false, false]);
  const [colors, setColors] = useState<string[]>([
    NEON_COLORS[0],
    NEON_COLORS[1],
    NEON_COLORS[2],
    NEON_COLORS[3],
  ]);

  const counts = [];
  for (let n = CONFIG.MIN_PLAYERS; n <= CONFIG.MAX_PLAYERS; n++) counts.push(n);

  const pick = (i: number, c: string) => {
    setColors((prev) => {
      const next = [...prev];
      const clash = next.findIndex((x, j) => j < count && x === c && j !== i);
      if (clash !== -1) next[clash] = next[i]; // swap to keep colors unique
      next[i] = c;
      return next;
    });
  };

  return (
    <div className="setup">
      <div>
        <h1>SPYPUNK</h1>
        <div className="sub" style={{ textAlign: "center" }}>
          — digital playtest prototype —
        </div>
      </div>
      <div className="setup-card">
        <div className="countbtns">
          <button
            className={mode === "classic" ? "primary" : ""}
            onClick={() => setMode("classic")}
            title="The full game: 60 unique cards with deploy abilities, money, symbol matches, per-card enclosure scoring"
          >
            ♠ CLASSIC
          </button>
          <button
            className={mode === "colors" ? "primary" : ""}
            onClick={() => setMode("colors")}
            title="Stripped-down core: color dominoes form groups; a group scores only when fully sealed"
          >
            ◼ COLOR GROUPS
          </button>
        </div>

        {mode === "colors" && (
          <div className="variantbox">
            <div className="vrow">
              <span className="vlabel">group value</span>
              <button
                className={"bottoggle" + (variant.scoring === "size" ? " on" : "")}
                title="A group is worth 1 point per cell it spans"
                onClick={() => setVariant((v) => ({ ...v, scoring: "size" }))}
              >
                BY SIZE
              </button>
              <button
                className={"bottoggle" + (variant.scoring === "fixed" ? " on" : "")}
                title="Every group is worth the same flat value regardless of size"
                onClick={() => setVariant((v) => ({ ...v, scoring: "fixed" }))}
              >
                FIXED
              </button>
            </div>
            <div className="vrow">
              <span className="vlabel">★ bonus tiles</span>
              <button
                className={"bottoggle" + (variant.specials ? " on" : "")}
                title="One ★+1 and one ★+2 tile per color pair. Colored like normal tiles, so they EXTEND groups — but they add no influence; each ★ half adds its points to its group's value when it scores"
                onClick={() => setVariant((v) => ({ ...v, specials: !v.specials }))}
              >
                {variant.specials ? "ON" : "OFF"}
              </button>
            </div>
            <div className="vrow">
              <span className="vlabel">color powers</span>
              <button
                className={"bottoggle" + (variant.powers ? " on" : "")}
                title="Each color gets a qualitative rule: red steals, green adds 2, gold scores +2, violet spreads influence to every adjacent group, cyan pays the runner-up"
                onClick={() => setVariant((v) => ({ ...v, powers: !v.powers }))}
              >
                {variant.powers ? "ON" : "OFF"}
              </button>
            </div>
          </div>
        )}

        <div className="countbtns">
          {counts.map((n) => (
            <button
              key={n}
              className={n === count ? "primary" : ""}
              onClick={() => setCount(n)}
            >
              {n} players
            </button>
          ))}
        </div>
        {Array.from({ length: count }, (_, i) => (
          <div className="prow" key={i}>
            <span style={{ color: colors[i], width: 20 }}>P{i + 1}</span>
            <input
              type="text"
              value={names[i]}
              maxLength={12}
              onChange={(e) =>
                setNames((prev) => {
                  const next = [...prev];
                  next[i] = e.target.value;
                  return next;
                })
              }
            />
            <button
              className={"bottoggle" + (bots[i] ? " on" : "")}
              title={
                bots[i]
                  ? "Played automatically by a simple bot — click for human"
                  : "Played by a human at this device — click for bot"
              }
              onClick={() =>
                setBots((prev) => {
                  const next = [...prev];
                  next[i] = !next[i];
                  return next;
                })
              }
            >
              {bots[i] ? "🤖 BOT" : "👤 HUMAN"}
            </button>
            <div className="swatches">
              {NEON_COLORS.map((c) => (
                <div
                  key={c}
                  className={"swatch" + (colors[i] === c ? " sel" : "")}
                  style={{ background: c, color: c }}
                  onClick={() => pick(i, c)}
                />
              ))}
            </div>
          </div>
        ))}
        <button
          className="primary"
          onClick={() =>
            props.onStart({
              mode,
              variant: mode === "colors" ? variant : undefined,
              players: Array.from({ length: count }, (_, i) => ({
                name: names[i].trim() || `Player ${i + 1}`,
                color: colors[i],
                isBot: bots[i],
              })),
            })
          }
        >
          ▶ START GAME
        </button>
        <div style={{ color: "var(--dim)", fontSize: 11 }}>
          Hotseat: pass the device between turns. Player 1 opens on the origin.
          Seats marked 🤖 play themselves — their hands stay hidden.
          {mode === "colors" &&
            " COLOR GROUPS: match a side to add influence to that group; a group only scores once every side of it is sealed."}
        </div>
      </div>
    </div>
  );
}
