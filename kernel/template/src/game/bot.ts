// =============================================================================
// BOT — a functional sparring partner, deliberately simple.
//
// It plugs in with zero engine support: bots are ordinary players with
// isBot = true, and botDecide returns the SAME Action objects a human's
// clicks would. App.tsx notices a bot is on the clock and dispatches for it.
// Keep it that way: bots can then never do anything a human couldn't, undo
// keeps working, and simulations are just "run the bot with a seed".
//
// RULE: botDecide must ALWAYS return a legal action. An illegal one is
// rejected, state doesn't change, and the driver stalls.
//
// TODO: score placements by what your game actually rewards. This is the
// one function worth putting real thought into; everything else can stay.
// =============================================================================

import {
  legalCells,
  occupiedNeighbors,
  type Action,
  type GameState,
} from "./engine";

export function isBotTurn(s: GameState): boolean {
  return !s.over && !!s.players[s.turn.p].isBot;
}

export function botDecide(
  s: GameState,
  rnd: () => number = Math.random,
): Action {
  if (s.passPending) return { a: "beginTurn" };
  const hand = s.players[s.turn.p].hand;
  const cells = legalCells(s);
  let best = { tile: hand[0], cell: cells[0], score: -Infinity };
  for (const cell of cells)
    for (const tile of hand) {
      const score = scorePlacement(s, tile, cell) + rnd() * 0.5; // jitter
      if (score > best.score) best = { tile, cell, score };
    }
  return { a: "place", tile: best.tile, cell: best.cell };
}

function scorePlacement(
  s: GameState,
  _tile: number,
  cell: { x: number; y: number },
): number {
  return occupiedNeighbors(s, cell); // TODO: your heuristic
}
