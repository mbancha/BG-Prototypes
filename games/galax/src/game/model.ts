import raw from "../data/cards.json";
import type { RngState } from "../kernel/rng";
export type Color = "Blue" | "Green" | "Red" | "Yellow";
export const COLORS: Color[] = ["Blue", "Green", "Red", "Yellow"];
export const COLOR_ACTION: Record<Color, string> = {
  Blue: "Science",
  Green: "Exploration",
  Red: "Military",
  Yellow: "Commerce",
};
export type Resource = "none" | "cards" | "fleet" | "research";
export interface Card {
  id: string;
  kind: string;
  color: Color;
  rank: number;
  name: string;
  techName: string;
  techText: string;
  techType: string;
  planets: { resource: Resource; resistance: number }[];
  burst: number;
  shield: number;
}
export const CARDS = Object.fromEntries(raw.map((c) => [c.id, c])) as Record<
  string,
  Card
>;
export interface Civ {
  id: number;
  owner: number;
  captives: number[];
}
export interface Planet {
  resource: Resource;
  resistance: number;
  civs: Civ[];
  exploited: boolean;
}
export interface Location {
  id: number;
  x: number;
  y: number;
  card: string | null;
  faceUp: boolean;
  home?: number;
  planets: Planet[];
}
export interface Fleet {
  id: number;
  owner: number;
  wp: string;
  level: 1 | 2;
  sun?: boolean;
}
export interface Player {
  name: string;
  color: string;
  isBot: boolean;
  hand: string[];
  techs: string[];
  research: number;
  trophies: number;
  homeColor: Color | null;
  homeCard: string | null;
  usedCapacity: number;
  pools: Record<Color, number>;
  commerceUsed: number[];
  flags: Record<string, number>;
  techTokens: number;
  captured: number[];
  shieldSystem: number | null;
  stats: {
    actions: Record<string, number>;
    invented: Record<string, number>;
    triggers: Record<string, number>;
    conquerAttempts: number;
    conquerWins: number;
    battles: number;
    battleWins: number;
    reveals: number;
    exploits: number;
  };
}
export interface Action {
  a: string;
  card?: string;
  cards?: string[];
  color?: Color;
  location?: number;
  planet?: number;
  planets?: number[];
  from?: string;
  to?: string;
  fleet?: number;
  fleets?: number[];
  target?: number;
  amount?: number;
  mode?: string;
  index?: number;
}
export interface Choice {
  label: string;
  action: Action;
}
export interface Task {
  kind: string;
  who: number;
  location?: number;
  card?: string;
  target?: number;
  amount?: number;
  ids?: number[];
  data?: Record<string, any>;
}
export interface Pending {
  who: number;
  title: string;
  options: Choice[];
  task: Task;
}
export interface Battle {
  location: number;
  attacker: number;
  defender: number;
  committed: Record<number, string[]>;
  bonusOwner?: number;
  bonusBurst?: number;
  exposed?: Record<number, string>;
}
export interface GameState {
  version: 1;
  seed: number;
  rng: RngState;
  setup: Seat[];
  players: Player[];
  locations: Location[];
  fleets: Fleet[];
  deck: string[];
  discard: string[];
  removed: string[];
  resolving: string[];
  active: number;
  first: number;
  turn: number;
  phase: "home" | "forces" | "start" | "generate" | "act";
  setupBudget: number;
  homeChosen: number | null;
  queue: Task[];
  pending: Pending | null;
  battle: Battle | null;
  nextId: number;
  reshuffles: number;
  novaAdded: boolean;
  nova: boolean;
  over: boolean;
  winners: number[];
  reason: string;
  log: { turn: number; msg: string }[];
  serial: number;
}
export interface Seat {
  name: string;
  color: string;
  isBot?: boolean;
}
export const emptyPools = (): Record<Color, number> => ({
  Blue: 0,
  Green: 0,
  Red: 0,
  Yellow: 0,
});
