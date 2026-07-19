// =============================================================================
// SPYPUNK — all tunable numbers live HERE. Edit freely between playtests.
// Nothing game-numeric is hardcoded elsewhere; the engine reads these constants.
// Card-specific data (costs, per-card effect magnitudes, and each card's two
// edge symbols) lives in src/data/cards.json next to the card that owns it.
//
// NOTE for editors (human or AI): a card's POINT VALUE is not stored anywhere.
// It derives from the card's two symbols via SYMBOL_VP below
// (src/game/cards.ts applies it at load time): change a symbol's worth here,
// or a card's symbols in cards.json, and pts follows automatically.
// =============================================================================

import type { Sym } from "../game/types";

export const CONFIG = {
  // ---- players ----
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 4,

  // ---- setup ----
  STARTING_MONEY: 2, // $ each player starts with
  STARTING_HAND: 5, // cards dealt to each player (= the refill target)
  INFLUENCE_SUPPLY: 15, // influence tokens per player (hard limit)

  // ---- hand ----
  // Rule: at the END of every turn you always draw back up to HAND_REFILL.
  HAND_REFILL: 5, // "hand size" — draw up to this at end of turn
  HAND_LIMIT: 6, // absolute ceiling for mid-turn draws (Insider Tip etc.)

  // ---- placement ----
  BASELINE_INFLUENCE: 1, // influence auto-added to your placed card

  // ---- symbol match base effects (per matched edge) ----
  MUSCLE_REMOVE: 1, // influence removed per Muscle match
  INTEL_ADD: 1, // influence added to neighbor per Intel match
  FAVOR_ADD: 1, // influence added to placed card per Favor match
  CREDIT_GAIN: 1, // $ gained per Credit match
  WHISPER_MOVE: 1, // influence moved per Whisper match

  // Rule: if BOTH halves of your placed domino match at least one neighbor
  // each, you gain this $ once (on top of the matches themselves).
  DOUBLE_MATCH_BONUS: 1,

  // ---- scoring ----
  TIE_DIVISOR: 2, // tied players score value / TIE_DIVISOR, rounded down

  // ---- game end ----
  FINAL_TURNS_PER_PLAYER: 2, // turns each player gets once the deck is empty

  // ---- undo ----
  MAX_UNDO_STEPS: 600, // history snapshots kept (each dispatch = 1 step)

  // ---- bots ----
  BOT_DEPLOY_CHANCE: 0.4, // odds a bot tries to deploy before placing
  BOT_DELAY_MS: 400, // pause between automated bot actions (watchability)
} as const;

export type Config = typeof CONFIG;

// -----------------------------------------------------------------------------
// Symbol → point value. A card is worth SYMBOL_VP[top] + SYMBOL_VP[bottom]
// when scored (computed in src/game/cards.ts; there is no pts field in
// cards.json). Symbols themselves are per-card in cards.json, hand-picked to
// fit each card's name; duplicates (favor/favor…) are allowed. Rule of
// thumb: the disruptive symbols are worth more, so e.g. a muscle/whisper
// Assassin scores 5 while a favor/favor Senator scores 2.
// -----------------------------------------------------------------------------
export const SYMBOL_VP: Record<Sym, number> = {
  credit: 1,
  intel: 1,
  favor: 1,
  whisper: 2,
  muscle: 3,
};
