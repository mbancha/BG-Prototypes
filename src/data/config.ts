// =============================================================================
// SPYPUNK — all tunable numbers live HERE. Edit freely between playtests.
// Nothing game-numeric is hardcoded elsewhere; the engine reads these constants.
// Card-specific numbers (costs, points, per-card effect magnitudes) live in
// src/data/cards.json next to the card that owns them.
// =============================================================================

export const CONFIG = {
  // ---- players ----
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 4,

  // ---- setup ----
  STARTING_MONEY: 2, // $ each player starts with
  STARTING_HAND: 4, // cards dealt to each player
  INFLUENCE_SUPPLY: 15, // influence tokens per player (hard limit)

  // ---- hand ----
  HAND_REFILL: 4, // draw back up to this at end of turn (only if below)
  HAND_LIMIT: 6, // absolute hand ceiling (Insider Tip etc.)

  // ---- placement ----
  BASELINE_INFLUENCE: 1, // influence auto-added to your placed card

  // ---- symbol match base effects (per matched edge) ----
  MUSCLE_REMOVE: 1, // influence removed per Muscle match
  INTEL_ADD: 1, // influence added to neighbor per Intel match
  FAVOR_ADD: 1, // influence added to placed card per Favor match
  CREDIT_GAIN: 1, // $ gained per Credit match
  WHISPER_MOVE: 1, // influence moved per Whisper match

  // ---- scoring ----
  TIE_DIVISOR: 2, // tied players score value / TIE_DIVISOR, rounded down

  // ---- game end ----
  FINAL_TURNS_PER_PLAYER: 2, // turns each player gets once the deck is empty

  // ---- undo ----
  MAX_UNDO_STEPS: 600, // history snapshots kept (each dispatch = 1 step)
} as const;

export type Config = typeof CONFIG;
