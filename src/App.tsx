// =============================================================================
// App shell: owns the ONLY mutable state in the app — `history`, an array of
// immutable GameState snapshots (undo = drop the last one). Every UI event
// becomes an Action dispatched here; dispatch clones the latest state, runs
// applyAction on the clone, and either appends it (success) or shows the
// rejection reason as a toast (state unchanged).
//
// The bot driver also lives here: whenever the newest state is waiting on a
// bot player (isBotTurn), a short timer dispatches botDecide(state). Any
// state change re-arms the timer, so bots chain through their whole turn —
// including answering prompts that other players' effects aim at them.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { CONFIG } from "./data/config";
import { botDecide, isBotTurn } from "./game/bot";
import type { GameState } from "./game/types";
import { applyAction, newGame, type Action } from "./game/turn";
import SetupScreen from "./ui/SetupScreen";
import GameScreen from "./ui/GameScreen";

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
        const cur = h[h.length - 1];
        const next = structuredClone(cur);
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

  // Undo, skipping back over bot moves: landing on a state where a bot acts
  // next is pointless (the driver would instantly replay), so pop until a
  // human is on the clock again (or history runs out).
  const undo = useCallback(() => {
    setHistory((h) => {
      if (!h || h.length <= 1) return h;
      let i = h.length - 2;
      while (i > 0 && isBotTurn(h[i])) i--;
      return h.slice(0, i + 1);
    });
  }, []);

  // Bot driver. Runs after every state change; no-op unless the newest state
  // is waiting on a bot. The timeout keeps bot play watchable, and its
  // cleanup cancels stale timers if the user undoes mid-bot-turn.
  useEffect(() => {
    if (!history) return;
    const s = history[history.length - 1];
    if (!isBotTurn(s)) return;
    const t = window.setTimeout(() => dispatch(botDecide(s)), CONFIG.BOT_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [history, dispatch]);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  if (!history) {
    return (
      <SetupScreen
        onStart={(players) => setHistory([newGame(players)])}
      />
    );
  }

  const s = history[history.length - 1];
  return (
    <>
      <GameScreen
        s={s}
        dispatch={dispatch}
        undo={undo}
        canUndo={history.length > 1}
        onNewGame={() => setHistory(null)}
      />
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
