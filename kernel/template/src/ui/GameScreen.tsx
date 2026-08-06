// In-game layout: HUD, board, hand, log, and the hotseat / game-over
// overlays. All interaction funnels into props.dispatch(Action); this
// component holds only view state (which piece is selected).

import { useEffect, useState } from "react";
import BoardView from "./BoardView";
import { buildDump, downloadJson } from "./dump";
import type { Cell } from "../data/config";
import { isBotTurn } from "../game/bot";
import type { Action, GameState } from "../game/engine";

export default function GameScreen(props: {
  s: GameState;
  dispatch: (a: Action) => void;
  undo: () => void;
  canUndo: boolean;
  onNewGame: () => void;
}) {
  const { s, dispatch } = props;
  const me = s.players[s.turn.p];
  const botActing = isBotTurn(s);
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    if (s.passPending || s.over || botActing) setSelected(null);
  }, [s.passPending, s.over, botActing, s.turn.p]);

  const onPlace = (cell: Cell) => {
    if (selected === null) return;
    dispatch({ a: "place", tile: selected, cell });
    setSelected(null);
  };

  return (
    <div className="game">
      <div className="hud">
        <div className="turninfo">
          <span className="big">TURN {s.turn.n}</span>
          <span style={{ color: me.color }}>
            {me.isBot ? "🤖 " : ""}
            {me.name}
          </span>
          <span style={{ color: "var(--dim)" }}>
            deck {s.deck.length} · span{" "}
            {s.extent ? s.extent.maxX - s.extent.minX + 1 : 0}×
            {s.extent ? s.extent.maxY - s.extent.minY + 1 : 0} / {s.limit.w}×
            {s.limit.h}
          </span>
        </div>
        {s.players.map((p, i) => (
          <div
            key={i}
            className={"pcard" + (i === s.turn.p ? " active" : "")}
            style={{ ["--pc" as any]: p.color }}
          >
            <div className="pname">
              {p.isBot ? "🤖 " : ""}
              {p.name}
            </div>
            <div className="pstats">
              <span>{p.pts} pts</span>
              <span>🁢 {p.hand.length}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mid">
        <div className="gridwrap">
          <BoardView s={s} selected={selected} onPlace={onPlace} />
          {botActing && !s.passPending && !s.over && (
            <div className="botbanner">🤖 {me.name} is playing…</div>
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
            <button
              className="primary"
              style={{ width: "100%" }}
              onClick={() => downloadJson(buildDump(s), "playtest.json")}
            >
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
              {me.hand.map((id) => (
                <div
                  key={id}
                  className={"ctile" + (selected === id ? " selected" : "")}
                  onClick={() =>
                    !s.passPending && setSelected(selected === id ? null : id)
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
            TURN {s.turn.n}
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

      {s.over && (
        <div className="gameover">
          <div className="goc">
            <h2>GAME OVER</h2>
            {(s.ranking ?? s.players.map((_, i) => i)).map((pi, rank) => (
              <div
                className="gorow"
                key={pi}
                style={{ ["--pc" as any]: s.players[pi].color }}
              >
                <span className="rk">#{rank + 1}</span>
                <span className="gpname">{s.players[pi].name}</span>
                <span>
                  <b>{s.players[pi].pts} pts</b>
                </span>
              </div>
            ))}
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button
                className="primary"
                onClick={() => downloadJson(buildDump(s), "playtest.json")}
              >
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
