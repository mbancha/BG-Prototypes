import { CONFIG } from "../data/config";
import { makeRng, shuffle, nextInt } from "../kernel/rng";
import {
  CARDS,
  COLORS,
  emptyPools,
  type Color,
  type GameState,
  type Seat,
  type Action,
  type Location,
  type Fleet,
  type Task,
  type Choice,
} from "./model";
import {
  waypoints,
  at,
  fleetsAt,
  civsAt,
  occupies,
  controls,
  adjacent,
  destinations,
  mapLayout,
} from "./spatial";
export * from "./model";
export * from "./spatial";
export const has = (s: GameState, p: number, id: string) =>
  s.players[p].techs.includes(id);
export const locationName = (l: Location) =>
  l.faceUp && l.card ? CARDS[l.card].name : "Unexplored " + (l.id + 1);
const record = (s: GameState, msg: string) => {
  s.log.push({ turn: s.turn, msg });
  if (s.log.length > 100) s.log.shift();
};
const trigger = (s: GameState, p: number, id: string) => {
  s.players[p].stats.triggers[id] = (s.players[p].stats.triggers[id] ?? 0) + 1;
};
export const systems = (s: GameState, p: number, color: Color) =>
  s.locations.filter(
    (l) =>
      l.faceUp &&
      l.card &&
      civsAt(l, p).length &&
      ((CARDS[l.card].color === color && CARDS[l.card].kind === "system") ||
        (CARDS[l.card].kind !== "system" && has(s, p, "c23"))),
  ).length;
export const research = (s: GameState, p: number) =>
  Math.min(
    CONFIG.RESEARCH_MAX,
    s.players[p].research + CONFIG.BLUE_RESEARCH * systems(s, p, "Blue"),
  );
export const supply = (s: GameState, p: number) =>
  CONFIG.PLAYER_TOKEN_COUNT -
  s.fleets.filter((f) => f.owner === p).length -
  s.locations.reduce(
    (n, l) =>
      n +
      civsAt(l, p).length +
      l.planets
        .flatMap((t) => t.civs)
        .reduce((k, c) => k + c.captives.filter((v) => v === p).length, 0),
    0,
  ) -
  s.players[p].techTokens -
  s.players.reduce((n, x) => n + x.captured.filter((v) => v === p).length, 0);
const armadas = (s: GameState, p: number, l?: Location) => [
  ...new Set(
    (l ? fleetsAt(s, l, p) : s.fleets.filter((f) => f.owner === p)).map(
      (f) => f.wp,
    ),
  ),
];
const gainTrophy = (s: GameState, p: number, n = 1) => {
  s.players[p].trophies += n;
};
const gainResearch = (s: GameState, p: number, n = 1) => {
  s.players[p].research = Math.min(
    CONFIG.RESEARCH_MAX,
    s.players[p].research + n,
  );
};
function researchThresholds(s: GameState, before: number[]) {
  if (s.over) return;
  s.players.forEach((_, p) => {
    if (
      before[p] < CONFIG.RESEARCH_DRAW_LEVEL &&
      research(s, p) >= CONFIG.RESEARCH_DRAW_LEVEL
    ) {
      draw(s, p, 5);
      record(
        s,
        s.players[p].name + " reached Research 10: draw up to five cards.",
      );
    }
  });
}
function takeDeck(s: GameState): string | null {
  if (!s.deck.length) {
    s.reshuffles++;
    s.deck = shuffle(s.rng, s.discard.splice(0));
    if (!s.novaAdded && s.reshuffles >= s.players.length - 1) {
      s.deck.splice(
        nextInt(s.rng, Math.max(1, Math.floor(s.deck.length / 2))),
        0,
        "a13",
      );
      s.novaAdded = true;
      record(s, "Super Nova entered the bottom half of the draw deck.");
    }
  }
  const id = s.deck.pop() ?? null;
  if (id === "a13") {
    s.nova = true;
    s.removed.push(id);
    record(s, "Super Nova! Finish this turn, then score.");
    return null;
  }
  return id;
}
function draw(s: GameState, p: number, n = 1) {
  for (let i = 0; i < n && s.players[p].hand.length < CONFIG.HAND_LIMIT; i++) {
    const id = takeDeck(s);
    if (id) s.players[p].hand.push(id);
    else break;
  }
}
function flip(s: GameState) {
  const id = takeDeck(s);
  if (id) s.discard.push(id);
  return id ? CARDS[id].rank : 0;
}
function discard(s: GameState, p: number, ids: string[]) {
  for (const id of ids)
    if (id !== "r01") {
      const i = s.players[p].hand.indexOf(id);
      if (i < 0) throw Error("Missing card");
      s.players[p].hand.splice(i, 1);
      s.discard.push(id);
    }
}
function setCard(l: Location, id: string) {
  l.card = id;
  l.planets = CARDS[id].planets.map((p) => ({
    ...p,
    civs: [],
    exploited: false,
  }));
}
export function newGame(
  input: Seat[],
  opts: { seed?: number } = {},
): GameState {
  if (input.length < 2 || input.length > 4) throw Error("Choose 2–4 players");
  const seed = opts.seed ?? 1,
    rng = makeRng(seed);
  const s: GameState = {
    version: 1,
    seed,
    rng,
    setup: structuredClone(input),
    players: input.map((x) => ({
      ...x,
      isBot: !!x.isBot,
      hand: [],
      techs: [],
      research: 0,
      trophies: 0,
      homeColor: null,
      homeCard: null,
      usedCapacity: 0,
      pools: emptyPools(),
      commerceUsed: [],
      flags: {},
      techTokens: 0,
      captured: [],
      shieldSystem: null,
      stats: {
        actions: {},
        invented: {},
        triggers: {},
        conquerAttempts: 0,
        conquerWins: 0,
        battles: 0,
        battleWins: 0,
        reveals: 0,
        exploits: 0,
      },
    })),
    locations: [],
    fleets: [],
    deck: shuffle(
      rng,
      Object.keys(CARDS).filter((id) => id !== "a13"),
    ),
    discard: [],
    removed: [],
    resolving: [],
    active: 0,
    first: nextInt(rng, input.length),
    turn: 1,
    phase: "home",
    setupBudget: CONFIG.STARTING_BUDGET,
    homeChosen: null,
    queue: [],
    pending: null,
    battle: null,
    nextId: 1,
    reshuffles: 0,
    novaAdded: false,
    nova: false,
    over: false,
    winners: [],
    reason: "",
    log: [],
    serial: 0,
  };
  s.active = s.first;
  for (const [id, spec] of mapLayout(input.length).entries()) {
    const l: Location = {
      id,
      ...spec,
      faceUp: !!spec.faceUp,
      card: null,
      planets: [],
    };
    if (spec.home === undefined) {
      let i = s.deck.length - 1;
      if (l.faceUp) i = s.deck.findIndex((c) => CARDS[c].kind === "system");
      setCard(l, s.deck.splice(i, 1)[0]);
    }
    s.locations.push(l);
  }
  s.players.forEach((x, p) => {
    draw(s, p, CONFIG.STARTING_HAND);
    if (!x.hand.some((id) => CARDS[id].kind === "system")) {
      const i = s.deck.findIndex((id) => CARDS[id].kind === "system");
      const old = x.hand[0];
      x.hand[0] = s.deck[i];
      s.deck[i] = old;
    }
  });
  record(
    s,
    "Choose a starting system from your hand, then place your starting forces.",
  );
  return s;
}
export const seatOnClock = (s: GameState) => s.pending?.who ?? s.active;
export const activeSeat = seatOnClock;
function addFleet(s: GameState, p: number, wp: string, level: 1 | 2 = 1) {
  if (supply(s, p) <= 0 || s.fleets.some((f) => f.wp === wp && f.owner !== p))
    return false;
  if (has(s, p, "c24") && !s.players[p].flags.builtFleet) trigger(s, p, "c24");
  s.fleets.push({ id: s.nextId++, owner: p, wp, level });
  s.players[p].flags.builtFleet = 1;
  return true;
}
function removeFleet(s: GameState, id: number) {
  s.fleets = s.fleets.filter((f) => f.id !== id);
}
function placeCiv(s: GameState, p: number, l: Location, pi: number) {
  const t = l.planets[pi];
  if (supply(s, p) <= 0) {
    gainTrophy(s, p, CONFIG.EXHAUSTED_SUPPLY_TROPHIES);
    t.exploited = false;
    record(
      s,
      s.players[p].name +
        " has no supply tokens: gain a trophy instead of building a Civ.",
    );
    return;
  }
  t.civs.push({ id: s.nextId++, owner: p, captives: [] });
  t.exploited = false;
  if (has(s, p, "c44")) {
    trigger(s, p, "c44");
    draw(s, p);
    gainResearch(s, p);
  }
}
function removeCiv(
  s: GameState,
  l: Location,
  pi: number,
  ci = 0,
  captureBy?: number,
) {
  const [c] = l.planets[pi].civs.splice(ci, 1);
  if (!c) return;
  if (captureBy !== undefined) s.players[captureBy].captured.push(c.owner);
  for (const owner of c.captives) {
    const wp = waypoints(l).find(
      (w) => !s.fleets.some((f) => f.wp === w && f.owner !== owner),
    );
    if (wp) addFleet(s, owner, wp);
    gainTrophy(s, owner);
  }
}
export function points(s: GameState, p: number) {
  return {
    trophies: s.players[p].trophies,
    technologies: s.players[p].techs.length,
    civilizations: s.locations.reduce((n, l) => n + civsAt(l, p).length, 0),
    control: s.locations.filter((l) => controls(s, l, p)).length,
    research:
      research(s, p) >= CONFIG.RESEARCH_VP_LEVEL ? CONFIG.RESEARCH_VP : 0,
  };
}
export const score = (s: GameState, p: number) =>
  Object.values(points(s, p)).reduce((a, b) => a + b, 0);
