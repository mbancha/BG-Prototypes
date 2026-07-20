// COLOR-GROUPS MODE tests. Tile ids are deterministic (deck built before the
// shuffle): pairs in COLOR_DEFS order — red/cyan 1-3, red/green 4-6,
// red/gold 7-9, red/violet 10-12, cyan/green 13-15, cyan/gold 16-18,
// cyan/violet 19-21, green/gold 22-24, green/violet 25-27, gold/violet
// 28-30. With the ★ variant on, bonus tiles follow as 31-50: per pair one
// tile per BONUS_TILE_VALUES entry ([1,2]) in the same pair order — so
// red/cyan ★+1 = 31, red/cyan ★+2 = 32, red/green ★+1 = 33, and so on.

import { describe, expect, it } from "vitest";
import { COLOR_CFG, CONFIG } from "../src/data/config";
import {
  applyColor,
  colorBotDecide,
  groupValue,
  newColorGame,
  type ColorState,
  type ColorVariant,
} from "../src/color/engine";

const V = (over: Partial<ColorVariant> = {}): ColorVariant => ({
  scoring: "size",
  specials: false,
  powers: false,
  ...over,
});

function freshC(variant: ColorVariant, n = 2): ColorState {
  const s = newColorGame(
    ["A", "B", "C", "D"].slice(0, n).map((name, i) => ({
      name,
      color: ["#0ff", "#f0f", "#ff0", "#f00"][i],
    })),
    variant,
  );
  s.passPending = false;
  return s;
}

/** Force a placement by player p, bypassing hand/deal randomness. */
function forcePlaceC(
  s: ColorState,
  p: number,
  id: number,
  x: number,
  y: number,
  rot = 0,
) {
  s.turn.p = p;
  s.passPending = false;
  s.deck = s.deck.filter((t) => t !== id);
  for (const q of s.players) q.hand = q.hand.filter((t) => t !== id);
  s.players[p].hand.push(id);
  const err = applyColor(s, { a: "place", tile: id, at: { x, y }, rot });
  if (err) throw new Error(err);
}

const groupOf = (s: ColorState, cellK: string) =>
  s.groups[s.cellGroup[cellK]];

describe("grouping & matching", () => {
  it("match adds influence; singleton halves start empty groups", () => {
    const s = freshC(V());
    forcePlaceC(s, 0, 1, 0, 0, 0); // red@(0,0), cyan@(0,1) — opening, no match
    expect(groupOf(s, "0,0").inf).toEqual([0, 0]);
    forcePlaceC(s, 1, 4, 1, 0, 0); // red@(1,0) matches; green@(1,1) singleton
    const red = groupOf(s, "0,0");
    expect(red.cells.sort()).toEqual(["0,0", "1,0"]);
    expect(red.inf).toEqual([0, COLOR_CFG.MATCH_INFLUENCE]);
    expect(groupOf(s, "1,1").inf).toEqual([0, 0]);
    expect(s.telem.matchesByColor.red).toBe(1);
  });

  it("a bridging half merges two groups and pools their influence", () => {
    const s = freshC(V());
    forcePlaceC(s, 0, 1, 0, 0, 0); // red@(0,0), cyan@(0,1)
    forcePlaceC(s, 1, 7, 1, 1, 3); // red@(1,1) (vs cyan: no match), gold@(2,1)
    expect(groupOf(s, "1,1").inf).toEqual([0, 0]);
    forcePlaceC(s, 0, 10, 1, 0, 3); // red@(1,0) bridges both reds, violet@(2,0)
    const reds = Object.values(s.groups).filter(
      (g) => g.color === "red" && !g.scored,
    );
    expect(reds.length).toBe(1);
    expect(reds[0].cells.sort()).toEqual(["0,0", "1,0", "1,1"]);
    expect(reds[0].inf).toEqual([1, 0]); // one match event for the bridge
  });
});

