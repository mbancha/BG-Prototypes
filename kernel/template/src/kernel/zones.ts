// =============================================================================
// COMPONENTS AND ZONES — where every physical piece is, as plain data.
//
// A zone is a named, ORDERED list of piece ids. That single shape covers
// almost every container a board game has:
//
//   deck · discard · hand@2 · tableau@0 · market (the face-up row)
//   supply · bag · trick · reserve@1 · stack@fort3 · pile@a
//
// Per-player zones are the same thing with an owner suffix — `hand@2` is
// seat 2's hand — so the whole component census stays one flat, clonable
// object instead of state scattered across player records.
//
// Pieces are ids (number or string). Their immutable face data belongs in
// your data file (cards.json), keyed by id; only LOCATION lives here.
//
// This is the module that makes deck-building (draw → play → discard →
// reshuffle), market rows, trick-taking and worker supplies free.
// =============================================================================

import { shuffle, type RngState } from "./rng";

export type PieceId = number | string;
export type Zones = Record<string, PieceId[]>;

export interface HasZones {
  zones: Zones;
}

/** `zid("hand", 2)` → "hand@2"; `zid("deck")` → "deck". */
export const zid = (name: string, owner?: number): string =>
  owner === undefined ? name : `${name}@${owner}`;

export const zoneName = (id: string): string => id.split("@")[0];

export const zoneOwner = (id: string): number | undefined => {
  const i = id.indexOf("@");
  return i === -1 ? undefined : Number(id.slice(i + 1));
};

/** Build the starting zone map. Shared zones plus one per player per
 *  per-seat name: `newZones(4, ["deck","discard"], ["hand","tableau"])`. */
export function newZones(
  players: number,
  shared: string[] = [],
  perPlayer: string[] = [],
): Zones {
  const z: Zones = {};
  for (const n of shared) z[n] = [];
  for (const n of perPlayer)
    for (let p = 0; p < players; p++) z[zid(n, p)] = [];
  return z;
}

/** Zones are created on demand, so a game can invent `stack@fort3` mid-game. */
export const at = (z: Zones, id: string): PieceId[] => (z[id] ??= []);

export const count = (z: Zones, id: string): number => (z[id]?.length ?? 0);

export const has = (z: Zones, id: string, piece: PieceId): boolean =>
  (z[id]?.indexOf(piece) ?? -1) !== -1;

/** "Top" is the END of the array — push/pop is the cheap end, and it reads
 *  the way a deck does: the top card is the one you drew last. */
export const top = (z: Zones, id: string): PieceId | undefined =>
  z[id]?.[z[id].length - 1];

export const bottom = (z: Zones, id: string): PieceId | undefined => z[id]?.[0];

/** Which zone currently holds this piece? O(zones) — for assertions and
 *  "is that card still in anyone's hand?" checks, not for hot loops. */
export function locate(z: Zones, piece: PieceId): string | null {
  for (const id of Object.keys(z)) if (z[id].includes(piece)) return id;
  return null;
}

export type Where = "top" | "bottom" | number;

function insert(list: PieceId[], piece: PieceId, where: Where): void {
  if (where === "bottom") list.unshift(piece);
  else if (where === "top") list.push(piece);
  else list.splice(Math.max(0, Math.min(list.length, where)), 0, piece);
}

/** Put a piece into a zone from nowhere (setup, or a piece created in play). */
export const add = (
  z: Zones,
  id: string,
  piece: PieceId,
  where: Where = "top",
): void => insert(at(z, id), piece, where);

/** Take a specific piece out of a zone. Returns false if it wasn't there —
 *  callers should treat that as an illegal action, not a silent no-op. */
export function take(z: Zones, id: string, piece: PieceId): boolean {
  const list = z[id];
  if (!list) return false;
  const i = list.indexOf(piece);
  if (i === -1) return false;
  list.splice(i, 1);
  return true;
}

/** Move one known piece between zones — the single most common operation:
 *  play a card, discard it, place a worker, take a tile from the market. */
export function move(
  z: Zones,
  from: string,
  to: string,
  piece: PieceId,
  where: Where = "top",
): boolean {
  if (!take(z, from, piece)) return false;
  add(z, to, piece, where);
  return true;
}

export interface DrawOpts {
  /** Reshuffle this zone into the source when the source runs dry — the
   *  deck-building loop (discard → deck) and any "reshuffle the deck" rule. */
  reshuffleFrom?: string;
  /** Required with reshuffleFrom. Uses state RNG, so undo rewinds the shuffle. */
  rng?: RngState;
  /** Where the drawn pieces land in the destination. */
  where?: Where;
}

/** Draw up to `n` from the top of `from` into `to`. Returns what actually
 *  moved — SHORT DRAWS ARE NORMAL (empty deck, exhausted supply), so check
 *  the length rather than assuming you got `n`. */
export function draw(
  z: Zones,
  from: string,
  to: string,
  n = 1,
  opts: DrawOpts = {},
): PieceId[] {
  const out: PieceId[] = [];
  for (let i = 0; i < n; i++) {
    if (count(z, from) === 0 && opts.reshuffleFrom && opts.rng) {
      const pile = z[opts.reshuffleFrom];
      if (!pile || pile.length === 0) break;
      at(z, from).push(...shuffle(opts.rng, pile.splice(0, pile.length)));
    }
    const piece = z[from]?.pop();
    if (piece === undefined) break;
    insert(at(z, to), piece, opts.where ?? "top");
    out.push(piece);
  }
  return out;
}

/** Refill a hand (or a market row) up to a target size. Returns what arrived. */
export const drawTo = (
  z: Zones,
  from: string,
  to: string,
  size: number,
  opts: DrawOpts = {},
): PieceId[] => draw(z, from, to, Math.max(0, size - count(z, to)), opts);

/** Deal `each` pieces round-robin, the way a human deals: one at a time to
 *  every seat, so a short deck runs out fairly. */
export function deal(
  z: Zones,
  from: string,
  tos: string[],
  each: number,
  opts: DrawOpts = {},
): void {
  for (let i = 0; i < each; i++)
    for (const to of tos) draw(z, from, to, 1, opts);
}

export const shuffleZone = (z: Zones, id: string, rng: RngState): void => {
  if (z[id]) shuffle(rng, z[id]);
};

/** Slide the remaining cards along and refill the gap — the market-row
 *  behaviour in Through the Ages, Century, Small World, Res Arcana. */
export function refillRow(
  z: Zones,
  deck: string,
  row: string,
  size: number,
  opts: DrawOpts = {},
): PieceId[] {
  return drawTo(z, deck, row, size, { ...opts, where: "top" });
}

/** Every piece and where it is — one line for a conservation invariant:
 *  `expect(census(z).total).toBe(DECK_SIZE)` after every single action.
 *  Components going missing is the most common prototype bug there is. */
export function census(z: Zones): {
  total: number;
  byZone: Record<string, number>;
  duplicates: PieceId[];
} {
  const byZone: Record<string, number> = {};
  const seen = new Set<PieceId>();
  const duplicates: PieceId[] = [];
  let total = 0;
  for (const id of Object.keys(z)) {
    byZone[id] = z[id].length;
    total += z[id].length;
    for (const piece of z[id]) {
      if (seen.has(piece)) duplicates.push(piece);
      seen.add(piece);
    }
  }
  return { total, byZone, duplicates };
}
