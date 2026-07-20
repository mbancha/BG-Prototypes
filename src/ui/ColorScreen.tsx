// =============================================================================
// COLOR-GROUPS MODE screen — board, hand, overlays, mini log. One file on
// purpose: this mode is an experiment and should be easy to delete or fork.
// Pan/zoom interaction is a lightly trimmed copy of GridView's (kept
// separate so the two modes can't break each other).
//
// Turn shape here: pass screen → click a hand tile → click a cell. That's
// the whole turn — matches, merges, sealing and scoring resolve instantly
// and the game auto-advances to the next pass screen. No prompts exist.
// =============================================================================

import { useEffect, useRef, useState } from "react";
import { COLOR_CFG, COLOR_DEFS, CONFIG } from "../data/config";
import type {
  ColorAction,
  ColorKey,
  ColorState,
} from "../color/engine";
import {
  cellsFor,
  groupValue,
  isColorBotTurn,
  openPerimeter,
  placementCheckC,
  previewMatches,
} from "../color/engine";
import type { Cell } from "../game/types";
import { cellKey } from "../game/types";
import { downloadJson } from "./dump";

const CS = 84;
const DEF: Record<ColorKey, (typeof COLOR_DEFS)[number]> = Object.fromEntries(
  COLOR_DEFS.map((d) => [d.key, d]),
) as any;