describe("sealing & scoring", () => {
  /** Builds: cyan pair group at (0,1)/(0,2) with P1 holding 1 influence,
   *  then seals it with two no-match fillers. */
  function sealScenario(variant: ColorVariant): ColorState {
    const s = freshC(variant);
    forcePlaceC(s, 0, 1, 0, 0, 0); // red@(0,0), cyan@(0,1)
    forcePlaceC(s, 1, 13, 0, 2, 0); // cyan@(0,2) match → P1 +1; green@(0,3)
    forcePlaceC(s, 0, 22, -1, 2, 2); // green@(-1,2), gold@(-1,1) — no matches
    expect(groupOf(s, "0,1").scored).toBe(false);
    forcePlaceC(s, 1, 28, 1, 1, 0); // gold@(1,1), violet@(1,2) — seals cyan
    return s;
  }

  it("a group scores only when its whole perimeter fills (SIZE value)", () => {
    const s = sealScenario(V({ scoring: "size" }));
    const cyan = groupOf(s, "0,1");
    expect(cyan.scored).toBe(true);
    expect(s.players[1].pts).toBe(2 * COLOR_CFG.GROUP_SCORE_PER_TILE);
    expect(s.players[0].pts).toBe(0);
    expect(cyan.inf).toEqual([0, 0]); // influence returned
    expect(s.players[1].supply).toBe(CONFIG.INFLUENCE_SUPPLY);
    expect(s.telem.groupsScored).toBe(1);
  });

  it("FIXED variant pays the flat value regardless of size", () => {
    const s = sealScenario(V({ scoring: "fixed" }));
    expect(s.players[1].pts).toBe(COLOR_CFG.GROUP_SCORE_FIXED);
  });

  it("★ tiles extend groups with value instead of influence", () => {
    const s = freshC(V({ specials: true }));
    forcePlaceC(s, 0, 1, 0, 0, 0); // red@(0,0), cyan@(0,1)
    forcePlaceC(s, 1, 32, 1, 0, 0); // ★+2 red/cyan — extends BOTH groups
    const red = groupOf(s, "0,0");
    const cyan = groupOf(s, "0,1");
    expect(red.cells.sort()).toEqual(["0,0", "1,0"]); // member, not neighbor
    expect(cyan.cells.sort()).toEqual(["0,1", "1,1"]);
    expect(red.inf).toEqual([0, 0]); // ★ halves never add influence
    expect(cyan.inf).toEqual([0, 0]);
    expect(s.telem.matchesByColor.red).toBe(0); // and don't count as matches
    expect(groupValue(s, red)).toBe(2 + 2); // size 2 + member ★+2
    expect(groupValue(s, cyan)).toBe(2 + 2);
  });
});

