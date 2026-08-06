// =============================================================================
// THE ENGINE — the whole rules layer, and the only thing the UI may call.
//
//   newGame(players, opts?)  → GameState
//   applyAction(s, action)   → null on success, or a rejection string
//   legalActions(s)          → every action that would be accepted right now
//
// Contract that everything else depends on (keep it, whatever game you build):
//   • GameState is PLAIN SERIALIZABLE DATA — no classes, Maps, Sets or
//     functions. That is what makes structuredClone undo, JSON telemetry
//     dumps and headless simulation free.
//   • applyAction MUTATES the state it is given. The app always hands it a
//     fresh clone, so a rejection simply discards that clone (and undo is
//     "drop the last snapshot").
//   • Randomness comes from `s.rng`, never Math.random, so undo rewinds luck
//     and a seed plus an action list replays a game exactly (kernel/rng.ts).
//   • Anything a player must decide goes in `s.pending`, and the reply comes
//     back as an action. Never block, never prompt from the engine.
//   • legalActions is the single source of truth for "what can happen now" —
//     bots, the fuzzer and the simulator all read it, so a rule the bot can't
//     see is a rule that never gets tested.
//
// TEMPLATE GAME (replace all of it): players take turns placing numbered
// tiles on an open grid; a placement scores 1 point per orthogonally adjacent
// tile already there, and touching two or more offers a small choice. It
// exists so every seam — scoring, decisions, logging, telemetry, bots,
// simulation, undo, replay — is wired up and demonstrably working before you
// write a single real rule.
// =============================================================================

import { CONFIG, defaultBoardSize } from "../data/config";
import {
  answerOptions,
  ask,
  busy,
  chooseOne,
  popFrame,
  pump,
  pushFrame,
  registerFrame,
  takeAns,
  answer as deliverAnswer,
  type Answer,
  type Frame,
  type HasDecisions,
  type Pending,
} from "../kernel/decide";
import {
  cellKey,
  growExtent,
  openGrid,
  ORTHO,
  playableEnvelope,
  spanOf,
  withinLimit,
  xy,
  type Cell,
  type Extent,
  type NodeKey,
} from "../kernel/board";
import {
  current,
  eliminate,
  isActive,
  newFlow,
  nextTurn,
  type Flow,
  type HasFlow,
} from "../kernel/flow";
import { finish, total, type Breakdown, type HasOutcome } from "../kernel/outcome";
import { makeRng, shuffle, type HasRng, type RngState } from "../kernel/rng";
import { pushLog, type HasLog, type LogEntry, type Seat } from "../kernel/types";
import {
  count,
  drawTo,
  move,
  newZones,
  zid,
  type HasZones,
  type Zones,
} from "../kernel/zones";

/** The board this game plays on. A fixed board would be squareGrid(w, h);
 *  a map would be graph(edges). Everything downstream is topology-agnostic. */
export const TOPO = openGrid();

export interface Tile {
  id: number;
  value: number; // TODO: your component's actual face data
}

export interface PlayerState {
  name: string;
  color: string;
  isBot?: boolean;
  /** Points by source, so the dump can say where they came from. */
  score: Breakdown;
}

export interface GameState
  extends HasRng,
    HasZones,
    HasFlow,
    HasDecisions,
    HasOutcome,
    HasLog {
  seed: number;
  players: PlayerState[];
  tiles: Record<number, Tile>;
  cellOwner: Record<NodeKey, number>; // "x,y" → tile id
  placedAt: Record<number, Cell>; // tile id → cell
  limit: { w: number; h: number }; // max columns / rows the layout may span
  extent?: Extent; // bounding box of what's on the table
  passPending: boolean; // hotseat "pass the device" screen is up
  telem: { placements: number; pointsScored: number; bonusPoints: number };
}

export type Action =
  | { a: "beginTurn" }
  | { a: "place"; tile: number; cell: Cell }
  | { a: "answer"; ans: Answer };

export const pts = (p: PlayerState): number => total(p.score);

export const handOf = (s: GameState, p: Seat): number[] =>
  (s.zones[zid("hand", p)] ?? []) as number[];

const log = (s: GameState, p: Seat | null, msg: string) =>
  pushLog(s, s.flow.turn, p, msg);

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

export interface NewGameOpts {
  width?: number;
  height?: number;
  /** Same seed ⇒ same game. Defaults to a random one for casual play. */
  seed?: number;
}

