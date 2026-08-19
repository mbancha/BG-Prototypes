// =============================================================================
// SEEDED RANDOMNESS THAT LIVES INSIDE THE STATE.
//
// Why in the state and not a `rnd` function passed around: the moment a game
// rolls dice, flips an event, or reshuffles mid-game, an external generator
// breaks three things at once —
//
//   • UNDO rewinds the board but not the generator, so redoing a turn deals
//     different cards. Bug reports stop reproducing.
//   • A snapshot is no longer a complete description of the game.
//   • Replaying an action log diverges from the game that produced it.
//
// Keeping the 32-bit accumulator in `state.rng` fixes all three: cloning the
// state clones the generator, so undo rewinds luck too. This is why dice
// games, random events and deck-building reshuffles work here at all.
//
// Algorithm is mulberry32 — same seed, same sequence, on any machine.
// =============================================================================

export interface RngState {
  /** The generator's whole memory. Plain number ⇒ structuredClone-safe. */
  s: number;
  /** How many numbers have been drawn. Handy when hunting a desync. */
  calls: number;
}

export interface HasRng {
  rng: RngState;
}

export const makeRng = (seed: number): RngState => ({
  s: seed >>> 0,
  calls: 0,
});

/** Next float in [0,1). Mutates `r` — that is the point. */
export function nextFloat(r: RngState): number {
  r.calls++;
  const a = (r.s = (r.s + 0x6d2b79f5) | 0);
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Integer in [0, n). */
export const nextInt = (r: RngState, n: number): number =>
  Math.floor(nextFloat(r) * n);

/** Integer in [lo, hi] inclusive. */
export const nextRange = (r: RngState, lo: number, hi: number): number =>
  lo + nextInt(r, hi - lo + 1);

export const chance = (r: RngState, p: number): boolean => nextFloat(r) < p;

/** One die. `roll(r, 6)` → 1..6. */
export const roll = (r: RngState, sides = 6): number => 1 + nextInt(r, sides);

/** Several dice at once — Yahtzee, combat, roll-and-write. */
export const rollMany = (r: RngState, count: number, sides = 6): number[] =>
  Array.from({ length: count }, () => roll(r, sides));

export function pick<T>(r: RngState, arr: readonly T[]): T {
  return arr[nextInt(r, arr.length)];
}

/** Weighted pick — event decks, loot tables, bot noise. */
export function pickWeighted<T>(
  r: RngState,
  arr: readonly T[],
  weight: (item: T) => number,
): T {
  const total = arr.reduce((sum, it) => sum + Math.max(0, weight(it)), 0);
  let x = nextFloat(r) * total;
  for (const it of arr) {
    x -= Math.max(0, weight(it));
    if (x < 0) return it;
  }
  return arr[arr.length - 1];
}

/** Fisher-Yates, in place. Returns the same array for chaining. */
export function shuffle<T>(r: RngState, arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = nextInt(r, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export const shuffled = <T>(r: RngState, arr: readonly T[]): T[] =>
  shuffle(r, [...arr]);

/** Adapter for code that wants a plain `() => number` (bots, third-party
 *  helpers). Still advances the state generator, so it stays reproducible. */
export const asFn =
  (r: RngState): (() => number) =>
  () =>
    nextFloat(r);
