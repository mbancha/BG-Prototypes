// Starter test suite. These four tests are the ones worth keeping in every
// prototype, whatever the game:
//   1. a targeted rules test (replace with your real scoring cases)
//   2. the board limit / legality boundary
//   3. a seeded full game with bots — catches wedges no unit test reaches
//   4. determinism, so simulations and bug reports are reproducible
// Add a case every time a playtest turns up a surprise.

import { describe, expect, it } from "vitest";
import { CONFIG } from "../src/data/config";
import { botDecide } from "../src/game/bot";
import { applyAction, newGame, placementCheck } from "../src/game/engine";
import { mulberry32, runSimulation } from "../src/sim/sim";

const players = (n = 2) =>
  ["A", "B", "C", "D"].slice(0, n).map((name, i) => ({
    name,
    color: ["#0ff", "#f0f", "#ff0", "#f00"][i],
  }));

function fresh(n = 2, board?: { width: number; height: number }) {
  const s = newGame(players(n), board, mulberry32(1));
  s.passPending = false;
  return s;
}

describe("placement", () => {
  it("scores one point per adjacent piece", () => {
    const s = fresh();
    const first = s.players[0].hand[0];
    expect(applyAction(s, { a: "place", tile: first, cell: { x: 0, y: 0 } })).toBeNull();
    expect(s.players[0].pts).toBe(0); // nothing to touch yet
    s.passPending = false;
    const second = s.players[1].hand[0];
    expect(applyAction(s, { a: "place", tile: second, cell: { x: 1, y: 0 } })).toBeNull();
    expect(s.players[1].pts).toBe(CONFIG.POINTS_PER_NEIGHBOR);
  });

  it("requires contact and refuses to over-span the limit", () => {
    const s = fresh(2, { width: 2, height: 2 });
    applyAction(s, { a: "place", tile: s.players[0].hand[0], cell: { x: 0, y: 0 } });
    // (1,1) is inside the 2×2 span but only touches diagonally
    expect(placementCheck(s, { x: 1, y: 1 }).reason).toBe("Must touch a tile");
    expect(placementCheck(s, { x: 1, y: 0 }).ok).toBe(true);
    s.passPending = false;
    applyAction(s, { a: "place", tile: s.players[1].hand[0], cell: { x: 1, y: 0 } });
    // columns are now maxed at 2 — x=2 can never be played
    expect(placementCheck(s, { x: 2, y: 0 }).ok).toBe(false);
  });
});

describe("full games", () => {
  it("bots play seeded games to completion using only legal actions", () => {
    for (const [seed, n] of [
      [7, 2],
      [8, 3],
      [9, 4],
    ] as const) {
      const rnd = mulberry32(seed);
      const s = newGame(
        players(n).map((p) => ({ ...p, isBot: true })),
        undefined,
        rnd,
      );
      let steps = 0;
      while (!s.over) {
        expect(++steps).toBeLessThan(4000);
        expect(applyAction(s, botDecide(s, rnd))).toBeNull();
      }
      expect(s.ranking).toBeDefined();
    }
  });

  it("simulations are deterministic for a seed", () => {
    const opts = { games: 20, players: 2, seed: 5 };
    expect(runSimulation(opts).avgScore).toBe(runSimulation(opts).avgScore);
    expect(
      runSimulation(opts).winRateBySeat.reduce((a, b) => a + b, 0),
    ).toBeCloseTo(1, 6);
  });
});
