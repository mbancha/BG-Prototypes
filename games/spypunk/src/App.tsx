// =============================================================================
// App shell: owns the ONLY mutable state in the app — a `session`, which is
// the chosen game MODE plus an array of immutable state snapshots (undo =
// drop the last one). Two modes share this shell:
//   "classic" — the full 60-card ability game   (src/game/*,  GameScreen)
//   "colors"  — the stripped color-groups core  (src/color/*, ColorScreen)
// Every UI event becomes an action dispatched here; dispatch clones the
// latest snapshot, runs the mode's apply function on the clone, and either
// appends it (success) or shows the rejection reason as a toast.
//
// The bot driver also lives here: whenever the newest snapshot is waiting on
// a bot player, a short timer dispatches that mode's botDecide. Undo from a
// human seat pops back over bot moves entirely.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { CONFIG } from "./data/config";
import { botDecide, isBotTurn } from "./game/bot";
import type { GameState } from "./game/types";
import { applyAction, newGame, type Action } from "./game/turn";
import {
  applyColor,
  colorBotDecide,
  isColorBotTurn,
  newColorGame,
  type ColorAction,
  type ColorState,
  type ColorVariant,
} from "./color/engine";
import SetupScreen, { type SetupResult } from "./ui/SetupScreen";
import GameScreen from "./ui/GameScreen";
import ColorScreen from "./ui/ColorScreen";

type Session =
  | { mode: "classic"; hist: GameState[] }
  | { mode: "colors"; hist: ColorState[] };

const botWaiting = (s: Session): boolean =>
  s.mode === "classic"
    ? isBotTurn(s.hist[s.hist.length - 1])
    : isColorBotTurn(s.hist[s.hist.length - 1]);

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
    (action: Action | ColorAction) => {
      setSession((sess) => {
        if (!sess) return sess;
        const cur = sess.hist[sess.hist.length - 1];
        const next = structuredClone(cur);
        let err: string | null = null;
        try {
          err =
            sess.mode === "classic"
              ? applyAction(next as GameState, action as Action)
              : applyColor(next as ColorState, action as ColorAction);
        } catch (e) {
          err = e instanceof Error ? e.message : String(e);
        }
        if (err) {
          showToast(err);
          return sess;
        }
        const hist = [...sess.hist, next];
        while (hist.length > CONFIG.MAX_UNDO_STEPS) hist.shift();
        return { ...sess, hist } as Session;
      });
    },
    [showToast],
  );

  // Undo, skipping back over bot moves: landing on a state where a bot acts
  // next is pointless (the driver would instantly replay it).
  const undo = useCallback(() => {
    setSession((sess) => {
      if (!sess || sess.hist.length <= 1) return sess;
      let i = sess.hist.length - 2;
      const bot = (k: number) =>
        sess.mode === "classic"
          ? isBotTurn(sess.hist[k] as GameState)
          : isColorBotTurn(sess.hist[k] as ColorState);
      while (i > 0 && bot(i)) i--;
      return { ...sess, hist: sess.hist.slice(0, i + 1) } as Session;
    });
  }, []);

  // Bot driver — mode-agnostic: whichever engine is live, ask its bot.
  useEffect(() => {
    if (!session || !botWaiting(session)) return;
    const t = window.setTimeout(() => {
      const cur = session.hist[session.hist.length - 1];
      dispatch(
        session.mode === "classic"
          ? botDecide(cur as GameState)
          : colorBotDecide(cur as ColorState),
      );
    }, CONFIG.BOT_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [session, dispatch]);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const start = (r: SetupResult) => {
    if (r.mode === "classic")
      setSession({
        mode: "classic",
        hist: [newGame(r.players, r.classicBoard)],
      });
    else
      setSession({
        mode: "colors",
        hist: [newColorGame(r.players, r.variant as ColorVariant)],
      });
  };

  if (!session) return <SetupScreen onStart={start} />;

  const cur = session.hist[session.hist.length - 1];
  return (
    <>
      {session.mode === "classic" ? (
        <GameScreen
          s={cur as GameState}
          dispatch={dispatch}
          undo={undo}
          canUndo={session.hist.length > 1}
          onNewGame={() => setSession(null)}
        />
      ) : (
        <ColorScreen
          s={cur as ColorState}
          dispatch={dispatch}
          undo={undo}
          canUndo={session.hist.length > 1}
          onNewGame={() => setSession(null)}
        />
      )}
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
