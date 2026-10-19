# Digital prototype player experience standard

Required for new digital prototypes and changed UI flows. Apply the principles to
the game's own components and rules; do not copy MttS mechanics, palettes or screen
layout into unrelated games. Existing games and the starter template are not
certified compliant simply because this document exists. Record scoped gaps when
working on them; do not undertake an unsolicited migration.

## Play the game through its components

- The main screen is a readable tabletop: board, pieces, hand, resources and the
  current decision. Settings, Library/reference catalogs, logs, exports and debug
  action lists belong in compact secondary panels, collapsed by default.
- Show cards as cards, tiles as tiles, tokens as tokens, and characters as standees
  or distinct pieces. Supplies show individual meeples/tokens where useful, with
  a count as a supplement. Overflow is a physical tray of owned pieces, not a
  paragraph of player totals. At large quantities, group pieces and show an exact
  count without pretending a capped display contains every piece.
- Preserve meaningful physical geometry: sequence, adjacency, orientation and
  occupied spaces. A left-to-right printed track remains left-to-right on screen,
  including across a fold. Layout changes must not imply different legal neighbors.
- Make ownership readable using color plus shape, insignia or labels. Distinguish
  characters from ordinary workers and special spaces from ordinary spaces.
- Show public hand size with card backs/counts and the authorized player's hand
  with readable card faces. Never render opponents' private faces in hidden DOM,
  inspectors, tooltips or accessibility labels. Bots receive projected views too.

## Card faces and concise rules

- Give Subplots/objectives, characters and action/Twist cards a consistent card
  silhouette. Reserve a small upper area for art (a clearly intentional placeholder
  is sufficient); place title and rules below. Keep all costs and actions visible.
- Use a stable icon vocabulary for resources, movement, drawing, placement and
  power. Supply accessible names and a small legend or tap/focus explanation;
  recognition should save reading without making unfamiliar icons a guessing game.
- Use concise cost/effect syntax: `1 [ink]: move 1 space`, `2 [coin]: draw 2`.
  Action cards put cost at bottom left and emphasize `+power` and short effects
  in the rules area. A card usable as a secondary combat action gets a small
  `1 [ink]: +1` footer. Show current modified cost/power where applicable and make
  the source of modifications inspectable. Symbols must match the rules engine.
- Separate an objective's condition from its reward. Label mutually exclusive
  rewards clearly, for example `Keep` / `or` / `Take now`. Character activations use
  the same cost syntax. Include timing, target, limits and exceptions needed to
  play correctly; concision must not change a rule.
- Put shared rules in an accessible base-rules reference rather than repeating
  reminders on every ability. Keep genuine exceptions on the relevant component.
  Audit the whole active catalog, prompts and inspectors for inconsistent wording.
- Placeholder art and simple vector icons are enough for early testing. Readable
  component shapes, hierarchy and interactions are baseline usability, not optional
  final polish. Preserve supplied assets and authorship; do not invent final art.

## A turn should flow without administrative clicks

- Begin the human turn automatically when control reaches them. Reveal their hand
  automatically in single-human play. Keep a deliberate privacy handoff when
  several humans share a device; privacy is a real decision boundary.
- Interact directly: select a piece/card, then click or tap a legal target. Dragging
  may supplement this, but must have a tap/keyboard alternative. Highlight legal
  targets and selection; show cost and consequences before committing a spend.
- After movement, prompt for placement or the next real choice automatically.
  Do not require Show options, Begin turn, Resolve, Continue or repeated selection
  clicks merely to advance deterministic bookkeeping. Auto-resolve forced steps
  only when no meaningful timing, privacy or optional-resource decision remains.
- Optional purchases, reward selection, passing and voluntary end-turn choices
  stay explicit where they matter. Do not silently spend resources, select a
  strategic target, skip an optional benefit, or end a turn with useful choices.
- Bots automatically act after a human finishes, including setup and reactions.
  Show whose turn/decision it is; provide pause/resume for debugging and inspection.
  Schedule bots without blocking input or executing stale/duplicate actions.
- Undo returns to a meaningful human decision, including its automatic follow-up
  bookkeeping. Group or clearly handle bot replies and pause bots after Undo so
  they do not instantly replay. Explain limitations involving revealed information.
- Drive highlighted targets and prompts from engine legality. A diagnostic list of
  every action may exist behind Advanced, but cannot be the normal interface.

## Readability, accessibility and recovery

- Prioritize the board, active hand and current prompt. Keep references out of the
  way and reduce empty panel space. Players should see what changed and what they
  can do next without searching a log or interpreting internal phase names.
- Use readable type, contrast and sufficiently large touch targets. Support focus
  indicators, keyboard operation and tap-to-inspect; hover alone is insufficient.
- Test desktop and tablet with long rules, several characters, full hands, expanded
  rewards and crowded supplies. Use scrolling/zooming intentionally. Never crop a
  card's cost, legal choice, final text line or action button inside a fixed-height
  panel. Offer pan/zoom/fit for large boards without changing topology.
- Allow cancel/reselect before commitment and explain disabled/unavailable actions
  when useful. No dead-end prompt, invisible mandatory choice, or JSON editing to
  continue a normal game. Errors should preserve the last valid state.

## Acceptance evidence before calling the UI ready

Record in the game's verification notes:

1. A human browser journey: setup, a complete turn, movement/placement where
   applicable, an optional spend/reward, an interrupt/conflict, automatic bot reply,
   return to human control, Undo, and an explained ending. Mark inapplicable steps.
2. Privacy checks for single-human and shared-device modes; no opponent secrets in
   rendered output or bot projections. Confirm public counters match actual pieces.
3. Desktop/tablet screenshots, actually opened and inspected. Record filenames and
   findings for text, cost/action visibility, ownership, geometry and crowded states.
   A screenshot being generated is not evidence that someone checked it.
4. Focused tests for changed rules and automatic transitions, plus the app's required
   tests/build/browser smoke checks. Green tests alone do not establish usable UI,
   complete rules, or balanced rewards.
5. Remaining playtest questions and any deviations from this standard, with reason.
   Keep changes local when requested; publish only within the authorized scope.

During design, compare objective difficulty and reward size explicitly. Conditions
requiring several pieces, rare book combinations, or opponent cooperation deserve
appropriate rewards or easier alternatives. This is a review habit, not a universal
requirement that every game's objectives use the same conditions or rewards.
