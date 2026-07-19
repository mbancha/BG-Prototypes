// =============================================================================
// Main in-game layout: HUD (per-player status cards) on top, grid + side
// panel in the middle, hand + action buttons at the bottom, plus the
// pass-the-device and game-over overlays.
//
// All interaction funnels into props.dispatch(Action) — this component holds
// only view state (which card is armed for placement). Bot turns: when the
// pending decision belongs to a bot (isBotTurn), every control is disabled
// and the bot banner is shown; App.tsx's driver advances the game.
// =============================================================================

import { useCallback, useEffect, useState } from "react";
import { CONFIG } from "../data/config";
import {
  def,
  isDisabled,
  KIND_GLYPH,
  KIND_NAME,
  SYM_GLYPH,
  TYPE_ICON,
} from "../game/cards";
import { isBotTurn } from "../game/bot";
import { placementCheck } from "../game/grid";
import { deployDiscount, seesHands } from "../game/ongoing";
import type { Action } from "../game/turn";
import type { Cell, GameState } from "../game/types";
import GridView from "./GridView";
import PendingPanel from "./PendingPanel";
import SidePanel from "./SidePanel";
import { buildDump, downloadJson } from "./dump";

export default function GameScreen(props: {
  s: GameState;
  dispatch: (a: Action) => void;
  undo: () => void;
  canUndo: boolean;
  onNewGame: () => void;
}) {
  const { s, dispatch } = props;
  const [placing, setPlacing] = useState<{ card: number; rot: number } | null>(
    null,
  );

  const busy = s.exec.length > 0 || s.pending !== null;
  const me = s.players[s.turn.p];
  const botActing = isBotTurn(s); // a bot is on the clock — spectate mode

  // leave placement mode whenever the turn/pending situation changes under us
  useEffect(() => {
    if (busy || s.passPending || s.over) setPlacing(null);
  }, [busy, s.passPending, s.over, s.turn.p]);
  useEffect(() => {
    if (placing && !me.hand.includes(placing.card)) setPlacing(null);
  }, [me.hand, placing]);

  const rotate = useCallback(
    () => setPlacing((p) => (p ? { ...p, rot: (p.rot + 1) % 4 } : p)),
    [],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "r" || e.key === "R") rotate();
      if (e.key === "Escape") setPlacing(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rotate]);

  const onPlaceAt = (cell: Cell) => {
    if (!placing) return;
    const ok = placementCheck(s, cell, placing.rot).ok;
    dispatch({ a: "place", card: placing.card, at: cell, rot: placing.rot });
    if (ok) setPlacing(null);
  };

  const canPlaceNow =
    !busy && !s.passPending && !s.over && !s.turn.placed && !botActing;
  const canDeployNow =
    !busy &&
    !s.passPending &&
    !s.over &&
    !s.turn.setup &&
    !s.turn.deployed &&
    !botActing;
  const canEndTurn =
    !busy &&
    !s.passPending &&
    !s.over &&
    !s.turn.setup &&
    !botActing &&
    (s.turn.placed || me.hand.length === 0);

  // clickable grid targets for "choose a card" prompts (humans only)
  const pendingIds = s.pending?.t === "card" && !botActing ? s.pending.ids : [];
  const showOpp = seesHands(s, s.turn.p) && !s.passPending && !me.isBot;

  return (
    <div className="game">
      {/* ------------- HUD ------------- */}
      <div className="hud">
        <div className="turninfo">
          <span className="big">
            {s.turn.setup ? "OPENING" : `TURN ${s.turn.n}`}
          </span>
          <span style={{ color: me.color }}>
            {me.isBot ? "🤖 " : ""}
            {me.name}
          </span>
          <span style={{ color: "var(--dim)" }}>
            deck {s.deck.length} · discard {s.discard.length}
          </span>
          {s.finalPhase && !s.over && (
            <span className="finalbanner">
              FINAL TURNS: {s.finalPhase.remaining}
            </span>
          )}
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
              <span>${p.money}</span>
              <span>{p.pts} pts</span>
              <span title="influence supply remaining">◉ {p.supply}</span>
              <span title="cards in hand">🂠 {p.hand.length}</span>
            </div>
            <div className="tableau">
              {p.tableau.map((id) => (
                <span
                  key={id}
                  className={"tchip" + (isDisabled(id) ? " off" : "")}
                >
                  {def(id).name}
                  <span className="tip">
                    <b>{def(id).name}</b> — {def(id).text}
                    {isDisabled(id) ? " [DISABLED]" : ""}
                  </span>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ------------- GRID + SIDE ------------- */}
      <div className="mid">
        <div className="gridwrap">
          <GridView
            s={s}
            placing={placing}
            onPlaceAt={onPlaceAt}
            pendingIds={pendingIds}
            onPickCard={(id) => dispatch({ a: "answer", ans: { card: id } })}
          />
          {/* humans get the interactive prompt panel; bots answer themselves */}
          {!s.passPending && !botActing && (
            <PendingPanel s={s} answer={(ans) => dispatch({ a: "answer", ans })} />
          )}
          {!s.passPending && botActing && !s.over && (
            <div className="botbanner">
              🤖 {s.players[s.turn.p].name} is playing…
            </div>
          )}
          {s.turn.setup && !s.passPending && !botActing && (
            <div
              className="placebox"
              style={{ top: 10, bottom: "auto", borderColor: "var(--ok)" }}
            >
              OPENING PLACEMENT — pick a card below and place it covering the ⌖
              origin cell. It gets {CONFIG.BASELINE_INFLUENCE} of your influence;
              then you draw back up.
            </div>
          )}
        </div>
        <SidePanel s={s} />
      </div>

      {/* ------------- HAND / ACTIONS ------------- */}
      <div className="bottombar">
        <div className="handwrap">
          {showOpp && (
            <div className="opphands">
              {s.players.map((p, i) =>
                i === s.turn.p ? null : (
                  <div className="oppmini" key={i}>
                    <span style={{ color: p.color }}>{p.name} (Open Feed): </span>
                    {p.hand.length === 0
                      ? "—"
                      : p.hand
                          .map((id) => `${TYPE_ICON[def(id).type]}${def(id).name}`)
                          .join(" · ")}
                  </div>
                ),
              )}
            </div>
          )}
          <div className="handlabel">
            HAND — {me.name} ({me.hand.length} · refills to{" "}
            {CONFIG.HAND_REFILL})
          </div>
          {me.isBot ? (
            // never reveal a bot's hand to the humans at the table
            <div className="botthinking">
              🤖 {me.name}'s hand is hidden — the bot takes its turn
              automatically.
            </div>
          ) : (
            <div className="hand">
              {me.hand.map((id) => {
                const d = def(id);
                const cost = Math.max(0, d.cost - deployDiscount(s, s.turn.p));
                const off = isDisabled(id);
                return (
                  <div
                    key={id}
                    className={
                      "hcard" + (placing?.card === id ? " selected" : "")
                    }
                  >
                    {off && <span className="offbadge">EFFECT OFF</span>}
                    <div className="hd">
                      <span className="nm">
                        {TYPE_ICON[d.type]} {d.name}
                      </span>
                    </div>
                    <div className="meta">
                      <span>{d.type}</span>
                      <span>${d.cost}</span>
                      <span>{d.pts}★</span>
                      <span title={KIND_NAME[d.kind]}>{KIND_GLYPH[d.kind]}</span>
                    </div>
                    <div className="syms">
                      <span className="s" title="top half symbol">
                        {SYM_GLYPH[d.top]}
                      </span>
                      <span className="s" title="bottom half symbol">
                        {SYM_GLYPH[d.bottom]}
                      </span>
                    </div>
                    <div className="fx">{d.text}</div>
                    <div className="btns">
                      <button
                        disabled={!canPlaceNow}
                        onClick={() =>
                          setPlacing((p) =>
                            p?.card === id ? null : { card: id, rot: 0 },
                          )
                        }
                      >
                        {placing?.card === id ? "✕ cancel" : "⌗ place"}
                      </button>
                      <button
                        disabled={!canDeployNow || off || me.money < cost}
                        title={off ? "Effect disabled in cards.json" : d.text}
                        onClick={() => dispatch({ a: "deploy", card: id })}
                      >
                        ▲ deploy ${cost}
                      </button>
                    </div>
                  </div>
                );
              })}
              {me.hand.length === 0 && (
                <div style={{ color: "var(--dim)", padding: 20 }}>
                  hand empty — placement is skipped
                </div>
              )}
            </div>
          )}
        </div>
        <div className="actionstack">
          {placing && <button onClick={rotate}>⟳ rotate (R)</button>}
          <button
            className="primary"
            disabled={!canEndTurn}
            title={
              s.turn.placed || me.hand.length === 0
                ? "Draw up and pass"
                : "You must place a card first"
            }
            onClick={() => dispatch({ a: "endTurn" })}
          >
            ▶ END TURN
          </button>
          <button disabled={!props.canUndo} onClick={props.undo}>
            ⎌ UNDO
          </button>
          <button
            className="danger"
            onClick={() => {
              if (window.confirm("Abandon this game and return to setup?"))
                props.onNewGame();
            }}
          >
            ✦ NEW GAME
          </button>
        </div>
      </div>

      {/* ------------- OVERLAYS ------------- */}
      {/* pass screen for humans only — bot handoffs keep the board visible
          (the driver begins the bot's turn by itself) */}
      {s.passPending && !s.over && !me.isBot && (
        <div className="passover" style={{ ["--pc" as any]: me.color }}>
          <div style={{ color: "var(--dim)", letterSpacing: 6 }}>
            {s.turn.setup ? "OPENING PLACEMENT" : `TURN ${s.turn.n}`}
          </div>
          <div className="whom">→ {me.name}</div>
          <div style={{ color: "var(--dim)" }}>
            pass the device, then continue
          </div>
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
            {(s.ranking ?? s.players.map((_, i) => i)).map((pi, rank) => {
              const p = s.players[pi];
              const inf = Object.values(s.board)
                .filter((c) => !c.scored)
                .reduce((n, c) => n + c.inf[pi], 0);
              return (
                <div
                  className="gorow"
                  key={pi}
                  style={{ ["--pc" as any]: p.color }}
                >
                  <span className="rk">#{rank + 1}</span>
                  <span className="gpname">
                    {p.isBot ? "🤖 " : ""}
                    {p.name}
                  </span>
                  <span>
                    <b>{p.pts} pts</b>
                  </span>
                  <span>${p.money}</span>
                  <span>{inf} influence on grid</span>
                </div>
              );
            })}
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button
                className="primary"
                onClick={() =>
                  downloadJson(buildDump(s), "spypunk-playtest.json")
                }
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
