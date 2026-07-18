import { useCallback, useEffect, useRef, useState } from "react";
import { CONFIG } from "./data/config";
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

  const undo = useCallback(() => {
    setHistory((h) => (h && h.length > 1 ? h.slice(0, -1) : h));
  }, []);

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
