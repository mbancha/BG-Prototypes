// =============================================================================
// The shared tableau: an unbounded pan/zoom grid of placed dominoes.
//
// Interactions handled here:
//   drag        → pan the view          wheel → zoom about the cursor
//   click cell  → place the armed card (placement mode, ghost preview shows
//                 legality + the symbol matches the spot would trigger)
//   click card  → answer a "choose a card" prompt (highlighted targets)
//
// Card face layout ("the picture is the type icon"):
//   • enlarged type icon centered across the whole domino
//   • card name in a thin plate along the side (left edge when vertical,
//     top edge when horizontal)
//   • each half's edge symbol pushed to its OUTER end (that's the edge that
//     can match a neighbor; the inner seam never matches)
//   • influence dots stacked on the opposite side from the nameplate
// Pure presentation — geometry/legality all comes from src/game/grid.ts.
// =============================================================================

import { useEffect, useRef, useState } from "react";
import { def, SYM_GLYPH, SYM_NAME, TYPE_ICON } from "../game/cards";
import { cellsFor, matchesFor, placementCheck } from "../game/grid";
import { creditValue, muscleCount, whisperMax } from "../game/ongoing";
import type { Cell, GameState, Placed, Sym } from "../game/types";
import { cellKey } from "../game/types";

export const CS = 84; // grid cell size in px (world units; zoom scales it)

function matchDesc(s: GameState, by: number, sym: Sym, otherName: string) {
  switch (sym) {
    case "muscle":
      return `remove ${muscleCount(s, by)} influence from either matched card`;
    case "intel":
      return `add 1 of your influence to ${otherName}`;
    case "favor":
      return `add 1 of your influence to your placed card`;
    case "credit":
      return `gain $${creditValue(s, by)}`;
    case "whisper":
      return `move ${whisperMax(s, by) > 1 ? "up to " + whisperMax(s, by) : "1"} influence between the matched cards`;
  }
}

/** One placed domino. See the file header for the face layout. */
function GCard(props: {
  s: GameState;
  p: Placed;
  target: boolean;
  onPick?: () => void;
}) {
  const { s, p } = props;
  const d = def(p.id);
  const x0 = Math.min(p.a.x, p.b.x);
  const y0 = Math.min(p.a.y, p.b.y);
  const w = (Math.abs(p.a.x - p.b.x) + 1) * CS;
  const h = (Math.abs(p.a.y - p.b.y) + 1) * CS;
  const vert = p.a.x === p.b.x; // false → the domino lies sideways

  return (
    <div
      className={
        "gcard" +
        (p.scored ? " scored" : "") +
        (props.target ? " target" : "")
      }
      data-o={vert ? "v" : "h"}
      style={{ left: x0 * CS, top: y0 * CS, width: w - 2, height: h - 2 }}
      onClick={props.target ? props.onPick : undefined}
    >
      {[
        { c: p.a, o: p.b, sym: d.top },
        { c: p.b, o: p.a, sym: d.bottom },
      ].map((half, i) => {
        // push each half's symbol toward its OUTER edge (away from the seam)
        const ox = Math.sign(half.c.x - half.o.x);
        const oy = Math.sign(half.c.y - half.o.y);
        return (
          <div
            key={i}
            className="half"
            style={{
              left: (half.c.x - x0) * CS,
              top: (half.c.y - y0) * CS,
              width: CS - 2,
              height: CS - 2,
              justifyContent:
                ox < 0 ? "flex-start" : ox > 0 ? "flex-end" : "center",
              alignItems: oy < 0 ? "flex-start" : oy > 0 ? "flex-end" : "center",
            }}
          >
            <span className="sym" title={`${SYM_NAME[half.sym]} edge`}>
              {SYM_GLYPH[half.sym]}
            </span>
          </div>
        );
      })}
      {/* enlarged type icon = the card's "art" */}
      <div className="bigicon" title={d.type}>
        {TYPE_ICON[d.type]}
      </div>
      <div className="nameplate">{d.name}</div>
      <div className="pts">{d.pts}★</div>
      {p.lockBy !== undefined && (
        <div className="lock" title={`Locked by ${s.players[p.lockBy].name} (Filibuster)`}>
          🔒
        </div>
      )}
      {p.scored && p.scoredInfo && (
        <div className="scoredbadge">SCORED · {p.scoredInfo.label}</div>
      )}
      {!p.scored && (
        <div className="dots">
          {s.players.map((pl, q) =>
            p.inf[q] > 0 ? (
              <span
                key={q}
                className="dot"
                style={{ ["--pc" as any]: pl.color }}
                title={`${pl.name}: ${p.inf[q]}`}
              >
                {p.inf[q]}
              </span>
            ) : null,
          )}
        </div>
      )}
    </div>
  );
}

