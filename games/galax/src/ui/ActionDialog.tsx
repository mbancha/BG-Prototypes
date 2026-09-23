import { useState } from "react";
import { actionCost, CARDS, type Action, type GameState } from "../game/engine";
import {
  actionLocation,
  decisionStep,
  describeValue,
  valueKey,
  actionKey,
  actionPreview,
} from "../game/interaction";
import { actionLabel } from "../game/presentation";
import { Modal } from "./Modal";

export default function ActionDialog({
  s,
  actions,
  title,
  onChoose,
  onBack,
  onClose,
  onConfirm,
}: {
  s: GameState;
  actions: Action[];
  title: string;
  onChoose: (a: Action[], title: string) => void;
  onBack: () => void;
  onClose: () => void;
  onConfirm: (a: Action) => void;
}) {
  const step = decisionStep(s, actions);
  const collection =
    step &&
    ["fleets", "planets", "cards"].includes(step.key) &&
    step.groups.every((g) => Array.isArray(g.value));
  const [selected, setSelected] = useState<(string | number)[]>(() =>
    collection
      ? (step.groups[0].value as (string | number)[]).filter((value) =>
          step.groups.every((g) =>
            (g.value as (string | number)[]).includes(value),
          ),
        )
      : [],
  );
  const values = collection
    ? [...new Set(step.groups.flatMap((g) => g.value as (string | number)[]))]
    : [];
  const exact = collection
    ? step.groups.find((g) => {
        const v = g.value as (string | number)[];
        return (
          v.length === selected.length && selected.every((x) => v.includes(x))
        );
      })
    : undefined;
  const a = actions[0];
  const location = a && s.locations.find((l) => l.id === actionLocation(s, a));
  const previewCards = [
    ...new Set(
      [
        a?.card,
        ...(a?.cards ?? []),
        ...(location?.faceUp && location.card ? [location.card] : []),
      ].filter(Boolean) as string[],
    ),
  ];
  return (
    <Modal title={title} onClose={onClose}>
      <div className="choice-topline">
        <button onClick={onBack}>← Back</button>
        <span>Choose freely. Nothing happens until you confirm.</span>
      </div>
      {step ? (
        <>
          <h3>{step.title}</h3>
          {collection ? (
            <>
              <p>
                {step.key === "fleets"
                  ? "Select the individual ships that travel together."
                  : step.key === "cards"
                    ? "Tap the cards you want to commit. Tap again to remove."
                    : "Tap each planet you want to build on in this activation."}
              </p>
              <div className="choice-grid">
                {values.map((value) => {
                  const info = describeValue(
                    s,
                    step.key === "cards"
                      ? "card"
                      : step.key === "fleets"
                        ? "fleet"
                        : "planet",
                    value,
                  );
                  const on = selected.includes(value);
                  const canAdd = step.groups.some((g) =>
                    [...selected, value].every((x) =>
                      (g.value as (string | number)[]).includes(x),
                    ),
                  );
                  return (
                    <button
                      key={value}
                      className={"choice-tile " + (on ? "picked" : "")}
                      aria-pressed={on}
                      disabled={!on && !canAdd}
                      data-pick={valueKey(value)}
                      onClick={() =>
                        setSelected(
                          on
                            ? selected.filter((x) => x !== value)
                            : [...selected, value],
                        )
                      }
                    >
                      {info.image ? (
                        <img
                          src={"./cards/" + info.image + ".webp"}
                          alt={info.label}
                        />
                      ) : (
                        <span className="piece-glyph">
                          {step.key === "fleets" ? "▲" : "◉"}
                        </span>
                      )}
                      <strong>{info.label}</strong>
                      {on && <span className="pick-check">✓</span>}
                    </button>
                  );
                })}
              </div>
              <div className="choice-footer">
                <span>{selected.length} selected</span>
                <button
                  className="primary"
                  disabled={!exact}
                  onClick={() => exact && onChoose(exact.actions, exact.label)}
                >
                  Use selection
                </button>
              </div>
            </>
          ) : (
            <div className="choice-grid">
              {step.groups.map((g) => (
                <button
                  key={valueKey(g.value)}
                  className={"choice-tile " + (g.image ? "with-card" : "")}
                  data-choice-key={step.key}
                  data-choice-value={valueKey(g.value)}
                  onClick={() => onChoose(g.actions, g.label)}
                >
                  {g.image && (
                    <img src={"./cards/" + g.image + ".webp"} alt={g.label} />
                  )}
                  <strong>{g.label}</strong>
                  {step.key === "a" && (
                    <small>
                      {
                        (
                          {
                            play: "Discard for action points",
                            invent: "Keep a Technology or resolve a Discovery",
                            home: "Make this your starting system",
                            dual: "Pair with a same-rank card",
                            wild: "Pair matching colors for another action color",
                            boost: "Add one action point",
                            build:
                              "Place Civs or claim supply-exhaustion trophies",
                            exploit: "Take a safe card or push for resources",
                            move: "Pick ships, then a destination",
                          } as Record<string, string>
                        )[String(g.value)]
                      }
                    </small>
                  )}
                  {step.key === "card" &&
                    typeof g.value === "string" &&
                    CARDS[g.value] && (
                      <small>
                        {CARDS[g.value].techName} · rank {CARDS[g.value].rank}
                      </small>
                    )}
                </button>
              ))}
            </div>
          )}
        </>
      ) : a ? (
        <div className="action-confirm">
          <div className="confirm-cards">
            {previewCards.map((id) => (
              <img
                key={id}
                src={"./cards/" + id + ".webp"}
                alt={id === "r01" ? "Zero card" : CARDS[id]?.name}
              />
            ))}
          </div>
          <h3>{actionLabel(s, a)}</h3>
          <p>{actionPreview(s, a)}</p>
          <div className="cost">Cost: {actionCost(s, a)}</div>
          <button
            className="primary"
            data-action={actionKey(a)}
            onClick={() => onConfirm(a)}
          >
            Confirm action →
          </button>
        </div>
      ) : (
        <p>No legal actions here right now.</p>
      )}
    </Modal>
  );
}
