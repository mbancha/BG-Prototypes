# Digital prototype player experience standard

Apply these principles to each game's rules, components and decisions. Each new game owns its repository, assets, print tooling and deployment. Iterate through ideation, refinement, digital prototype, print-and-play and repeated playtesting.

## Play through the components

The main screen presents a readable tabletop: board, pieces, authorized hand, resources and current decision. Settings, references, logs and exports use compact secondary panels. Cards appear as their actual authored card-face images in hands, choices, purchases, objectives, reveals and inspection. Legal-action controls surround the card. Accessible text describes the same content and live overlays show mutable state such as damage, ownership and selection.

Use one stable-ID asset registry across print and digital views. Compose approved artwork, current data, typography and icons into complete card faces during the build. Regenerate the relevant faces when wording, costs, icons or layouts change. Review the full catalog, including long effects and maximum values. Players read the actual component when making a decision.

Preserve meaningful geometry: order, adjacency, orientation and occupied spaces. Ownership uses color plus insignia or shape. Public supplies show recognizable pieces with accurate counts. Private faces are rendered only for their authorized viewer. Bots receive the same permitted information.

Public card plays receive a brief, readable central reveal. Show the played card, then return to the pending decision; retain an inspectable entry in the public history. Queue rapid plays in order, support reduced motion and keyboard inspection, and synchronize timers with undo, resume and privacy handoff. Set the reveal duration for the game's pace.

## Card layout and icon vocabulary

Give related cards a cohesive frame and distinct information zones. Align repeated fields to stable boundaries: title, portrait, costs, stat band and effect text. Size each zone for its actual content; compact stat bands create room for readable abilities. Keep objectives' condition and reward visually distinct. Apply the game's approved layout consistently across component families.

Use icons in costs, stats and effect text, including equipment. A pictorial legend pairs every used glyph with its meaning. Familiar nouns use consistent glyphs; verbs, timing, targets, quantities and exceptions remain explicit. Unit abilities use a consistent perspective, usually first person. Aim for creative, original, succinct effects.

Design glyphs as distinct silhouettes at their smallest practical size. Shared frames identify related concepts; glyphs identify members. Reinforce color with shape. Use pale matching fills beneath stronger colored symbols for contrast. Separate easily confused hues, then check grayscale and table-distance recognition. Quantities have clear numeral placement or readily countable repeated symbols.

Keep visual style cohesive and tactile. Quiet light backgrounds, subtle paper grain and restrained accents support print readability. Select expressive art directions that fit the game. Preserve approved character identities and recognizable gear across portraits, cards and standees.

## Print as a physical product

Specify dimensions in inches or millimeters and verify exported PDF geometry at Actual size. Component size governs sheet layout. Arrange long tracks across multiple rows when necessary, keeping sections large enough for their pieces. Derive holder size from the card plus an explicit margin on every side; place ownership and identity symbols in the visible margin.

Use page space deliberately. Group related cards on shared sheets, place tracks in suitable spare areas, and order sheets by how players use the components. Include the components currently used by the game. Map margins preserve the artwork's ratio and join alignment while using the intended printable area.

The table reference is concise: bold terms, short bullets and a complete pictorial legend. Put shared rules there and component-specific effects on cards. Place detailed design and implementation material in their owning documents. Check every rendered page, representative actual-size cards, long rules, icon numerals, cut lines, folded pieces and grayscale.

## Language and source ownership

Write current-state documentation: describe the rules, components and behavior that exist. Integrate decisions into their owning sections as they become current. Keep one design document, one digital implementation document and one data sheet in the game's existing folder. Store clearly labeled assets under the game repository's assets directory. Local exports identify their authoritative source and verification date.

Use direct, plain language and short connected explanations. Headings and bullets aid scanning; bold terms establish hierarchy. Record decisions once, use stable names throughout, and preserve essential rule conditions when shortening text. Keep implementation diagnostics in engineering records and player-facing copy focused on play.

Keep the active workspace compact. Check references and consumers before removing superseded files. Version control preserves revision history. Maintain current source, approved masters, useful build inputs and deliverables.

## Turn flow and accessibility

Begin turns and resolve deterministic bookkeeping automatically. Keep strategic choices, optional spends, targets, voluntary passes and end-turn choices explicit. Shared-device play uses a deliberate privacy handoff. Bots act automatically during setup, turns and reactions; schedules respect the current state.

Support direct piece/card selection, legal-target highlighting, previewed costs and consequences, and cancel/reselect before commitment. Provide mouse, touch and keyboard paths. Undo returns to a meaningful decision with its automatic consequences handled consistently.

Prioritize readable cards and visible decisions. Wrapping, scrolling and zooming serve usability at full-hand and overflow sizes. Keep the current action above a readable chronological log. Inspectors support focus and tap as well as hover, remain within the viewport and update with live state.

## Acceptance and evidence

Verify a human journey through setup, an ordinary turn, an optional choice, interaction with an opponent, undo/resume and an explained ending. Exercise the same legal actions through UI and bots. Check privacy, state/RNG serialization, invalid-action rejection, information-reveal barriers and pending decisions.

Inspect desktop/tablet screenshots at ordinary zoom with full hands, long effects and crowded boards. Record actual test/build/asset results, simulation seeds, stalls, visual findings and remaining playtest questions. Distinguish implemented behavior, target behavior and measured evidence.

Compare objective difficulty and reward size in playtests. Use the game's own mechanics and component needs to choose quantities, dimensions and timing.
