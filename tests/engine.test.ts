import { describe, expect, it } from "vitest";
import { CONFIG } from "../src/data/config";
import {
  cellsFor,
  findEnclosed,
  matchesFor,
  placementCheck,
} from "../src/game/grid";
import {
  addToken,
  canRemoveToken,
  drawCards,
  scoreCard,
} from "../src/game/rules";
import { applyAction, newGame } from "../src/game/turn";
import type { GameState } from "../src/game/types";

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function fresh(n = 2, board?: { width: number; height: number }): GameState {
  const names = ["A", "B", "C", "D"].slice(0, n).map((name, i) => ({
    name,
    color: ["#0ff", "#f0f", "#ff0", "#f00"][i],
  }));
  const s = newGame(names, board);
  s.passPending = false;
  return s;
}

/** Force a placement by player p, bypassing hand/deal randomness. */
function forcePlace(
  s: GameState,
  p: number,
  id: number,
  x: number,
  y: number,
  rot = 0,
) {
  s.turn.p = p;
  s.turn.placed = false;
  s.passPending = false;
  s.deck = s.deck.filter((c) => c !== id);
  for (const q of s.players) q.hand = q.hand.filter((c) => c !== id);
  s.players[p].hand.push(id);
  const err = applyAction(s, { a: "place", card: id, at: { x, y }, rot });
  if (err) throw new Error(err);
}

/** Opening placement (covers origin). */
function forceSetup(s: GameState, id: number, rot = 0) {
  s.deck = s.deck.filter((c) => c !== id);
  for (const q of s.players) q.hand = q.hand.filter((c) => c !== id);
  s.players[0].hand.push(id);
  const err = applyAction(s, { a: "place", card: id, at: { x: 0, y: 0 }, rot });
  if (err) throw new Error(err);
  s.passPending = false;
}

// ---------------------------------------------------------------------------

describe("geometry", () => {
  it("computes cells for all 4 rotations", () => {
    expect(cellsFor({ x: 2, y: 3 }, 0)[1]).toEqual({ x: 2, y: 4 });
    expect(cellsFor({ x: 2, y: 3 }, 1)[1]).toEqual({ x: 1, y: 3 });
    expect(cellsFor({ x: 2, y: 3 }, 2)[1]).toEqual({ x: 2, y: 2 });
    expect(cellsFor({ x: 2, y: 3 }, 3)[1]).toEqual({ x: 3, y: 3 });
  });
});

describe("matches", () => {
  it("detects two matches for side-by-side same-symbol verticals", () => {
    const s = fresh();
    // 22 Earmark (favor/favor) at origin, vertical
    forceSetup(s, 22);
    // preview 24 Landslide (favor/favor) at (1,0) vertical: two touching edges
    const ms = matchesFor(s, 24, { x: 1, y: 0 }, 0);
    expect(ms.length).toBe(2);
    expect(ms.every((m) => m.sym === "favor")).toBe(true);
  });

  it("skips the internal edge and non-matching symbols", () => {
    const s = fresh();
    forceSetup(s, 1); // Silent Needle (muscle/whisper)
    const ms = matchesFor(s, 22, { x: 1, y: 0 }, 0); // favor/favor next to it
    expect(ms.length).toBe(0);
  });

  it("resolves both matches via the hub and pays the double-match bonus", () => {
    const s = fresh();
    forceSetup(s, 22);
    const before = s.players[1].money;
    forcePlace(s, 1, 24, 1, 0, 0); // two favor matches (both halves hit)
    // hub with 2 mandatory items -> pending; answer first, second auto-resolves
    expect(s.pending?.t).toBe("hub");
    applyAction(s, { a: "answer", ans: { i: 0 } });
    expect(s.pending).toBeNull();
    expect(s.exec.length).toBe(0);
    // Landslide (24): baseline 1 + 2 favor adds for player B
    expect(s.board[24].inf[1]).toBe(
      CONFIG.BASELINE_INFLUENCE + 2 * CONFIG.FAVOR_ADD,
    );
    // both halves matched → the $ bonus (favor matches themselves pay nothing)
    expect(s.players[1].money).toBe(before + CONFIG.DOUBLE_MATCH_BONUS);
    expect(s.telem.moneyBySource["Double match"]).toBe(
      CONFIG.DOUBLE_MATCH_BONUS,
    );
    expect(s.telem.matchesBySym.favor).toBe(2);
  });

  it("a single-edge credit match pays $ but NOT the double bonus", () => {
    const s = fresh();
    forceSetup(s, 28); // Incumbent (credit/credit): credit@(0,0), credit@(0,1)
    const before = s.players[1].money;
    // Margin Call (credit/credit) horizontal below: credit@(0,2) touches
    // credit@(0,1) — one match; the (1,2) half touches nothing
    forcePlace(s, 1, 31, 0, 2, 3);
    expect(s.pending).toBeNull(); // single mandatory match auto-resolved
    expect(s.players[1].money).toBe(before + CONFIG.CREDIT_GAIN);
    expect(s.telem.moneyBySource["Double match"]).toBeUndefined();
  });
});

