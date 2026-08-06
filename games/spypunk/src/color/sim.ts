// =============================================================================
// COLOR-GROUPS SIMULATION — plays thousands of bot-vs-bot games headlessly on
// a given settings object and reports aggregate telemetry.
//
// The question it exists to answer: "does playing more of a colour make you
// more likely to win?" (especially with color powers on). For each game it
// records, per player, how many halves of each colour they placed and how
// many points each colour's groups paid them; then across all games it
// reports, per colour:
//   • leaderWinRate — win rate of the player who placed the MOST of that
//     colour (games with a tie for most are skipped). Compare against
//     baselineWinRate (1 / players): above = playing that colour more
//     correlates with winning.
//   • winnerAvgPlaced vs loserAvgPlaced — same signal, continuous form.
//   • avgPtsFromColor — which colours actually pay out.
// Ties for first place split win credit (two winners = 0.5 each).
//
// Pure and deterministic: same seed + settings ⇒ same numbers. No DOM, no
// timers — callable from the Web Worker (src/color/sim.worker.ts), the CLI
// (scripts/sim.mjs) and tests alike.
// =============================================================================

import { COLOR_CFG, COLOR_DEFS } from "../data/config";
import {
  applyColor,
  colorBotDecide,
  newColorGame,
  type ColorKey,
  type ColorVariant,
} from "./engine";

export interface SimOptions {
  games: number;
  players: number;
  variant: ColorVariant;
  seed?: number;
}

export interface SimColorStats {
  color: ColorKey;
  name: string;
  avgPlacedPerPlayer: number;
  winnerAvgPlaced: number;
  loserAvgPlaced: number;
  leaderWinRate: number | null; // null when no game had a unique leader
  leaderGames: number;
  avgPtsFromColor: number;
  ptsShare: number; // fraction of all points that came from this colour
}

export interface SimResult {
  games: number;
  players: number;
  variant: ColorVariant;
  seed: number;
  elapsedMs: number;
  baselineWinRate: number;
  avgScore: number;
  avgScoreBySeat: number[];
  winRateBySeat: number[];
  tieRate: number;
  avgPlacements: number;
  avgGroupsScored: number;
  avgEmptySeals: number; // groups sealed with nobody on them
  byColor: SimColorStats[];
}

/** Small fast seeded PRNG (mulberry32) — repeatable across machines. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const COLORS = COLOR_DEFS.map((d) => d.key) as ColorKey[];

/**
 * Run the simulation. `onProgress(done, total)` is called periodically so a
 * worker can report progress; keep it cheap.
 */
export function runSimulation(
  opts: SimOptions,
  onProgress?: (done: number, total: number) => void,
): SimResult {
  const seed = opts.seed ?? COLOR_CFG.SIM_SEED;
  const n = opts.players;
  const t0 = Date.now();

  const scoreSum = new Array(n).fill(0);
  const winSum = new Array(n).fill(0);
  let ties = 0;
  let placements = 0;
  let groupsScored = 0;
  let emptySeals = 0;

  const placedSum: Record<ColorKey, number> = zero();
  const placedByWinners: Record<ColorKey, number> = zero();
  const placedByLosers: Record<ColorKey, number> = zero();
  const ptsSum: Record<ColorKey, number> = zero();
  const leaderWins: Record<ColorKey, number> = zero();
  const leaderGames: Record<ColorKey, number> = zero();
  let winnerCount = 0;
  let loserCount = 0;

  for (let g = 0; g < opts.games; g++) {
    const rnd = mulberry32(seed + g);
    const s = newColorGame(
      Array.from({ length: n }, (_, i) => ({
        name: `P${i + 1}`,
        color: "#0ff",
        isBot: true,
      })),
      opts.variant,
      rnd,
    );

    let guard = 0;
    while (!s.over) {
      if (++guard > 5000) throw new Error(`game ${g} did not terminate`);
      const err = applyColor(s, colorBotDecide(s, rnd));
      if (err) throw new Error(`game ${g}: illegal bot action — ${err}`);
    }

    // ---- tally this game ----
    const top = Math.max(...s.players.map((p) => p.pts));
    const winners = s.players
      .map((p, i) => ({ p, i }))
      .filter((e) => e.p.pts === top)
      .map((e) => e.i);
    const credit = 1 / winners.length; // split ties
    if (winners.length > 1) ties++;

    placements += s.telem.placements;
    groupsScored += s.telem.groupsScored;
    emptySeals += s.telem.scoredZero;

    for (let i = 0; i < n; i++) {
      const pl = s.players[i];
      scoreSum[i] += pl.pts;
      const isWinner = winners.includes(i);
      if (isWinner) {
        winSum[i] += credit;
        winnerCount++;
      } else loserCount++;
      for (const c of COLORS) {
        placedSum[c] += pl.placedByColor[c];
        ptsSum[c] += pl.ptsByColor[c];
        if (isWinner) placedByWinners[c] += pl.placedByColor[c];
        else placedByLosers[c] += pl.placedByColor[c];
      }
    }

    // per colour: did the player who placed the most of it win?
    for (const c of COLORS) {
      let bestVal = -1;
      let bestIdx = -1;
      let unique = true;
      for (let i = 0; i < n; i++) {
        const v = s.players[i].placedByColor[c];
        if (v > bestVal) {
          bestVal = v;
          bestIdx = i;
          unique = true;
        } else if (v === bestVal) unique = false;
      }
      if (!unique || bestVal <= 0) continue; // no clear leader in this colour
      leaderGames[c]++;
      if (winners.includes(bestIdx)) leaderWins[c] += credit;
    }

    if (onProgress && (g + 1) % 250 === 0) onProgress(g + 1, opts.games);
  }

  const games = opts.games;
  const totalPts = COLORS.reduce((a, c) => a + ptsSum[c], 0);
  return {
    games,
    players: n,
    variant: opts.variant,
    seed,
    elapsedMs: Date.now() - t0,
    baselineWinRate: 1 / n,
    avgScore: scoreSum.reduce((a, b) => a + b, 0) / (games * n),
    avgScoreBySeat: scoreSum.map((v) => v / games),
    winRateBySeat: winSum.map((v) => v / games),
    tieRate: ties / games,
    avgPlacements: placements / games,
    avgGroupsScored: groupsScored / games,
    avgEmptySeals: emptySeals / games,
    byColor: COLORS.map((c) => ({
      color: c,
      name: COLOR_DEFS.find((d) => d.key === c)!.name,
      avgPlacedPerPlayer: placedSum[c] / (games * n),
      winnerAvgPlaced: winnerCount > 0 ? placedByWinners[c] / winnerCount : 0,
      loserAvgPlaced: loserCount > 0 ? placedByLosers[c] / loserCount : 0,
      leaderWinRate:
        leaderGames[c] > 0 ? leaderWins[c] / leaderGames[c] : null,
      leaderGames: leaderGames[c],
      avgPtsFromColor: ptsSum[c] / (games * n),
      ptsShare: totalPts > 0 ? ptsSum[c] / totalPts : 0,
    })),
  };
}

function zero(): Record<ColorKey, number> {
  return { red: 0, cyan: 0, green: 0, gold: 0, violet: 0 };
}
