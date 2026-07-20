# DECISIONS.md — judgment calls where the spec was silent

Rulings the prototype enforces. Each is cheap to change; most live in one
function. Numbers in **bold** are the cards involved. Rules changed in the
second playtest round are listed at the bottom (§ "Round-2 rule changes") and
in ARCHITECTURE.md §2.

## Matches & symbols

1. **Symbol matches are mandatory.** The spec says matches "trigger", with no
   "may" — so Muscle can force you to hit your own token and Whisper can force
   a move if any legal move exists. If a match has no legal outcome it fizzles
   (logged, counted in telemetry). Optional behavior would be a one-line change
   (add `skippable` to the match frames).
2. **Guild Mentor (6):** the 2 removals are independent choices and may be
   split across the two matched cards.
3. **Ghost Protocol (50):** the second move is optional and chosen after seeing
   the first; with Rumor Mill it may use a different card pair.
4. **Committee Chair (26):** prompted per Favor match when both targets can
   accept; silently redirects if only the neighbor can accept.
5. **Rumor Mill (58):** "any two adjacent cards" = any ordered pair of adjacent
   cards anywhere on the grid.
6. **Match resolution order:** all matches plus on-placement triggers go into
   one hub; the placing player resolves them in any order. When exactly one
   mandatory item remains it auto-resolves (order is moot) to save clicks.

## Zero Day (46)

7. The chosen card stands in for both "your placed card" and "the matched
   neighbor": Favor and Intel add to it, Muscle removes from it, Credit pays
   normally, Whisper moves 1 influence between it and any adjacent card
   (either direction).
8. Simulated matches count as real matches: telemetry, Guild Mentor, Lobbyist
   Liaison, Market Maker, Short Seller, Grid Worm all apply. Grid Worm's
   "also your placed card" lands on the same chosen card (net 2 there).
9. Scored cards are legal Zero Day targets (their symbols still count);
   influence portions then fizzle per the scored-card lockout, Credit still pays.

## Scoring

10. **Tie split:** "half the value rounded down" applies to *each* tied player
    regardless of how many are tied (3-way tie on 3 pts → 1 pt each).
    Divisor is `CONFIG.TIE_DIVISOR`.
11. **Incumbent (28):** wins the tie only if exactly one tied player has it;
    if two+ tied players have it, it cancels out → normal split among all tied.
    An Incumbent tie-win is *not* "scoring alone" for Kingmaker.
