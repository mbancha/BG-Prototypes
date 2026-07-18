import { useEffect, useRef, useState } from "react";
import type { GameState } from "../game/types";
import { SYM_GLYPH, SYM_NAME } from "../game/cards";
import { buildDump, downloadJson } from "./dump";
import type { Sym } from "../game/types";

const SYMS: Sym[] = ["favor", "intel", "credit", "whisper", "muscle"];

export default function SidePanel(props: { s: GameState }) {
  const { s } = props;
  const [tab, setTab] = useState<"log" | "stats">("log");
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [s.log.length, tab]);

  return (
    <div className="side">
      <div className="tabs">
        <button className={tab === "log" ? "on" : ""} onClick={() => setTab("log")}>
          LOG
        </button>
        <button className={tab === "stats" ? "on" : ""} onClick={() => setTab("stats")}>
          STATS
        </button>
      </div>
      {tab === "log" && (
        <div className="logbody" ref={logRef}>
          {s.log.map((l, i) => (
            <div className="logrow" key={i}>
              <span className="lt">T{l.turn}</span>
              {l.p !== null && (
                <span
                  className="logchip"
                  style={{ ["--pc" as any]: s.players[l.p].color }}
                  title={s.players[l.p].name}
                />
              )}
              {l.p !== null && (
                <span style={{ color: s.players[l.p].color }}>
                  {s.players[l.p].name}{" "}
                </span>
              )}
              {l.msg}
            </div>
          ))}
        </div>
      )}
      {tab === "stats" && (
        <div className="statbody">
          <h4>MATCHES PER SYMBOL</h4>
          <table>
            <tbody>
              {SYMS.map((sym) => (
                <tr key={sym}>
                  <th>
                    {SYM_GLYPH[sym]} {SYM_NAME[sym]}
                  </th>
                  <td>{s.telem.matchesBySym[sym]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h4>INFLUENCE</h4>
          <table>
            <tbody>
              <tr>
                <th>added</th>
                <td>{s.telem.infAdded}</td>
              </tr>
              <tr>
                <th>removed</th>
                <td>{s.telem.infRemoved}</td>
              </tr>
              <tr>
                <th>moved</th>
                <td>{s.telem.infMoved}</td>
              </tr>
              <tr>
                <th>fizzled (supply empty)</th>
                <td>{s.telem.fizzledSupply}</td>
              </tr>
              <tr>
                <th>fizzled (other)</th>
                <td>{s.telem.fizzledOther}</td>
              </tr>
            </tbody>
          </table>
          <h4>MONEY EARNED PER SOURCE</h4>
          <table>
            <tbody>
              {Object.entries(s.telem.moneyBySource)
                .sort((a, b) => b[1] - a[1])
                .map(([k, v]) => (
                  <tr key={k}>
                    <th>{k}</th>
                    <td>${v}</td>
                  </tr>
                ))}
              <tr>
                <th>spent on deploys</th>
                <td>${s.telem.moneySpentOnDeploys}</td>
              </tr>
            </tbody>
          </table>
          <h4>FLOW</h4>
          <table>
            <tbody>
              <tr>
                <th>turn count</th>
                <td>{s.telem.turns}</td>
              </tr>
              <tr>
                <th>cards deployed</th>
                <td>{s.telem.deploys}</td>
              </tr>
              <tr>
                <th>cards placed</th>
                <td>{s.telem.placements}</td>
              </tr>
              <tr>
                <th>enclosures (scored)</th>
                <td>{s.telem.enclosures}</td>
              </tr>
              <tr>
                <th>scored with 0 influence</th>
                <td>{s.telem.scoredZero}</td>
              </tr>
              <tr>
                <th>deck remaining</th>
                <td>{s.deck.length}</td>
              </tr>
            </tbody>
          </table>
          <h4>SCORE</h4>
          <table>
            <tbody>
              {s.players.map((p, i) => (
                <tr key={i}>
                  <th style={{ color: p.color }}>{p.name}</th>
                  <td>
                    {p.pts} pts · ${p.money} · supply {p.supply}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            className="primary"
            onClick={() => downloadJson(buildDump(s), "spypunk-playtest.json")}
          >
            ⬇ DUMP JSON
          </button>
        </div>
      )}
    </div>
  );
}