export function newGame(
  playersIn: { name: string; color: string; isBot?: boolean }[],
  opts: NewGameOpts = {},
): GameState {
  const n = playersIn.length;
  const seed = opts.seed ?? Math.floor(Math.random() * 2 ** 31);
  const rng: RngState = makeRng(seed);
  const clamp = (v: number) =>
    Math.max(CONFIG.BOARD_MIN, Math.min(CONFIG.BOARD_MAX, Math.round(v)));

  const tiles: Record<number, Tile> = {};
  for (let i = 1; i <= CONFIG.DECK_SIZE; i++)
    tiles[i] = { id: i, value: 1 + (i % 6) };

  // "board" is a zone too, so the component census stays complete: every
  // tile is in the deck, a hand, or on the table. Nothing can go missing
  // without a test noticing (see the conservation invariant in the tests).
  const zones: Zones = newZones(n, ["deck", "board"], ["hand"]);
  zones.deck = shuffle(rng, Object.keys(tiles).map(Number));

  const s: GameState = {
    seed,
    rng,
    players: playersIn.map((p) => ({
      name: p.name,
      color: p.color,
      isBot: !!p.isBot,
      score: {},
    })),
    tiles,
    zones,
    cellOwner: {},
    placedAt: {},
    limit: {
      w: clamp(opts.width ?? defaultBoardSize(n)),
      h: clamp(opts.height ?? defaultBoardSize(n)),
    },
    flow: newFlow(n),
    exec: [],
    pending: null,
    over: false,
    passPending: true,
    log: [],
    telem: { placements: 0, pointsScored: 0, bonusPoints: 0 },
  };
  for (let p = 0; p < n; p++) drawTo(zones, "deck", zid("hand", p), CONFIG.HAND_SIZE);
  log(s, null, `New game (seed ${seed}) — ${playersIn.map((p) => p.name).join(", ")}`);
  return s;
}

// ---------------------------------------------------------------------------
// Queries (exported — the UI and the bot both use these, never their own copy)
// ---------------------------------------------------------------------------

export const activeSeat = (s: GameState): Seat => current(s.flow);

export const envelope = (s: GameState) => playableEnvelope(s.extent, s.limit);

export const occupied = (s: GameState, k: NodeKey): boolean =>
  s.cellOwner[k] !== undefined;

