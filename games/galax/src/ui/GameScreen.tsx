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
import { Modal } from "./Modal";
export { Modal } from "./Modal";
import ActionDialog from "./ActionDialog";
import ReferenceCards from "./ReferenceCards";
import {
  decisionStep,
  actionLocation,
  cardActions,
  waypointActions,
  planetActions,
  valueKey,
} from "../game/interaction";
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
  const [zoom, setZoom] = useState(0.45),
    [inspect, setInspect] = useState<string | null>(null),
    [rules, setRules] = useState(false),
    [references, setReferences] = useState(false),
    [notice, setNotice] = useState(""),
    [tab, setTab] = useState<"hand" | "techs">("hand"),
    [trail, setTrail] = useState<{ actions: Action[]; title: string }[]>([]),
    [showMapChoices, setShowMapChoices] = useState(false);
  const current = trail.at(-1),
    step = current ? decisionStep(s, current.actions) : null;
  function openChoices(options: Action[], title: string) {
    setNotice("");
    setShowMapChoices(false);
    if (!options.length) {
      setNotice("No available action here right now. " + instruction(s));
      return;
    }
    setTrail([{ actions: options, title }]);
  }
  function advance(options: Action[], title: string) {
    setShowMapChoices(false);
    setTrail((t) => [...t, { actions: options, title }]);
  }
  function back() {
    setShowMapChoices(false);
    setTrail((t) => t.slice(0, -1));
  }
  function cancel() {
    setTrail([]);
    setShowMapChoices(false);
  }
  useEffect(() => {
    setInspect(null);
    setNotice("");
    setShowMapChoices(false);
    setTrail(
      human && handVisible && actions.length && s.pending
        ? [{ actions, title: s.pending.title }]
        : [],
    );
  }, [s.serial, handVisible]);
  const allFamilies = [...new Set(actions.map((a) => a.a))];
  const xs = s.locations.map((l) => l.x),
    ys = s.locations.map((l) => l.y),
    minX = Math.min(...xs),
    minY = Math.min(...ys),
    width = (Math.max(...xs) - minX + 1) * 240 + 60,
    height = (Math.max(...ys) - minY) * 168 + 336 + 70;
  const boardRef = useRef<HTMLDivElement>(null);
  function fitBoard(overview = false) {
    const area = boardRef.current;
    if (area) {
      const fit = Math.min(
        1,
        (area.clientWidth - 16) / width,
        (area.clientHeight - 16) / height,
      );
      setZoom(overview ? fit : Math.max(0.45, fit));
    }
  }
  useEffect(() => {
    const area = boardRef.current;
    if (!area) return;
    const observer = new ResizeObserver(() => fitBoard());
    observer.observe(area);
    return () => observer.disconnect();
  }, [width, height]);
  const point = (wp: string) => {
    const [x, y] = wp.split(",").map(Number);
    return { left: (x / 2 - minX) * 240 + 30, top: (y / 2 - minY) * 168 + 30 };
  };
  const wps = [...new Set(s.locations.flatMap(waypoints))];
  const mapStep =
    !!step &&
    !showMapChoices &&
    (step.key === "location" ||
      step.key === "planet" ||
      ((step.key === "to" || step.key === "from") &&
        step.groups.every(
          (g) => typeof g.value === "string" && wps.includes(g.value),
        )));
  const available = current?.actions ?? actions;
  const legalLocs = new Set(
    available.flatMap((a) =>
      actionLocation(s, a) === undefined ? [] : [actionLocation(s, a)!],
    ),
  );
  const legalWps = new Set(
    available.flatMap(
      (a) =>
        [
          a.from,
          a.to,
          ...s.fleets
            .filter((f) => f.id === a.fleet || a.fleets?.includes(f.id))
            .map((f) => f.wp),
        ].filter(Boolean) as string[],
    ),
  );
  function clickLocation(id: number) {
    const l = s.locations.find((l) => l.id === id)!;
    if (mapStep && step?.key === "location") {
      const group = step.groups.find((g) => g.value === id);
      if (group) advance(group.actions, group.label);
    } else if (!current)
      openChoices(
        actions.filter((a) => actionLocation(s, a) === id),
        locationName(l),
      );
  }
  function clickPlanet(location: number, planet: number) {
    if (mapStep && step?.key === "planet") {
      const options = planetActions(s, current!.actions, location, planet);
      if (options.length) advance(options, "Planet " + (planet + 1));
    } else if (!current)
      openChoices(
        planetActions(s, actions, location, planet),
        "Planet " +
          (planet + 1) +
          " · " +
          locationName(s.locations.find((l) => l.id === location)!),
      );
  }
  function clickWaypoint(wp: string) {
    if (mapStep && (step?.key === "to" || step?.key === "from")) {
      const group = step.groups.find((g) => g.value === wp);
      if (group) advance(group.actions, group.label);
    } else if (!current)
      openChoices(waypointActions(s, actions, wp), "Fleet group");
  }
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
          <button onClick={() => setReferences(true)}>Table references</button>
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
              {score(s, i)} projected end-game points · {x.trophies} trophies
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
              <button onClick={() => setReferences(true)}>
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
      {mapStep && (
        <div className="map-prompt" role="status">
          <strong>{step!.title}</strong>
          <span>{current!.title}</span>
          <button onClick={back}>← Back</button>
          <button onClick={() => setShowMapChoices(true)}>
            Show option cards
          </button>
          <button onClick={cancel}>Cancel</button>
        </div>
      )}
      {notice && (
        <div className="map-prompt" role="status">
          {notice}
          <button onClick={() => setNotice("")}>Dismiss</button>
        </div>
      )}
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
              <button onClick={() => fitBoard(true)}>Fit</button>
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
                      (mapStep &&
                      step?.key === "location" &&
                      step.groups.some((g) => g.value === l.id)
                        ? "targeted"
                        : "")
                    }
                    style={{
                      left: (l.x - minX) * 240 + 30,
                      top: (l.y - minY) * 168 + 30,
                    }}
                  >
                    <button
                      className="location-face"
                      aria-label={"Select " + locationName(l)}
                      data-location={l.id}
                      onClick={() => clickLocation(l.id)}
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
                      <button
                        key={i}
                        className={
                          "planet-tokens planet-target " +
                          (planetActions(s, available, l.id, i).length
                            ? "eligible"
                            : "")
                        }
                        data-planet={l.id + ":" + i}
                        aria-label={
                          "Planet " + (i + 1) + " of " + locationName(l)
                        }
                        onClick={() => clickPlanet(l.id, i)}
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
                          <span
                            className="exploit"
                            title="Exploited: construction costs 1 less"
                          >
                            −1
                          </span>
                        )}
                        {!pl.civs.length && !pl.exploited && (
                          <span className="planet-ring" />
                        )}
                      </button>
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
                        (mapStep &&
                        (step?.key === "to" || step?.key === "from") &&
                        step.groups.some((g) => g.value === w)
                          ? "targeted"
                          : "")
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
                      data-waypoint={w}
                      onClick={() => clickWaypoint(w)}
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
                  <p className="table-instruction">
                    {s.phase === "home"
                      ? "Click a card in your hand to choose your home."
                      : s.phase === "forces"
                        ? "Click a home planet to place a Civ, or a star beside your home to place a fleet."
                        : s.pending
                          ? "Resolve the highlighted decision. You can reopen its choices below."
                          : "Click a card, planet or fleet to see what it can do."}
                  </p>
                  <div className="quick-actions">
                    {allFamilies
                      .filter((f) =>
                        [
                          "beginTurn",
                          "finishSetup",
                          "endTurn",
                          "rest",
                          "free",
                          "study",
                          "draw",
                          "choose",
                        ].includes(f),
                      )
                      .map((f) => (
                        <button
                          key={f}
                          data-family={f}
                          onClick={() =>
                            openChoices(
                              actions.filter((a) => a.a === f),
                              s.pending?.title ?? FAMILY[f],
                            )
                          }
                        >
                          {FAMILY[f]}
                        </button>
                      ))}
                  </div>
                  <button
                    className="deck-pile"
                    disabled={!actions.some((a) => a.a === "draw")}
                    onClick={() =>
                      openChoices(
                        actions.filter((a) => a.a === "draw"),
                        "Draw from the deck",
                      )
                    }
                    aria-label="Draw from the deck"
                  >
                    <img src={img("back-0")} alt="Draw deck" />
                    <span>{s.deckCount} cards · draw 1</span>
                  </button>
                  <details className="action-reference">
                    <summary>Available actions</summary>
                    <p>
                      Shortcut reference. You can also click the matching cards
                      and pieces.
                    </p>
                    <div className="quick-actions">
                      {allFamilies
                        .filter(
                          (f) =>
                            ![
                              "beginTurn",
                              "finishSetup",
                              "endTurn",
                              "rest",
                              "free",
                              "study",
                              "draw",
                              "choose",
                            ].includes(f),
                        )
                        .map((f) => (
                          <button
                            key={f}
                            data-family={f}
                            onClick={() =>
                              openChoices(
                                actions.filter((a) => a.a === f),
                                FAMILY[f],
                              )
                            }
                          >
                            {FAMILY[f]}
                          </button>
                        ))}
                    </div>
                  </details>
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
                className={cardActions(actions, id).length ? "usable" : ""}
              >
                <button
                  className="card-select"
                  aria-label={"Select card " + CARDS[id].name}
                  data-hand-card={id}
                  onClick={() => {
                    const options = cardActions(actions, id);
                    if (options.length) openChoices(options, CARDS[id].name);
                    else setInspect(id);
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
            <article className="mini-reference">
              <button onClick={() => setReferences(true)}>
                CARD ACTIONS
                <br />
                <small>Current reference · hand limit 8</small>
              </button>
            </article>
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
      {current && !mapStep && handVisible && human && (
        <ActionDialog
          key={s.serial + ":" + trail.length + ":" + current.title}
          s={s}
          actions={current.actions}
          title={current.title}
          onChoose={advance}
          onBack={back}
          onClose={cancel}
          onConfirm={(a) => {
            cancel();
            dispatch(a);
          }}
        />
      )}
      {references && (
        <Modal
          title="Current table references"
          onClose={() => setReferences(false)}
        >
          <ReferenceCards />
        </Modal>
      )}
      {inspect && (
        <Modal
          title={CARDS[inspect]?.name ?? "Action reference"}
          onClose={() => setInspect(null)}
        >
          <p className="art-note">
            Original September 20 artwork. September 23 on-screen rules override
            older wording: hand limit 8, Green moves up to two fleets, and every
            Discovery awards 1 trophy.
          </p>
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
                move of up to two fleets.
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
                End your turn and draw 1 card (hand limit 8). The zero battle
                card is permanent.
              </li>
            </ol>
            <h3>Actions</h3>
            <p>
              <b>Explore:</b> reveal an occupied card, exploit an undefended
              planet, or move an fleet group. Fleets block exploitation;
              bracketed actions pay +1 AP per enemy fleet. A green move moves up
              to two selected fleets on that waypoint.
            </p>
            <p>
              <b>Military:</b> move one fleet, conquer a planet, or battle an
              opponent at a shared location. Conquer compares fleet power + a
              hand card against a deck card. Battle cards are committed in
              private, one per fleet group; attacker wins ties. Bursts destroy
              fleets unless blocked by shields. The loser loses a fleet and
              retreats.
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
              Uses the September 23 playtest changes over older printed wording.
              Normal planets can now safely draw one card through Exploit.
              Specialty planets may push for more, requiring a strictly higher
              flipped rank. Discoveries also give one trophy. No-token builds
              give a trophy at the same cost and consume the Exploit marker.
              Starting deployment follows the rulebook's 4-point budget. Anti
              Space Guns means one attacking fleet discarded per defending Civ.
              Tech Override requires discarded cards totaling rank 4. Research's
              level-10 draw occurs when crossing the threshold. The Gorb's
              prison location and some multi-target choices remain explicit
              playtest interpretations; see source audit.
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
              Inspect the original reference card
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
