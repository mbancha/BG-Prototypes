import { useEffect, useRef, useState } from "react";
import {
  CARDS,
  COLORS,
  COLOR_ACTION,
  seatOnClock,
  waypoints,
  locationName,
  actionCost,
  research,
  points,
  score,
  supply,
  type GameState,
  type Action,
} from "../game/engine";
import { FAMILY, actionLabel, instruction } from "../game/presentation";
import { downloadJson } from "./dump";
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const old = document.activeElement as HTMLElement;
    ref.current?.showModal();
    return () => {
      ref.current?.close();
      old?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <header>
        <h2>{title}</h2>
        <button aria-label="Close dialog" onClick={onClose}>
          ×
        </button>
      </header>
      {children}
    </dialog>
  );
}
const img = (id: string) => "./cards/" + id + ".webp";
export default function GameScreen({
  s,
  actions,
  dispatch,
  undo,
  canUndo,
  onNewGame,
  onExport,
  botPaused,
  onPause,
  handVisible,
  onHide,
}: {
  s: GameState & { handCounts: number[]; deckCount: number };
  actions: Action[];
  dispatch: (a: Action) => void;
  undo: () => void;
  canUndo: boolean;
  onNewGame: () => void;
  onExport: () => void;
  botPaused: boolean;
  onPause: () => void;
  handVisible: boolean;
  onHide: () => void;
}) {
  const p = seatOnClock(s),
    player = s.players[p],
    human = !player.isBot;
  const [family, setFamily] = useState(""),
    [selected, setSelected] = useState<number | null>(null),
    [selectedCard, setSelectedCard] = useState<string | null>(null),
    [selectedWp, setSelectedWp] = useState<string | null>(null),
    [option, setOption] = useState(0),
    [zoom, setZoom] = useState(0.45),
    [inspect, setInspect] = useState<string | null>(null),
    [rules, setRules] = useState(false),
    [tab, setTab] = useState<"hand" | "techs">("hand");
  useEffect(() => {
    setFamily("");
    setSelected(null);
    setSelectedCard(null);
    setSelectedWp(null);
    setOption(0);
    setInspect(null);
  }, [s.serial]);
  const allFamilies = [...new Set(actions.map((a) => a.a))],
    fam = allFamilies.includes(family)
      ? family
      : s.pending
        ? "choose"
        : (allFamilies[0] ?? "");
  let filtered = actions.filter((a) => a.a === fam);
  if (selected !== null) {
    const narrow = filtered.filter(
      (a) => a.location === selected || a.target === selected,
    );
    if (narrow.length) filtered = narrow;
  }
  if (selectedCard) {
    const narrow = filtered.filter(
      (a) => a.card === selectedCard || a.cards?.includes(selectedCard),
    );
    if (narrow.length) filtered = narrow;
  }
  if (selectedWp) {
    const narrow = filtered.filter(
      (a) =>
        a.to === selectedWp ||
        a.from === selectedWp ||
        s.fleets.some((f) => f.id === a.fleet && f.wp === selectedWp),
    );
    if (narrow.length) filtered = narrow;
  }
  const chosen = filtered[Math.min(option, filtered.length - 1)];
  const xs = s.locations.map((l) => l.x),
    ys = s.locations.map((l) => l.y),
    minX = Math.min(...xs),
    minY = Math.min(...ys),
    width = (Math.max(...xs) - minX + 1) * 240 + 60,
    height = (Math.max(...ys) - minY) * 168 + 336 + 70;
  const boardRef = useRef<HTMLDivElement>(null);
  function fitBoard() {
    const area = boardRef.current;
    if (area) setZoom(Math.min(1, (area.clientWidth - 16) / width, (area.clientHeight - 16) / height));
  }
  useEffect(() => {
    const area = boardRef.current;
    if (!area) return;
    const observer = new ResizeObserver(fitBoard);
    observer.observe(area);
    return () => observer.disconnect();
  }, [width, height]);
  const point = (wp: string) => {
    const [x, y] = wp.split(",").map(Number);
    return { left: (x / 2 - minX) * 240 + 30, top: (y / 2 - minY) * 168 + 30 };
  };
  const wps = [...new Set(s.locations.flatMap(waypoints))];
  const legalLocs = new Set(
    actions
      .filter((a) => a.a === fam)
      .flatMap((a) => (a.location !== undefined ? [a.location] : [])),
  );
  const legalWps = new Set(
    actions
      .filter((a) => a.a === fam)
      .flatMap(
        (a) =>
          [
            a.to,
            a.from,
            ...s.fleets.filter((f) => f.id === a.fleet).map((f) => f.wp),
          ].filter(Boolean) as string[],
      ),
  );
  return (
    <div className="game">
      <header className="topbar">
        <div>
          <strong className="wordmark">GALAX</strong>
          <span className="muted">
            TURN {s.turn} ·{" "}
            {s.phase === "home" || s.phase === "forces"
              ? "DEPLOYMENT"
              : s.over
                ? "RESULT"
                : "EXPEDITION"}
          </span>
        </div>
        <nav>
          <button disabled={!canUndo} onClick={undo}>
            Undo
          </button>
          <button onClick={() => setRules(true)}>How to play</button>
          <button onClick={onPause}>
            {botPaused ? "Resume bots" : "Pause bots"}
          </button>
          <button onClick={onExport}>Save / replay</button>
          <button onClick={onNewGame}>New game</button>
        </nav>
      </header>
      <section className="players">
        {s.players.map((x, i) => (
          <article
            key={i}
            className={"player " + (i === p ? "active" : "")}
            style={{ "--empire": x.color } as React.CSSProperties}
          >
            <strong>
              {x.name}
              {x.isBot ? " · BOT" : ""}
            </strong>
            <span>
              {score(s, i)} points · {x.trophies} trophies
            </span>
            <span>
              Research {research(s, i)}/12 · {s.handCounts[i]} cards ·{" "}
              {supply(s, i)} supply
            </span>
            <small>
              {x.homeColor
                ? x.homeColor + " starting system"
                : "Choosing a home"}{" "}
              · {x.techs.length} technologies
            </small>
            <details>
              <summary>Empire reference &amp; technologies</summary>
              <button onClick={() => setInspect("t0" + (i + 1))}>
                Player reference
              </button>
              {x.techs.map((id) => (
                <button key={id} onClick={() => setInspect(id)}>
                  {CARDS[id].techName}
                </button>
              ))}
            </details>
          </article>
        ))}
      </section>
      <main className="table-layout">
        <section className="board-panel" aria-label="Galaxy map">
          <div className="board-toolbar">
            <span>
              THE GALAXY{" "}
              <small>
                {s.deckCount} cards in deck · reshuffle {s.reshuffles}
              </small>
            </span>
            <div>
              <button
                aria-label="Zoom out"
                onClick={() => setZoom(Math.max(0.2, zoom - 0.1))}
              >
                −
              </button>
              <button onClick={fitBoard}>Fit</button>
              <button
                aria-label="Zoom in"
                onClick={() => setZoom(Math.min(1.5, zoom + 0.1))}
              >
                +
              </button>
            </div>
          </div>
          <div className="board-scroll" ref={boardRef}>
            <div
              style={{
                width: width * zoom,
                height: height * zoom,
                position: "relative",
              }}
            >
              <div
                className="board-canvas"
                style={{
                  width,
                  height,
                  transform: "scale(" + zoom + ")",
                  transformOrigin: "top left",
                }}
              >
                {s.locations.map((l) => (
                  <div
                    key={l.id}
                    className={
                      "location " +
                      (legalLocs.has(l.id) ? "eligible " : "") +
                      (selected === l.id ? "selected" : "")
                    }
                    style={{
                      left: (l.x - minX) * 240 + 30,
                      top: (l.y - minY) * 168 + 30,
                    }}
                  >
                    <button
                      className="location-face"
                      aria-label={"Select " + locationName(l)}
                      onClick={() => {
                        setSelected(l.id);
                        setOption(0);
                      }}
                    >
                      {l.card || !l.faceUp ? (
                        <img
                          src={img(l.faceUp ? l.card! : "back-0")}
                          alt={locationName(l)}
                          draggable={false}
                        />
                      ) : (
                        <div className="home-slot">
                          HOME
                          <br />
                          {s.players[l.home!]?.name}
                        </div>
                      )}
                    </button>
                    <span className="location-caption">{locationName(l)}</span>
                    {l.faceUp && l.card && (
                      <button
                        className="inspect-map"
                        aria-label={"Inspect " + locationName(l)}
                        onClick={() => setInspect(l.card)}
                      >
                        ↗
                      </button>
                    )}
                    {l.planets.map((pl, i) => (
                      <div
                        key={i}
                        className="planet-tokens"
                        style={{
                          left: (i % 2 === 0 ? 27 : 70) + "%",
                          top: (i < 2 ? 28 : 59) + "%",
                        }}
                      >
                        {pl.civs.map((c) => (
                          <span
                            key={c.id}
                            className="civ"
                            title={s.players[c.owner].name + " civilization"}
                            style={{ background: s.players[c.owner].color }}
                          >
                            ⌂{c.captives.length ? " " + c.captives.length : ""}
                          </span>
                        ))}
                        {pl.exploited && (
                          <span className="exploit" title="Exploited planet">
                            E
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
                {wps.map((w) => {
                  const fleets = s.fleets.filter((f) => f.wp === w);
                  return (
                    <button
                      key={w}
                      className={
                        "waypoint " +
                        (legalWps.has(w) ? "eligible " : "") +
                        (selectedWp === w ? "selected" : "")
                      }
                      style={point(w)}
                      aria-label={
                        "Waypoint " +
                        w +
                        (fleets.length
                          ? " · " +
                            fleets
                              .map(
                                (f) =>
                                  s.players[f.owner].name + " Fleet " + f.level,
                              )
                              .join(", ")
                          : " · empty")
                      }
                      onClick={() => {
                        setSelectedWp(w);
                        setOption(0);
                      }}
                    >
                      {fleets.length
                        ? fleets.map((f) => (
                            <span
                              key={f.id}
                              className="fleet"
                              style={{ background: s.players[f.owner].color }}
                            >
                              {f.sun ? "☀" : f.level === 2 ? "II" : "I"}
                            </span>
                          ))
                        : "✦"}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
        <aside className="action-panel">
          <div className="eyebrow">
            {s.over
              ? "EXPEDITION COMPLETE"
              : player.name.toUpperCase() +
                (s.pending ? " · DECISION" : " · YOUR TURN")}
          </div>
          <h2>
            {s.over
              ? s.winners.map((p) => s.players[p].name).join(" & ") + " wins"
              : instruction(s)}
          </h2>
          {s.over ? (
            <>
              <p>{s.reason}</p>
              <table>
                <thead>
                  <tr>
                    <th>Empire</th>
                    <th>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {s.players.map((x, i) => (
                    <tr key={i}>
                      <td>
                        {x.name}
                        <small>
                          {Object.entries(points(s, i))
                            .map(([k, v]) => k + ": " + v)
                            .join(" · ")}
                        </small>
                      </td>
                      <td>{score(s, i)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <>
              <div className="pools">
                {COLORS.map((c) => (
                  <span key={c} className={c}>
                    {COLOR_ACTION[c]} <b>{player.pools[c]}</b>
                  </span>
                ))}
              </div>
              {!human ? (
                <p className="bot-status">
                  {botPaused ? "Bots paused." : "Bot is considering its move…"}
                </p>
              ) : (
                <>
                  <label>
                    Action
                    <select
                      aria-label="Action"
                      value={fam}
                      onChange={(e) => {
                        setFamily(e.target.value);
                        setOption(0);
                        setSelectedCard(null);
                        setSelectedWp(null);
                        setSelected(null);
                      }}
                    >
                      {allFamilies.map((f) => (
                        <option key={f} value={f}>
                          {FAMILY[f] ?? f}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="selection-summary">
                    {selected !== null && <span>Location selected</span>}
                    {selectedCard && <span>Card selected</span>}
                    {selectedWp && <span>Waypoint selected</span>}
                    {(selected !== null || selectedCard || selectedWp) && (
                      <button
                        onClick={() => {
                          setSelected(null);
                          setSelectedCard(null);
                          setSelectedWp(null);
                          setOption(0);
                        }}
                      >
                        Clear / back
                      </button>
                    )}
                  </div>
                  <label>
                    {s.pending
                      ? "Choose a response"
                      : "Choose target and options"}
                    <select
                      aria-label="Action options"
                      value={Math.min(option, Math.max(0, filtered.length - 1))}
                      onChange={(e) => setOption(+e.target.value)}
                    >
                      {filtered.map((a, i) => (
                        <option key={i} value={i}>
                          {actionLabel(s, a)}
                        </option>
                      ))}
                    </select>
                  </label>
                  {chosen && (
                    <div className="preview">
                      <strong>{actionLabel(s, chosen)}</strong>
                      <div className="cost">Cost: {actionCost(s, chosen)}</div>
                      <p>
                        {chosen.a === "endTurn"
                          ? "Draw one card and pass play to the next empire."
                          : chosen.a === "invent"
                            ? CARDS[chosen.card!].techText
                            : chosen.a === "conquer"
                              ? "Your fleet power plus the chosen card faces a random deck card. Success converts one fleet to a Civ."
                              : chosen.a === "move"
                                ? "Highlighted waypoints are legal destinations. Green moves the whole armada; Red moves one fleet."
                                : chosen.a === "exploit"
                                  ? "Gain the guessed resource amount if it is at most the revealed rank. Empty planets receive an Exploit token."
                                  : "Confirm to resolve this choice. You can change the selection before committing."}
                      </p>
                      <button
                        className="primary"
                        onClick={() => dispatch(chosen)}
                      >
                        Confirm {FAMILY[chosen.a]?.toLowerCase() ?? "choice"} →
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
          <details className="journal">
            <summary>Recent events</summary>
            {s.log
              .slice(-8)
              .reverse()
              .map((e, i) => (
                <p key={i}>
                  <small>T{e.turn}</small> {e.msg}
                </p>
              ))}
          </details>
        </aside>
      </main>
      {human && handVisible && !s.over && (
        <section className="hand-panel">
          <header>
            <div>
              <button
                className={tab === "hand" ? "on" : ""}
                onClick={() => setTab("hand")}
              >
                Your hand · {player.hand.length}
              </button>
              <button
                className={tab === "techs" ? "on" : ""}
                onClick={() => setTab("techs")}
              >
                Your technologies · {player.techs.length}
              </button>
            </div>
            <span>
              Science capacity used {player.usedCapacity}/{research(s, p)}{" "}
              <button onClick={onHide}>Hide hand</button>
            </span>
          </header>
          <div className="hand">
            {(tab === "hand" ? player.hand : player.techs).map((id) => (
              <article
                key={id}
                className={selectedCard === id ? "selected" : ""}
              >
                <button
                  className="card-select"
                  aria-label={"Select card " + CARDS[id].name}
                  onClick={() => {
                    setSelectedCard(id);
                    setOption(0);
                  }}
                >
                  <img
                    src={img(id)}
                    alt={
                      CARDS[id].name +
                      " · " +
                      CARDS[id].rank +
                      " " +
                      COLOR_ACTION[CARDS[id].color]
                    }
                  />
                </button>
                <button
                  className="card-inspect"
                  aria-label={"Inspect " + CARDS[id].name}
                  onClick={() => setInspect(id)}
                >
                  {tab === "techs" ? CARDS[id].techName : CARDS[id].name} ↗
                </button>
              </article>
            ))}
            <article className="zero-card">
              <button onClick={() => setInspect("r01")}>
                <img
                  src={img("r01")}
                  alt="Permanent zero card and action reference"
                />
              </button>
            </article>
          </div>
        </section>
      )}
      {inspect && (
        <Modal
          title={CARDS[inspect]?.name ?? "Action reference"}
          onClose={() => setInspect(null)}
        >
          <div className="card-detail">
            <img
              src={img(inspect)}
              alt={CARDS[inspect]?.name ?? "Rules reference"}
            />
            <div>
              {CARDS[inspect] && (
                <>
                  <h3>{CARDS[inspect].techName || CARDS[inspect].kind}</h3>
                  <p>
                    {CARDS[inspect].techText ||
                      "Anomaly location and action card."}
                  </p>
                  <p>
                    Rank {CARDS[inspect].rank} ·{" "}
                    {COLOR_ACTION[CARDS[inspect].color]} ·{" "}
                    {CARDS[inspect].burst} burst / {CARDS[inspect].shield}{" "}
                    shield
                  </p>
                  <small>Source ID: {inspect}</small>
                </>
              )}
            </div>
          </div>
        </Modal>
      )}
      {rules && (
        <Modal title="How to play Galax" onClose={() => setRules(false)}>
          <div className="rules">
            <p>
              Cards are systems on the map, actions in your hand, and
              technologies in your tableau. A fleet on a shared border waypoint
              occupies both cards.
            </p>
            <h3>Your turn</h3>
            <ol>
              <li>
                Check for victory. Each civilized Green system gives an optional
                armada move.
              </li>
              <li>
                Play a card for its rank in actions; matching colors can add 1
                AP each. A same-rank second card gives 1 AP of its color. Two
                matching colors can become 2 AP of another color. Or take one
                free AP, or rest to draw 2.
              </li>
              <li>
                Spend actions using the map and action panel. Choose targets,
                then confirm.
              </li>
              <li>
                End your turn and draw 1 card (hand limit 7). The zero battle
                card is permanent.
              </li>
            </ol>
            <h3>Actions</h3>
            <p>
              <b>Explore:</b> reveal an occupied card, exploit an undefended
              planet, or move an armada. Fleets block exploitation; bracketed
              actions pay +1 AP per enemy fleet. A green move moves all your
              fleets on that waypoint.
            </p>
            <p>
              <b>Military:</b> move one fleet, conquer a planet, or battle an
              opponent at a shared location. Conquer compares fleet power + a
              hand card against a deck card. Battle cards are committed in
              private, one per armada; attacker wins ties. Bursts destroy fleets
              unless blocked by shields. The loser loses a fleet and retreats.
            </p>
            <p>
              <b>Commerce:</b> build a Civ for 2 AP (1 if exploited), or
              activate a system to draw, build/upgrade fleets, or gain research.
              Each system activates once per turn. You may also spend 1 AP to
              draw once per turn.
            </p>
            <p>
              <b>Science:</b> study for +1 Research, upgrade a fleet at a
              controlled system with your Civ, or invent a card. Total ranks
              invented this turn cannot exceed Research. Technologies persist;
              Discoveries resolve and shuffle back into the deck.
            </p>
            <h3>Benefits and victory</h3>
            <p>
              Civilized Red systems give +1 power. Yellow gives +1 action-card
              rank. Blue gives +3 Research, lost when its last Civ is lost.
              Research milestones: 4 adds an attacking shield; 6 gives +1 trophy
              when exploiting enemy Civs; 8 gives +1 battle power; reaching 10
              draws 5; 12 scores 3 VP.
            </p>
            <p>
              At turn start, Civs in all four system colors win Culture. A lead
              of 4 controlled locations and 4 trophies over every opponent wins
              Hegemony. When Super Nova appears, finish the turn: score trophies
              + technologies + Civs + controlled locations + Research VP. Ties
              use hand rank, then shared victory.
            </p>
            <h3>Playtest rulings</h3>
            <p>
              Uses the September 20 cards over older wording. Normal planets
              have no resource reward. Starting deployment follows the
              rulebook's 4-point budget. Anti Space Guns means one attacking
              fleet discarded per defending Civ. Tech Override requires
              discarded cards totaling rank 4. Research's level-10 draw occurs
              when crossing the threshold. The Gorb's prison location and some
              multi-target choices remain explicit playtest interpretations; see
              source audit.
            </p>
            <p>
              Hotseat hides hands between decisions. Undo and full replay
              exports can reveal prior secrets and are intended for consensual
              playtesting.
            </p>
            <button
              onClick={() => {
                setRules(false);
                setInspect("r01");
              }}
            >
              Inspect the actual reference card
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
