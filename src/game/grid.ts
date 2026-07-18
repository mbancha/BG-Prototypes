// =============================================================================
// Domino geometry over the unbounded grid. Pure queries — nothing in here
// mutates GameState. The board is sparse: s.board (card id → Placed) plus
// s.cellOwner ("x,y" → card id) kept in sync by turn.ts/actPlace.
// Everything match- and enclosure-related starts from these functions.
// =============================================================================

import type { Cell, GameState, Placed, Sym } from "./types";
import { cellKey } from "./types";
import { def } from "./cards";

/**
 * Rotation: `rot` clockwise quarter-turns from the base vertical orientation
 * (top half `a` above bottom half `b`).
 *   rot 0: b below a      rot 1: b left of a
 *   rot 2: b above a      rot 3: b right of a
 */
export const B_OFFSET: Cell[] = [
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 0, y: -1 },
  { x: 1, y: 0 },
];

export const ORTHO: Cell[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

export function cellsFor(a: Cell, rot: number): [Cell, Cell] {
  const o = B_OFFSET[((rot % 4) + 4) % 4];
  return [a, { x: a.x + o.x, y: a.y + o.y }];
}

export function cardAt(s: GameState, c: Cell): Placed | null {
  const id = s.cellOwner[cellKey(c)];
  return id === undefined ? null : s.board[id];
}

/** Symbol shown on all outward edges of the given occupied cell. */
export function symbolAt(s: GameState, c: Cell): Sym | null {
  const p = cardAt(s, c);
  if (!p) return null;
  const d = def(p.id);
  return c.x === p.a.x && c.y === p.a.y ? d.top : d.bottom;
}

export interface EdgeMatch {
  sym: Sym;
  placed: number; // placed card id
  other: number; // existing neighbor card id
  myCell: Cell;
  theirCell: Cell;
}

/**
 * All symbol matches a card placed at (a,rot) would trigger, one per pair of
 * touching cell edges. The internal edge between the domino's own halves is
 * skipped. Works both for preview (card not yet on grid) and post-placement.
 */
export function matchesFor(
  s: GameState,
  cardId: number,
  a: Cell,
  rot: number,
): EdgeMatch[] {
  const d = def(cardId);
  const [ca, cb] = cellsFor(a, rot);
  const halves: { cell: Cell; sym: Sym }[] = [
    { cell: ca, sym: d.top },
    { cell: cb, sym: d.bottom },
  ];
  const out: EdgeMatch[] = [];
  for (const h of halves) {
    const partner = h.cell === ca ? cb : ca;
    for (const o of ORTHO) {
      const n = { x: h.cell.x + o.x, y: h.cell.y + o.y };
      if (n.x === partner.x && n.y === partner.y) continue; // internal edge
      const neighbor = cardAt(s, n);
      if (!neighbor || neighbor.id === cardId) continue;
      const theirSym = symbolAt(s, n);
      if (theirSym === h.sym) {
        out.push({
          sym: h.sym,
          placed: cardId,
          other: neighbor.id,
          myCell: h.cell,
          theirCell: n,
        });
      }
    }
  }
  return out;
}

/** Cells orthogonally adjacent to the domino (up to 6), excluding its own two. */
export function surroundingCells(p: Placed): Cell[] {
  const own = new Set([cellKey(p.a), cellKey(p.b)]);
  const seen = new Set<string>();
  const out: Cell[] = [];
  for (const c of [p.a, p.b]) {
    for (const o of ORTHO) {
      const n = { x: c.x + o.x, y: c.y + o.y };
      const k = cellKey(n);
      if (own.has(k) || seen.has(k)) continue;
      seen.add(k);
      out.push(n);
    }
  }
  return out;
}

export function isEnclosed(s: GameState, p: Placed): boolean {
  return surroundingCells(p).every((c) => s.cellOwner[cellKey(c)] !== undefined);
}

/** Unscored cards currently fully surrounded. */
export function findEnclosed(s: GameState): number[] {
  const out: number[] = [];
  for (const id of Object.keys(s.board).map(Number)) {
    const p = s.board[id];
    if (!p.scored && isEnclosed(s, p)) out.push(id);
  }
  return out;
}

/** Card ids sharing at least one cell edge with the given card. */
export function adjacentCards(s: GameState, id: number): number[] {
  const p = s.board[id];
  if (!p) return [];
  const set = new Set<number>();
  for (const c of surroundingCells(p)) {
    const n = cardAt(s, c);
    if (n && n.id !== id) set.add(n.id);
  }
  return [...set];
}

export function areAdjacent(s: GameState, idA: number, idB: number): boolean {
  return adjacentCards(s, idA).includes(idB);
}

/** Validity of placing a card with top-half at `a`, rotation `rot`. */
export function placementCheck(
  s: GameState,
  a: Cell,
  rot: number,
): { ok: boolean; reason?: string } {
  const [ca, cb] = cellsFor(a, rot);
  for (const c of [ca, cb]) {
    if (s.cellOwner[cellKey(c)] !== undefined)
      return { ok: false, reason: "Cell occupied" };
  }
  if (s.turn.setup) {
    const coversOrigin =
      (ca.x === 0 && ca.y === 0) || (cb.x === 0 && cb.y === 0);
    return coversOrigin
      ? { ok: true }
      : { ok: false, reason: "First card must cover the origin cell" };
  }
  // must share an edge with an existing card
  for (const c of [ca, cb]) {
    for (const o of ORTHO) {
      const n = { x: c.x + o.x, y: c.y + o.y };
      if (n.x === ca.x && n.y === ca.y) continue;
      if (n.x === cb.x && n.y === cb.y) continue;
      if (s.cellOwner[cellKey(n)] !== undefined) return { ok: true };
    }
  }
  return { ok: false, reason: "Must touch an existing card" };
}
