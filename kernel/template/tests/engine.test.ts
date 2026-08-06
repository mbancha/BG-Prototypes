// Starter test suite. These are the tests worth keeping in every prototype,
// whatever the game:
//   1. targeted rules tests (replace with your real scoring cases)
//   2. the board limit / legality boundary
//   3. a seeded full game with bots — catches wedges no unit test reaches
//   4. RANDOM-PLAY FUZZING with invariants checked after every action — the
//      cheapest bug-per-line in the repo, and the thing that tells you a new
//      mechanic didn't break an old one
//   5. determinism and replay, so simulations and bug reports reproduce
// Add a case every time a playtest turns up a surprise.

import { describe, expect, it } from "vitest";
import { CONFIG } from "../src/data/config";
import { fuzz, looseRandom, replay, type GameApi } from "../src/kernel/harness";
import { census } from "../src/kernel/zones";
import { botDecide } from "../src/game/bot";
import {
  applyAction,
  handOf,
  legalActions,
  newGame,
  placementCheck,
  pts,
  type Action,
  type GameState,
} from "../src/game/engine";
import { runSimulation } from "../src/sim/sim";

const seats = (n = 2) =>
  ["A", "B", "C", "D"].slice(0, n).map((name, i) => ({
    name,
    color: ["#0ff", "#f0f", "#ff0", "#f00"][i],
    isBot: false,
  }));

function fresh(n = 2, board?: { width: number; height: number }) {
  const s = newGame(seats(n), { ...board, seed: 1 });
  s.passPending = false;
  return s;
}

/** Everything that must be true after EVERY action, in every game. When one
 *  of these fires during a fuzz run you get the seed and step for free. */
function invariants(s: GameState, ctx: string) {
  const c = census(s.zones);
  expect(c.total, `${ctx}: components went missing`).toBe(CONFIG.DECK_SIZE);
  expect(c.duplicates, `${ctx}: a tile is in two places`).toEqual([]);
  expect(Object.keys(s.cellOwner).length, `${ctx}: board/index disagree`).toBe(
    Object.keys(s.placedAt).length,
  );
  for (const p of s.players)
    expect(pts(p), `${ctx}: negative score`).toBeGreaterThanOrEqual(0);
  if (s.pending)
    expect(s.pending.who, `${ctx}: prompt for a nonexistent seat`).toBeLessThan(
      s.players.length,
    );
}

const api = (n: number, board?: { width: number; height: number }): GameApi<GameState, Action> => ({
  create: (seed) =>
    newGame(
      seats(n).map((p) => ({ ...p, isBot: true })),
      { ...board, seed },
    ),
  apply: applyAction,
  legal: legalActions,
  over: (s) => s.over,
});

describe("placement", () => {
  it("scores one point per adjacent piece", () => {
    const s = fresh();
    const first = handOf(s, 0)[0];
    expect(applyAction(s, { a: "place", tile: first, cell: { x: 0, y: 0 } })).toBeNull();
    expect(pts(s.players[0])).toBe(0); // nothing to touch yet
    s.passPending = false;
    const second = handOf(s, 1)[0];
    expect(applyAction(s, { a: "place", tile: second, cell: { x: 1, y: 0 } })).toBeNull();
    expect(pts(s.players[1])).toBe(CONFIG.POINTS_PER_NEIGHBOR);
  });

  it("requires contact and refuses to over-span the limit", () => {
    const s = fresh(2, { width: 2, height: 2 });
    applyAction(s, { a: "place", tile: handOf(s, 0)[0], cell: { x: 0, y: 0 } });
    // (1,1) is inside the 2×2 span but only touches diagonally
    expect(placementCheck(s, { x: 1, y: 1 }).reason).toBe("Must touch a tile");
    expect(placementCheck(s, { x: 1, y: 0 }).ok).toBe(true);
    s.passPending = false;
    applyAction(s, { a: "place", tile: handOf(s, 1)[0], cell: { x: 1, y: 0 } });
    // columns are now maxed at 2 — x=2 can never be played
    expect(placementCheck(s, { x: 2, y: 0 }).ok).toBe(false);
  });
});

describe("decisions", () => {
  it("parks a choice instead of resolving it, and honours the answer", () => {
    // build an L so the next tile touches two pieces and triggers the bonus
    const s = fresh();
    applyAction(s, { a: "place", tile: handOf(s, 0)[0], cell: { x: 0, y: 0 } });
    s.passPending = false;
    applyAction(s, { a: "place", tile: handOf(s, 1)[0], cell: { x: 1, y: 0 } });
    s.passPending = false;
    applyAction(s, { a: "place", tile: handOf(s, 0)[0], cell: { x: 0, y: 1 } });
    s.passPending = false;
    expect(
      applyAction(s, { a: "place", tile: handOf(s, 1)[0], cell: { x: 1, y: 1 } }),
    ).toBeNull();

    expect(s.pending, "two neighbours should have opened a choice").not.toBeNull();
    expect(s.pending!.who).toBe(1);
    // the engine must refuse ordinary actions while a question is open
    expect(applyAction(s, { a: "beginTurn" })).toBe("Answer the open question first");
    const before = pts(s.players[1]);
    expect(applyAction(s, { a: "answer", ans: { k: "pts" } })).toBeNull();
    expect(pts(s.players[1])).toBe(before + CONFIG.BONUS_POINTS);
    expect(s.pending).toBeNull();
  });

  it("offers every legal answer through legalActions", () => {
    const s = fresh();
    s.pending = {
      t: "choose",
      who: 0,
      prompt: "x",
      options: [{ k: "a", label: "A" }, { k: "b", label: "B", disabled: true }],
    };
    const acts = legalActions(s);
    expect(acts).toEqual([{ a: "answer", ans: { k: "a" } }]);
  });
});

describe("full games", () => {
  it("bots play seeded games to completion using only legal actions", () => {
    for (const [seed, n] of [
      [7, 2],
      [8, 3],
      [9, 4],
    ] as const) {
      const rnd = looseRandom(seed);
      const s = api(n).create(seed);
      let steps = 0;
      while (!s.over) {
        expect(++steps).toBeLessThan(4000);
        expect(applyAction(s, botDecide(s, rnd))).toBeNull();
      }
      expect(s.result).toBeDefined();
      expect(s.result!.winners.length).toBeGreaterThan(0);
    }
  });

  it("survives random-legal play with invariants held after every action", () => {
    for (const n of [2, 3, 4]) {
      const res = fuzz(api(n), { games: 40, seed: n * 1000, check: invariants });
      expect(res.games).toBe(40);
      expect(res.maxSteps).toBeLessThan(4000);
    }
  });
});

describe("reproducibility", () => {
  it("replays a game exactly from its seed and action log", () => {
    const rnd = looseRandom(99);
    const a = api(3);
    const first = a.create(4242);
    const actions: Action[] = [];
    while (!first.over) {
      const action = botDecide(first, rnd);
      expect(applyAction(first, action)).toBeNull();
      actions.push(action);
    }
    // Only possible because the RNG lives inside the state.
    const again = replay(a, 4242, actions);
    expect(JSON.stringify(again)).toBe(JSON.stringify(first));
  });

  it("simulations are deterministic for a seed", () => {
    const opts = { games: 20, players: 2, seed: 5 };
    expect(runSimulation(opts).avgScore).toBe(runSimulation(opts).avgScore);
    expect(
      runSimulation(opts).winRateBySeat.reduce((a, b) => a + b, 0),
    ).toBeCloseTo(1, 6);
  });
});
