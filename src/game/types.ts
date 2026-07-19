// =============================================================================
// Core types for the SPYPUNK engine.
//
// Design constraint: ALL game state is plain serializable data (no classes,
// functions, Maps or Sets inside GameState) so structuredClone can snapshot it
// for undo and JSON.stringify can dump it for telemetry. Keep it that way.
// Module map + how the pieces connect: see ARCHITECTURE.md at the repo root.
// =============================================================================

/** The five edge symbols. Match rules per symbol live in runtime.ts (m_*). */
export type Sym = "muscle" | "intel" | "favor" | "credit" | "whisper";

/** The six card types (flavor + type-referencing effects like Union Boss). */
export type CType =
  | "Assassin"
  | "Enforcer"
  | "Senator"
  | "Broker"
  | "Hacker"
  | "Socialite";

/**
 * One card. cards.json supplies everything EXCEPT pts, which cards.ts
 * derives at load time: pts = SYMBOL_VP[top] + SYMBOL_VP[bottom].
 * Symbols are hand-picked per card (thematic to the name; same symbol on
 * both halves is allowed).
 */
export interface CardDef {
  id: number;
  name: string;
  type: CType;
  cost: number; // $ to deploy
  pts: number; // DERIVED — value when scored by enclosure
  top: Sym; // symbol on the top half of the domino (from cards.json)
  bottom: Sym; // symbol on the bottom half (from cards.json)
  kind: "I" | "O"; // Instant (⚡ one-shot) or Ongoing (⟳ sits in tableau)
  text: string; // rules text shown in the UI
  spec: any; // machine-readable effect descriptor (see cards.json _readme)
  disabled?: boolean; // bench a broken effect mid-playtest (cards.json flag)
}

export interface Cell {
  x: number;
  y: number;
}

/** A domino on the grid. `a` is the cell of the TOP half, `b` of the BOTTOM half. */
export interface Placed {
  id: number;
  a: Cell;
  b: Cell;
  rot: number; // 0..3 clockwise quarter-turns from vertical (a above b)
  inf: number[]; // influence tokens per player index
  scored: boolean;
  scoredInfo?: { winners: number[]; each: number[]; label: string };
  lockBy?: number; // Filibuster: locked until this player's next turn starts
  placedBy: number;
  turnPlaced: number;
}

export interface PlayerState {
  name: string;
  color: string;
  isBot?: boolean; // true → src/game/bot.ts plays this seat automatically
  money: number;
  pts: number;
  supply: number; // influence tokens remaining in personal supply
  hand: number[]; // card ids
  tableau: number[]; // deployed Ongoing card ids
  lastPlaced?: number; // card id this player placed most recently
}

/** One pending item in a resolution hub (matches + triggers, player-ordered). */
export interface HubItem {
  key: string;
  label: string;
  sub?: string;
  optional?: boolean;
  // payload used by the hub handler to spawn the right frame:
  match?: { sym: Sym; placed: number; other: number };
  trig?: { card: number; owner: number };
}

/** Execution frame for the effect stack machine. Handlers keyed by `h`. */
export interface Frame {
  h: string;
  ph: number;
  d: any;
}

export type Pending =
  | { t: "hub"; title: string; items: HubItem[] }
  | { t: "card"; prompt: string; ids: number[]; skip?: string; who?: number }
  | {
      t: "owner";
      prompt: string;
      card: number;
      owners: { p: number; n: number }[];
      skip?: string;
    }
  | { t: "player"; prompt: string; players: number[]; who?: number }
  | {
      t: "opt";
      prompt: string;
      options: { k: string; label: string }[];
      who?: number;
    }
  | {
      t: "line";
      prompt: string;
      lines: { key: string; label: string; cells: string[] }[];
    }
  | { t: "deckOrder"; prompt: string; cards: number[] };

export type Answer =
  | { i: number; skip?: boolean } // hub item index (or per-item skip)
  | { card: number }
  | { p: number }
  | { k: string }
  | { key: string }
  | { order: number[] }
  | { skip: true };

export interface LogEntry {
  turn: number;
  p: number | null; // player index for color chip, null = system
  msg: string;
}

export interface Telemetry {
  matchesBySym: Record<Sym, number>;
  infAdded: number;
  infRemoved: number;
  infMoved: number;
  fizzledSupply: number; // adds that failed because supply was empty
  fizzledOther: number; // effects/portions that fizzled (protection, no targets…)
  moneyBySource: Record<string, number>;
  moneySpentOnDeploys: number;
  deploys: number;
  placements: number;
  enclosures: number;
  scoredZero: number; // enclosed cards that scored no one
  turns: number;
}

export interface TurnState {
  n: number; // 0 = setup placement, then 1,2,…
  p: number; // active player index
  deployed: boolean;
  placed: boolean;
  setup: boolean; // player 1's opening placement
}

export interface GameState {
  players: PlayerState[];
  deck: number[];
  discard: number[];
  board: Record<number, Placed>; // by card id
  cellOwner: Record<string, number>; // "x,y" -> card id
  turn: TurnState;
  finalPhase?: { remaining: number; setOnTurn: number };
  over: boolean;
  ranking?: number[]; // player indices, best first (set at game end)
  exec: Frame[];
  pending: Pending | null;
  ret?: any; // child-frame → parent-frame return register
  log: LogEntry[];
  telem: Telemetry;
  passPending: boolean; // pass-the-device screen is up
}

export const cellKey = (c: Cell) => `${c.x},${c.y}`;
