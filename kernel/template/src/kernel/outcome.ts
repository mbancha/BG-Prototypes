// =============================================================================
// HOW A GAME ENDS — ranking, tiebreakers, and win conditions that aren't
// "highest score".
//
// A prototype's ending is easy to get subtly wrong and annoying to change
// later, because the ending is also what the simulator measures. The shapes
// this covers:
//
//   most points wins ......... rankSeats(seats, [pts])
//   cascading tiebreakers .... rankSeats(seats, [pts, money, tokensOnBoard])
//   lowest wins .............. rankSeats(..., { lowestWins: true })
//   pattern / race / last-one-standing ... finish(s, { winners: [p] })
//   co-operative ............. finish(s, { coop: "lost", reason: "..." })
//   teams .................... rankSeats over team totals, winners = members
//   score breakdown .......... per-source tallies the dump can chart
//
// Ties are FIRST-CLASS: `winners` is a list. A prototype that silently picks
// one winner hides how often the scoring produces a draw, which is usually a
// balance finding in itself.
// =============================================================================

import type { Seat } from "./types";

/** Points by source: { placement: 12, cards: 4, penalties: -2 }. Keeping the
 *  breakdown (rather than one running total) is what lets the simulator say
 *  WHERE the winner's points came from. */
export type Breakdown = Record<string, number>;

export interface Outcome {
  reason: string;
  /** Seats best-first. Tied seats appear adjacent — see `tiers`. */
  ranking: Seat[];
  /** Everyone who won. More than one ⇒ a draw or a team win. */
  winners: Seat[];
  /** Seats grouped by rank: [[0,2],[1]] = seats 0 and 2 tied for first. */
  tiers: Seat[][];
  /** Per-seat score breakdowns, if the game keeps them. */
  scores?: Breakdown[];
  /** Set for co-operative games; `winners` is then everyone or nobody. */
  coop?: "won" | "lost";
}

export interface HasOutcome {
  over: boolean;
  result?: Outcome;
}

export const total = (b: Breakdown): number =>
  Object.values(b).reduce((a, v) => a + v, 0);

export function addScore(b: Breakdown, source: string, n: number): void {
  if (n !== 0) b[source] = (b[source] ?? 0) + n;
}

export interface RankOpts {
  /** Golf scoring: the smallest total wins. */
  lowestWins?: boolean;
}

/** Rank seats by a cascade of metrics: the first separates, the second breaks
 *  ties in the first, and so on. Seats level on every metric stay tied. */
export function rankSeats(
  seats: readonly Seat[],
  metrics: readonly ((p: Seat) => number)[],
  opts: RankOpts = {},
): { ranking: Seat[]; winners: Seat[]; tiers: Seat[][] } {
  const sign = opts.lowestWins ? 1 : -1;
  const cmp = (a: Seat, b: Seat) => {
    for (const m of metrics) {
      const d = (m(a) - m(b)) * sign;
      if (d !== 0) return d;
    }
    return 0;
  };
  const ranking = [...seats].sort(cmp);
  const tiers: Seat[][] = [];
  for (const p of ranking) {
    const last = tiers[tiers.length - 1];
    if (last && cmp(last[0], p) === 0) last.push(p);
    else tiers.push([p]);
  }
  return { ranking, winners: tiers[0] ? [...tiers[0]] : [], tiers };
}

export interface FinishOpts {
  reason: string;
  /** Explicit winners — pattern wins, races, elimination, co-op. Skips
   *  ranking by score entirely. */
  winners?: Seat[];
  /** Otherwise: rank these seats by these metrics. */
  seats?: readonly Seat[];
  metrics?: readonly ((p: Seat) => number)[];
  lowestWins?: boolean;
  scores?: Breakdown[];
  coop?: "won" | "lost";
}

/** Set `over` and `result`. Call this from exactly one place per game so
 *  there is a single answer to "how did that end". */
export function finish<S extends HasOutcome>(s: S, opts: FinishOpts): Outcome {
  let ranking: Seat[];
  let winners: Seat[];
  let tiers: Seat[][];

  if (opts.coop) {
    const all = [...(opts.seats ?? [])];
    ranking = all;
    winners = opts.coop === "won" ? all : [];
    tiers = all.length ? [all] : [];
  } else if (opts.winners) {
    const rest = (opts.seats ?? []).filter((p) => !opts.winners!.includes(p));
    ranking = [...opts.winners, ...rest];
    winners = [...opts.winners];
    tiers = rest.length ? [[...opts.winners], rest] : [[...opts.winners]];
  } else {
    const r = rankSeats(opts.seats ?? [], opts.metrics ?? [], {
      lowestWins: opts.lowestWins,
    });
    ranking = r.ranking;
    winners = r.winners;
    tiers = r.tiers;
  }

  s.over = true;
  s.result = {
    reason: opts.reason,
    ranking,
    winners,
    tiers,
    scores: opts.scores,
    coop: opts.coop,
  };
  return s.result;
}

/** Win credit for the simulator: a 3-way tie is a third of a win each, so
 *  win rates across seats always sum to 1 and draws stay visible. */
export function winShares(o: Outcome, seats: number): number[] {
  const out = new Array(seats).fill(0);
  if (o.winners.length === 0) return out; // co-op loss: nobody wins
  for (const p of o.winners) out[p] = 1 / o.winners.length;
  return out;
}
