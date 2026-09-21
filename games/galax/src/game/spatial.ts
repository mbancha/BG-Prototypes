import { CARDS, type GameState, type Location, type Fleet } from "./model";
export function waypoints(l: Location): string[] {
  const x = l.x * 2,
    y = l.y * 2;
  return [
    `${x + 1},${y}`,
    `${x + 2},${y + 1}`,
    `${x + 2},${y + 3}`,
    `${x + 1},${y + 4}`,
    `${x},${y + 3}`,
    `${x},${y + 1}`,
  ];
}
export const at = (s: GameState, wp: string) =>
  s.locations.filter((l) => waypoints(l).includes(wp));
export const fleetsAt = (s: GameState, l: Location, p?: number) =>
  s.fleets.filter(
    (f) => (p === undefined || f.owner === p) && waypoints(l).includes(f.wp),
  );
export const civsAt = (l: Location, p: number) =>
  l.planets.flatMap((t) => t.civs).filter((c) => c.owner === p);
export const occupies = (s: GameState, l: Location, p: number) =>
  fleetsAt(s, l, p).length > 0 || civsAt(l, p).length > 0;
export const controls = (s: GameState, l: Location, p: number) =>
  fleetsAt(s, l, p).length > 0 && fleetsAt(s, l).every((f) => f.owner === p);
export const adjacent = (a: Location, b: Location) =>
  a.id !== b.id && waypoints(a).some((w) => waypoints(b).includes(w));
export function mapLayout(
  n: number,
): { x: number; y: number; faceUp?: boolean; home?: number }[] {
  if (n === 2)
    return [
      { x: 1, y: 0 },
      { x: 1, y: 2, faceUp: true },
      { x: 1, y: 4, faceUp: true },
      { x: 1, y: 6 },
      ...[0, 2].flatMap((x, i) => [
        { x, y: 1 },
        { x, y: 3, home: i },
        { x, y: 5 },
      ]),
    ];
  if (n === 3)
    return [
      { x: 0, y: 1 },
      { x: 0, y: 3, home: 0 },
      { x: 0, y: 5 },
      { x: 1, y: 0 },
      { x: 1, y: 2, faceUp: true },
      { x: 1, y: 4, faceUp: true },
      { x: 1, y: 6 },
      { x: 2, y: 1, home: 1 },
      { x: 2, y: 3, faceUp: true },
      { x: 2, y: 5, home: 2 },
      { x: 3, y: 2 },
      { x: 3, y: 4 },
    ];
  return [
    { x: 2, y: 0 },
    { x: 2, y: 2, faceUp: true },
    { x: 2, y: 4, faceUp: true },
    { x: 2, y: 6 },
    ...[1, 3].flatMap((x, i) => [
      { x, y: 1, home: i * 2 },
      { x, y: 3 },
      { x, y: 5, home: i * 2 + 1 },
    ]),
    ...[0, 4].flatMap((x) => [
      { x, y: 2 },
      { x, y: 4 },
    ]),
  ];
}
export function destinations(
  s: GameState,
  f: Fleet,
  ignoreNebula = false,
): string[] {
  const out = new Set<string>();
  const sources = at(s, f.wp);
  for (const l of sources) {
    if (l.faceUp && l.card && (ignoreNebula || CARDS[l.card].kind !== "nebula"))
      waypoints(l).forEach((w) => out.add(w));
    if (l.faceUp && l.card && CARDS[l.card].kind !== "system")
      for (const other of s.locations)
        if (
          other.faceUp &&
          other.card &&
          other.id !== l.id &&
          CARDS[other.card].kind !== "system" &&
          (CARDS[l.card].kind === "wormhole" ||
            CARDS[other.card].kind === "wormhole")
        )
          waypoints(other).forEach((w) => out.add(w));
  }
  return [...out].filter(
    (w) =>
      w !== f.wp && !s.fleets.some((x) => x.wp === w && x.owner !== f.owner),
  );
}