describe("enclosure & scoring", () => {
  it("encloses a vertical domino once all 6 neighbors fill (no matches involved)", () => {
    const s = fresh();
    forceSetup(s, 1); // target: Silent Needle (muscle/whisper, 5 pts), P0 baseline 1
    forcePlace(s, 1, 28, -1, 0, 0); // left, credit/credit: no match
    forcePlace(s, 0, 22, 1, 0, 0); // right, favor/favor: no match
    forcePlace(s, 1, 41, 0, -1, 3); // top horizontal, intel/intel: no match
    expect(findEnclosed(s)).toEqual([]);
    forcePlace(s, 0, 30, 0, 2, 3); // bottom horizontal, intel/intel → encloses
    expect(s.pending).toBeNull();
    expect(s.board[1].scored).toBe(true);
    expect(s.players[0].pts).toBe(5); // sole influence, muscle+whisper = 5 VP
    expect(s.board[1].inf.every((v) => v === 0)).toBe(true);
    expect(s.telem.enclosures).toBe(1);
  });

  it("handles a placement that encloses two cards at once (order chosen)", () => {
    const s = fresh();
    forceSetup(s, 1); // A at (0,0)/(0,1) — muscle/whisper
    forcePlace(s, 1, 22, 1, 0, 0); // B at (1,0)/(1,1) — favor/favor, no match vs A
    forcePlace(s, 0, 28, -1, 0, 0); // left of A (credit/credit, no match)
    forcePlace(s, 1, 30, 0, -1, 3); // top of A+B (intel/intel horizontal, no match)
    forcePlace(s, 0, 41, 2, 0, 0); // right of B (intel/intel vs favor: no match)
    expect(findEnclosed(s)).toEqual([]);
    forcePlace(s, 1, 31, 0, 2, 3); // bottom horizontal credit/credit → encloses A & B
    expect(s.pending?.t).toBe("card");
    if (s.pending?.t === "card") expect(s.pending.ids.sort()).toEqual([1, 22]);
    applyAction(s, { a: "answer", ans: { card: 22 } }); // score B first, then A auto
    expect(s.board[22].scored).toBe(true);
    expect(s.board[1].scored).toBe(true);
    expect(s.players[1].pts).toBe(2); // Earmark (favor+favor = 2) to B's owner
    expect(s.players[0].pts).toBe(5); // Silent Needle (muscle+whisper = 5) to A's owner
    expect(s.telem.enclosures).toBe(2);
  });

  it("splits ties rounded down and returns tokens", () => {
    const s = fresh();
    forceSetup(s, 24); // Landslide (Senator, 2 pts) → floor(2/2) = 1 each
    const pl = s.board[24];
    pl.inf = [2, 2];
    const sup0 = s.players[0].supply;
    const sup1 = s.players[1].supply;
    scoreCard(s, 24);
    expect(s.players[0].pts).toBe(1);
    expect(s.players[1].pts).toBe(1);
    expect(s.players[0].supply).toBe(sup0 + 2);
    expect(s.players[1].supply).toBe(sup1 + 2);
  });

  it("Incumbent wins ties; Kingmaker only boosts solo wins", () => {
    const s = fresh();
    forceSetup(s, 24);
    s.board[24].inf = [2, 2];
    s.players[1].tableau = [28]; // Incumbent
    scoreCard(s, 24);
    expect(s.players[1].pts).toBe(2); // full 2 pts, tie won alone
    expect(s.players[0].pts).toBe(0);

    const s2 = fresh();
    forceSetup(s2, 24);
    s2.board[24].inf = [3, 1];
    s2.players[0].tableau = [30]; // Kingmaker
    scoreCard(s2, 24);
    expect(s2.players[0].pts).toBe(3); // 2 + 1 solo bonus
  });

  it("scores no one when enclosed empty", () => {
    const s = fresh();
    forceSetup(s, 24);
    s.board[24].inf = [0, 0];
    scoreCard(s, 24);
    expect(s.players[0].pts).toBe(0);
    expect(s.players[1].pts).toBe(0);
    expect(s.telem.scoredZero).toBe(1);
  });
});

