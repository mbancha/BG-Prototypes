// =============================================================================
// PLAYER DECISIONS AND MULTI-STEP EFFECTS — the frame stack.
//
// The rule the whole architecture rests on: THE ENGINE NEVER BLOCKS AND NEVER
// PROMPTS. It cannot `await` a click, because an engine that can pause inside
// a function cannot be snapshotted, undone, replayed or simulated.
//
// So a decision is data. A handler that needs an answer writes the question
// into `s.pending` and returns; the answer arrives later as an ordinary
// action. Effects that need several steps ("choose a card, then choose whose
// token, then how many") run as FRAMES on `s.exec` — plain `{h, ph, d}`
// records naming a handler, its phase, and its payload — instead of as a call
// stack. pump() runs the top frame repeatedly until the stack drains or
// someone is asked a question.
//
// Handler protocol:
//   • called as (s, f) with f = the top frame; must run synchronously
//   • may mutate state, push child frames, ask(), or popFrame(s) when done
//   • WILL BE RE-CALLED after any child pops or any answer arrives — keep
//     your place in f.ph, keep your working data in f.d
//   • read an arriving answer exactly once, via takeAns(f)
//   • child → parent results go through setReturn/takeReturn
//
// What this buys you: chained card effects, targeted attacks, "may" triggers,
// reactions from a player who isn't the active one, discard-down-to-N,
// auctions, trades — all undoable mid-decision, all replayable, all
// answerable by a bot.
// =============================================================================

import type { Seat } from "./types";

export interface Frame {
  /** Handler name — a string, not a function, so frames stay serializable. */
  h: string;
  /** Which step the handler is on. The handler owns the meaning. */
  ph: number;
  /** Working payload. */
  d: any;
}

export interface Choice {
  /** Stable key the answer refers to. */
  k: string;
  label: string;
  sub?: string;
  disabled?: boolean;
}

/** A question parked for a player. Generic enough that one UI component can
 *  render any game's prompts — see ui/PendingPrompt.tsx. */
export interface Pending {
  t: "choose" | "chooseMany" | "number" | "order" | "confirm";
  prompt: string;
  /** WHOSE decision — often the active player, but not always: the victim of
   *  an attack, the defender in combat, everyone in a simultaneous bid. */
  who: Seat;
  options?: Choice[];
  /** chooseMany / number bounds. */
  min?: number;
  max?: number;
  /** Label for the decline button. Absent ⇒ the decision is mandatory. */
  skip?: string;
  /** Game-specific discriminator, so the UI can swap in a richer widget
   *  (e.g. tag "cell" ⇒ highlight the board instead of listing options). */
  tag?: string;
  /** Payload for that widget. Must stay serializable. */
  data?: any;
}

export interface Answer {
  /** choose / confirm — the chosen option key. */
  k?: string;
  /** chooseMany — the chosen option keys. */
  ks?: string[];
  /** number — the chosen amount. */
  n?: number;
  /** order — option keys, first to last. */
  order?: string[];
  /** The player declined a skippable decision. */
  skip?: boolean;
}

export interface HasDecisions {
  exec: Frame[];
  pending: Pending | null;
  /** Child-frame → parent-frame return register. Parents must read AND clear
   *  it (takeReturn) before pushing another child. */
  ret?: unknown;
}

export type Handler<S extends HasDecisions> = (s: S, f: Frame) => void;

/** Handlers live in a module-level registry, NOT in the state — functions are
 *  not serializable. Frames reference them by name. */
export const HANDLERS: Record<string, Handler<any>> = {};

export function registerFrame<S extends HasDecisions>(
  name: string,
  fn: Handler<S>,
): void {
  HANDLERS[name] = fn as Handler<any>;
}

export const pushFrame = (s: HasDecisions, h: string, d: any = {}): void => {
  s.exec.push({ h, ph: 0, d });
};

export const popFrame = (s: HasDecisions): void => {
  s.exec.pop();
};

export const topFrame = (s: HasDecisions): Frame | undefined =>
  s.exec[s.exec.length - 1];

/** True while an effect is mid-resolution — the UI should not offer normal
 *  turn actions, and `legalActions` should offer answers instead. */
export const busy = (s: HasDecisions): boolean =>
  s.pending !== null || s.exec.length > 0;

/** Park a question and stop. Returns so the caller can `return ask(...)`. */
export function ask(s: HasDecisions, p: Pending): void {
  s.pending = p;
}

/** Read the answer that arrived, exactly once. */
export function takeAns(f: Frame): Answer | undefined {
  const a = f.d.ans as Answer | undefined;
  f.d.ans = undefined;
  return a;
}

export const setReturn = (s: HasDecisions, v: unknown): void => {
  s.ret = v;
};

export function takeReturn<T>(s: HasDecisions): T | undefined {
  const v = s.ret as T | undefined;
  s.ret = undefined;
  return v;
}