describe("color powers", () => {
  it("red steals from the leading opponent instead of adding", () => {
    const s = freshC(V({ powers: true }));
    forcePlaceC(s, 0, 1, 0, 0, 0); // red@(0,0)
    forcePlaceC(s, 1, 4, 0, -1, 2); // red@(0,-1) match: no opp inf → adds P1
    expect(groupOf(s, "0,0").inf).toEqual([0, 1]);
    forcePlaceC(s, 0, 10, 1, 0, 3); // red@(1,0) match: steals P1's token
    expect(groupOf(s, "0,0").inf).toEqual([0, 0]);
    expect(s.players[1].supply).toBe(CONFIG.INFLUENCE_SUPPLY);
    expect(s.telem.infRemoved).toBe(1);
  });

  it("green matches add double influence", () => {
    const s = freshC(V({ powers: true }));
    forcePlaceC(s, 0, 4, 0, 0, 0); // red@(0,0), green@(0,1)
    forcePlaceC(s, 1, 22, 1, 1, 0); // green@(1,1) match → +POWER_GREEN_ADD
    expect(groupOf(s, "0,1").inf).toEqual([0, COLOR_CFG.POWER_GREEN_ADD]);
  });

  it("gold groups are worth bonus points", () => {
    const s = freshC(V({ powers: true }));
    forcePlaceC(s, 0, 7, 0, 0, 0); // red@(0,0), gold@(0,1)
    forcePlaceC(s, 1, 28, 0, 2, 0); // gold@(0,2) match, violet@(0,3)
    expect(groupValue(s, groupOf(s, "0,1"))).toBe(
      2 + COLOR_CFG.POWER_GOLD_BONUS,
    );
  });

  it("violet spreads influence to adjacent groups instead of its own", () => {
    const s = freshC(V({ powers: true }));
    forcePlaceC(s, 0, 10, 0, 0, 0); // red@(0,0), violet@(0,1)
    forcePlaceC(s, 1, 25, 1, 0, 0); // green@(1,0), violet@(1,1) — violet match
    const violet = groupOf(s, "0,1");
    expect(violet.cells.length).toBe(2);
    expect(violet.inf).toEqual([0, 0]); // nothing lands on the violet group
    expect(groupOf(s, "0,0").inf).toEqual([0, 1]); // red neighbor seeded
    expect(groupOf(s, "1,0").inf).toEqual([0, 1]); // green neighbor seeded
    expect(s.players[1].supply).toBe(CONFIG.INFLUENCE_SUPPLY - 2);
  });

  it("cyan pays the runner-up half value when the group seals", () => {
    const s = freshC(V({ powers: true }));
    forcePlaceC(s, 0, 1, 0, 0, 2); // cyan@(0,-1), red@(0,0) covers origin
    forcePlaceC(s, 1, 16, 0, -2, 2); // cyan@(0,-2) match → P1 1; gold@(0,-3)
    forcePlaceC(s, 0, 19, 1, -1, 3); // cyan@(1,-1) match → P0 1; violet@(2,-1)
    forcePlaceC(s, 0, 20, 1, -2, 2); // cyan@(1,-2) match → P0 2; violet@(1,-3)
    const cyan = groupOf(s, "0,-1");
    expect(cyan.cells.length).toBe(4);
    expect(cyan.inf).toEqual([2, 1]);
    // seal the four open sides with no-match fillers
    forcePlaceC(s, 1, 22, -1, -2, 0); // green@(-1,-2), gold@(-1,-1)
    forcePlaceC(s, 0, 23, 1, 0, 3); // green@(1,0), gold@(2,0)
    expect(groupOf(s, "0,-1").scored).toBe(false);
    forcePlaceC(s, 1, 24, 2, -2, 3); // green@(2,-2), gold@(3,-2) — seals
    expect(groupOf(s, "0,-1").scored).toBe(true);
    expect(s.players[0].pts).toBe(4); // winner: size 4
    expect(s.players[1].pts).toBe(Math.floor(4 / 2)); // intel runner-up
  });
});

describe("color bots", () => {
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

  it("all-bot games terminate with conservation intact (both variants)", () => {
    const cases: [number, number, ColorVariant][] = [
      [11, 2, V({ specials: true, powers: true })],
      [22, 3, V({ scoring: "fixed" })],
    ];
    for (const [seed, n, variant] of cases) {
      const rnd = mulberry32(seed);
      const orig = Math.random;
      Math.random = rnd;
      let s: ColorState;
      try {
        s = newColorGame(
          Array.from({ length: n }, (_, i) => ({
            name: `Bot${i + 1}`,
            color: "#0ff",
            isBot: true,
          })),
          variant,
        );
      } finally {
        Math.random = orig;
      }
      let steps = 0;
      while (!s.over) {
        steps++;
        expect(steps, `seed ${seed}: no termination`).toBeLessThan(4000);
        const err = applyColor(s, colorBotDecide(s, rnd));
        expect(err, `seed ${seed} step ${steps}`).toBeNull();
        for (let q = 0; q < n; q++) {
          const onGroups = Object.values(s.groups).reduce(
            (a, g) => a + g.inf[q],
            0,
          );
          expect(
            s.players[q].supply + onGroups,
            `seed ${seed} step ${steps}: conservation ${q}`,
          ).toBe(CONFIG.INFLUENCE_SUPPLY);
        }
      }
      expect(s.ranking).toBeDefined();
      expect(s.telem.placements).toBeGreaterThan(20);
    }
  });
});
