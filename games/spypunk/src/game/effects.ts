// =============================================================================
// Instant effect frames (e_*) and Ongoing trigger frames (t_*).
// Frame names map from cards.json specs: spec.i = "removeOne" → handler
// "e_removeOne"; ongoing spec.do = "peekTop" → handler "t_peekTop".
// Custom, card-shaped ops (poisonKiss, zeroDay, …) live here too, keyed by
// their spec op name (one per card).
//
// ---------------------------------------------------------------------------
// HOW TO ADD A NEW CARD EFFECT (the whole recipe)
// ---------------------------------------------------------------------------
// 1. cards.json — give the card a machine-readable spec:
//      Instant:            "spec": { "i": "bribe", "perToken": 1 }
//      Ongoing modifier:   "spec": { "o": "modifier", "key": "myKey", "value": 2 }
//      Ongoing listener:   "spec": { "o": "listen", "ev": "someEvent", "money": 1 }
//      Ongoing trigger:    "spec": { "o": "startOfTurn"|"onPlace", "do": "bribe", ... }
//    Prefer REUSING an existing parameterized op (removeOne, removeSpread,
//    addInf, addPair, move, money, draw, taxAll, …) — then you're done.
//
// 2. New instant op → register("e_bribe", (s, f) => { ... }) below.
//    Frame handler contract (full details in runtime.ts):
//      • f.d  = the card's spec plus { card, by } (deployer's player index)
//      • f.ph = your own phase counter, starts at 0; handlers are re-entered
//        after every pause/child, so branch on f.ph
//      • ask the player something: set s.pending = {...} (see Pending in
//        types.ts), bump f.ph, return; next call reads takeAns(f)
//      • need a standard "pick a card & remove/move one token" step? push the
//        shared child frame (pickRemove / pickMove) and read s.ret after it
//        pops — that inherits every protection/legality rule for free
//      • mutate ONLY via rules.ts helpers (addToken/removeToken/moveToken/
//        gainMoney/payMoney/drawCards) — they enforce supply, locks,
//        protections, telemetry and logging
//      • when finished: popFrame(s). Forgetting this trips the pump guard.
//      • no legal target? fizzle(s, p, msg) + popFrame — never dead-end.
//
// 3. New ongoing MODIFIER (passively changes a rule): no frame at all. Add a
//    query in ongoing.ts (modValue/hasMod wrapper) and call it at the rule
//    point it bends — grep creditValue for the pattern end-to-end.
//    New LISTENER event: fire listeners(s, "yourEvent") where it happens.
//    New TRIGGER op: register("t_yourOp", ...) here; startOfTurn triggers are
//    collected in turn.ts/actBeginTurn, onPlace triggers in actPlace.
//
// 4. Test it in tests/engine.test.ts with the forceSetup/forcePlace helpers;
//    the random simulation (simulation.test.ts) will also exercise it.
// =============================================================================

import { def } from "./cards";
import { adjacentCards, areAdjacent } from "./grid";
import {
  addToken,
  canMoveTokenOff,
  canRemoveToken,
  cardAccepts,
  cname,
  drawCards,
  gainMoney,
  log,
  movableOwners,
  payMoney,
  pname,
  removableOwners,
  removeToken,
  totalInf,
} from "./rules";
import {
  matchItem,
  popFrame,
  pushFrame,
  register,
  takeAns,
} from "./runtime";
import type { GameState } from "./types";
import { cellKey } from "./types";

const boardIds = (s: GameState) => Object.keys(s.board).map(Number);
const unscoredIds = (s: GameState) =>
  boardIds(s).filter((id) => !s.board[id].scored);

function fizzle(s: GameState, p: number, msg: string) {
  s.telem.fizzledOther++;
  log(s, p, `${msg} — fizzles`);
}

// ---------------------------------------------------------------------------
// Simple money / draw
// ---------------------------------------------------------------------------

register("e_money", (s, f) => {
  gainMoney(s, f.d.by, f.d.amount, cname(f.d.card));
  popFrame(s);
});

register("e_draw", (s, f) => {
  drawCards(s, f.d.by, f.d.count, cname(f.d.card));
  popFrame(s);
});

// Arbitrage: $1 per <type> on the grid (scored cards still count — on grid)
register("e_moneyPerType", (s, f) => {
  const n = boardIds(s).filter((id) => def(id).type === f.d.type).length;
  gainMoney(s, f.d.by, Math.min(f.d.cap, n * f.d.amount), cname(f.d.card));
  popFrame(s);
});

