# Spec template — what to send to start a prototype

Copy this, fill it in, paste it. It doesn't need to be complete or elegant;
it needs to be *specific where it matters* and honest about what's undecided.
The one-shot builds happen when components and turn structure are concrete.

---

## 1. The pitch

One or two sentences: theme, player count, playtime, and the feeling you're
after. ("Cyberpunk influence-brokering; 2–4 players; 30 min; tense, mean,
lots of table talk.")

## 2. Components

Every physical thing, with quantities and what's printed on each.

- Board? Fixed, modular, or built from played pieces?
- Cards/tiles: how many unique, how many copies, what's on a face.
- Tokens/currency/markers: how many per player, shared supply or personal?

If pieces have unique text (cards with abilities), **list them verbatim** —
name, cost, type, symbols, rules text. This is the single highest-value part
of the spec; a table or list of 60 cards pasted in full is exactly right.

## 3. Setup

Starting hand, starting resources, who goes first, initial board state.

## 4. Turn structure

The actions available on a turn, in order, and which are optional vs
mandatory. Be explicit about limits ("one deploy per turn", "placement is
mandatory if legal").

## 5. Core mechanics

The interactions that make the game. Placement/adjacency rules, matching,
combat, auctions — whatever applies. Include the edge cases you already
know are edge cases.

Naming the familiar families is genuinely useful here ("worker placement
with blocking", "trick-taking, must follow suit", "deck-building with a
market row", "area majority", "action points, four per turn", "simultaneous
draft"). Each one maps to a primitive the kernel already has, so saying it
plainly is faster than describing it from scratch — see the mechanism
cookbook in SKILL.md.

## 6. Scoring and game end

How points are earned, when the game ends, tiebreakers.

## 7. Open questions

The things you genuinely haven't decided. Say so explicitly — and add:

> **Where the spec is silent, make a sensible ruling, implement it, and log
> it in DECISIONS.md rather than stopping to ask.**

That line is what keeps a build moving instead of stalling on twenty
clarification questions.

## 8. What you want to be able to change fast

The dials you expect to fiddle with (costs, hand size, scoring values,
board size). They become the config file.

## 9. Attachments

Photos are useful for: board layouts, component shapes, physical prototypes
mid-play, spatial arrangements. Type rules text rather than photographing
handwriting.

---

### Also worth stating (optional)

- **Mode/variant ideas** you want to A/B — they become setup-screen toggles.
- **Comparable games** ("Carcassonne meets Splendor") for the interaction
  model, when it's faster than describing it.
- **What you'll playtest first** — the question the prototype exists to
  answer, which decides what the telemetry should count.
