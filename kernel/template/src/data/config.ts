// =============================================================================
// ALL TUNABLE NUMBERS LIVE HERE. Nothing game-numeric is hardcoded elsewhere.
// This is the file you edit between playtests; the dev server hot-reloads it.
//
// TEMPLATE: replace these with your game's dials. Keep the discipline — one
// file of constants is what makes "make matches worth 2 instead of 1" a
// five-second change instead of a code hunt.
//
// Board GEOMETRY (grids, hexes, maps, tracks, extents) is not a tunable
// number and lives in src/kernel/board.ts.
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

  // ---- the placeholder decision (proves the prompt seam works) ----
  BONUS_AT_NEIGHBORS: 2, // touching this many pieces offers a choice
  BONUS_POINTS: 1, // …take this many extra points
  BONUS_DRAW: 1, // …or draw this many extra tiles

  // ---- board limit (floating span; see kernel/board.ts) ----
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