// Escrow Raid: each opponent pays $1 (if able)
register("e_taxAll", (s, f) => {
  for (let q = 0; q < s.players.length; q++)
    if (q !== f.d.by) payMoney(s, q, f.d.by, f.d.amount, cname(f.d.card));
  popFrame(s);
});

// ---------------------------------------------------------------------------
// Removal instants
// ---------------------------------------------------------------------------

// Silent Needle / Kneecapper: remove `count` influence from ONE card
register("e_removeOne", (s, f) => {
  const d = f.d;
  if (f.ph === 0) {
    d.i = 0;
    f.ph = 1;
    return;
  }
  if (f.ph === 1) {
    if (d.i >= d.count) {
      popFrame(s);
      return;
    }
    d.i++;
    f.ph = 2;
    pushFrame(s, "pickRemove", {
      by: d.by,
      cards: d.chosen !== undefined ? [d.chosen] : unscoredIds(s),
      cause: "effect",
      prompt: `${cname(d.card)}: remove influence (${d.i}/${d.count})`,
      why: cname(d.card),
    });
    return;
  }
  const r = s.ret;
  s.ret = undefined;
  if (r === null) {
    if (d.i === 1) fizzle(s, d.by, `${cname(d.card)}: nothing to remove`);
    popFrame(s);
    return;
  }
  d.chosen = r.card;
  f.ph = 1;
});

// Rooftop Ghost: remove 1 from each of `cards` DIFFERENT cards
register("e_removeSpread", (s, f) => {
  const d = f.d;
  if (f.ph === 0) {
    d.hit = [];
    f.ph = 1;
    return;
  }
  if (f.ph === 1) {
    if (d.hit.length >= d.cards) {
      popFrame(s);
      return;
    }
    f.ph = 2;
    pushFrame(s, "pickRemove", {
      by: d.by,
      cards: unscoredIds(s).filter((id) => !d.hit.includes(id)),
      cause: "effect",
      prompt: `${cname(d.card)}: remove from card ${d.hit.length + 1}/${d.cards}`,
      why: cname(d.card),
    });
    return;
  }
  const r = s.ret;
  s.ret = undefined;
  if (r === null) {
    if (d.hit.length === 0)
      fizzle(s, d.by, `${cname(d.card)}: nothing to remove`);
    popFrame(s);
    return;
  }
  d.hit.push(r.card);
  f.ph = 1;
});

// Poison Kiss: remove 1 from a card, then add 1 of yours to that card
register("e_poisonKiss", (s, f) => {
  const d = f.d;
  if (f.ph === 0) {
    f.ph = 1;
    pushFrame(s, "pickRemove", {
      by: d.by,
      cards: unscoredIds(s),
      cause: "effect",
      prompt: `${cname(d.card)}: remove 1 influence`,
      why: cname(d.card),
    });
    return;
  }
  const r = s.ret;
  s.ret = undefined;
  if (r === null) fizzle(s, d.by, `${cname(d.card)}: nothing to remove`);
  else addToken(s, r.card, d.by, cname(d.card));
  popFrame(s);
});

// The Cleaner: remove up to `max` influence belonging to ONE player, one card
register("e_removeOneOwner", (s, f) => {
  const d = f.d;
  if (f.ph === 0) {
    const targets = unscoredIds(s).filter(
      (id) => removableOwners(s, id, d.by, "effect").length > 0,
    );
    if (targets.length === 0) {
      fizzle(s, d.by, `${cname(d.card)}: nothing to remove`);
      popFrame(s);
      return;
    }
    f.ph = 1;
    s.pending = {
      t: "card",
      prompt: `${cname(d.card)}: choose a card`,
      ids: targets,
    };
    return;
  }
  if (f.ph === 1) {
    d.target = takeAns(f).card;
    const owners = removableOwners(s, d.target, d.by, "effect");
    if (owners.length === 1) {
      d.owner = owners[0];
      f.ph = 3;
      return;
    }
    f.ph = 2;
    s.pending = {
      t: "owner",
      prompt: "Remove whose influence?",
      card: d.target,
      owners: owners.map((p) => ({ p, n: s.board[d.target].inf[p] })),
    };
    return;
  }
  if (f.ph === 2) {
    d.owner = takeAns(f).p;
    f.ph = 3;
    return;
  }
  if (f.ph === 3) {
    const maxN = Math.min(d.max, s.board[d.target].inf[d.owner]);
    if (maxN <= 1) {
      d.n = maxN;
      f.ph = 5;
      return;
    }
    f.ph = 4;
    s.pending = {
      t: "opt",
      prompt: `Remove how many of ${pname(s, d.owner)}'s influence?`,
      options: Array.from({ length: maxN }, (_, i) => ({
        k: String(i + 1),
        label: `Remove ${i + 1}`,
      })),
    };
    return;
  }
  if (f.ph === 4) {
    d.n = parseInt(takeAns(f).k, 10);
    f.ph = 5;
    return;
  }
  for (let i = 0; i < d.n; i++) {
    if (!canRemoveToken(s, d.target, d.owner, d.by, "effect")) break;
    removeToken(s, d.target, d.owner, d.by, "effect", cname(d.card));
  }
  popFrame(s);
});

