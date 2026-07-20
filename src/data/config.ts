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

// =============================================================================
// COLOR-GROUPS MODE (the stripped-down core experiment; engine in
// src/color/engine.ts, screen in src/ui/ColorScreen.tsx). No card abilities,
// no money, no deploys: dominoes carry two COLORS, same-colored halves that
// touch form contiguous GROUPS, matching a side adds influence to the group,
// and a group scores only once its ENTIRE perimeter is sealed.
// Variants are chosen per game on the setup screen; numbers live here.
// =============================================================================

/** The five colors. key/hex/glyph are display; the names echo the classic
 *  symbols so the color-powers variant feels familiar. */
export const COLOR_DEFS = [
  { key: "red", name: "Muscle", hex: "#ff4d5e", glyph: "✊" },
  { key: "cyan", name: "Intel", hex: "#00e5ff", glyph: "👁" },
  { key: "green", name: "Favor", hex: "#b4ff39", glyph: "🤝" },
  { key: "gold", name: "Credit", hex: "#ffb020", glyph: "¤" },
  { key: "violet", name: "Whisper", hex: "#a78bfa", glyph: "🎭" },
] as const;

export const COLOR_CFG = {
  // deck: one tile per unordered color pair (all-different halves → 10 pairs)
  // × COPIES_PER_PAIR, plus the special tiles below when that variant is on
  COPIES_PER_PAIR: 3, // 10 pairs × 3 = 30 color tiles

  MATCH_INFLUENCE: 1, // influence added per half that joins an existing group

  // ---- scoring variants (setup-screen toggle picks one) ----
  GROUP_SCORE_FIXED: 4, // "FIXED": every group is worth this, regardless of size
  GROUP_SCORE_PER_TILE: 1, // "SIZE": group is worth (number of halves) × this

  // ---- bonus tiles variant: for EVERY color pair the deck gains one tile
  // per value below (so [1,2] → 10 one-point + 10 two-point tiles). Bonus
  // tiles are COLORED: their halves extend/merge groups exactly like normal
  // halves — but matching with them adds NO influence; instead each bonus
  // half adds its points to the value of the group it is part of when that
  // group scores.
  BONUS_TILE_VALUES: [1, 2],

  // ---- color powers variant: one qualitative rule per color (promptless).
  // Implemented in src/color/engine.ts; listed here for the tuner:
  //   red    Muscle  — your match REMOVES 1 influence from the group's
  //                    leading opponent instead of adding (adds if none)
  //   green  Favor   — your match adds 2 influence instead of 1
  //   gold   Credit  — the group scores +2 bonus points
  //   violet Whisper — your match spreads: instead of the violet group,
  //                    you add 1 influence to EACH group adjacent to it
  //   cyan   Intel   — when the group scores, the runner-up also scores
  //                    half value (rounded down)
  POWER_GREEN_ADD: 2,
  POWER_GOLD_BONUS: 2,
  POWER_VIOLET_SPREAD: 1, // influence added per adjacent group

  // ---- game end ----
  // Groups still open (not fully sealed) when the tiles run out score:
  // "none" (they die unscored — pressure to seal), "half" value, or "full".
  ENDGAME_OPEN_GROUPS: "none" as "none" | "half" | "full",
} as const;
