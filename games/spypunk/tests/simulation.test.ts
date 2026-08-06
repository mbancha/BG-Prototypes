// Randomized full-game monkey test: plays complete games with random
// deploys/placements/answers and asserts engine invariants after every
// action. Catches frame-machine wedges and rule-helper leaks across all 60
// effects far beyond what the unit tests reach.

import { describe, expect, it } from "vitest";
import { CONFIG } from "../src/data/config";
import { placementCheck, surroundingCells } from "../src/game/grid";
import { applyAction, newGame } from "../src/game/turn";
import type { Cell, GameState } from "../src/game/types";
import { cellKey } from "../src/game/types";

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

function checkInvariants(s: GameState, ctx: string) {
  for (let q = 0; q < s.players.length; q++) {
    const p = s.players[q];
    expect(p.money, `${ctx}: money ${q}`).toBeGreaterThanOrEqual(0);
    expect(p.supply, `${ctx}: supply ${q}`).toBeGreaterThanOrEqual(0);
    expect(p.hand.length, `${ctx}: hand ${q}`).toBeLessThanOrEqual(
      CONFIG.HAND_LIMIT,
    );
    let onBoard = 0;
    for (const pl of Object.values(s.board)) {
      expect(pl.inf[q], `${ctx}: negative influence`).toBeGreaterThanOrEqual(0);
      if (pl.scored)
        expect(pl.inf[q], `${ctx}: scored card holds influence`).toBe(0);
      onBoard += pl.inf[q];
    }
    expect(p.supply + onBoard, `${ctx}: token conservation ${q}`).toBe(
      CONFIG.INFLUENCE_SUPPLY,
    );
  }
  for (const pl of Object.values(s.board)) {
    expect(s.cellOwner[cellKey(pl.a)], `${ctx}: cell map a`).toBe(pl.id);
    expect(s.cellOwner[cellKey(pl.b)], `${ctx}: cell map b`).toBe(pl.id);
  }
}

function randomPlacement(
  s: GameState,
  rnd: () => number,
): { at: Cell; rot: number } | null {
  const cells = new Set<string>();
  if (s.turn.setup) {
    cells.add("0,0");
    cells.add("1,0");
    cells.add("0,1"); // anchors whose domino can cover the origin
    cells.add("-1,0");
    cells.add("0,-1");
  } else {
    for (const pl of Object.values(s.board))
      for (const c of surroundingCells(pl))
        if (s.cellOwner[cellKey(c)] === undefined) cells.add(cellKey(c));
  }
  const anchors = [...cells]
    .map((k) => {
      const [x, y] = k.split(",").map(Number);
      return { x, y };
    })
    .sort(() => rnd() - 0.5);
  for (const at of anchors)
    for (const rot of [0, 1, 2, 3].sort(() => rnd() - 0.5))
      if (placementCheck(s, at, rot).ok) return { at, rot };
  return null;
}

function answerRandomly(s: GameState, rnd: () => number) {
  const pend = s.pending!;
  const pick = <T>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];
  let ans: any;
  switch (pend.t) {
    case "hub": {
      const i = Math.floor(rnd() * pend.items.length);
      ans =
        pend.items[i].optional && rnd() < 0.3 ? { i, skip: true } : { i };
      break;
    }
    case "card":
      ans =
        pend.skip && rnd() < 0.25
          ? { skip: true }
          : { card: pick(pend.ids) };
      break;
    case "owner":
      ans =
        pend.skip && rnd() < 0.25
          ? { skip: true }
          : { p: pick(pend.owners).p };
      break;
    case "player":
      ans = { p: pick(pend.players) };
      break;
    case "opt":
      ans = { k: pick(pend.options).k };
      break;
    case "line":
      ans = { key: pick(pend.lines).key };
      break;
    case "deckOrder":
      ans = { order: [...pend.cards].sort(() => rnd() - 0.5) };
      break;
  }
  const err = applyAction(s, { a: "answer", ans });
  expect(err, `answer rejected: ${JSON.stringify(ans)}`).toBeNull();
}

function playFullGame(seed: number, nPlayers: number) {
  const rnd = mulberry32(seed);
  const origRandom = Math.random;
  Math.random = rnd; // seeded shuffle in newGame
  let s: GameState;
  try {
    s = newGame(
      Array.from({ length: nPlayers }, (_, i) => ({
        name: `P${i + 1}`,
        color: "#0ff",
      })),
    );
  } finally {
    Math.random = origRandom;
  }

  let steps = 0;
  while (!s.over) {
    steps++;
    expect(steps, `seed ${seed}: game did not terminate`).toBeLessThan(6000);
    const ctx = `seed ${seed} step ${steps}`;

    if (s.pending) {
      answerRandomly(s, rnd);
    } else if (s.passPending) {
      expect(applyAction(s, { a: "beginTurn" }), ctx).toBeNull();
    } else if (!s.turn.placed || s.turn.setup) {
      // occasionally deploy first
      if (!s.turn.setup && !s.turn.deployed && rnd() < 0.45) {
        const hand = s.players[s.turn.p].hand;
        if (hand.length > 0) {
          const card = hand[Math.floor(rnd() * hand.length)];
          applyAction(s, { a: "deploy", card }); // may reject (cost/disabled) — fine
        }
      }
      if (s.pending) {
        checkInvariants(s, ctx);
        continue; // deploy opened a decision
      }
      const hand = s.players[s.turn.p].hand;
      if (hand.length === 0) {
        expect(applyAction(s, { a: "endTurn" }), ctx).toBeNull();
      } else {
        const spot = randomPlacement(s, rnd);
        expect(spot, `${ctx}: no legal placement found`).not.toBeNull();
        const card = hand[Math.floor(rnd() * hand.length)];
        const err = applyAction(s, {
          a: "place",
          card,
          at: spot!.at,
          rot: spot!.rot,
        });
        expect(err, `${ctx}: placement rejected`).toBeNull();
      }
    } else {
      expect(applyAction(s, { a: "endTurn" }), ctx).toBeNull();
    }
    checkInvariants(s, ctx);
  }

  expect(s.ranking).toBeDefined();
  expect(s.telem.placements).toBeGreaterThan(30);
  return s;
}

describe("randomized full games", () => {
  it("plays 2-, 3- and 4-player games to completion with invariants held", () => {
    let totalMatches = 0;
    for (let seed = 1; seed <= 24; seed++) {
      const nPlayers = 2 + (seed % 3);
      const s = playFullGame(seed * 7919, nPlayers);
      const t = s.telem.matchesBySym;
      totalMatches += t.muscle + t.intel + t.favor + t.credit + t.whisper;
    }
    // across 24 random games symbol matches must actually be happening
    expect(totalMatches).toBeGreaterThan(100);
  });
});
