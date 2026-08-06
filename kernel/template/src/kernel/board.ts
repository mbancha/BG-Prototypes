// =============================================================================
// BOARD GEOMETRY — one node-key abstraction, five topologies, and the graph
// algorithms board games actually use.
//
// Every board in this repo is "some nodes, and which nodes touch which". Once
// a game says that much through a Topology, the algorithms below work
// unchanged, whether the board is a chessboard, a hex map, a rail network or
// a rondel:
//
//   squareGrid ... fixed w×h        tic-tac-toe, chess, Azul, roll-and-write
//   openGrid ..... unbounded        tile-laying: Carcassonne, Kingdomino
//   hexGrid ...... axial q,r        Catan-ish, Terra Mystica, war games
//   graph ........ named places     Ticket to Ride, Pandemic, point-to-point
//   track ........ a line or loop   rondels, race tracks, score/market tracks
//
// Node keys are strings so one set of algorithms serves all of them: "3,4" on
// a grid, "paris" on a map, "7" on a track. Keys go straight into state.
// =============================================================================

import type { Seat } from "./types";

export type NodeKey = string;

export interface Topology {
  /** Adjacent nodes that exist on this board. */
  neighbors(k: NodeKey): NodeKey[];
  /** Is this node on the board? Unbounded boards answer true to everything. */
  has(k: NodeKey): boolean;
  /** Every node, or null when the board is unbounded. */
  nodes(): NodeKey[] | null;
}

// ---------------------------------------------------------------------------
// Square grids
// ---------------------------------------------------------------------------

export interface Cell {
  x: number;
  y: number;
}

export const xy = (x: number, y: number): NodeKey => `${x},${y}`;
export const cellKey = (c: Cell): NodeKey => `${c.x},${c.y}`;

export function parseCell(k: NodeKey): Cell {
  const i = k.indexOf(",");
  return { x: Number(k.slice(0, i)), y: Number(k.slice(i + 1)) };
}

