// Turn flow and the public action API. The UI calls applyAction on a fresh
// structuredClone of the previous state; a non-null return is a rejection
// reason and the clone is discarded.

import { CONFIG } from "../data/config";
import { CARDS, def, isDisabled } from "./cards";
import { EFFECTS_LOADED } from "./effects";
import {
  adjacentCards,
  cellsFor,
  findEnclosed,
  matchesFor,
  placementCheck,
} from "./grid";
import {
  adjSocialiteBonus,
  deployDiscount,
  enforcerBonus,
  listeners,
  onPlaceTriggers,
  startOfTurnTriggers,
} from "./ongoing";
import {
  addToken,
  cname,
  drawUpTo,
  gainMoney,
  log,
  pname,
  scoreCard,
  spendMoney,
} from "./rules";
import {
  matchItem,
  popFrame,
  provideAnswer,
  pump,
  pushFrame,
  register,
  takeAns,
  trigItem,
} from "./runtime";
import type { Cell, GameState, HubItem, Sym, Telemetry } from "./types";
import { cellKey } from "./types";

void EFFECTS_LOADED; // force effect handler registration

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

function freshTelemetry(): Telemetry {
  return {
    matchesBySym: { muscle: 0, intel: 0, favor: 0, credit: 0, whisper: 0 },
    infAdded: 0,
    infRemoved: 0,
    infMoved: 0,
    fizzledSupply: 0,
    fizzledOther: 0,
    moneyBySource: {},
    moneySpentOnDeploys: 0,
    deploys: 0,
    placements: 0,
    enclosures: 0,
    scoredZero: 0,
    turns: 0,
  };
}

export function newGame(
  playersIn: { name: string; color: string }[],
): GameState {
  const n = playersIn.length;
  if (n < CONFIG.MIN_PLAYERS || n > CONFIG.MAX_PLAYERS)
    throw new Error(`Player count must be ${CONFIG.MIN_PLAYERS}–${CONFIG.MAX_PLAYERS}`);
  const deck = CARDS.map((c) => c.id);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  const s: GameState = {
    players: playersIn.map((p) => ({
      name: p.name,
      color: p.color,
      money: CONFIG.STARTING_MONEY,
      pts: 0,
      supply: CONFIG.INFLUENCE_SUPPLY,
      hand: [],
      tableau: [],
    })),
    deck,
    discard: [],
    board: {},
    cellOwner: {},
    turn: { n: 0, p: 0, deployed: false, placed: false, setup: true },
    over: false,
    exec: [],
    pending: null,
    log: [],
    telem: freshTelemetry(),
    passPending: true,
  };
  for (let i = 0; i < CONFIG.STARTING_HAND; i++)
    for (let p = 0; p < n; p++) s.players[p].hand.push(s.deck.shift()!);
  log(s, null, `New game — ${playersIn.map((p) => p.name).join(", ")}`);
  log(
    s,
    0,
    `${playersIn[0].name} starts: place one card covering the origin cell`,
  );
  return s;
}

// ---------------------------------------------------------------------------
// Enclosure frame: after placement resolution, score surrounded cards.
// Placing player chooses the order when several enclose at once.
// ---------------------------------------------------------------------------

register("encl", (s, f) => {
  if (f.ph === 1) {
    const ans = takeAns(f);
    f.ph = 0;
    if (ans && ans.card !== undefined) scoreCard(s, ans.card);
    return;
  }
  const enclosed = findEnclosed(s);
  if (enclosed.length === 0) {
    popFrame(s);
    return;
  }
  if (enclosed.length === 1) {
    scoreCard(s, enclosed[0]);
    return; // loop; rescan in case list changes
  }
  f.ph = 1;
  s.pending = {
    t: "card",
    prompt: `${enclosed.length} cards enclosed — choose which scores first`,
    ids: enclosed,
  };
});

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export type Action =
  | { a: "beginTurn" }
  | { a: "deploy"; card: number }
  | { a: "place"; card: number; at: Cell; rot: number }
  | { a: "endTurn" }
  | { a: "answer"; ans: any };

function busy(s: GameState): boolean {
  return s.exec.length > 0 || s.pending !== null;
}

export function applyAction(s: GameState, action: Action): string | null {
  if (s.over && action.a !== "answer") return "Game is over";
  switch (action.a) {
    case "beginTurn":
      return actBeginTurn(s);
    case "deploy":
      return actDeploy(s, action.card);
    case "place":
      return actPlace(s, action.card, action.at, action.rot);
    case "endTurn":
      return actEndTurn(s);
    case "answer":
      if (!s.pending) return "Nothing to answer";
      provideAnswer(s, action.ans);
      return null;
  }
}

function actBeginTurn(s: GameState): string | null {
  if (!s.passPending) return "Turn already started";
  s.passPending = false;
  const p = s.turn.p;
  if (s.turn.setup) return null; // setup placement has no start-of-turn phase
  log(s, p, `— turn ${s.turn.n}: ${pname(s, p)} —`);
  // Filibuster locks placed by this player expire at the start of their turn
  for (const id of Object.keys(s.board).map(Number)) {
    if (s.board[id].lockBy === p) {
      s.board[id].lockBy = undefined;
      log(s, p, `${cname(id)} is no longer locked`);
    }
  }
  const trigs = startOfTurnTriggers(s, p);
  if (trigs.length > 0) {
    pushFrame(s, "hub", {
      title: "Start of turn — resolve in any order",
      items: trigs.map(({ id }) => trigItem(id, p)),
    });
    pump(s);
  }
  return null;
}