// Double Tap: remove 1; if the card is now empty, gain $
register("e_removeBounty", (s, f) => {
  const d = f.d;
  if (f.ph === 0) {
    f.ph = 1;
    pushFrame(s, "pickRemove", {
      by: d.by,
      cards: unscoredIds(s),
      cause: "effect",
      prompt: `${cname(d.card)}: remove 1 influence`,
      why: cname(d.card),
    });
    return;
  }
  const r = s.ret;
  s.ret = undefined;
  if (r === null) fizzle(s, d.by, `${cname(d.card)}: nothing to remove`);
  else if (totalInf(s.board[r.card]) === 0)
    gainMoney(s, d.by, d.moneyIfEmpty, cname(d.card));
  popFrame(s);
});

// Debt Collector: remove 1; that token's owner pays you $ (if able)
register("e_removeTax", (s, f) => {
  const d = f.d;
  if (f.ph === 0) {
    f.ph = 1;
    pushFrame(s, "pickRemove", {
      by: d.by,
      cards: unscoredIds(s),
      cause: "effect",
      prompt: `${cname(d.card)}: remove 1 influence`,
      why: cname(d.card),
    });
    return;
  }
  const r = s.ret;
  s.ret = undefined;
  if (r === null) fizzle(s, d.by, `${cname(d.card)}: nothing to remove`);
  else if (r.owner !== d.by) payMoney(s, r.owner, d.by, d.tax, cname(d.card));
  popFrame(s);
});

// Street Sweep: choose a row or column; remove 1 from up to `maxCards` in it
register("e_streetSweep", (s, f) => {
  const d = f.d;
  if (f.ph === 0) {
    const rows = new Map<number, Set<number>>();
    const cols = new Map<number, Set<number>>();
    for (const id of unscoredIds(s)) {
      if (removableOwners(s, id, d.by, "effect").length === 0) continue;
      const p = s.board[id];
      for (const c of [p.a, p.b]) {
        if (!rows.has(c.y)) rows.set(c.y, new Set());
        rows.get(c.y)!.add(id);
        if (!cols.has(c.x)) cols.set(c.x, new Set());
        cols.get(c.x)!.add(id);
      }
    }
    const lines: { key: string; label: string; cells: string[] }[] = [];
    for (const [y, ids] of [...rows.entries()].sort((a, b) => a[0] - b[0]))
      lines.push({
        key: `r${y}`,
        label: `Row y=${y} (${ids.size} card${ids.size > 1 ? "s" : ""})`,
        cells: [...ids].flatMap((id) =>
          [s.board[id].a, s.board[id].b]
            .filter((c) => c.y === y)
            .map((c) => cellKey(c)),
        ),
      });
    for (const [x, ids] of [...cols.entries()].sort((a, b) => a[0] - b[0]))
      lines.push({
        key: `c${x}`,
        label: `Column x=${x} (${ids.size} card${ids.size > 1 ? "s" : ""})`,
        cells: [...ids].flatMap((id) =>
          [s.board[id].a, s.board[id].b]
            .filter((c) => c.x === x)
            .map((c) => cellKey(c)),
        ),
      });
    if (lines.length === 0) {
      fizzle(s, d.by, `${cname(d.card)}: nothing to remove`);
      popFrame(s);
      return;
    }
    f.ph = 1;
    s.pending = {
      t: "line",
      prompt: `${cname(d.card)}: choose a row or column`,
      lines,
    };
    return;
  }
  if (f.ph === 1) {
    d.line = takeAns(f).key;
    d.hit = [];
    f.ph = 2;
    return;
  }
  if (f.ph === 2) {
    if (d.hit.length >= d.maxCards) {
      popFrame(s);
      return;
    }
    const isRow = d.line[0] === "r";
    const v = parseInt(d.line.slice(1), 10);
    const inLine = unscoredIds(s).filter((id) => {
      const p = s.board[id];
      return [p.a, p.b].some((c) => (isRow ? c.y === v : c.x === v));
    });
    f.ph = 3;
    pushFrame(s, "pickRemove", {
      by: d.by,
      cards: inLine.filter((id) => !d.hit.includes(id)),
      cause: "effect",
      prompt: `${cname(d.card)}: remove from a card in the line (${d.hit.length + 1}/${d.maxCards})`,
      why: cname(d.card),
      skippable: "Stop",
    });
    return;
  }
  const r = s.ret;
  s.ret = undefined;
  if (r === null) {
    popFrame(s);
    return;
  }
  d.hit.push(r.card);
  f.ph = 2;
});

