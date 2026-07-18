// =============================================================================
// Frame stack machine — the heart of effect execution.
//
// Why: card effects need multi-step player decisions (pick card → pick owner
// → pick amount…), can nest (a match spawns a remove-picker), and must
// survive undo snapshots mid-decision. So effects run as FRAMES on s.exec
// (plain data: { h: handlerName, ph: phase, d: payload }) instead of async
// code. pump() repeatedly calls the top frame's handler until either the
// stack empties or a handler parks a question in s.pending.
//
// Handler protocol (every register()ed function follows this):
//   • called with (s, f) where f is the TOP frame; runs synchronously
//   • may: mutate state via rules.ts helpers; push child frames; set
//     s.pending (pause) ; popFrame(s) when done. It will be RE-CALLED after
//     any child pops or answer arrives — use f.ph to remember where it was.
//   • answers: the UI calls provideAnswer → stored in f.d.ans → handler reads
//     it once via takeAns(f).
//   • child → parent results go through s.ret (pickRemove/pickMove set it;
//     parent must read AND clear it).
//
// This file owns: pump/provideAnswer plumbing, the "hub" (player-ordered
// list of pending matches + triggers), the shared pickRemove/pickMove child
// frames, and the five symbol-match frames (m_muscle … m_whisper).
// Effect frames (e_*/t_*) live in effects.ts; the enclosure frame in turn.ts.
// =============================================================================

import { CONFIG } from "../data/config";
import { def, SYM_GLYPH, SYM_NAME } from "./cards";
import { adjacentCards } from "./grid";
import {
  creditValue,
  favorRedirect,
  intelAlsoPlaced,
  listeners,
  muscleCount,
  whisperAnyAdjacent,
  whisperMax,
} from "./ongoing";
import {
  addToken,
  canMoveTokenOff,
  cardAccepts,
  cname,
  gainMoney,
  log,
  movableOwners,
  moveToken,
  removableOwners,
  removeToken,
} from "./rules";
import type { Frame, GameState, HubItem, Sym } from "./types";

export type Handler = (s: GameState, f: Frame) => void;
export const HANDLERS: Record<string, Handler> = {};
export const register = (name: string, fn: Handler) => {
  HANDLERS[name] = fn;
};

export const pushFrame = (s: GameState, h: string, d: any) => {
  s.exec.push({ h, ph: 0, d });
};
export const popFrame = (s: GameState) => {
  s.exec.pop();
};
export const takeAns = (f: Frame): any => {
  const a = f.d.ans;
  f.d.ans = undefined;
  return a;
};

export function pump(s: GameState) {
  let guard = 0;
  while (!s.pending && s.exec.length > 0) {
    if (++guard > 8000) throw new Error("engine loop guard tripped");
    const f = s.exec[s.exec.length - 1];
    const h = HANDLERS[f.h];
    if (!h) throw new Error(`no handler ${f.h}`);
    h(s, f);
  }
}

export function provideAnswer(s: GameState, ans: any) {
  if (!s.pending || s.exec.length === 0) return;
  const f = s.exec[s.exec.length - 1];
  f.d.ans = ans;
  s.pending = null;
  pump(s);
}

// ---------------------------------------------------------------------------
// Hub: list of pending matches/triggers; the player picks resolution order.
// d = { title, items: HubItem[], ctx?: { placedId } }
// ---------------------------------------------------------------------------

export function matchItem(sym: Sym, placed: number, other: number): HubItem {
  return {
    key: `m:${sym}:${placed}:${other}:${Math.random().toString(36).slice(2, 7)}`,
    label: `${SYM_GLYPH[sym]} ${SYM_NAME[sym]} match`,
    sub:
      placed === other
        ? `on ${cname(placed)}`
        : `${cname(placed)} ↔ ${cname(other)}`,
    match: { sym, placed, other },
  };
}

export function trigItem(card: number, owner: number): HubItem {
  const spec = def(card).spec;
  return {
    key: `t:${card}`,
    label: `⚙ ${cname(card)}`,
    sub: def(card).text,
    optional: !!spec.optional,
    trig: { card, owner },
  };
}

