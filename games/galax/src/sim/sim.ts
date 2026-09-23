import {
  newGame,
  applyAction,
  assertInvariants,
  score,
  points,
  CARDS,
  COLORS,
  legalActions,
  type GameState,
} from "../game/engine";
import { botDecide } from "../game/bot";
import { CONFIG } from "../data/config";
export interface Sample {
  n: number;
  wins: number;
  points: number;
  winRate: number;
  meanPoints: number;
}
const sample = (): Sample => ({
  n: 0,
  wins: 0,
  points: 0,
  winRate: 0,
  meanPoints: 0,
});
const add = (b: Sample, win: number, pts: number) => {
  b.n++;
  b.wins += win;
  b.points += pts;
  b.winRate = b.wins / b.n;
  b.meanPoints = b.points / b.n;
};
export function runSimulation(
  opts: {
    games: number;
    players: number;
    seed: number;
    maxActions?: number;
    homePolicy?: "rotate" | "heuristic";
  },
  progress?: (done: number, total: number) => void,
) {
  const started = Date.now(),
    byStartingColor: Record<string, Sample> = {},
    bySeat: Record<string, Sample> = {},
    tech: Record<
      string,
      { name: string; plays: number; triggers: number; holders: Sample }
    > = {};
  const endReasons: Record<string, number> = {},
    pointsBySource: Record<string, number> = {},
    actions: Record<string, number> = {};
  let completed = 0,
    truncated = 0,
    turns = 0,
    battles = 0,
    battleWins = 0,
    conquers = 0,
    conquerWins = 0;
  const games: any[] = [];
  for (let n = 0; n < opts.games; n++) {
    const s = newGame(
      Array.from({ length: opts.players }, (_, i) => ({
        name: "Bot " + (i + 1),
        color: ["#f29764", "#71cbd1", "#bb9ce6", "#e6cf75"][i],
        isBot: true,
      })),
      { seed: opts.seed + n },
    );
    let steps = 0;
    while (!s.over && steps < (opts.maxActions ?? CONFIG.SIM_MAX_ACTIONS)) {
      let action = botDecide(s);
      if (s.phase === "home" && opts.homePolicy !== "heuristic") {
        const candidates = legalActions(s),
          preferred = COLORS[(opts.seed + n + s.active) % 4];
        action =
          candidates.find((a) => CARDS[a.card!].color === preferred) ??
          candidates[(opts.seed + n + s.active) % candidates.length];
      }
      const err = applyAction(s, action);
      if (err) throw Error(err);
      assertInvariants(s);
      steps++;
    }
    if (!s.over) {
      truncated++;
      games.push({
        seed: s.seed,
        completed: false,
        turns: s.turn,
        actions: steps,
      });
      continue;
    }
    completed++;
    turns += s.turn;
    endReasons[s.reason] = (endReasons[s.reason] ?? 0) + 1;
    const scores = s.players.map((_, p) => score(s, p));
    games.push({
      seed: s.seed,
      completed: true,
      turns: s.turn,
      winners: s.winners,
      scores,
      startingColors: s.players.map((p) => p.homeColor),
      technologiesUsed: s.players.map((p) => p.stats.invented),
      scoreBreakdowns: s.players.map((_, p) => points(s, p)),
    });
    s.players.forEach((x, p) => {
      const win = s.winners.includes(p) ? 1 / s.winners.length : 0,
        pts = scores[p];
      add((byStartingColor[x.homeColor!] ??= sample()), win, pts);
      add(
        (bySeat[String((p - s.first + s.players.length) % s.players.length)] ??=
          sample()),
        win,
        pts,
      );
      for (const [k, v] of Object.entries(points(s, p)))
        pointsBySource[k] = (pointsBySource[k] ?? 0) + v;
      for (const [k, v] of Object.entries(x.stats.actions))
        actions[k] = (actions[k] ?? 0) + v;
      for (const id of new Set([
        ...Object.keys(x.stats.invented),
        ...x.techs,
      ])) {
        const row = (tech[id] ??= {
          name: CARDS[id].techName,
          plays: 0,
          triggers: 0,
          holders: sample(),
        });
        row.plays += x.stats.invented[id] ?? 0;
        row.triggers += x.stats.triggers[id] ?? 0;
        add(row.holders, win, pts);
      }
      battles += x.stats.battles;
      battleWins += x.stats.battleWins;
      conquers += x.stats.conquerAttempts;
      conquerWins += x.stats.conquerWins;
    });
    progress?.(n + 1, opts.games);
  }
  return {
    schemaVersion: 1,
    rulesVersion: CONFIG.RULES_VERSION,
    policy:
      "heuristic-v1; public information only; home policy: " +
      (opts.homePolicy ?? "rotate"),
    requested: opts.games,
    completed,
    truncated,
    players: opts.players,
    seed: opts.seed,
    elapsedMs: Date.now() - started,
    meanTurns: completed ? turns / completed : 0,
    byStartingColor,
    bySeat,
    technologies: tech,
    pointsBySource,
    actions,
    endReasons,
    combat: {
      battles: battles / 2,
      battleWins,
      conquers,
      conquerWins,
      conquerSuccess: conquers ? conquerWins / conquers : 0,
    },
    games,
    limitations:
      "Descriptive bot results, not causal balance estimates. Tied winners receive fractional wins. Truncated games are excluded from win rates and score means. Starting-color samples rotate preferred colors across seeds and seats, falling back to dealt cards when unavailable. These are not perfectly randomized treatment groups. Technology holder win rates are conditional associations.",
  };
}
