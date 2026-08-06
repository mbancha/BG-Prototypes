// =============================================================================
// HEADLESS SIMULATION — play thousands of bot games and aggregate telemetry.
//
// This is the fastest way to answer balance questions ("does going first
// win too often?", "is that card worth its cost?") without touching the UI.
// Pure, seeded and DOM-free, so the same function serves the in-app panel,
// the CLI (npm run sim) and tests.
//
// TODO: add whatever per-game aggregates your design questions need — the
// pattern is: record per-player facts during the game, then correlate them
// with who won.
// =============================================================================

import { CONFIG } from "../data/config";
import { botDecide } from "../game/bot";
import { applyAction, newGame } from "../game/engine";

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
  tieRate: number;
  avgPlacements: number;
}

/** Small fast seeded PRNG — same seed ⇒ same games, on any machine. */
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

export function runSimulation(
  opts: SimOptions,
  onProgress?: (done: number, total: number) => void,
): SimResult {
  const seed = opts.seed ?? CONFIG.SIM_SEED;
  const n = opts.players;
  const t0 = Date.now();
  const scoreSum = new Array(n).fill(0);
  const winSum = new Array(n).fill(0);
  let ties = 0;
  let placements = 0;

  for (let g = 0; g < opts.games; g++) {
    const rnd = mulberry32(seed + g);
    const s = newGame(
      Array.from({ length: n }, (_, i) => ({
        name: `P${i + 1}`,
        color: "#0ff",
        isBot: true,
      })),
      opts.board,
      rnd,
    );
    let guard = 0;
    while (!s.over) {
      if (++guard > 5000) throw new Error(`game ${g} did not terminate`);
      const err = applyAction(s, botDecide(s, rnd));
      if (err) throw new Error(`game ${g}: illegal bot action — ${err}`);
    }
    const top = Math.max(...s.players.map((p) => p.pts));
    const winners = s.players
      .map((p, i) => ({ p, i }))
      .filter((e) => e.p.pts === top);
    if (winners.length > 1) ties++;
    for (const w of winners) winSum[w.i] += 1 / winners.length; // split ties
    s.players.forEach((p, i) => (scoreSum[i] += p.pts));
    placements += s.telem.placements;
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
    avgPlacements: placements / opts.games,
  };
}
