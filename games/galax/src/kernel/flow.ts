// =============================================================================
// TURN FLOW — rounds, phases, turn order, action points, passing.
//
// "Whose turn is it" is the seam that varies most between games, and the one
// most likely to be hardcoded as `p = (p + 1) % n` and then fought with for
// the rest of the prototype. This module holds every shape that pattern has
// to grow into:
//
//   strict rotation ......... nextTurn()
//   phases within a round ... setPhase()      politics → action → production
//   rounds / ages / eras .... beginRound()    optionally with a new order
//   variable turn order ..... beginRound(f, newOrder) / reorder()
//   pass out of the round ... passSeat() + allPassed()   worker placement,
//                                                        auctions, Race
//   action points ........... spend() / f.actions        4 civil actions
//   simultaneous play ....... beginSimultaneous()        drafts, sealed bids,
//                                                        programming
//   extra / interrupt turns . grantTurn()                take-another-turn
//   elimination ............. eliminate()                last player standing
//
// Plain data throughout, so it snapshots and undoes with everything else.
// =============================================================================

import type { Seat } from "./types";

export interface Flow {
  /** 1-based once the first round has begun. */
  round: number;
  /** Free-form: your game names its own phases. "" if it has only one. */
  phase: string;
  /** Which turn we are on, 1-based — the number the log and UI show. */
  turn: number;
  /** Seat order for THIS round. Reassign it to change turn order. */
  order: Seat[];
  /** Index into `order` of whoever is on the clock. */
  idx: number;
  /** Passed for the rest of this round (cleared by beginRound). */
  passed: Seat[];
  /** Out for the rest of the GAME (never cleared). */
  out: Seat[];
  /** Action points left this turn. Ignore it if your game gives one action. */
  actions: number;
  /** Non-empty ⇒ simultaneous: these seats all act before the flow moves. */
  awaiting: Seat[];
  /** Extra turns queued ahead of the normal order. */
  queue: Seat[];
}

export interface HasFlow {
  flow: Flow;
}

export interface FlowOpts {
  /** Starting phase name. */
  phase?: string;
  /** Action points granted at the start of each turn. Default 1. */
  actionsPerTurn?: number;
}

export function newFlow(
  players: number | Seat[],
  opts: FlowOpts = {},
): Flow {
  const order =
    typeof players === "number"
      ? Array.from({ length: players }, (_, i) => i)
      : [...players];
  return {
    round: 1,
    phase: opts.phase ?? "",
    turn: 1,
    order,
    idx: 0,
    passed: [],
    out: [],
    actions: opts.actionsPerTurn ?? 1,
    awaiting: [],
    queue: [],
  };
}

// ---------------------------------------------------------------------------
// Who may act
// ---------------------------------------------------------------------------

/** The seat on the clock. -1 when the flow is simultaneous or stalled. */
export const current = (f: Flow): Seat =>
  f.awaiting.length > 0 ? -1 : (f.queue[0] ?? f.order[f.idx] ?? -1);

/** Every seat allowed to act right now (several during simultaneous play). */
export const activeSeats = (f: Flow): Seat[] =>
  f.awaiting.length > 0 ? [...f.awaiting] : current(f) === -1 ? [] : [current(f)];

export const isActive = (f: Flow, p: Seat): boolean =>
  activeSeats(f).includes(p);

export const hasPassed = (f: Flow, p: Seat): boolean => f.passed.includes(p);

export const isOut = (f: Flow, p: Seat): boolean => f.out.includes(p);

/** Can this seat still take turns this round? */
export const canAct = (f: Flow, p: Seat): boolean =>
  !hasPassed(f, p) && !isOut(f, p);

/** Everyone still in the round, in turn order starting after `p`. Use for
 *  "the player to your left", clockwise offers, trading, reaction windows. */
export function seatsAfter(f: Flow, p: Seat): Seat[] {
  const i = f.order.indexOf(p);
  if (i === -1) return f.order.filter((q) => canAct(f, q));
  return [...f.order.slice(i + 1), ...f.order.slice(0, i)].filter((q) =>
    canAct(f, q),
  );
}

// ---------------------------------------------------------------------------
// Advancing
// ---------------------------------------------------------------------------

export interface TurnResult {
  /** Who is on the clock now. -1 if nobody can act. */
  seat: Seat;
  /** True when the pointer wrapped past the end of the order this call. */
  wrapped: boolean;
  /** True when every seat has passed or been eliminated — end the round. */
  exhausted: boolean;
}

/** Hand the clock to the next seat that can act. Consumes a queued extra turn
 *  first if there is one. `actionsPerTurn` refills the action budget. */
