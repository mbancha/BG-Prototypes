// Renders whatever question the engine has parked in `s.pending`, for any
// game. Because Pending is a small fixed vocabulary (choose / chooseMany /
// number / order / confirm) this one component answers every decision a
// prototype has, and you only write custom UI for the prompts that deserve
// it — usually the ones that want board highlighting instead of a list.
//
// It never decides anything itself: it builds an Answer and dispatches it.

import { useEffect, useState } from "react";
import type { Answer, Pending } from "../kernel/decide";

export default function PendingPrompt(props: {
  pending: Pending;
  /** Player names, for "waiting on Bo" when the decision isn't the active
   *  player's — attacks, reactions, simultaneous windows. */
  names: string[];
  colors: string[];
  onAnswer: (ans: Answer) => void;
}) {
  const { pending: p } = props;
  const [picked, setPicked] = useState<string[]>([]);
  const [n, setN] = useState<number>(p.min ?? 0);

  // a new question clears whatever was half-selected for the old one
  useEffect(() => {
    setPicked([]);
    setN(p.min ?? 0);
  }, [p.prompt, p.t, p.who]);

  const options = (p.options ?? []).filter((o) => !o.disabled);
  const toggle = (k: string) =>
    setPicked((cur) =>
      cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k],
    );

  const manyOk =
    picked.length >= (p.min ?? 0) && picked.length <= (p.max ?? options.length);
  const orderOk = picked.length === options.length;

  return (
    <div className="prompt" style={{ ["--pc" as any]: props.colors[p.who] }}>
      <div className="promptwho" style={{ color: props.colors[p.who] }}>
        {props.names[p.who]} decides
      </div>
      <div className="prompttext">{p.prompt}</div>

      {(p.t === "choose" || p.t === "confirm") && (
        <div className="promptopts">
          {options.map((o) => (
            <button
              key={o.k}
              className="primary"
              onClick={() => props.onAnswer({ k: o.k })}
            >
              {o.label}
              {o.sub && <span className="optsub"> — {o.sub}</span>}
            </button>
          ))}
        </div>
      )}

      {p.t === "chooseMany" && (
        <>
          <div className="promptopts">
            {options.map((o) => (
              <button
                key={o.k}
                className={picked.includes(o.k) ? "primary" : ""}
                onClick={() => toggle(o.k)}
              >
                {picked.includes(o.k) ? "✓ " : ""}
                {o.label}
              </button>
            ))}
          </div>
          <button
            className="primary"
            disabled={!manyOk}
            onClick={() => props.onAnswer({ ks: picked })}
          >
            CONFIRM {picked.length}
            {p.max !== undefined ? `/${p.max}` : ""}
          </button>
        </>
      )}

      {p.t === "number" && (
        <div className="promptopts">
          <button onClick={() => setN((v) => Math.max(p.min ?? 0, v - 1))}>
            −
          </button>
          <span className="big">{n}</span>
          <button
            onClick={() => setN((v) => Math.min(p.max ?? v + 1, v + 1))}
          >
            +
          </button>
          <button className="primary" onClick={() => props.onAnswer({ n })}>
            CONFIRM
          </button>
        </div>
      )}

      {p.t === "order" && (
        <>
          <div className="promptopts">
            {options.map((o) => {
              const at = picked.indexOf(o.k);
              return (
                <button
                  key={o.k}
                  className={at === -1 ? "" : "primary"}
                  onClick={() => at === -1 && setPicked([...picked, o.k])}
                >
                  {at === -1 ? "" : `${at + 1}. `}
                  {o.label}
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setPicked([])}>reset</button>
            <button
              className="primary"
              disabled={!orderOk}
              onClick={() => props.onAnswer({ order: picked })}
            >
              CONFIRM ORDER
            </button>
          </div>
        </>
      )}

      {p.skip && (
        <button onClick={() => props.onAnswer({ skip: true })}>{p.skip}</button>
      )}
    </div>
  );
}
