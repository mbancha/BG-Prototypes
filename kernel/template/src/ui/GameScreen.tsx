// In-game layout: HUD, board, hand, log, prompts, and the hotseat /
// game-over overlays. All interaction funnels into props.dispatch(Action);
// this component holds only view state (which piece is selected).

import { useEffect, useState } from "react";
import BoardView from "./BoardView";
import PendingPrompt from "./PendingPrompt";
import { buildDump, downloadJson } from "./dump";
import type { Cell } from "../kernel/board";
import { count } from "../kernel/zones";
import { isBotTurn } from "../game/bot";
import {
  activeSeat,
  currentSpan,
  handOf,
  pts,
  seatOnClock,
  type Action,
  type GameState,
} from "../game/engine";

export default function GameScreen(props: {
  s: GameState;
  actions: Action[];
  dispatch: (a: Action) => void;
  undo: () => void;
  canUndo: boolean;
  onNewGame: () => void;
}) {
  const { s, dispatch } = props;
  const seat = activeSeat(s);
  const me = s.players[seat];
  const botActing = isBotTurn(s);
  const [selected, setSelected] = useState<number | null>(null);
  const names = s.players.map((p) => p.name);
  const colors = s.players.map((p) => p.color);
  const hand = handOf(s, seat);
  const span = currentSpan(s);

  useEffect(() => {
    if (s.passPending || s.over || botActing || s.pending) setSelected(null);
  }, [s.passPending, s.over, botActing, s.pending, seat]);

  const onPlace = (cell: Cell) => {
    if (selected === null) return;
    dispatch({ a: "place", tile: selected, cell });
    setSelected(null);
  };

  const dump = () =>
    downloadJson(buildDump(s, props.actions), "playtest.json");

  return (
    <div className="game">
      <div className="hud">
        <div className="turninfo">
          <span className="big">TURN {s.flow.turn}</span>
          <span style={{ color: me.color }}>
            {me.isBot ? "🤖 " : ""}
            {me.name}
          </span>
          <span style={{ color: "var(--dim)" }}>
            deck {count(s.zones, "deck")} · span {span.w}×{span.h} / {s.limit.w}×
            {s.limit.h}
          </span>
        </div>
        {s.players.map((p, i) => (
          <div
            key={i}
            className={"pcard" + (i === seat ? " active" : "")}
            style={{ ["--pc" as any]: p.color }}
          >
            <div className="pname">
              {p.isBot ? "🤖 " : ""}
              {p.name}
            </div>
            <div className="pstats">
              <span>{pts(p)} pts</span>
              <span>🁢 {handOf(s, i).length}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mid">
        <div className="gridwrap">
          <BoardView s={s} selected={selected} onPlace={onPlace} />
          {botActing && !s.passPending && !s.over && (
            <div className="botbanner">
              🤖 {s.players[seatOnClock(s)].name} is playing…
            </div>
          )}
          {s.pending && !botActing && (
            <PendingPrompt
              pending={s.pending}
              names={names}
              colors={colors}
              onAnswer={(ans) => dispatch({ a: "answer", ans })}
            />
          )}
        </div>
        <div className="side">
          <div className="tabs">
            <button className="on">LOG</button>
          </div>
          <div className="logbody">
            {s.log.map((l, i) => (
              <div className="logrow" key={i}>
                <span className="lt">T{l.turn}</span>{" "}
                {l.p !== null && (
                  <span style={{ color: s.players[l.p].color }}>
                    {s.players[l.p].name}{" "}
                  </span>
                )}
                {l.msg}
              </div>
            ))}
          </div>
          <div style={{ padding: 8, borderTop: "1px solid var(--line)" }}>
            <button className="primary" style={{ width: "100%" }} onClick={dump}>
              ⬇ DUMP JSON
            </button>
          </div>
        </div>
      </div>

      <div className="bottombar">
        <div className="handwrap">
          <div className="handlabel">HAND — {me.name}</div>
          {me.isBot ? (
            <div className="botthinking">🤖 {me.name}'s hand is hidden.</div>
          ) : (
            <div className="hand">
              {hand.map((id) => (
                <div
                  key={id}
                  className={"ctile" + (selected === id ? " selected" : "")}
                  onClick={() =>
                    !s.passPending &&
                    !s.pending &&
                    setSelected(selected === id ? null : id)
                  }
                >
                  {s.tiles[id].value}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="actionstack">
          <button disabled={!props.canUndo} onClick={props.undo}>
            ⎌ UNDO
          </button>
          <button className="danger" onClick={props.onNewGame}>
            ✦ NEW GAME
          </button>
        </div>
      </div>

      {s.passPending && !s.over && !me.isBot && (
        <div className="passover" style={{ ["--pc" as any]: me.color }}>
          <div style={{ color: "var(--dim)", letterSpacing: 6 }}>
            TURN {s.flow.turn}
          </div>
          <div className="whom">→ {me.name}</div>
          <button
            className="primary"
            style={{ fontSize: 16, padding: "10px 30px" }}
            onClick={() => dispatch({ a: "beginTurn" })}
          >
            I'M {me.name.toUpperCase()} — CONTINUE
          </button>
          <button disabled={!props.canUndo} onClick={props.undo}>
            ⎌ undo last action
          </button>
        </div>
      )}

      {s.over && s.result && (
        <div className="gameover">
          <div className="goc">
            <h2>GAME OVER</h2>
            <div style={{ color: "var(--dim)", marginBottom: 10 }}>
              {s.result.reason}
            </div>
            {s.result.ranking.map((pi, rank) => (
              <div
                className="gorow"
                key={pi}
                style={{ ["--pc" as any]: s.players[pi].color }}
              >
                <span className="rk">
                  {s.result!.winners.includes(pi) ? "★" : `#${rank + 1}`}
                </span>
                <span className="gpname">{s.players[pi].name}</span>
                <span>
                  <b>{pts(s.players[pi])} pts</b>
                  <span style={{ color: "var(--dim)", fontSize: 11 }}>
                    {" "}
                    {Object.entries(s.players[pi].score)
                      .map(([k, v]) => `${k} ${v}`)
                      .join(" · ")}
                  </span>
                </span>
              </div>
            ))}
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button className="primary" onClick={dump}>
                ⬇ DUMP STATS
              </button>
              <button onClick={props.undo}>⎌ back (undo)</button>
              <button className="danger" onClick={props.onNewGame}>
                ✦ NEW GAME
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
