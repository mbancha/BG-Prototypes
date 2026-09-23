import { describe, it, expect } from "vitest";
import {
  newGame,
  legalActions,
  applyAction,
  assertInvariants,
  waypoints,
  CARDS,
  type Action,
  type GameState,
} from "../src/game/engine";
import { botDecide } from "../src/game/bot";
import { CONFIG } from "../src/data/config";
import { decisionStep } from "../src/game/interaction";
function fixture() {
  const s = newGame(
    [
      { name: "A", color: "red" },
      { name: "B", color: "blue" },
    ],
    { seed: 121 },
  );
  while (["home", "forces"].includes(s.phase)) applyAction(s, botDecide(s));
  s.phase = "act";
  s.queue = [];
  s.pending = null;
  for (const x of s.players) {
    s.discard.push(...x.hand);
    x.hand = [];
    x.research = 0;
    x.trophies = 0;
    x.flags = {};
    x.pools = { Blue: 20, Yellow: 20, Red: 20, Green: 20 };
    x.commerceUsed = [];
  }
  for (const l of s.locations)
    for (const pl of l.planets) {
      pl.civs = [];
      pl.exploited = false;
    }
  const l = s.locations.find((l) => l.faceUp && l.planets.length >= 2)!;
  s.fleets = Array.from({ length: 4 }, () => ({
    id: s.nextId++,
    owner: s.active,
    wp: waypoints(l)[0],
    level: 1 as const,
  }));
  return { s, l, p: s.active };
}
function act(s: GameState, a: Action | undefined) {
  expect(a).toBeDefined();
  expect(applyAction(s, a!)).toBeNull();
  assertInvariants(s);
}
function topRank(s: GameState, rank: number) {
  const i = s.deck.findIndex((id) => CARDS[id].rank === rank);
  expect(i).toBeGreaterThanOrEqual(0);
  s.deck.push(s.deck.splice(i, 1)[0]);
}
describe("September playtest rules", () => {
  it("draws up to eight cards and no farther", () => {
    const { s, p } = fixture();
    s.players[p].hand.push(...s.deck.splice(-7));
    act(s, { a: "draw" });
    expect(s.players[p].hand).toHaveLength(8);
    s.players[p].flags.draw = 0;
    act(s, { a: "draw" });
    expect(s.players[p].hand).toHaveLength(8);
  });
  it("moves only the selected one or two fleets with Green", () => {
    const { s } = fixture();
    const old = s.fleets.map((f) => ({ ...f }));
    const moves = legalActions(s).filter(
      (a) => a.a === "move" && a.color === "Green",
    );
    expect(moves.length).toBeGreaterThan(0);
    expect(moves.every((a) => a.fleets!.length <= 2)).toBe(true);
    const a = moves.find((a) => a.fleets?.length === 2)!;
    act(s, a);
    for (const f of s.fleets)
      expect(f.wp).toBe(
        a.fleets!.includes(f.id) ? a.to : old.find((q) => q.id === f.id)!.wp,
      );
  });
  it("limits the free Green benefit to selected pairs too", () => {
    const { s, l, p } = fixture();
    const green = l;
    const i = s.deck.findIndex(
      (id) => CARDS[id].kind === "system" && CARDS[id].color === "Green",
    );
    expect(i).toBeGreaterThanOrEqual(0);
    const id = s.deck.splice(i, 1)[0];
    s.deck.push(green.card!);
    green.card = id;
    green.planets = CARDS[id].planets.map((pl) => ({
      ...pl,
      civs: [],
      exploited: false,
    }));
    green.planets[0].civs.push({ id: s.nextId++, owner: p, captives: [] });
    s.phase = "start";
    act(s, { a: "beginTurn" });
    expect(s.pending?.task.kind).toBe("freeMove");
    const choices = legalActions(s).filter((a) => a.mode !== "skip");
    expect(choices.every((a) => a.fleets!.length <= 2)).toBe(true);
    const a = choices.find((a) => a.fleets?.length === 2)!;
    act(s, a);
    expect(s.fleets.filter((f) => f.wp === a.to)).toHaveLength(2);
  });
  it("safely draws from an ordinary planet without a random flip", () => {
    const { s, l, p } = fixture();
    l.planets[0].resource = "none";
    const deck = [...s.deck];
    act(
      s,
      legalActions(s).find(
        (a) =>
          a.a === "exploit" &&
          a.location === l.id &&
          a.planet === 0 &&
          a.mode === "safe",
      ),
    );
    expect(s.players[p].hand).toEqual([deck.at(-1)]);
    expect(s.deck).toHaveLength(deck.length - 1);
    expect(l.planets[0].exploited).toBe(true);
  });
  it("rejects tied pushes and rewards strictly higher flips", () => {
    for (const rank of [2, 3]) {
      const { s, l, p } = fixture();
      l.planets[0].resource = "research";
      topRank(s, rank);
      act(
        s,
        legalActions(s).find(
          (a) =>
            a.a === "exploit" &&
            a.location === l.id &&
            a.planet === 0 &&
            a.amount === 2,
        ),
      );
      expect(s.players[p].research).toBe(rank === 3 ? 2 : 0);
      expect(l.planets[0].exploited).toBe(true);
    }
  });
  it("has no push option on normal planets and is blocked by enemy fleets", () => {
    const { s, l, p } = fixture();
    l.planets[0].resource = "none";
    expect(
      legalActions(s)
        .filter(
          (a) => a.a === "exploit" && a.location === l.id && a.planet === 0,
        )
        .every((a) => a.mode === "safe"),
    ).toBe(true);
    s.fleets.push({
      id: s.nextId++,
      owner: 1 - p,
      wp: waypoints(l)[3],
      level: 1,
    });
    expect(
      legalActions(s).some((a) => a.a === "exploit" && a.location === l.id),
    ).toBe(false);
  });
  it("rewards the last unmarked empty planet on success, not failed pushes", () => {
    for (const safe of [true, false]) {
      const { s, l, p } = fixture();
      l.planets.slice(1).forEach((pl) => (pl.exploited = true));
      l.planets[0].resource = "research";
      topRank(s, 2);
      act(
        s,
        legalActions(s).find(
          (a) =>
            a.a === "exploit" &&
            a.location === l.id &&
            a.planet === 0 &&
            (safe ? a.mode === "safe" : a.amount === 2),
        ),
      );
      expect(s.players[p].trophies).toBe(
        safe ? CONFIG.COMPLETE_EXPLOIT_TROPHIES : 0,
      );
    }
  });
  it("leaves exploited enemy Civs intact and grants the existing trophy", () => {
    const { s, l, p } = fixture();
    l.planets[0].civs = [{ id: s.nextId++, owner: 1 - p, captives: [] }];
    act(
      s,
      legalActions(s).find(
        (a) =>
          a.a === "exploit" &&
          a.location === l.id &&
          a.planet === 0 &&
          a.mode === "safe",
      ),
    );
    expect(l.planets[0].civs).toHaveLength(1);
    expect(s.players[p].trophies).toBe(1);
    expect(l.planets[0].exploited).toBe(false);
  });
  it("converts builds to trophies when supply runs out and consumes discounts", () => {
    const { s, l, p } = fixture();
    while (s.fleets.length < CONFIG.PLAYER_TOKEN_COUNT)
      s.fleets.push({
        id: s.nextId++,
        owner: p,
        wp: waypoints(l)[0],
        level: 1,
      });
    l.planets[0].exploited = true;
    const a = legalActions(s).find(
      (a) =>
        a.a === "build" &&
        a.location === l.id &&
        a.planets?.length === 2 &&
        a.planets[0] === 0,
    )!;
    const before = s.players[p].pools.Yellow;
    act(s, a);
    expect(s.players[p].trophies).toBe(2);
    expect(s.players[p].pools.Yellow).toBe(before - 3);
    expect(l.planets[0].exploited).toBe(false);
    expect(l.planets.flatMap((pl) => pl.civs)).toHaveLength(0);
    expect(
      legalActions(s).some((a) => a.a === "build" && a.location === l.id),
    ).toBe(false);
  });
  it("awards one trophy for a Discovery without a printed trophy effect", () => {
    const { s, p } = fixture();
    const id = "c02";
    const zone = s.deck.includes(id) ? s.deck : s.discard;
    const i = zone.indexOf(id);
    expect(i).toBeGreaterThanOrEqual(0);
    zone.splice(i, 1);
    s.players[p].hand.push(id);
    s.players[p].research = 12;
    act(
      s,
      legalActions(s).find((a) => a.a === "invent" && a.card === id),
    );
    expect(s.players[p].trophies).toBe(1);
  });
  it("can resolve every legal action through progressively smaller UI choices", () => {
    const { s } = fixture();
    for (let turn = 0; turn < 120 && !s.over; turn++) {
      const legal = legalActions(s);
      for (const target of legal) {
        let remaining = legal;
        for (let n = 0; n < 20; n++) {
          const step = decisionStep(s, remaining);
          if (!step) break;
          const group = step.groups.find((g) => g.actions.includes(target))!;
          expect(group.actions.length).toBeLessThan(remaining.length);
          remaining = group.actions;
        }
        expect(remaining[0]).toEqual(target);
      }
      act(s, botDecide(s));
    }
  }, 60000);
});
