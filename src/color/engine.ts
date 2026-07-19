// =============================================================================
// COLOR-GROUPS MODE — the whole rules engine in one file (plus its bot).
//
// This is the stripped-down core experiment: no card abilities, no money, no
// deploys, no decision prompts. Because every resolution is automatic, there
// is no frame machine here — an action fully resolves synchronously.
//
// Rules implemented (variants in ColorVariant, numbers in config COLOR_CFG):
//   • Tiles are dominoes with a COLOR on each half (always two different
//     colors; special ★ tiles have no color, just bonus points per half).
//   • Same-colored halves that touch orthogonally form contiguous GROUPS
//     (groups freely span tiles and merge when a placement connects them).
//   • MATCH: when a placed half joins an existing group, the placer adds
//     MATCH_INFLUENCE to that group's pool (not to a card — the GROUP holds
//     influence). A half that starts a fresh 1-cell group adds nothing.
//   • A group scores the moment its ENTIRE perimeter (every empty-able cell
//     orthogonally adjacent to any of its cells) is occupied — by anything,
//     any color. Most influence takes the value; ties split (TIE_DIVISOR);
//     zero influence scores no one. Influence returns to supplies.
//   • Value = FIXED or SIZE×per-tile (variant), + adjacent ★ bonuses
//     (variant), + gold's bonus (powers variant).
//   • Color powers (variant, all promptless): red steals instead of adds,
//     green adds double, gold scores bonus, violet hides the breakdown until
//     scored (UI-only — engine stores real numbers), cyan pays the runner-up.
//
// Shape mirrors the classic engine: newColorGame() → ColorState,
// applyColor(s, action) mutates in place and returns null | rejection
// string. The App clones state per action exactly like classic mode, so
// undo works identically. Turns auto-advance after the mandatory placement.
// =============================================================================

import { COLOR_CFG, COLOR_DEFS, CONFIG } from "../data/config";
import { B_OFFSET, ORTHO } from "../game/grid";
import type { Cell } from "../game/types";
import { cellKey } from "../game/types";

export type ColorKey = (typeof COLOR_DEFS)[number]["key"];

export interface ColorVariant {
  scoring: "fixed" | "size"; // variation 2 vs 3
  specials: boolean; // variation 4: ★ bonus tiles in the deck
  powers: boolean; // variation 5: per-color qualitative rules
}

/** One physical tile. Color tiles: a/b are colors. Special tiles: a/b null,
 *  bonus holds the two halves' point bonuses. */
export interface ColorTile {
  id: number;
  a: ColorKey | null;
  b: ColorKey | null;
  bonus?: [number, number];
}

export interface ColorPlaced {
  id: number;
  cellA: Cell;
  cellB: Cell;
  rot: number;
}

export interface ColorGroup {
  id: number;
  color: ColorKey;
  cells: string[]; // cellKeys belonging to the group
  inf: number[]; // influence per player index
  scored: boolean;
  scoredLabel?: string;
}

export interface ColorPlayerState {
  name: string;
  color: string;
  isBot?: boolean;
  pts: number;
  supply: number;
  hand: number[]; // tile ids
}

export interface ColorTelem {
  matchesByColor: Record<ColorKey, number>;
  groupsScored: number;
  scoredZero: number;
  infAdded: number;
  infRemoved: number;
  placements: number;
}

export interface ColorLogEntry {
  turn: number;
  p: number | null;
  msg: string;
}

export interface ColorState {
  mode: "colors"; // discriminant vs the classic GameState
  variant: ColorVariant;
  players: ColorPlayerState[];
  tiles: Record<number, ColorTile>;
  deck: number[];
  board: Record<number, ColorPlaced>;
  cellOwner: Record<string, number>; // cell → tile id
  cellColor: Record<string, ColorKey | null>; // cell → color (null = ★)
  cellBonus: Record<string, number>; // cell → ★ bonus points
  groups: Record<number, ColorGroup>;
  cellGroup: Record<string, number>; // cell → group id (color cells only)
  nextGroup: number;
  turn: { n: number; p: number; setup: boolean };
  over: boolean;
  ranking?: number[];
  passPending: boolean;
  log: ColorLogEntry[];
  telem: ColorTelem;
}

