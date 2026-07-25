// =============================================================================
// Pre-game lobby: game MODE (classic abilities vs color-groups core),
// color-mode variant toggles, then player count / names / colors / bot
// toggles. Emits a SetupResult that App feeds into the right engine's
// newGame. Purely presentational — no game rules here.
// =============================================================================

import { useEffect, useState } from "react";
import {
  COLOR_CFG,
  CONFIG,
  defaultBoardSize,
  defaultClassicBoardSize,
} from "../data/config";
import type { ColorVariant } from "../color/engine";
import SimPanel from "./SimPanel";

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
  variant?: ColorVariant; // color mode settings (incl. its board limit)
  classicBoard?: { width: number; height: number };
}

export default function SetupScreen(props: {
  onStart: (r: SetupResult) => void;
}) {
  const [mode, setMode] = useState<"classic" | "colors">("classic");
  const [count, setCount] = useState(2);
  const [variant, setVariant] = useState<ColorVariant>({
    scoring: "size",
    specials: false,
    powers: false,
    width: defaultBoardSize(2),
    height: defaultBoardSize(2),
  });
  const [sizeTouched, setSizeTouched] = useState(false);
  const [showSim, setShowSim] = useState(false);
  const [classicBoard, setClassicBoard] = useState({
    width: defaultClassicBoardSize(2),
    height: defaultClassicBoardSize(2),
  });
  const [classicTouched, setClassicTouched] = useState(false);

  // both modes' limits follow the player count until set by hand
  useEffect(() => {
    if (!sizeTouched) {
      const n = defaultBoardSize(count);
      setVariant((v) => ({ ...v, width: n, height: n }));
    }
    if (!classicTouched) {
      const n = defaultClassicBoardSize(count);
      setClassicBoard({ width: n, height: n });
    }
  }, [count, sizeTouched, classicTouched]);

  const setSize = (key: "width" | "height", raw: number) => {
    setSizeTouched(true);
    const n = Math.max(
      COLOR_CFG.BOARD_MIN,
      Math.min(COLOR_CFG.BOARD_MAX, Math.round(raw) || COLOR_CFG.BOARD_MIN),
    );
    setVariant((v) => ({ ...v, [key]: n }));
  };

  const setClassicSize = (key: "width" | "height", raw: number) => {
    setClassicTouched(true);
    const n = Math.max(
      CONFIG.BOARD_MIN,
      Math.min(CONFIG.BOARD_MAX, Math.round(raw) || CONFIG.BOARD_MIN),
    );
    setClassicBoard((b) => ({ ...b, [key]: n }));
  };
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

        {mode === "classic" && (
          <div className="variantbox">
            <div className="vrow">
              <span className="vlabel">max cols × rows</span>
              <input
                type="number"
                className="sizein"
                min={CONFIG.BOARD_MIN}
                max={CONFIG.BOARD_MAX}
                value={classicBoard.width}
                onChange={(e) => setClassicSize("width", +e.target.value)}
                title="Cards may be played until the layout spans this many columns. The limit floats with the cards already down — it isn't a fixed board."
              />
              <span style={{ color: "var(--dim)" }}>×</span>
              <input
                type="number"
                className="sizein"
                min={CONFIG.BOARD_MIN}
                max={CONFIG.BOARD_MAX}
                value={classicBoard.height}
                onChange={(e) => setClassicSize("height", +e.target.value)}
                title="…and this many rows."
              />
              <span style={{ color: "var(--dim)", fontSize: 10 }}>
                {classicBoard.width * classicBoard.height} cells ·{" "}
                {classicTouched ? (
                  <button
                    style={{ padding: "1px 5px", fontSize: 10 }}
                    onClick={() => setClassicTouched(false)}
                    title={`Back to the default for ${count} players`}
                  >
                    auto
                  </button>
                ) : (
                  "default"
                )}
              </span>
            </div>
          </div>
        )}

        {mode === "colors" && (
          <div className="variantbox">
            <div className="vrow">
              <span className="vlabel">max cols × rows</span>
              <input
                type="number"
                className="sizein"
                min={COLOR_CFG.BOARD_MIN}
                max={COLOR_CFG.BOARD_MAX}
                value={variant.width}
                onChange={(e) => setSize("width", +e.target.value)}
                title="Tiles may be played until the layout spans this many columns. The limit floats with the tiles already down; cells that could never be played count as sealed edges for groups."
              />
              <span style={{ color: "var(--dim)" }}>×</span>
              <input
                type="number"
                className="sizein"
                min={COLOR_CFG.BOARD_MIN}
                max={COLOR_CFG.BOARD_MAX}
                value={variant.height}
                onChange={(e) => setSize("height", +e.target.value)}
                title="…and this many rows."
              />
              <span style={{ color: "var(--dim)", fontSize: 10 }}>
                = {variant.width * variant.height} cells
                {sizeTouched && (
                  <button
                    style={{ marginLeft: 6, padding: "1px 5px", fontSize: 10 }}
                    onClick={() => setSizeTouched(false)}
                    title={`Back to the default for ${count} players (${defaultBoardSize(count)}×${defaultBoardSize(count)})`}
                  >
                    auto
                  </button>
                )}
              </span>
            </div>
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
                title="Colored tiles with bonus points on one half: +1 tiles are two colors, +2 tiles are one color. They match and add +1 influence like any tile; the bonus half also adds its points to that group's value when it scores"
                onClick={() => setVariant((v) => ({ ...v, specials: !v.specials }))}
              >
                {variant.specials ? "ON" : "OFF"}
              </button>
            </div>
            <div className="vrow">
              <span className="vlabel">color powers</span>
              <button
                className={"bottoggle" + (variant.powers ? " on" : "")}
                title="A match always adds +1, then the color's power layers on: red also removes 1 from an adjacent group (your choice), green adds 1 more, gold scores +2, violet also seeds each adjacent group, cyan pays the runner-up"
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
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="primary"
            style={{ flex: 1 }}
            onClick={() =>
              props.onStart({
                mode,
                variant: mode === "colors" ? variant : undefined,
                classicBoard: mode === "classic" ? classicBoard : undefined,
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
          {mode === "colors" && (
            <button
              onClick={() => setShowSim(true)}
              title={`Play ${COLOR_CFG.SIM_GAMES.toLocaleString()} bot-vs-bot games headlessly on these exact settings and report win rates by color played, average scores and points per color`}
            >
              ⚗ SIMULATE
            </button>
          )}
        </div>
        <div style={{ color: "var(--dim)", fontSize: 11 }}>
          Hotseat: pass the device between turns. Player 1 opens on the origin.
          Seats marked 🤖 play themselves — their hands stay hidden. There is
          no drawn board: cards may be played until the layout spans{" "}
          {mode === "colors"
            ? `${variant.width}×${variant.height}`
            : `${classicBoard.width}×${classicBoard.height}`}
          , then nothing may extend it further.
          {mode === "colors" &&
            " COLOR GROUPS: match a side to add influence to that group; a group only scores once every side of it is sealed."}
        </div>
      </div>
      {showSim && (
        <SimPanel
          players={count}
          variant={variant}
          onClose={() => setShowSim(false)}
        />
      )}
    </div>
  );
}