register("hub", (s, f) => {
  const d = f.d;
  const items: HubItem[] = d.items;
  if (f.ph === 1) {
    const ans = takeAns(f);
    f.ph = 0;
    if (ans && typeof ans.i === "number" && items[ans.i]) {
      const item = items.splice(ans.i, 1)[0];
      if (ans.skip) {
        log(s, s.turn.p, `skips ${item.label.replace(/^[^ ]+ /, "")}`);
        return;
      }
      spawnItem(s, item, d.ctx ?? {});
      return;
    }
    return;
  }
  if (items.length === 0) {
    popFrame(s);
    return;
  }
  if (items.length === 1 && !items[0].optional) {
    // only one mandatory thing left — resolve it without asking
    const item = items.splice(0, 1)[0];
    spawnItem(s, item, d.ctx ?? {});
    return;
  }
  f.ph = 1;
  s.pending = { t: "hub", title: d.title, items: [...items] };
});

function spawnItem(s: GameState, item: HubItem, ctx: any) {
  if (item.match) {
    const m = item.match;
    pushFrame(s, `m_${m.sym}`, {
      placed: m.placed,
      other: m.other,
      by: s.turn.p,
      why: ctx.why ?? `${SYM_NAME[m.sym]} match`,
    });
    return;
  }
  if (item.trig) {
    const { card, owner } = item.trig;
    const spec = def(card).spec;
    const base = { card, owner, ...spec, ctx };
    pushFrame(s, `t_${spec.do}`, base);
  }
}

// ---------------------------------------------------------------------------
// pickRemove: shared child frame. Performs one influence removal with all
// choices. d = { by, cards: number[], cause, prompt, skippable?: string,
// opponentsOnly?: boolean, why }
// Result: s.ret = { card, owner } or null (no legal target / skipped).
// ---------------------------------------------------------------------------

function legalRemovalOwners(s: GameState, d: any, id: number): number[] {
  let owners = removableOwners(s, id, d.by, d.cause);
  if (d.opponentsOnly) owners = owners.filter((q) => q !== d.by);
  return owners;
}

register("pickRemove", (s, f) => {
  const d = f.d;
  if (f.ph === 0) {
    const legal = (d.cards as number[]).filter(
      (id) => legalRemovalOwners(s, d, id).length > 0,
    );
    if (legal.length === 0) {
      s.ret = null;
      popFrame(s);
      return;
    }
    if (!d.skippable && legal.length === 1) {
      const owners = legalRemovalOwners(s, d, legal[0]);
      if (owners.length === 1) {
        removeToken(s, legal[0], owners[0], d.by, d.cause, d.why);
        s.ret = { card: legal[0], owner: owners[0] };
        popFrame(s);
        return;
      }
    }
    f.ph = 1;
    s.pending = {
      t: "card",
      prompt: d.prompt ?? "Choose a card to remove influence from",
      ids: legal,
      skip: d.skippable,
    };
    return;
  }
  if (f.ph === 1) {
    const ans = takeAns(f);
    if (!ans || ans.skip) {
      s.ret = null;
      popFrame(s);
      return;
    }
    d.card = ans.card;
    const owners = legalRemovalOwners(s, d, d.card);
    if (owners.length === 1) {
      removeToken(s, d.card, owners[0], d.by, d.cause, d.why);
      s.ret = { card: d.card, owner: owners[0] };
      popFrame(s);
      return;
    }
    f.ph = 2;
    s.pending = {
      t: "owner",
      prompt: "Remove whose influence?",
      card: d.card,
      owners: owners.map((p) => ({ p, n: s.board[d.card].inf[p] })),
    };
    return;
  }
  const ans = takeAns(f);
  removeToken(s, d.card, ans.p, d.by, d.cause, d.why);
  s.ret = { card: d.card, owner: ans.p };
  popFrame(s);
});

// ---------------------------------------------------------------------------
// pickMove: shared child frame. Performs one influence move.
// d = { by, cause, ownOnly?: number, srcs: number[] | "all",
//       dstMap?: Record<number, number[]>  (default: adjacent cards),
//       skippable?: string, prompt?, why }
// Result: s.ret = { from, to, owner } or null.
// ---------------------------------------------------------------------------