// Leg Breaker: remove 1 from a card adjacent to your most recent placement
register("e_removeAdjLast", (s, f) => {
  const d = f.d;
  if (f.ph === 0) {
    const last = s.players[d.by].lastPlaced;
    if (last === undefined || !s.board[last]) {
      fizzle(s, d.by, `${cname(d.card)}: you have not placed a card yet`);
      popFrame(s);
      return;
    }
    f.ph = 1;
    pushFrame(s, "pickRemove", {
      by: d.by,
      cards: adjacentCards(s, last).filter((id) => !s.board[id].scored),
      cause: "effect",
      prompt: `${cname(d.card)}: remove 1 influence adjacent to ${cname(last)}`,
      why: cname(d.card),
    });
    return;
  }
  const r = s.ret;
  s.ret = undefined;
  if (r === null) fizzle(s, d.by, `${cname(d.card)}: nothing to remove`);
  popFrame(s);
});

// Scandal: choose a card; every player with influence on it removes 1 of
// their own (each player's own protections apply).
register("e_scandal", (s, f) => {
  const d = f.d;
  if (f.ph === 0) {
    const targets = unscoredIds(s).filter(
      (id) => cardAccepts(s, id) && totalInf(s.board[id]) > 0,
    );
    if (targets.length === 0) {
      fizzle(s, d.by, `${cname(d.card)}: no card holds influence`);
      popFrame(s);
      return;
    }
    f.ph = 1;
    s.pending = {
      t: "card",
      prompt: `${cname(d.card)}: choose a card`,
      ids: targets,
    };
    return;
  }
  const id = takeAns(f).card;
  for (let q = 0; q < s.players.length; q++) {
    if (s.board[id].inf[q] <= 0) continue;
    if (canRemoveToken(s, id, q, q, "effect"))
      removeToken(s, id, q, q, "effect", cname(d.card));
    else log(s, q, `influence on ${cname(id)} is protected (${cname(d.card)})`);
  }
  popFrame(s);
});

// ---------------------------------------------------------------------------
// Influence-adding instants
// ---------------------------------------------------------------------------

function addTargets(s: GameState, d: any): number[] {
  return unscoredIds(s).filter((id) => {
    if (!cardAccepts(s, id)) return false;
    if (d.filter === "own") return s.board[id].inf[d.by] > 0;
    if (typeof d.filter === "string" && d.filter.startsWith("adjType:")) {
      const type = d.filter.split(":")[1];
      return adjacentCards(s, id).some((n) => def(n).type === type);
    }
    return true;
  });
}

// Show of Force / Landslide / Backdoor / Botnet / Wingman
register("e_addInf", (s, f) => {
  const d = f.d;
  if (f.ph === 0) {
    d.done = 0;
    d.hit = [];
    f.ph = 1;
    return;
  }
  if (f.ph === 1) {
    if (d.done >= d.cards) {
      popFrame(s);
      return;
    }
    const targets = addTargets(s, d).filter((id) => !d.hit.includes(id));
    if (targets.length === 0 || s.players[d.by].supply === 0) {
      if (d.done === 0)
        fizzle(s, d.by, `${cname(d.card)}: no legal target / no supply`);
      popFrame(s);
      return;
    }
    f.ph = 2;
    s.pending = {
      t: "card",
      prompt: `${cname(d.card)}: add ${d.perCard} influence to which card?`,
      ids: targets,
      skip: d.upTo ? (d.done > 0 ? "Done" : "Skip") : undefined,
    };
    return;
  }
  const ans = takeAns(f);
  if (!ans || ans.skip) {
    popFrame(s);
    return;
  }
  d.hit.push(ans.card);
  for (let i = 0; i < d.perCard; i++) addToken(s, ans.card, d.by, cname(d.card));
  d.done++;
  f.ph = 1;
});

