import {
  CARDS,
  COLOR_ACTION,
  locationName,
  at,
  waypoints,
  type GameState,
  type Action,
} from "./engine";
export const FAMILY: Record<string, string> = {
  home: "Choose home",
  setupFleet: "Place Fleet I",
  setupCiv: "Place Civilization",
  finishSetup: "Finish deployment",
  beginTurn: "Begin turn",
  play: "Play action card",
  dual: "Dual action",
  wild: "Wild action",
  free: "One free action",
  rest: "Rest · draw 2",
  boost: "Add matching card",
  study: "Study",
  invent: "Invent",
  upgrade: "Upgrade Fleet",
  draw: "Draw a card",
  reveal: "Reveal",
  move: "Move",
  build: "Build Civilization",
  commerce: "Activate system",
  exploit: "Exploit",
  conquer: "Conquer planet",
  attack: "Attack",
  anomalyCiv: "Civilize anomaly",
  colony: "Move colony",
  sun: "Use ExpirationSun",
  endTurn: "End turn",
  choose: "Resolve choice",
};
export const wpLabel = (s: GameState, wp: string) =>
  at(s, wp)
    .map(
      (l) =>
        locationName(l) +
        " " +
        [
          "north",
          "upper-right",
          "lower-right",
          "south",
          "lower-left",
          "upper-left",
        ][waypoints(l).indexOf(wp)],
    )
    .join(" / ");
export function actionLabel(s: GameState, a: Action): string {
  if (a.a === "choose")
    return (
      s.pending?.options.find(
        (o) => JSON.stringify(o.action) === JSON.stringify(a),
      )?.label ?? "Resolve"
    ).replace(
      /(at |from |to )(-?\d+,-?\d+)/g,
      (_, prefix, wp) => prefix + wpLabel(s, wp),
    );
  const parts = [FAMILY[a.a] ?? a.a];
  if (a.card)
    parts.push(
      a.card === "r01"
        ? "0 card"
        : (a.a === "invent" ? CARDS[a.card].techName : CARDS[a.card].name) +
            " · " +
            (CARDS[a.card]?.rank ?? 0),
    );
  if (a.cards)
    parts.push(
      a.cards
        .map((id) => (id === "r01" ? "Zero card" : CARDS[id].name))
        .join(" + "),
    );
  if (a.location !== undefined) {
    const l = s.locations.find((l) => l.id === a.location);
    if (l) parts.push(locationName(l));
  }
  if (a.planets)
    parts.push("planets " + a.planets.map((i) => i + 1).join(", "));
  if (a.planet !== undefined) parts.push("planet " + (a.planet + 1));
  if (a.color) parts.push(COLOR_ACTION[a.color]);
  if (a.mode)
    parts.push(
      a.mode === "safe"
        ? "draw one safely"
        : a.mode === "push"
          ? "push your luck"
          : a.mode,
    );
  if (a.fleets) parts.push("selected fleets " + a.fleets.join(", "));
  if (a.fleet !== undefined && !a.fleets) {
    const fleet = s.fleets.find((f) => f.id === a.fleet);
    parts.push(
      fleet
        ? "Fleet " +
            (fleet.level === 2 ? "II" : "I") +
            " at " +
            wpLabel(s, fleet.wp)
        : "fleet " + a.fleet,
    );
  }
  if (a.to) parts.push("→ " + wpLabel(s, a.to));
  if (a.amount !== undefined)
    parts.push(
      a.a === "exploit"
        ? a.amount === 0
          ? "no flip"
          : "name " + a.amount
        : a.amount + " AP",
    );
  if (a.target !== undefined)
    parts.push(
      a.a === "colony"
        ? "→ " + locationName(s.locations.find((l) => l.id === a.target)!)
        : (s.players[a.target]?.name ?? "target " + a.target),
    );
  return parts.join(" · ");
}
export function instruction(s: GameState) {
  if (s.pending) return s.pending.title;
  if (s.over) return s.reason;
  if (s.phase === "home")
    return "Choose a system card from your hand as your home.";
  if (s.phase === "forces")
    return (
      "Place your starting Civs and fleets. " +
      s.setupBudget +
      " deployment points remain."
    );
  if (s.phase === "start")
    return "Begin your turn to check victory and resolve system benefits.";
  if (s.phase === "generate")
    return "Select an action card, use a wild or dual action, or take one free action.";
  return "Click a planet, fleet, or card to act. Highlighted pieces have available actions.";
}
