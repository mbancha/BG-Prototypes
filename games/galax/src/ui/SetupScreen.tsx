// Pre-game lobby: player count, names, colors, human/bot per seat, and the
// board limit. Emits the object App feeds straight into newGame().
// Presentational only — no rules here, ever.

import { useEffect, useState } from "react";
import { CONFIG, defaultBoardSize } from "../data/config";

export const NEON_COLORS = [
  "#00e5ff",
  "#ff2ec4",
  "#b4ff39",
  "#ffb020",
  "#a78bfa",
  "#ff4d5e",
];
const DEFAULT_NAMES = ["Ada", "Bo", "Cy", "Dex"];

export interface SetupResult {
  players: { name: string; color: string; isBot: boolean }[];
  board: { width: number; height: number };
  /** Blank ⇒ random. Type a seed to replay the exact same deal — the fastest
   *  way to re-examine a position a playtester complained about. */
  seed?: number;
}

export default function SetupScreen(props: {
  onStart: (r: SetupResult) => void;
}) {
  const [count, setCount] = useState(2);
  const [names, setNames] = useState([...DEFAULT_NAMES]);
  const [bots, setBots] = useState([false, false, false, false]);
  const [colors, setColors] = useState(NEON_COLORS.slice(0, 4));
  const [board, setBoard] = useState({
    width: defaultBoardSize(2),
    height: defaultBoardSize(2),
  });
  const [touched, setTouched] = useState(false);
  const [seed, setSeed] = useState("");

  useEffect(() => {
    if (touched) return;
    const n = defaultBoardSize(count);
    setBoard({ width: n, height: n });
  }, [count, touched]);

  const setSize = (k: "width" | "height", raw: number) => {
    setTouched(true);
    const n = Math.max(
      CONFIG.BOARD_MIN,
      Math.min(CONFIG.BOARD_MAX, Math.round(raw) || CONFIG.BOARD_MIN),
    );
    setBoard((b) => ({ ...b, [k]: n }));
  };

  const counts = [];
  for (let n = CONFIG.MIN_PLAYERS; n <= CONFIG.MAX_PLAYERS; n++) counts.push(n);

  return (
    <div className="setup">
      <h1>PROTOTYPE</h1>
      <div className="sub">— playtest build —</div>
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
        <div className="vrow">
          <span className="vlabel">max cols × rows</span>
          <input
            type="number"
            className="sizein"
            value={board.width}
            onChange={(e) => setSize("width", +e.target.value)}
          />
          <span style={{ color: "var(--dim)" }}>×</span>
          <input
            type="number"
            className="sizein"
            value={board.height}
            onChange={(e) => setSize("height", +e.target.value)}
          />
        </div>
        <div className="vrow">
          <span className="vlabel">seed</span>
          <input
            type="text"
            className="sizein"
            style={{ width: 96 }}
            placeholder="random"
            value={seed}
            onChange={(e) => setSeed(e.target.value.replace(/\D/g, ""))}
          />
          <span style={{ color: "var(--dim)", fontSize: 11 }}>
            same seed → same deal
          </span>
        </div>
        {Array.from({ length: count }, (_, i) => (
          <div className="prow" key={i}>
            <span style={{ color: colors[i], width: 20 }}>P{i + 1}</span>
            <input
              type="text"
              value={names[i]}
              maxLength={12}
              onChange={(e) =>
                setNames((p) => p.map((v, j) => (j === i ? e.target.value : v)))
              }
            />
            <button
              className={"bottoggle" + (bots[i] ? " on" : "")}
              onClick={() =>
                setBots((p) => p.map((v, j) => (j === i ? !v : v)))
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
                  onClick={() =>
                    setColors((p) => p.map((v, j) => (j === i ? c : v)))
                  }
                />
              ))}
            </div>
          </div>
        ))}
        <button
          className="primary"
          onClick={() =>
            props.onStart({
              board,
              seed: seed === "" ? undefined : Number(seed),
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
          Hotseat: pass the device between turns. 🤖 seats play themselves.
        </div>
      </div>
    </div>
  );
}
