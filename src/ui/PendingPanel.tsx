import { useEffect, useState } from "react";
import { def, SYM_GLYPH, TYPE_ICON } from "../game/cards";
import type { GameState } from "../game/types";

/** Renders the current pending decision (targeting, choices, ordering). */
export default function PendingPanel(props: {
  s: GameState;
  answer: (ans: any) => void;
}) {
  const { s, answer } = props;
  const pend = s.pending;
  const [order, setOrder] = useState<number[]>([]);
  // reset deck-order picks whenever the pending decision changes (e.g. undo)
  useEffect(() => setOrder([]), [pend]);
  if (!pend) return null;

  const whoBanner = (who?: number) =>
    who !== undefined && who !== s.turn.p ? (
      <div className="who" style={{ color: s.players[who].color }}>
        ⚠ {s.players[who].name} decides:
      </div>
    ) : null;

  if (pend.t === "hub") {
    return (
      <div className="pendbox">
        <div className="prompt">{pend.title}</div>
        <div className="opts">
          {pend.items.map((it, i) => (
            <div className="hubitem" key={it.key}>
              <button onClick={() => answer({ i })}>▶ {it.label}</button>
              <span className="sub">{it.sub}</span>
              {it.optional && (
                <button onClick={() => answer({ i, skip: true })}>skip</button>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (pend.t === "card") {
    return (
      <div className="pendbox">
        {whoBanner(pend.who)}
        <div className="prompt">{pend.prompt}</div>
        <div className="cardchips">
          {pend.ids.map((id) => (
            <button key={id} onClick={() => answer({ card: id })}>
              {TYPE_ICON[def(id).type]} {def(id).name}
            </button>
          ))}
        </div>
        <div style={{ color: "var(--dim)", marginTop: 6, fontSize: 11 }}>
          (highlighted cards on the grid are also clickable)
        </div>
        {pend.skip && (
          <button style={{ marginTop: 6 }} onClick={() => answer({ skip: true })}>
            ✕ {pend.skip}
          </button>
        )}
      </div>
    );
  }

  if (pend.t === "owner") {
    return (
      <div className="pendbox">
        <div className="prompt">{pend.prompt}</div>
        <div className="opts">
          {pend.owners.map((o) => (
            <button
              key={o.p}
              style={{ color: s.players[o.p].color, borderColor: s.players[o.p].color }}
              onClick={() => answer({ p: o.p })}
            >
              {s.players[o.p].name} ({o.n} here)
            </button>
          ))}
        </div>
        {pend.skip && (
          <button style={{ marginTop: 6 }} onClick={() => answer({ skip: true })}>
            ✕ {pend.skip}
          </button>
        )}
      </div>
    );
  }

  if (pend.t === "player") {
    return (
      <div className="pendbox">
        {whoBanner(pend.who)}
        <div className="prompt">{pend.prompt}</div>
        <div className="opts">
          {pend.players.map((p) => (
            <button
              key={p}
              style={{ color: s.players[p].color, borderColor: s.players[p].color }}
              onClick={() => answer({ p })}
            >
              {s.players[p].name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (pend.t === "opt") {
    return (
      <div className="pendbox">
        {whoBanner(pend.who)}
        <div className="prompt">{pend.prompt}</div>
        <div className="opts">
          {pend.options.map((o) => (
            <button key={o.k} onClick={() => answer({ k: o.k })}>
              {o.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (pend.t === "line") {
    return (
      <div className="pendbox">
        <div className="prompt">{pend.prompt}</div>
        <div className="opts">
          {pend.lines.map((l) => (
            <button key={l.key} onClick={() => answer({ key: l.key })}>
              {l.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (pend.t === "deckOrder") {
    const remaining = pend.cards.filter((c) => !order.includes(c));
    return (
      <div className="modal">
        <div className="modalcard">
          <div className="prompt">{pend.prompt}</div>
          <div className="deckcards">
            {pend.cards.map((id) => {
              const idx = order.indexOf(id);
              const d = def(id);
              return (
                <div
                  key={id}
                  className={"hcard" + (idx !== -1 ? " selected" : "")}
                  style={{ cursor: "pointer" }}
                  onClick={() =>
                    setOrder((o) =>
                      o.includes(id) ? o.filter((x) => x !== id) : [...o, id],
                    )
                  }
                >
                  <div className="hd">
                    <span className="nm">
                      {TYPE_ICON[d.type]} {d.name}
                    </span>
                    <span>{idx !== -1 ? `#${idx + 1}` : ""}</span>
                  </div>
                  <div className="meta">
                    <span>${d.cost}</span>
                    <span>{d.pts}★</span>
                    <span>{d.kind === "I" ? "INSTANT" : "ONGOING"}</span>
                  </div>
                  <div className="syms">
                    <span className="s">{SYM_GLYPH[d.top]}</span>
                    <span className="s">{SYM_GLYPH[d.bottom]}</span>
                  </div>
                  <div className="fx">{d.text}</div>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="primary"
              disabled={remaining.length > 0}
              onClick={() => {
                answer({ order });
                setOrder([]);
              }}
            >
              Confirm order
            </button>
            <button onClick={() => setOrder([])}>Reset</button>
            <span style={{ color: "var(--dim)", alignSelf: "center" }}>
              #1 will be drawn first
            </span>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
