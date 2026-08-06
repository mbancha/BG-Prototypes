// =============================================================================
// HEADLESS SIMULATION — play thousands of bot games and aggregate telemetry.
//
// This is the fastest way to answer balance questions ("does going first win
// too often?", "is that card worth its cost?") without touching the UI. Pure,
// seeded and DOM-free, so the same function serves the in-app panel, the CLI
// (npm run sim) and tests.
//
// It reads the winner from state.result, so it keeps working when your game's
// ending changes — ties split credit, co-op games report a win rate against
// the game itself, and a pattern/race win needs no scoring at all.
//
// TODO: add whatever per-game aggregates your design questions need — the
// pattern is: record per-player facts during the game, then correlate them
// with who won.
// =============================================================================

import { CONFIG } from "../data/config";
import { looseRandom, playOut, type GameApi } from "../kernel/harness";
import { winShares } from "../kernel/outcome";
import { botDecide } from "../game/bot";
import {
  applyAction,
  legalActions,
  newGame,
  pts,
  type Action,
  type GameState,
} from "../game/engine";

export interface SimOptions {
  games: number;
  players: number;
  board?: { width: number; height: number };
  seed?: number;
}

export interface SimResult {
  games: number;
  players: number;
  seed: number;
  elapsedMs: number;
  baselineWinRate: number;
  avgScore: number;
  avgScoreBySeat: number[];
  winRateBySeat: number[];
  /** Draws as a share of games — a scoring system that ties a lot is a
   *  finding, not a rounding error. */
  tieRate: number;
  avgTurns: number;
  /** Per-source point totals across all games, e.g. { placement, bonus }. */
  pointsBySource: Record<string, number>;
  /** Why games ended, counted: { "out of tiles": 1873, "no room left": 127 }. */
  endReasons: Record<string, number>;
}

/** Small fast seeded PRNG, kept exported for tests and bot noise. Game
 *  randomness does NOT come from here — it lives in state.rng. */
export const mulberry32 = looseRandom;

export function runSimulation(
  opts: SimOptions,
  onProgress?: (done: number, total: number) => void,
): SimResult {
  const seed = opts.seed ?? CONFIG.SIM_SEED;
  const n = opts.players;
  const t0 = Date.now();
  const scoreSum = new Array<number>(n).fill(0);
  const winSum = new Array<number>(n).fill(0);
  const pointsBySource: Record<string, number> = {};
  const endReasons: Record<string, number> = {};
  let ties = 0;
  let turns = 0;

  const api: GameApi<GameState, Action> = {
    create: (gameSeed) =>
      newGame(
        Array.from({ length: n }, (_, i) => ({
          name: `P${i + 1}`,
          color: "#0ff",
          isBot: true,
        })),
        { ...opts.board, seed: gameSeed },
      ),
    apply: applyAction,
    legal: legalActions,
    over: (s) => s.over,
  };

  for (let g = 0; g < opts.games; g++) {
    const botRnd = looseRandom(seed + g);
    const { state: s } = playOut(
      api,
      api.create(seed + g),
      botRnd,
      { choose: (st, _acts, rnd) => botDecide(st, rnd) },
      `sim game ${g}`,
    );
    const result = s.result!;
    if (result.winners.length > 1) ties++;
    winShares(result, n).forEach((w, i) => (winSum[i] += w));
    s.players.forEach((p, i) => {
      scoreSum[i] += pts(p);
      for (const [src, v] of Object.entries(p.score))
        pointsBySource[src] = (pointsBySource[src] ?? 0) + v;
    });
    endReasons[result.reason] = (endReasons[result.reason] ?? 0) + 1;
    turns += s.flow.turn;
    if (onProgress && (g + 1) % 250 === 0) onProgress(g + 1, opts.games);
  }

  return {
    games: opts.games,
    players: n,
    seed,
    elapsedMs: Date.now() - t0,
    baselineWinRate: 1 / n,
    avgScore: scoreSum.reduce((a, b) => a + b, 0) / (opts.games * n),
    avgScoreBySeat: scoreSum.map((v) => v / opts.games),
    winRateBySeat: winSum.map((v) => v / opts.games),
    tieRate: ties / opts.games,
    avgTurns: turns / opts.games,
    pointsBySource,
    endReasons,
  };
}