// Whip Count: add 1 of yours to each of two adjacent cards
register("e_addPair", (s, f) => {
  const d = f.d;
  if (f.ph === 0) {
    const firsts = unscoredIds(s).filter(
      (id) =>
        cardAccepts(s, id) &&
        adjacentCards(s, id).some((n) => cardAccepts(s, n)),
    );
    if (firsts.length === 0 || s.players[d.by].supply === 0) {
      fizzle(s, d.by, `${cname(d.card)}: no adjacent pair available`);
      popFrame(s);
      return;
    }
    f.ph = 1;
    s.pending = {
      t: "card",
      prompt: `${cname(d.card)}: first card (its neighbor gets one too)`,
      ids: firsts,
    };
    return;
  }
  if (f.ph === 1) {
    d.first = takeAns(f).card;
    for (let i = 0; i < d.perCard; i++)
      addToken(s, d.first, d.by, cname(d.card));
    const seconds = adjacentCards(s, d.first).filter((n) => cardAccepts(s, n));
    if (seconds.length === 0) {
      fizzle(s, d.by, `${cname(d.card)}: no adjacent second card`);
      popFrame(s);
      return;
    }
    f.ph = 2;
    s.pending = {
      t: "card",
      prompt: `${cname(d.card)}: second card (adjacent to ${cname(d.first)})`,
      ids: seconds,
    };
    return;
  }
  const second = takeAns(f).card;
  for (let i = 0; i < f.d.perCard; i++)
    addToken(s, second, f.d.by, cname(f.d.card));
  popFrame(s);
});

// Pork Barrel: add 1 to a card and gain $1
register("e_addMoney", (s, f) => {
  const d = f.d;
  if (f.ph === 0) {
    const targets = unscoredIds(s).filter((id) => cardAccepts(s, id));
    if (targets.length === 0) {
      fizzle(s, d.by, `${cname(d.card)}: no card to influence`);
      gainMoney(s, d.by, d.money, cname(d.card));
      popFrame(s);
      return;
    }
    f.ph = 1;
    s.pending = {
      t: "card",
      prompt: `${cname(d.card)}: add ${d.add} influence to which card?`,
      ids: targets,
    };
    return;
  }
  const id = takeAns(f).card;
  for (let i = 0; i < d.add; i++) addToken(s, id, d.by, cname(d.card));
  gainMoney(s, d.by, d.money, cname(d.card));
  popFrame(s);
});

// ---------------------------------------------------------------------------
// Movement instants (Spoof / Gala Invitation / Hostile Takeover)
// ---------------------------------------------------------------------------

register("e_move", (s, f) => {
  const d = f.d;
  if (f.ph === 0) {
    d.moved = 0;
    f.ph = 1;
    return;
  }
  if (f.ph === 1) {
    if (d.moved >= d.count) {
      popFrame(s);
      return;
    }
    f.ph = 2;
    const locked = d.samePair && d.moved > 0;
    pushFrame(s, "pickMove", {
      by: d.by,
      cause: "effect",
      ownOnly: d.own ? d.by : undefined,
      srcs: locked ? [d.srcCard] : "all",
      dstMap: locked ? { [d.srcCard]: [d.dstCard] } : undefined,
      prompt: `${cname(d.card)}: move influence (${d.moved + 1}/${d.count})`,
      skippable: d.upTo ? (d.moved > 0 ? "Done" : "Skip") : undefined,
      why: cname(d.card),
    });
    return;
  }
  const r = s.ret;
  s.ret = undefined;
  if (r === null) {
    if (d.moved === 0 && !d.upTo)
      fizzle(s, d.by, `${cname(d.card)}: no legal move`);
    popFrame(s);
    return;
  }
  d.srcCard = r.from;
  d.dstCard = r.to;
  d.moved++;
  f.ph = 1;
});

