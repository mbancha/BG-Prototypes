// =============================================================================
// Bot opponents — deliberately SIMPLE. The goal is a functional sparring
// partner for solo playtesting, not a strong player.
//
// How it plugs in: bots are ordinary players with PlayerState.isBot = true.
// The engine neither knows nor cares; src/App.tsx runs a driver effect that,
// whenever the pending decision belongs to a bot (see decisionOwner), waits
// CONFIG.BOT_DELAY_MS and dispatches botDecide(state) — exactly the same
// Action objects a human's clicks would produce. That keeps the engine
// deterministic, keeps undo working, and means bots can never do anything a
// human couldn't.
//
// Strategy in one paragraph: answer prompts mostly at random (preferring
// opponents' tokens when an owner must be chosen), sometimes deploy an
// affordable card, and place the hand card at the spot that triggers the most
// symbol matches (with a small bonus for hitting both halves = $1 rule).
// Improve it by sharpening scorePlacement() or botAnswer() — everything else
// can stay untouched.
//
// IMPORTANT: botDecide must ALWAYS return a legal action. An illegal action
// would be rejected by applyAction, the state would not change, and the
// driver (which only re-fires on state change) would stall the game.
// =============================================================================

import { CONFIG } from "../data/config";
import { def, isDisabled } from "./cards";
import {
  cellsFor,
  matchesFor,
  ORTHO,
  placementCheck,
  surroundingCells,
} from "./grid";
import { deployDiscount } from "./ongoing";
import type { Action } from "./turn";
import type { Cell, GameState } from "./types";
import { cellKey } from "./types";

/**
 * Which player the game is currently waiting on. Usually the active player,
 * but some prompts are answered by someone else (e.g. Ransomware's target
 * chooses pay-or-lose): those carry a `who` field on s.pending.
 */
export function decisionOwner(s: GameState): number {
  const pend = s.pending as { who?: number } | null;
  if (pend && typeof pend.who === "number") return pend.who;
  return s.turn.p;
}

/** True when the app should let the bot driver act instead of the human. */
export function isBotTurn(s: GameState): boolean {
  return !s.over && !!s.players[decisionOwner(s)].isBot;
}

const pick = <T,>(arr: T[], rnd: () => number): T =>
  arr[Math.floor(rnd() * arr.length)];

/**
 * The bot's next move for the current state. Pure — no mutation, no timers.
 * `rnd` is injectable so tests can run seeded games.
 */
export function botDecide(
  s: GameState,
  rnd: () => number = Math.random,
): Action {
  if (s.pending) return { a: "answer", ans: botAnswer(s, rnd) };
  if (s.passPending) return { a: "beginTurn" };

  const p = s.turn.p;
  const hand = s.players[p].hand;

  if ((!s.turn.placed || s.turn.setup) && hand.length > 0) {
    // Sometimes deploy first (deploying after placing is also legal, but one
    // decision point per tick keeps this simple).
    if (!s.turn.setup && !s.turn.deployed && rnd() < CONFIG.BOT_DEPLOY_CHANCE) {
      const affordable = hand.filter(
        (id) =>
          !isDisabled(id) &&
          s.players[p].money >=
            Math.max(0, def(id).cost - deployDiscount(s, p)),
      );
      if (affordable.length > 0)
        return { a: "deploy", card: pick(affordable, rnd) };
    }
    const spot = bestPlacement(s, rnd);
    if (spot) return spot; // always found: the grid is unbounded
  }
  return { a: "endTurn" };
}

// ---------------------------------------------------------------------------
// Placement search: try every hand card at every candidate anchor/rotation,
// keep the highest-scoring legal spot.
// ---------------------------------------------------------------------------

/** Candidate anchor cells: free cells adjacent to the board, plus one more
 *  ring outward (the domino's anchor half may sit one step away as long as
 *  its other half touches). During setup: cells that let a domino cover the
 *  origin. */
function candidateAnchors(s: GameState): Cell[] {
  if (s.turn.setup) {
    return [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
      { x: 0, y: -1 },
    ];
  }
  const seen = new Set<string>();
  const out: Cell[] = [];
  const add = (c: Cell) => {
    const k = cellKey(c);
    if (seen.has(k) || s.cellOwner[k] !== undefined) return;
    seen.add(k);
    out.push(c);
  };
  for (const pl of Object.values(s.board))
    for (const c of surroundingCells(pl)) add(c);
  for (const c of [...out])
    for (const o of ORTHO) add({ x: c.x + o.x, y: c.y + o.y });
  return out;
}

function scorePlacement(
  s: GameState,
  card: number,
  at: Cell,
  rot: number,
): number {
  const ms = matchesFor(s, card, at, rot);
  const [ca, cb] = cellsFor(at, rot);
  const topHit = ms.some((m) => m.myCell.x === ca.x && m.myCell.y === ca.y);
  const bottomHit = ms.some((m) => m.myCell.x === cb.x && m.myCell.y === cb.y);
  // one point per match, near-one for the double-match $ bonus
  return ms.length + (topHit && bottomHit ? 0.9 : 0);
}

function bestPlacement(s: GameState, rnd: () => number): Action | null {
  const hand = s.players[s.turn.p].hand;
  const anchors = candidateAnchors(s);
  let best: { card: number; at: Cell; rot: number; score: number } | null =
    null;
  for (const card of hand)
    for (const at of anchors)
      for (const rot of [0, 1, 2, 3]) {
        if (!placementCheck(s, at, rot).ok) continue;
        const score = scorePlacement(s, card, at, rot) + rnd() * 0.5; // jitter
        if (!best || score > best.score) best = { card, at, rot, score };
      }
  return best ? { a: "place", card: best.card, at: best.at, rot: best.rot } : null;
}

// ---------------------------------------------------------------------------
// Prompt answering: legal-by-construction picks from what the pending
// decision offers. Mild heuristics only.
// ---------------------------------------------------------------------------

function botAnswer(s: GameState, rnd: () => number): unknown {
  const pend = s.pending!;
  switch (pend.t) {
    case "hub": {
      // resolve mandatory items first; skip optional ones half the time
      const must = pend.items.findIndex((it) => !it.optional);
      if (must >= 0) return { i: must };
      return rnd() < 0.5 ? { i: 0 } : { i: 0, skip: true };
    }
    case "card":
      return { card: pick(pend.ids, rnd) };
    case "owner": {
      // usually a removal/move target — prefer hitting an opponent's tokens
      const opp = pend.owners.filter((o) => o.p !== s.turn.p);
      return { p: (opp.length > 0 ? pick(opp, rnd) : pick(pend.owners, rnd)).p };
    }
    case "player":
      return { p: pick(pend.players, rnd) };
    case "opt":
      return { k: pick(pend.options, rnd).k };
    case "line":
      return { key: pick(pend.lines, rnd).key };
    case "deckOrder":
      return { order: [...pend.cards] }; // keep the order it saw
  }
}
