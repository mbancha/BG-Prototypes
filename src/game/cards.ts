// =============================================================================
// Card database loader + display glyphs.
//
// cards.json stores only what is unique per card (name, type, cost, kind,
// rules text, effect spec, disabled flag). This module fills in the fields
// that are DERIVED from the card's type at load time:
//   top / bottom  ← TYPE_SYMBOLS[type]   (every card of a type has the same
//                                          two, always-different edge symbols)
//   pts           ← SYMBOL_VP[top] + SYMBOL_VP[bottom]
// So to retune symbols or point values, edit src/data/config.ts — never
// cards.json. See ARCHITECTURE.md § "Symbols & scoring".
// =============================================================================

import { SYMBOL_VP, TYPE_SYMBOLS } from "../data/config";
import rawCards from "../data/cards.json";
import type { CardDef, CType, Sym } from "./types";

/** Shape of a cards.json entry (derived fields absent). */
type RawCard = Omit<CardDef, "top" | "bottom" | "pts">;

export const CARDS: CardDef[] = ((rawCards as any).cards as RawCard[]).map(
  (raw) => {
    const pair = TYPE_SYMBOLS[raw.type];
    return {
      ...raw,
      top: pair.top,
      bottom: pair.bottom,
      pts: SYMBOL_VP[pair.top] + SYMBOL_VP[pair.bottom],
    };
  },
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
