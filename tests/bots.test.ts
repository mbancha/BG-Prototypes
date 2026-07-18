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

describe("bot opponents", () => {
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