12. **Kingmaker (30):** +1 only when you had strictly the most influence.
13. **Party Leader (27) / Portfolio Hedge (39):** a zero-influence enclosure
    still counts as "a card is scored" (Portfolio Hedge pays, Party Leader
    can't by definition).
14. Multiple listeners resolve in player-index order (money only — order can't
    matter).

## Ongoing interactions

15. **Untouchable (9):** protects only against *opponents' Muscle matches*,
    exactly as worded — instants and Scandal still remove.
16. **The Wall (20):** blocks any *removal* (matches, instants, Scandal's
    self-removal) while you have 3+ there. Moves are not removals and are
    unaffected.
17. **Bouncer (17):** blocks opponents from moving *any* influence (not just
    yours) off cards where you have 2+; applies to Whisper matches and to move
    effects (Spoof, Gala Invitation, Hostile Takeover, Masquerade, Salon Host).
18. **Firewall (47):** only your tokens, only opponents' Whisper matches.
19. **Vendetta (10):** triggers on any removal of your influence, including
    your own (e.g. Scandal). Tokens returning from a scored card are not
    "removed" — no trigger.
20. **Short Seller (40):** $1 per Muscle *match* that removed at least one
    token (not per token); includes your own matches.
21. **Protection Racket (15):** reading "you are the only player with
    influence on 2+ cards" as: at least 2 cards exist where you have influence
    and nobody else does.
22. **Open Feed (42):** opponents' hands shown only during the owner's turn
    (the pass screen still hides everything between turns).
23. **Trigger order:** start-of-turn triggers queue in a hub; the owner
    resolves them in any order; conditions are evaluated at resolution time.

## Instants

24. **Filibuster (23):** blocks add, remove, move-off *and* move-onto (a move
    in is an addition). Expires at the start of the locking player's next
    turn. Scored cards can't be chosen; re-locking an already locked card
    replaces the lock.
25. **Whip Count (21):** pick card A (gets 1), then card B adjacent to A
    (gets 1). If no adjacent card can accept, the second token fizzles
    (partial resolution rather than whole-effect abort).
26. **Charm Offensive (52):** removal resolves first; if your supply is empty
    the add fizzles but the removal stands. If the removal is impossible the
    whole effect fizzles.
27. **Ransomware (44):** the *targeted opponent* chooses when both options are
    legal (hotseat prompt banner); a single legal option is forced; opponents
    with neither option are not legal targets; "remove 2" removes up to 2 from
    one card chosen by the controller.
28. **The Cleaner (4):** controller picks the exact amount (1..3) after
    choosing card and owner.
29. **Double Tap (5):** the $2 check happens immediately after the removal.
30. **Debt Collector (12):** removing your own token pays nothing.
31. **Arbitrage (34):** scored Brokers count — they are still "on the grid".
32. **Wingman (54):** the anchoring Socialite may be scored; the target card
    must be unscored/unlocked.
33. **Leg Breaker (19):** "card you placed most recently" is tracked per
    player; fizzles if you have not placed yet.
34. **Street Sweep (13):** rows/columns are infinite grid lines; only lines
    containing at least one removable token are offered; "up to 3" — you may
    stop early.
35. **Insider Tip (32):** draws beyond the hand limit are simply not drawn.
36. **Deep Scan (48):** first card selected in the dialog = next card drawn.
37. **Masquerade (55):** the swap is atomic — both directions are legality
    checked up front, then both moves happen.
38. **Scandal (53):** each player with influence removes 1 of their own;
    per-player protections (The Wall) exempt that player.
39. Deploying an instant with no legal target is allowed — the money is spent
    and the effect fizzles (logged). "Cancel before payment" = the deploy
    button is the payment; undo covers misclicks.

## Structure & flow

40. **Opening placement:** must cover the origin cell (0,0); any rotation.
    No deploy during it; no matches/enclosures are possible anyway.
41. **Final turns:** the countdown (2 × player count) starts after the turn in
    which the deck emptied finishes; a mid-turn deck-out (Insider Tip) doesn't
    consume one of that player's final turns.
42. **No reshuffle:** the discard pile never becomes a deck.
43. **End-of-game influence tiebreak:** tokens on unscored cards (scored cards
    hold none by then).
44. **Undo:** full-history undo (well beyond the required "start of current
    turn"), including across pass screens — it's a playtest tool; prior
    actions are in the log anyway. No redo. Depth capped by
    `CONFIG.MAX_UNDO_STEPS`.
45. **disabled flag:** a disabled card stays in the deck and works on the grid
    (symbols, points, enclosure); it cannot be deployed, and if it is already
    in a tableau its ongoing effect stops contributing.
46. **Effect keying:** effects are parameterized primitives in cards.json
    (`spec`); genuinely bespoke cards use a one-off op name (poisonKiss,
    zeroDay, …) — equivalent to "functions keyed by card id" since each op
    belongs to exactly one card.
47. **Deterministic deck:** shuffled once at setup; undo restores deck order
    exactly (no reshuffle-on-undo information leaks).
48. Baseline influence and entry bonuses (Union Boss, It Couple) land before
    match resolution, so matches see them.

## Round-2 rule changes (2026-07) — and the calls they forced

49. **Type-fixed symbol pairs.** The 6 pairs (of 10 possible) were chosen to
    roughly preserve the old symbol ratio (favor/intel stay most common;
    muscle/whisper/credit rarer) and for theme: Assassin muscle+whisper,
    Enforcer muscle+favor, Hacker intel+whisper, Senator favor+credit,
    Broker credit+intel, Socialite intel+favor. Stored ONCE in config
    `TYPE_SYMBOLS`; cards.json no longer carries top/bottom.
50. **VP from symbols** (credit/intel/favor 1, whisper 2, muscle 3) replaces
    per-card pts; cards.json no longer carries pts. All cards of a type are
    now worth the same (Assassin 5 … Socialite 2) — deliberate: the
    disruptive types are the juicy enclosure targets.
51. **Double-match bonus:** $1 when both halves of the *placed* card match at
    least one neighbor each. Placement-time only — Zero Day's two pseudo-
    matches do NOT earn it. Logged under money source "Double match".
52. **Draw-to-5:** end of turn always refills to `HAND_REFILL` = 5 (starting
    hand raised to 5 to match). `HAND_LIMIT` 6 remains the mid-turn ceiling,
    so Insider Tip can still bank one extra card.
53. **Bots:** any seat can be a bot (setup toggle). Bots use the same public
    Action API as humans (src/game/bot.ts + driver in App.tsx); they answer
    prompts semi-randomly, prefer opponents when choosing whose token to
    remove, never reveal their hand, and pick the placement with the most
    matches. Undo from a human seat skips back over bot moves. Answers a bot
    owes during YOUR turn (e.g. Ransomware's pay-or-lose choice) resolve
    automatically after a short delay.
54. **Card face on the grid:** enlarged type icon centered = the card's
    "art"; name runs along the side (spine style when vertical, top edge when
    horizontal); each half's symbol sits at its OUTER end — the only edge
    that can ever match; influence dots line the opposite side.

## Round-3 rule changes (2026-07, later the same day)

55. **Symbols reverted to per-card** (supersedes #49): the type-fixed pair
    experiment is out. Each card's top/bottom lives in cards.json again,
    hand-picked to fit the card's *name* (the original thematic assignment
    was restored); same-symbol doubles (favor/favor…) are back. Card type is
    flavor + a hook for type-referencing effects only.
56. **Symbol-derived VP survives the revert** (#50 still stands): pts =
    SYMBOL_VP[top] + SYMBOL_VP[bottom], now varying card-by-card — e.g.
    Silent Needle (muscle/whisper) 5, Rumor Mill (whisper/whisper) 4,
    Kneecapper (muscle/favor) 4, Earmark (favor/favor) 2. Watch scoring
    balance: the removal-heavy cards are now also the juiciest targets.
57. **Bots seek enclosures** (extends #53): placement scoring adds an
    enclosure term — big bonus for sealing a card the bot would score
    (2 + pts), half-pts for a tie it's in, a penalty (1 + pts) for handing
    an opponent the score, and a small denial bonus for sealing a
    zero-influence card (0.8 in 2-player, 0.3 otherwise — "sometimes", via
    the jitter tiebreak). Match influence changes are ignored by the
    heuristic (it's a guess, not a simulation).

## COLOR GROUPS mode (core experiment) — rulings

58. **Match = joining.** A placed half "matches" when it becomes adjacent to
    an existing group of its color; only then is influence added. A half
    that starts a new singleton group adds nothing (else every placement
    would mint influence). A half bridging several groups merges them all
    (pools combine) but still counts as ONE match.
59. **Sealing = full perimeter.** A group scores the instant no empty cell
    is orthogonally adjacent to any of its cells — the sealer can be any
    tile, any color, either player. The internal edge between a tile's own
    two halves can connect same-color halves for grouping but never counts
    as a match.
60. **Turns auto-advance** after the mandatory placement (no deploys, no
    prompts exist), and players whose hands are empty late-game are
    skipped; the game ends when every hand is empty.
61. **Open groups at game end score nothing** by default (pressure to
    seal); `COLOR_CFG.ENDGAME_OPEN_GROUPS` offers "half" and "full".
62. **★ bonus tiles (amended):** one ★+1 and one ★+2 per color pair (20
    when the variant is on). They are COLORED and extend/merge groups like
    any tile — but a ★ half matching a group adds NO influence and does not
    count as a match; instead each ★ half adds its value to whichever group
    it ends up a member of, evaluated at scoring. A ★ tile spanning two
    groups pays each of them its value.
63. **Color powers are promptless by design** — red's steal auto-targets
    the leading opponent; violet's spread (amended: the match influence
    goes to every unscored group orthogonally adjacent to the violet
    group, and none to the violet group itself — it fizzles with a log
    when the violet group has no neighbors) auto-targets everything at
    once; cyan's runner-up payout reuses the tie divisor. Powers live in
    resolveMatch/groupValue/scoreGroup in src/color/engine.ts.

## Not built (out of scope for a playtest loop)

- No networking, no save/load (a full game fits one sitting; the JSON
  dump captures the numbers that matter). Bots exist but are intentionally
  shallow — sparring partners, not opponents to beat.
- No animations; log + badges carry the information.
- Disabled-by-default list: **none** — all 60 effects are implemented and
  enabled.
