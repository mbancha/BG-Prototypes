// =============================================================================
// Simulation modal: runs N headless bot-vs-bot color games on the settings
// currently chosen on the setup screen and shows the aggregate telemetry.
// The run happens in a Web Worker (src/color/sim.worker.ts) so the UI stays
// responsive and can report progress / be cancelled.
//
// Reading the table: leaderWinRate is the win rate of whoever placed the most
// of that colour. Above the baseline (1 / players) means "playing this colour
// more went with winning more". Δ is that gap in percentage points.
// =============================================================================

import { useEffect, useRef, useState } from "react";
import { COLOR_CFG, COLOR_DEFS } from "../data/config";
import type { ColorVariant } from "../color/engine";
import type { SimResult } from "../color/sim";
import { downloadJson } from "./dump";

const HEX: Record<string, string> = Object.fromEntries(
  COLOR_DEFS.map((d) => [d.key, d.hex]),
);
const GLYPH: Record<string, string> = Object.fromEntries(
  COLOR_DEFS.map((d) => [d.key, d.glyph]),
);

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const num = (v: number, d = 2) => v.toFixed(d);

export default function SimPanel(props: {
  players: number;
  variant: ColorVariant;
  onClose: () => void;
}) {
  const [games, setGames] = useState<number>(COLOR_CFG.SIM_GAMES);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [res, setRes] = useState<SimResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);

  // always tear the worker down with the modal
  useEffect(() => () => workerRef.current?.terminate(), []);

  const run = () => {
    setRunning(true);
    setRes(null);
    setErr(null);
    setDone(0);
    const w = new Worker(new URL("../color/sim.worker.ts", import.meta.url), {
      type: "module",
    });
    workerRef.current = w;
    w.onmessage = (e: MessageEvent<any>) => {
      const m = e.data;
      if (m.t === "progress") setDone(m.done);
      else if (m.t === "done") {
        setRes(m.res as SimResult);
        setRunning(false);
        w.terminate();
        workerRef.current = null;
      } else if (m.t === "error") {
        setErr(m.message);
        setRunning(false);
        w.terminate();
        workerRef.current = null;
      }
    };
    w.postMessage({
      games,
      players: props.players,
      variant: props.variant,
      seed: COLOR_CFG.SIM_SEED,
    });
  };

  const cancel = () => {
    workerRef.current?.terminate();
    workerRef.current = null;
    setRunning(false);
  };

  const v = props.variant;
  return (
    <div className="modal">
      <div className="modalcard simcard">
        <div className="simhead">
          <b>⚗ SIMULATION</b>
          <span style={{ color: "var(--dim)" }}>
            {props.players}p · {v.width}×{v.height} · {v.scoring}
            {v.specials ? " · ★" : ""}
            {v.powers ? " · powers" : ""}
          </span>
          <span style={{ flex: 1 }} />
          <button onClick={props.onClose}>✕ close</button>
        </div>

        <div className="vrow" style={{ marginTop: 10 }}>
          <span className="vlabel">games</span>
          <input
            type="number"
            className="sizein"
            style={{ width: 90 }}
            min={10}
            max={200000}
            step={1000}
            value={games}
            disabled={running}
            onChange={(e) => setGames(Math.max(10, +e.target.value || 10))}
          />
          {!running ? (
            <button className="primary" onClick={run}>
              ▶ RUN
            </button>
          ) : (
            <button className="danger" onClick={cancel}>
              ✕ CANCEL
            </button>
          )}
          {running && (
            <span style={{ color: "var(--dim)" }}>
              {done.toLocaleString()} / {games.toLocaleString()} (
              {pct(done / games)})
            </span>
          )}
        </div>
        {running && (
          <div className="progbar">
            <div style={{ width: pct(done / games) }} />
          </div>
        )}
        {err && <div style={{ color: "var(--bad)" }}>✕ {err}</div>}

        {res && (
          <div className="simres">
            <div className="simsummary">
              <span>
                {res.games.toLocaleString()} games in{" "}
                {(res.elapsedMs / 1000).toFixed(1)}s
              </span>
              <span>avg score {num(res.avgScore)}</span>
              <span>ties {pct(res.tieRate)}</span>
              <span>tiles placed {num(res.avgPlacements, 1)}</span>
              <span>groups scored {num(res.avgGroupsScored, 1)}</span>
              <span>empty seals {num(res.avgEmptySeals, 1)}</span>
            </div>

            <h4>WIN RATE BY COLOUR PLAYED</h4>
            <div style={{ color: "var(--dim)", fontSize: 10, marginBottom: 4 }}>
              win rate of whoever placed the most of each colour · baseline{" "}
              {pct(res.baselineWinRate)}
            </div>
            <table>
              <thead>
                <tr>
                  <th>colour</th>
                  <th>lead win%</th>
                  <th>Δ vs base</th>
                  <th>winners avg</th>
                  <th>losers avg</th>
                  <th>pts/player</th>
                  <th>pts share</th>
                </tr>
              </thead>
              <tbody>
                {res.byColor.map((c) => {
                  const d =
                    c.leaderWinRate === null
                      ? null
                      : c.leaderWinRate - res.baselineWinRate;
                  return (
                    <tr key={c.color}>
                      <th style={{ color: HEX[c.color] }}>
                        {GLYPH[c.color]} {c.name}
                      </th>
                      <td>
                        {c.leaderWinRate === null ? "—" : pct(c.leaderWinRate)}
                      </td>
                      <td
                        style={{
                          color:
                            d === null
                              ? "var(--dim)"
                              : d > 0.01
                                ? "var(--ok)"
                                : d < -0.01
                                  ? "var(--bad)"
                                  : "var(--dim)",
                        }}
                      >
                        {d === null
                          ? "—"
                          : `${d >= 0 ? "+" : ""}${(d * 100).toFixed(1)}`}
                      </td>
                      <td>{num(c.winnerAvgPlaced)}</td>
                      <td>{num(c.loserAvgPlaced)}</td>
                      <td>{num(c.avgPtsFromColor)}</td>
                      <td>{pct(c.ptsShare)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <h4>BY SEAT (turn-order check)</h4>
            <table>
              <tbody>
                {res.winRateBySeat.map((w, i) => (
                  <tr key={i}>
                    <th>P{i + 1}</th>
                    <td>
                      win {pct(w)} · avg score {num(res.avgScoreBySeat[i])}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <button
              className="primary"
              onClick={() =>
                downloadJson(res, `spypunk-colors-sim-${res.games}.json`)
              }
            >
              ⬇ DUMP JSON
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
