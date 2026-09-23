import {
  CARDS,
  COLOR_ACTION,
  locationName,
  type Action,
  type GameState,
} from "./engine";
import { FAMILY, actionLabel, wpLabel } from "./presentation";

export const actionKey = (a: Action) => JSON.stringify(a);
export const valueKey = (value: unknown) => JSON.stringify(value) ?? "none";
export function actionLocation(s: GameState, a: Action) {
  return a.a === "colony"
    ? a.target
    : (a.location ?? (a.a === "setupCiv" ? s.homeChosen : undefined));
}
export function cardActions(actions: Action[], id: string) {
  return actions.filter((a) => a.card === id || a.cards?.includes(id));
}
export function waypointActions(s: GameState, actions: Action[], wp: string) {
  return actions.filter(
    (a) =>
      a.from === wp ||
      (!a.from &&
        (a.to === wp ||
          s.fleets.some(
            (f) =>
              (f.id === a.fleet || a.fleets?.includes(f.id)) && f.wp === wp,
          ))),
  );
}
export function planetActions(
  s: GameState,
  actions: Action[],
  location: number,
  planet: number,
) {
  return actions.filter(
    (a) =>
      actionLocation(s, a) === location &&
      (a.planet === planet || a.planets?.includes(planet)),
  );
}
export interface DecisionGroup {
  value: unknown;
  label: string;
  actions: Action[];
  image?: string;
  hint?: string;
}
const titles: Record<string, string> = {
  a: "What would you like to do?",
  mode: "Choose how to resolve it",
  color: "Choose an action color",
  from: "Choose the starting fleet group",
  location: "Choose a system on the map",
  planet: "Choose a planet",
  fleets: "Choose one or two fleets",
  fleet: "Choose a fleet",
  planets: "Choose the planets to build on",
  card: "Choose a card",
  cards: "Choose your cards",
  target: "Choose an empire",
  amount: "Choose an amount",
  to: "Choose a destination on the map",
};
export function describeValue(
  s: GameState,
  key: string,
  value: any,
  action?: Action,
): { label: string; image?: string; hint?: string } {
  if (value === undefined)
    return { label: key === "mode" ? "Continue" : "No selection" };
  if (key === "a") return { label: FAMILY[value] ?? value };
  if (key === "color")
    return { label: COLOR_ACTION[value as keyof typeof COLOR_ACTION] };
  if (key === "card" || key === "cards") {
    const ids: string[] = key === "card" ? [value] : value;
    return {
      label: ids.length
        ? ids
            .map((id) => (id === "r01" ? "Zero card" : CARDS[id].name))
            .join(" + ")
        : "No cards",
      image: ids.length === 1 ? ids[0] : undefined,
    };
  }
  if (key === "location") {
    const l = s.locations.find((l) => l.id === value)!;
    return {
      label: locationName(l),
      image: l.faceUp ? (l.card ?? undefined) : "back-0",
    };
  }
  if (key === "planet" || key === "planets")
    return {
      label:
        "Planet" +
        (key === "planets"
          ? "s " + value.map((n: number) => n + 1).join(", ")
          : " " + (value + 1)),
    };
  if (key === "fleet" || key === "fleets") {
    const ids: number[] = key === "fleet" ? [value] : value;
    return {
      label: ids
        .map((id) => {
          const f = s.fleets.find((f) => f.id === id)!;
          return (
            (f.sun ? "Sun" : "Fleet " + (f.level === 2 ? "II" : "I")) +
            " #" +
            id
          );
        })
        .join(" + "),
    };
  }
  if (key === "from" || key === "to")
    return { label: wpLabel(s, value) || "New system position " + value };
  if (key === "target" && action?.a === "colony") {
    const location = s.locations.find((l) => l.id === value)!;
    return { label: locationName(location), image: location.card ?? undefined };
  }
  if (key === "target")
    return { label: s.players[value]?.name ?? "Target " + value };
  if (key === "mode")
    return {
      label:
        (
          {
            safe: "Draw 1 card — guaranteed",
            push: "Push for specialty resources",
            cards: "Draw cards",
            fleet: "Build or upgrade fleets",
            research: "Gain Research",
            skip: "Skip this effect",
            store: "Store a token",
            cash: "Cash in tokens",
            destroy: "Discard",
            allow: "Allow the move",
            blocked: "Resolve blocked retreat",
          } as Record<string, string>
        )[value] ?? value,
    };
  return { label: String(value) };
}
/** Partition only legal actions. Presentation never synthesizes or validates game rules. */
export function decisionStep(s: GameState, actions: Action[]) {
  if (actions.length <= 1) return null;
  const keys = [
    "a",
    "mode",
    "color",
    "from",
    "location",
    "planet",
    "fleets",
    "fleet",
    "planets",
    "card",
    "cards",
    "target",
    "to",
    "amount",
  ] as const;
  for (const key of keys) {
    const groups = new Map<string, DecisionGroup>();
    for (const a of actions) {
      const value = a[key],
        id = valueKey(value);
      if (!groups.has(id))
        groups.set(id, {
          value,
          ...describeValue(s, key, value, a),
          actions: [],
        });
      groups.get(id)!.actions.push(a);
    }
    if (groups.size > 1)
      return {
        key,
        title:
          key === "target" && actions[0].a === "colony"
            ? "Choose the destination system"
            : titles[key],
        groups: [...groups.values()],
      };
  }
  return null;
}
export function actionPreview(s: GameState, a: Action) {
  if (a.mode === "skip") return "Skip this optional effect and continue.";
  if (a.a === "invent")
    return (
      CARDS[a.card!].techText +
      (CARDS[a.card!].techType === "Discovery"
        ? " Also gain 1 trophy for this Discovery."
        : "")
    );
  if (a.a === "exploit" || s.pending?.task.kind === "freeExploit") {
    const planet = s.locations.find((l) => l.id === a.location)?.planets[
      a.planet!
    ];
    const marking = planet?.civs.length
      ? "The enemy Civ stays in place and grants the enemy-Civ trophy reward."
      : "Mark this empty planet −1 even on a failed flip. A successful last empty planet earns one trophy.";
    return (
      (a.amount === 0
        ? "Draw one card without a flip. "
        : `Name ${a.amount}. The flipped rank must be strictly higher. Success grants ${a.amount} of this planet’s specialty resource. `) +
      marking
    );
  }
  if (a.a === "build") {
    return "Build on the selected planets. Each costs 2 Commerce AP, or 1 with a −1 marker, before modifiers. If your supply runs out, gain 1 trophy for each remaining build instead; its marker is still consumed.";
  }
  if (a.a === "conquer")
    return "Your system fleet power plus the selected card faces a random deck card. A tie succeeds. Success converts the selected fleet into a Civ and replaces enemy Civs.";
  if (a.a === "move" || s.pending?.task.kind === "freeMove")
    return `Move ${a.fleets?.length ?? 1} selected fleet${(a.fleets?.length ?? 1) > 1 ? "s" : ""} to the highlighted destination. Other fleets stay in place.`;
  if (a.a === "endTurn")
    return "Draw one card (hand limit 8), then pass to the next empire.";
  return actionLabel(s, a);
}