// Masquerade: swap 1 influence on a card with 1 on an adjacent card
register("e_masquerade", (s, f) => {
  const d = f.d;
  const swappable = (id: number) =>
    cardAccepts(s, id) && movableOwners(s, id, d.by, "effect").length > 0;
  if (f.ph === 0) {
    const firsts = unscoredIds(s).filter(
      (id) => swappable(id) && adjacentCards(s, id).some((n) => swappable(n)),
    );
    if (firsts.length === 0) {
      fizzle(s, d.by, `${cname(d.card)}: no adjacent pair with influence`);
      popFrame(s);
      return;
    }
    f.ph = 1;
    s.pending = {
      t: "card",
      prompt: `${cname(d.card)}: first card of the swap`,
      ids: firsts,
    };
    return;
  }
  if (f.ph === 1) {
    d.a = takeAns(f).card;
    const seconds = adjacentCards(s, d.a).filter((n) => swappable(n));
    f.ph = 2;
    s.pending = {
      t: "card",
      prompt: `${cname(d.card)}: card to swap with`,
      ids: seconds,
    };
    return;
  }
  if (f.ph === 2) {
    d.b = takeAns(f).card;
    const owners = movableOwners(s, d.a, d.by, "effect");
    if (owners.length === 1) {
      d.ownerA = owners[0];
      f.ph = 4;
      return;
    }
    f.ph = 3;
    s.pending = {
      t: "owner",
      prompt: `Swap whose influence on ${cname(d.a)}?`,
      card: d.a,
      owners: owners.map((p) => ({ p, n: s.board[d.a].inf[p] })),
    };
    return;
  }
  if (f.ph === 3) {
    d.ownerA = takeAns(f).p;
    f.ph = 4;
    return;
  }
  if (f.ph === 4) {
    const owners = movableOwners(s, d.b, d.by, "effect");
    if (owners.length === 1) {
      d.ownerB = owners[0];
      f.ph = 6;
      return;
    }
    f.ph = 5;
    s.pending = {
      t: "owner",
      prompt: `Swap whose influence on ${cname(d.b)}?`,
      card: d.b,
      owners: owners.map((p) => ({ p, n: s.board[d.b].inf[p] })),
    };
    return;
  }
  if (f.ph === 5) {
    d.ownerB = takeAns(f).p;
    f.ph = 6;
    return;
  }
  // atomic swap — legality was checked at selection time
  s.board[d.a].inf[d.ownerA]--;
  s.board[d.b].inf[d.ownerA]++;
  s.board[d.b].inf[d.ownerB]--;
  s.board[d.a].inf[d.ownerB]++;
  s.telem.infMoved += 2;
  log(
    s,
    d.by,
    `swaps 1 of ${pname(s, d.ownerA)}'s influence on ${cname(d.a)} with 1 of ${pname(s, d.ownerB)}'s on ${cname(d.b)} (${cname(d.card)})`,
  );
  popFrame(s);
});

// ---------------------------------------------------------------------------
// Oddballs
// ---------------------------------------------------------------------------

// Filibuster: lock a card until your next turn
register("e_lock", (s, f) => {
  const d = f.d;
  if (f.ph === 0) {
    const targets = unscoredIds(s);
    if (targets.length === 0) {
      fizzle(s, d.by, `${cname(d.card)}: no card to lock`);
      popFrame(s);
      return;
    }
    f.ph = 1;
    s.pending = {
      t: "card",
      prompt: `${cname(d.card)}: choose a card to lock until your next turn`,
      ids: targets,
    };
    return;
  }
  const id = takeAns(f).card;
  s.board[id].lockBy = d.by;
  log(
    s,
    d.by,
    `locks ${cname(id)} — no influence changes until their next turn (${cname(d.card)})`,
  );
  popFrame(s);
});

