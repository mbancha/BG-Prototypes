// Telemetry export: flatten the interesting parts of the state (plus the live
// CONFIG, so a dump is self-describing) and hand it to the browser as a
// download. Playtest data you can diff between sessions.
//
// The dump also carries the SEED and the ACTION LOG, which together replay
// the game exactly (kernel/harness.ts → replay). That turns "it did something
// weird on turn 14" into a test case:
//
//     const s = replay(api, dump.seed, dump.actions);

import { CONFIG } from "../data/config";
import { census } from "../kernel/zones";
import { formatLog } from "../kernel/types";
import { pts, type Action, type GameState } from "../game/engine";

export function buildDump(s: GameState, actions: Action[] = []) {
  return {
    dumpedAt: new Date().toISOString(),
    config: CONFIG,
    seed: s.seed,
    limit: s.limit,
    turns: s.flow.turn,
    round: s.flow.round,
    result: s.result ?? null,
    players: s.players.map((p, i) => ({
      player: p.name,
      bot: !!p.isBot,
      pts: pts(p),
      breakdown: p.score,
      hand: s.zones[`hand@${i}`]?.length ?? 0,
    })),
    telemetry: s.telem,
    components: census(s.zones),
    log: formatLog(s, s.players.map((p) => p.name)),
    /** Replay input — seed + actions rebuilds this exact game. */
    actions,
  };
}

export function downloadJson(obj: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
