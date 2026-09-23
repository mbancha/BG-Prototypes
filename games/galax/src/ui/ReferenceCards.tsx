export default function ReferenceCards() {
  return (
    <div className="reference-cards">
      <article className="reference-sheet">
        <span className="eyebrow">EMPIRE REFERENCE · SEPTEMBER 23</span>
        <h3>Your empire</h3>
        <p>
          <b>Hand limit: 8.</b> End turn: draw 1. Rest: draw 2 instead of taking
          actions.
        </p>
        <h4>Civilized system benefits</h4>
        <p>
          Blue: +3 Research while you keep a Civ. Yellow: +1 to your main action
          card. Red: +1 power. Green: an optional move of up to two fleets at
          turn start.
        </p>
        <h4>Research</h4>
        <p>
          4: attacking shield · 6: extra enemy-Civ exploit trophy · 8: battle
          power · 10: draw 5 on crossing · 12: 3 end-game VP.
        </p>
        <h4>End-game scoring</h4>
        <p>
          1 per trophy, persistent Technology, Civ and controlled system, plus
          Research VP. Civ and control points are evaluated at the end, not
          banked when gained.
        </p>
        <h4>Victory</h4>
        <p>
          Culture: Civs in all four system colors. Hegemony: lead every opponent
          by four controlled systems and four trophies at turn start. Super
          Nova: finish the turn, then score.
        </p>
      </article>
      <article className="reference-sheet">
        <span className="eyebrow">SECOND REFERENCE · CARD ACTIONS</span>
        <h3>Play with your cards</h3>
        <p>
          Click a hand card to play, invent, or pair it. Click a planet to
          build, exploit, or conquer. Click ships to move or upgrade, then click
          a highlighted destination.
        </p>
        <h4>Exploration</h4>
        <p>
          Reveal a system, or move one or two selected fleets. Exploit is
          blocked by enemy fleets: safely draw 1 card, or name 1–4 for a
          specialty resource and flip. The revealed rank must be higher. Mark
          empty planets −1; a successful last empty planet earns 1 trophy.
        </p>
        <h4>Commerce</h4>
        <p>
          Build a Civ: 2 AP, or 1 on a −1 planet before modifiers. No supply
          token? Gain 1 trophy instead; consume the marker. Activate a system to
          draw, build fleets or research. Draw once per turn for 1 AP.
        </p>
        <h4>Military & Science</h4>
        <p>
          Military moves one fleet, attacks, or conquers with power + card
          versus deck. Science studies, upgrades a fleet at a controlled
          civilized system, or invents within Research capacity. Every one-time
          Discovery also awards 1 trophy.
        </p>
      </article>
      <p className="art-note">
        The original card artwork is retained. These current reference panels
        and action previews take precedence over older printed wording.
        Trophy-only victory and unspecified technology changes are awaiting
        designer clarification.
      </p>
    </div>
  );
}
