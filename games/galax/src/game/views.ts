import type { GameState } from "./model";
/** Local hotseat privacy, not a network security boundary. No deck order, seed or foreign hand crosses this seam. */
export function playerView(
  s: GameState,
  seat: number | null,
): GameState & { handCounts: number[]; deckCount: number } {
  const v = structuredClone(s) as GameState & {
    handCounts: number[];
    deckCount: number;
  };
  v.handCounts = s.players.map((p) => p.hand.length);
  v.deckCount = s.deck.length;
  delete (v as Partial<GameState>).rng;
  delete (v as Partial<GameState>).seed;
  v.setup = [];
  v.deck = [];
  v.queue = [];
  v.players.forEach((p, i) => {
    if (i !== seat) p.hand = [];
  });
  v.locations.forEach((l) => {
    if (!l.faceUp) {
      l.card = null;
      l.planets = [];
    }
  });
  if (v.pending?.who !== seat) v.pending = null;
  if (v.battle) {
    v.battle.committed = Object.fromEntries(
      Object.entries(v.battle.committed).filter(([p]) => Number(p) === seat),
    );
  }
  return v;
}
export const publicView = (s: GameState) => playerView(s, null);
