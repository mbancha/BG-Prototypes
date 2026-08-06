// Telemetry export: flatten the interesting parts of the state (plus the
// live CONFIG, so a dump is self-describing) and hand it to the browser as
// a download. Playtest data you can diff between sessions.

import { CONFIG } from "../data/config";
import type { GameState } from "../game/engine";

export function buildDump(s: GameState) {
  return {
    dumpedAt: new Date().toISOString(),
    config: CONFIG,
    limit: s.limit,
    turns: s.turn.n,
    finalScores: s.players.map((p) => ({
      player: p.name,
      bot: !!p.isBot,
      pts: p.pts,
    })),
    telemetry: s.telem,
    log: s.log.map(
      (l) =>
        `[T${l.turn}] ${l.p !== null ? s.players[l.p].name + " " : ""}${l.msg}`,
    ),
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
