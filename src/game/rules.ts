import { CONFIG } from "../data/config";
import { def } from "./cards";
import type { GameState, Placed } from "./types";
import {
  blockMoveOffAt,
  listeners,
  protectAt,
  protectsVsMuscle,
  protectsVsWhisper,
  soloBonus,
  winsTies,
} from "./ongoing";

export type Cause =
  | "muscleMatch"
  | "whisperMatch"
  | "effect"
  | "baseline"
  | "match";

export function log(s: GameState, p: number | null, msg: string) {
  s.log.push({ turn: s.turn.n, p, msg });
}

export const pname = (s: GameState, p: number) => s.players[p].name;
export const cname = (id: number) => def(id).name;

export function totalInf(pl: Placed): number {
  return pl.inf.reduce((a, b) => a + b, 0);
}

// ---------------------------------------------------------------------------
// Legality checks. Scored cards and Filibuster-locked cards fizzle all
// influence changes; protection Ongoings beat removals/moves (spec rule).
// ---------------------------------------------------------------------------

/** Card can have influence placed on / moved onto it (supply not considered). */
export function cardAccepts(s: GameState, id: number): boolean {
  const pl = s.board[id];
  return !!pl && !pl.scored && pl.lockBy === undefined;
}

export function cardLockedOrScored(s: GameState, id: number): boolean {
  return !cardAccepts(s, id);
}

export function canRemoveToken(
  s: GameState,
  id: number,
  owner: number,
  by: number,
  cause: Cause,
): boolean {
  const pl = s.board[id];
  if (!pl || pl.scored || pl.lockBy !== undefined) return false;
  if (pl.inf[owner] <= 0) return false;
  // The Wall: owner's influence can't be removed where they have >= threshold
  const wall = protectAt(s, owner);
  if (wall !== null && pl.inf[owner] >= wall) return false;
  // Untouchable: opponents' Muscle matches can't remove owner's influence
  if (cause === "muscleMatch" && by !== owner && protectsVsMuscle(s, owner))
    return false;
  return true;
}

export function canMoveTokenOff(
  s: GameState,
  id: number,
  owner: number,
  by: number,
  cause: Cause,
): boolean {
  const pl = s.board[id];
  if (!pl || pl.scored || pl.lockBy !== undefined) return false;
  if (pl.inf[owner] <= 0) return false;
  // Firewall: opponents' Whisper matches can't move owner's influence
  if (cause === "whisperMatch" && by !== owner && protectsVsWhisper(s, owner))
    return false;
  // Bouncer: opponents (of q) can't move ANY influence off cards where q has 2+
  for (let q = 0; q < s.players.length; q++) {
    if (q === by) continue;
    const th = blockMoveOffAt(s, q);
    if (th !== null && pl.inf[q] >= th) return false;
  }
  return true;
}

/** Owners with at least one removable token on `id` for (by, cause). */
export function removableOwners(
  s: GameState,
  id: number,
  by: number,
  cause: Cause,
): number[] {
  const out: number[] = [];
  for (let q = 0; q < s.players.length; q++)
    if (canRemoveToken(s, id, q, by, cause)) out.push(q);
  return out;
}

export function movableOwners(
  s: GameState,
  id: number,
  by: number,
  cause: Cause,
): number[] {
  const out: number[] = [];
  for (let q = 0; q < s.players.length; q++)
    if (canMoveTokenOff(s, id, q, by, cause)) out.push(q);
  return out;
}

// ---------------------------------------------------------------------------
// Mutations (assume legality already checked unless noted; they still guard)
// ---------------------------------------------------------------------------

/** Add one token of player p to card. Returns false (and logs) on fizzle. */
export function addToken(
  s: GameState,
  id: number,
  p: number,
  why: string,
): boolean {
  const pl = s.board[id];
  if (!pl || pl.scored || pl.lockBy !== undefined) {
    s.telem.fizzledOther++;
    log(s, p, `influence onto ${cname(id)} fizzles (${pl?.scored ? "scored" : "locked"}) [${why}]`);
    return false;
  }
  if (s.players[p].supply <= 0) {
    s.telem.fizzledSupply++;
    log(s, p, `influence onto ${cname(id)} fizzles — supply empty [${why}]`);
    return false;
  }
  s.players[p].supply--;
  pl.inf[p]++;
  s.telem.infAdded++;
  log(s, p, `adds 1 influence to ${cname(id)} (${why})`);
  return true;
}

/** Remove one token of `owner` from card; token returns to owner's supply. */
export function removeToken(
  s: GameState,
  id: number,
  owner: number,
  by: number,
  cause: Cause,
  why: string,
): boolean {
  if (!canRemoveToken(s, id, owner, by, cause)) {
    s.telem.fizzledOther++;
    log(s, by, `removal from ${cname(id)} fizzles [${why}]`);
    return false;
  }
  const pl = s.board[id];
  pl.inf[owner]--;
  s.players[owner].supply++;
  s.telem.infRemoved++;
  log(
    s,
    by,
    `removes 1 of ${pname(s, owner)}'s influence from ${cname(id)} (${why})`,
  );
  // Vendetta: whenever any of your influence is removed, gain $1
  for (const l of listeners(s, "yourInfluenceRemoved")) {
    if (l.p === owner) gainMoney(s, l.p, l.money, cname(l.card));
  }
  return true;
}

