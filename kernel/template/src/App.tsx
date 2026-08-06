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
// It also keeps the ACTION LOG. Seed + actions replays a game exactly (the
// RNG lives in the state), so a playtester's JSON dump is a reproducible bug
// report rather than a description of one.
//
// You should rarely need to change this file per game.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { CONFIG } from "./data/config";
import { botDecide, isBotTurn } from "./game/bot";
import { applyAction, newGame, type Action, type GameState } from "./game/engine";
import GameScreen from "./ui/GameScreen";
import SetupScreen, { type SetupResult } from "./ui/SetupScreen";

export interface Session {
  history: GameState[];
  actions: Action[];
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  const dispatch = useCallback(
    (action: Action) => {
      setSession((sess) => {
        if (!sess) return sess;
        const { history } = sess;
        const next = structuredClone(history[history.length - 1]);
        let err: string | null = null;
        try {
          err = applyAction(next, action);
        } catch (e) {
          err = e instanceof Error ? e.message : String(e);
        }
        if (err) {
          showToast(err);
          return sess;
        }
        const out = [...history, next];
        while (out.length > CONFIG.MAX_UNDO_STEPS) out.shift();
        return { history: out, actions: [...sess.actions, action] };
      });
    },
    [showToast],
  );

  // undo skips back over bot moves — stopping on one would just replay it
  const undo = useCallback(() => {
    setSession((sess) => {
      if (!sess || sess.history.length <= 1) return sess;
      let i = sess.history.length - 2;
      while (i > 0 && isBotTurn(sess.history[i])) i--;
      const dropped = sess.history.length - 1 - i;
      return {
        history: sess.history.slice(0, i + 1),
        actions: sess.actions.slice(0, Math.max(0, sess.actions.length - dropped)),
      };
    });
  }, []);

  useEffect(() => {
    if (!session) return;
    const s = session.history[session.history.length - 1];
    if (!isBotTurn(s)) return;
    const t = window.setTimeout(
      () => dispatch(botDecide(s)),
      CONFIG.BOT_DELAY_MS,
    );
    return () => window.clearTimeout(t);
  }, [session, dispatch]);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  if (!session)
    return (
      <SetupScreen
        onStart={(r: SetupResult) =>
          setSession({
            history: [newGame(r.players, { ...r.board, seed: r.seed })],
            actions: [],
          })
        }
      />
    );

  return (
    <>
      <GameScreen
        s={session.history[session.history.length - 1]}
        actions={session.actions}
        dispatch={dispatch}
        undo={undo}
        canUndo={session.history.length > 1}
        onNewGame={() => setSession(null)}
      />
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
