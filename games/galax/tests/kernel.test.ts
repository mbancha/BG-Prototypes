// Unit tests for the kernel primitives. These are game-agnostic: if you copy
// this template and delete a module you don't need, delete its block here too.

import { describe, expect, it } from "vitest";
import {
  distances,
  graph,
  groups,
  growExtent,
  hexDistance,
  hexGrid,
  linesIn,
  majority,
  openGrid,
  pathTo,
  perimeter,
  playableEnvelope,
  squareGrid,
  track,
  withinLimit,
  xy,
} from "../src/kernel/board";
import {
  answerOptions,
  chooseOne,
  popFrame,
  pump,
  pushFrame,
  registerFrame,
  takeAns,
  validateAnswer,
  answer as deliverAnswer,
  type HasDecisions,
} from "../src/kernel/decide";
import { canPay, clampTo, pay, poolTotal, shortfall, transfer } from "../src/kernel/econ";
import {
  allPassed,
  beginRound,
  beginSimultaneous,
  current,
  eliminate,
  grantTurn,
  newFlow,
  nextTurn,
  passSeat,
  rotated,
  seatsAfter,
  snake,
  spend,
  submit,
} from "../src/kernel/flow";
import { finish, rankSeats, winShares } from "../src/kernel/outcome";
import { makeRng, nextFloat, rollMany, shuffle } from "../src/kernel/rng";
import { census, draw, drawTo, move, newZones, refillRow, zid } from "../src/kernel/zones";

describe("rng", () => {
  it("reproduces a sequence from a seed", () => {
    const a = makeRng(7);
    const b = makeRng(7);
    const seqA = Array.from({ length: 20 }, () => nextFloat(a));
    const seqB = Array.from({ length: 20 }, () => nextFloat(b));
    expect(seqA).toEqual(seqB);
    expect(seqA).not.toEqual(Array.from({ length: 20 }, () => nextFloat(makeRng(8))));
  });

  it("rewinds with the state — the reason it lives inside GameState", () => {
    // This is the property an injected `rnd` function cannot give you: undo a
    // dice roll and re-roll, and you must get the same dice.
    const s = { rng: makeRng(42), rolls: [] as number[] };
    const snapshot = structuredClone(s);
    s.rolls = rollMany(s.rng, 5);
    const restored = structuredClone(snapshot);
    expect(rollMany(restored.rng, 5)).toEqual(s.rolls);
  });

  it("shuffles deterministically and keeps every element", () => {
    const deck = Array.from({ length: 40 }, (_, i) => i);
    const a = shuffle(makeRng(3), [...deck]);
    expect(shuffle(makeRng(3), [...deck])).toEqual(a);
    expect([...a].sort((x, y) => x - y)).toEqual(deck);
  });
});

describe("zones", () => {
  it("deals, moves and keeps a complete component census", () => {
    const z = newZones(3, ["deck", "discard"], ["hand"]);
    z.deck = Array.from({ length: 12 }, (_, i) => i + 1);
    for (let p = 0; p < 3; p++) drawTo(z, "deck", zid("hand", p), 3);
    expect(census(z).total).toBe(12);
    expect(census(z).duplicates).toEqual([]);
    const card = z[zid("hand", 0)][0];
    expect(move(z, zid("hand", 0), "discard", card)).toBe(true);
    expect(move(z, zid("hand", 0), "discard", card)).toBe(false); // gone already
    expect(census(z).total).toBe(12);
  });

  it("reshuffles the discard into an empty deck — the deck-building loop", () => {
    const rng = makeRng(1);
    const z = newZones(1, ["deck", "discard"], ["hand"]);
    z.deck = [1, 2];
    z.discard = [3, 4, 5];
    const got = draw(z, "deck", zid("hand", 0), 5, {
      reshuffleFrom: "discard",
      rng,
    });
    expect(got).toHaveLength(5);
    expect(z.discard).toEqual([]);
    expect(census(z).total).toBe(5);
  });

  it("short-draws instead of inventing components", () => {
    const z = newZones(1, ["deck"], ["hand"]);
    z.deck = [1];
    expect(draw(z, "deck", zid("hand", 0), 4)).toHaveLength(1);
  });

  it("refills a market row to a fixed width", () => {
    const z = newZones(0, ["deck", "row"]);
    z.deck = [1, 2, 3, 4, 5, 6];
    refillRow(z, "deck", "row", 4);
    expect(z.row).toHaveLength(4);
    z.row.shift(); // someone bought the oldest card
    refillRow(z, "deck", "row", 4);
    expect(z.row).toHaveLength(4);
    expect(z.deck).toHaveLength(1);
  });
});