// Ransomware: chosen opponent pays $2 OR you remove 2 of their influence
register("e_ransomware", (s, f) => {
  const d = f.d;
  const canPay = (q: number) => s.players[q].money >= d.pay;
  const removeCards = (q: number) =>
    unscoredIds(s).filter((id) => canRemoveToken(s, id, q, d.by, "effect"));
  if (f.ph === 0) {
    const opts: number[] = [];
    for (let q = 0; q < s.players.length; q++)
      if (q !== d.by && (canPay(q) || removeCards(q).length > 0)) opts.push(q);
    if (opts.length === 0) {
      fizzle(s, d.by, `${cname(d.card)}: no opponent can pay or lose influence`);
      popFrame(s);
      return;
    }
    f.ph = 1;
    s.pending = {
      t: "player",
      prompt: `${cname(d.card)}: choose an opponent`,
      players: opts,
    };
    return;
  }
  if (f.ph === 1) {
    d.q = takeAns(f).p;
    const options = [];
    if (canPay(d.q)) options.push({ k: "pay", label: `Pay $${d.pay}` });
    if (removeCards(d.q).length > 0)
      options.push({
        k: "remove",
        label: `Let them remove ${d.remove} of your influence`,
      });
    if (options.length === 1) {
      d.choice = options[0].k;
      f.ph = 3;
      return;
    }
    f.ph = 2;
    s.pending = {
      t: "opt",
      prompt: `${cname(d.card)}: ${pname(s, d.q)}, choose:`,
      options,
      who: d.q, // the TARGET opponent decides
    };
    return;
  }
  if (f.ph === 2) {
    d.choice = takeAns(f).k;
    f.ph = 3;
    return;
  }
  if (f.ph === 3) {
    if (d.choice === "pay") {
      payMoney(s, d.q, d.by, d.pay, cname(d.card));
      popFrame(s);
      return;
    }
    f.ph = 4;
    s.pending = {
      t: "card",
      prompt: `${cname(d.card)}: remove ${pname(s, d.q)}'s influence from which card?`,
      ids: removeCards(d.q),
    };
    return;
  }
  const id = takeAns(f).card;
  for (let i = 0; i < d.remove; i++) {
    if (!canRemoveToken(s, id, d.q, d.by, "effect")) break;
    removeToken(s, id, d.q, d.by, "effect", cname(d.card));
  }
  popFrame(s);
});

// Charm Offensive: replace 1 opponent influence with 1 of yours
register("e_charm", (s, f) => {
  const d = f.d;
  if (f.ph === 0) {
    f.ph = 1;
    pushFrame(s, "pickRemove", {
      by: d.by,
      cards: unscoredIds(s),
      cause: "effect",
      opponentsOnly: true,
      prompt: `${cname(d.card)}: replace which opponent influence?`,
      why: cname(d.card),
    });
    return;
  }
  const r = s.ret;
  s.ret = undefined;
  if (r === null) fizzle(s, d.by, `${cname(d.card)}: nothing to replace`);
  else addToken(s, r.card, d.by, cname(d.card));
  popFrame(s);
});

// Zero Day: trigger both edge symbols of a chosen card as if just matched
register("e_zeroDay", (s, f) => {
  const d = f.d;
  if (f.ph === 0) {
    const targets = boardIds(s); // scored cards' symbols still count
    if (targets.length === 0) {
      fizzle(s, d.by, `${cname(d.card)}: no card on the grid`);
      popFrame(s);
      return;
    }
    f.ph = 1;
    s.pending = {
      t: "card",
      prompt: `${cname(d.card)}: trigger both symbols of which card?`,
      ids: targets,
    };
    return;
  }
  const id = takeAns(f).card;
  const cd = def(id);
  log(s, d.by, `${cname(d.card)} triggers ${cd.top}+${cd.bottom} on ${cname(id)}`);
  popFrame(s);
  pushFrame(s, "hub", {
    title: `Zero Day — ${cname(id)}`,
    items: [matchItem(cd.top, id, id), matchItem(cd.bottom, id, id)],
    ctx: { why: "Zero Day" },
  });
});

// ---------------------------------------------------------------------------
// Ongoing trigger frames (start-of-turn + on-place)
// ---------------------------------------------------------------------------

register("t_money", (s, f) => {
  gainMoney(s, f.d.owner, f.d.amount, cname(f.d.card));
  popFrame(s);
});

// Protection Racket: $ if you are the only player with influence on 2+ cards
register("t_moneyIfSole", (s, f) => {
  const d = f.d;
  let n = 0;
  for (const id of unscoredIds(s)) {
    const inf = s.board[id].inf;
    if (
      inf[d.owner] > 0 &&
      inf.every((v, q) => (q === d.owner ? true : v === 0))
    )
      n++;
  }
  if (n >= d.minCards) gainMoney(s, d.owner, d.amount, cname(d.card));
  else log(s, d.owner, `${cname(d.card)}: only sole influencer on ${n} card(s) — no gain`);
  popFrame(s);
});