export const ORTHO: Cell[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

export const DIAGONAL: Cell[] = [
  { x: 1, y: -1 },
  { x: 1, y: 1 },
  { x: -1, y: 1 },
  { x: -1, y: -1 },
];

export interface GridOpts {
  /** 8-way adjacency instead of 4-way. */
  diagonals?: boolean;
  /** Edges wrap (a torus). Fixed grids only. */
  wrap?: boolean;
}

/** A fixed w×h board — the case the floating tile-laying board can't express.
 *  This is what tic-tac-toe, chess and every printed board need. */
export function squareGrid(w: number, h: number, opts: GridOpts = {}): Topology {
  const dirs = opts.diagonals ? [...ORTHO, ...DIAGONAL] : ORTHO;
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h;
  return {
    has: (k) => {
      const c = parseCell(k);
      return inside(c.x, c.y);
    },
    neighbors: (k) => {
      const c = parseCell(k);
      const out: NodeKey[] = [];
      for (const d of dirs) {
        let nx = c.x + d.x;
        let ny = c.y + d.y;
        if (opts.wrap) {
          nx = ((nx % w) + w) % w;
          ny = ((ny % h) + h) % h;
        }
        if (inside(nx, ny)) out.push(xy(nx, ny));
      }
      return out;
    },
    nodes: () => {
      const out: NodeKey[] = [];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out.push(xy(x, y));
      return out;
    },
  };
}

/** An unbounded grid — tile-laying games where the table is the board. Pair
 *  it with the extent helpers below to cap how far the layout may spread. */
export function openGrid(opts: GridOpts = {}): Topology {
  const dirs = opts.diagonals ? [...ORTHO, ...DIAGONAL] : ORTHO;
  return {
    has: () => true,
    neighbors: (k) => {
      const c = parseCell(k);
      return dirs.map((d) => xy(c.x + d.x, c.y + d.y));
    },
    nodes: () => null,
  };
}

// ---------------------------------------------------------------------------
// Hex grids (axial coordinates: key "q,r")
// ---------------------------------------------------------------------------

export const HEX_DIRS: Cell[] = [
  { x: 1, y: 0 },
  { x: 1, y: -1 },
  { x: 0, y: -1 },
  { x: -1, y: 0 },
  { x: -1, y: 1 },
  { x: 0, y: 1 },
];

/** Distance in hexes between two axial coordinates. */
export function hexDistance(a: NodeKey, b: NodeKey): number {
  const p = parseCell(a);
  const q = parseCell(b);
  return (
    (Math.abs(p.x - q.x) + Math.abs(p.x + p.y - q.x - q.y) + Math.abs(p.y - q.y)) /
    2
  );
}

/** `hexGrid({ radius: 2 })` → a hexagonal board; `hexGrid({ w, h })` → a
 *  rectangle of hexes. Keys are axial "q,r". */
export function hexGrid(
  spec: { radius: number } | { w: number; h: number },
): Topology {
  const list: NodeKey[] = [];
  if ("radius" in spec) {
    const n = spec.radius;
    for (let q = -n; q <= n; q++)
      for (let r = Math.max(-n, -q - n); r <= Math.min(n, -q + n); r++)
        list.push(xy(q, r));
  } else {
    for (let r = 0; r < spec.h; r++) {
      const off = -Math.floor(r / 2);
      for (let i = 0; i < spec.w; i++) list.push(xy(off + i, r));
    }
  }
  const set = new Set(list);
  return {
    has: (k) => set.has(k),
    neighbors: (k) => {
      const c = parseCell(k);
      return HEX_DIRS.map((d) => xy(c.x + d.x, c.y + d.y)).filter((n) =>
        set.has(n),
      );
    },
    nodes: () => [...list],
  };
}

// ---------------------------------------------------------------------------
// Point-to-point maps and tracks
// ---------------------------------------------------------------------------

/** Named places joined by edges — rail/route maps, Pandemic cities, Risk
 *  territories, Catan road networks. Undirected unless `directed`. */
export function graph(
  edges: readonly (readonly [NodeKey, NodeKey])[],
  opts: { directed?: boolean; isolated?: NodeKey[] } = {},
): Topology {
  const adj: Record<NodeKey, NodeKey[]> = {};
  const touch = (k: NodeKey) => (adj[k] ??= []);
  for (const k of opts.isolated ?? []) touch(k);
  for (const [a, b] of edges) {
    if (!touch(a).includes(b)) adj[a].push(b);
    if (!opts.directed && !touch(b).includes(a)) adj[b].push(a);
    else touch(b);
  }
  return {
    has: (k) => k in adj,
    neighbors: (k) => [...(adj[k] ?? [])],
    nodes: () => Object.keys(adj),
  };
}

/** A line of spaces, optionally a loop — rondels, race tracks, score tracks,
 *  market/price tracks, the Through the Ages card row. Keys are "0".."n-1". */
export function track(length: number, opts: { loop?: boolean } = {}): Topology {
  const inside = (i: number) => i >= 0 && i < length;
  return {
    has: (k) => inside(Number(k)),
    neighbors: (k) => {
      const i = Number(k);
      const out: NodeKey[] = [];
      for (const d of [-1, 1]) {
        let j = i + d;
        if (opts.loop) j = ((j % length) + length) % length;
        if (inside(j)) out.push(String(j));
      }
      return out;
    },
    nodes: () => Array.from({ length }, (_, i) => String(i)),
  };
}

// ---------------------------------------------------------------------------
// Algorithms — these are why the Topology abstraction earns its keep
// ---------------------------------------------------------------------------

/** Every node reachable from `start` through nodes satisfying `include`
 *  (which is also applied to `start`). */
export function flood(
  topo: Topology,
  start: NodeKey,
  include: (k: NodeKey) => boolean,
): NodeKey[] {
  if (!include(start)) return [];
  const seen = new Set([start]);
  const stack = [start];
  const out: NodeKey[] = [];
  while (stack.length) {
    const k = stack.pop()!;
    out.push(k);
    for (const n of topo.neighbors(k))
      if (!seen.has(n) && include(n)) {
        seen.add(n);
        stack.push(n);
      }
  }
  return out;
}

/** Partition occupied nodes into connected groups. `same` decides whether two
 *  touching nodes belong together (same colour, same owner, same suit…).
 *
 *  This one function is area majority, Go groups, Carcassonne features,
 *  contiguous-territory scoring and route networks. */
export function groups(
  topo: Topology,
  occupied: Iterable<NodeKey>,
  same: (a: NodeKey, b: NodeKey) => boolean = () => true,
): NodeKey[][] {
  const pool = new Set(occupied);
  const out: NodeKey[][] = [];
  for (const start of pool) {
    if (!pool.has(start)) continue;
    const group: NodeKey[] = [];
    const stack = [start];
    pool.delete(start);
    while (stack.length) {
      const k = stack.pop()!;
      group.push(k);
      for (const n of topo.neighbors(k))
        if (pool.has(n) && same(k, n)) {
          pool.delete(n);
          stack.push(n);
        }
    }
    out.push(group);
  }
  return out;
}

/** Nodes bordering a group that are NOT part of it and NOT occupied — the
 *  group's open edges. Empty ⇒ the group is sealed (enclosure scoring, Go
 *  liberties, "when this area is full"). */
export function perimeter(
  topo: Topology,
  group: readonly NodeKey[],
  isOccupied: (k: NodeKey) => boolean,
): NodeKey[] {
  const inGroup = new Set(group);
  const out = new Set<NodeKey>();
  for (const k of group)
    for (const n of topo.neighbors(k))
      if (!inGroup.has(n) && !isOccupied(n)) out.add(n);
  return [...out];
}

export const isSealed = (
  topo: Topology,
  group: readonly NodeKey[],
  isOccupied: (k: NodeKey) => boolean,
): boolean => perimeter(topo, group, isOccupied).length === 0;

/** BFS step-distance from `from` to every reachable node. Movement ranges,
 *  route lengths, "how far is the plague from Atlanta". */
export function distances(
  topo: Topology,
  from: NodeKey,
  passable: (k: NodeKey) => boolean = () => true,
): Record<NodeKey, number> {
  const dist: Record<NodeKey, number> = { [from]: 0 };
  let frontier = [from];
  while (frontier.length) {
    const next: NodeKey[] = [];
    for (const k of frontier)
      for (const n of topo.neighbors(k))
        if (dist[n] === undefined && passable(n)) {
          dist[n] = dist[k] + 1;
          next.push(n);
        }
    frontier = next;
  }
  return dist;
}

/** Shortest path inclusive of both ends, or null if unreachable. */
export function pathTo(
  topo: Topology,
  from: NodeKey,
  to: NodeKey,
  passable: (k: NodeKey) => boolean = () => true,
): NodeKey[] | null {
  if (from === to) return [from];
  const prev: Record<NodeKey, NodeKey> = {};
  const seen = new Set([from]);
  let frontier = [from];
  while (frontier.length) {
    const next: NodeKey[] = [];
    for (const k of frontier)
      for (const n of topo.neighbors(k)) {
        if (seen.has(n) || !passable(n)) continue;
        seen.add(n);
        prev[n] = k;
        if (n === to) {
          const path = [n];
          while (path[0] !== from) path.unshift(prev[path[0]]);
          return path;
        }
        next.push(n);
      }
    frontier = next;
  }
  return null;
}

/** Every straight line of `len` nodes on a w×h grid — n-in-a-row wins
 *  (tic-tac-toe, Connect Four, Gomoku) and line-scoring bonuses. */
export function linesIn(
  w: number,
  h: number,
  len: number,
  opts: { diagonals?: boolean } = { diagonals: true },
): NodeKey[][] {
  const dirs: Cell[] = [
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    ...(opts.diagonals ? [{ x: 1, y: 1 }, { x: 1, y: -1 }] : []),
  ];
  const out: NodeKey[][] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      for (const d of dirs) {
        const ex = x + d.x * (len - 1);
        const ey = y + d.y * (len - 1);
        if (ex < 0 || ey < 0 || ex >= w || ey >= h) continue;
        out.push(
          Array.from({ length: len }, (_, i) => xy(x + d.x * i, y + d.y * i)),
        );
      }
  return out;
}

/** Who has the most here? Returns the top count and everyone tied at it —
 *  area majority, group control, "the player with the most X". */
export function majority(counts: Record<Seat, number> | number[]): {
  top: number;
  leaders: Seat[];
} {
  const entries = Array.isArray(counts)
    ? counts.map((v, i) => [i, v] as const)
    : Object.entries(counts).map(([k, v]) => [Number(k), v] as const);
  let topCount = 0;
  for (const [, v] of entries) topCount = Math.max(topCount, v);
  return {
    top: topCount,
    leaders:
      topCount <= 0
        ? []
        : entries.filter(([, v]) => v === topCount).map(([k]) => k),
  };
}

// ---------------------------------------------------------------------------
// Floating extent — the cap for unbounded tile-laying boards.
//
// There is no drawn board: pieces may be played until the LAYOUT SPANS the
// limit, measured against what is already on the table. A cell that could
// never be played behaves like a wall, which is what lets edge groups seal.
// Sound because the extent only ever grows.
// ---------------------------------------------------------------------------

export interface Extent {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export function growExtent(e: Extent | undefined, c: Cell): Extent {
  if (!e) return { minX: c.x, maxX: c.x, minY: c.y, maxY: c.y };
  return {
    minX: Math.min(e.minX, c.x),
    maxX: Math.max(e.maxX, c.x),
    minY: Math.min(e.minY, c.y),
    maxY: Math.max(e.maxY, c.y),
  };
}

export const spanOf = (e: Extent): { w: number; h: number } => ({
  w: e.maxX - e.minX + 1,
  h: e.maxY - e.minY + 1,
});

/** Could this cell ever be played without over-spanning? Monotone — a false
 *  answer is permanent, which is what makes unplayable cells act as walls. */
export function withinLimit(
  e: Extent | undefined,
  limit: { w: number; h: number },
  c: Cell,
): boolean {
  if (!e) return true;
  const g = spanOf(growExtent(e, c));
  return g.w <= limit.w && g.h <= limit.h;
}

/** Rectangle of cells still in reach — what the UI draws as the dashed box.
 *  Null before the first placement (anywhere is legal). */
export function playableEnvelope(
  e: Extent | undefined,
  limit: { w: number; h: number },
): Extent | null {
  if (!e) return null;
  return {
    minX: e.maxX - limit.w + 1,
    maxX: e.minX + limit.w - 1,
    minY: e.maxY - limit.h + 1,
    maxY: e.minY + limit.h - 1,
  };
}
