# Battlescrap — 20 PP hero refresh

20 October 2026 · Proposed content version `hero-refresh-v7` · TEST balance.

This is the new design addendum for Sol to implement. It supersedes the regional-v5 hero stats, costs, core/card text and preparation prices only. The live prototype is currently `bonfire-scenario-v6`; preserve its newer bonfire scoring, defeat VP and target 8. This pass supplies design and artwork, not game-code changes. The two live Google Docs were read on 20 October and confirm the named regional roster. They have not been rewritten by this pass.

Sources: [Design Draft](https://docs.google.com/document/d/1PlwHc5BWQdSv77xgSlSmNEiZIhgJ40cii22NKibvcFM), [Build Specification](https://docs.google.com/document/d/16-weAaDa4W7e4gC2jeiv_NN0cSAS_bcd_WATxPcDSAU), plus the current game's `content.ts`, `engine.ts` and final scenario entry in `DECISIONS.md`.

## Economy

| Purchase / allowance | Previous PP | New PP |
|---|---:|---:|
| Fresh preparation budget | 40 | **20** |
| Preparation after losing previous battle | 42 | **21** |
| Extra recruit | 6 | **3** |
| Recruit-group Boots | 4 | **2** |
| Recruit-group Shields | 6 | **3** |
| Recruit-group Weapons | 6 | **3** |
| Trail Boots | 2 | **1** |
| Bellmetal Shield | 4 | **2** |
| Balanced Weapon | 4 | **2** |
| Sighting Lens | 4 | **2** |
| Extra starting Battle Deck draw | 2 | **1** |
| Attacker reroll, per own die | 1 | **1** |

“B-roll” is interpreted as reroll. The verified current version already charges 1 PP per die; keep it at 1, not 0.5. Its relative cost therefore increases against the smaller budget. Four free recruits and exactly three distinct heroes remain. Equipment effects, one item per hero, one copy of each item per army, eligibility and full preparation refunds remain.

Only unused bid compensation can be banked for rerolls. Ordinary unspent preparation expires. Whole-PP bids and positive tie increments remain; no bid cap. Do not halve AP, HP, dice, wounds, movement or VP.

Campaign price decision: retain equal displayed hero PP and RP prices. To avoid doubling recruitment purchasing power, scale RP income from 20 per battle to **10 RP**, physical/objective-secured Brightstone from 2 to **1 RP each**, and victory bonus from 2 to **1 RP**. Objective stone quantities are unchanged. This RP rescaling is an authored TEST companion change, not a new currency conversion: PP and RP remain separate, and RP never funds bids or rerolls. Reject old saves instead of silently converting ongoing campaigns.

## Cost heuristic

Design the role first, then calculate:

**Estimate = 2 + Move + Attack + Defense + Range + Core + Card pair + Synergy.**

Keep the estimate in half-point increments in design/balance data. **Printed PP/RP cost = ceiling of the estimate**, evaluated once. Never round individual terms. This deliberately lowers the reference body and gives abilities more weight relative to ordinary stats; it is not simply every old cost divided by two.

Reference: HP3, Move4, Attack2 melee, Defense2, before abilities.

| Stat | Values and modifiers |
|---|---|
| Move | 3: −0.5; 4: 0; 5: +0.5; 6: +1 |
| Attack | 2: 0; 3: +0.5; 4: +1.5; 5: +2.5; 6: +4 |
| Defense | 1: −0.5; 2: 0; 3: +0.5; 4: +1.5; 5: +2.5 |
| Ranged instead of melee | range2: +0.5; range3: +1; range4: +1.5 |

Core tiers: 0.5 for a paid single-target status effect; 1 for paid healing or narrow personal protection; 1.5 for a strong conditional attack, positional group benefit or flexible support; 2 for repeatable long-distance displacement plus status or a strong scaling Attack engine. These are judgments about actual usage, not automatic keyword prices.

Card pair: +0.5 for two normal useful cards, +1 for a pair containing especially efficient attacks or a strong engine enabler. Price the pair once: each card is only one copy in the selected hero's deck contribution. Add +0.5 to +1 synergy only for interactions not already captured in Core/Card pair; current records use zero. No extra fragility or melee discount beyond the terms already present.

Current target is 3–8 PP, not a universal clamp. Future results outside this band require design review; do not silently squash them to 3 or 8. Costing is a starting hypothesis and includes no claim of matched win rates.

| ID | Hero | Move | Attack | Defense | Core | Cards | Range | Estimate | Cost |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| h01 | Kalawi | +0.5 | +0.5 | −0.5 | 1.5 | 1 | 0 | 5 | **5** |
| h02 | Brynja | −0.5 | +0.5 | +2.5 | 1.5 | 0.5 | 0 | 6.5 | **7** |
| h03 | Voru | 0 | +0.5 | −0.5 | 2 | 0.5 | 0.5 | 5 | **5** |
| h04 | Tavi | +1 | 0 | −0.5 | 1 | 0.5 | 0 | 4 | **4** |
| h05 | Marda | 0 | 0 | +0.5 | 1 | 0.5 | 0 | 4 | **4** |
| h06 | Niala | +0.5 | 0 | −0.5 | 0.5 | 0.5 | 0 | 3 | **3** |
| h07 | Eirik | −0.5 | 0 | +1.5 | 1.5 | 0.5 | 0 | 5 | **5** |
| h08 | Ketu | 0 | +2.5 | −0.5 | 2 | 1 | 0.5 | 7.5 | **8** |
| h09 | Ren | 0 | +0.5 | +0.5 | 1.5 | 0.5 | 0.5 | 5.5 | **6** |
| h10 | Orro | −0.5 | 0 | +2.5 | 1 | 0.5 | 0 | 5.5 | **6** |

Every row also includes reference 2 and synergy 0. Tavi's movement aura is valued at 1 because it improves travel but not attacks, and requires recruits to begin near a fragile hero. Ren's attack aura is valued at 1.5 because it can improve multiple attacks but requires him next to their target. Orro's protection has no ally benefit or action saving. These particular tier judgments deserve playtesting.

## Hero and card text

All heroes have HP3; omit standard HP from character-card print. Main job is bold, secondary job smaller. “Once” below means once per own activation. Cards are suitless, linked to their hero, one copy each; use the printed effect OR discard for +1 AP. No redundant AP-alternate footer. All these cards are played in the linked hero's activation outside combat, including those that initiate an attack.

### h01 — Kalawi Bloodmane · Windlands · 5 PP

**Striker** / Scout · Move **5**, Attack **3 melee**, Defense **1**.

**Ambush:** Start my activation with no adjacent enemy: +3 Attack this activation.

- **h01a · Surprise Strike · 1 AP:** Attack at +1, then you may move 3.
- **h01b · Pride’s Feint · 0 AP:** Swap places with a friendly recruit, then you may move 1.

Role: fragile burst attacker who needs a clean approach. Core bonus rises 2→3; both cards gain one movement space. Retain basic Attack3 so ordinary attacks remain distinct from his opening ambush. Do not also raise the card's attack bonus.

### h02 — Brynja Stonehide · Highholm · 7 PP

**Guard** / Support · Move **3**, Attack **3 melee**, Defense **5**.

**Living Rampart:** Other allies within 2 gain +1 Defense.

- **h02a · Stone-Skin · 1 AP:** Gain +3 Defense until my next activation.
- **h02b · Shield the Hearth · 0 AP:** Move up to 2.

Role: slow formation anchor. Defense rises 4→5; protection reaches 2 instead of adjacency. Stone-Skin gains one die; her small reposition is now free but still consumes its card.

### h03 — Voru Cinderveil · Cinder’s Rim · 5 PP

**Controller** / Striker · Move **4**, Attack **3 ranged (2)**, Defense **1**.

**Magma Surge:** 1 AP, once: Push an enemy within 4 up to 3; give it 1 Dazed.

- **h03a · Wall of Flame · 1 AP:** Place a flame edge within 4 until my next activation. Crossing: 1 wound.
- **h03b · Magma Eruption · 2 AP:** Attack at +2. Then gain 1 Dazed.

Role: displacement and hazardous lanes, not direct damage supremacy. Core/terrain reach rises 3→4; eruption bonus rises 1→2. Keep one flame edge and the existing damage cap.

### h04 — Tavi Sailwhistle · Port Windlass · 4 PP

**Scout** / Support · Move **6**, Attack **2 melee**, Defense **1**.

**Follow the Wind:** Recruits starting a group Move within 3 gain +1 Move.

- **h04a · Boarding Party · 1 AP:** Move up to two friendly recruits within 3 up to 2 each.
- **h04b · Fair Wind · 0 AP:** Haste another friendly hero within 3.

Role: fastest courier and recruit transport coordinator. His weak attack and protection buy a cheaper slot. Aura/card reach increases, boarding movement rises 1→2, and Haste loses its AP charge.

### h05 — Marda Oakweaver · Timberwood · 4 PP

**Support** / Guard · Move **4**, Attack **2 melee**, Defense **3**.

**Living Graft:** 1 AP, once: heal another adjacent ally 1 wound.

- **h05a · Graftwood Brace · 1 AP:** Heal another ally within 3 by 1; give it 1 Boosted.
- **h05b · Rootwalk · 0 AP:** Move up to 3.

Role: affordable durable medic. Core healing falls 2→1 AP; brace reaches one space farther; Rootwalk is free and gains one movement space. No self-healing or resurrection.

### h06 — Niala Grassveil · Windlands · 3 PP

**Controller** / Support · Move **5**, Attack **2 melee**, Defense **1**.

**False Trail:** 1 AP, once: give an enemy within 3 one Dazed.

- **h06a · Lion’s False Roar · 1 AP:** Give up to two enemies within 2 one Dazed each.
- **h06b · Vanish in the Grass · 1 AP:** Move up to 3, then you may Push an adjacent enemy 2 and give it 1 Dazed.

Role: cheapest evasive interference specialist. Defense drops 2→1 to make positioning matter. Core reaches one space farther, roar no longer requires adjacency, and escape movement rises 2→3. Her printed body still exceeds a base recruit in HP, Move and Attack.

### h07 — Eirik Hearthkeeper · Highholm · 5 PP

**Support** / Guard · Move **3**, Attack **2 melee**, Defense **4**.

**Hearth Oath:** 1 AP, once: give another ally within 2 one Boosted.

- **h07a · Winter Feast · 1 AP:** Heal another ally within 2 by 1; give it 2 Boosted.
- **h07b · Hearthward · 1 AP:** Move another ally within 3 up to 3.

Role: sturdy readiness support, distinguished from Marda's repeatable healing. Move drops 4→3; core reaches beyond adjacency; feast grants one additional token; ally rescue gains one reach and one movement.

### h08 — Ketu Ashheart · Cinder’s Rim · 8 PP

**Striker** / Controller · Move **4**, Attack **5 ranged (2)**, Defense **1**.

**Feed the Fire:** My Dazed adds Attack dice instead of subtracting them.

- **h08a · Stoke the Furnace · 0 AP:** Gain 2 Dazed.
- **h08b · Ashen Lance · 2 AP:** Attack at +2. Then gain 1 Dazed.

Role: premium glass cannon. Attack rises 4→5; stoke gains one token and lance one die. Deliberate exception: keep his already-strong core conversion unchanged. Each Dazed still adds only one Attack die and still subtracts one Defense die; no immunity or new multiplier. New tokens from Ashen Lance arrive after that attack. This is the most important burst/survival playtest case.

### h09 — Ren Timberwright · Timberwood · 6 PP

**Scout** / Guard · Move **4**, Attack **3 ranged (2)**, Defense **3**.

**Felling Line:** Friendly recruits gain +2 Attack against enemies adjacent to me.

- **h09a · Raise the Timber · 0 AP:** Build an adjacent timber wall until my next activation.
- **h09b · Work Crew · 1 AP:** Move up to two friendly recruits within 3 up to 2 each.

Role: forward recruit attack coordinator and cover builder. Core bonus rises 1→2, wall loses its AP charge, and crew movement rises 1→2. Keep the same body and positional requirement; no army-wide unconditional buff.

### h10 — Orro Stormanchor · Port Windlass · 6 PP

**Guard** / Controller · Move **3**, Attack **2 melee**, Defense **5**.

**Anchor Stance:** I cannot be Pushed. +1 Defense against melee attacks.

- **h10a · Anchor Exchange · 1 AP:** Swap places with another ally within 3.
- **h10b · Breakwater · 1 AP:** Push an adjacent enemy 3; give it 1 Dazed.

Role: planted personal tank and crew rescuer. Move drops 4→3, Attack drops 3→2, and Defense rises 4→5. Core gains the existing Heavily Armored benefit; swap and Push gain one space. Reject Bellmetal Shield as a redundant purchase on Orro. He can still voluntarily swap.

## Resolution notes for Sol

Use existing rules unless explicitly replaced above. Distances use board hex distance. “Another ally” excludes self, includes friendly recruits, and requires a living on-board unit. Healing removes at most existing wounds; heal-plus-Boosted cards can target an unwounded ally because Boosted still has an effect. Core Living Graft requires a wounded target.

Paid cores resolve once per activation, with their usage reset on a new own activation. Passive cores do not use an action or usage flag. Aura effects require their source alive/on board and check position when the applicable roll/action is declared. Follow the Wind snapshots eligible recruits at the beginning of the group Move; it does not extend card movement, respawn, Push or swaps. Felling Line applies to friendly recruit attacks, including a legal counterattack, not Push contests.

Ambush snapshots adjacency before the active tile moves to bottom and before any movement. It buffs all attacks made during that activation, including Surprise Strike. A dead/off-board Kalawi cannot obtain Ambush by activating to respawn. Attack cards use current hero range, engagement penalty, flanking, heavy-attack choice, responses and ordinary status cleanup; they are not basic attacks for basic-only equipment effects.

Surprise Strike movement is optional after a hit OR miss, after the entire attack resolves. It is unavailable if Kalawi has been defeated. Pride's Feint retains its existing unrestricted on-board friendly recruit target; swap first, then optional movement from the new hex. Both swapped units must be legal living targets. Swaps bypass intervening walls/flames and do not trigger crossings.

Ordinary card movement follows occupancy, walls, actual paths and flame crossings. Select up to two distinct recruits for Boarding Party / Work Crew from the initial eligible set, then resolve one at a time with an explicit skip; neither grants an entire group Move. Hearthward moves its chosen ally under the same rules. Zero-AP cards still require possession, discard exactly once, and cannot also grant their +1 AP alternate.

Vanish allows zero to three movement spaces, then optional enemy selection from the new position. If Niala dies during movement, stop. If no adjacent legal enemy remains, finish the card. A chosen Push target can receive Dazed even if displacement is blocked; Orro remains immune to displacement, not status. Pushes use the fixed source and existing legal step checks; stop on defeat. Magma Surge and Breakwater use the same rules.

For Wall of Flame, both endpoint hexes must be within 4 of Voru. Keep one legal edge, no overlapping walls/temporary terrain, both sides affected, and at most one flame wound per unit per activation across all flame edges. Flame deaths retain the current v6 defeat scoring; they do not become attacks for objective purposes. Timber still blocks movement, melee and Push and grants directional ranged cover. Terrain expires at its source's next activation or defeat. Repeated cards do not silently add a new terrain cap beyond existing rules.

Stone-Skin adds +3 alongside ordinary modifiers and expires at Brynja's next activation or defeat. Keep the existing single fortified flag: replaying it before expiry does not stack another +3, and is not a legal no-effect play. Stunned retains the existing movement-only interpretation: Shield the Hearth, Rootwalk, Pride's Feint, Anchor Exchange and Hearthward remain legal. Other cards/cores are disallowed while Stunned if they heal, buff, attack, build or Push. Keep the current eligibility policy for recruit-command cards; no expansion is requested. Passive defensive bonuses remain active. Haste means the existing one-slot queue shift; it does not change AP already captured.

Do not add new keywords, status types, reaction windows, resource pools or per-round trackers.

## Preparation examples

Concord A retains h01–h05; Wildmoon B retains h06–h10. Each roster still covers five regions and five main jobs; no permanent faction locks.

- **Concord flexible:** Kalawi 5 + Tavi 4 + Marda 4 = **13**; 7 PP remains. Example: extra recruit 3 + Balanced Weapon on Kalawi 2 + Trail Boots on Marda 1 + starting draw 1 = 20.
- **Concord armored:** Brynja 7 + Kalawi 5 + Voru 5 = **17**; 3 remains. Sighting Lens on Voru 2 + starting draw 1 = 20.
- **Wildmoon support:** Niala 3 + Eirik 5 + Ren 6 = **14**; 6 remains. Extra recruit 3 + recruit-group Weapons 3 = 20.
- **Wildmoon premium:** Ketu 8 + Ren 6 + Orro 6 = **20**; no equipment or extra draws without bid compensation.
- **Wildmoon mixed:** Ketu 8 + Niala 3 + Eirik 5 = **16**; 4 remains. Sighting Lens on Ketu 2 + Bellmetal Shield on Eirik 2 = 20.

All ten triples from each starter roster fit 20 PP. A totals 13–17; B totals 14–20. Wildmoon still spends more on heavy bodies, now as a visible tradeoff rather than an unaffordable starter option. This does not establish faction balance.

## Art scope

Ten original quick illustrations, one per named identity, reused for character art and the two linked ability cards. Text/stats stay outside the artwork. Regional colors are descriptive and do not encode faction or assigned Fire/Lightning/Water suit. The simple full-body masters also leave Sol a future standee source; current token/queue use should crop faces rather than shrink entire bodies.

Warm ivory backgrounds and flat shading are deliberate quick-art choices, not transparent cutouts. These are provisional art directions, not approved final print assets. No faction variants, card-back redesign, tactics-art expansion or print production is included. See `art-manifest.json`, `ART-PROMPTS.md`, and the review gallery for actual assets and mappings.



