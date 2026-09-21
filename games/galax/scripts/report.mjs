const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const percent = (n) => (100 * n).toFixed(1) + "%";
const table = (headers, rows) =>
  "<table><thead><tr>" +
  headers.map((v) => "<th>" + escape(v) + "</th>").join("") +
  "</tr></thead><tbody>" +
  rows
    .map(
      (row) =>
        "<tr>" +
        row.map((v) => "<td>" + escape(v) + "</td>").join("") +
        "</tr>",
    )
    .join("") +
  "</tbody></table>";
export function reportHTML(r) {
  return (
    '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Galax simulation report</title><style>body{font:16px system-ui;max-width:1150px;margin:45px auto;padding:0 22px;background:#17131e;color:#ece7f2}h1,h2{color:#dfcc9e}p{line-height:1.6;color:#c1b8cc}table{border-collapse:collapse;width:100%;font-size:14px;margin-bottom:35px}th,td{padding:10px;border-bottom:1px solid #514659;text-align:left}th{color:#dfcc9e}small{color:#b0a5bd}</style><h1>GALAX · Simulation report</h1><p>' +
    escape(r.players) +
    " players · " +
    escape(r.completed) +
    " completed games · " +
    escape(r.truncated) +
    " truncated · seed " +
    escape(r.seed) +
    "<br>" +
    escape(r.policy) +
    "<br>Rules: " +
    escape(r.rulesVersion) +
    "</p><h2>Starting system color</h2>" +
    table(
      ["Color", "Players sampled", "Win share", "Mean points"],
      Object.entries(r.byStartingColor).map(([k, v]) => [
        k,
        v.n,
        percent(v.winRate),
        v.meanPoints.toFixed(2),
      ]),
    ) +
    "<h2>Turn order</h2>" +
    table(
      ["Position", "Players sampled", "Win share", "Mean points"],
      Object.entries(r.bySeat).map(([k, v]) => [
        Number(k) + 1,
        v.n,
        percent(v.winRate),
        v.meanPoints.toFixed(2),
      ]),
    ) +
    "<h2>Technologies and discoveries</h2>" +
    table(
      [
        "ID",
        "Card",
        "Plays",
        "Recorded activations",
        "Users",
        "User win share",
        "Mean points",
      ],
      Object.entries(r.technologies)
        .sort((a, b) => b[1].plays - a[1].plays)
        .map(([id, v]) => [
          id,
          v.name,
          v.plays,
          v.triggers,
          v.holders.n,
          percent(v.holders.winRate),
          v.holders.meanPoints.toFixed(2),
        ]),
    ) +
    "<h2>Game flow</h2><p>Mean turns: " +
    r.meanTurns.toFixed(1) +
    " · Battles: " +
    r.combat.battles +
    " · Conquer success: " +
    percent(r.combat.conquerSuccess) +
    "</p>" +
    table(["End condition", "Games"], Object.entries(r.endReasons)) +
    "<h2>Points and actions</h2>" +
    table(["Score source", "Total points"], Object.entries(r.pointsBySource)) +
    table(["Action", "Count"], Object.entries(r.actions)) +
    "<p>" +
    escape(r.limitations) +
    "</p><p>Recorded activations count explicit effect hooks; continuous prevention effects are not comparable event counts. These simple bots are useful for finding rule failures and broad trends, not proving competitive balance.</p></html>"
  );
}