export default function GridView(props: {
  s: GameState;
  placing: { card: number; rot: number } | null;
  onPlaceAt: (c: Cell) => void;
  pendingIds: number[];
  onPickCard: (id: number) => void;
}) {
  const { s, placing } = props;
  const vpRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ x: 0, y: 0, z: 1 });
  const [hover, setHover] = useState<Cell | null>(null);
  const dragRef = useRef<{
    sx: number;
    sy: number;
    vx: number;
    vy: number;
    moved: boolean;
  } | null>(null);
  const [dragging, setDragging] = useState(false);

  // center origin on mount
  useEffect(() => {
    const el = vpRef.current;
    if (el)
      setView({
        x: el.clientWidth / 2 - CS / 2,
        y: el.clientHeight / 2 - CS,
        z: 1,
      });
  }, []);

  // wheel zoom (non-passive so we can preventDefault)
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
        return {
          x: sx - ((sx - v.x) * nz) / v.z,
          y: sy - ((sy - v.y) * nz) / v.z,
          z: nz,
        };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const toCell = (e: { clientX: number; clientY: number }): Cell => {
    const rect = vpRef.current!.getBoundingClientRect();
    const wx = (e.clientX - rect.left - view.x) / view.z;
    const wy = (e.clientY - rect.top - view.y) / view.z;
    return { x: Math.floor(wx / CS), y: Math.floor(wy / CS) };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = {
      sx: e.clientX,
      sy: e.clientY,
      vx: view.x,
      vy: view.y,
      moved: false,
    };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (d) {
      const dx = e.clientX - d.sx;
      const dy = e.clientY - d.sy;
      if (d.moved || Math.hypot(dx, dy) > 5) {
        d.moved = true;
        setDragging(true);
        setView((v) => ({ ...v, x: d.vx + dx, y: d.vy + dy }));
      }
    }
    setHover(toCell(e));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = dragRef.current;
    dragRef.current = null;
    setDragging(false);
    if (d && d.moved) return; // it was a pan, not a click
    const cell = toCell(e);
    const id = s.cellOwner[cellKey(cell)];
    if (props.pendingIds.length > 0) {
      if (id !== undefined && props.pendingIds.includes(id)) props.onPickCard(id);
      return;
    }
    if (placing) props.onPlaceAt(cell);
  };

  // ghost preview of the armed card at the hovered cell
  let ghost: { cells: [Cell, Cell]; ok: boolean; reason?: string } | null = null;
  let previewMatches: ReturnType<typeof matchesFor> = [];
  if (placing && hover) {
    const check = placementCheck(s, hover, placing.rot);
    ghost = { cells: cellsFor(hover, placing.rot), ok: check.ok, reason: check.reason };
    if (check.ok)
      previewMatches = matchesFor(s, placing.card, hover, placing.rot);
  }
  const pd = placing ? def(placing.card) : null;

  return (
    <div
      ref={vpRef}
      className={"gridvp" + (dragging ? " dragging" : "")}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
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
        {Object.values(s.board).map((p) => (
          <GCard
            key={p.id}
            s={s}
            p={p}
            target={props.pendingIds.includes(p.id)}
            onPick={() => props.onPickCard(p.id)}
          />
        ))}
        {ghost &&
          ghost.cells.map((c, i) => (
            <div
              key={i}
              className={"ghostcell" + (ghost!.ok ? "" : " invalid")}
              style={{ left: c.x * CS, top: c.y * CS, width: CS - 2, height: CS - 2 }}
            >
              {pd && SYM_GLYPH[i === 0 ? pd.top : pd.bottom]}
            </div>
          ))}
        {ghost?.ok &&
          previewMatches.map((m, i) => (
            <div
              key={i}
              className="matchflag"
              style={{
                left: ((m.myCell.x + m.theirCell.x) / 2) * CS + CS / 2 - 12,
                top: ((m.myCell.y + m.theirCell.y) / 2) * CS + CS / 2 - 9,
              }}
            >
              {SYM_GLYPH[m.sym]}!
            </div>
          ))}
      </div>

      {placing && (
        <div className="placebox">
          <div>
            <b>{pd!.name}</b> — press <b>R</b> to rotate · click a cell to place
            · Esc to cancel
          </div>
          {ghost && !ghost.ok && (
            <div className="invalid">✕ {ghost.reason}</div>
          )}
          {ghost?.ok && previewMatches.length === 0 && (
            <div style={{ color: "var(--dim)" }}>No symbol matches here</div>
          )}
          {ghost?.ok &&
            previewMatches.map((m, i) => (
              <div key={i} className="mrow">
                {SYM_GLYPH[m.sym]} {SYM_NAME[m.sym]} vs {def(m.other).name} —{" "}
                {matchDesc(s, s.turn.p, m.sym, def(m.other).name)}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