function moveDsts(s: GameState, d: any, src: number): number[] {
  const raw: number[] =
    d.dstMap && d.dstMap[src] ? d.dstMap[src] : adjacentCards(s, src);
  return raw.filter((id) => id !== src && cardAccepts(s, id));
}

function moveOwnersFor(s: GameState, d: any, src: number): number[] {
  if (d.ownOnly !== undefined && d.ownOnly !== null) {
    return canMoveTokenOff(s, src, d.ownOnly, d.by, d.cause)
      ? [d.ownOnly]
      : [];
  }
  return movableOwners(s, src, d.by, d.cause);
}

register("pickMove", (s, f) => {
  const d = f.d;
  if (f.ph === 0) {
    const srcPool: number[] =
      d.srcs === "all" ? Object.keys(s.board).map(Number) : d.srcs;
    const valid = srcPool.filter(
      (id) =>
        moveOwnersFor(s, d, id).length > 0 && moveDsts(s, d, id).length > 0,
    );
    if (valid.length === 0) {
      s.ret = null;
      popFrame(s);
      return;
    }
    d.valid = valid;
    f.ph = 1;
    s.pending = {
      t: "card",
      prompt: d.prompt ?? "Move influence from which card?",
      ids: valid,
      skip: d.skippable,
    };
    return;
  }
  if (f.ph === 1) {
    const ans = takeAns(f);
    if (!ans || ans.skip) {
      s.ret = null;
      popFrame(s);
      return;
    }
    d.src = ans.card;
    const dsts = moveDsts(s, d, d.src);
    if (dsts.length === 1) {
      d.dst = dsts[0];
      f.ph = 3;
      return;
    }
    f.ph = 2;
    s.pending = { t: "card", prompt: "Move influence to which card?", ids: dsts };
    return;
  }
  if (f.ph === 2) {
    const ans = takeAns(f);
    d.dst = ans.card;
    f.ph = 3;
    return;
  }
  if (f.ph === 3) {
    const owners = moveOwnersFor(s, d, d.src);
    if (owners.length === 1) {
      d.owner = owners[0];
      f.ph = 5;
      return;
    }
    f.ph = 4;
    s.pending = {
      t: "owner",
      prompt: "Move whose influence?",
      card: d.src,
      owners: owners.map((p) => ({ p, n: s.board[d.src].inf[p] })),
    };
    return;
  }
  if (f.ph === 4) {
    const ans = takeAns(f);
    d.owner = ans.p;
    f.ph = 5;
    return;
  }
  moveToken(s, d.src, d.dst, d.owner, d.by, d.cause, d.why);
  s.ret = { from: d.src, to: d.dst, owner: d.owner };
  popFrame(s);
});

// ---------------------------------------------------------------------------
// Symbol match frames. d = { placed, other, by, why }
// Telemetry per-symbol counts increment here so Zero Day pseudo-matches count.
// ---------------------------------------------------------------------------

register("m_muscle", (s, f) => {
  const d = f.d;
  if (f.ph === 0) {
    s.telem.matchesBySym.muscle++;
    d.n = muscleCount(s, d.by);
    d.i = 0;
    d.removed = 0;
    f.ph = 1;
    return;
  }
  if (f.ph === 1) {
    if (d.i >= d.n) {
      if (d.removed > 0) {
        for (const l of listeners(s, "muscleRemoval"))
          gainMoney(s, l.p, l.money, cname(l.card));
      }
      popFrame(s);
      return;
    }
    d.i++;
    f.ph = 2;
    const cards = d.placed === d.other ? [d.placed] : [d.placed, d.other];
    pushFrame(s, "pickRemove", {
      by: d.by,
      cards,
      cause: "muscleMatch",
      prompt: `${d.why}: remove 1 influence (${d.i}/${d.n})`,
      why: d.why,
    });
    return;
  }
  // returned from pickRemove
  const r = s.ret;
  s.ret = undefined;
  if (r === null) {
    if (d.removed === 0) {
      s.telem.fizzledOther++;
      log(s, d.by, `${d.why} fizzles — no removable influence`);
    }
    d.i = d.n; // stop
  } else {
    d.removed++;
  }
  f.ph = 1;
});

