// COLOR-GROUPS MODE tests. Tile ids are deterministic (deck built before the
// shuffle): base pairs in COLOR_DEFS order (red,cyan,green,gold,violet) ×3 —
// red/cyan 1-3, red/green 4-6, red/gold 7-9, red/violet 10-12, cyan/green
// 13-15, cyan/gold 16-18, cyan/violet 19-21, green/gold 22-24, green/violet
// 25-27, gold/violet 28-30. With the ★ variant on, the bonus tiles follow:
// per pair two +1 tiles (bonus on the first color, then on the second) in
// pair order → red/cyan {red+1}=31 {cyan+1}=32, red/green {red+1}=33
// {green+1}=34, …, gold/violet {gold+1}=49 {violet+1}=50; then one same-color
// +2 tile per color → red/red 51, cyan/cyan 52, green/green 53, gold/gold 54,
// violet/violet 55.

import { describe, expect, it } from "vitest";
import { COLOR_CFG, CONFIG, defaultBoardSize } from "../src/data/config";
import {
  applyColor,
  boundsFor,
  colorBotDecide,
  freeCells,
  groupValue,
  hasLegalPlacement,
  newColorGame,
  openPerimeter,
  placementCheckC,
  type ColorState,
  type ColorVariant,
} from "../src/color/engine";
import { runSimulation } from "../src/color/sim";

// Tests use a roomy board by default so fixed scenarios aren't cramped by
// the walls; bounded-board behaviour gets its own describe block below.
const V = (over: Partial<ColorVariant> = {}): ColorVariant => ({
  scoring: "size",
  specials: false,
  powers: false,
  width: 14,
  height: 14,
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

  it("★ tiles match like normal tiles (base +1) AND add member bonus value", () => {
    const s = freshC(V({ specials: true }));
    forcePlaceC(s, 0, 1, 0, 0, 0); // red@(0,0), cyan@(0,1)
    // tile 51 = red/red ★+2 (bonus on half a). Place vertical at (1,0):
    // red@(1,0) matches the red group; red@(1,1) is its same-color partner.
    forcePlaceC(s, 1, 51, 1, 0, 0);
    const red = groupOf(s, "0,0");
    expect(red.cells.sort()).toEqual(["0,0", "1,0", "1,1"]); // all merged
    expect(red.inf).toEqual([0, 1]); // base +1 influence from the match
    expect(s.telem.matchesByColor.red).toBe(1);
    expect(groupValue(s, red)).toBe(3 + 2); // size 3 + the one ★+2 half
    // the +2 lives on exactly one half
    expect(s.cellBonus["1,0"]).toBe(2);
    expect(s.cellBonus["1,1"]).toBeUndefined();
  });

  it("+1 bonus tiles are two colors with the bonus on one half", () => {
    const s = freshC(V({ specials: true }));
    expect(s.tiles[31].bonus).toEqual([1, 0]); // red(+1)/cyan
    expect(s.tiles[31].a).toBe("red");
    expect(s.tiles[31].b).toBe("cyan");
    expect(s.tiles[32].bonus).toEqual([1, 0]); // cyan(+1)/red
    expect(s.tiles[32].a).toBe("cyan");
    expect(s.tiles[51].a).toBe("red"); // +2 tiles are same color
    expect(s.tiles[51].b).toBe("red");
    expect(s.tiles[51].bonus).toEqual([2, 0]);
  });
});