export type ColorAction =
  | { a: "beginTurn" }
  | { a: "place"; tile: number; at: Cell; rot: number };

const log = (s: ColorState, p: number | null, msg: string) =>
  s.log.push({ turn: s.turn.n, p, msg });
const pname = (s: ColorState, p: number) => s.players[p].name;
const colorName = (c: ColorKey) => COLOR_DEFS.find((d) => d.key === c)!.name;

export function cellsFor(a: Cell, rot: number): [Cell, Cell] {
  const o = B_OFFSET[((rot % 4) + 4) % 4];
  return [a, { x: a.x + o.x, y: a.y + o.y }];
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

export function newColorGame(
  playersIn: { name: string; color: string; isBot?: boolean }[],
  variant: ColorVariant,
): ColorState {
  const n = playersIn.length;
  if (n < CONFIG.MIN_PLAYERS || n > CONFIG.MAX_PLAYERS)
    throw new Error(
      `Player count must be ${CONFIG.MIN_PLAYERS}–${CONFIG.MAX_PLAYERS}`,
    );

  // deck: every unordered pair of two DIFFERENT colors × copies (+ specials)
  const tiles: Record<number, ColorTile> = {};
  let id = 0;
  for (let i = 0; i < COLOR_DEFS.length; i++)
    for (let j = i + 1; j < COLOR_DEFS.length; j++)
      for (let c = 0; c < COLOR_CFG.COPIES_PER_PAIR; c++) {
        id++;
        tiles[id] = { id, a: COLOR_DEFS[i].key, b: COLOR_DEFS[j].key };
      }
  if (variant.specials)
    for (const [ba, bb] of COLOR_CFG.SPECIAL_TILES) {
      id++;
      tiles[id] = { id, a: null, b: null, bonus: [ba, bb] };
    }

  const deck = Object.keys(tiles).map(Number);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  const s: ColorState = {
    mode: "colors",
    variant,
    players: playersIn.map((p) => ({
      name: p.name,
      color: p.color,
      isBot: !!p.isBot,
      pts: 0,
      supply: CONFIG.INFLUENCE_SUPPLY,
      hand: [],
    })),
    tiles,
    deck,
    board: {},
    cellOwner: {},
    cellColor: {},
    cellBonus: {},
    groups: {},
    cellGroup: {},
    nextGroup: 1,
    turn: { n: 0, p: 0, setup: true },
    over: false,
    passPending: true,
    log: [],
    telem: {
      matchesByColor: { red: 0, cyan: 0, green: 0, gold: 0, violet: 0 },
      groupsScored: 0,
      scoredZero: 0,
      infAdded: 0,
      infRemoved: 0,
      placements: 0,
    },
  };
  for (let i = 0; i < CONFIG.STARTING_HAND; i++)
    for (let p = 0; p < n; p++)
      if (s.deck.length > 0) s.players[p].hand.push(s.deck.shift()!);
  log(
    s,
    null,
    `COLOR GROUPS — ${playersIn.map((p) => p.name).join(", ")} · scoring: ${variant.scoring}` +
      (variant.specials ? " · ★ tiles" : "") +
      (variant.powers ? " · color powers" : ""),
  );
  log(s, 0, `${playersIn[0].name} opens on the origin cell`);
  return s;
}

// ---------------------------------------------------------------------------
// Queries (exported for the UI and the bot)
// ---------------------------------------------------------------------------

export function placementCheckC(
  s: ColorState,
  at: Cell,
  rot: number,
): { ok: boolean; reason?: string } {
  const [ca, cb] = cellsFor(at, rot);
  for (const c of [ca, cb])
    if (s.cellOwner[cellKey(c)] !== undefined)
      return { ok: false, reason: "Cell occupied" };
  if (s.turn.setup) {
    const covers =
      (ca.x === 0 && ca.y === 0) || (cb.x === 0 && cb.y === 0);
    return covers
      ? { ok: true }
      : { ok: false, reason: "First tile must cover the origin cell" };
  }
  for (const c of [ca, cb])
    for (const o of ORTHO) {
      const nb = { x: c.x + o.x, y: c.y + o.y };
      if (nb.x === ca.x && nb.y === ca.y) continue;
      if (nb.x === cb.x && nb.y === cb.y) continue;
      if (s.cellOwner[cellKey(nb)] !== undefined) return { ok: true };
    }
  return { ok: false, reason: "Must touch an existing tile" };
}

/** Group ids of same-colored halves orthogonally adjacent to `cell` (own
 *  partner cell excluded — the internal edge joins but never "matches"). */
function adjacentGroups(
  s: ColorState,
  cell: Cell,
  color: ColorKey,
  exclude: Cell,
): number[] {
  const found = new Set<number>();
  for (const o of ORTHO) {
    const nb = { x: cell.x + o.x, y: cell.y + o.y };
    if (nb.x === exclude.x && nb.y === exclude.y) continue;
    const k = cellKey(nb);
    if (s.cellColor[k] === color && s.cellGroup[k] !== undefined)
      found.add(s.cellGroup[k]);
  }
  return [...found];
}

/** Every empty cell orthogonally adjacent to any of the given cells. */
export function openPerimeter(s: ColorState, cells: string[]): string[] {
  const own = new Set(cells);
  const open = new Set<string>();
  for (const ck of cells) {
    const [x, y] = ck.split(",").map(Number);
    for (const o of ORTHO) {
      const k = cellKey({ x: x + o.x, y: y + o.y });
      if (!own.has(k) && s.cellOwner[k] === undefined) open.add(k);
    }
  }
  return [...open];
}

/** The value a group would score for right now (variant-aware). */
export function groupValue(s: ColorState, g: ColorGroup): number {
  let v =
    s.variant.scoring === "fixed"
      ? COLOR_CFG.GROUP_SCORE_FIXED
      : g.cells.length * COLOR_CFG.GROUP_SCORE_PER_TILE;
  if (s.variant.specials) {
    // each ★ half touching the group adds its bonus (each ★ cell once)
    const counted = new Set<string>();
    for (const ck of g.cells) {
      const [x, y] = ck.split(",").map(Number);
      for (const o of ORTHO) {
        const k = cellKey({ x: x + o.x, y: y + o.y });
        if (counted.has(k)) continue;
        if (s.cellBonus[k]) {
          counted.add(k);
          v += s.cellBonus[k];
        }
      }
    }
  }
  if (s.variant.powers && g.color === "gold") v += COLOR_CFG.POWER_GOLD_BONUS;
  return v;
}

/** UI preview: would each half of this tile match (join a group) here? */
export function previewMatches(
  s: ColorState,
  tileId: number,
  at: Cell,
  rot: number,
): { a: boolean; b: boolean } {
  const tile = s.tiles[tileId];
  const [ca, cb] = cellsFor(at, rot);
  return {
    a: !!tile.a && adjacentGroups(s, ca, tile.a, cb).length > 0,
    b: !!tile.b && adjacentGroups(s, cb, tile.b, ca).length > 0,
  };
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

function addInf(s: ColorState, g: ColorGroup, p: number, n: number) {
  for (let i = 0; i < n; i++) {
    if (s.players[p].supply <= 0) {
      log(s, p, `influence fizzles — supply empty`);
      return;
    }
    s.players[p].supply--;
    g.inf[p]++;
    s.telem.infAdded++;
  }
  log(s, p, `adds ${n} influence to the ${colorName(g.color)} group (${g.cells.length})`);
}

/** The one influence event of the game: a placed half joined group g. */
function resolveMatch(s: ColorState, g: ColorGroup, p: number) {
  s.telem.matchesByColor[g.color]++;
  if (s.variant.powers && g.color === "red") {
    // Muscle: steal — remove 1 from the leading opponent (add if none)
    let target = -1;
    for (let q = 0; q < s.players.length; q++)
      if (q !== p && g.inf[q] > 0 && (target === -1 || g.inf[q] > g.inf[target]))
        target = q;
    if (target !== -1) {
      g.inf[target]--;
      s.players[target].supply++;
      s.telem.infRemoved++;
      log(
        s,
        p,
        `MUSCLE match: removes 1 of ${pname(s, target)}'s influence from the red group`,
      );
      return;
    }
  }
  const n =
    s.variant.powers && g.color === "green"
      ? COLOR_CFG.POWER_GREEN_ADD
      : COLOR_CFG.MATCH_INFLUENCE;
  addInf(s, g, p, n);
}

function scoreGroup(s: ColorState, g: ColorGroup, why: string) {
  const value = groupValue(s, g);
  const total = g.inf.reduce((a, b) => a + b, 0);
  s.telem.groupsScored++;
  let label: string;
  if (total === 0) {
    s.telem.scoredZero++;
    label = "nobody";
    log(s, null, `${colorName(g.color)} group (${g.cells.length}) sealed empty — scores no one`);
  } else {
    const top = Math.max(...g.inf);
    const winners = g.inf
      .map((v, q) => ({ v, q }))
      .filter((e) => e.v === top)
      .map((e) => e.q);
    if (winners.length === 1) {
      s.players[winners[0]].pts += value;
      label = `${pname(s, winners[0])} +${value}`;
    } else {
      const each = Math.floor(value / CONFIG.TIE_DIVISOR);
      for (const q of winners) s.players[q].pts += each;
      label = winners.map((q) => `${pname(s, q)} +${each}`).join(", ");
    }
    // Intel power: the runner-up count also scores half (rounded down)
    if (s.variant.powers && g.color === "cyan") {
      const seconds = [...new Set(g.inf.filter((v) => v > 0 && v < top))];
      if (seconds.length > 0) {
        const second = Math.max(...seconds);
        const half = Math.floor(value / 2);
        if (half > 0)
          for (let q = 0; q < s.players.length; q++)
            if (g.inf[q] === second) {
              s.players[q].pts += half;
              label += `, ${pname(s, q)} +${half} (intel)`;
            }
      }
    }
    log(s, null, `${colorName(g.color)} group (${g.cells.length} cells, ${value} pts) ${why}: ${label}`);
  }
  for (let q = 0; q < s.players.length; q++) {
    s.players[q].supply += g.inf[q];
    g.inf[q] = 0;
  }
  g.scored = true;
  g.scoredLabel = label;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export function applyColor(s: ColorState, action: ColorAction): string | null {
  if (s.over) return "Game is over";
  switch (action.a) {
    case "beginTurn":
      if (!s.passPending) return "Turn already started";
      s.passPending = false;
      if (!s.turn.setup)
        log(s, s.turn.p, `— turn ${s.turn.n}: ${pname(s, s.turn.p)} —`);
      return null;
    case "place":
      return actPlaceC(s, action.tile, action.at, action.rot);
  }
}

function actPlaceC(
  s: ColorState,
  tileId: number,
  at: Cell,
  rot: number,
): string | null {
  const p = s.turn.p;
  if (s.passPending) return "Pass the device first";
  const hand = s.players[p].hand;
  const idx = hand.indexOf(tileId);
  if (idx === -1) return "Tile not in hand";
  const check = placementCheckC(s, at, rot);
  if (!check.ok) return check.reason!;

  const tile = s.tiles[tileId];
  const [ca, cb] = cellsFor(at, rot);
  hand.splice(idx, 1);
  s.board[tileId] = { id: tileId, cellA: ca, cellB: cb, rot };
  s.cellOwner[cellKey(ca)] = tileId;
  s.cellOwner[cellKey(cb)] = tileId;
  s.cellColor[cellKey(ca)] = tile.a;
  s.cellColor[cellKey(cb)] = tile.b;
  if (tile.bonus) {
    s.cellBonus[cellKey(ca)] = tile.bonus[0];
    s.cellBonus[cellKey(cb)] = tile.bonus[1];
  }
  s.telem.placements++;
  log(
    s,
    p,
    tile.a
      ? `places ${colorName(tile.a)}/${colorName(tile.b!)} at (${ca.x},${ca.y})`
      : `places a ★ tile (+${tile.bonus![0]}/+${tile.bonus![1]}) at (${ca.x},${ca.y})`,
  );

  // group each colored half in: join/merge same-color neighbors, then the
  // MATCH rule — joining an existing group adds influence (a fresh
  // singleton group does not)
  const halves: { cell: Cell; color: ColorKey | null; partner: Cell }[] = [
    { cell: ca, color: tile.a, partner: cb },
    { cell: cb, color: tile.b, partner: ca },
  ];
  for (const h of halves) {
    if (!h.color) continue; // ★ halves join no group
    const joined = adjacentGroups(s, h.cell, h.color, h.partner);
    // the internal edge can also connect (future same-color pairs): include
    // the partner's group for MERGING but never for the match reward
    const pk = cellKey(h.partner);
    if (s.cellColor[pk] === h.color && s.cellGroup[pk] !== undefined)
      joined.push(s.cellGroup[pk]);
    const uniq = [...new Set(joined)];
    if (uniq.length === 0) {
      const g: ColorGroup = {
        id: s.nextGroup++,
        color: h.color,
        cells: [cellKey(h.cell)],
        inf: s.players.map(() => 0),
        scored: false,
      };
      s.groups[g.id] = g;
      s.cellGroup[cellKey(h.cell)] = g.id;
      continue;
    }
    // merge everything into the first group
    const main = s.groups[uniq[0]];
    for (const gid of uniq.slice(1)) {
      const other = s.groups[gid];
      for (const ck of other.cells) s.cellGroup[ck] = main.id;
      main.cells.push(...other.cells);
      for (let q = 0; q < s.players.length; q++) main.inf[q] += other.inf[q];
      delete s.groups[gid];
    }
    main.cells.push(cellKey(h.cell));
    s.cellGroup[cellKey(h.cell)] = main.id;
    const matched = adjacentGroups(s, h.cell, h.color, h.partner).length > 0;
    if (matched) resolveMatch(s, main, p);
  }

  // seal check: any unscored group with no open perimeter scores now
  for (const g of Object.values(s.groups))
    if (!g.scored && openPerimeter(s, g.cells).length === 0)
      scoreGroup(s, g, "sealed");

  // draw up + advance (turns auto-end after the mandatory placement)
  while (
    s.players[p].hand.length < CONFIG.HAND_REFILL &&
    s.deck.length > 0
  )
    s.players[p].hand.push(s.deck.shift()!);

  const everyoneDry = s.players.every((q) => q.hand.length === 0);
  if (everyoneDry) {
    endColorGame(s);
    return null;
  }
  // next player who still has tiles (deck may be empty late game)
  let np = (p + 1) % s.players.length;
  while (s.players[np].hand.length === 0) np = (np + 1) % s.players.length;
  s.turn = { n: s.turn.n + 1, p: np, setup: false };
  s.passPending = true;
  return null;
}

function endColorGame(s: ColorState) {
  // open groups at the end score per config (default: they die unscored)
  const mode = COLOR_CFG.ENDGAME_OPEN_GROUPS;
  for (const g of Object.values(s.groups)) {
    if (g.scored) continue;
    if (mode === "none") {
      log(s, null, `${colorName(g.color)} group (${g.cells.length}) left open — no score`);
      for (let q = 0; q < s.players.length; q++) {
        s.players[q].supply += g.inf[q];
        g.inf[q] = 0;
      }
      g.scored = true;
      g.scoredLabel = "open — unscored";
    } else {
      if (mode === "half") {
        // halve by scoring as a tie-style payout: floor(value/2) to the top
        const value = Math.floor(groupValue(s, g) / 2);
        const total = g.inf.reduce((a, b) => a + b, 0);
        if (total > 0) {
          const top = Math.max(...g.inf);
          const winners = g.inf
            .map((v, q) => ({ v, q }))
            .filter((e) => e.v === top);
          const each =
            winners.length === 1
              ? value
              : Math.floor(value / CONFIG.TIE_DIVISOR);
          for (const w of winners) s.players[w.q].pts += each;
          g.scoredLabel = winners
            .map((w) => `${pname(s, w.q)} +${each} (open)`)
            .join(", ");
          log(s, null, `${colorName(g.color)} open group scores half: ${g.scoredLabel}`);
        }
        for (let q = 0; q < s.players.length; q++) {
          s.players[q].supply += g.inf[q];
          g.inf[q] = 0;
        }
        g.scored = true;
      } else {
        scoreGroup(s, g, "open at game end");
      }
    }
  }
  s.over = true;
  const idx = s.players.map((_, i) => i);
  idx.sort((a, b) => s.players[b].pts - s.players[a].pts);
  s.ranking = idx;
  log(s, null, "GAME OVER");
  for (const i of idx) log(s, i, `${pname(s, i)}: ${s.players[i].pts} pts`);
  log(s, idx[0], `${pname(s, idx[0])} wins`);
}

// ---------------------------------------------------------------------------
// Bot (same philosophy as the classic bot: legal-by-construction, greedy,
// jittered). No prompts exist in this mode, so it only picks placements.
// ---------------------------------------------------------------------------

export function isColorBotTurn(s: ColorState): boolean {
  return !s.over && !!s.players[s.turn.p].isBot;
}

export function colorBotDecide(
  s: ColorState,
  rnd: () => number = Math.random,
): ColorAction {
  if (s.passPending) return { a: "beginTurn" };
  const p = s.turn.p;
  const hand = s.players[p].hand;

  // candidate anchors: free cells adjacent to the board + one ring out
  const anchors: Cell[] = [];
  const seen = new Set<string>();
  const add = (c: Cell) => {
    const k = cellKey(c);
    if (!seen.has(k) && s.cellOwner[k] === undefined) {
      seen.add(k);
      anchors.push(c);
    }
  };
  if (s.turn.setup) {
    add({ x: 0, y: 0 });
    add({ x: 1, y: 0 });
    add({ x: 0, y: 1 });
    add({ x: -1, y: 0 });
    add({ x: 0, y: -1 });
  } else {
    for (const pl of Object.values(s.board))
      for (const c of [pl.cellA, pl.cellB])
        for (const o of ORTHO) add({ x: c.x + o.x, y: c.y + o.y });
    for (const c of [...anchors])
      for (const o of ORTHO) add({ x: c.x + o.x, y: c.y + o.y });
  }

  let best: { tile: number; at: Cell; rot: number; score: number } | null =
    null;
  for (const tile of hand)
    for (const at of anchors)
      for (const rot of [0, 1, 2, 3]) {
        if (!placementCheckC(s, at, rot).ok) continue;
        const score = scoreColorPlacement(s, p, tile, at, rot) + rnd() * 0.5;
        if (!best || score > best.score) best = { tile, at, rot, score };
      }
  // a legal spot always exists on an unbounded grid
  return { a: "place", tile: best!.tile, at: best!.at, rot: best!.rot };
}

function scoreColorPlacement(
  s: ColorState,
  p: number,
  tileId: number,
  at: Cell,
  rot: number,
): number {
  const tile = s.tiles[tileId];
  const [ca, cb] = cellsFor(at, rot);
  let v = 0;
  const joins: Record<number, boolean> = {}; // group id → my half matches it
  for (const h of [
    { cell: ca, color: tile.a, partner: cb },
    { cell: cb, color: tile.b, partner: ca },
  ]) {
    if (!h.color) continue;
    const gs = adjacentGroups(s, h.cell, h.color, h.partner);
    if (gs.length > 0) v += 1; // a match = influence gained
    for (const gid of gs) joins[gid] = true;
  }
  // sealing evaluation: which groups end with zero open perimeter once the
  // two new cells fill in (a joined group also grows by my matching cell)
  const kA = cellKey(ca);
  const kB = cellKey(cb);
  for (const g of Object.values(s.groups)) {
    if (g.scored) continue;
    const cells = [...g.cells];
    if (joins[g.id]) {
      if (s.tiles[tileId].a === g.color) cells.push(kA);
      if (s.tiles[tileId].b === g.color) cells.push(kB);
    }
    const open = openPerimeter(s, cells).filter((k) => k !== kA && k !== kB);
    if (open.length > 0) continue; // stays open
    const value = groupValue(s, g);
    const myInf = g.inf[p] + (joins[g.id] ? 1 : 0);
    const top = Math.max(...g.inf.map((n, q) => (q === p ? myInf : n)));
    const leaders = g.inf
      .map((n, q) => (q === p ? myInf : n))
      .filter((n) => n === top && n > 0).length;
    if (top === 0)
      v += s.players.length === 2 ? 0.8 : 0.3; // deny a neutral group
    else if (myInf === top)
      v += leaders === 1 ? 2 + value : value / 2;
    else v -= 1 + value; // would gift the group
  }
  return v;
}
