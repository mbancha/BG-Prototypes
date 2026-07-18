import rawCards from "../data/cards.json";
import type { CardDef, CType, Sym } from "./types";

export const CARDS: CardDef[] = (rawCards as any).cards as CardDef[];

const byId = new Map<number, CardDef>();
for (const c of CARDS) byId.set(c.id, c);

export function def(id: number): CardDef {
  const d = byId.get(id);
  if (!d) throw new Error(`Unknown card id ${id}`);
  return d;
}

/** Is this card's effect benched via the `disabled` flag in cards.json? */
export function isDisabled(id: number): boolean {
  return !!def(id).disabled;
}

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