function finish(s: GameState, reason: string, winner?: number) {
  s.over = true;
  s.reason = reason;
  s.pending = null;
  s.queue = [];
  if (winner !== undefined) s.winners = [winner];
  else {
    const scores = s.players.map((_, i) => score(s, i));
    const tied = scores
      .map((v, i) => (v === Math.max(...scores) ? i : -1))
      .filter((i) => i >= 0);
    const rank = (p: number) =>
      s.players[p].hand.reduce((n, id) => n + CARDS[id].rank, 0);
    const high = Math.max(...tied.map(rank));
    s.winners = tied.filter((i) => rank(i) === high);
  }
  record(s, reason);
}
function startTurn(s: GameState) {
  const p = s.active,
    x = s.players[p];
  x.pools = emptyPools();
  x.usedCapacity = 0;
  x.commerceUsed = [];
  x.flags = {};
  s.phase = "generate";
  if (
    COLORS.every((c) =>
      s.locations.some(
        (l) =>
          l.faceUp &&
          l.card &&
          CARDS[l.card].kind === "system" &&
          CARDS[l.card].color === c &&
          civsAt(l, p).length,
      ),
    )
  ) {
    finish(s, "Culture victory", p);
    return;
  }
  if (
    s.players.every(
      (o, i) =>
        i === p ||
        (s.locations.filter((l) => controls(s, l, p)).length >=
          s.locations.filter((l) => controls(s, l, i)).length + 4 &&
          x.trophies >= o.trophies + 4),
    )
  ) {
    finish(s, "Hegemony victory", p);
    return;
  }
  for (let i = 0; i < systems(s, p, "Green"); i++)
    s.queue.push({ kind: "freeMove", who: p, amount: 1 });
}
export function power(s: GameState, p: number, l: Location, battle = false) {
  let n =
    fleetsAt(s, l, p).reduce(
      (v, f) =>
        v + (f.sun ? 4 : f.level) + (f.level === 2 && has(s, p, "c25") ? 1 : 0),
      0,
    ) +
    systems(s, p, "Red") +
    (s.players[p].flags.power ?? 0);
  if (battle) {
    if (research(s, p) >= 8) n++;
    if (has(s, p, "c32")) n += 2 * civsAt(l, p).length;
    if (has(s, p, "c34")) n += Math.max(0, armadas(s, p, l).length - 1) * 2;
    if (has(s, p, "c42")) n += s.players[p].techs.length;
  }
  return n;
}
const enemyFleets = (s: GameState, l: Location, p: number) =>
  fleetsAt(s, l).filter((f) => f.owner !== p).length;