describe("color powers", () => {
  it("red match adds +1 AND removes a chosen influence from an adjacent group", () => {
    const s = freshC(V({ powers: true }));
    forcePlaceC(s, 0, 4, 0, 0, 0); // red@(0,0), green@(0,1)  [opening]
    // P1 grows the green group so it holds influence (green power → +2)
    forcePlaceC(s, 1, 13, 0, 3, 2); // cyan@(0,3), green@(0,2) matches green
    const green = groupOf(s, "0,1");
    const beforeGreen = green.inf[1];
    expect(beforeGreen).toBeGreaterThan(0);
    // P0 matches the red group; the green group is adjacent (via 0,0–0,1)
    forcePlaceC(s, 0, 7, 0, -1, 2); // red@(0,-1) matches red; gold@(0,-2)
    expect(groupOf(s, "0,0").inf[0]).toBe(1); // base +1 to red for P0
    expect(s.pending?.t).toBe("redRemove"); // removal choice parked
    const opt = s.pending!.options.find(
      (o) => o.owner === 1 && s.groups[o.group].color === "green",
    )!;
    expect(opt).toBeTruthy();
    expect(applyColor(s, { a: "answer", group: opt.group, owner: 1 })).toBeNull();
    expect(groupOf(s, "0,1").inf[1]).toBe(beforeGreen - 1); // P1 token removed
    expect(s.telem.infRemoved).toBe(1);
    expect(s.pending).toBeNull(); // resolved → turn advanced
  });

  it("red power fizzles (no prompt) when no adjacent group holds influence", () => {
    const s = freshC(V({ powers: true }));
    forcePlaceC(s, 0, 1, 0, 0, 0); // red@(0,0), cyan@(0,1)
    forcePlaceC(s, 1, 4, 0, -1, 2); // red@(0,-1) matches red; green@(0,-2)
    // red group now has P1 +1 but no *adjacent* group holds influence
    expect(s.pending).toBeNull(); // nothing to remove → no choice
    expect(groupOf(s, "0,0").inf).toEqual([0, 1]);
  });

  it("green match adds the base +1 plus one extra (net +2)", () => {
    const s = freshC(V({ powers: true }));
    forcePlaceC(s, 0, 4, 0, 0, 0); // red@(0,0), green@(0,1)
    forcePlaceC(s, 1, 22, 1, 1, 0); // green@(1,1) matches green group
    expect(groupOf(s, "0,1").inf).toEqual([
      0,
      COLOR_CFG.MATCH_INFLUENCE + COLOR_CFG.POWER_GREEN_EXTRA,
    ]);
  });

  it("gold groups are worth bonus points (and still get the base +1)", () => {
    const s = freshC(V({ powers: true }));
    forcePlaceC(s, 0, 7, 0, 0, 0); // red@(0,0), gold@(0,1)
    forcePlaceC(s, 1, 28, 0, 2, 0); // gold@(0,2) matches gold; violet@(0,3)
    expect(groupOf(s, "0,1").inf).toEqual([0, 1]); // base influence
    expect(groupValue(s, groupOf(s, "0,1"))).toBe(
      2 + COLOR_CFG.POWER_GOLD_BONUS,
    );
  });

  it("violet match adds +1 to its own group AND +1 to each adjacent group", () => {
    const s = freshC(V({ powers: true }));
    forcePlaceC(s, 0, 10, 0, 0, 0); // red@(0,0), violet@(0,1)
    forcePlaceC(s, 1, 25, 1, 0, 0); // green@(1,0), violet@(1,1) — violet match
    expect(groupOf(s, "0,1").inf).toEqual([0, 1]); // base +1 to violet itself
    expect(groupOf(s, "0,0").inf).toEqual([0, 1]); // red neighbor seeded
    expect(groupOf(s, "1,0").inf).toEqual([0, 1]); // green neighbor seeded
    expect(s.players[1].supply).toBe(CONFIG.INFLUENCE_SUPPLY - 3);
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

describe("bounded board", () => {
  it("defaults to 4 + 1 per player and centers on the origin", () => {
    expect(defaultBoardSize(2)).toBe(6);
    expect(defaultBoardSize(3)).toBe(7);
    expect(defaultBoardSize(4)).toBe(8);
    // 6 wide → x from -2..3 (origin inside, near the middle)
    expect(boundsFor(6, 6)).toEqual({ xMin: -2, xMax: 3, yMin: -2, yMax: 3 });
    const s = freshC(V({ width: 6, height: 6 }));
    expect(freeCells(s)).toBe(36);
  });

  it("rejects placements that leave the board", () => {
    const s = freshC(V({ width: 6, height: 6 })); // x,y ∈ [-2,3]
    forcePlaceC(s, 0, 1, 0, 0, 0);
    // a tile whose second half would sit at x=4 is out of bounds
    expect(placementCheckC(s, { x: 3, y: 0 }, 3).ok).toBe(false);
    expect(placementCheckC(s, { x: 3, y: 0 }, 3).reason).toBe(
      "Outside the board",
    );
    s.passPending = false;
    s.players[s.turn.p].hand.push(2);
    expect(applyColor(s, { a: "place", tile: 2, at: { x: 3, y: 0 }, rot: 3 })).toBe(
      "Outside the board",
    );
  });

  it("treats walls as sealed: a corner group needs fewer tiles to close", () => {
    // 3x3 board → x,y ∈ [-1,1]. Put a red half in the corner (-1,-1).
    const s = freshC(V({ width: 3, height: 3 }));
    forcePlaceC(s, 0, 1, 0, 0, 2); // red@(0,0), cyan@(0,-1) covers origin
    // the cyan half at (0,-1) sits on the top wall: (0,-2) is off-board and
    // (0,0) is its own tile, so only two cells are actually still open
    expect(openPerimeter(s, ["0,-1"]).sort()).toEqual(["-1,-1", "1,-1"]);
    // fill both remaining neighbours of the cyan half → it seals
    forcePlaceC(s, 1, 4, -1, -1, 0); // red@(-1,-1), green@(-1,0)
    expect(groupOf(s, "0,-1").scored).toBe(false);
    forcePlaceC(s, 0, 22, 1, -1, 0); // green@(1,-1), gold@(1,0)
    expect(groupOf(s, "0,-1").scored).toBe(true); // sealed by 2 tiles + walls
  });

  it("ends the game when no legal placement is left", () => {
    const s = freshC(V({ width: 3, height: 3 }));
    forcePlaceC(s, 0, 1, 0, 0, 2); // (0,0) + (0,-1)
    forcePlaceC(s, 1, 4, -1, -1, 0); // (-1,-1) + (-1,0)
    forcePlaceC(s, 0, 22, 1, -1, 0); // (1,-1) + (1,0)
    expect(s.over).toBe(false);
    forcePlaceC(s, 1, 28, 0, 1, 3); // (0,1) + (1,1)
    // only (-1,1) is left — a domino can never fit in a single cell
    expect(hasLegalPlacement(s)).toBe(false);
    expect(s.over).toBe(true);
    expect(s.ranking).toBeDefined();
  });
});

describe("simulation", () => {
  it("runs headless games and reports per-colour telemetry", () => {
    const res = runSimulation({
      games: 40,
      players: 2,
      variant: V({ width: 6, height: 6, powers: true, specials: true }),
      seed: 99,
    });
    expect(res.games).toBe(40);
    expect(res.baselineWinRate).toBe(0.5);
    // win credit is split on ties, so seat win rates always total 1
    expect(res.winRateBySeat.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
    expect(res.avgPlacements).toBeGreaterThan(5);
    expect(res.avgScore).toBeGreaterThan(0);
    expect(res.byColor).toHaveLength(5);
    for (const c of res.byColor) {
      expect(c.avgPlacedPerPlayer).toBeGreaterThan(0);
      if (c.leaderWinRate !== null) {
        expect(c.leaderWinRate).toBeGreaterThanOrEqual(0);
        expect(c.leaderWinRate).toBeLessThanOrEqual(1);
      }
    }
    expect(
      res.byColor.reduce((a, c) => a + c.ptsShare, 0),
    ).toBeCloseTo(1, 6);
  });

  it("is deterministic for a given seed", () => {
    const opts = {
      games: 15,
      players: 3,
      variant: V({ width: 7, height: 7, powers: true }),
      seed: 7,
    };
    expect(runSimulation(opts).avgScore).toBe(runSimulation(opts).avgScore);
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