describe("flow", () => {
  it("rotates turns and reports the wrap", () => {
    const f = newFlow(3);
    expect(current(f)).toBe(0);
    expect(nextTurn(f).seat).toBe(1);
    expect(nextTurn(f).seat).toBe(2);
    const r = nextTurn(f);
    expect(r).toMatchObject({ seat: 0, wrapped: true });
  });

  it("passes out of a round and starts the next one", () => {
    const f = newFlow(3);
    passSeat(f, 0);
    passSeat(f, 1);
    expect(allPassed(f)).toBe(false);
    expect(nextTurn(f).seat).toBe(2); // only seat 2 can still act
    passSeat(f, 2);
    expect(nextTurn(f).exhausted).toBe(true);
    expect(allPassed(f)).toBe(true);
    expect(beginRound(f)).toBe(0);
    expect(f.round).toBe(2);
    expect(f.passed).toEqual([]);
  });

  it("takes a new turn order between rounds, and snake order", () => {
    const f = newFlow(4);
    expect(rotated(f.order, 2)).toEqual([2, 3, 0, 1]);
    expect(snake(f)).toEqual([3, 2, 1, 0]);
    beginRound(f, [2, 0, 3, 1]);
    expect(current(f)).toBe(2);
    expect(seatsAfter(f, 2)).toEqual([0, 3, 1]);
  });

  it("spends action points and grants extra turns", () => {
    const f = newFlow(2, { actionsPerTurn: 4 });
    expect(spend(f, 3)).toBe(true);
    expect(spend(f, 2)).toBe(false); // atomic: nothing spent
    expect(f.actions).toBe(1);
    grantTurn(f, 1);
    expect(current(f)).toBe(0); // the interrupt is queued behind the current seat
    expect(nextTurn(f, { actionsPerTurn: 4 }).seat).toBe(1);
    expect(f.actions).toBe(4);
  });

  it("skips eliminated seats permanently", () => {
    const f = newFlow(3);
    eliminate(f, 1);
    expect(nextTurn(f).seat).toBe(2);
    beginRound(f);
    expect(current(f)).toBe(0);
    expect(nextTurn(f).seat).toBe(2); // still out after the round flip
  });

  it("runs a simultaneous window", () => {
    const f = newFlow(3);
    beginSimultaneous(f);
    expect(current(f)).toBe(-1); // nobody is "on the clock" — everybody is
    expect(submit(f, 1)).toBe(false);
    expect(submit(f, 0)).toBe(false);
    expect(submit(f, 2)).toBe(true);
    expect(current(f)).toBe(0);
  });
});

