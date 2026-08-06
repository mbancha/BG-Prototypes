# DECISIONS.md — judgment calls where the spec was silent

> TEMPLATE. Append a numbered entry every time a rule question comes up that
> the design didn't answer. Cheap to write, and it stops the same question
> being re-litigated three sessions later — or silently re-answered a
> different way.

Format: the ruling, then *why*, then where it lives in code if non-obvious.
Mark superseded entries "(amended)" rather than deleting them — the history
of a rule is often the most useful part.

---

1. **Example — placement is mandatory.** If a player can place, they must;
   the alternative (passing freely) removes all board pressure. Relaxed only
   when the board limit leaves nowhere legal. See `applyAction`.

2. **Example — the bonus choice is offered, not automatic.** Touching two or
   more pieces asks the player rather than taking the better option for
   them. Rulings like this are why `state.pending` exists; the alternative
   (silently applying a default) hides a decision the designer wanted to
   watch people make. See the `bonus` frame in `engine.ts`.

## Not built (out of scope)

<!-- Say what you deliberately skipped, so nobody "fixes" it later:
networking, save/load, animation, AI beyond a sparring partner… -->
