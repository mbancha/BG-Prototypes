// Pan/zoom board on an unbounded grid: drag to pan, wheel to zoom about the
// cursor, click a cell to place the selected piece. The dashed rectangle is
// the playable envelope (how much room the column/row limit leaves).
//
// This file is mostly reusable as-is; the piece rendering inside `.gcard` is
// the part you replace.

import { useEffect, useRef, useState } from "react";
import { cellKey, type Cell } from "../kernel/board";
import { envelope, placementCheck, type GameState } from "../game/engine";

export const CS = 76; // cell size in px (world units; zoom scales it)

export default function BoardView(props: {
  s: GameState;
  selected: number | null;
  onPlace: (c: Cell) => void;
}) {
  const { s } = props;
  const vpRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ x: 0, y: 0, z: 1 });
  const [hover, setHover] = useState<Cell | null>(null);
  const drag = useRef<{
    sx: number;
    sy: number;
    vx: number;
    vy: number;
    moved: boolean;
  } | null>(null);

  useEffect(() => {
    const el = vpRef.current;
    if (el)
      setView({
        x: el.clientWidth / 2 - CS / 2,
        y: el.clientHeight / 2 - CS / 2,
        z: 1,
      });
  }, []);

  useEffect(() => {
    const el = vpRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const sx = e.clientX - r.left;
      const sy = e.clientY - r.top;
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
    const r = vpRef.current!.getBoundingClientRect();
    return {
      x: Math.floor((e.clientX - r.left - view.x) / view.z / CS),
      y: Math.floor((e.clientY - r.top - view.y) / view.z / CS),
    };
  };

  const env = envelope(s);
  const ghostOk = hover ? placementCheck(s, hover).ok : false;

  return (
    <div
      ref={vpRef}
      className="gridvp"
      onPointerDown={(e) => {
        (e.target as Element).setPointerCapture?.(e.pointerId);
        drag.current = {
          sx: e.clientX,
          sy: e.clientY,
          vx: view.x,
          vy: view.y,
          moved: false,
        };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
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
        const d = drag.current;
        drag.current = null;
        if (d?.moved) return; // that was a pan
        if (props.selected !== null) props.onPlace(toCell(e));
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
        style={{
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.z})`,
        }}
      >
        {env && (
          <div
            className="boardwall"
            style={{
              left: env.minX * CS,
              top: env.minY * CS,
              width: (env.maxX - env.minX + 1) * CS - 2,
              height: (env.maxY - env.minY + 1) * CS - 2,
            }}
          />
        )}
        {Object.entries(s.placedAt).map(([id, c]) => (
          <div
            key={id}
            className="gcard"
            style={{ left: c.x * CS, top: c.y * CS, width: CS - 2, height: CS - 2 }}
          >
            {/* TODO: render your actual component face here */}
            {s.tiles[+id].value}
          </div>
        ))}
        {props.selected !== null && hover && (
          <div
            className={"ghostcell" + (ghostOk ? "" : " invalid")}
            style={{
              left: hover.x * CS,
              top: hover.y * CS,
              width: CS - 2,
              height: CS - 2,
            }}
          >
            {s.tiles[props.selected].value}
          </div>
        )}
        {!s.extent && (
          <div
            className="origin"
            style={{ left: 0, top: 0, width: CS - 1, height: CS - 1 }}
          >
            ⌖
          </div>
        )}
      </div>
      {props.selected !== null && (
        <div className="placebox">
          click a cell to place · {s.cellOwner[cellKey({ x: 0, y: 0 })] === undefined
            ? "the first piece goes anywhere"
            : "must touch an existing piece"}
        </div>
      )}
    </div>
  );
}
