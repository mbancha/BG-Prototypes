// =============================================================================
// MECHANISM CONFORMANCE — worked examples proving the kernel spans the range
// of games this repo is for, from tic-tac-toe to a civ engine.
//
// Each block below is a COMPLETE, PLAYABLE micro-game built only from the
// kernel primitives, then run through the fuzzer to the end. They are here to
// answer "can this architecture express X?" with running code instead of a
// promise — and to be copied when your game needs the same mechanism.
//
// They are not good games. They are the smallest thing that exercises the
// seam honestly.
//
// SAFE TO DELETE once your prototype is real. Keep the ones whose mechanism
// you actually use — they become regression tests for your own rules.
// =============================================================================

import { describe, expect, it } from "vitest";
import {
  graph,
  groups,
  hexGrid,
  linesIn,
  majority,
  pathTo,
  squareGrid,
  xy,
  type NodeKey,
} from "../src/kernel/board";
import {
  answerOptions,
  popFrame,
  pump,
  pushFrame,
  registerFrame,
  takeAns,
  answer as deliverAnswer,
  type Answer,
  type Frame,
  type HasDecisions,
} from "../src/kernel/decide";
import { canPay, gain, pay, produce, type Pool } from "../src/kernel/econ";
import {
  allPassed,
  beginRound,
  beginSimultaneous,
  current,
  newFlow,
  nextTurn,
  passSeat,
  reorder,
  rotated,
  spend,
  submit,
  type Flow,
} from "../src/kernel/flow";
import { fuzz, type GameApi } from "../src/kernel/harness";
import { finish, type HasOutcome } from "../src/kernel/outcome";
import { makeRng, nextInt, roll, shuffle, type RngState } from "../src/kernel/rng";
import type { Seat } from "../src/kernel/types";
import {
  at,
  census,
  count,
  draw,
  drawTo,
  move,
  newZones,
  refillRow,
  zid,
  type PieceId,
  type Zones,
} from "../src/kernel/zones";

// ---------------------------------------------------------------------------
// 1. TIC-TAC-TOE — a FIXED board, no components, and a win condition that has
//    nothing to do with points. The opposite corner of the design space from
//    the tile-laying template, and the case a floating-extent board can't
//    express.
// ---------------------------------------------------------------------------