describe("decide", () => {
  const blank = (): HasDecisions => ({ exec: [], pending: null });

  it("validates answers against the open question", () => {
    const p = chooseOne(0, "pick", [
      { k: "a", label: "A" },
      { k: "b", label: "B", disabled: true },
    ]);
    expect(validateAnswer(p, { k: "a" })).toBeNull();
    expect(validateAnswer(p, { k: "b" })).toBe("That option isn't available");
    expect(validateAnswer(p, { skip: true })).toBe("That decision can't be skipped");
    expect(validateAnswer({ ...p, skip: "no thanks" }, { skip: true })).toBeNull();
  });

  it("enumerates answers for bots and the fuzzer", () => {
    expect(
      answerOptions({ t: "number", who: 0, prompt: "how many", min: 1, max: 3 }),
    ).toEqual([{ n: 1 }, { n: 2 }, { n: 3 }]);
    const many = answerOptions({
      t: "chooseMany",
      who: 0,
      prompt: "discard 2",
      min: 2,
      max: 2,
      options: [
        { k: "x", label: "X" },
        { k: "y", label: "Y" },
        { k: "z", label: "Z" },
      ],
    });
    expect(many.every((a) => a.ks!.length === 2)).toBe(true);
  });

  it("suspends a multi-step effect mid-decision and resumes on the answer", () => {
    // Two questions in one effect, with state carried between them — the
    // shape every "choose a target, then choose how much" card needs.
    registerFrame<any>("twoStep", (s, f) => {
      if (f.ph === 0) {
        f.ph = 1;
        s.pending = chooseOne(0, "first", [
          { k: "p", label: "plus" },
          { k: "m", label: "minus" },
        ]);
        return;
      }
      if (f.ph === 1) {
        f.d.sign = takeAns(f)!.k === "p" ? 1 : -1;
        f.ph = 2;
        s.pending = { t: "number", who: 0, prompt: "how much", min: 1, max: 5 };
        return;
      }
      s.total += f.d.sign * takeAns(f)!.n!;
      popFrame(s);
    });

    const s = { ...blank(), total: 0 } as any;
    pushFrame(s, "twoStep");
    pump(s);
    expect(s.pending.prompt).toBe("first");
    // a snapshot taken mid-decision is complete and resumable
    const midway = structuredClone(s);
    deliverAnswer(s, { k: "m" });
    expect(s.pending.prompt).toBe("how much");
    deliverAnswer(s, { n: 4 });
    expect(s.total).toBe(-4);
    expect(s.exec).toEqual([]);

    deliverAnswer(midway, { k: "p" });
    deliverAnswer(midway, { n: 4 });
    expect(midway.total).toBe(4); // the undone branch resolves the other way
  });

  it("refuses an answer from the wrong player", () => {
    const s = blank();
    s.pending = chooseOne(2, "your call", [{ k: "a", label: "A" }]);
    expect(deliverAnswer(s, { k: "a" }, 1)).toBe("Not your decision");
    expect(deliverAnswer(s, { k: "a" }, 2)).toBeNull();
  });
});

describe("board", () => {
  it("square grids know their edges", () => {
    const g = squareGrid(3, 3);
    expect(g.neighbors(xy(0, 0)).sort()).toEqual([xy(0, 1), xy(1, 0)].sort());
    expect(g.neighbors(xy(1, 1))).toHaveLength(4);
    expect(squareGrid(3, 3, { diagonals: true }).neighbors(xy(1, 1))).toHaveLength(8);
    expect(g.has(xy(3, 0))).toBe(false);
    expect(g.nodes()).toHaveLength(9);
  });

  it("finds n-in-a-row lines", () => {
    expect(linesIn(3, 3, 3)).toHaveLength(8); // 3 rows, 3 cols, 2 diagonals
    expect(linesIn(7, 6, 4)).toHaveLength(69); // Connect Four
  });

  it("hex grids use axial distance", () => {
    const h = hexGrid({ radius: 2 });
    expect(h.nodes()).toHaveLength(19);
    expect(h.neighbors(xy(0, 0))).toHaveLength(6);
    expect(h.neighbors(xy(2, 0))).toHaveLength(3); // on the rim
    expect(hexDistance(xy(0, 0), xy(2, -1))).toBe(2);
  });

  it("graphs and tracks route", () => {
    const g = graph([
      ["paris", "lyon"],
      ["lyon", "nice"],
      ["paris", "brest"],
    ]);
    expect(pathTo(g, "brest", "nice")).toEqual(["brest", "paris", "lyon", "nice"]);
    expect(distances(g, "paris")["nice"]).toBe(2);
    expect(pathTo(g, "brest", "nice", (k) => k !== "lyon")).toBeNull();
    const t = track(6, { loop: true });
    expect(t.neighbors("5")).toContain("0");
    expect(track(6).neighbors("5")).not.toContain("0");
  });

  it("groups contiguous pieces and detects a sealed one", () => {
    const g = openGrid();
    const colors: Record<string, string> = {
      [xy(0, 0)]: "red",
      [xy(1, 0)]: "red",
      [xy(2, 0)]: "blue",
      [xy(5, 5)]: "red",
    };
    const parts = groups(g, Object.keys(colors), (a, b) => colors[a] === colors[b]);
    expect(parts.map((p) => p.length).sort()).toEqual([1, 1, 2]);

    // a single cell fully boxed in by other pieces has no open edges
    const occupied = new Set([xy(0, 0), xy(1, 0), xy(-1, 0), xy(0, 1), xy(0, -1)]);
    expect(perimeter(g, [xy(0, 0)], (k) => occupied.has(k))).toEqual([]);
    expect(perimeter(g, [xy(1, 0)], (k) => occupied.has(k))).toHaveLength(3);
  });

  it("reports area majorities including ties", () => {
    expect(majority([3, 1, 0])).toEqual({ top: 3, leaders: [0] });
    expect(majority([2, 2, 1])).toEqual({ top: 2, leaders: [0, 1] });
    expect(majority([0, 0])).toEqual({ top: 0, leaders: [] });
  });

  it("caps a floating layout and walls off what can never be played", () => {
    let e = growExtent(undefined, { x: 0, y: 0 });
    e = growExtent(e, { x: 1, y: 0 });
    const limit = { w: 2, h: 2 };
    expect(withinLimit(e, limit, { x: 1, y: 1 })).toBe(true);
    expect(withinLimit(e, limit, { x: 2, y: 0 })).toBe(false);
    expect(playableEnvelope(e, limit)).toEqual({
      minX: 0,
      maxX: 1,
      minY: -1,
      maxY: 1,
    });
  });
});

