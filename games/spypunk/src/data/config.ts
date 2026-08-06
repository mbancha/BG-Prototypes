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

  // ---- board limit (classic mode) ----
  // Same floating rule as color mode: cards may be placed until the layout
  // spans this many columns/rows. Classic's 60-card deck needs up to ~120
  // cells, so the default is generous enough that it rarely binds — shrink
  // it on the setup screen to make space itself a constraint.
  BOARD_BASE: 8,
  BOARD_PER_PLAYER: 2, // 2p → 12×12, 3p → 14×14, 4p → 16×16
  BOARD_MIN: 2, // a domino is 2 cells long, so 2 is the smallest sane span
  BOARD_MAX: 30,

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

  // ---- board limit (settable per game on the setup screen) ----
  // There is no drawn board: tiles may be played anywhere until the layout
  // SPANS this many columns / rows, after which nothing may extend it
  // further. The limit floats — it is measured from the tiles actually on
  // the table, so the first tile pins nothing. Default edge length =
  // BOARD_BASE + BOARD_PER_PLAYER × players (2p → 6×6, 4p → 8×8).
  // Cells that could never be played (they would push the layout past the
  // limit) count as sealed, so a group at the edge of the span closes with
  // fewer tiles. The game ends as soon as no legal placement is left.
  BOARD_BASE: 4,
  BOARD_PER_PLAYER: 1,
  BOARD_MIN: 2, // a domino is 2 cells long, so 2 is the smallest sane span
  BOARD_MAX: 16,

  // ---- simulation mode ----
  SIM_GAMES: 10000, // default number of headless games per run
  SIM_SEED: 12345, // base seed (run N uses SIM_SEED + N) — runs are repeatable

  // ---- scoring variants (setup-screen toggle picks one) ----
  GROUP_SCORE_FIXED: 4, // "FIXED": every group is worth this, regardless of size
  GROUP_SCORE_PER_TILE: 1, // "SIZE": group is worth (number of halves) × this

  // ---- bonus tiles variant: colored tiles that carry bonus points on ONE
  // half. They match/extend/merge groups exactly like normal tiles AND add
  // the normal +1 influence when they match; the bonus half additionally
  // adds its points to the value of the group that half belongs to when the
  // group scores. Deck (kept color-balanced — see newColorGame):
  //   • +1 tiles: for every color pair, two tiles, one with the +1 bonus on
  //     each color (the other half is the OTHER color) → 20 tiles
  //   • +2 tiles: for every color, one tile whose two halves are the SAME
  //     color, +2 on one of them → 5 tiles
  BONUS_PLUS1: 1, // points on the one-different-color bonus tiles
  BONUS_PLUS2: 2, // points on the same-color bonus tiles

  // ---- color powers variant: one qualitative rule per color. A matching
  // placement ALWAYS gives the normal +1 influence to the matched group
  // first; the power then applies ON TOP. Implemented in
  // src/color/engine.ts; listed here for the tuner:
  //   red    Muscle  — also remove 1 influence (your choice) from a color
  //                    group ADJACENT to the matched red group
  //   green  Favor   — also add 1 more influence to the green group (net +2)
  //   gold   Credit  — the group scores +2 bonus points
  //   violet Whisper — also add 1 influence to EACH group adjacent to the
  //                    matched violet group (the violet group still got +1)
  //   cyan   Intel   — when the group scores, the runner-up also scores
  //                    half value (rounded down)
  POWER_GREEN_EXTRA: 1, // extra influence on top of the base +1 (→ net 2)
  POWER_GOLD_BONUS: 2,
  POWER_VIOLET_SPREAD: 1, // influence added per adjacent group
  POWER_RED_REMOVE: 1, // influence removed from a chosen adjacent group

  // ---- game end ----
  // Groups still open (not fully sealed) when the game ends (board full, no
  // legal placement, or tiles exhausted) score: "none" (they die unscored —
  // pressure to seal), "half" value, or "full".
  ENDGAME_OPEN_GROUPS: "none" as "none" | "half" | "full",
} as const;

/** Default column/row limit for color mode (2p → 6, 4p → 8). */
export const defaultBoardSize = (players: number) =>
  COLOR_CFG.BOARD_BASE + COLOR_CFG.BOARD_PER_PLAYER * players;

/** Default column/row limit for classic mode (2p → 12, 4p → 16). */
export const defaultClassicBoardSize = (players: number) =>
  CONFIG.BOARD_BASE + CONFIG.BOARD_PER_PLAYER * players;

// -----------------------------------------------------------------------------
// Shared "floating extent" geometry, used by BOTH engines.
//
// There is no fixed board: the limit is measured against the bounding box of
// whatever is already on the table. A cell may be played only if including it
// keeps the span within the limit — so the playable region slides around
// until the layout grows into it, then locks.
// -----------------------------------------------------------------------------

export interface Extent {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** Grow an extent to include a cell (or start one). */
export function growExtent(
  e: Extent | undefined,
  c: { x: number; y: number },
): Extent {
  if (!e) return { minX: c.x, maxX: c.x, minY: c.y, maxY: c.y };
  return {
    minX: Math.min(e.minX, c.x),
    maxX: Math.max(e.maxX, c.x),
    minY: Math.min(e.minY, c.y),
    maxY: Math.max(e.maxY, c.y),
  };
}

/** Could this cell ever be played without exceeding the limit? Nothing is
 *  placed yet ⇒ anywhere. Monotone: the extent only grows, so a cell that
 *  fails here can never become legal again (which is what lets sealing
 *  treat it as a wall). */
export function cellWithinLimit(
  e: Extent | undefined,
  limit: { w: number; h: number },
  c: { x: number; y: number },
): boolean {
  if (!e) return true;
  const g = growExtent(e, c);
  return g.maxX - g.minX + 1 <= limit.w && g.maxY - g.minY + 1 <= limit.h;
}

/** The rectangle of cells still playable right now (null before the first
 *  placement). Drawn in the UI so players can see the remaining room. */
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