describe("mechanism: fixed board + pattern win (tic-tac-toe)", () => {
  const LINES = linesIn(3, 3, 3);
  const TOPO = squareGrid(3, 3);

  interface TTT extends HasOutcome {
    marks: Record<NodeKey, Seat>;
    flow: Flow;
  }
  type Move = { a: "mark"; at: NodeKey };

  const api: GameApi<TTT, Move> = {
    create: () => ({ marks: {}, flow: newFlow(2), over: false }),
    legal: (s) =>
      s.over
        ? []
        : TOPO.nodes()!
            .filter((k) => s.marks[k] === undefined)
            .map((k) => ({ a: "mark", at: k }) as Move),
    over: (s) => s.over,
    apply: (s, m) => {
      if (s.over) return "Game is over";
      const p = current(s.flow);
      if (s.marks[m.at] !== undefined) return "Taken";
      s.marks[m.at] = p;
      const won = LINES.some((line) => line.every((k) => s.marks[k] === p));
      if (won) finish(s, { reason: "three in a row", seats: [0, 1], winners: [p] });
      else if (Object.keys(s.marks).length === 9)
        // a draw is two seats tied for first, not "nobody won"
        finish(s, { reason: "board full", seats: [0, 1], metrics: [() => 0] });
      else nextTurn(s.flow);
      return null;
    },
  };

  it("detects a win, a draw, and never runs past a full board", () => {
    const s = api.create(0);
    for (const k of [xy(0, 0), xy(1, 1), xy(0, 1), xy(2, 2), xy(0, 2)])
      api.apply(s, { a: "mark", at: k });
    expect(s.result!.winners).toEqual([0]);
    expect(api.legal(s)).toEqual([]);
    expect(api.apply(s, { a: "mark", at: xy(1, 0) })).toBe("Game is over");
  });

  it("plays out from every random line", () => {
    const res = fuzz(api, { games: 300, maxSteps: 9 });
    expect(res.maxSteps).toBeLessThanOrEqual(9);
    // random play produces both outcomes — if it didn't, the win check is wrong
    let draws = 0;
    let wins = 0;
    for (let g = 0; g < 300; g++) {
      const s = api.create(g);
      fuzz({ ...api, create: () => s }, { games: 1, seed: g + 1, maxSteps: 9 });
      s.result!.winners.length === 2 ? draws++ : wins++;
    }
    expect(draws).toBeGreaterThan(0);
    expect(wins).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 2. TRICK-TAKING — hidden hands, a legality rule that depends on what was
//    led (follow suit), and a winner who leads the next trick. Proves zones +
//    turn-order reassignment.
// ---------------------------------------------------------------------------

describe("mechanism: hidden hands + follow suit (trick-taking)", () => {
  const SUITS = ["c", "d", "h", "s"];
  const suitOf = (c: PieceId) => String(c)[0];
  const rankOf = (c: PieceId) => Number(String(c).slice(1));

  interface Tricks extends HasOutcome {
    zones: Zones;
    flow: Flow;
    rng: RngState;
    led: string | null;
    tricksWon: number[];
  }
  type Move = { a: "play"; card: PieceId };

  const PLAYERS = 4;
  const api: GameApi<Tricks, Move> = {
    create: (seed) => {
      const rng = makeRng(seed);
      // `played@p` is where a card sits while the trick is on the table —
      // one zone per card at all times, so the census stays exact.
      const zones = newZones(PLAYERS, ["deck"], ["hand", "played", "won"]);
      zones.deck = shuffle(
        rng,
        SUITS.flatMap((su) => [2, 5, 9, 13].map((r) => `${su}${r}`)),
      );
      for (let p = 0; p < PLAYERS; p++) drawTo(zones, "deck", zid("hand", p), 4);
      return {
        zones,
        rng,
        flow: newFlow(PLAYERS),
        led: null,
        tricksWon: new Array(PLAYERS).fill(0),
        over: false,
      };
    },
    legal: (s) => {
      if (s.over) return [];
      const hand = at(s.zones, zid("hand", current(s.flow)));
      const must = s.led ? hand.filter((c) => suitOf(c) === s.led) : [];
      return (must.length ? must : hand).map((card) => ({ a: "play", card }) as Move);
    },
    over: (s) => s.over,
    apply: (s, m) => {
      const p = current(s.flow);
      const hand = at(s.zones, zid("hand", p));
      if (!hand.includes(m.card)) return "Not in hand";
      if (s.led && suitOf(m.card) !== s.led && hand.some((c) => suitOf(c) === s.led))
        return "Must follow suit";
      move(s.zones, zid("hand", p), zid("played", p), m.card);
      if (s.led === null) s.led = suitOf(m.card);

      const onTable = (q: Seat) => at(s.zones, zid("played", q));
      if (s.flow.order.some((q) => onTable(q).length === 0)) {
        nextTurn(s.flow);
        return null;
      }
      // resolve: highest card of the led suit takes it
      let winner = 0;
      let best = -1;
      for (let q = 0; q < PLAYERS; q++) {
        const c = onTable(q)[0];
        if (suitOf(c) === s.led && rankOf(c) > best) {
          best = rankOf(c);
          winner = q;
        }
      }
      s.tricksWon[winner]++;
      for (let q = 0; q < PLAYERS; q++)
        for (const c of [...onTable(q)]) move(s.zones, zid("played", q), zid("won", winner), c);
      s.led = null;
      // the trick winner leads the next one
      reorder(s.flow, rotated([0, 1, 2, 3], winner));
      s.flow.idx = 0;
      s.flow.turn++;
      if (at(s.zones, zid("hand", winner)).length === 0)
        finish(s, {
          reason: "hand played out",
          seats: [0, 1, 2, 3],
          metrics: [(q) => s.tricksWon[q]],
        });
      return null;
    },
  };

  it("enforces following suit", () => {
    const s = api.create(1);
    s.zones[zid("hand", 0)] = ["h9", "s2"];
    s.zones[zid("hand", 1)] = ["h5", "c2"];
    api.apply(s, { a: "play", card: "h9" });
    expect(api.apply(s, { a: "play", card: "c2" })).toBe("Must follow suit");
    expect(api.legal(s)).toEqual([{ a: "play", card: "h5" }]);
  });

  it("plays whole hands out, and every card ends up won by someone", () => {
    fuzz(api, {
      games: 60,
      check: (s, ctx) => {
        expect(census(s.zones).total, ctx).toBe(16);
        expect(census(s.zones).duplicates, ctx).toEqual([]);
      },
    });
    const s = api.create(5);
    fuzz({ ...api, create: () => s }, { games: 1 });
    expect(s.tricksWon.reduce((a, b) => a + b, 0)).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// 3. WORKER PLACEMENT — blocked action spaces, an economy, passing out of the
//    round rather than taking a fixed number of turns, and a round loop with
//    income. The engine-building middle of the hobby.
// ---------------------------------------------------------------------------

describe("mechanism: worker placement (blocking, passing, income)", () => {
  const SPACES = {
    quarry: { stone: 2 },
    forest: { wood: 2 },
    market: { coin: 3 },
    guild: { wood: -1, stone: -1, vp: 4 },
  } as const;
  const ROUNDS = 3;

  interface WP extends HasOutcome {
    zones: Zones; // space@quarry etc. hold the workers placed there
    flow: Flow;
    pool: Pool[];
    workers: number[];
  }
  type Move = { a: "place"; space: string } | { a: "pass" };

  const api: GameApi<WP, Move> = {
    create: () => ({
      zones: newZones(0, Object.keys(SPACES).map((k) => `space@${k}`)),
      flow: newFlow(3),
      pool: [0, 1, 2].map(() => ({ wood: 1, stone: 1, coin: 0, vp: 0 })),
      workers: [2, 2, 2],
      over: false,
    }),
    over: (s) => s.over,
    legal: (s) => {
      if (s.over) return [];
      const p = current(s.flow);
      if (p < 0 || s.workers[p] === 0) return [{ a: "pass" }];
      const open = Object.keys(SPACES).filter(
        (k) =>
          count(s.zones, `space@${k}`) === 0 &&
          canPay(s.pool[p], costOf(k)),
      );
      return open.length
        ? open.map((space) => ({ a: "place", space }) as Move)
        : [{ a: "pass" }];
    },
    apply: (s, m) => {
      const p = current(s.flow);
      if (m.a === "pass") passSeat(s.flow, p);
      else {
        if (count(s.zones, `space@${m.space}`) > 0) return "Space is taken";
        if (s.workers[p] === 0) return "No workers left";
        if (!pay(s.pool[p], costOf(m.space))) return "Can't afford it";
        at(s.zones, `space@${m.space}`).push(`w${p}`);
        s.workers[p]--;
        gain(s.pool[p], gainOf(m.space));
      }
      if (allPassed(s.flow)) return endRound(s);
      nextTurn(s.flow);
      return null;
    },
  };

  const costOf = (k: string): Pool => {
    const out: Pool = {};
    for (const [r, v] of Object.entries(SPACES[k as keyof typeof SPACES]))
      if (v < 0) out[r] = -v;
    return out;
  };
  const gainOf = (k: string): Pool => {
    const out: Pool = {};
    for (const [r, v] of Object.entries(SPACES[k as keyof typeof SPACES]))
      if (v > 0) out[r] = v;
    return out;
  };

  function endRound(s: WP): null {
    if (s.flow.round === ROUNDS) {
      finish(s, {
        reason: `${ROUNDS} rounds`,
        seats: [0, 1, 2],
        metrics: [(p) => s.pool[p].vp, (p) => s.pool[p].coin],
      });
      return null;
    }
    for (const k of Object.keys(SPACES)) s.zones[`space@${k}`] = []; // workers home
    s.workers = [2, 2, 2];
    for (const pool of s.pool) produce(pool, { coin: 1 }, { coin: 6 }); // income + cap
    beginRound(s.flow);
    return null;
  }

  it("blocks an occupied space", () => {
    const s = api.create(0);
    api.apply(s, { a: "place", space: "quarry" });
    expect(api.apply(s, { a: "place", space: "quarry" })).toBe("Space is taken");
    expect(api.legal(s).some((m) => m.a === "place" && m.space === "quarry")).toBe(
      false,
    );
  });

  it("ends the round only when everyone has passed, then runs three rounds", () => {
    const s = api.create(0);
    passSeat(s.flow, 0);
    passSeat(s.flow, 1);
    expect(allPassed(s.flow)).toBe(false);
    expect(s.flow.round).toBe(1);
    passSeat(s.flow, 2);
    expect(allPassed(s.flow)).toBe(true);

    fuzz(api, {
      games: 50,
      check: (st, ctx) => {
        expect(st.flow.round, ctx).toBeLessThanOrEqual(ROUNDS);
        for (const pool of st.pool)
          for (const v of Object.values(pool))
            expect(v, `${ctx}: negative resource`).toBeGreaterThanOrEqual(0);
      },
    });
  });
});

// ---------------------------------------------------------------------------
// 4. PUSH-YOUR-LUCK — dice rolled DURING the game, plus a decision after every
//    roll. Only works because the RNG is part of the state: undo a roll and
//    the re-roll comes out the same, which is the difference between a
//    prototype you can trust and one where the undo button is a cheat code.
// ---------------------------------------------------------------------------

describe("mechanism: in-state dice + push your luck", () => {
  interface Dice extends HasOutcome, HasDecisions {
    rng: RngState;
    flow: Flow;
    banked: number[];
    pot: number;
    seen: number[];
  }
  type Move = { a: "roll" } | { a: "answer"; ans: Answer };

  registerFrame<Dice>("pushLuck", (s, f: Frame) => {
    if (f.ph === 0) {
      f.ph = 1;
      s.pending = {
        t: "confirm",
        who: current(s.flow),
        prompt: `pot ${s.pot} — roll again?`,
        options: [
          { k: "yes", label: "Roll" },
          { k: "no", label: "Bank" },
        ],
      };
      return;
    }
    const p = current(s.flow);
    if (takeAns(f)!.k === "no") {
      s.banked[p] += s.pot;
      s.pot = 0;
      s.seen = [];
      popFrame(s);
      endTurn(s);
      return;
    }
    f.ph = 0;
    doRoll(s);
  });

  function doRoll(s: Dice) {
    const d = roll(s.rng, 6);
    if (s.seen.includes(d)) {
      s.pot = 0; // bust
      s.seen = [];
      s.exec = [];
      s.pending = null;
      endTurn(s);
      return;
    }
    s.seen.push(d);
    s.pot += d;
  }

  function endTurn(s: Dice) {
    if (s.flow.turn >= 12)
      finish(s, {
        reason: "12 turns",
        seats: [0, 1],
        metrics: [(p) => s.banked[p]],
      });
    else nextTurn(s.flow);
  }

  const api: GameApi<Dice, Move> = {
    create: (seed) => ({
      rng: makeRng(seed),
      flow: newFlow(2),
      banked: [0, 0],
      pot: 0,
      seen: [],
      exec: [],
      pending: null,
      over: false,
    }),
    over: (s) => s.over,
    legal: (s) =>
      s.over
        ? []
        : s.pending
          ? answerOptions(s.pending).map((ans) => ({ a: "answer", ans }) as Move)
          : [{ a: "roll" }],
    apply: (s, m) => {
      if (m.a === "answer") return deliverAnswer(s, m.ans);
      if (s.pending) return "Answer first";
      doRoll(s);
      if (!s.over && s.pot > 0) {
        pushFrame(s, "pushLuck", {});
        pump(s);
      }
      return null;
    },
  };

  it("re-rolls identically after an undo", () => {
    const s = api.create(11);
    const snapshot = structuredClone(s);
    api.apply(s, { a: "roll" });
    const after = structuredClone(s);
    // "undo" = go back to the snapshot and do it again
    api.apply(snapshot, { a: "roll" });
    expect(JSON.stringify(snapshot)).toBe(JSON.stringify(after));
  });

  it("busts on a repeat and plays full games", () => {
    const s = api.create(3);
    s.seen = [4];
    s.pot = 10;
    s.rng = makeRng(1);
    while (roll(structuredClone(s).rng, 6) !== 4) s.rng = makeRng(s.rng.s + 1);
    api.apply(s, { a: "roll" });
    expect(s.pot).toBe(0);

    fuzz(api, {
      games: 80,
      check: (st, ctx) => {
        expect(st.pot, ctx).toBeGreaterThanOrEqual(0);
        expect(new Set(st.seen).size, `${ctx}: duplicate die kept`).toBe(
          st.seen.length,
        );
      },
    });
  });
});

// ---------------------------------------------------------------------------
// 5. DECK-BUILDING — a personal deck, discard and hand per player, a shared
//    market row, and the reshuffle that makes the whole genre work.
// ---------------------------------------------------------------------------

describe("mechanism: deck-building (personal decks, market row, reshuffle)", () => {
  const START = 6;
  const MARKET = 4;

  interface DB extends HasOutcome {
    zones: Zones;
    rng: RngState;
    flow: Flow;
    coins: number[];
    reshuffles: number;
  }
  type Move = { a: "buy"; card: PieceId } | { a: "end" };

  const api: GameApi<DB, Move> = {
    create: (seed) => {
      const rng = makeRng(seed);
      const zones = newZones(2, ["supply", "market"], ["deck", "hand", "discard"]);
      zones.supply = Array.from({ length: 20 }, (_, i) => `buy${i}`);
      refillRow(zones, "supply", "market", MARKET);
      for (let p = 0; p < 2; p++) {
        zones[zid("deck", p)] = shuffle(
          rng,
          Array.from({ length: START }, (_, i) => `p${p}c${i}`),
        );
        drawTo(zones, zid("deck", p), zid("hand", p), 3);
      }
      return { zones, rng, flow: newFlow(2), coins: [0, 0], reshuffles: 0, over: false };
    },
    over: (s) => s.over,
    legal: (s) => {
      if (s.over) return [];
      const p = current(s.flow);
      const affordable = at(s.zones, "market").length > 0 && s.coins[p] >= 1;
      return [
        ...(affordable
          ? at(s.zones, "market").map((card) => ({ a: "buy", card }) as Move)
          : []),
        { a: "end" },
      ];
    },
    apply: (s, m) => {
      const p = current(s.flow);
      if (m.a === "buy") {
        if (s.coins[p] < 1) return "No coins";
        if (!move(s.zones, "market", zid("discard", p), m.card)) return "Not for sale";
        s.coins[p]--;
        refillRow(s.zones, "supply", "market", MARKET);
        return null;
      }
      // cleanup: hand → discard, draw a new hand, reshuffling when needed
      const hand = at(s.zones, zid("hand", p));
      while (hand.length) move(s.zones, zid("hand", p), zid("discard", p), hand[0]);
      const before = count(s.zones, zid("discard", p));
      const drawn = draw(s.zones, zid("deck", p), zid("hand", p), 3, {
        reshuffleFrom: zid("discard", p),
        rng: s.rng,
      });
      if (count(s.zones, zid("discard", p)) < before && drawn.length > 0)
        s.reshuffles++;
      s.coins[p] += drawn.length; // each card is worth a coin, near enough
      if (s.flow.turn >= 24)
        finish(s, {
          reason: "24 turns",
          seats: [0, 1],
          metrics: [
            (q) =>
              count(s.zones, zid("deck", q)) +
              count(s.zones, zid("hand", q)) +
              count(s.zones, zid("discard", q)),
          ],
        });
      else nextTurn(s.flow);
      return null;
    },
  };

  it("cycles decks through the discard without losing a card", () => {
    const res = fuzz(api, {
      games: 30,
      check: (s, ctx) => {
        expect(census(s.zones).total, ctx).toBe(20 + 2 * START);
        expect(census(s.zones).duplicates, ctx).toEqual([]);
      },
    });
    expect(res.last!.state.reshuffles).toBeGreaterThan(0); // the loop really ran
  });
});

// ---------------------------------------------------------------------------
// 6. CIV ENGINE (the Through the Ages shape) — action points, a card row that
//    ages and slides, multi-resource production with prerequisites, phases
//    inside a turn, and eras. The heavy end of what this repo is for.
// ---------------------------------------------------------------------------

describe("mechanism: action points + aging card row + production (civ engine)", () => {
  const ROW = 5;
  const ACTIONS = 4;
  const CARDS = {
    farm: { cost: { food: 2 }, needs: null, gives: { food: 1 } },
    mine: { cost: { food: 1, ore: 1 }, needs: null, gives: { ore: 1 } },
    lab: { cost: { ore: 3 }, needs: "mine", gives: { science: 2 } },
    wonder: { cost: { ore: 4, science: 4 }, needs: "lab", gives: { culture: 6 } },
  } as const;
  type CardName = keyof typeof CARDS;

  interface Civ extends HasOutcome {
    zones: Zones;
    rng: RngState;
    flow: Flow;
    pool: Pool[];
    built: CardName[][];
    era: number;
  }
  type Move =
    | { a: "take"; card: PieceId }
    | { a: "build"; card: PieceId }
    | { a: "endTurn" };

  const nameOf = (c: PieceId) => String(c).split("#")[0] as CardName;
  /** Position in the row is the cost, Through-the-Ages style: the oldest card
   *  (front of the row) is free, later ones cost actions. */
  const rowCost = (s: Civ, c: PieceId) =>
    Math.max(1, Math.ceil((at(s.zones, "row").indexOf(c) + 1) / 2));

  const api: GameApi<Civ, Move> = {
    create: (seed) => {
      const rng = makeRng(seed);
      const zones = newZones(2, ["ageI", "ageII", "row"], ["hand", "tableau"]);
      const names = Object.keys(CARDS) as CardName[];
      zones.ageI = shuffle(rng, Array.from({ length: 18 }, (_, i) => `${names[i % 4]}#${i}`));
      zones.ageII = shuffle(rng, Array.from({ length: 18 }, (_, i) => `${names[i % 4]}#${i + 100}`));
      refillRow(zones, "ageI", "row", ROW);
      return {
        zones,
        rng,
        flow: newFlow(2, { phase: "action", actionsPerTurn: ACTIONS }),
        pool: [0, 1].map(() => ({ food: 3, ore: 3, science: 0, culture: 0 })),
        built: [[], []],
        era: 1,
        over: false,
      };
    },
    over: (s) => s.over,
    legal: (s) => {
      if (s.over) return [];
      const p = current(s.flow);
      const out: Move[] = [{ a: "endTurn" }];
      for (const c of at(s.zones, "row"))
        if (s.flow.actions >= rowCost(s, c)) out.push({ a: "take", card: c });
      for (const c of at(s.zones, zid("hand", p)))
        if (
          s.flow.actions >= 1 &&
          canPay(s.pool[p], CARDS[nameOf(c)].cost) &&
          prereqOk(s, p, nameOf(c))
        )
          out.push({ a: "build", card: c });
      return out;
    },
    apply: (s, m) => {
      const p = current(s.flow);
      if (m.a === "take") {
        const cost = rowCost(s, m.card);
        if (!spend(s.flow, cost)) return "Not enough actions";
        if (!move(s.zones, "row", zid("hand", p), m.card)) return "Not in the row";
        refillRow(s.zones, s.era === 1 ? "ageI" : "ageII", "row", ROW);
        return null;
      }
      if (m.a === "build") {
        if (!prereqOk(s, p, nameOf(m.card))) return "Missing prerequisite";
        if (!spend(s.flow, 1)) return "Not enough actions";
        if (!pay(s.pool[p], CARDS[nameOf(m.card)].cost)) return "Can't afford it";
        move(s.zones, zid("hand", p), zid("tableau", p), m.card);
        s.built[p].push(nameOf(m.card));
        return null;
      }
      // production phase, then the next player's action phase
      for (const name of s.built[p]) gain(s.pool[p], CARDS[name].gives);
      const r = nextTurn(s.flow, { actionsPerTurn: ACTIONS });
      if (r.wrapped) {
        beginRound(s.flow, undefined, { actionsPerTurn: ACTIONS, phase: "action" });
        if (s.flow.round === 4 && s.era === 1) {
          s.era = 2; // era flip: the old row is discarded, the new deck feeds it
          s.zones.row = [];
          refillRow(s.zones, "ageII", "row", ROW);
        }
        if (s.flow.round > 6)
          finish(s, {
            reason: "6 rounds",
            seats: [0, 1],
            metrics: [
              (q) => s.pool[q].culture,
              (q) => s.pool[q].science,
            ],
            scores: s.pool.map((x) => ({ culture: x.culture, science: x.science })),
          });
      }
      return null;
    },
  };

  const prereqOk = (s: Civ, p: Seat, name: CardName) => {
    const needs = CARDS[name].needs;
    return needs === null || s.built[p].includes(needs as CardName);
  };

  it("refuses a card whose prerequisite isn't built", () => {
    const s = api.create(2);
    s.zones[zid("hand", 0)] = ["wonder#1"];
    s.pool[0] = { food: 9, ore: 9, science: 9, culture: 0 };
    expect(api.apply(s, { a: "build", card: "wonder#1" })).toBe("Missing prerequisite");
    s.built[0] = ["lab"];
    expect(api.apply(s, { a: "build", card: "wonder#1" })).toBeNull();
  });

  it("limits a turn to its action points", () => {
    const s = api.create(2);
    expect(s.flow.actions).toBe(ACTIONS);
    let taken = 0;
    while (api.legal(s).some((m) => m.a === "take")) {
      api.apply(s, api.legal(s).find((m) => m.a === "take")!);
      taken++;
    }
    expect(s.flow.actions).toBeLessThan(ACTIONS);
    expect(taken).toBeLessThanOrEqual(ACTIONS);
  });

  it("runs six rounds through an era flip with the economy intact", () => {
    fuzz(api, {
      games: 40,
      check: (s, ctx) => {
        expect(s.flow.actions, ctx).toBeGreaterThanOrEqual(0);
        for (const v of Object.values(s.pool[0]))
          expect(v, `${ctx}: negative resource`).toBeGreaterThanOrEqual(0);
        expect(count(s.zones, "row"), ctx).toBeLessThanOrEqual(ROW);
      },
    });
    const s = api.create(9);
    fuzz({ ...api, create: () => s }, { games: 1 });
    expect(s.era).toBe(2); // the era really flipped
  });
});

// ---------------------------------------------------------------------------
// 7. AREA MAJORITY ON A HEX MAP — a different topology entirely, scored with
//    the same group/majority helpers the square-grid games use.
// ---------------------------------------------------------------------------

describe("mechanism: hex board + area majority", () => {
  const TOPO = hexGrid({ radius: 2 });

  it("scores contiguous regions by who holds the most of each", () => {
    const owner: Record<NodeKey, Seat> = {
      [xy(0, 0)]: 0,
      [xy(1, 0)]: 0,
      [xy(1, -1)]: 1,
      [xy(-2, 0)]: 1, // an island, far side of the board
    };
    // one region of three touching hexes, plus a separate single hex
    const regions = groups(TOPO, Object.keys(owner));
    expect(regions.map((r) => r.length).sort()).toEqual([1, 3]);

    const big = regions.find((r) => r.length === 3)!;
    const counts = [0, 0];
    for (const k of big) counts[owner[k]]++;
    expect(majority(counts)).toEqual({ top: 2, leaders: [0] });
  });

  it("splits a tied region between its leaders", () => {
    const counts = [2, 2, 1];
    const { leaders } = majority(counts);
    expect(leaders).toEqual([0, 1]);
  });
});

// ---------------------------------------------------------------------------
// 8. ROUTE NETWORK — claim edges on a point-to-point map and score a
//    connection. Ticket to Ride, Brass, Pandemic-style maps.
// ---------------------------------------------------------------------------

describe("mechanism: point-to-point map + route scoring", () => {
  const EDGES: [string, string][] = [
    ["a", "b"],
    ["b", "c"],
    ["c", "d"],
    ["a", "e"],
    ["e", "d"],
  ];
  const MAP = graph(EDGES);
  const edgeKey = (a: string, b: string) => [a, b].sort().join("-");

  interface Rail extends HasOutcome {
    claimed: Record<string, Seat>;
    flow: Flow;
    scored: number[];
  }
  type Move = { a: "claim"; edge: string };

  const api: GameApi<Rail, Move> = {
    create: () => ({ claimed: {}, flow: newFlow(2), scored: [0, 0], over: false }),
    over: (s) => s.over,
    legal: (s) =>
      s.over
        ? []
        : EDGES.map(([x, y]) => edgeKey(x, y))
            .filter((e) => s.claimed[e] === undefined)
            .map((edge) => ({ a: "claim", edge }) as Move),
    apply: (s, m) => {
      const p = current(s.flow);
      if (s.claimed[m.edge] !== undefined) return "Already claimed";
      s.claimed[m.edge] = p;
      // a → d over track you own is worth 5
      const mine = (from: string, to: string) => s.claimed[edgeKey(from, to)] === p;
      const owned = graph(EDGES.filter(([x, y]) => mine(x, y)));
      if (owned.has("a") && owned.has("d") && pathTo(owned, "a", "d")) {
        s.scored[p] += 5;
        finish(s, { reason: "route complete", seats: [0, 1], winners: [p] });
        return null;
      }
      if (Object.keys(s.claimed).length === EDGES.length)
        finish(s, { reason: "map full", seats: [0, 1], metrics: [(q) => s.scored[q]] });
      else nextTurn(s.flow);
      return null;
    },
  };

  it("scores a completed a→d route and ends the game", () => {
    const s = api.create(0);
    api.apply(s, { a: "claim", edge: "a-e" }); // p0
    api.apply(s, { a: "claim", edge: "a-b" }); // p1
    api.apply(s, { a: "claim", edge: "d-e" }); // p0 completes a-e-d
    expect(s.result!.winners).toEqual([0]);
    expect(s.scored[0]).toBe(5);
  });

  it("always terminates on a full map", () => {
    const res = fuzz(api, { games: 100, maxSteps: 5 });
    expect(res.maxSteps).toBeLessThanOrEqual(5);
  });
});

// ---------------------------------------------------------------------------
// 9. SIMULTANEOUS DRAFT — everybody picks at once, then hands pass. The flow
//    doesn't advance until every seat has submitted, which is what
//    `awaiting` is for.
// ---------------------------------------------------------------------------

describe("mechanism: simultaneous selection (drafting)", () => {
  interface Draft extends HasOutcome {
    zones: Zones;
    flow: Flow;
    rng: RngState;
    picks: number[];
  }
  type Move = { a: "pick"; by: Seat; card: PieceId };

  const N = 3;
  const api: GameApi<Draft, Move> = {
    create: (seed) => {
      const rng = makeRng(seed);
      const zones = newZones(N, [], ["hand", "kept"]);
      for (let p = 0; p < N; p++)
        zones[zid("hand", p)] = shuffle(
          rng,
          Array.from({ length: 4 }, (_, i) => `c${p}${i}`),
        );
      const flow = newFlow(N);
      beginSimultaneous(flow);
      return { zones, flow, rng, picks: new Array(N).fill(0), over: false };
    },
    over: (s) => s.over,
    legal: (s) =>
      s.over
        ? []
        : s.flow.awaiting.flatMap((p) =>
            at(s.zones, zid("hand", p)).map((card) => ({ a: "pick", by: p, card }) as Move),
          ),
    apply: (s, m) => {
      if (!s.flow.awaiting.includes(m.by)) return "You have already picked";
      if (!move(s.zones, zid("hand", m.by), zid("kept", m.by), m.card))
        return "Not in your hand";
      s.picks[m.by]++;
      if (!submit(s.flow, m.by)) return null; // still waiting on others
      // everyone has picked: hands pass to the left
      const hands = Array.from({ length: N }, (_, p) => at(s.zones, zid("hand", p)));
      for (let p = 0; p < N; p++) s.zones[zid("hand", p)] = hands[(p + 1) % N];
      if (at(s.zones, zid("hand", 0)).length === 0)
        finish(s, {
          reason: "draft over",
          seats: [0, 1, 2],
          metrics: [(p) => count(s.zones, zid("kept", p))],
        });
      else beginSimultaneous(s.flow);
      return null;
    },
  };

  it("waits for every seat before passing hands", () => {
    const s = api.create(1);
    expect(s.flow.awaiting).toEqual([0, 1, 2]);
    const firstOf = (p: Seat) => at(s.zones, zid("hand", p))[0];
    const p1Hand = [...at(s.zones, zid("hand", 1))];
    api.apply(s, { a: "pick", by: 0, card: firstOf(0) });
    expect(api.apply(s, { a: "pick", by: 0, card: firstOf(0) })).toBe(
      "You have already picked",
    );
    api.apply(s, { a: "pick", by: 1, card: firstOf(1) });
    expect(s.flow.awaiting).toEqual([2]);
    api.apply(s, { a: "pick", by: 2, card: firstOf(2) });
    // seat 0 now holds what seat 1 had left
    expect(at(s.zones, zid("hand", 0))).toEqual(p1Hand.slice(1));
  });

  it("drafts every card without losing one", () => {
    fuzz(api, {
      games: 40,
      check: (s, ctx) => expect(census(s.zones).total, ctx).toBe(N * 4),
    });
  });
});

// ---------------------------------------------------------------------------
// 10. AUCTION — a decision that belongs to somebody who is NOT the active
//     player, asked of each opponent in turn order. Reactions, "may respond"
//     triggers and trades all have this shape.
// ---------------------------------------------------------------------------

describe("mechanism: off-turn decisions (auction)", () => {
  interface Auction extends HasOutcome, HasDecisions {
    flow: Flow;
    rng: RngState;
    coins: number[];
    lots: number;
    high: { seat: Seat; bid: number };
  }
  type Move = { a: "offer" } | { a: "answer"; ans: Answer };

  registerFrame<Auction>("bidRound", (s, f: Frame) => {
    const bidders: Seat[] = f.d.bidders;
    if (f.ph === 1) {
      const ans = takeAns(f)!;
      const who: Seat = f.d.asking;
      if (!ans.skip && ans.n! > s.high.bid) s.high = { seat: who, bid: ans.n! };
      f.ph = 0;
    }
    if (bidders.length === 0) {
      // sold
      s.coins[s.high.seat] -= s.high.bid;
      s.lots--;
      popFrame(s);
      if (s.lots === 0)
        finish(s, {
          reason: "all lots sold",
          seats: s.flow.order,
          metrics: [(p) => s.coins[p]],
        });
      else nextTurn(s.flow);
      return;
    }
    const who = bidders.shift()!;
    // never ask for a bid the player cannot pay — a prompt whose only legal
    // answers are unaffordable is how a bot ends up in debt
    if (s.coins[who] < s.high.bid + 1) return;
    f.d.asking = who;
    f.ph = 1;
    s.pending = {
      t: "number",
      who, // ← not the active player
      prompt: `bid above ${s.high.bid}?`,
      min: s.high.bid + 1,
      max: s.coins[who],
      skip: "pass",
    };
  });

  const api: GameApi<Auction, Move> = {
    create: (seed) => ({
      flow: newFlow(3),
      rng: makeRng(seed),
      coins: [10, 10, 10],
      lots: 3,
      high: { seat: 0, bid: 0 },
      exec: [],
      pending: null,
      over: false,
    }),
    over: (s) => s.over,
    legal: (s) =>
      s.over
        ? []
        : s.pending
          ? answerOptions(s.pending).map((ans) => ({ a: "answer", ans }) as Move)
          : [{ a: "offer" }],
    apply: (s, m) => {
      if (m.a === "answer") return deliverAnswer(s, m.ans);
      const p = current(s.flow);
      s.high = { seat: p, bid: 0 };
      pushFrame(s, "bidRound", {
        bidders: s.flow.order.filter((q) => q !== p),
      });
      pump(s);
      return null;
    },
  };

  it("asks the opponents, not the auctioneer, and refuses answers from others", () => {
    const s = api.create(1);
    api.apply(s, { a: "offer" });
    expect(s.pending!.who).toBe(1); // seat 0 is selling
    expect(deliverAnswer(s, { n: 3 }, 2)).toBe("Not your decision");
    expect(deliverAnswer(s, { n: 3 }, 1)).toBeNull();
    expect(s.pending!.who).toBe(2);
  });

  it("sells every lot without anyone overspending", () => {
    fuzz(api, {
      games: 60,
      check: (s, ctx) => {
        for (const c of s.coins) expect(c, `${ctx}: bid past their means`).toBeGreaterThanOrEqual(0);
        expect(s.lots, ctx).toBeGreaterThanOrEqual(0);
      },
    });
  });
});
