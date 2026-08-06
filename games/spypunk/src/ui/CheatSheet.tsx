// =============================================================================
// In-game rules reference for CLASSIC mode (📖 button / "?" key).
//
// Everything here is derived from live data — CONFIG numbers, SYMBOL_VP, the
// card database — so retuning config.ts or cards.json updates the cheat sheet
// automatically and it can never drift from the rules the engine enforces.
// The one hand-written part is the per-type blurb below, since a card type is
// flavor plus a grab-bag of effects rather than a single mechanical rule.
// =============================================================================

import { CARDS, KIND_GLYPH, SYM_GLYPH, SYM_NAME, TYPE_ICON } from "../game/cards";
import { CONFIG, SYMBOL_VP } from "../data/config";
import type { CType, GameState, Sym } from "../game/types";

const SYMS: Sym[] = ["muscle", "whisper", "favor", "intel", "credit"];

/** What each symbol does when two touching halves match. Values come from
 *  CONFIG so the sheet tracks tuning; ongoing cards can raise them in play. */
const SYM_EFFECT: Record<Sym, string> = {
  muscle: `remove ${CONFIG.MUSCLE_REMOVE} influence from either matched card`,
  intel: `add ${CONFIG.INTEL_ADD} of your influence to the matched neighbor`,
  favor: `add ${CONFIG.FAVOR_ADD} of your influence to the card you placed`,
  credit: `gain $${CONFIG.CREDIT_GAIN}`,
  whisper: `move ${CONFIG.WHISPER_MOVE} influence between the matched cards`,
};

const TYPE_BLURB: Record<CType, string> = {
  Assassin: "Removal. Strips influence off cards — often several at once.",
  Enforcer: "Force and protection. Bulk influence, taxes, and blocks.",
  Senator: "Control. Adds influence, locks cards, wins ties.",
  Broker: "Economy. Cash, draws, discounts and payouts.",
  Hacker: "Manipulation. Moves influence, peeks, copies symbols.",
  Socialite: "Social. Swaps and steals influence, adjacency bonuses.",
};

export default function CheatSheet(props: { s: GameState; onClose: () => void }) {
  const { s } = props;
  const counts = {} as Record<CType, number>;
  for (const c of CARDS) counts[c.type] = (counts[c.type] ?? 0) + 1;

  return (
    <div className="modal" onClick={props.onClose}>
      <div className="modalcard sheet" onClick={(e) => e.stopPropagation()}>
        <div className="simhead">
          <b>📖 CHEAT SHEET</b>
          <span style={{ flex: 1 }} />
          <button onClick={props.onClose}>✕ close</button>
        </div>

        <div className="sheetcols">
          <div>
            <h4>YOUR TURN</h4>
            <ol className="sheetlist">
              <li>
                <b>Deploy</b> (optional, once): pay a card's cost.{" "}
                {KIND_GLYPH.I} resolves immediately then discards;{" "}
                {KIND_GLYPH.O} stays in your tableau and keeps working.
              </li>
              <li>
                <b>Place</b> (required): put one card on the grid touching an
                existing card. It enters with {CONFIG.BASELINE_INFLUENCE} of
                your influence. Every outer edge that meets a neighbor showing
                the <i>same symbol</i> triggers a match.
              </li>
              <li>
                <b>End turn</b>: draw back up to {CONFIG.HAND_REFILL} cards.
              </li>
            </ol>
            <div className="sheetnote">
              Match both halves of the card you place (each against at least
              one neighbor) and gain an extra{" "}
              <b>${CONFIG.DOUBLE_MATCH_BONUS}</b>. You choose the order
              matches resolve in.
            </div>

            <h4>SYMBOL MATCHES</h4>
            <table>
              <tbody>
                {SYMS.map((sym) => (
                  <tr key={sym}>
                    <th>
                      {SYM_GLYPH[sym]} {SYM_NAME[sym]}
                    </th>
                    <td>{SYM_EFFECT[sym]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="sheetnote">
              Matches are mandatory; one with no legal target simply fizzles.
              Ongoing cards in play can change these numbers.
            </div>
          </div>

          <div>
            <h4>SCORING</h4>
            <div className="sheetnote" style={{ marginTop: 0 }}>
              A card <b>scores when it is fully enclosed</b> — every cell
              around it occupied (or unplayable because of the{" "}
              {s.limit.w}×{s.limit.h} limit). Whoever has the most influence on
              it takes its points; ties split the value, rounded down; all
              influence then returns to its owners.
            </div>
            <h4>CARD VALUES</h4>
            <table>
              <tbody>
                {SYMS.map((sym) => (
                  <tr key={sym}>
                    <th>
                      {SYM_GLYPH[sym]} {SYM_NAME[sym]}
                    </th>
                    <td>
                      {SYMBOL_VP[sym]} pt{SYMBOL_VP[sym] > 1 ? "s" : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="sheetnote">
              A card is worth the sum of its two symbols — so a{" "}
              {SYM_GLYPH.muscle}
              {SYM_GLYPH.whisper} card is worth{" "}
              {SYMBOL_VP.muscle + SYMBOL_VP.whisper}, a {SYM_GLYPH.favor}
              {SYM_GLYPH.favor} card {SYMBOL_VP.favor * 2}.
            </div>

            <h4>CARD TYPES</h4>
            <table>
              <tbody>
                {(Object.keys(TYPE_BLURB) as CType[]).map((t) => (
                  <tr key={t}>
                    <th style={{ whiteSpace: "nowrap" }}>
                      {TYPE_ICON[t]} {t}
                      <span style={{ color: "var(--dim)" }}> ×{counts[t]}</span>
                    </th>
                    <td>{TYPE_BLURB[t]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="sheetnote">
              Types are flavor plus a hook for cards that name them (Union
              Boss, Wingman, Sleeper Agent…). A card's symbols — and so its
              points — are printed per card, not set by its type.
            </div>

            <h4>GAME END</h4>
            <div className="sheetnote" style={{ marginTop: 0 }}>
              When the deck runs out every player gets{" "}
              {CONFIG.FINAL_TURNS_PER_PLAYER} more turns; play also stops if
              the {s.limit.w}×{s.limit.h} limit leaves nowhere to place.
              Highest points wins, then money, then influence left on the grid.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
