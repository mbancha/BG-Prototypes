// =============================================================================
// ALL TUNABLE NUMBERS LIVE HERE. Nothing game-numeric is hardcoded elsewhere.
// This is the file you edit between playtests; the dev server hot-reloads it.
//
// TEMPLATE: replace these with your game's dials. Keep the discipline — one
// file of constants is what makes "make matches worth 2 instead of 1" a
// five-second change instead of a code hunt.
// =============================================================================

export const CONFIG = {
  // ---- players ----
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 4,

  // ---- hand / deck ----
  HAND_SIZE: 4, // drawn back up to this at the end of every turn
  DECK_SIZE: 40, // TODO: replace with your component list

  // ---- scoring ----
  POINTS_PER_NEIGHBOR: 1, // TODO: the placeholder rule — see engine.ts

  // ---- board limit (floating span; see cellWithinLimit below) ----
  BOARD_BASE: 4,
  BOARD_PER_PLAYER: 1, // 2p → 6×6 span
  BOARD_MIN: 2,
  BOARD_MAX: 20,

  // ---- undo ----
  MAX_UNDO_STEPS: 400,

  // ---- bots ----
  BOT_DELAY_MS: 350,

  // ---- simulation ----
  SIM_GAMES: 2000,
  SIM_SEED: 1234,
} as const;

/** Default column/row limit for a player count. */
export const defaultBoardSize = (players: number) =>
  CONFIG.BOARD_BASE + CONFIG.BOARD_PER_PLAYER * players;

// -----------------------------------------------------------------------------
// Floating board limit. There is no drawn board: pieces may be played until
// the LAYOUT SPANS the limit, measured against what is already on the table.
// Cells that could never be played behave like walls — useful if your game
// has any "surrounded / enclosed / sealed" rule. Delete if you don't need it.
// -----------------------------------------------------------------------------

export interface Cell {
  x: number;
  y: number;
}
export interface Extent {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export const cellKey = (c: Cell) => `${c.x},${c.y}`;

export const ORTHO: Cell[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

export function growExtent(e: Extent | undefined, c: Cell): Extent {
  if (!e) return { minX: c.x, maxX: c.x, minY: c.y, maxY: c.y };
  return {
    minX: Math.min(e.minX, c.x),
    maxX: Math.max(e.maxX, c.x),
    minY: Math.min(e.minY, c.y),
    maxY: Math.max(e.maxY, c.y),
  };
}

/** Could this cell ever be played without exceeding the limit? Monotone —
 *  the extent only grows, so a false answer is permanent. */
export function cellWithinLimit(
  e: Extent | undefined,
  limit: { w: number; h: number },
  c: Cell,
): boolean {
  if (!e) return true;
  const g = growExtent(e, c);
  return g.maxX - g.minX + 1 <= limit.w && g.maxY - g.minY + 1 <= limit.h;
}

/** Rectangle of cells still in reach (null before the first placement). */
export function playableEnvelope(
  e: Extent | undefined,
  limit: { w: number; h: number },
): Extent | null {
  if (!e) return null;
  return {
    minX: e.maxX - limit.w + 1,
    maxX: e.minX + limit.w - 1,
    minY: e.maxY - limit.h + 1,
    maxY: e.minY + limit.h - 1,
  };
}
