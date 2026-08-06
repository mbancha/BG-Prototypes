// All-bot games: proves botDecide only ever emits legal actions (an illegal
// one would stall the UI driver) and that bot games actually finish. Uses a
// seeded RNG both for the deck shuffle and for the bot's choices so failures
// reproduce.

import { describe, expect, it } from "vitest";
import { botDecide } from "../src/game/bot";
import { applyAction, newGame } from "../src/game/turn";
import type { GameState } from "../src/game/types";

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Force a placement by player p, bypassing hand/deal randomness. */
function forcePlace(
  s: GameState,
  p: number,
  id: number,
  x: number,
  y: number,
  rot = 0,
) {
  s.turn.p = p;
  s.turn.placed = false;
  s.passPending = false;
  s.deck = s.deck.filter((c) => c !== id);
  for (const q of s.players) q.hand = q.hand.filter((c) => c !== id);
  s.players[p].hand.push(id);
  const err = applyAction(s, { a: "place", card: id, at: { x, y }, rot });
  if (err) throw new Error(err);
}

describe("bot opponents", () => {
  it("takes an enclosure it would score over a plain match placement", () => {
    const s = newGame([
      { name: "Bot", color: "#0ff", isBot: true },
      { name: "Human", color: "#f0f" },
    ]);
    // Recreate the classic enclosure position: bot's opening card at the
    // origin (holds only the bot's baseline influence), five of the six
    // surrounding cells filled with no-match neighbors, (0,2)+(1,2) open.
    s.passPending = false;
    s.deck = s.deck.filter((c) => c !== 1);
    for (const q of s.players) q.hand = q.hand.filter((c) => c !== 1);
    s.players[0].hand.push(1);
    expect(
      applyAction(s, { a: "place", card: 1, at: { x: 0, y: 0 }, rot: 0 }),
    ).toBeNull(); // opening placement, muscle/whisper
    s.passPending = false;
    forcePlace(s, 1, 28, -1, 0, 0); // credit/credit — no match
    forcePlace(s, 0, 22, 1, 0, 0); // favor/favor — no match
    forcePlace(s, 1, 41, 0, -1, 3); // intel/intel — no match

    // bot to move with only Kingmaker (intel/intel) in hand; deploy spent
    s.turn.p = 0;
    s.turn.placed = false;
    s.turn.deployed = true;
    s.passPending = false;
    s.players[0].hand = [30];

    const rnd = mulberry32(7);
    const action = botDecide(s, rnd);
    expect(action.a).toBe("place");
    expect(applyAction(s, action)).toBeNull();
    // the only reason to cover (0,2) is the enclosure — and it scores 5
    expect(s.board[1].scored).toBe(true);
    expect(s.players[0].pts).toBe(5);
  });

  it("plays full 2/3/4-bot games to completion with only legal actions", () => {
    for (const [seed, nPlayers] of [
      [101, 2],
      [202, 3],
      [303, 4],
    ] as const) {
      const rnd = mulberry32(seed);
      const orig = Math.random;
      Math.random = rnd; // seeded shuffle inside newGame
      let s: GameState;
      try {
        s = newGame(
          Array.from({ length: nPlayers }, (_, i) => ({
            name: `Bot${i + 1}`,
            color: "#0ff",
            isBot: true,
          })),
        );
      } finally {
        Math.random = orig;
      }

      let steps = 0;
      while (!s.over) {
        steps++;
        expect(steps, `seed ${seed}: bot game did not terminate`).toBeLessThan(
          8000,
        );
        const action = botDecide(s, rnd);
        const err = applyAction(s, action);
        expect(
          err,
          `seed ${seed} step ${steps}: bot chose illegal ${JSON.stringify(action)}`,
        ).toBeNull();
      }
      expect(s.ranking).toBeDefined();
      expect(s.telem.placements).toBeGreaterThan(30);
    }
  });
});
