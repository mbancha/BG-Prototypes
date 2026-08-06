// =============================================================================
// Card database loader + display glyphs.
//
// cards.json stores each card's identity INCLUDING its two edge symbols
// (top/bottom — hand-picked per card to fit the card's name/flavor; the same
// symbol on both halves is allowed). The one field this module DERIVES at
// load time is the score value:
//   pts = SYMBOL_VP[top] + SYMBOL_VP[bottom]      (SYMBOL_VP in config.ts)
// So: to change a card's symbols, edit cards.json; to change what a symbol
// is worth, edit config.ts — pts follows automatically either way.
// =============================================================================

import { SYMBOL_VP } from "../data/config";
import rawCards from "../data/cards.json";
import type { CardDef, CType, Sym } from "./types";

/** Shape of a cards.json entry (pts is derived, so absent there). */
type RawCard = Omit<CardDef, "pts">;

export const CARDS: CardDef[] = ((rawCards as any).cards as RawCard[]).map(
  (raw) => ({
    ...raw,
    pts: SYMBOL_VP[raw.top] + SYMBOL_VP[raw.bottom],
  }),
);

const byId = new Map<number, CardDef>();
for (const c of CARDS) byId.set(c.id, c);

/** Look up a card definition by id (throws on unknown id — a data bug). */
export function def(id: number): CardDef {
  const d = byId.get(id);
  if (!d) throw new Error(`Unknown card id ${id}`);
  return d;
}

/** Is this card's effect benched via the `disabled` flag in cards.json? */
export function isDisabled(id: number): boolean {
  return !!def(id).disabled;
}

// ---------------------------------------------------------------------------
// Display glyphs. Pure presentation — changing these never affects rules.
// ---------------------------------------------------------------------------

export const TYPE_ICON: Record<CType, string> = {
  Assassin: "🗡",
  Enforcer: "🔨",
  Senator: "🏛",
  Broker: "💼",
  Hacker: "💻",
  Socialite: "🥂",
};

export const SYM_GLYPH: Record<Sym, string> = {
  muscle: "✊",
  intel: "👁",
  favor: "🤝",
  credit: "¤",
  whisper: "🎭",
};

export const SYM_NAME: Record<Sym, string> = {
  muscle: "Muscle",
  intel: "Intel",
  favor: "Favor",
  credit: "Credit",
  whisper: "Whisper",
};

/** Card-kind glyphs: ⚡ = Instant (one-shot on deploy), ⟳ = Ongoing (tableau). */
export const KIND_GLYPH: Record<CardDef["kind"], string> = {
  I: "⚡",
  O: "⟳",
};

export const KIND_NAME: Record<CardDef["kind"], string> = {
  I: "Instant",
  O: "Ongoing",
};