register("m_intel", (s, f) => {
  const d = f.d;
  s.telem.matchesBySym.intel++;
  for (let i = 0; i < CONFIG.INTEL_ADD; i++)
    addToken(s, d.other, d.by, d.why);
  const extra = intelAlsoPlaced(s, d.by);
  for (let i = 0; i < extra; i++)
    addToken(s, d.placed, d.by, "Grid Worm");
  popFrame(s);
});

register("m_favor", (s, f) => {
  const d = f.d;
  if (f.ph === 0) {
    s.telem.matchesBySym.favor++;
    const redirect = favorRedirect(s, d.by) && d.other !== d.placed;
    const placedOk = cardAccepts(s, d.placed);
    const otherOk = cardAccepts(s, d.other);
    if (redirect && placedOk && otherOk) {
      f.ph = 1;
      s.pending = {
        t: "opt",
        prompt: `${d.why}: add influence to which card? (Committee Chair)`,
        options: [
          { k: "placed", label: `Your placed card (${cname(d.placed)})` },
          { k: "other", label: `Matched neighbor (${cname(d.other)})` },
        ],
      };
      return;
    }
    const target = redirect && !placedOk && otherOk ? d.other : d.placed;
    for (let i = 0; i < CONFIG.FAVOR_ADD; i++) addToken(s, target, d.by, d.why);
    popFrame(s);
    return;
  }
  const ans = takeAns(f);
  const target = ans.k === "other" ? d.other : d.placed;
  for (let i = 0; i < CONFIG.FAVOR_ADD; i++) addToken(s, target, d.by, d.why);
  popFrame(s);
});

register("m_credit", (s, f) => {
  const d = f.d;
  s.telem.matchesBySym.credit++;
  gainMoney(s, d.by, creditValue(s, d.by), "Credit match");
  for (const l of listeners(s, "opponentCreditMatch"))
    if (l.p !== d.by) gainMoney(s, l.p, l.money, cname(l.card));
  popFrame(s);
});

register("m_whisper", (s, f) => {
  const d = f.d;
  if (f.ph === 0) {
    s.telem.matchesBySym.whisper++;
    d.max = whisperMax(s, d.by);
    d.moved = 0;
    f.ph = 1;
    return;
  }
  if (f.ph === 1) {
    if (d.moved >= d.max) {
      popFrame(s);
      return;
    }
    if (d.moved > 0) {
      f.ph = 3;
      s.pending = {
        t: "opt",
        prompt: "Ghost Protocol: move a second influence?",
        options: [
          { k: "more", label: "Move another" },
          { k: "done", label: "Done" },
        ],
      };
      return;
    }
    f.ph = 2;
    pushWhisperMove(s, d);
    return;
  }
  if (f.ph === 2) {
    const r = s.ret;
    s.ret = undefined;
    if (r === null) {
      if (d.moved === 0) {
        s.telem.fizzledOther++;
        log(s, d.by, `${d.why} fizzles — no legal move`);
      }
      popFrame(s);
      return;
    }
    d.moved++;
    f.ph = 1;
    return;
  }
  // ph 3: continue?
  const ans = takeAns(f);
  if (ans.k === "more") {
    f.ph = 2;
    pushWhisperMove(s, d);
    return;
  }
  popFrame(s);
});

function pushWhisperMove(s: GameState, d: any) {
  const anyAdj = whisperAnyAdjacent(s, d.by);
  let srcs: number[] | "all";
  let dstMap: Record<number, number[]> | undefined;
  if (anyAdj || d.placed === d.other) {
    // Rumor Mill: any two adjacent cards. Zero Day pseudo-match: between the
    // chosen card and any adjacent card (either direction).
    if (anyAdj) {
      srcs = "all";
    } else {
      srcs = [d.placed, ...adjacentCards(s, d.placed)];
      dstMap = {};
      dstMap[d.placed] = adjacentCards(s, d.placed);
      for (const n of adjacentCards(s, d.placed)) dstMap[n] = [d.placed];
    }
  } else {
    srcs = [d.placed, d.other];
    dstMap = { [d.placed]: [d.other], [d.other]: [d.placed] };
  }
  pushFrame(s, "pickMove", {
    by: d.by,
    cause: "whisperMatch",
    srcs,
    dstMap,
    prompt: `${d.why}: move 1 influence — from which card?`,
    why: d.why,
  });
}