describe("board limit", () => {
  it("rejects cards that would over-span the column/row limit", () => {
    const s = fresh(2, { width: 3, height: 2 });
    forceSetup(s, 1); // (0,0)+(0,1): 1 column, 2 rows — rows are now maxed
    // a vertical card below would make 3 rows
    expect(placementCheck(s, { x: 1, y: 1 }, 0).ok).toBe(false);
    expect(placementCheck(s, { x: 1, y: 1 }, 0).reason).toBe(
      "Would exceed the 3×2 limit",
    );
    expect(placementCheck(s, { x: 1, y: 0 }, 0).ok).toBe(true); // sideways ok
  });

  it("counts unplayable cells as sealed, so the limit encloses cards early", () => {
    const s = fresh(2, { width: 3, height: 2 });
    forceSetup(s, 1); // Silent Needle (muscle/whisper) at (0,0)+(0,1)
    // rows are capped at 2, so (0,-1) and (0,2) can never be played: each
    // card only needs its side neighbours to be enclosed
    forcePlace(s, 1, 28, -1, 0, 0); // credit/credit — no match
    expect(s.board[1].scored).toBe(false);
    forcePlace(s, 0, 22, 1, 0, 0); // favor/favor — no match
    // the 3×2 span is now full, which walls in all three cards at once
    while (s.pending?.t === "card")
      applyAction(s, { a: "answer", ans: { card: s.pending.ids[0] } });
    expect(s.board[1].scored).toBe(true);
    expect(s.board[22].scored).toBe(true);
    expect(s.board[28].scored).toBe(true);
    expect(s.players[0].pts).toBe(5 + 2); // Silent Needle 5 + Earmark 2
    expect(s.players[1].pts).toBe(2); // Incumbent (credit+credit)
  });

  it("ends the game once nothing can be placed", () => {
    const s = fresh(2, { width: 3, height: 2 });
    forceSetup(s, 1);
    forcePlace(s, 1, 28, -1, 0, 0);
    forcePlace(s, 0, 22, 1, 0, 0); // span is now the full 3×2
    while (s.pending?.t === "card")
      applyAction(s, { a: "answer", ans: { card: s.pending.ids[0] } });
    s.passPending = false;
    s.turn.placed = true;
    applyAction(s, { a: "endTurn" });
    expect(s.over).toBe(true);
  });
});

describe("influence rules", () => {
  it("fizzles adds when supply is empty and on scored cards", () => {
    const s = fresh();
    forceSetup(s, 22);
    s.players[0].supply = 0;
    expect(addToken(s, 22, 0, "test")).toBe(false);
    expect(s.telem.fizzledSupply).toBe(1);
    s.players[0].supply = 5;
    s.board[22].scored = true;
    expect(addToken(s, 22, 0, "test")).toBe(false);
    expect(s.telem.fizzledOther).toBe(1);
  });

  it("The Wall protects at 3+, Untouchable only vs opponent muscle matches", () => {
    const s = fresh();
    forceSetup(s, 22);
    s.board[22].inf = [3, 1];
    s.players[0].tableau = [20]; // The Wall
    expect(canRemoveToken(s, 22, 0, 1, "effect")).toBe(false);
    s.board[22].inf = [2, 1];
    expect(canRemoveToken(s, 22, 0, 1, "effect")).toBe(true);

    s.players[0].tableau = [9]; // Untouchable
    expect(canRemoveToken(s, 22, 0, 1, "muscleMatch")).toBe(false);
    expect(canRemoveToken(s, 22, 0, 1, "effect")).toBe(true);
    expect(canRemoveToken(s, 22, 0, 0, "muscleMatch")).toBe(true); // own match ok
  });

  it("Filibuster lock blocks changes and expires on the locker's next turn", () => {
    const s = fresh();
    forceSetup(s, 22);
    s.board[22].lockBy = 1;
    expect(addToken(s, 22, 0, "test")).toBe(false);
    expect(canRemoveToken(s, 22, 0, 0, "effect")).toBe(false);
    // start of player 1's turn clears their lock
    s.turn.p = 1;
    s.turn.setup = false;
    s.passPending = true;
    applyAction(s, { a: "beginTurn" });
    expect(s.board[22].lockBy).toBeUndefined();
  });

  it("caps hand at the limit when drawing", () => {
    const s = fresh();
    s.players[0].hand = [1, 2, 3, 4, 5];
    drawCards(s, 0, 10, "test");
    expect(s.players[0].hand.length).toBe(CONFIG.HAND_LIMIT);
  });
});

