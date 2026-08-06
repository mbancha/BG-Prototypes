// =============================================================================
// RESOURCES — pools, costs, income, trading.
//
// A pool is just `Record<string, number>`, so a game invents its own
// currencies without touching this file: { money: 3 } for a light game,
// { food, ore, science, culture, happy, strength } for a civ game.
//
// The one thing worth centralising is that PAYMENT IS ATOMIC. The classic
// prototype bug is deducting the affordable half of a cost and then rejecting
// the action, leaving the player short. pay() either takes everything or
// takes nothing.
// =============================================================================

export type Pool = Record<string, number>;
export type Cost = Record<string, number>;

export const amount = (pool: Pool, key: string): number => pool[key] ?? 0;

export function canPay(pool: Pool, cost: Cost): boolean {
  for (const k of Object.keys(cost)) if (amount(pool, k) < cost[k]) return false;
  return true;
}

/** All or nothing. Returns false and changes nothing when unaffordable. */
export function pay(pool: Pool, cost: Cost): boolean {
  if (!canPay(pool, cost)) return false;
  for (const k of Object.keys(cost)) pool[k] = amount(pool, k) - cost[k];
  return true;
}

export function gain(pool: Pool, income: Cost): void {
  for (const k of Object.keys(income)) pool[k] = amount(pool, k) + income[k];
}

/** What's missing, for a useful rejection message: "need 2 more ore". */
export function shortfall(pool: Pool, cost: Cost): Cost {
  const out: Cost = {};
  for (const k of Object.keys(cost)) {
    const gap = cost[k] - amount(pool, k);
    if (gap > 0) out[k] = gap;
  }
  return out;
}

export const describeCost = (cost: Cost): string =>
  Object.entries(cost)
    .map(([k, v]) => `${v} ${k}`)
    .join(", ") || "nothing";

/** Move resources between pools — player-to-player trades, paying a rival,
 *  feeding a shared supply. Atomic on the source. */
export function transfer(from: Pool, to: Pool, cost: Cost): boolean {
  if (!pay(from, cost)) return false;
  gain(to, cost);
  return true;
}

/** Enforce storage limits, returning what was lost — hand limits, granary
 *  caps, Through the Ages corruption, "discard down to". */
export function clampTo(pool: Pool, caps: Cost): Cost {
  const lost: Cost = {};
  for (const k of Object.keys(caps)) {
    const over = amount(pool, k) - caps[k];
    if (over > 0) {
      pool[k] = caps[k];
      lost[k] = over;
    }
  }
  return lost;
}

/** Per-round income, with an optional per-resource cap applied after. */
export function produce(pool: Pool, income: Cost, caps?: Cost): Cost {
  gain(pool, income);
  return caps ? clampTo(pool, caps) : {};
}

/** Total of everything in the pool — quick tiebreaker / telemetry metric. */
export const poolTotal = (pool: Pool): number =>
  Object.values(pool).reduce((a, v) => a + v, 0);