export default function ColorScreen(props: {
  s: ColorState;
  dispatch: (a: ColorAction) => void;
  undo: () => void;
  canUndo: boolean;
  onNewGame: () => void;
}) {
  const { s, dispatch } = props;
  const me = s.players[s.turn.p];
  const botActing = isColorBotTurn(s);
  const [placing, setPlacing] = useState<{ tile: number; rot: number } | null>(
    null,
  );
  const vpRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ x: 0, y: 0, z: 1 });
  const [hover, setHover] = useState<Cell | null>(null);
  const dragRef = useRef<{ sx: number; sy: number; vx: number; vy: number; moved: boolean } | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (s.passPending || s.over) setPlacing(null);
  }, [s.passPending, s.over, s.turn.p]);
  useEffect(() => {
    const el = vpRef.current;
    if (el)
      setView({ x: el.clientWidth / 2 - CS / 2, y: el.clientHeight / 2 - CS, z: 1 });
  }, []);
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [s.log.length]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "r" || e.key === "R")
        setPlacing((p) => (p ? { ...p, rot: (p.rot + 1) % 4 } : p));
      if (e.key === "Escape") setPlacing(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    const el = vpRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      setView((v) => {
        const nz = Math.min(2.5, Math.max(0.3, v.z * (e.deltaY < 0 ? 1.12 : 0.89)));
        return { x: sx - ((sx - v.x) * nz) / v.z, y: sy - ((sy - v.y) * nz) / v.z, z: nz };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const toCell = (e: { clientX: number; clientY: number }): Cell => {
    const rect = vpRef.current!.getBoundingClientRect();
    return {
      x: Math.floor((e.clientX - rect.left - view.x) / view.z / CS),
      y: Math.floor((e.clientY - rect.top - view.y) / view.z / CS),
    };
  };

  // ghost preview
  let ghost: { cells: [Cell, Cell]; ok: boolean; reason?: string } | null = null;
  let pv = { a: false, b: false };
  if (placing && hover && !botActing) {
    const check = placementCheckC(s, hover, placing.rot);
    ghost = { cells: cellsFor(hover, placing.rot), ok: check.ok, reason: check.reason };
    if (check.ok) pv = previewMatches(s, placing.tile, hover, placing.rot);
  }
  const pt = placing ? s.tiles[placing.tile] : null;

  // group render data: anchor cell (top-left-most) per unscored/scored group
  const badges = Object.values(s.groups).map((g) => {
    let ax = Infinity;
    let ay = Infinity;
    for (const ck of g.cells) {
      const [x, y] = ck.split(",").map(Number);
      if (y < ay || (y === ay && x < ax)) {
        ax = x;
        ay = y;
      }
    }
    return { g, ax, ay, open: g.scored ? 0 : openPerimeter(s, g.cells).length };
  });

  return (
    <div className="game">
      {/* ---- HUD ---- */}
      <div className="hud">
        <div className="turninfo">
          <span className="big">{s.turn.setup ? "OPENING" : `TURN ${s.turn.n}`}</span>
          <span style={{ color: me.color }}>
            {me.isBot ? "🤖 " : ""}
            {me.name}
          </span>
          <span style={{ color: "var(--dim)" }}>
            deck {s.deck.length} · {s.variant.scoring === "fixed" ? `groups =${COLOR_CFG.GROUP_SCORE_FIXED}` : "groups = size"}
            {s.variant.specials ? " · ★" : ""}
            {s.variant.powers ? " · powers" : ""}
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
              <span title="influence supply remaining">◉ {p.supply}</span>
              <span title="tiles in hand">🁢 {p.hand.length}</span>
            </div>
          </div>
        ))}
        {s.variant.powers && (
          <div className="powerkey">
            {COLOR_DEFS.map((d) => (
              <span key={d.key} style={{ color: d.hex }} title={powerText(d.key)}>
                {d.glyph} {d.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ---- GRID + LOG ---- */}
      <div className="mid">
        <div className="gridwrap">
          <div
            ref={vpRef}
            className="gridvp"
            onPointerDown={(e) => {
              (e.target as Element).setPointerCapture?.(e.pointerId);
              dragRef.current = { sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y, moved: false };
            }}
            onPointerMove={(e) => {
              const d = dragRef.current;
              if (d) {
                const dx = e.clientX - d.sx;
                const dy = e.clientY - d.sy;
                if (d.moved || Math.hypot(dx, dy) > 5) {
                  d.moved = true;
                  setView((v) => ({ ...v, x: d.vx + dx, y: d.vy + dy }));
                }
              }
              setHover(toCell(e));
            }}
            onPointerUp={(e) => {
              const d = dragRef.current;
              dragRef.current = null;
              if (d && d.moved) return;
              if (placing && !botActing) {
                const cell = toCell(e);
                const ok = placementCheckC(s, cell, placing.rot).ok;
                dispatch({ a: "place", tile: placing.tile, at: cell, rot: placing.rot });
                if (ok) setPlacing(null);
              }
            }}
            style={{
              backgroundImage:
                "linear-gradient(#101827 1px, transparent 1px), linear-gradient(90deg, #101827 1px, transparent 1px)",
              backgroundSize: `${CS * view.z}px ${CS * view.z}px`,
              backgroundPosition: `${view.x}px ${view.y}px`,
            }}
          >
            <div
              className="world"
              style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.z})` }}
            >
              <div className="origin" style={{ left: 0, top: 0, width: CS - 1, height: CS - 1 }}>
                ⌖
              </div>
              {Object.values(s.board).map((pl) => {
                const t = s.tiles[pl.id];
                return [
                  { c: pl.cellA, color: t.a },
                  { c: pl.cellB, color: t.b },
                ].map((h, i) => {
                  const scored = s.groups[s.cellGroup[cellKey(h.c)]]?.scored;
                  return (
                    <div
                      key={pl.id + ":" + i}
                      className={"chalf" + (scored ? " scored" : "")}
                      style={{
                        left: h.c.x * CS,
                        top: h.c.y * CS,
                        width: CS - 2,
                        height: CS - 2,
                        ["--ch" as any]: DEF[h.color].hex,
                      }}
                    >
                      {DEF[h.color].glyph}
                      {t.bonus && <span className="bchip">★+{t.bonus}</span>}
                    </div>
                  );
                });
              })}
              {badges.map(({ g, ax, ay, open }) => (
                <div
                  key={g.id}
                  className={"gbadge" + (g.scored ? " done" : "")}
                  style={{ left: ax * CS + 3, top: ay * CS + 3, ["--ch" as any]: DEF[g.color].hex }}
                  title={
                    g.scored
                      ? `scored: ${g.scoredLabel}`
                      : `${DEF[g.color].name} group — ${g.cells.length} cells, worth ${groupValue(s, g)}, ${open} open side${open === 1 ? "" : "s"}`
                  }
                >
                  {g.scored ? (
                    <span>✔ {g.scoredLabel}</span>
                  ) : (
                    <>
                      <span className="gv">={groupValue(s, g)}</span>
                      {s.players.map((p, q) =>
                        g.inf[q] > 0 ? (
                          <span key={q} className="dot" style={{ ["--pc" as any]: p.color }}>
                            {g.inf[q]}
                          </span>
                        ) : null,
                      )}
                      <span className="gopen" title="empty cells still open around this group">
                        ◌{open}
                      </span>
                    </>
                  )}
                </div>
              ))}
              {ghost &&
                pt &&
                ghost.cells.map((c, i) => (
                  <div
                    key={i}
                    className={"ghostcell" + (ghost!.ok ? "" : " invalid")}
                    style={{
                      left: c.x * CS,
                      top: c.y * CS,
                      width: CS - 2,
                      height: CS - 2,
                      color: DEF[i === 0 ? pt.a : pt.b].hex,
                    }}
                  >
                    {DEF[i === 0 ? pt.a : pt.b].glyph}
                    {(i === 0 ? pv.a : pv.b) ? "+" : ""}
                  </div>
                ))}
            </div>

            {placing && pt && (
              <div className="placebox">
                <div>
                  <b>
                    {DEF[pt.a].name}/{DEF[pt.b].name}
                    {pt.bonus ? ` ★+${pt.bonus}` : ""}
                  </b>{" "}
                  — <b>R</b> rotates · click to place · Esc cancels
                </div>
                {ghost && !ghost.ok && <div className="invalid">✕ {ghost.reason}</div>}
                {ghost?.ok && (
                  <div style={{ color: "var(--dim)" }}>
                    {pv.a || pv.b
                      ? pt.bonus
                        ? `extends ${[pv.a, pv.b].filter(Boolean).length} group(s) — adds +${pt.bonus} value, no influence`
                        : `matches ${[pv.a, pv.b].filter(Boolean).length} group(s) → influence`
                      : "no matches here — no influence"}
                  </div>
                )}
              </div>
            )}
            {botActing && !s.passPending && !s.over && (
              <div className="botbanner">🤖 {me.name} is playing…</div>
            )}
          </div>
        </div>
        <div className="side">
          <div className="tabs">
            <button className="on">LOG</button>
          </div>
          <div className="logbody" ref={logRef}>
            {s.log.map((l, i) => (
              <div className="logrow" key={i}>
                <span className="lt">T{l.turn}</span>{" "}
                {l.p !== null && (
                  <span style={{ color: s.players[l.p].color }}>{s.players[l.p].name} </span>
                )}
                {l.msg}
              </div>
            ))}
          </div>
          <div style={{ padding: 8, borderTop: "1px solid var(--line)" }}>
            <button
              className="primary"
              style={{ width: "100%" }}
              onClick={() =>
                downloadJson(
                  {
                    mode: "colors",
                    variant: s.variant,
                    telemetry: s.telem,
                    players: s.players.map((p) => ({ name: p.name, pts: p.pts })),
                    log: s.log.map(
                      (l) => `[T${l.turn}] ${l.p !== null ? s.players[l.p].name + " " : ""}${l.msg}`,
                    ),
                  },
                  "spypunk-colors-playtest.json",
                )
              }
            >
              ⬇ DUMP JSON
            </button>
          </div>
        </div>
      </div>

      {/* ---- HAND ---- */}
      <div className="bottombar">
        <div className="handwrap">
          <div className="handlabel">
            HAND — {me.name} ({me.hand.length} · refills to {CONFIG.HAND_REFILL}) ·
            place a tile to end your turn
          </div>
          {me.isBot ? (
            <div className="botthinking">🤖 {me.name}'s hand is hidden.</div>
          ) : (
            <div className="hand">
              {me.hand.map((id) => {
                const t = s.tiles[id];
                return (
                  <div
                    key={id}
                    className={"ctile" + (placing?.tile === id ? " selected" : "")}
                    onClick={() =>
                      !botActing &&
                      !s.passPending &&
                      setPlacing((p) => (p?.tile === id ? null : { tile: id, rot: 0 }))
                    }
                  >
                    <div
                      className="cthalf"
                      style={{ ["--ch" as any]: DEF[t.a].hex }}
                    >
                      {DEF[t.a].glyph}
                      {t.bonus && <span className="bchip">★+{t.bonus}</span>}
                    </div>
                    <div
                      className="cthalf"
                      style={{ ["--ch" as any]: DEF[t.b].hex }}
                    >
                      {DEF[t.b].glyph}
                      {t.bonus && <span className="bchip">★+{t.bonus}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="actionstack">
          {placing && (
            <button onClick={() => setPlacing((p) => (p ? { ...p, rot: (p.rot + 1) % 4 } : p))}>
              ⟳ rotate (R)
            </button>
          )}
          <button disabled={!props.canUndo} onClick={props.undo}>
            ⎌ UNDO
          </button>
          <button
            className="danger"
            onClick={() => {
              if (window.confirm("Abandon this game and return to setup?")) props.onNewGame();
            }}
          >
            ✦ NEW GAME
          </button>
        </div>
      </div>

      {/* ---- OVERLAYS ---- */}
      {/* pass screen for humans only — bot handoffs keep the board visible
          (the driver begins the bot's turn by itself) */}
      {s.passPending && !s.over && !me.isBot && (
        <div className="passover" style={{ ["--pc" as any]: me.color }}>
          <div style={{ color: "var(--dim)", letterSpacing: 6 }}>
            {s.turn.setup ? "OPENING" : `TURN ${s.turn.n}`} · COLOR GROUPS
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
              <div className="gorow" key={pi} style={{ ["--pc" as any]: s.players[pi].color }}>
                <span className="rk">#{rank + 1}</span>
                <span className="gpname">
                  {s.players[pi].isBot ? "🤖 " : ""}
                  {s.players[pi].name}
                </span>
                <span>
                  <b>{s.players[pi].pts} pts</b>
                </span>
              </div>
            ))}
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
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

function powerText(key: ColorKey): string {
  switch (key) {
    case "red":
      return "Muscle: your match removes 1 influence from the group's leading opponent (adds if none)";
    case "green":
      return "Favor: your match adds 2 influence";
    case "gold":
      return "Credit: the group scores +2 bonus points";
    case "violet":
      return "Whisper: your match adds 1 influence to each group ADJACENT to the violet group (none to the violet group itself)";
    case "cyan":
      return "Intel: when the group scores, the runner-up also scores half";
  }
}
