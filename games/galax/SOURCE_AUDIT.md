# Galax source audit — September 21, 2026

## Inputs and precedence

- Designer-supplied `Galax 9-20-2026 (1).json`, a Dextrous TTS saved-object export. Its scripts are never executed. The export contains 65 physical copies / 62 unique faces: 44 system cards, 13 anomaly/Super Nova cards, four distinct tableau references, and four copies of r01.
- [Galax spreadsheet](https://docs.google.com/spreadsheets/d/1Arc20aSolr8XWNJzM8kemRvF_yfl3ZnCcqR640eYFqE/edit), `cards!A1:AO45`, retrieved September 20. Nickname joins c01–c44 to the sprite cells. The current snapshot has 21 Discoveries and 23 Technologies. `sources/cards-sheet.json` preserves these bounded rows.
- [Galax design notes](https://docs.google.com/document/d/1ptx3RBlercF8LKvmCKJR4kl8gUZNSUA3O02golyCtTo/edit), specifically the **Current Rules** section; speculative “To Try” and older playtest notes are not silently implemented.
- [Galax rulebook](https://docs.google.com/document/d/10sDTY00cziVZg8BNFLQvCMwHIjMoRoZG-XkkasUTPwg/edit), used for remaining procedures and the 2/3/4-player map diagrams. Images were inspected, including the staggered layout and six border waypoints.

The newer authored reference faces and Current Rules take precedence over older conflicting rulebook text. The designer was asked to confirm this precedence and the ambiguous card wording; no answer had arrived when this build was completed. These are explicit **provisional playtest rulings**, listed in DECISIONS.md, not designer-confirmed rules.

## Coverage

All 57 gameplay card IDs have authored local WebP faces, structured rank/color/type, and battle icons. All 44 system IDs have imported technology names, verbatim text, and planet resources. Every technology/discovery has an explicit engine path; none uses a text-parsing fallback or repeated sample rows. Tests exercise every card's invention and component conservation, plus targeted rules and privacy cases. This is not exhaustive proof of every interaction or an assertion that all provisional interpretations are correct.

Normal planets have no resource icon; all current planet faces omit numbered resistance. Imported planet resistance defaults to 1 for the remaining deployment bookkeeping. The new Conquer rule uses fleet power plus a committed card against a deck card rather than the old resistance formula.

The export and its Google-hosted bearer URLs remain local and ignored. Runtime builds contain local optimized assets, not URLs into Dextrous. Raw personal design notes are not committed. No missing card illustrations have been generated or substituted.

## Assets and provenance

`sources/asset-manifest.json` records each face's source sheet, cell index, dimensions, copies, and SHA-256 of the final file. Supplied artwork is used as provided by the project owner for this prototype; no broader third-party license is inferred. User-authored text stays on the card image and is also available as structured accessible text.

`scripts/import-dextrous.py` reproduces the import from a TTS export and bounded spreadsheet JSON. It accepts predownloaded sheets or downloads HTTPS references. Anomaly metadata is transcribed from the inspected September 20 faces and requires review when those faces change. `npm run assets` validates the 57 gameplay mappings, 62 face files, hashes, minimum image dimensions and 12 MiB budget.

## Maturity

Human-playable development playtest with hotseat, bots, replay, and simulation. **Not designated rules-complete** because source conflicts and several ambiguous effect details remain provisional. See DECISIONS.md and VERIFICATION.md before using simulation results for balance changes.


## September 23 supplement

The current design document was fetched again for the newest Playtest Notes block only. The designer explicitly authorized implementing it without new card images. This edition implements the unambiguous changes and documents the safe-exploit/completion and exhausted-supply interpretations in rulings 16–21. The incomplete trophy-only victory and technology replacement notes remain unresolved. Original 62 image files and spreadsheet fields are unchanged; two editable reference panels and action previews explain the current edition. No claim of rules completeness is made.
