// =============================================================================
// VERIFICATION HARNESS — replay and random-play fuzzing, for any game.
//
// These two tools only need a game to answer four questions (GameApi below).
// In exchange:
//
//   fuzz()   plays thousands of random-but-legal games, checking your
//            invariants after EVERY action. This is the cheapest bug-per-line
//            in the repo: it finds the wedges, the leaked components and the
//            "that effect can't happen after this one" crashes that no unit
//            test was ever going to reach. It is also the thing that proves a
//            new mechanic didn't break an old one.
//
//   replay() rebuilds a game exactly from a seed plus a list of actions. A
//            playtester's JSON dump becomes a reproducible bug report, and a
//            simulation result can be re-derived instead of trusted.
//
// replay() only works because the RNG lives inside the state (see rng.ts).
// =============================================================================

export interface GameApi<S, A> {
  /** Fresh game for this seed. Close over player setup / variant toggles. */
  create: (seed: number) => S;
  /** Mutates `s`; returns null on success or a rejection string. */
  apply: (s: S, a: A) => string | null;
  /** Every action legal right now, including answers to an open decision.
   *  Must be empty only when the game is over. */
  legal: (s: S) => A[];
  over: (s: S) => boolean;
}

export interface PlayOpts<S, A> {
  /** Cap on actions per game; tripping it is a wedge, and a test failure. */
  maxSteps?: number;
  /** Called after every accepted action. Throw to fail. */
  check?: (s: S, ctx: string) => void;
  /** Choose among legal actions. Defaults to uniformly at random. */
  choose?: (s: S, actions: A[], rnd: () => number) => A;
}

export interface PlayLog<S, A> {
  state: S;
  actions: A[];
  steps: number;
}

/** Play one game to the end, recording the actions taken. */
export function playOut<S, A>(
  api: GameApi<S, A>,
  s: S,
  rnd: () => number,
  opts: PlayOpts<S, A> = {},
  label = "game",
): PlayLog<S, A> {
  const maxSteps = opts.maxSteps ?? 5000;
  const choose =
    opts.choose ?? ((_s, acts, r) => acts[Math.floor(r() * acts.length)]);
  const actions: A[] = [];
  let steps = 0;

  while (!api.over(s)) {
    const legal = api.legal(s);
    if (legal.length === 0)
      throw new Error(
        `${label}: no legal action at step ${steps}, but the game is not over ` +
          `— either the game should have ended, or legalActions missed something`,
      );
    if (++steps > maxSteps)
      throw new Error(`${label}: did not terminate within ${maxSteps} actions`);
    const action = choose(s, legal, rnd);
    const err = api.apply(s, action);
    if (err)
      throw new Error(
        `${label} step ${steps}: legalActions offered an illegal action ` +
          `${JSON.stringify(action)} — rejected with "${err}"`,
      );
    actions.push(action);
    opts.check?.(s, `${label} step ${steps}`);
  }
  return { state: s, actions, steps };
}

export interface FuzzResult<S, A> {
  games: number;
  steps: number;
  /** Longest game seen, for spotting runaway loops. */
  maxSteps: number;
  /** The final state of the last game — handy in a failing test. */
  last?: PlayLog<S, A>;
}

/** Play `games` random-legal games from consecutive seeds, checking
 *  invariants throughout. Point this at every prototype. */
export function fuzz<S, A>(
  api: GameApi<S, A>,
  opts: PlayOpts<S, A> & { games?: number; seed?: number } = {},
): FuzzResult<S, A> {
  const games = opts.games ?? 50;
  const baseSeed = opts.seed ?? 1;
  let steps = 0;
  let maxSteps = 0;
  let last: PlayLog<S, A> | undefined;

  for (let g = 0; g < games; g++) {
    const seed = baseSeed + g;
    // The chooser's randomness is deliberately SEPARATE from the game's, so
    // fuzzing explores different lines without perturbing the deal.
    const rnd = looseRandom(seed * 2654435761);
    last = playOut(api, api.create(seed), rnd, opts, `seed ${seed}`);
    steps += last.steps;
    maxSteps = Math.max(maxSteps, last.steps);
  }
  return { games, steps, maxSteps, last };
}

/** Rebuild a game from a seed and the actions that were taken. Throws with
 *  the diverging step if the action list doesn't fit the game — which means
 *  either the rules changed since the log was recorded, or something outside
 *  the state (a stray Math.random) is feeding the engine. */
export function replay<S, A>(
  api: GameApi<S, A>,
  seed: number,
  actions: readonly A[],
): S {
  const s = api.create(seed);
  actions.forEach((a, i) => {
    const err = api.apply(s, a);
    if (err)
      throw new Error(
        `replay diverged at action ${i} (${JSON.stringify(a)}): ${err}`,
      );
  });
  return s;
}

/** Standalone PRNG for harness use only — never for game randomness, which
 *  must come from the state (rng.ts). */
export function looseRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
