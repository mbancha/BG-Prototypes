// =============================================================================
// BOT — a functional sparring partner, deliberately simple.
//
// It plugs in with zero engine support: bots are ordinary players with
// isBot = true, and botDecide returns the SAME Action objects a human's
// clicks would. App.tsx notices a bot is on the clock and dispatches for it.
// Keep it that way: bots can then never do anything a human couldn't, undo
// keeps working, and simulations are just "run the bot with a seed".
//
// The shape below is worth keeping whatever your game is: enumerate the legal
// action space, score each option, take the best. Because the candidate list
// comes from the engine's own legalActions, a bot can never invent an illegal
// move, and any new rule is automatically visible to it.
//
// The bot's own randomness is passed in and is SEPARATE from the game's
// s.rng — bot tie-breaking must not consume the deal.
//
// TODO: score actions by what your game actually rewards. This is the one
// function worth putting real thought into; everything else can stay.
// =============================================================================

import { CONFIG } from "../data/config";
import type { Cell } from "../kernel/board";
import { count } from "../kernel/zones";
import {
  activeSeat,
  legalActions,
  occupiedNeighbors,
  seatOnClock,
  type Action,
  type GameState,
} from "./engine";

/** Is the game waiting on a bot? Covers decisions owned by a non-active
 *  seat, which is why it asks who is on the clock rather than whose turn it
 *  is. */
export function isBotTurn(s: GameState): boolean {
  if (s.over) return false;
  const p = seatOnClock(s);
  return p >= 0 && !!s.players[p]?.isBot;
}

export function botDecide(
  s: GameState,
  rnd: () => number = Math.random,
): Action {
  const actions = legalActions(s);
  if (actions.length === 0) throw new Error("botDecide: no legal action");
  let best = actions[0];
  let bestScore = -Infinity;
  for (const action of actions) {
    const v = scoreAction(s, action) + rnd() * 0.5; // jitter breaks ties
    if (v > bestScore) {
      bestScore = v;
      best = action;
    }
  }
  return best;
}

function scoreAction(s: GameState, action: Action): number {
  switch (action.a) {
    case "beginTurn":
      return 0;
    case "place":
      return scorePlacement(s, action.cell);
    case "answer":
      // TODO: your game's decisions. Here: take the tile if the deck is
      // deep enough to matter, otherwise bank the point.
      if (action.ans.k === "draw")
        return count(s.zones, "deck") > s.players.length ? 1.2 : 0;
      return action.ans.k === "pts" ? 1 : 0;
  }
}

function scorePlacement(s: GameState, cell: Cell): number {
  return occupiedNeighbors(s, cell) * CONFIG.POINTS_PER_NEIGHBOR; // TODO
}

/** Bots see everything in this prototype — fine for a sparring partner, and
 *  worth remembering before you read anything into a simulation of a
 *  hidden-information game. Filter the state here if that matters to you. */
export const botSeesHiddenInfo = true;

export { activeSeat };
