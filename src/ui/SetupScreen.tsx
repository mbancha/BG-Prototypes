// =============================================================================
// Pre-game lobby: player count, names, colors, and human/bot toggle per seat.
// Emits the players array that App feeds straight into newGame(). Purely
// presentational — no game rules here.
// =============================================================================

import { useState } from "react";
import { CONFIG } from "../data/config";

export const NEON_COLORS = [
  "#00e5ff",
  "#ff2ec4",
  "#b4ff39",
  "#ffb020",
  "#a78bfa",
  "#ff4d5e",
];

const DEFAULT_NAMES = ["Cipher", "Vesper", "Halcyon", "Marrow"];

export default function SetupScreen(props: {
  onStart: (players: { name: string; color: string; isBot: boolean }[]) => void;
}) {
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
            props.onStart(
              Array.from({ length: count }, (_, i) => ({
                name: names[i].trim() || `Player ${i + 1}`,
                color: colors[i],
                isBot: bots[i],
              })),
            )
          }
        >
          ▶ START GAME
        </button>
        <div style={{ color: "var(--dim)", fontSize: 11 }}>
          Hotseat: pass the device between turns. Player 1 opens by placing one
          card on the origin, then play proceeds clockwise from Player 2. Seats
          marked 🤖 play themselves — their hands stay hidden.
        </div>
      </div>
    </div>
  );
}