export function nextTurn(f: Flow, opts: FlowOpts = {}): TurnResult {
  f.turn++;
  f.actions = opts.actionsPerTurn ?? 1;
  if (f.queue.length > 0) f.queue.shift();
  if (f.queue.length > 0)
    return { seat: f.queue[0], wrapped: false, exhausted: false };

  if (f.order.every((p) => !canAct(f, p)))
    return { seat: -1, wrapped: false, exhausted: true };

  let wrapped = false;
  for (let step = 0; step < f.order.length; step++) {
    f.idx++;
    if (f.idx >= f.order.length) {
      f.idx = 0;
      wrapped = true;
    }
    if (canAct(f, f.order[f.idx]))
      return { seat: f.order[f.idx], wrapped, exhausted: false };
  }
  return { seat: -1, wrapped, exhausted: true };
}

/** Queue an extra turn ahead of the normal order (take-another-turn effects,
 *  reaction windows, "the victim discards now"). */
export function grantTurn(f: Flow, p: Seat): void {
  if (f.queue.length === 0) f.queue.push(current(f));
  f.queue.splice(1, 0, p);
}

export function passSeat(f: Flow, p: Seat): void {
  if (!f.passed.includes(p)) f.passed.push(p);
}

export function eliminate(f: Flow, p: Seat): void {
  if (!f.out.includes(p)) f.out.push(p);
}

/** Worker placement / auction round end: nobody left with anything to do. */
export const allPassed = (f: Flow): boolean =>
  f.order.every((p) => !canAct(f, p));

/** Seats still in the game (not eliminated) — the co-op / elimination check. */
export const survivors = (f: Flow): Seat[] => f.order.filter((p) => !isOut(f, p));

// ---------------------------------------------------------------------------
// Rounds and phases
// ---------------------------------------------------------------------------

/** Start the next round: clears passes, optionally installs a NEW TURN ORDER
 *  (initiative tracks, bidding for first player, snake draft), and points the
 *  clock at the first seat that can act. */
export function beginRound(
  f: Flow,
  order?: Seat[],
  opts: FlowOpts = {},
): Seat {
  f.round++;
  f.passed = [];
  f.queue = [];
  f.awaiting = [];
  if (order) f.order = [...order];
  f.idx = 0;
  f.actions = opts.actionsPerTurn ?? 1;
  if (opts.phase !== undefined) f.phase = opts.phase;
  while (f.idx < f.order.length && !canAct(f, f.order[f.idx])) f.idx++;
  return f.idx < f.order.length ? f.order[f.idx] : -1;
}

/** Install a turn order without starting a new round (initiative changing
 *  mid-round). Keeps the clock on the same seat if it is still in the order. */
export function reorder(f: Flow, order: Seat[]): void {
  const on = current(f);
  f.order = [...order];
  const i = f.order.indexOf(on);
  f.idx = i === -1 ? 0 : i;
}

/** Reverse the order for the next pass — snake drafts, 7 Wonders ages. */
export const snake = (f: Flow): Seat[] => [...f.order].reverse();

/** Rotate so `first` leads — "the winner of the auction goes first". */
export function rotated(order: Seat[], first: Seat): Seat[] {
  const i = order.indexOf(first);
  return i <= 0 ? [...order] : [...order.slice(i), ...order.slice(0, i)];
}

export const setPhase = (f: Flow, phase: string): void => {
  f.phase = phase;
};

// ---------------------------------------------------------------------------
// Action points
// ---------------------------------------------------------------------------

export const canSpend = (f: Flow, n = 1): boolean => f.actions >= n;

/** Spend action points. Returns false (and spends nothing) if too expensive —
 *  callers should turn that into a rejection string. */
export function spend(f: Flow, n = 1): boolean {
  if (f.actions < n) return false;
  f.actions -= n;
  return true;
}

export const grantActions = (f: Flow, n: number): void => {
  f.actions += n;
};

// ---------------------------------------------------------------------------
// Simultaneous play
// ---------------------------------------------------------------------------

/** Open a simultaneous window: every listed seat may act, in any order, and
 *  the flow does not advance until all of them have submitted. Drafting,
 *  sealed bids, programming, "everyone discards a card".
 *
 *  In hotseat the UI still shows one player at a time — the pass screen just
 *  cycles through `awaiting` instead of following the turn order. */
export function beginSimultaneous(f: Flow, seats?: Seat[]): void {
  f.awaiting = (seats ?? f.order.filter((p) => canAct(f, p))).slice();
}

/** Record one seat's submission. Returns true when the window is complete. */
export function submit(f: Flow, p: Seat): boolean {
  f.awaiting = f.awaiting.filter((q) => q !== p);
  return f.awaiting.length === 0;
}

export const simultaneousOpen = (f: Flow): boolean => f.awaiting.length > 0;