/** Run frames until the stack empties or someone is asked something. */
export function pump<S extends HasDecisions>(s: S, guardLimit = 10000): void {
  let guard = 0;
  while (!s.pending && s.exec.length > 0) {
    if (++guard > guardLimit)
      throw new Error(
        `frame stack guard tripped — ${topFrame(s)?.h} is not popping`,
      );
    const f = s.exec[s.exec.length - 1];
    const h = HANDLERS[f.h];
    if (!h) throw new Error(`no frame handler registered: "${f.h}"`);
    h(s, f);
  }
}

/** Deliver an answer and resume. Returns a rejection string if it isn't a
 *  legal reply to the open question. */
export function answer<S extends HasDecisions>(
  s: S,
  ans: Answer,
  by?: Seat,
): string | null {
  const p = s.pending;
  if (!p) return "Nothing to answer";
  if (by !== undefined && by !== p.who) return "Not your decision";
  const bad = validateAnswer(p, ans);
  if (bad) return bad;
  const f = topFrame(s);
  if (!f) {
    s.pending = null;
    return null;
  }
  f.d.ans = ans;
  s.pending = null;
  pump(s);
  return null;
}

export function validateAnswer(p: Pending, ans: Answer): string | null {
  if (ans.skip) return p.skip ? null : "That decision can't be skipped";
  const keys = new Set((p.options ?? []).filter((o) => !o.disabled).map((o) => o.k));
  switch (p.t) {
    case "choose":
    case "confirm":
      if (ans.k === undefined) return "Pick an option";
      return keys.has(ans.k) ? null : "That option isn't available";
    case "chooseMany": {
      const ks = ans.ks ?? [];
      if (new Set(ks).size !== ks.length) return "Duplicate choice";
      for (const k of ks) if (!keys.has(k)) return "That option isn't available";
      if (p.min !== undefined && ks.length < p.min) return `Choose at least ${p.min}`;
      if (p.max !== undefined && ks.length > p.max) return `Choose at most ${p.max}`;
      return null;
    }
    case "number": {
      const n = ans.n;
      if (typeof n !== "number" || !Number.isFinite(n)) return "Pick a number";
      if (p.min !== undefined && n < p.min) return `Minimum is ${p.min}`;
      if (p.max !== undefined && n > p.max) return `Maximum is ${p.max}`;
      return null;
    }
    case "order": {
      const ord = ans.order ?? [];
      if (ord.length !== keys.size) return "Order every option";
      for (const k of ord) if (!keys.has(k)) return "Unknown option in order";
      return new Set(ord).size === ord.length ? null : "Duplicate in order";
    }
  }
}

/** Every legal reply to the open question — what bots pick from, what the
 *  fuzzer walks, and what `legalActions` folds into the action space.
 *
 *  chooseMany is combinatorial, so it is SAMPLED, not enumerated: singletons,
 *  the minimum-size and maximum-size picks. Override in your game if a bot
 *  needs to see every subset. */
export function answerOptions(p: Pending, maxOptions = 64): Answer[] {
  const live = (p.options ?? []).filter((o) => !o.disabled).map((o) => o.k);
  const out: Answer[] = [];
  switch (p.t) {
    case "choose":
    case "confirm":
      for (const k of live) out.push({ k });
      break;
    case "chooseMany": {
      const min = p.min ?? 0;
      const max = Math.min(p.max ?? live.length, live.length);
      if (min <= 1 && max >= 1) for (const k of live) out.push({ ks: [k] });
      if (min > 1 || out.length === 0) out.push({ ks: live.slice(0, min) });
      if (max > 1) out.push({ ks: live.slice(0, max) });
      if (min === 0) out.push({ ks: [] });
      break;
    }
    case "number": {
      const lo = p.min ?? 0;
      const hi = Math.min(p.max ?? lo, lo + maxOptions);
      for (let n = lo; n <= hi; n++) out.push({ n });
      break;
    }
    case "order":
      out.push({ order: live });
      if (live.length > 1) out.push({ order: [...live].reverse() });
      break;
  }
  if (p.skip) out.push({ skip: true });
  return out.slice(0, maxOptions);
}

// ---------------------------------------------------------------------------
// Ready-made prompt builders — the shapes nearly every game needs.
// ---------------------------------------------------------------------------

export const chooseOne = (
  who: Seat,
  prompt: string,
  options: Choice[],
  extra: Partial<Pending> = {},
): Pending => ({ t: "choose", who, prompt, options, ...extra });

export const confirm = (
  who: Seat,
  prompt: string,
  yes = "Yes",
  no = "No",
): Pending => ({
  t: "confirm",
  who,
  prompt,
  options: [
    { k: "yes", label: yes },
    { k: "no", label: no },
  ],
});

export const chooseCount = (
  who: Seat,
  prompt: string,
  min: number,
  max: number,
): Pending => ({ t: "number", who, prompt, min, max });

/** Options from a list of ids plus a labeller — the usual "pick a card". */
export const idChoices = (
  ids: readonly (number | string)[],
  label: (id: number | string) => string,
): Choice[] => ids.map((id) => ({ k: String(id), label: label(id) }));