function protectedPlanet(s: GameState, l: Location, pi: number, p: number) {
  return l.planets[pi].civs.some(
    (c) =>
      c.owner !== p &&
      has(s, c.owner, "c38") &&
      s.players[c.owner].shieldSystem !== l.id &&
      s.locations.some(
        (q) =>
          q.id === s.players[c.owner].shieldSystem && civsAt(q, c.owner).length,
      ),
  );
}
function buildCost(s: GameState, l: Location, p: number, pi: number) {
  return Math.max(
    1,
    (l.planets[pi].civs.length
      ? 2
      : l.planets[pi].exploited
        ? 1
        : CONFIG.CIV_COST) -
      (has(s, p, "c43") ? 1 : 0) -
      (has(s, p, "c27") &&
      s.locations.some(
        (q) =>
          q.faceUp &&
          q.card &&
          CARDS[q.card].kind === "asteroid" &&
          adjacent(l, q),
      )
        ? 1
        : 0),
  );
}
function payment(s: GameState, p: number, c: Color, n: number) {
  const pools = s.players[p].pools;
  if (pools[c] >= n) return true;
  return (
    (c === "Blue" || c === "Yellow") &&
    has(s, p, "c26") &&
    pools[c] + pools.Green >= n
  );
}
function spend(s: GameState, p: number, c: Color, n: number) {
  const x = s.players[p].pools,
    paid = Math.min(n, x[c]);
  x[c] -= paid;
  if (n > paid) {
    x.Green -= n - paid;
    trigger(s, p, "c26");
  }
}
const subsets = <T>(xs: T[], max = xs.length): T[][] => {
  const out: T[][] = [[]];
  for (const x of xs)
    for (const prev of [...out]) if (prev.length < max) out.push([...prev, x]);
  return out;
};
function moveCost(s: GameState, p: number, f: Fleet, to: string) {
  const common = at(s, f.wp).filter((l) => waypoints(l).includes(to));
  if (has(s, p, "c33") && common.some((l) => civsAt(l, p).length)) return 0;
  return (
    1 +
    Math.min(
      ...(common.length ? common : at(s, f.wp)).map((l) =>
        enemyFleets(s, l, p),
      ),
    )
  );
}
function movingGroups(s: GameState, f: Fleet): number[][] {
  // Canonical smallest ID anchors each group, so pairs are not enumerated twice.
  const others = s.fleets
    .filter((q) => q.owner === f.owner && q.wp === f.wp && q.id > f.id)
    .map((q) => q.id);
  return subsets(others, CONFIG.GREEN_MOVE_LIMIT - 1).map((ids) => [
    f.id,
    ...ids,
  ]);
}
function moveSelected(s: GameState, ids: number[], to: string) {
  for (const f of s.fleets) if (ids.includes(f.id)) f.wp = to;
}
function exploitChoices(a: string, l: Location, planet: number): Action[] {
  const base = { a, location: l.id, planet };
  return [
    { ...base, mode: "safe", amount: 0 },
    ...(l.planets[planet].resource === "none"
      ? []
      : Array.from({ length: CONFIG.EXPLOIT_MAX_GUESS }, (_, i) => ({
          ...base,
          mode: "push",
          amount: i + 1,
        }))),
  ];
}
export function legalActions(s: GameState): Action[] {
  const p = s.active,
    x = s.players[p];
  if (s.over) return [];
  if (s.pending) return s.pending.options.map((o) => o.action);
  if (s.phase === "home")
    return x.hand
      .filter((id) => CARDS[id].kind === "system")
      .map((card) => ({ a: "home", card }));
  if (s.phase === "forces") {
    const l = s.locations.find((q) => q.id === s.homeChosen)!;
    const out: Action[] = [{ a: "finishSetup" }];
    if (s.setupBudget > 0 && supply(s, p) > 0) {
      for (const to of waypoints(l))
        if (!s.fleets.some((f) => f.wp === to && f.owner !== p))
          out.push({ a: "setupFleet", to });
      l.planets.forEach((t, planet) => {
        if (!t.civs.length && t.resistance <= s.setupBudget)
          out.push({ a: "setupCiv", planet });
      });
    }
    return out;
  }
  if (s.phase === "start") return [{ a: "beginTurn" }];
  if (s.phase === "generate") {
    const out: Action[] = [
      { a: "rest" },
      ...COLORS.map((color) => ({ a: "free", color })),
    ];
    for (const card of x.hand) {
      out.push({ a: "play", card });
      for (const other of x.hand)
        if (
          other !== card &&
          CARDS[card].rank === CARDS[other].rank &&
          CARDS[card].color !== CARDS[other].color
        )
          out.push({ a: "dual", card, cards: [other] });
    }
    for (const color of COLORS) {
      const ids = x.hand.filter((id) => CARDS[id].color === color);
      for (let i = 0; i < ids.length; i++)
        for (let j = i + 1; j < ids.length; j++)
          for (const target of COLORS)
            if (target !== color)
              out.push({ a: "wild", cards: [ids[i], ids[j]], color: target });
    }
    return out;
  }
  const out: Action[] = [{ a: "endTurn" }];
  if (x.flags.playedColor)
    for (const card of x.hand)
      if (CARDS[card].color === COLORS[x.flags.playedColor - 1])
        out.push({ a: "boost", card });
  if (payment(s, p, "Blue", 1)) {
    if (research(s, p) < CONFIG.RESEARCH_MAX) out.push({ a: "study" });
    for (const card of x.hand)
      if (
        CARDS[card].kind === "system" &&
        CARDS[card].rank + x.usedCapacity <= research(s, p)
      )
        out.push({ a: "invent", card });
    for (const f of s.fleets)
      if (
        f.owner === p &&
        f.level === 1 &&
        at(s, f.wp).some((l) => controls(s, l, p) && civsAt(l, p).length)
      )
        out.push({ a: "upgrade", fleet: f.id });
  }
  if (payment(s, p, "Yellow", 1) && !x.flags.draw) out.push({ a: "draw" });
  for (const l of s.locations) {
    if (!l.card) continue;
    const owned = fleetsAt(s, l, p),
      enemy = enemyFleets(s, l, p);
    if (!l.faceUp) {
      if (owned.length && payment(s, p, "Green", 1))
        out.push({ a: "reveal", location: l.id });
      continue;
    }
    if (owned.length) {
      if (payment(s, p, "Red", 1))
        for (const target of [
          ...new Set(
            fleetsAt(s, l)
              .filter((f) => f.owner !== p)
              .map((f) => f.owner),
          ),
        ])
          out.push({ a: "attack", location: l.id, target });
      l.planets.forEach((t, planet) => {
        if (
          t.civs.some((c) => c.owner === p) ||
          protectedPlanet(s, l, planet, p)
        )
          return;
        if (payment(s, p, "Red", 1 + enemy))
          for (const card of ["r01", ...x.hand])
            for (const fleet of owned)
              out.push({
                a: "conquer",
                location: l.id,
                planet,
                card,
                fleet: fleet.id,
              });
        if (!t.exploited && enemy === 0 && payment(s, p, "Green", 1))
          out.push(...exploitChoices("exploit", l, planet));
      });
    }
    if (occupies(s, l, p) && !x.commerceUsed.includes(l.id)) {
      if (payment(s, p, "Yellow", 1))
        out.push(
          { a: "commerce", location: l.id, mode: "cards" },
          { a: "commerce", location: l.id, mode: "fleet" },
          { a: "commerce", location: l.id, mode: "research" },
        );
      {
        const eligible = l.planets
          .map((t, i) => ({ t, i }))
          .filter(
            ({ t }) =>
              !t.civs.length ||
              (has(s, p, "c39") &&
                t.civs.length === 1 &&
                t.civs[0].owner === p),
          )
          .map((v) => v.i);
        for (const planets of subsets(eligible).filter((v) => v.length)) {
          const cost = planets.reduce(
            (n, i) => n + buildCost(s, l, p, i),
            enemy,
          );
          if (payment(s, p, "Yellow", cost))
            out.push({ a: "build", location: l.id, planets });
        }
      }
    }
    if (
      has(s, p, "c23") &&
      CARDS[l.card].kind !== "system" &&
      controls(s, l, p) &&
      !l.planets.length &&
      supply(s, p) > 0 &&
      payment(s, p, "Yellow", 3)
    )
      out.push({ a: "anomalyCiv", location: l.id });
    if (has(s, p, "c35") && payment(s, p, "Green", 1))
      for (const other of s.locations)
        if (adjacent(l, other) && civsAt(l, p).length && other.faceUp)
          other.planets.forEach((t, planet) => {
            if (t.exploited && !t.civs.length)
              out.push({
                a: "colony",
                location: l.id,
                target: other.id,
                planet,
              });
          });
  }
  for (const f of s.fleets.filter((f) => f.owner === p))
    for (const to of destinations(s, f)) {
      const cost = moveCost(s, p, f, to);
      for (const color of ["Green", "Red"] as Color[])
        if (payment(s, p, color, cost))
          for (const fleets of color === "Green"
            ? movingGroups(s, f)
            : [undefined])
            out.push({
              a: "move",
              fleet: f.id,
              from: f.wp,
              to,
              color,
              amount: cost,
              ...(fleets ? { fleets } : {}),
            });
    }
  if (has(s, p, "c31") && !x.flags.sun)
    for (const f of s.fleets.filter((f) => f.owner === p && f.sun))
      for (const l of at(s, f.wp).filter((l) => controls(s, l, p)))
        for (const card of x.hand.filter((id) => CARDS[id].color === "Red"))
          out.push({ a: "sun", fleet: f.id, location: l.id, card });
  return out;
}
function queue(s: GameState, ...tasks: Task[]) {
  s.queue.unshift(...tasks);
}
const choice = (label: string, a: Action): Choice => ({ label, action: a });
function fleetChoices(s: GameState, filter: (f: Fleet) => boolean) {
  return s.fleets.filter(filter).map((f) =>
    choice(s.players[f.owner].name + " fleet " + f.id + " at " + f.wp, {
      a: "choose",
      fleet: f.id,
    }),
  );
}
function taskOptions(s: GameState, t: Task): Choice[] {
  const p = t.who,
    x = s.players[p],
    l = s.locations.find((l) => l.id === t.location),
    skip = choice("Done / skip", { a: "choose", mode: "skip" });
  switch (t.kind) {
    case "freeMove":
    case "lightMove":
      return [
        skip,
        ...s.fleets
          .filter(
            (f) =>
              f.owner === p &&
              (!t.data?.moves || (t.data.moves[f.id] ?? 0) < 2),
          )
          .flatMap((f) =>
            destinations(s, f, t.kind === "lightMove").flatMap((to) =>
              (t.kind === "freeMove" ? movingGroups(s, f) : [undefined]).map(
                (fleets) =>
                  choice(
                    "Move " +
                      (t.kind === "freeMove" ? "up to two fleets" : "fleet") +
                      " from " +
                      f.wp +
                      " to " +
                      to,
                    {
                      a: "choose",
                      fleet: f.id,
                      to,
                      ...(fleets ? { fleets } : {}),
                    },
                  ),
              ),
            ),
          ),
      ];
    case "upgrade":
      return [
        skip,
        ...fleetChoices(
          s,
          (f) => f.level === 1 && (t.target === -1 || f.owner === p),
        ),
      ];
    case "buildFleet": {
      if (supply(s, p) <= 0) return [skip];
      const locs =
        t.location === undefined
          ? s.locations.filter((q) => occupies(s, q, p))
          : [l!];
      let wps = locs.flatMap((q) => {
        const present = armadas(s, p, q);
        return present.length ? present : waypoints(q);
      });
      if (has(s, p, "c24") && !x.flags.builtFleet)
        wps = s.locations.flatMap(waypoints);
      return [
        skip,
        ...[...new Set(wps)]
          .filter((w) => !s.fleets.some((f) => f.wp === w && f.owner !== p))
          .map((to) => choice("Build Fleet I at " + to, { a: "choose", to })),
      ];
    }
    case "militarize":
      return [
        skip,
        ...taskOptions(s, { ...t, kind: "buildFleet" }).filter(
          (o) => o.action.mode !== "skip",
        ),
        ...fleetChoices(
          s,
          (f) =>
            f.owner === p &&
            f.level === 1 &&
            !!l &&
            waypoints(l).includes(f.wp),
        ),
      ];
    case "buildCiv":
      return [
        skip,
        ...s.locations
          .filter((q) => (!t.ids || t.ids.includes(q.id)) && q.faceUp)
          .flatMap((q) =>
            q.planets.flatMap((pl, planet) =>
              !pl.civs.length
                ? [
                    choice(
                      "Build on " + locationName(q) + " P" + (planet + 1),
                      { a: "choose", location: q.id, planet },
                    ),
                  ]
                : [],
            ),
          ),
      ];
    case "freeExploit":
      return [
        skip,
        ...s.locations
          .filter(
            (q) =>
              t.ids?.includes(q.id) && q.faceUp && enemyFleets(s, q, p) === 0,
          )
          .flatMap((q) =>
            q.planets.flatMap((pl, planet) =>
              !pl.exploited &&
              !pl.civs.some((c) => c.owner === p) &&
              !protectedPlanet(s, q, planet, p)
                ? exploitChoices("choose", q, planet).map((action) =>
                    choice(
                      "Exploit " +
                        locationName(q) +
                        " P" +
                        (planet + 1) +
                        (action.mode === "safe"
                          ? " · draw one safely"
                          : " · push for " + action.amount),
                      action,
                    ),
                  )
                : [],
            ),
          ),
      ];
    case "exploitTokens":
      return [
        skip,
        ...s.locations
          .filter((q) => q.faceUp)
          .flatMap((q) =>
            q.planets.flatMap((pl, planet) =>
              !pl.exploited
                ? [
                    choice("Mark " + locationName(q) + " P" + (planet + 1), {
                      a: "choose",
                      location: q.id,
                      planet,
                    }),
                  ]
                : [],
            ),
          ),
      ];
    case "replicator":
      return [
        skip,
        ...(supply(s, p) > 0
          ? [choice("Store one supply token", { a: "choose", mode: "store" })]
          : []),
        ...(x.techTokens
          ? [
              choice("Cash in " + x.techTokens + " tokens for trophies", {
                a: "choose",
                mode: "cash",
              }),
            ]
          : []),
      ];
    case "shield":
      return [
        skip,
        ...s.locations
          .filter((q) => q.faceUp && q.card && CARDS[q.card].kind === "system")
          .map((q) =>
            choice("Mark " + locationName(q), { a: "choose", location: q.id }),
          ),
      ];
    case "sunCreate":
      return [
        skip,
        ...s.locations
          .filter(
            (q) => controls(s, q, p) && q.planets.some((pl) => pl.exploited),
          )
          .flatMap((q) =>
            fleetsAt(s, q, p).map((f) =>
              choice("Make fleet " + f.id + " The ExpirationSun", {
                a: "choose",
                fleet: f.id,
                location: q.id,
              }),
            ),
          ),
      ];
    case "replace":
      return [
        skip,
        ...s.locations
          .filter(
            (q) =>
              controls(s, q, p) &&
              q.faceUp &&
              q.card &&
              CARDS[q.card].kind === "system",
          )
          .flatMap((q) =>
            x.hand
              .filter((id) => CARDS[id].kind === "system")
              .map((card) =>
                choice(
                  "Replace " + locationName(q) + " with " + CARDS[card].name,
                  { a: "choose", location: q.id, card },
                ),
              ),
          ),
      ];
    case "addLocation": {
      const empty = new Set<string>();
      for (const q of s.locations)
        for (const [dx, dy] of [
          [0, -2],
          [0, 2],
          [-1, -1],
          [-1, 1],
          [1, -1],
          [1, 1],
        ]) {
          const x = q.x + dx,
            y = q.y + dy;
          if (!s.locations.some((l) => l.x === x && l.y === y))
            empty.add(x + "," + y);
        }
      return [
        skip,
        ...x.hand
          .map((card) =>
            [...empty].map((to) =>
              choice(CARDS[card].name + " at " + to, { a: "choose", card, to }),
            ),
          )
          .flat(),
      ];
    }
    case "nano":
      return [
        skip,
        ...s.locations
          .filter((q) => fleetsAt(s, q).some((f) => f.level === 1))
          .map((q) =>
            choice("Upgrade all fleets at " + locationName(q), {
              a: "choose",
              location: q.id,
            }),
          ),
      ];
    case "colorBuild":
      return COLORS.map((color) =>
        choice("Build at occupied " + color + " systems", {
          a: "choose",
          color,
        }),
      );
    case "psy":
      return [
        choice("Decline; allow the extra turn", { a: "choose", amount: 0 }),
        ...[1, 2]
          .filter((n) => n <= x.trophies && n <= t.amount!)
          .map((amount) =>
            choice("Pay " + amount + " trophy", { a: "choose", amount }),
          ),
      ];
    case "targetArmada":
      return [
        skip,
        ...s.fleets
          .filter((f) => f.owner !== p && (!t.ids || !t.ids.includes(f.id)))
          .filter(
            (f, i, arr) =>
              arr.findIndex((o) => o.wp === f.wp && o.owner === f.owner) === i,
          )
          .map((f) =>
            choice("Target " + s.players[f.owner].name + " at " + f.wp, {
              a: "choose",
              fleet: f.id,
            }),
          ),
      ];
    case "starResponse":
      return [
        choice("Destroy one fleet", { a: "choose", mode: "destroy" }),
        choice("Allow one move", { a: "choose", mode: "allow" }),
      ];
    case "enemyMove": {
      const f = s.fleets.find((f) => f.id === t.target);
      return [
        skip,
        ...(f
          ? destinations(s, f).map((to) =>
              choice("Move to " + to, { a: "choose", to }),
            )
          : []),
      ];
    }
    case "targetFleet":
      return [skip, ...fleetChoices(s, (f) => !t.ids?.includes(f.id))];
    case "overrideResponse":
      return [
        choice("Discard the fleet", { a: "choose", mode: "destroy" }),
        ...subsets(x.hand)
          .filter((ids) => ids.reduce((n, id) => n + CARDS[id].rank, 0) === 4)
          .map((cards) =>
            choice("Discard " + cards.map((id) => CARDS[id].name).join(" + "), {
              a: "choose",
              cards,
            }),
          ),
      ];
    case "entangle":
      return [
        skip,
        ...fleetChoices(s, (f) => !!l && waypoints(l).includes(f.wp)),
      ];
    case "entangleResponse":
      return [
        choice("Discard the fleet group", { a: "choose", mode: "destroy" }),
        ...x.hand
          .filter((id) => CARDS[id].shield > 0)
          .map((card) =>
            choice("Discard " + CARDS[card].name + " and retreat", {
              a: "choose",
              card,
            }),
          ),
      ];
    case "battleTarget":
      return [
        skip,
        ...s.locations
          .filter((q) => q.faceUp)
          .flatMap((q) =>
            [...new Set(fleetsAt(s, q).map((f) => f.owner))].flatMap((target) =>
              [...new Set(fleetsAt(s, q).map((f) => f.owner))]
                .filter((o) => o !== target)
                .map((defender) =>
                  choice(
                    "Battle at " +
                      locationName(q) +
                      ": " +
                      s.players[target].name +
                      " attacks " +
                      s.players[defender].name,
                    { a: "choose", location: q.id, target, amount: defender },
                  ),
                ),
            ),
          ),
      ];
    case "battleBoost":
      return [s.battle!.attacker, s.battle!.defender].map((target) =>
        choice("Give 3 bursts to " + s.players[target].name, {
          a: "choose",
          target,
        }),
      );
    case "commit": {
      const b = s.battle!,
        loc = s.locations.find((l) => l.id === b.location)!;
      const max = armadas(s, p, loc).length + (has(s, p, "c36") ? 1 : 0),
        exposed = b.exposed?.[p];
      let combos = subsets(x.hand, max);
      if (exposed) combos = combos.filter((ids) => ids.includes(exposed));
      return [
        ...(!exposed
          ? [
              choice("Play the 0 card (defending shield)", {
                a: "choose",
                cards: ["r01"],
              }),
            ]
          : []),
        ...combos.map((cards) =>
          choice(
            cards.length
              ? cards
                  .map((id) => CARDS[id].name + " (" + CARDS[id].rank + ")")
                  .join(" + ")
              : "Commit no cards",
            { a: "choose", cards },
          ),
        ),
      ];
    }
    case "expose":
      return (x.hand.length ? x.hand : ["r01"]).map((card) =>
        choice("Reveal " + (card === "r01" ? "0 card" : CARDS[card].name), {
          a: "choose",
          card,
        }),
      );
    case "casualty":
      return fleetChoices(
        s,
        (f) => f.owner === p && !!l && waypoints(l).includes(f.wp),
      );
    case "retreat": {
      const f = s.fleets.find((f) => f.owner === p && f.wp === t.card);
      if (!f) return [];
      const to = destinations(s, f).filter(
        (w) =>
          !waypoints(l!).includes(w) &&
          at(s, w).some((q) => fleetsAt(s, q).every((o) => o.owner === p)),
      );
      return to.length
        ? to.map((w) =>
            choice("Retreat fleet group to " + w, { a: "choose", to: w }),
          )
        : [
            choice("No retreat: lose another fleet", {
              a: "choose",
              mode: "blocked",
            }),
          ];
    }
    case "capture": {
      const origin = s.locations.find((q) => q.id === t.location)!;
      const distance = (q: Location) =>
        Math.hypot(q.x - origin.x, (q.y - origin.y) / 2);
      const closest = Math.min(
        ...s.locations.filter((q) => civsAt(q, p).length).map(distance),
      );
      return [
        skip,
        ...s.locations
          .filter((q) => distance(q) <= closest + 0.001)
          .flatMap((q) =>
            q.planets.flatMap((pl, planet) =>
              pl.civs
                .filter((c) => c.owner === p)
                .map(() =>
                  choice(
                    "Imprison under Civ at " +
                      locationName(q) +
                      " P" +
                      (planet + 1),
                    { a: "choose", location: q.id, planet },
                  ),
                ),
            ),
          ),
      ];
    }
    default:
      return [];
  }
}
const TITLES: Record<string, string> = {
  freeMove: "Green system benefit: move up to two fleets",
  lightMove: "Light Fields: move each fleet up to twice",
  upgrade: "Choose a fleet to upgrade",
  buildFleet: "Choose where to build a fleet",
  militarize: "Build or upgrade a fleet",
  buildCiv: "Choose a planet to civilize",
  freeExploit: "Choose a planet to exploit",
  exploitTokens: "Place an Exploit token",
  replicator: "Cultural Replicator",
  shield: "Shield Generator: choose its anchor system",
  sunCreate: "Create The ExpirationSun",
  replace: "Dyson Terraformer: replace a system",
  addLocation: "Dark Matter Charting: extend the map",
  nano: "Nano Construction: choose a location",
  colorBuild: "Blackhole Extraction: choose a color",
  psy: "PsyDomination: contribute trophies to stop an extra turn",
  targetArmada: "Star Lensing: choose an enemy fleet group",
  starResponse: "Star Lensing: allow movement or lose a fleet",
  enemyMove: "Move the chosen enemy fleet group",
  targetFleet: "Tech Override: select a fleet",
  overrideResponse: "Tech Override: pay exactly rank 4 or lose the fleet",
  entangle: "Entanglement Laser: choose a fleet group",
  entangleResponse: "Discard a shield and retreat, or lose the fleet group",
  battleTarget: "Hologrammatic Mass: start a battle",
  battleBoost: "Choose who receives 3 bursts",
  commit: "Secretly commit battle cards",
  expose: "Self-Evolving Robots: expose one battle card",
  casualty: "Choose a fleet casualty",
  retreat: "Retreat the losing fleet group",
  capture: "The Gorb: choose a prison Civ",
};
function pump(s: GameState) {
  while (!s.pending && s.queue.length && !s.over) {
    const t = s.queue.shift()!;
    if (t.kind === "returnDiscovery") {
      s.resolving = s.resolving.filter((id) => id !== t.card);
      s.deck.push(t.card!);
      shuffle(s.rng, s.deck);
      continue;
    }
    if (t.kind === "attackAfter") {
      const l = s.locations.find((l) => l.id === t.location);
      if (l && fleetsAt(s, l, t.who).length)
        battleStart(s, t.who, l, t.target!);
      continue;
    }
    if (t.kind === "exploitAfter") {
      const l = s.locations.find((l) => l.id === t.location);
      if (l && fleetsAt(s, l, t.who).length)
        exploit(s, t.who, l, t.data!.planet, t.amount!);
      continue;
    }
    if (t.kind === "resolveBattle") {
      resolveBattle(s);
      continue;
    }
    if (t.kind === "battleCleanup") {
      cleanupBattle(s);
      continue;
    }
    const options = taskOptions(s, t);
    if (!options.length) continue;
    s.pending = {
      who: t.who,
      title: TITLES[t.kind] ?? t.kind,
      task: t,
      options: options.map((o, index) => ({
        ...o,
        action: { ...o.action, index },
      })),
    };
  }
}
function markExploit(s: GameState, l: Location, pi: number) {
  const marked = s.locations
    .flatMap((q) => q.planets.map((t, i) => ({ l: q, i, t })))
    .filter((v) => v.t.exploited);
  if (
    marked.length + s.fleets.filter((f) => f.sun).length >=
    CONFIG.EXPLOIT_TOKEN_COUNT
  ) {
    marked.sort(
      (a, b) =>
        Math.abs(b.l.x - l.x) +
        Math.abs(b.l.y - l.y) -
        (Math.abs(a.l.x - l.x) + Math.abs(a.l.y - l.y)),
    );
    marked[0].t.exploited = false;
  }
  l.planets[pi].exploited = true;
}
function resource(
  s: GameState,
  p: number,
  l: Location,
  kind: string,
  n: number,
) {
  if (kind === "cards") draw(s, p, n);
  if (kind === "research") gainResearch(s, p, n);
  if (kind === "fleet")
    queue(
      s,
      ...Array.from({ length: n }, () => ({
        kind: "buildFleet",
        who: p,
        location: l.id,
      })),
    );
}
function exploit(
  s: GameState,
  p: number,
  l: Location,
  pi: number,
  guess: number,
) {
  const t = l.planets[pi],
    lastEmpty =
      !t.civs.length &&
      l.planets.every((pl, i) => i === pi || pl.civs.length || pl.exploited),
    rank = guess === 0 ? null : flip(s),
    success = guess === 0 || guess < rank!;
  if (guess === 0) draw(s, p);
  else if (success) resource(s, p, l, t.resource, guess);
  if (lastEmpty && success) gainTrophy(s, p, CONFIG.COMPLETE_EXPLOIT_TROPHIES);
  if (t.civs.length) gainTrophy(s, p, research(s, p) >= 6 ? 2 : 1);
  else markExploit(s, l, pi);
  s.players[p].stats.exploits++;
  record(
    s,
    s.players[p].name +
      " exploited " +
      locationName(l) +
      (guess === 0
        ? ": drew one safely."
        : ": named " +
          guess +
          ", revealed " +
          rank +
          (success ? " — success." : " — no resource reward.")) +
      (lastEmpty && success ? " Last empty planet: +1 trophy." : ""),
  );
  if (has(s, p, "c30")) {
    trigger(s, p, "c30");
    queue(s, { kind: "replicator", who: p });
  }
}
function commerce(s: GameState, p: number, l: Location, mode: string) {
  let n = civsAt(l, p).length;
  const resourceKind =
    mode === "cards" ? "cards" : mode === "fleet" ? "fleet" : "research";
  n += l.planets.filter((t) => t.resource === resourceKind).length;
  const adjacentAnomalies = s.locations.filter(
    (q) => q.faceUp && q.card && adjacent(q, l),
  );
  if (mode === "research")
    n += adjacentAnomalies.filter(
      (q) => CARDS[q.card!].kind === "nebula",
    ).length;
  else
    n +=
      adjacentAnomalies.filter((q) => CARDS[q.card!].kind === "asteroid")
        .length * (has(s, p, "c27") ? 2 : 1);
  if (mode === "fleet")
    for (let i = 0; i < n; i++)
      s.queue.push({ kind: "militarize", who: p, location: l.id });
  else resource(s, p, l, resourceKind, n);
}
function moveArmada(s: GameState, f: Fleet, to: string) {
  const from = f.wp;
  s.fleets
    .filter((q) => q.owner === f.owner && q.wp === from)
    .forEach((q) => (q.wp = to));
}
function battleStart(
  s: GameState,
  p: number,
  l: Location,
  defender: number,
  boost = false,
) {
  s.battle = { location: l.id, attacker: p, defender, committed: {} };
  const tasks: Task[] = [];
  if (boost) tasks.push({ kind: "battleBoost", who: s.active });
  for (const owner of [p, defender])
    if (has(s, owner, "c28"))
      tasks.push({ kind: "expose", who: owner === p ? defender : p });
  // A robot's owner commits after its opponent, but only exposed cards become public.
  const order =
    has(s, p, "c28") && !has(s, defender, "c28")
      ? [defender, p]
      : [p, defender];
  tasks.push(...order.map((who) => ({ kind: "commit", who })), {
    kind: "resolveBattle",
    who: p,
  });
  queue(s, ...tasks);
}
function resolveBattle(s: GameState) {
  const b = s.battle!,
    l = s.locations.find((q) => q.id === b.location)!;
  const ids = (p: number) => b.committed[p] ?? [];
  const ranks = (p: number) =>
    ids(p).reduce((n, id) => n + (CARDS[id]?.rank ?? 0), 0);
  const symbols = (p: number, key: "burst" | "shield") =>
    ids(p).reduce(
      (n, id) =>
        n +
        (id === "r01"
          ? key === "shield" && p === b.defender
            ? 1
            : 0
          : CARDS[id][key]),
      0,
    );
  const p = b.attacker,
    d = b.defender,
    pp = power(s, p, l, true) + ranks(p),
    dp = power(s, d, l, true) + ranks(d);
  const win = pp >= dp ? p : d,
    lose = win === p ? d : p;
  const tasks: Task[] = [];
  for (const owner of [p, d]) {
    const opp = owner === p ? d : p;
    let bursts =
      symbols(opp, "burst") +
      (b.bonusOwner === opp ? (b.bonusBurst ?? 0) : 0) +
      (has(s, opp, "c22") && opp === p
        ? ids(opp).filter((id) => CARDS[id]?.color === "Red").length
        : 0);
    let shields =
      symbols(owner, "shield") +
      (owner === p && research(s, owner) >= 4 ? 1 : 0);
    for (let i = 0; i < Math.max(0, bursts - shields); i++)
      tasks.push({ kind: "casualty", who: owner, location: l.id });
  }
  for (const owner of [p, d]) {
    for (const id of ["c25", "c32", "c34", "c36", "c42"])
      if (has(s, owner, id)) trigger(s, owner, id);
    if (
      owner === p &&
      has(s, owner, "c22") &&
      ids(owner).some((id) => CARDS[id]?.color === "Red")
    )
      trigger(s, owner, "c22");
    s.players[owner].stats.battles++;
    if (owner === win) s.players[owner].stats.battleWins++;
  }
  if (win === p) gainTrophy(s, p);
  gainTrophy(
    s,
    win,
    ids(win).filter((id) => CARDS[id]?.kind === "nebula").length * 2,
  );
  if (
    has(s, win, "c29") &&
    fleetsAt(s, l, lose).length &&
    s.locations.some((q) => civsAt(q, win).length)
  )
    tasks.unshift({ kind: "capture", who: win, target: lose, location: l.id });
  tasks.push(
    { kind: "casualty", who: lose, location: l.id },
    ...armadas(s, lose, l).map((card) => ({
      kind: "retreat",
      who: lose,
      location: l.id,
      card,
    })),
    { kind: "battleCleanup", who: p },
  );
  record(
    s,
    "Battle at " +
      locationName(l) +
      ": " +
      s.players[p].name +
      " " +
      pp +
      " vs " +
      s.players[d].name +
      " " +
      dp +
      ". " +
      s.players[win].name +
      " wins. Revealed: " +
      [p, d]
        .map(
          (owner) => s.players[owner].name + " [" + ids(owner).join(", ") + "]",
        )
        .join("; "),
  );
  queue(s, ...tasks);
}
function cleanupBattle(s: GameState) {
  if (!s.battle) return;
  for (const p of [s.battle.attacker, s.battle.defender])
    discard(s, p, s.battle.committed[p] ?? []);
  s.battle = null;
}
function invent(s: GameState, p: number, id: string) {
  const x = s.players[p],
    c = CARDS[id];
  x.hand.splice(x.hand.indexOf(id), 1);
  x.usedCapacity += c.rank;
  x.stats.invented[id] = (x.stats.invented[id] ?? 0) + 1;
  if (c.techType === "Technology") {
    x.techs.push(id);
    if (id === "c38") queue(s, { kind: "shield", who: p });
    if (id === "c31") queue(s, { kind: "sunCreate", who: p });
    return;
  }
  s.resolving.push(id);
  gainTrophy(s, p, CONFIG.DISCOVERY_TROPHIES);
  trigger(s, p, id);
  const occupied = s.locations.filter((l) => occupies(s, l, p) && l.faceUp);
  switch (id) {
    case "c01":
      gainTrophy(
        s,
        p,
        s.locations
          .filter((l) => controls(s, l, p))
          .reduce(
            (n, l) =>
              n +
              l.planets.flatMap((t) => t.civs).filter((c) => c.owner !== p)
                .length,
            0,
          ),
      );
      break;
    case "c02":
      queue(s, { kind: "replace", who: p });
      break;
    case "c03":
      queue(s, { kind: "addLocation", who: p });
      break;
    case "c04":
      queue(s, { kind: "battleTarget", who: p });
      break;
    case "c05":
      gainTrophy(
        s,
        p,
        occupied
          .filter((l) =>
            l.planets.some((t) => t.civs.some((c) => c.owner !== p)),
          )
          .reduce((n, l) => n + 2 * civsAt(l, p).length, 0),
      );
      break;
    case "c06":
      queue(s, { kind: "lightMove", who: p, data: { moves: {} } });
      break;
    case "c07": {
      let n = 0;
      for (const l of s.locations.filter((l) => controls(s, l, p)))
        for (const pl of l.planets)
          if (pl.exploited) {
            pl.exploited = false;
            n++;
          }
      gainTrophy(s, p, n);
      draw(s, p, n);
      break;
    }
    case "c08":
      queue(
        s,
        ...occupied.map((l) => ({
          kind: "buildFleet",
          who: p,
          location: l.id,
        })),
      );
      break;
    case "c09":
      x.flags.extraTurn = 1;
      queue(s, {
        kind: "psy",
        who: (p + 1) % s.players.length,
        target: p,
        amount: 2,
        ids: [],
      });
      break;
    case "c10":
      queue(s, { kind: "nano", who: p });
      break;
    case "c11":
      for (const wp of armadas(s, p)) {
        const f = s.fleets.find(
          (f) => f.owner === p && f.wp === wp && f.level === 1,
        );
        if (f) f.level = 2;
      }
      break;
    case "c12":
      queue(
        s,
        ...occupied
          .filter((l) => fleetsAt(s, l, p).some((f) => f.level === 2))
          .map((l) => ({ kind: "freeExploit", who: p, ids: [l.id] })),
      );
      break;
    case "c13":
      queue(s, { kind: "exploitTokens", who: p, amount: 5 });
      break;
    case "c14":
      queue(s, { kind: "targetArmada", who: p, amount: 3, ids: [] });
      break;
    case "c15":
      x.pools.Red += armadas(s, p).length;
      x.flags.power = (x.flags.power ?? 0) + 2;
      break;
    case "c16": {
      const before = x.hand.length;
      draw(s, p, CONFIG.HAND_LIMIT);
      if (x.hand.length - before >= 5) gainTrophy(s, p, 2);
      break;
    }
    case "c17":
      queue(s, { kind: "colorBuild", who: p });
      break;
    case "c18":
      queue(s, { kind: "targetFleet", who: p, amount: 2, ids: [] });
      break;
    case "c19":
      queue(
        s,
        ...s.fleets
          .filter((f) => f.owner === p && f.level === 2)
          .map((f) => ({
            kind: "buildCiv",
            who: p,
            card: "c19",
            ids: at(s, f.wp).map((l) => l.id),
          })),
      );
      break;
    case "c20":
      queue(
        s,
        ...s.locations
          .filter((l) => civsAt(l, p).length)
          .map((l) => ({ kind: "buildCiv", who: p, ids: [l.id] })),
      );
      break;
    case "c21":
      queue(
        s,
        ...occupied.map((l) => ({ kind: "entangle", who: p, location: l.id })),
      );
      break;
  }
  s.queue.push({ kind: "returnDiscovery", who: p, card: id });
}
function answer(s: GameState, a: Action) {
  const t = s.pending!.task,
    p = t.who,
    x = s.players[p];
  s.pending = null;
  if (a.mode === "skip") return;
  const l = s.locations.find((q) => q.id === a.location),
    f = s.fleets.find((q) => q.id === a.fleet);
  switch (t.kind) {
    case "freeMove":
      if (f) {
        x.flags["visited:" + a.to] = (x.flags["visited:" + a.to] ?? 0) + 1;
        moveSelected(s, a.fleets!, a.to!);
      }
      break;
    case "lightMove":
      if (f) {
        f.wp = a.to!;
        const moves = {
          ...t.data!.moves,
          [f.id]: (t.data!.moves[f.id] ?? 0) + 1,
        };
        queue(s, { ...t, data: { moves } });
      }
      break;
    case "upgrade":
      if (f) f.level = 2;
      break;
    case "buildFleet":
    case "militarize":
      if (f) f.level = 2;
      else addFleet(s, p, a.to!);
      break;
    case "buildCiv":
      if (t.card === "c19") {
        const value = power(s, p, l!),
          rank = flip(s);
        x.stats.conquerAttempts++;
        if (value >= rank) {
          placeCiv(s, p, l!, a.planet!);
          x.stats.conquerWins++;
        }
        record(s, "Propaganda Net conquer: " + value + " vs " + rank);
      } else placeCiv(s, p, l!, a.planet!);
      break;
    case "freeExploit":
      exploit(s, p, l!, a.planet!, a.amount!);
      break;
    case "exploitTokens":
      markExploit(s, l!, a.planet!);
      if (t.amount! > 1) queue(s, { ...t, amount: t.amount! - 1 });
      break;
    case "replicator":
      if (a.mode === "store") x.techTokens++;
      else {
        gainTrophy(s, p, x.techTokens);
        x.techTokens = 0;
      }
      break;
    case "shield":
      x.shieldSystem = a.location!;
      break;
    case "sunCreate":
      if (f) {
        f.sun = true;
        l!.planets.find((pl) => pl.exploited)!.exploited = false;
      }
      break;
    case "replace": {
      const civs = l!.planets.flatMap((t) => t.civs);
      s.discard.push(l!.card!);
      x.hand.splice(x.hand.indexOf(a.card!), 1);
      setCard(l!, a.card!);
      civs.forEach((c, i) => {
        if (i < l!.planets.length) l!.planets[i].civs.push(c);
        else for (const owner of c.captives) gainTrophy(s, owner);
      });
      break;
    }
    case "addLocation": {
      const [xx, y] = a.to!.split(",").map(Number);
      const q: Location = {
        id: Math.max(...s.locations.map((l) => l.id)) + 1,
        x: xx,
        y,
        card: null,
        faceUp: true,
        planets: [],
      };
      setCard(q, a.card!);
      x.hand.splice(x.hand.indexOf(a.card!), 1);
      gainTrophy(
        s,
        p,
        s.locations.filter(
          (l) =>
            adjacent(l, q) &&
            s.players.some((_, i) => i !== p && occupies(s, l, i)),
        ).length,
      );
      s.locations.push(q);
      break;
    }
    case "nano":
      fleetsAt(s, l!).forEach((f) => (f.level = 2));
      break;
    case "colorBuild":
      queue(
        s,
        ...s.locations
          .filter(
            (l) =>
              l.faceUp &&
              l.card &&
              CARDS[l.card].color === a.color &&
              occupies(s, l, p),
          )
          .map((l) => ({ kind: "buildFleet", who: p, location: l.id })),
      );
      break;
    case "psy": {
      const n = a.amount!;
      x.trophies -= n;
      gainTrophy(s, t.target!, n);
      const remain = t.amount! - n;
      if (remain === 0) s.players[t.target!].flags.extraTurn = 0;
      else {
        const next = (p + 1) % s.players.length;
        if (next !== t.target) queue(s, { ...t, who: next, amount: remain });
      }
      break;
    }
    case "targetArmada":
    case "targetFleet":
      if (f) {
        const ids =
          t.kind === "targetArmada"
            ? s.fleets
                .filter((q) => q.wp === f.wp && q.owner === f.owner)
                .map((q) => q.id)
            : [f.id];
        const response: Task = {
          kind: t.kind === "targetArmada" ? "starResponse" : "overrideResponse",
          who: f.owner,
          target: f.id,
          data: { caster: p },
        };
        queue(
          s,
          response,
          ...(t.amount! > 1
            ? [{ ...t, amount: t.amount! - 1, ids: [...(t.ids ?? []), ...ids] }]
            : []),
        );
      }
      break;
    case "starResponse": {
      const target = s.fleets.find((f) => f.id === t.target);
      if (a.mode === "destroy") removeFleet(s, t.target!);
      else if (target)
        queue(s, { kind: "enemyMove", who: t.data!.caster, target: target.id });
      break;
    }
    case "enemyMove": {
      const target = s.fleets.find((f) => f.id === t.target);
      if (target) moveArmada(s, target, a.to!);
      break;
    }
    case "overrideResponse":
      if (a.mode === "destroy") removeFleet(s, t.target!);
      else discard(s, p, a.cards!);
      break;
    case "entangle":
      if (f)
        queue(s, {
          kind: "entangleResponse",
          who: f.owner,
          target: f.id,
          location: t.location,
        });
      break;
    case "entangleResponse": {
      const target = s.fleets.find((f) => f.id === t.target);
      if (!target) break;
      if (a.mode === "destroy")
        s.fleets = s.fleets.filter((f) => f.owner !== p || f.wp !== target.wp);
      else {
        discard(s, p, [a.card!]);
        queue(s, {
          kind: "retreat",
          who: p,
          location: t.location,
          card: target.wp,
        });
      }
      break;
    }
    case "battleTarget":
      battleStart(s, a.target!, l!, a.amount!, true);
      break;
    case "battleBoost":
      s.battle!.bonusOwner = a.target;
      s.battle!.bonusBurst = 3;
      break;
    case "expose":
      trigger(
        s,
        p === s.battle!.attacker ? s.battle!.defender : s.battle!.attacker,
        "c28",
      );
      if (a.card === "r01") {
        s.battle!.committed[p] = ["r01"];
        s.queue = s.queue.filter((q) => !(q.kind === "commit" && q.who === p));
      } else {
        s.battle!.exposed ??= {};
        s.battle!.exposed[p] = a.card!;
      }
      break;
    case "commit":
      s.battle!.committed[p] = a.cards!;
      break;
    case "casualty":
      removeFleet(s, a.fleet!);
      break;
    case "retreat": {
      const target = s.fleets.find((f) => f.owner === p && f.wp === t.card);
      if (target) {
        if (a.mode === "blocked") removeFleet(s, target.id);
        else moveArmada(s, target, a.to!);
      }
      break;
    }
    case "capture": {
      const loc = s.locations.find((q) => q.id === t.location)!;
      const enemy = fleetsAt(s, loc, t.target)[0];
      if (enemy) {
        removeFleet(s, enemy.id);
        l!.planets[a.planet!].civs
          .find((c) => c.owner === p)!
          .captives.push(t.target!);
        gainTrophy(s, p);
        trigger(s, p, "c29");
      }
      break;
    }
  }
}
function endTurn(s: GameState, rest = false) {
  const p = s.active;
  draw(s, p, rest ? 2 : 1);
  if (s.nova) {
    finish(s, "Super Nova");
    return;
  }
  s.turn++;
  if (!s.players[p].flags.extraTurn) s.active = (p + 1) % s.players.length;
  else s.players[p].flags.extraTurn = 0;
  s.phase = "start";
}
export function applyAction(s: GameState, a: Action): string | null {
  if (!legalActions(s).some((x) => JSON.stringify(x) === JSON.stringify(a)))
    return "Illegal action";
  const p = seatOnClock(s),
    x = s.players[p],
    l = s.locations.find((q) => q.id === a.location),
    beforeResearch = s.players.map((_, i) => research(s, i));
  if (a.a === "choose") {
    answer(s, a);
    pump(s);
    researchThresholds(s, beforeResearch);
    s.serial++;
    return null;
  }
  x.stats.actions[a.a] = (x.stats.actions[a.a] ?? 0) + 1;
  switch (a.a) {
    case "home": {
      const home = s.locations.find((l) => l.home === p)!;
      setCard(home, a.card!);
      home.faceUp = true;
      x.hand.splice(x.hand.indexOf(a.card!), 1);
      x.homeCard = a.card!;
      x.homeColor = CARDS[a.card!].color;
      s.homeChosen = home.id;
      s.setupBudget = CONFIG.STARTING_BUDGET;
      s.phase = "forces";
      break;
    }
    case "setupFleet":
      addFleet(s, p, a.to!);
      s.setupBudget--;
      break;
    case "setupCiv": {
      const h = s.locations.find((l) => l.id === s.homeChosen)!;
      placeCiv(s, p, h, a.planet!);
      s.setupBudget -= h.planets[a.planet!].resistance;
      break;
    }
    case "finishSetup":
      s.active = (p + 1) % s.players.length;
      s.phase = s.active === s.first ? "start" : "home";
      break;
    case "beginTurn":
      startTurn(s);
      break;
    case "rest":
      endTurn(s, true);
      break;
    case "free":
      x.pools[a.color!] = 1;
      s.phase = "act";
      break;
    case "play":
    case "dual": {
      const c = CARDS[a.card!];
      x.pools[c.color] += c.rank + systems(s, p, "Yellow");
      discard(s, p, [a.card!]);
      x.flags.playedColor = COLORS.indexOf(c.color) + 1;
      if (a.a === "dual") {
        const c2 = CARDS[a.cards![0]];
        x.pools[c2.color]++;
        discard(s, p, a.cards!);
      }
      s.phase = "act";
      if (
        has(s, p, "c37") &&
        (c.color === "Yellow" ||
          a.cards?.some((id) => CARDS[id].color === "Yellow"))
      ) {
        trigger(s, p, "c37");
        queue(s, { kind: "upgrade", who: p, target: -1 });
      }
      break;
    }
    case "wild":
      discard(s, p, a.cards!);
      x.pools[a.color!] = 2;
      s.phase = "act";
      break;
    case "boost":
      discard(s, p, [a.card!]);
      x.pools[CARDS[a.card!].color]++;
      break;
    case "study":
      spend(s, p, "Blue", 1);
      gainResearch(s, p);
      break;
    case "invent":
      spend(s, p, "Blue", 1);
      invent(s, p, a.card!);
      record(s, x.name + " invented " + CARDS[a.card!].techName + ".");
      break;
    case "upgrade":
      spend(s, p, "Blue", 1);
      s.fleets.find((f) => f.id === a.fleet)!.level = 2;
      break;
    case "draw":
      spend(s, p, "Yellow", 1);
      x.flags.draw = 1;
      draw(s, p);
      break;
    case "reveal": {
      spend(s, p, "Green", 1);
      l!.faceUp = true;
      x.stats.reveals++;
      if (CARDS[l!.card!].kind !== "system") {
        gainTrophy(s, p);
        gainResearch(s, p);
      } else
        for (const pl of l!.planets)
          resource(s, p, l!, pl.resource, pl.resource === "none" ? 0 : 1);
      record(s, x.name + " revealed " + locationName(l!));
      break;
    }
    case "move": {
      x.flags["visited:" + a.to] = (x.flags["visited:" + a.to] ?? 0) + 1;
      if (a.amount === 0) trigger(s, p, "c33");
      const f = s.fleets.find((f) => f.id === a.fleet)!;
      spend(s, p, a.color!, a.amount!);
      if (a.color === "Green") moveSelected(s, a.fleets!, a.to!);
      else f.wp = a.to!;
      break;
    }
    case "build": {
      const planets = a.planets!;
      spend(
        s,
        p,
        "Yellow",
        planets.reduce(
          (n, i) => n + buildCost(s, l!, p, i),
          enemyFleets(s, l!, p),
        ),
      );
      for (const i of planets) {
        if (l!.planets[i].civs.length) trigger(s, p, "c39");
        if (has(s, p, "c43")) trigger(s, p, "c43");
        placeCiv(s, p, l!, i);
      }
      x.commerceUsed.push(l!.id);
      break;
    }
    case "commerce":
      spend(s, p, "Yellow", 1);
      x.commerceUsed.push(l!.id);
      commerce(s, p, l!, a.mode!);
      break;
    case "exploit": {
      spend(s, p, "Green", 1);
      const owners = [
        ...new Set(l!.planets[a.planet!].civs.map((c) => c.owner)),
      ].filter((owner) => has(s, owner, "c40"));
      const count = owners.reduce(
        (n, owner) => n + civsAt(l!, owner).length,
        0,
      );
      owners.forEach((owner) => trigger(s, owner, "c40"));
      queue(
        s,
        ...Array.from({ length: count }, () => ({
          kind: "casualty",
          who: p,
          location: l!.id,
        })),
        {
          kind: "exploitAfter",
          who: p,
          location: l!.id,
          amount: a.amount,
          data: { planet: a.planet },
        },
      );
      break;
    }
    case "conquer": {
      spend(s, p, "Red", 1 + enemyFleets(s, l!, p));
      const value = power(s, p, l!) + (CARDS[a.card!]?.rank ?? 0);
      discard(s, p, [a.card!]);
      const rank = flip(s);
      x.stats.conquerAttempts++;
      if (value >= rank) {
        const t = l!.planets[a.planet!];
        while (t.civs.length)
          removeCiv(
            s,
            l!,
            a.planet!,
            0,
            has(s, p, "c41") && t.resource === "research" ? p : undefined,
          );
        const fleet = s.fleets.find((f) => f.id === a.fleet)!;
        removeFleet(s, fleet.id);
        placeCiv(s, p, l!, a.planet!);
        x.stats.conquerWins++;
        if (x.captured.length >= 2 && has(s, p, "c41"))
          finish(s, "Unification Theory", p);
      }
      record(
        s,
        x.name +
          " conquer: " +
          value +
          " vs " +
          rank +
          " — " +
          (value >= rank ? "success" : "failed"),
      );
      break;
    }
    case "attack": {
      spend(s, p, "Red", 1);
      if (has(s, a.target!, "c40")) {
        const count = civsAt(l!, a.target!).length;
        for (let i = 0; i < count; i++) {
          const f = fleetsAt(s, l!, p)[0];
          if (f) removeFleet(s, f.id);
        }
        trigger(s, a.target!, "c40");
      }
      if (fleetsAt(s, l!, p).length) battleStart(s, p, l!, a.target!);
      break;
    }
    case "anomalyCiv":
      spend(s, p, "Yellow", 3);
      l!.planets.push({
        resource: "none",
        resistance: 1,
        civs: [],
        exploited: false,
      });
      placeCiv(s, p, l!, 0);
      trigger(s, p, "c23");
      break;
    case "colony": {
      spend(s, p, "Green", 1);
      const old = l!.planets.find((t) => t.civs.some((c) => c.owner === p))!,
        i = old.civs.findIndex((c) => c.owner === p);
      const [c] = old.civs.splice(i, 1);
      const dest = s.locations.find((q) => q.id === a.target)!.planets[
        a.planet!
      ];
      dest.civs.push(c);
      dest.exploited = false;
      trigger(s, p, "c35");
      break;
    }
    case "sun": {
      discard(s, p, [a.card!]);
      x.flags.sun = 1;
      gainTrophy(s, p);
      s.discard.push(l!.card!);
      for (let pi = 0; pi < l!.planets.length; pi++)
        while (l!.planets[pi].civs.length) removeCiv(s, l!, pi);
      s.locations = s.locations.filter((q) => q.id !== l!.id);
      s.fleets = s.fleets.filter((f) => at(s, f.wp).length);
      trigger(s, p, "c31");
      break;
    }
    case "endTurn":
      endTurn(s);
      break;
  }
  pump(s);
  researchThresholds(s, beforeResearch);
  s.serial++;
  return null;
}
export function assertInvariants(s: GameState) {
  const ids = [
    ...s.deck,
    ...s.discard,
    ...s.removed,
    ...s.resolving,
    ...s.players.flatMap((p) => [...p.hand, ...p.techs]),
    ...s.locations.flatMap((l) => (l.card ? [l.card] : [])),
  ];
  const expected = s.novaAdded ? 57 : 56;
  if (ids.length !== expected || new Set(ids).size !== ids.length)
    throw Error("Card conservation " + ids.length + "/" + expected);
  for (let p = 0; p < s.players.length; p++) {
    if (supply(s, p) < 0 || supply(s, p) > 15)
      throw Error("Token conservation");
    if (s.players[p].hand.length > CONFIG.HAND_LIMIT) throw Error("Hand limit");
    if (Object.values(s.players[p].pools).some((n) => n < 0))
      throw Error("Negative actions");
  }
  for (const f of s.fleets)
    if (!at(s, f.wp).length) throw Error("Orphan fleet");
  if (
    s.locations.flatMap((l) => l.planets).filter((t) => t.exploited).length +
      s.fleets.filter((f) => f.sun).length >
    10
  )
    throw Error("Exploit supply");
  if (!s.over && !legalActions(s).length) throw Error("No legal continuation");
}
export function actionCost(s: GameState, a: Action): string {
  const p = seatOnClock(s),
    l = s.locations.find((q) => q.id === a.location);
  if (["study", "invent", "upgrade"].includes(a.a)) return "1 Science AP";
  if (["draw", "commerce"].includes(a.a)) return "1 Commerce AP";
  if (a.a === "build")
    return (
      a.planets!.reduce(
        (n, i) => n + buildCost(s, l!, p, i),
        enemyFleets(s, l!, p),
      ) +
      " Commerce AP · " +
      a.planets!.length +
      " supply tokens"
    );
  if (a.a === "anomalyCiv") return "3 Commerce AP · 1 supply token";
  if (["reveal", "exploit", "colony"].includes(a.a)) return "1 Exploration AP";
  if (a.a === "attack") return "1 Military AP";
  if (a.a === "conquer")
    return 1 + enemyFleets(s, l!, p) + " Military AP · chosen battle card";
  if (a.a === "move")
    return (
      a.amount +
      " " +
      (a.color === "Green" ? "Exploration" : "Military") +
      " AP"
    );
  if (["play", "boost"].includes(a.a)) return "Discard the selected card";
  if (["dual", "wild"].includes(a.a)) return "Discard both selected cards";
  if (["setupFleet", "setupCiv"].includes(a.a)) return "1 deployment point";
  return "No additional action points";
}
