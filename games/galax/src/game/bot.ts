import {
  CARDS,
  seatOnClock,
  legalActions,
  research,
  supply,
  has,
  controls,
  occupies,
  civsAt,
  fleetsAt,
  at,
  waypoints,
  power,
  type GameState,
  type Action,
} from "./engine";
import { playerView } from "./views";
export const isBotTurn = (s: GameState) =>
  !s.over && s.players[seatOnClock(s)].isBot;
function noise(s: GameState, a: Action) {
  let n = (s.turn * 181 + s.serial * 17) | 0;
  for (const c of JSON.stringify(a))
    n = Math.imul(n ^ c.charCodeAt(0), 16777619);
  return ((n >>> 0) % 1000) / 1000;
}
export function actionUtility(s: GameState, a: Action) {
  const p = seatOnClock(s),
    x = s.players[p],
    l = s.locations.find((l) => l.id === a.location),
    c = CARDS[a.card ?? ""],
    f = s.fleets.find((f) => f.id === a.fleet);
  let u = 0;
  const moveValue = (to: string, from?: string) => {
    const target = at(s, to);
    let value = target.reduce(
      (n, l) =>
        n +
        (!l.faceUp ? 3 : !occupies(s, l, p) ? 2 : 0) +
        (l.faceUp &&
        l.card &&
        CARDS[l.card].kind === "system" &&
        !civsAt(l, p).length
          ? 2
          : 0),
      0,
    );
    const old = from ? at(s, from) : [];
    value -= old.reduce((n, l) => n + (!l.faceUp ? 2 : 0), 0);
    return value - (x.flags["visited:" + to] ?? 0) * 5;
  };
  switch (a.a) {
    case "home":
      u = 5 + (c?.color === "Blue" ? 2 : 0) + (c?.planets.length ?? 0) * 0.2;
      break;
    case "setupCiv": {
      const home = s.locations.find((l) => l.id === s.homeChosen)!;
      u = civsAt(home, p).length ? 0 : 20;
      break;
    }
    case "setupFleet":
      u = 10 + at(s, a.to!).length;
      break;
    case "finishSetup":
      u = s.setupBudget > 0 ? -20 : 10;
      break;
    case "beginTurn":
      u = 10;
      break;
    case "rest":
      u = x.hand.length < 3 ? 7 : -3;
      break;
    case "free":
      u = -2 + (a.color === "Blue" && research(s, p) < 4 ? 2 : 0);
      break;
    case "play":
    case "dual":
    case "wild": {
      const color = a.color ?? c?.color,
        rank = a.a === "wild" ? 2 : (c?.rank ?? 1);
      const own = s.locations.filter((l) => occupies(s, l, p) && l.faceUp);
      const potential =
        color === "Blue"
          ? (research(s, p) < 12 ? 1.6 : 0.1) +
            (x.hand.some(
              (id) =>
                id !== a.card &&
                CARDS[id].kind === "system" &&
                CARDS[id].rank <= research(s, p),
            )
              ? 2
              : 0)
          : color === "Yellow"
            ? supply(s, p) > 0 &&
              own.some((l) => l.planets.some((t) => !t.civs.length))
              ? 2
              : 1
            : color === "Green"
              ? s.locations.some((l) => !l.faceUp && fleetsAt(s, l, p).length)
                ? 3
                : 1.1
              : own.some(
                    (l) =>
                      fleetsAt(s, l, p).length &&
                      l.planets.some((t) => !t.civs.length),
                  )
                ? 2
                : 0.8;
      u =
        rank * potential -
        (c?.techType === "Technology" && research(s, p) >= c.rank ? 1.5 : 0);
      if (a.a === "wild" || a.a === "dual") u -= 1;
      break;
    }
    case "boost":
      u = -3;
      break;
    case "study":
      u = research(s, p) < 4 ? 7 : research(s, p) < 10 ? 4 : 2;
      break;
    case "invent":
      u = c?.techType === "Technology" ? 7 : 4;
      break;
    case "draw":
      u = x.hand.length < 5 ? 4 : 0;
      break;
    case "reveal":
      u = 12;
      break;
    case "upgrade":
      u = 5;
      break;
    case "build":
      u = 12 + (l && !civsAt(l, p).length ? 8 : 0) + (a.planets?.length ?? 1);
      break;
    case "anomalyCiv":
      u = 18;
      break;
    case "commerce":
      u =
        a.mode === "fleet"
          ? supply(s, p) > 0
            ? 7
            : 0
          : a.mode === "research"
            ? research(s, p) < 12
              ? 5
              : 0
            : x.hand.length < 5
              ? 5
              : 0;
      break;
    case "conquer":
      u = 8 + (l && !civsAt(l, p).length ? 5 : 0) - (c?.rank ?? 0) * 0.8;
      break;
    case "exploit":
      u =
        3 +
        (a.amount === 0 && x.hand.length < 6 ? 3 : a.amount === 2 ? 2 : 0) +
        (l?.planets[a.planet!].resource !== "none" ? 3 : 0);
      break;
    case "attack":
      u = l ? power(s, p, l, true) - power(s, a.target!, l, true) + 3 : 0;
      break;
    case "move":
      u =
        moveValue(a.to!, a.from) +
        1 -
        (s.players[p].stats.actions.move ?? 0) * 0.005;
      if (a.amount === 0) u -= 1;
      break;
    case "colony":
      u = 9;
      break;
    case "sun":
      u = -5;
      break;
    case "endTurn":
      u = -1;
      break;
    case "choose": {
      u = 3;
      const kind = s.pending?.task.kind;
      if (a.mode === "skip") return -5;
      if (a.to) u += moveValue(a.to, f?.wp ?? s.pending?.task.card);
      if (a.location !== undefined && l) u += !civsAt(l, p).length ? 2 : 0;
      if (a.fleet !== undefined && f) {
        u += f.owner === p ? 2 : 3;
        if (kind === "casualty") u -= f.level * 2;
        if (kind === "nano") u += 2;
      }
      if (a.cards) {
        u = a.cards.reduce((n, id) => n + (CARDS[id]?.rank ?? 0), 0);
        if (kind === "overrideResponse") u = 2;
        if (kind === "commit") {
          const b = s.battle!,
            loc = s.locations.find((l) => l.id === b.location)!;
          const opp = b.attacker === p ? b.defender : b.attacker;
          const needed = power(s, opp, loc, true) - power(s, p, loc, true) + 3;
          u = -Math.abs(u - needed);
        }
      }
      if (a.amount !== undefined) u += a.amount === 2 ? 2 : 0;
      if (kind === "psy") u = a.amount ? 1 : 0;
      if (a.mode === "store") u += 2;
      if (a.mode === "cash") u += x.techTokens;
      break;
    }
  }
  return u + noise(s, a) * 0.6;
}
export function decideFromView(view: GameState, actions: Action[]): Action {
  if (!actions.length) throw Error("Bot has no legal action");
  let best = actions[0],
    max = -Infinity;
  for (const a of actions) {
    const score = actionUtility(view, a);
    if (score > max) {
      max = score;
      best = a;
    }
  }
  return best;
}
export function botDecide(s: GameState): Action {
  return decideFromView(playerView(s, seatOnClock(s)), legalActions(s));
}
