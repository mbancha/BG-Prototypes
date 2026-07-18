// =============================================================================
// SPYPUNK — all tunable numbers live HERE. Edit freely between playtests.
// Nothing game-numeric is hardcoded elsewhere; the engine reads these constants.
// Card-specific numbers (costs, per-card effect magnitudes) live in
// src/data/cards.json next to the card that owns them.
//
// NOTE for editors (human or AI): a card's edge symbols and point value are
// NOT stored per card. They derive from the card's TYPE via TYPE_SYMBOLS and
// SYMBOL_VP below (see src/game/cards.ts, which applies them at load time).
// Changing a type's symbol pair here re-symbols all 10 cards of that type at
// once. See ARCHITECTURE.md for the full design rationale.
// =============================================================================

import type { CType, Sym } from "../game/types";

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
// cards.json). Rule of thumb: the disruptive symbols are worth more.
// -----------------------------------------------------------------------------
export const SYMBOL_VP: Record<Sym, number> = {
  credit: 1,
  intel: 1,
  favor: 1,
  whisper: 2,
  muscle: 3,
};

// -----------------------------------------------------------------------------
// Type → edge symbol pair. EVERY card of a type shows the same two symbols,
// top and bottom are always DIFFERENT, and each of the 6 types uses a distinct
// pair (6 of the 10 possible two-symbol combinations).
//
// Chosen to keep the pre-rework symbol ratio roughly intact
// (old half-slot counts: favor 34, intel 28, credit 22, whisper 20, muscle 16;
//  new: favor 30, intel 30, credit 20, whisper 20, muscle 20)
// and to be thematic:
//   Assassin  muscle+whisper  (violence from the shadows)      → 5 VP
//   Enforcer  muscle+favor    (force backed by loyalty)        → 4 VP
//   Hacker    intel+whisper   (data and covert access)         → 3 VP
//   Senator   favor+credit    (political favors, pork money)   → 2 VP
//   Broker    credit+intel    (money and market information)   → 2 VP
//   Socialite intel+favor     (knows everyone, trades favors)  → 2 VP
// -----------------------------------------------------------------------------
export const TYPE_SYMBOLS: Record<CType, { top: Sym; bottom: Sym }> = {
  Assassin: { top: "muscle", bottom: "whisper" },
  Enforcer: { top: "muscle", bottom: "favor" },
  Senator: { top: "favor", bottom: "credit" },
  Broker: { top: "credit", bottom: "intel" },
  Hacker: { top: "intel", bottom: "whisper" },
  Socialite: { top: "intel", bottom: "favor" },
};
