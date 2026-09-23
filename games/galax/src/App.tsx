import { useEffect, useState, useRef } from "react";
import { CONFIG } from "./data/config";
import {
  newGame,
  applyAction,
  legalActions,
  seatOnClock,
  type GameState,
  type Action,
  type Seat,
} from "./game/engine";
import { botDecide, isBotTurn } from "./game/bot";
import { playerView, publicView } from "./game/views";
import SetupScreen from "./ui/SetupScreen";
import GameScreen, { Modal } from "./ui/GameScreen";
import { downloadJson } from "./ui/dump";
function Handoff({
  name,
  pending,
  onReveal,
}: {
  name: string;
  pending: boolean;
  onReveal: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="handoff-dialog"
      aria-label="Private handoff"
      onCancel={(e) => e.preventDefault()}
    >
      <div className="handoff-card">
        <span className="eyebrow">PRIVATE HANDOFF</span>
        <h1>Pass to {name}</h1>
        <p>
          {pending
            ? "A private decision is waiting."
            : "Your cards are hidden until you are ready."}
        </p>
        <button className="primary" autoFocus onClick={onReveal}>
          I am {name} — reveal
        </button>
      </div>
    </dialog>
  );
}
type Session = {
  history: GameState[];
  actions: Action[];
  initial: { players: Seat[]; seed: number };
};
export default function App() {
  const [session, setSession] = useState<Session | null>(null),
    [visible, setVisible] = useState<number | null>(null),
    [paused, setPaused] = useState(false),
    [error, setError] = useState(""),
    [lab, setLab] = useState(false),
    [simGames, setSimGames] = useState(100),
    [simPlayers, setSimPlayers] = useState(2),
    [simResult, setSimResult] = useState<any>(null),
    [running, setRunning] = useState(false),
    [save, setSave] = useState(false);
  const s = session?.history.at(-1),
    seat = s ? seatOnClock(s) : null;
  function dispatch(a: Action) {
    if (!session || !s) return;
    const next = structuredClone(s);
    const err = applyAction(next, a);
    if (err) {
      setError(err);
      return;
    }
    const newSeat = seatOnClock(next);
    if (
      newSeat !== seat ||
      next.phase === "start" ||
      s.pending?.task.kind === "commit" ||
      s.pending?.task.kind === "expose"
    )
      setVisible(null);
    setSession({
      ...session,
      history: [...session.history, next].slice(-CONFIG.MAX_UNDO_STEPS),
      actions: [...session.actions, a],
    });
  }
  useEffect(() => {
    if (!s || paused || !isBotTurn(s)) return;
    const timer = setTimeout(() => dispatch(botDecide(s)), CONFIG.BOT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [s, paused]);
  const gated = !!s && !s.over && !s.players[seat!].isBot && visible !== seat;
  const view = s
    ? playerView(s, gated || s.players[seat!].isBot ? null : seat!)
    : null;
  function undo() {
    if (!session || session.history.length < 2) return;
    let i = session.history.length - 2;
    while (i > 0 && isBotTurn(session.history[i])) i--;
    const count = session.history.length - 1 - i;
    setSession({
      ...session,
      history: session.history.slice(0, i + 1),
      actions: session.actions.slice(0, -count),
    });
    setVisible(null);
  }
  function runSim() {
    setRunning(true);
    setSimResult(null);
    const w = new Worker(new URL("./sim/worker.ts", import.meta.url), {
      type: "module",
    });
    w.onmessage = (e) => {
      setSimResult(e.data);
      setRunning(false);
      w.terminate();
    };
    w.onerror = (e) => {
      setError(e.message);
      setRunning(false);
      w.terminate();
    };
    w.postMessage({ games: simGames, players: simPlayers, seed: 20260920 });
  }
  async function loadReplay(file: File) {
    try {
      const r = JSON.parse(await file.text());
      if (r.schemaVersion !== 1 || r.rulesVersion !== CONFIG.RULES_VERSION)
        throw Error("Unsupported replay version");
      let state = newGame(r.initial.players, { seed: r.initial.seed });
      let history = [structuredClone(state)];
      for (const a of r.actions) {
        const err = applyAction(state, a);
        if (err) throw Error("Invalid replay action");
        history.push(structuredClone(state));
        if (history.length > CONFIG.MAX_UNDO_STEPS) history.shift();
      }
      setSession({ initial: r.initial, history, actions: r.actions });
      setVisible(null);
      setSave(false);
    } catch (e) {
      setError(String(e));
    }
  }
  return (
    <>
      {!s ? (
        <SetupScreen
          onStart={(r) => {
            setSession({
              initial: r,
              history: [newGame(r.players, { seed: r.seed })],
              actions: [],
            });
            setVisible(null);
          }}
          onSim={() => setLab(true)}
          onLoad={loadReplay}
        />
      ) : (
        <>
          <GameScreen
            s={view!}
            actions={gated || s.players[seat!].isBot ? [] : legalActions(s)}
            dispatch={dispatch}
            undo={undo}
            canUndo={session!.history.length > 1}
            onNewGame={() => {
              setSession(null);
              setVisible(null);
            }}
            onExport={() => setSave(true)}
            botPaused={paused}
            onPause={() => setPaused(!paused)}
            handVisible={!gated}
            onHide={() => setVisible(null)}
          />
          {gated && (
            <Handoff
              name={s.players[seat!].name}
              pending={!!s.pending}
              onReveal={() => setVisible(seat)}
            />
          )}
        </>
      )}
      {lab && (
        <Modal title="Simulation lab" onClose={() => setLab(false)}>
          <p>
            Run the same rules with basic bots in a background worker. Reports
            include win share and points by starting color, seat order,
            technology use, score sources, and combat.
          </p>
          <label>
            Player count
            <select
              aria-label="Player count"
              value={simPlayers}
              onChange={(e) => setSimPlayers(+e.target.value)}
            >
              {[2, 3, 4].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
          <label>
            Games
            <input
              type="number"
              min={1}
              max={10000}
              value={simGames}
              onChange={(e) =>
                setSimGames(Math.max(1, Math.min(10000, +e.target.value)))
              }
            />
          </label>
          <button className="primary" disabled={running} onClick={runSim}>
            {running
              ? "Simulating…"
              : "Run " + simPlayers + "-player simulation"}
          </button>
          {simResult && (
            <>
              <p>
                {simResult.completed} completed · {simResult.truncated}{" "}
                truncated · {simResult.meanTurns?.toFixed(1)} mean turns
              </p>
              <table>
                <thead>
                  <tr>
                    <th>Starting color</th>
                    <th>Samples</th>
                    <th>Win share</th>
                    <th>Mean points</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(simResult.byStartingColor ?? {}).map(
                    ([color, v]: [string, any]) => (
                      <tr key={color}>
                        <td>{color}</td>
                        <td>{v.n}</td>
                        <td>{(v.winRate * 100).toFixed(1)}%</td>
                        <td>{v.meanPoints.toFixed(1)}</td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
              <h3>Technologies and discoveries used</h3>
              <div className="report-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Card</th>
                      <th>Plays</th>
                      <th>User win share</th>
                      <th>Mean points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(simResult.technologies ?? {}).map(
                      ([id, v]: [string, any]) => (
                        <tr key={id}>
                          <td>{v.name}</td>
                          <td>{v.plays}</td>
                          <td>{(v.holders.winRate * 100).toFixed(1)}%</td>
                          <td>{v.holders.meanPoints.toFixed(1)}</td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
              <p className="small">{simResult.limitations}</p>
              <button
                onClick={() => downloadJson(simResult, "galax-simulation.json")}
              >
                Download full report
              </button>
            </>
          )}
        </Modal>
      )}
      {save && (
        <Modal title="Save and replay" onClose={() => setSave(false)}>
          <p>
            Full replay includes all private information and reconstructs hands
            and hidden cards. Share it only after the game or with player
            agreement.
          </p>
          <button
            onClick={() =>
              downloadJson(
                {
                  schemaVersion: 1,
                  rulesVersion: CONFIG.RULES_VERSION,
                  initial: session!.initial,
                  actions: session!.actions,
                },
                "galax-replay.json",
              )
            }
          >
            Export full private replay
          </button>
          <label>
            Load a saved replay
            <input
              type="file"
              accept=".json"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) loadReplay(f);
              }}
            />
          </label>
        </Modal>
      )}
      {error && (
        <div className="toast" role="alert">
          {error}
          <button onClick={() => setError("")}>Dismiss</button>
        </div>
      )}
    </>
  );
}
