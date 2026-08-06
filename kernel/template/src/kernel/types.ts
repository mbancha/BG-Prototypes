// =============================================================================
// Shared vocabulary for the kernel modules. Deliberately tiny — the kernel is
// a toolbox, not a framework, and nothing here knows about your game.
//
// Dependency rules (so you can delete what you don't use):
//   types.ts    ← imported by everything, imports nothing
//   rng.ts      ← imported by zones.ts (shuffling); otherwise standalone
//   everything else is standalone: flow, decide, board, outcome, harness
// =============================================================================

/** A player is always referred to by seat index, never by object identity. */
export type Seat = number;

export interface LogEntry {
  /** Turn counter at the time — whatever your game counts as a turn. */
  turn: number;
  /** Seat this line is about, or null for game-level lines. */
  p: Seat | null;
  msg: string;
}

export interface HasLog {
  log: LogEntry[];
}

/** Append to the log. Games usually wrap this with their own turn source:
 *  `const log = (s, p, msg) => pushLog(s, s.flow.turn, p, msg)`. */
export function pushLog(
  s: HasLog,
  turn: number,
  p: Seat | null,
  msg: string,
): void {
  s.log.push({ turn, p, msg });
}

/** Format a log for a JSON dump / bug report. */
export const formatLog = (s: HasLog, names: string[]): string[] =>
  s.log.map(
    (l) => `[T${l.turn}] ${l.p !== null ? names[l.p] + " " : ""}${l.msg}`,
  );
