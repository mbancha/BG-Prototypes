import { describe, it, expect } from "vitest";
import {
  newGame,
  applyAction,
  legalActions,
  assertInvariants,
  CARDS,
  waypoints,
  at,
  research,
  type GameState,
  type Action,
} from "../src/game/engine";
import { botDecide, decideFromView } from "../src/game/bot";
import { playerView } from "../src/game/views";
function base() {
  const s = newGame(
    [
      { name: "A", color: "red" },
      { name: "B", color: "blue" },
    ],
    { seed: 121 },
  );
  for (let n = 0; n < 30 && ["home", "forces"].includes(s.phase); n++)
    applyAction(s, botDecide(s));
  s.phase = "act";
  s.pending = null;
  s.queue = [];
  s.players[s.active].research = 12;
  s.players[s.active].pools = { Blue: 12, Red: 12, Green: 12, Yellow: 12 };
  return s;
}
function take(s: GameState, id: string, p = s.active) {
  for (const x of s.players) {
    x.hand = x.hand.filter((c) => c !== id);
    x.techs = x.techs.filter((c) => c !== id);
  }
  s.deck = s.deck.filter((c) => c !== id);
  s.discard = s.discard.filter((c) => c !== id);
  for (const l of s.locations)
    if (l.card === id) {
      l.card = s.deck.pop()!;
      l.planets = CARDS[l.card].planets.map((t) => ({
        ...t,
        civs: [],
        exploited: false,
      }));
    }
  const x = s.players[p];
  if (x.hand.length === 7) s.discard.push(x.hand.pop()!);
  x.hand.push(id);
}
function doAction(s: GameState, a: Action) {
  expect(applyAction(s, a)).toBeNull();
  assertInvariants(s);
}
describe("effect and privacy regressions", () => {
  for (const id of Object.keys(CARDS).filter((id) => id[0] === "c"))
    it(id + " imports, invents and resolves without losing components", () => {
      const s = base(),
        p = s.active;
      take(s, id);
      doAction(
        s,
        legalActions(s).find((a) => a.a === "invent" && a.card === id)!,
      );
      let n = 0;
      while (s.pending && n++ < 200) {
        const options = legalActions(s);
        const a = options.find((a) => a.mode !== "skip") ?? options[0];
        doAction(s, a);
      }
      expect(n).toBeLessThan(200);
      expect(s.players[p].stats.invented[id]).toBe(1);
      expect(
        CARDS[id].techType === "Technology"
          ? s.players[p].techs.includes(id)
          : !s.players[p].techs.includes(id),
      ).toBe(true);
    });
  it("batches multiple Civs into one Commerce activation", () => {
    const s = base();
    const a = legalActions(s).find(
      (a) => a.a === "build" && (a.planets?.length ?? 0) >= 2,
    )!;
    expect(a).toBeDefined();
    const l = s.locations.find((l) => l.id === a.location)!;
    doAction(s, a);
    expect(
      a.planets!.every((i) =>
        l.planets[i].civs.some((c) => c.owner === s.active),
      ),
    ).toBe(true);
    expect(
      legalActions(s).some(
        (v) => (v.a === "commerce" || v.a === "build") && v.location === l.id,
      ),
    ).toBe(false);
  });
  it("does not leak secret battle commitments to the other player or bots", () => {
    const s = base(),
      p = s.active,
      d = 1 - p,
      l = s.locations.find((l) => l.faceUp && l.card)!;
    s.fleets = [];
    s.fleets.push(
      { id: 900, owner: p, wp: waypoints(l)[0], level: 1 },
      { id: 901, owner: d, wp: waypoints(l)[3], level: 1 },
    );
    doAction(
      s,
      legalActions(s).find((a) => a.a === "attack" && a.location === l.id)!,
    );
    const first = s.pending!.who;
    doAction(s, legalActions(s).find((a) => a.cards?.includes("r01"))!);
    const next = s.pending!.who;
    expect(next).not.toBe(first);
    expect(playerView(s, next).battle!.committed[first]).toBeUndefined();
    const opts = legalActions(s),
      v = playerView(s, next),
      before = decideFromView(v, opts);
    s.battle!.committed[first] = [];
    expect(decideFromView(playerView(s, next), opts)).toEqual(before);
    let n = 0;
    while (s.pending && n++ < 30) doAction(s, botDecide(s));
    expect(s.battle).toBeNull();
  });
  it("random legal actions preserve invariants across unusual choices", () => {
    let r = 921;
    const rand = () => {
      r = (Math.imul(r, 1664525) + 1013904223) >>> 0;
      return r;
    };
    for (let seed = 0; seed < 12; seed++) {
      const s = newGame(
        [
          { name: "A", color: "red" },
          { name: "B", color: "blue" },
          { name: "C", color: "green" },
        ],
        { seed },
      );
      for (let step = 0; step < 500 && !s.over; step++) {
        const aa = legalActions(s);
        doAction(s, aa[rand() % aa.length]);
      }
    }
  }, 60000);
});
