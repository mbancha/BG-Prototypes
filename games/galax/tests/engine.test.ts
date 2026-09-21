import { describe, it, expect } from "vitest";
import {
  newGame,
  applyAction,
  legalActions,
  assertInvariants,
  waypoints,
  at,
  CARDS,
  research,
  controls,
  type GameState,
  type Action,
} from "../src/game/engine";
import { botDecide } from "../src/game/bot";
import { playerView } from "../src/game/views";
const seats = Array.from({ length: 2 }, (_, i) => ({
  name: "P" + i,
  color: "blue",
  isBot: true,
}));
function act(s: GameState, a: Action) {
  expect(applyAction(s, a)).toBeNull();
  assertInvariants(s);
}
function setup(seed = 1) {
  const s = newGame(seats, { seed });
  for (let i = 0; i < 30 && ["home", "forces"].includes(s.phase); i++)
    act(s, botDecide(s));
  return s;
}
describe("source-backed Galax", () => {
  it("has exactly the supplied 44 systems, 12 anomalies and Super Nova", () => {
    expect(
      Object.values(CARDS).filter((c) => c.kind === "system"),
    ).toHaveLength(44);
    expect(Object.keys(CARDS)).toHaveLength(57);
    expect(CARDS.c01.techName).toBe("Research Downlink");
  });
  it("uses shared six-waypoint geometry", () => {
    const s = newGame(seats);
    expect(waypoints(s.locations[0])).toHaveLength(6);
    expect(
      s.locations.some((l) => waypoints(l).some((w) => at(s, w).length === 2)),
    ).toBe(true);
  });
  it("rejects illegal actions without mutating state", () => {
    const s = setup(),
      before = JSON.stringify(s);
    expect(applyAction(s, { a: "invent", card: "missing" })).toBe(
      "Illegal action",
    );
    expect(JSON.stringify(s)).toBe(before);
  });
  it("omits private hands, hidden cards, seed, RNG and deck order from views", () => {
    const s = setup(),
      v = playerView(s, 0);
    expect(v.players[1].hand).toEqual([]);
    expect(v.deck).toEqual([]);
    expect(v.rng).toBeUndefined();
    expect(v.seed).toBeUndefined();
    expect(
      v.locations
        .filter((l) => !l.faceUp)
        .every((l) => l.card === null && l.planets.length === 0),
    ).toBe(true);
  });
  it("replays deterministically and conserves components through full games", () => {
    for (const n of [2, 3, 4])
      for (let seed = 1; seed <= 4; seed++) {
        const input = Array.from({ length: n }, (_, i) => ({
          name: "P" + i,
          color: "blue",
          isBot: true,
        }));
        const s = newGame(input, { seed }),
          r = newGame(input, { seed });
        for (let step = 0; step < 1800 && !s.over; step++) {
          const a = botDecide(s);
          act(s, a);
          act(r, a);
        }
        expect(r).toEqual(s);
        expect(s.over).toBe(true);
      }
  }, 120000);
  it("research is live and drops if Blue civilizations are lost", () => {
    const s = setup();
    for (const q of s.locations) for (const t of q.planets) t.civs = [];
    const p = s.active,
      l = s.locations.find(
        (l) => l.faceUp && l.card && CARDS[l.card].color === "Blue",
      );
    if (l) {
      l.planets[0].civs = [{ id: 999, owner: p, captives: [] }];
      expect(research(s, p)).toBeGreaterThanOrEqual(3);
      l.planets[0].civs = [];
      expect(research(s, p)).toBe(s.players[p].research);
    }
  });
});
