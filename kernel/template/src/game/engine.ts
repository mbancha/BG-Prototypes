// =============================================================================
// THE ENGINE — the whole rules layer, and the only thing the UI may call.
//
//   newGame(players, opts?, rnd?) → GameState
//   applyAction(s, action)        → null on success, or a rejection string
//
// Contract that everything else depends on (keep it, whatever game you build):
//   • GameState is PLAIN SERIALIZABLE DATA — no classes, Maps, Sets or
//     functions. That is what makes structuredClone undo, JSON telemetry
//     dumps and headless simulation free.
//   • applyAction MUTATES the state it is given. The app always hands it a
//     fresh clone, so a rejection simply discards that clone (and undo is
//     "drop the last snapshot").
//   • Randomness comes in through `rnd`, never Math.random directly, so a
//     seed reproduces a game exactly.
//   • Anything a player must decide goes in `s.pending`, and the reply comes
//     back as an action. Never block, never prompt from the engine.
//
// TEMPLATE GAME (replace all of it): players take turns placing numbered
// tiles on an open grid; a placement scores 1 point per orthogonally
// adjacent tile already there. It exists so every seam — scoring, logging,
// telemetry, bots, simulation, undo — is wired up and demonstrably working
// before you write a single real rule.
// =============================================================================

import {
  CONFIG,
  cellKey,
  cellWithinLimit,
  defaultBoardSize,
  growExtent,
  ORTHO,
  playableEnvelope,
  type Cell,
  type Extent,
} from "../data/config";

export interface Tile {
  id: number;
  value: number; // TODO: your component's actual face data
}

export interface PlayerState {
  name: string;
  color: string;
  isBot?: boolean;
  pts: number;
  hand: number[]; // tile ids
}

export interface LogEntry {
  turn: number;
  p: number | null;
  msg: string;
}

export interface GameState {
  players: PlayerState[];
  tiles: Record<number, Tile>;
  deck: number[];
  cellOwner: Record<string, number>; // "x,y" → tile id
  placedAt: Record<number, Cell>; // tile id → cell
  limit: { w: number; h: number }; // max columns / rows the layout may span
  extent?: Extent; // bounding box of what's on the table
  turn: { n: number; p: number };
  passPending: boolean; // hotseat "pass the device" screen is up
  over: boolean;
  ranking?: number[];
  log: LogEntry[];
  telem: { placements: number; pointsScored: number };
}

export type Action =
  | { a: "beginTurn" }
  | { a: "place"; tile: number; cell: Cell };

const log = (s: GameState, p: number | null, msg: string) =>
  s.log.push({ turn: s.turn.n, p, msg });

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

export function newGame(
  playersIn: { name: string; color: string; isBot?: boolean }[],
  opts?: { width?: number; height?: number },
  rnd: () => number = Math.random,
): GameState {
  const n = playersIn.length;
  const clamp = (v: number) =>
    Math.max(CONFIG.BOARD_MIN, Math.min(CONFIG.BOARD_MAX, Math.round(v)));

  const tiles: Record<number, Tile> = {};
  for (let i = 1; i <= CONFIG.DECK_SIZE; i++)
    tiles[i] = { id: i, value: 1 + (i % 6) };
  const deck = Object.keys(tiles).map(Number);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  const s: GameState = {
    players: playersIn.map((p) => ({
      name: p.name,
      color: p.color,
      isBot: !!p.isBot,
      pts: 0,
      hand: [],
    })),
    tiles,
    deck,
    cellOwner: {},
    placedAt: {},
    limit: {
      w: clamp(opts?.width ?? defaultBoardSize(n)),
      h: clamp(opts?.height ?? defaultBoardSize(n)),
    },
    turn: { n: 0, p: 0 },
    passPending: true,
    over: false,
    log: [],
    telem: { placements: 0, pointsScored: 0 },
  };
  for (let i = 0; i < CONFIG.HAND_SIZE; i++)
    for (let p = 0; p < n; p++)
      if (s.deck.length) s.players[p].hand.push(s.deck.shift()!);
  log(s, null, `New game — ${playersIn.map((p) => p.name).join(", ")}`);
  return s;
}