// Center of Attention: $ if you have influence on `minCards`+ cards
register("t_moneyIfSpread", (s, f) => {
  const d = f.d;
  const n = unscoredIds(s).filter((id) => s.board[id].inf[d.owner] > 0).length;
  if (n >= d.minCards) gainMoney(s, d.owner, d.amount, cname(d.card));
  else log(s, d.owner, `${cname(d.card)}: influence on ${n} card(s) — no gain`);
  popFrame(s);
});

// Night Contract: may remove 1 from a card holding `min`+ influence
register("t_removeFromBig", (s, f) => {
  const d = f.d;
  if (f.ph === 0) {
    f.ph = 1;
    pushFrame(s, "pickRemove", {
      by: d.owner,
      cards: unscoredIds(s).filter((id) => totalInf(s.board[id]) >= d.min),
      cause: "effect",
      prompt: `${cname(d.card)}: remove 1 from a card holding ${d.min}+ influence`,
      skippable: "Skip",
      why: cname(d.card),
    });
    return;
  }
  s.ret = undefined;
  popFrame(s);
});

// Made Man: may add 1 to a card that already holds your influence
register("t_addToOwn", (s, f) => {
  const d = f.d;
  if (f.ph === 0) {
    const targets = unscoredIds(s).filter(
      (id) => cardAccepts(s, id) && s.board[id].inf[d.owner] > 0,
    );
    if (targets.length === 0 || s.players[d.owner].supply === 0) {
      log(s, d.owner, `${cname(d.card)}: no legal target`);
      popFrame(s);
      return;
    }
    f.ph = 1;
    s.pending = {
      t: "card",
      prompt: `${cname(d.card)}: add 1 influence to which card?`,
      ids: targets,
      skip: "Skip",
    };
    return;
  }
  const ans = takeAns(f);
  if (ans && !ans.skip)
    for (let i = 0; i < (f.d.count ?? 1); i++)
      addToken(s, ans.card, f.d.owner, cname(f.d.card));
  popFrame(s);
});

// Salon Host: may move 1 of your influence to an adjacent card
register("t_moveOwnAdjacent", (s, f) => {
  const d = f.d;
  if (f.ph === 0) {
    f.ph = 1;
    pushFrame(s, "pickMove", {
      by: d.owner,
      cause: "effect",
      ownOnly: d.owner,
      srcs: "all",
      prompt: `${cname(d.card)}: move 1 of your influence — from which card?`,
      skippable: "Skip",
      why: cname(d.card),
    });
    return;
  }
  s.ret = undefined;
  popFrame(s);
});

// Sleeper Agent: on placing an Assassin, may remove 1 from a card adjacent to it
register("t_removeAdjacent", (s, f) => {
  const d = f.d;
  if (f.ph === 0) {
    const placedId = d.ctx?.placedId;
    if (placedId === undefined) {
      popFrame(s);
      return;
    }
    f.ph = 1;
    pushFrame(s, "pickRemove", {
      by: d.owner,
      cards: adjacentCards(s, placedId),
      cause: "effect",
      prompt: `${cname(d.card)}: remove 1 influence from a card adjacent to ${cname(placedId)}`,
      skippable: "Skip",
      why: cname(d.card),
    });
    return;
  }
  s.ret = undefined;
  popFrame(s);
});

// Deep Scan: look at top 3 cards of the deck, return them in any order
register("t_peekTop", (s, f) => {
  const d = f.d;
  if (f.ph === 0) {
    const n = Math.min(d.count, s.deck.length);
    if (n === 0) {
      log(s, d.owner, `${cname(d.card)}: deck is empty`);
      popFrame(s);
      return;
    }
    d.n = n;
    f.ph = 1;
    s.pending = {
      t: "deckOrder",
      prompt: `${cname(d.card)}: click cards in the order they should be drawn (first click = next draw)`,
      cards: s.deck.slice(0, n),
    };
    return;
  }
  const ans = takeAns(f);
  const shown = s.deck.slice(0, d.n);
  const order: number[] = ans.order;
  const valid =
    order.length === shown.length &&
    [...order].sort().join() === [...shown].sort().join();
  if (valid) s.deck = [...order, ...s.deck.slice(d.n)];
  log(s, d.owner, `${cname(d.card)}: looks at the top ${d.n} cards and returns them`);
  popFrame(s);
});

// keep bundlers from tree-shaking this module's registrations
export const EFFECTS_LOADED = true;

// silence unused-import lint for helpers used only in some branches
void areAdjacent;