describe("deploy", () => {
  it("pays cost, resolves instants, honors Venture Angel discount & Confidant", () => {
    const s = fresh();
    forceSetup(s, 1);
    s.turn.p = 1;
    s.turn.setup = false;
    s.turn.deployed = false;
    s.players[1].hand = [22]; // Earmark: cost 1, gain $2
    s.players[1].money = 2;
    s.players[1].tableau = [36]; // Venture Angel: -$1 deploys
    s.players[0].tableau = [59]; // Confidant: +$1 on opponent deploy
    const m0 = s.players[0].money;
    const err = applyAction(s, { a: "deploy", card: 22 });
    expect(err).toBeNull();
    expect(s.players[1].money).toBe(2 - 0 + 2); // free (discount), +2 effect
    expect(s.players[0].money).toBe(m0 + 1); // Confidant
    expect(s.discard).toContain(22);
    expect(s.telem.deploys).toBe(1);
  });

  it("Zero Day triggers both symbols of the chosen card (no double bonus)", () => {
    const s = fresh();
    forceSetup(s, 22); // Earmark — favor/favor
    s.turn.p = 0;
    s.turn.setup = false;
    s.turn.deployed = false;
    s.players[0].hand = [46];
    s.players[0].money = 5;
    applyAction(s, { a: "deploy", card: 46 }); // Zero Day costs 3 → $2 left
    expect(s.pending?.t).toBe("card");
    applyAction(s, { a: "answer", ans: { card: 22 } });
    expect(s.pending?.t).toBe("hub"); // two favor pseudo-matches
    applyAction(s, { a: "answer", ans: { i: 0 } });
    expect(s.pending).toBeNull();
    expect(s.board[22].inf[0]).toBe(1 + 2 * CONFIG.FAVOR_ADD); // baseline + both adds
    // the $ double-match bonus is placement-only — no money from Zero Day here
    expect(s.players[0].money).toBe(5 - 3);
    expect(s.telem.matchesBySym.favor).toBe(2);
    expect(s.telem.moneyBySource["Double match"]).toBeUndefined();
  });
});

describe("game end", () => {
  it("counts down 2 final turns per player after the deck empties, ranks by pts/money", () => {
    const s = fresh();
    forceSetup(s, 22);
    s.turn = { n: 5, p: 0, deployed: false, placed: true, setup: false };
    s.deck = [31]; // one card left
    s.players[0].hand = [];
    s.players[1].hand = [1, 2, 3, 4];
    applyAction(s, { a: "endTurn" }); // draws last card → finalPhase set
    expect(s.finalPhase?.remaining).toBe(2 * s.players.length);
    s.players[0].pts = 4;
    s.players[1].pts = 4;
    s.players[0].money = 1;
    s.players[1].money = 7;
    for (let i = 0; i < 4; i++) {
      expect(s.over).toBe(false);
      s.passPending = false;
      s.turn.placed = true; // pretend the mandatory placement happened
      applyAction(s, { a: "endTurn" });
    }
    expect(s.over).toBe(true);
    expect(s.ranking?.[0]).toBe(1); // money tiebreak
  });
});

describe("undo model", () => {
  it("clone-apply leaves the original untouched and is deterministic", () => {
    const s = fresh();
    forceSetup(s, 22);
    const snapshot = structuredClone(s);
    const a = structuredClone(s);
    const b = structuredClone(s);
    for (const st of [a, b]) {
      st.turn.p = 1;
      st.deck = st.deck.filter((c) => c !== 24);
      for (const q of st.players) q.hand = q.hand.filter((c) => c !== 24);
      st.players[1].hand.push(24);
      applyAction(st, { a: "place", card: 24, at: { x: 1, y: 0 }, rot: 0 });
      applyAction(st, { a: "answer", ans: { i: 0 } });
    }
    expect(s).toEqual(snapshot); // original untouched (undo = drop clone)
    expect(a).toEqual(b); // same actions → same state
    expect(a.board[24].inf[1]).toBe(
      CONFIG.BASELINE_INFLUENCE + 2 * CONFIG.FAVOR_ADD,
    );
  });
});