// ---------------------------------------------------------------------------
// Queries (exported — the UI and the bot both use these, never their own copy)
// ---------------------------------------------------------------------------

export const withinLimit = (s: GameState, c: Cell) =>
  cellWithinLimit(s.extent, s.limit, c);

export const envelope = (s: GameState) =>
  playableEnvelope(s.extent, s.limit);

export function placementCheck(
  s: GameState,
  c: Cell,
): { ok: boolean; reason?: string } {
  if (s.cellOwner[cellKey(c)] !== undefined)
    return { ok: false, reason: "Cell occupied" };
  if (!withinLimit(s, c))
    return { ok: false, reason: `Would exceed the ${s.limit.w}×${s.limit.h} limit` };
  if (!s.extent) return { ok: true }; // opening placement goes anywhere
  const touches = ORTHO.some(
    (o) => s.cellOwner[cellKey({ x: c.x + o.x, y: c.y + o.y })] !== undefined,
  );
  return touches ? { ok: true } : { ok: false, reason: "Must touch a tile" };
}

/** Every legal placement cell right now. Cheap enough to call per bot move. */
export function legalCells(s: GameState): Cell[] {
  if (!s.extent) return [{ x: 0, y: 0 }];
  const env = envelope(s)!;
  const out: Cell[] = [];
  for (let x = env.minX; x <= env.maxX; x++)
    for (let y = env.minY; y <= env.maxY; y++)
      if (placementCheck(s, { x, y }).ok) out.push({ x, y });
  return out;
}

export const occupiedNeighbors = (s: GameState, c: Cell) =>
  ORTHO.filter(
    (o) => s.cellOwner[cellKey({ x: c.x + o.x, y: c.y + o.y })] !== undefined,
  ).length;

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export function applyAction(s: GameState, action: Action): string | null {
  if (s.over) return "Game is over";
  switch (action.a) {
    case "beginTurn":
      if (!s.passPending) return "Turn already started";
      s.passPending = false;
      log(s, s.turn.p, `— turn ${s.turn.n}: ${s.players[s.turn.p].name} —`);
      return null;
    case "place":
      return actPlace(s, action.tile, action.cell);
  }
}

function actPlace(s: GameState, tileId: number, cell: Cell): string | null {
  const p = s.turn.p;
  if (s.passPending) return "Pass the device first";
  const hand = s.players[p].hand;
  const idx = hand.indexOf(tileId);
  if (idx === -1) return "Tile not in hand";
  const check = placementCheck(s, cell);
  if (!check.ok) return check.reason!;

  hand.splice(idx, 1);
  s.cellOwner[cellKey(cell)] = tileId;
  s.placedAt[tileId] = cell;
  s.extent = growExtent(s.extent, cell);
  s.telem.placements++;

  // ---- TODO: your placement rules go here -------------------------------
  const gained = occupiedNeighbors(s, cell) * CONFIG.POINTS_PER_NEIGHBOR;
  s.players[p].pts += gained;
  s.telem.pointsScored += gained;
  log(
    s,
    p,
    `places tile ${s.tiles[tileId].value} at (${cell.x},${cell.y})` +
      (gained ? ` — scores ${gained}` : ""),
  );
  // -----------------------------------------------------------------------

  while (s.players[p].hand.length < CONFIG.HAND_SIZE && s.deck.length)
    s.players[p].hand.push(s.deck.shift()!);

  advanceTurn(s);
  return null;
}

function advanceTurn(s: GameState) {
  if (s.players.every((q) => q.hand.length === 0)) return endGame(s, "out of tiles");
  let np = (s.turn.p + 1) % s.players.length;
  while (s.players[np].hand.length === 0) np = (np + 1) % s.players.length;
  s.turn = { n: s.turn.n + 1, p: np };
  s.passPending = true;
  if (legalCells(s).length === 0) endGame(s, "no room left");
}

function endGame(s: GameState, why: string) {
  s.over = true;
  s.ranking = s.players
    .map((_, i) => i)
    .sort((a, b) => s.players[b].pts - s.players[a].pts);
  log(s, null, `GAME OVER (${why})`);
  for (const i of s.ranking)
    log(s, i, `${s.players[i].name}: ${s.players[i].pts} pts`);
}
