import { CONFIG } from "../data/config";
import { def, isDisabled } from "./cards";
import type { GameState } from "./types";

// Queries over players' tableaus. Disabled cards (cards.json `disabled: true`)
// never contribute.

function activeSpecs(s: GameState, p: number): { id: number; spec: any }[] {
  return s.players[p].tableau
    .filter((id) => !isDisabled(id))
    .map((id) => ({ id, spec: def(id).spec }));
}

function modValue(s: GameState, p: number, key: string): number | null {
  let best: number | null = null;
  for (const { spec } of activeSpecs(s, p)) {
    if (spec.o === "modifier" && spec.key === key) {
      const v = typeof spec.value === "number" ? spec.value : 1;
      best = best === null ? v : Math.max(best, v);
    }
  }
  return best;
}

export function hasMod(s: GameState, p: number, key: string): boolean {
  return modValue(s, p, key) !== null;
}

// ---- match-strength / match-behavior modifiers ----
export const muscleCount = (s: GameState, p: number) =>
  modValue(s, p, "muscleCount") ?? CONFIG.MUSCLE_REMOVE;
export const creditValue = (s: GameState, p: number) =>
  modValue(s, p, "creditValue") ?? CONFIG.CREDIT_GAIN;
export const whisperMax = (s: GameState, p: number) =>
  modValue(s, p, "whisperCount") ?? CONFIG.WHISPER_MOVE;
export const intelAlsoPlaced = (s: GameState, p: number) =>
  modValue(s, p, "intelAlsoPlaced") ?? 0; // Grid Worm: extra tokens onto placed card
export const favorRedirect = (s: GameState, p: number) =>
  hasMod(s, p, "favorRedirect"); // Committee Chair
export const whisperAnyAdjacent = (s: GameState, p: number) =>
  hasMod(s, p, "whisperAnyAdjacent"); // Rumor Mill

// ---- economy / placement modifiers ----
export const deployDiscount = (s: GameState, p: number) =>
  modValue(s, p, "deployDiscount") ?? 0;
export const enforcerBonus = (s: GameState, p: number) =>
  modValue(s, p, "enforcerBonus") ?? 0; // Union Boss
export const adjSocialiteBonus = (s: GameState, p: number) =>
  modValue(s, p, "adjSocialiteBonus") ?? 0; // It Couple

// ---- protections / blocks ----
export const protectsVsMuscle = (s: GameState, owner: number) =>
  hasMod(s, owner, "protectMuscle"); // Untouchable
export const protectsVsWhisper = (s: GameState, owner: number) =>
  hasMod(s, owner, "protectWhisper"); // Firewall
export const protectAt = (s: GameState, owner: number) =>
  modValue(s, owner, "protectAt"); // The Wall threshold or null
export const blockMoveOffAt = (s: GameState, q: number) =>
  modValue(s, q, "blockMoveOffAt"); // Bouncer threshold or null

// ---- scoring modifiers ----
export const winsTies = (s: GameState, p: number) => hasMod(s, p, "winTies"); // Incumbent
export const soloBonus = (s: GameState, p: number) =>
  modValue(s, p, "soloBonus") ?? 0; // Kingmaker

// ---- visibility ----
export const seesHands = (s: GameState, p: number) => hasMod(s, p, "seeHands"); // Open Feed

/** Players (≠ except) holding a `listen` ongoing for the given event. */
export function listeners(
  s: GameState,
  ev: string,
): { p: number; money: number; card: number }[] {
  const out: { p: number; money: number; card: number }[] = [];
  for (let p = 0; p < s.players.length; p++) {
    for (const { id, spec } of activeSpecs(s, p)) {
      if (spec.o === "listen" && spec.ev === ev)
        out.push({ p, money: spec.money ?? 1, card: id });
    }
  }
  return out;
}

/** Start-of-turn trigger specs for player p (both auto and optional). */
export function startOfTurnTriggers(
  s: GameState,
  p: number,
): { id: number; spec: any }[] {
  return activeSpecs(s, p).filter(({ spec }) => spec.o === "startOfTurn");
}

/** On-placement trigger specs for player p filtered by placed card type. */
export function onPlaceTriggers(
  s: GameState,
  p: number,
  placedType: string,
): { id: number; spec: any }[] {
  return activeSpecs(s, p).filter(
    ({ spec }) => spec.o === "onPlace" && spec.type === placedType,
  );
}