function actDeploy(s: GameState, cardId: number): string | null {
  const p = s.turn.p;
  if (s.passPending) return "Pass the device first";
  if (s.turn.setup) return "No deploys during the opening placement";
  if (busy(s)) return "Resolve pending effects first";
  if (s.turn.deployed) return "Already deployed this turn";
  const hand = s.players[p].hand;
  const idx = hand.indexOf(cardId);
  if (idx === -1) return "Card not in hand";
  const d = def(cardId);
  if (isDisabled(cardId)) return `${d.name} is disabled (benched in cards.json)`;
  const cost = Math.max(0, d.cost - deployDiscount(s, p));
  if (s.players[p].money < cost) return `Need $${cost}`;

  spendMoney(s, p, cost);
  hand.splice(idx, 1);
  s.turn.deployed = true;
  s.telem.deploys++;
  log(s, p, `deploys ${d.name} for $${cost} — ${d.text}`);
  for (const l of listeners(s, "opponentDeploy"))
    if (l.p !== p) gainMoney(s, l.p, l.money, cname(l.card));

  if (d.kind === "O") {
    s.players[p].tableau.push(cardId);
  } else {
    s.discard.push(cardId);
    pushFrame(s, `e_${d.spec.i}`, { ...d.spec, card: cardId, by: p });
    pump(s);
  }
  return null;
}

function actPlace(
  s: GameState,
  cardId: number,
  at: Cell,
  rot: number,
): string | null {
  const p = s.turn.p;
  if (s.passPending) return "Pass the device first";
  if (busy(s)) return "Resolve pending effects first";
  if (s.turn.placed && !s.turn.setup) return "Already placed this turn";
  const hand = s.players[p].hand;
  const idx = hand.indexOf(cardId);
  if (idx === -1) return "Card not in hand";
  const check = placementCheck(s, at, rot);
  if (!check.ok) return check.reason!;

  const [ca, cb] = cellsFor(at, rot);
  hand.splice(idx, 1);
  s.board[cardId] = {
    id: cardId,
    a: ca,
    b: cb,
    rot,
    inf: s.players.map(() => 0),
    scored: false,
    placedBy: p,
    turnPlaced: s.turn.n,
  };
  s.cellOwner[cellKey(ca)] = cardId;
  s.cellOwner[cellKey(cb)] = cardId;
  s.players[p].lastPlaced = cardId;
  s.turn.placed = true;
  s.telem.placements++;
  const d = def(cardId);
  log(s, p, `places ${d.name} at (${ca.x},${ca.y})`);

  // baseline influence + placement bonuses (Union Boss / It Couple)
  for (let i = 0; i < CONFIG.BASELINE_INFLUENCE; i++)
    addToken(s, cardId, p, "baseline");
  if (d.type === "Enforcer")
    for (let i = 0; i < enforcerBonus(s, p); i++)
      addToken(s, cardId, p, "Union Boss");
  if (
    adjSocialiteBonus(s, p) > 0 &&
    adjacentCards(s, cardId).some((n) => def(n).type === "Socialite")
  )
    for (let i = 0; i < adjSocialiteBonus(s, p); i++)
      addToken(s, cardId, p, "It Couple");

  if (s.turn.setup) {
    // opening placement: no neighbors → no matches or enclosures possible
    drawUpTo(s, p, CONFIG.HAND_REFILL);
    s.turn = {
      n: 1,
      p: 1 % s.players.length,
      deployed: false,
      placed: false,
      setup: false,
    };
    s.passPending = true;
    return null;
  }

  // resolution: enclosure check runs after the match/trigger hub drains
  pushFrame(s, "encl", {});
  const items: HubItem[] = matchesFor(s, cardId, at, rot).map((m) =>
    matchItem(m.sym as Sym, cardId, m.other),
  );
  for (const { id } of onPlaceTriggers(s, p, d.type))
    items.push(trigItem(id, p));
  if (items.length > 0)
    pushFrame(s, "hub", {
      title: "Placement — resolve matches & triggers in any order",
      items,
      ctx: { placedId: cardId },
    });
  pump(s);
  return null;
}

function actEndTurn(s: GameState): string | null {
  const p = s.turn.p;
  if (s.passPending) return "Pass the device first";
  if (s.turn.setup) return "Place your opening card first";
  if (busy(s)) return "Resolve pending effects first";
  if (!s.turn.placed && s.players[p].hand.length > 0)
    return "You must place a card (placement is mandatory)";

  drawUpTo(s, p, CONFIG.HAND_REFILL);
  s.telem.turns = s.turn.n;

  if (s.finalPhase && s.turn.n > s.finalPhase.setOnTurn) {
    s.finalPhase.remaining--;
    if (s.finalPhase.remaining <= 0) {
      endGame(s);
      return null;
    }
  }
  s.turn.n++;
  s.turn.p = (p + 1) % s.players.length;
  s.turn.deployed = false;
  s.turn.placed = false;
  s.passPending = true;
  return null;
}

function infOnGrid(s: GameState, q: number): number {
  let n = 0;
  for (const id of Object.keys(s.board).map(Number))
    if (!s.board[id].scored) n += s.board[id].inf[q];
  return n;
}

function endGame(s: GameState) {
  s.over = true;
  const idx = s.players.map((_, i) => i);
  idx.sort((a, b) => {
    if (s.players[b].pts !== s.players[a].pts)
      return s.players[b].pts - s.players[a].pts;
    if (s.players[b].money !== s.players[a].money)
      return s.players[b].money - s.players[a].money;
    return infOnGrid(s, b) - infOnGrid(s, a);
  });
  s.ranking = idx;
  log(s, null, `GAME OVER`);
  for (const i of idx)
    log(
      s,
      i,
      `${pname(s, i)}: ${s.players[i].pts} pts, $${s.players[i].money}, ${infOnGrid(s, i)} influence on grid`,
    );
  log(s, idx[0], `${pname(s, idx[0])} wins`);
}
