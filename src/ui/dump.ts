// =============================================================================
// Playtest telemetry export: buildDump() flattens the interesting parts of
// GameState (+ the live CONFIG so dumps are self-describing) into one JSON
// object; downloadJson() hands it to the browser as a file download.
// Reached from the STATS tab and the game-over screen.
// =============================================================================

import { CONFIG } from "../data/config";
import type { GameState } from "../game/types";

/** Build the playtest telemetry dump object. */
export function buildDump(s: GameState) {
  return {
    dumpedAt: new Date().toISOString(),
    config: CONFIG,
    turns: s.turn.n,
    deckRemaining: s.deck.length,
    finalScores: s.players.map((p, i) => ({
      player: p.name,
      bot: !!p.isBot,
      pts: p.pts,
      money: p.money,
      supplyLeft: p.supply,
      influenceOnGrid: Object.values(s.board)
        .filter((c) => !c.scored)
        .reduce((n, c) => n + c.inf[i], 0),
      tableau: p.tableau,
    })),
    telemetry: s.telem,
    log: s.log.map((l) => `[T${l.turn}] ${l.p !== null ? s.players[l.p].name + " " : ""}${l.msg}`),
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