describe("econ", () => {
  it("pays atomically or not at all", () => {
    const pool = { ore: 3, food: 1 };
    expect(canPay(pool, { ore: 2, food: 2 })).toBe(false);
    expect(pay(pool, { ore: 2, food: 2 })).toBe(false);
    expect(pool).toEqual({ ore: 3, food: 1 }); // nothing taken
    expect(shortfall(pool, { ore: 2, food: 2 })).toEqual({ food: 1 });
    expect(pay(pool, { ore: 2, food: 1 })).toBe(true);
    expect(pool).toEqual({ ore: 1, food: 0 });
  });

  it("trades between players and enforces caps", () => {
    const a = { wood: 4 };
    const b = { wood: 0 };
    expect(transfer(a, b, { wood: 3 })).toBe(true);
    expect([a, b]).toEqual([{ wood: 1 }, { wood: 3 }]);
    const hoard = { food: 9 };
    expect(clampTo(hoard, { food: 5 })).toEqual({ food: 4 });
    expect(poolTotal(hoard)).toBe(5);
  });
});

describe("outcome", () => {
  it("ranks with cascading tiebreakers", () => {
    const pts = [5, 5, 3];
    const cash = [1, 4, 9];
    const r = rankSeats([0, 1, 2], [(p) => pts[p], (p) => cash[p]]);
    expect(r.ranking).toEqual([1, 0, 2]);
    expect(r.winners).toEqual([1]);
  });

  it("keeps draws visible instead of picking a winner", () => {
    const pts = [4, 4, 1];
    const r = rankSeats([0, 1, 2], [(p) => pts[p]]);
    expect(r.winners).toEqual([0, 1]);
    expect(r.tiers).toEqual([[0, 1], [2]]);
    const s = { over: false } as any;
    finish(s, { reason: "draw", seats: [0, 1, 2], metrics: [(p) => pts[p]] });
    expect(winShares(s.result, 3)).toEqual([0.5, 0.5, 0]);
  });

  it("supports lowest-wins, explicit winners and co-op loss", () => {
    const golf = rankSeats([0, 1], [(p) => [9, 2][p]], { lowestWins: true });
    expect(golf.winners).toEqual([1]);

    const race = { over: false } as any;
    finish(race, { reason: "reached the end", seats: [0, 1, 2], winners: [2] });
    expect(race.result.ranking[0]).toBe(2);

    const coop = { over: false } as any;
    finish(coop, { reason: "the plague won", seats: [0, 1], coop: "lost" });
    expect(coop.result.winners).toEqual([]);
    expect(winShares(coop.result, 2)).toEqual([0, 0]);
  });
});