/** Move one token of `owner` from card `from` to card `to`. */
export function moveToken(
  s: GameState,
  from: number,
  to: number,
  owner: number,
  by: number,
  cause: Cause,
  why: string,
): boolean {
  if (!canMoveTokenOff(s, from, owner, by, cause) || !cardAccepts(s, to)) {
    s.telem.fizzledOther++;
    log(s, by, `move ${cname(from)} → ${cname(to)} fizzles [${why}]`);
    return false;
  }
  s.board[from].inf[owner]--;
  s.board[to].inf[owner]++;
  s.telem.infMoved++;
  log(
    s,
    by,
    `moves 1 of ${pname(s, owner)}'s influence: ${cname(from)} → ${cname(to)} (${why})`,
  );
  return true;
}

export function gainMoney(
  s: GameState,
  p: number,
  amount: number,
  source: string,
) {
  if (amount <= 0) return;
  s.players[p].money += amount;
  s.telem.moneyBySource[source] =
    (s.telem.moneyBySource[source] ?? 0) + amount;
  log(s, p, `gains $${amount} (${source})`);
}

/** Transfer up to `amount` from one player to another ("pays if able"). */
export function payMoney(
  s: GameState,
  from: number,
  to: number,
  amount: number,
  source: string,
) {
  const real = Math.min(amount, s.players[from].money);
  if (real <= 0) {
    log(s, to, `${pname(s, from)} cannot pay (${source})`);
    return;
  }
  s.players[from].money -= real;
  s.players[to].money += real;
  s.telem.moneyBySource[source] =
    (s.telem.moneyBySource[source] ?? 0) + real;
  log(s, to, `collects $${real} from ${pname(s, from)} (${source})`);
}

export function spendMoney(s: GameState, p: number, amount: number) {
  s.players[p].money -= amount;
  s.telem.moneySpentOnDeploys += amount;
}

// ---------------------------------------------------------------------------
// Drawing & deck exhaustion
// ---------------------------------------------------------------------------

export function drawCards(
  s: GameState,
  p: number,
  count: number,
  why: string,
) {
  let drawn = 0;
  while (
    drawn < count &&
    s.deck.length > 0 &&
    s.players[p].hand.length < CONFIG.HAND_LIMIT
  ) {
    s.players[p].hand.push(s.deck.shift()!);
    drawn++;
  }
  if (drawn > 0) log(s, p, `draws ${drawn} card${drawn > 1 ? "s" : ""} (${why})`);
  checkDeckEmpty(s);
}

export function drawUpTo(s: GameState, p: number, target: number) {
  const need = target - s.players[p].hand.length;
  if (need > 0) drawCards(s, p, need, "refill");
}

export function checkDeckEmpty(s: GameState) {
  if (s.deck.length === 0 && !s.finalPhase && !s.over) {
    s.finalPhase = {
      remaining: CONFIG.FINAL_TURNS_PER_PLAYER * s.players.length,
      setOnTurn: s.turn.n,
    };
    log(
      s,
      null,
      `DECK EMPTY — every player gets ${CONFIG.FINAL_TURNS_PER_PLAYER} final turns`,
    );
  }
}

// ---------------------------------------------------------------------------
// Scoring an enclosed card
// ---------------------------------------------------------------------------

export function scoreCard(s: GameState, id: number) {
  const pl = s.board[id];
  if (!pl || pl.scored) return;
  const d = def(id);
  const infSnapshot = [...pl.inf];
  const total = totalInf(pl);
  s.telem.enclosures++;

  let winners: number[] = [];
  let each: number[] = [];
  let label: string;

  if (total === 0) {
    s.telem.scoredZero++;
    label = "no influence — scores no one";
    log(s, null, `${cname(id)} enclosed with no influence — no score`);
  } else {
    const top = Math.max(...pl.inf);
    let tied: number[] = [];
    for (let q = 0; q < s.players.length; q++)
      if (pl.inf[q] === top && top > 0) tied.push(q);

    if (tied.length === 1) {
      const w = tied[0];
      const bonus = soloBonus(s, w);
      const pts = d.pts + bonus;
      s.players[w].pts += pts;
      winners = [w];
      each = [pts];
      label = `${pname(s, w)} +${pts}`;
      log(
        s,
        w,
        `scores ${cname(id)} for ${d.pts} pts${bonus ? ` +${bonus} (Kingmaker)` : ""}`,
      );
    } else {
      // Tie. Incumbent: if exactly one tied player wins ties, they take it alone
      // (no Kingmaker bonus — they were tied). Otherwise split, rounded down.
      const incumbents = tied.filter((q) => winsTies(s, q));
      if (incumbents.length === 1) {
        const w = incumbents[0];
        s.players[w].pts += d.pts;
        winners = [w];
        each = [d.pts];
        label = `${pname(s, w)} +${d.pts} (Incumbent)`;
        log(s, w, `wins the tie on ${cname(id)} (Incumbent) for ${d.pts} pts`);
      } else {
        const half = Math.floor(d.pts / CONFIG.TIE_DIVISOR);
        winners = tied;
        each = tied.map(() => half);
        for (const q of tied) s.players[q].pts += half;
        label = tied.map((q) => `${pname(s, q)} +${half}`).join(", ");
        log(
          s,
          null,
          `${cname(id)} tied (${tied.map((q) => pname(s, q)).join(" / ")}) — ${half} pts each`,
        );
      }
    }
  }

  // return all tokens to supplies
  for (let q = 0; q < s.players.length; q++) {
    s.players[q].supply += pl.inf[q];
    pl.inf[q] = 0;
  }
  pl.scored = true;
  pl.lockBy = undefined;
  pl.scoredInfo = { winners, each, label };

  // scored listeners (Party Leader / Portfolio Hedge)
  for (const l of listeners(s, "scoredWithYou"))
    if (infSnapshot[l.p] > 0) gainMoney(s, l.p, l.money, cname(l.card));
  for (const l of listeners(s, "scoredWithoutYou"))
    if (infSnapshot[l.p] === 0) gainMoney(s, l.p, l.money, cname(l.card));
}
