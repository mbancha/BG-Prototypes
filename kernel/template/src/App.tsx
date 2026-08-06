// =============================================================================
// APP SHELL — the only mutable state in the whole app.
//
// `history` is an array of immutable GameState snapshots:
//   dispatch(action) → clone the newest → applyAction on the clone →
//                      append it (success) or toast the reason (rejection)
//   undo()           → drop the last snapshot
// That is the entire undo system, and it works for any game whose state is
// plain data. The bot driver lives here too: whenever the newest snapshot is
// waiting on a bot, a timer dispatches botDecide for it.
//
// You should rarely need to change this file per game.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { CONFIG } from "./data/config";
import { botDecide, isBotTurn } from "./game/bot";
import { applyAction, newGame, type Action, type GameState } from "./game/engine";
import GameScreen from "./ui/GameScreen";
import SetupScreen, { type SetupResult } from "./ui/SetupScreen";

export default function App() {
  const [history, setHistory] = useState<GameState[] | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  const dispatch = useCallback(
    (action: Action) => {
      setHistory((h) => {
        if (!h) return h;
        const next = structuredClone(h[h.length - 1]);
        let err: string | null = null;
        try {
          err = applyAction(next, action);
        } catch (e) {
          err = e instanceof Error ? e.message : String(e);
        }
        if (err) {
          showToast(err);
          return h;
        }
        const out = [...h, next];
        while (out.length > CONFIG.MAX_UNDO_STEPS) out.shift();
        return out;
      });
    },
    [showToast],
  );

  // undo skips back over bot moves — stopping on one would just replay it
  const undo = useCallback(() => {
    setHistory((h) => {
      if (!h || h.length <= 1) return h;
      let i = h.length - 2;
      while (i > 0 && isBotTurn(h[i])) i--;
      return h.slice(0, i + 1);
    });
  }, []);

  useEffect(() => {
    if (!history) return;
    const s = history[history.length - 1];
    if (!isBotTurn(s)) return;
    const t = window.setTimeout(
      () => dispatch(botDecide(s)),
      CONFIG.BOT_DELAY_MS,
    );
    return () => window.clearTimeout(t);
  }, [history, dispatch]);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  if (!history)
    return (
      <SetupScreen
        onStart={(r: SetupResult) =>
          setHistory([newGame(r.players, r.board)])
        }
      />
    );

  return (
    <>
      <GameScreen
        s={history[history.length - 1]}
        dispatch={dispatch}
        undo={undo}
        canUndo={history.length > 1}
        onNewGame={() => setHistory(null)}
      />
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