export function placementCheck(
  s: GameState,
  c: Cell,
): { ok: boolean; reason?: string } {
  if (occupied(s, cellKey(c))) return { ok: false, reason: "Cell occupied" };
  if (!withinLimit(s.extent, s.limit, c))
    return { ok: false, reason: `Would exceed the ${s.limit.w}×${s.limit.h} limit` };
  if (!s.extent) return { ok: true }; // opening placement goes anywhere
  const touches = TOPO.neighbors(cellKey(c)).some((k) => occupied(s, k));
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

export const occupiedNeighbors = (s: GameState, c: Cell): number =>
  ORTHO.filter((o) => occupied(s, xy(c.x + o.x, c.y + o.y))).length;

/** THE ACTION SPACE. Everything that would be accepted if submitted now.
 *  Keep this honest — bots, the fuzzer and the simulator all trust it. */
export function legalActions(s: GameState): Action[] {
  if (s.over) return [];
  if (s.pending)
    return answerOptions(s.pending).map((ans) => ({ a: "answer", ans }) as Action);
  if (s.exec.length > 0) return []; // mid-effect with nothing to ask: pump runs it
  if (s.passPending) return [{ a: "beginTurn" }];
  const out: Action[] = [];
  for (const cell of legalCells(s))
    for (const tile of handOf(s, activeSeat(s))) out.push({ a: "place", tile, cell });
  return out;
}

/** Whose input is the game waiting on? Usually the active seat, but a pending
 *  decision can belong to someone else entirely. */
export const seatOnClock = (s: GameState): Seat =>
  s.pending ? s.pending.who : activeSeat(s);

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export function applyAction(s: GameState, action: Action): string | null {
  if (s.over) return "Game is over";
  if (s.pending && action.a !== "answer") return "Answer the open question first";
  switch (action.a) {
    case "beginTurn":
      if (!s.passPending) return "Turn already started";
      s.passPending = false;
      log(s, activeSeat(s), `— turn ${s.flow.turn}: ${s.players[activeSeat(s)].name} —`);
      return null;
    case "place":
      return actPlace(s, action.tile, action.cell);
    case "answer": {
      const err = deliverAnswer(s, action.ans);
      if (err) return err;
      afterEffects(s);
      return null;
    }
  }
}

function actPlace(s: GameState, tileId: number, cell: Cell): string | null {
  const p = activeSeat(s);
  if (s.passPending) return "Pass the device first";
  if (!isActive(s.flow, p)) return "Not your turn";
  if (!handOf(s, p).includes(tileId)) return "Tile not in hand";
  const check = placementCheck(s, cell);
  if (!check.ok) return check.reason!;

  move(s.zones, zid("hand", p), "board", tileId);
  s.cellOwner[cellKey(cell)] = tileId;
  s.placedAt[tileId] = cell;
  s.extent = growExtent(s.extent, cell);
  s.telem.placements++;

  // ---- TODO: your placement rules go here -------------------------------
  const touching = occupiedNeighbors(s, cell);
  const gained = touching * CONFIG.POINTS_PER_NEIGHBOR;
  score(s, p, "placement", gained);
  log(
    s,
    p,
    `places tile ${s.tiles[tileId].value} at (${cell.x},${cell.y})` +
      (gained ? ` — scores ${gained}` : ""),
  );
  // A decision, so the prompt seam is live from the first commit: the UI
  // renders it, bots answer it, the fuzzer walks both branches.
  if (touching >= CONFIG.BONUS_AT_NEIGHBORS) pushFrame(s, "bonus", { p });
  // -----------------------------------------------------------------------

  pump(s);
  afterEffects(s);
  return null;
}

export function score(s: GameState, p: Seat, source: string, n: number): void {
  if (n === 0) return;
  s.players[p].score[source] = (s.players[p].score[source] ?? 0) + n;
  s.telem.pointsScored += n;
}

/** The placeholder's one player decision. Frames look like overkill for a
 *  two-option choice — they are, until the third card effect needs to chain,
 *  target and be undoable mid-resolution. Model the first one this way and
 *  the rest cost nothing. */
registerFrame<GameState>("bonus", (s, f: Frame) => {
  const p: Seat = f.d.p;
  if (f.ph === 0) {
    f.ph = 1;
    ask(
      s,
      chooseOne(p, "Well placed — take your bonus", [
        { k: "pts", label: `+${CONFIG.BONUS_POINTS} point` },
        {
          k: "draw",
          label: `Draw ${CONFIG.BONUS_DRAW} extra tile`,
          disabled: count(s.zones, "deck") === 0,
        },
      ]) as Pending,
    );
    return;
  }
  const ans = takeAns(f);
  if (ans?.k === "draw") {
    const got = drawTo(
      s.zones,
      "deck",
      zid("hand", p),
      CONFIG.HAND_SIZE + CONFIG.BONUS_DRAW,
    );
    log(s, p, `bonus: draws ${got.length}`);
  } else {
    score(s, p, "bonus", CONFIG.BONUS_POINTS);
    s.telem.bonusPoints += CONFIG.BONUS_POINTS;
    log(s, p, `bonus: +${CONFIG.BONUS_POINTS}`);
  }
  popFrame(s);
});

/** Run after any action that could have finished an effect: if nothing is
 *  still resolving, the turn is over. */
function afterEffects(s: GameState): void {
  if (busy(s) || s.over) return;
  const p = activeSeat(s);
  drawTo(s.zones, "deck", zid("hand", p), CONFIG.HAND_SIZE);
  advanceTurn(s);
}

function advanceTurn(s: GameState): void {
  if (s.players.every((_, p) => handOf(s, p).length === 0))
    return endGame(s, "out of tiles");
  // seats with an empty hand can't act again
  for (let p = 0; p < s.players.length; p++)
    if (handOf(s, p).length === 0) eliminate(s.flow, p);
  const r = nextTurn(s.flow);
  if (r.exhausted) return endGame(s, "out of tiles");
  s.passPending = true;
  if (legalCells(s).length === 0) endGame(s, "no room left");
}

function endGame(s: GameState, why: string): void {
  finish(s, {
    reason: why,
    seats: s.players.map((_, i) => i),
    // cascading tiebreakers: points, then tiles still in hand (fewer is better
    // — swap the order or add a metric; this is where ties get decided)
    metrics: [(p) => pts(s.players[p]), (p) => -handOf(s, p).length],
    scores: s.players.map((q) => ({ ...q.score })),
  });
  log(s, null, `GAME OVER (${why})`);
  for (const i of s.result!.ranking)
    log(s, i, `${s.players[i].name}: ${pts(s.players[i])} pts`);
}

/** Span of what's on the table, for the HUD. */
export const currentSpan = (s: GameState) =>
  s.extent ? spanOf(s.extent) : { w: 0, h: 0 };

export type { Flow, LogEntry };
