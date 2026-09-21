import { useState } from "react";
import type { Seat } from "../game/model";
export interface SetupResult {
  players: Seat[];
  seed: number;
}
export default function SetupScreen({
  onStart,
  onSim,
  onLoad,
}: {
  onStart: (r: SetupResult) => void;
  onSim: () => void;
  onLoad: (file: File) => void;
}) {
  const [n, setN] = useState(2),
    [seed, setSeed] = useState("20260920"),
    [modes, setModes] = useState([false, true, true, true]);
  return (
    <main className="setup">
      <section className="intro">
        <div className="eyebrow">A GALAXY IN YOUR HAND</div>
        <h1>GALAX</h1>
        <p className="lead">
          Beyond the veil,
          <br />
          an empire awaits.
        </p>
        <p>
          Explore hidden systems, establish civilizations, and turn the cards in
          your hand into the technologies that shape your future.
        </p>
        <div className="edition">
          Dextrous playtest · September 20, 2026
          <br />
          2–4 players · Hotseat + basic bots
        </div>
      </section>
      <section className="setup-panel">
        <h2>Launch an expedition</h2>
        <label>
          Players
          <select
            aria-label="Players"
            value={n}
            onChange={(e) => setN(+e.target.value)}
          >
            {[2, 3, 4].map((i) => (
              <option key={i}>{i}</option>
            ))}
          </select>
        </label>
        {Array.from({ length: n }, (_, i) => (
          <label key={i}>
            Empire {i + 1}
            <select
              aria-label={"Empire " + (i + 1) + " controller"}
              value={modes[i] ? "bot" : "human"}
              onChange={(e) =>
                setModes((v) =>
                  v.map((b, j) => (i === j ? e.target.value === "bot" : b)),
                )
              }
            >
              <option value="human">Human · hotseat</option>
              <option value="bot">Basic bot</option>
            </select>
          </label>
        ))}
        <label>
          Map seed
          <input
            aria-label="Map seed"
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
          />
        </label>
        <button
          className="primary"
          onClick={() =>
            onStart({
              seed: Number(seed) || 1,
              players: Array.from({ length: n }, (_, i) => ({
                name: "Empire " + (i + 1),
                color: ["#f5a276", "#79d7df", "#ba9bff", "#f0d567"][i],
                isBot: modes[i],
              })),
            })
          }
        >
          Start expedition →
        </button>
        <button onClick={onSim}>Simulation lab</button>
        <label className="load-replay">
          Resume a saved replay
          <input
            type="file"
            accept=".json"
            aria-label="Load replay"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onLoad(f);
            }}
          />
        </label>
        <p className="small">
          Uses the supplied card artwork and September reference rules. Rule
          interpretations are documented in the in-game reference. This is a
          development playtest.
        </p>
      </section>
      <div className="setup-cards">
        {["c34", "c32", "c29"].map((id) => (
          <img
            key={id}
            src={"./cards/" + id + ".webp"}
            alt="Galax system and technology card"
          />
        ))}
      </div>
    </main>
  );
}
