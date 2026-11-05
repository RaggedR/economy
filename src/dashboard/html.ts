// html.ts — the five panels, one column, one scene at a time.
//
// The scenes in demo-out are different seeds. Laying them on one month axis
// would draw a cascade that did not happen. The shared axis is the months
// inside the scene on the page. Prices are listings. A series with no posting
// is named as absent.

import type { Panel, Series, Tape } from "./tape.ts";

const CLIENT_URL = new URL("./client.js", import.meta.url);

export function renderPage(
  tapes: readonly Tape[],
  opts: { source: string; selected?: string },
): string {
  const selected = opts.selected ?? prefer(tapes);
  const options = tapes.map((tape) => {
    const prices = priceCount(tape);
    const label = `${tape.scene} · month ${tape.month} · ${prices} price${
      prices === 1 ? "" : "s"
    }`;
    const on = tape.scene === selected ? " selected" : "";
    return `<option value="${esc(tape.scene)}"${on}>${esc(label)}</option>`;
  }).join("");
  const articles = tapes.map((tape) => article(tape, tape.scene === selected)).join("\n");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>Five markets</title>
<style>
  :root {
    color-scheme: light dark;
    --paper: #f3ecdf;
    --ink: #1b1714;
    --rule: #cbbda8;
    --faded: #6f655a;
    --oxide: #8c2f2f;
    --pine: #1e4a38;
    --ochre: #8a5a12;
    --band: rgba(140, 47, 47, 0.08);
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --paper: #141210;
      --ink: #e7dccb;
      --rule: #3c352c;
      --faded: #a39888;
      --oxide: #e07a68;
      --pine: #8fbfa8;
      --ochre: #e0b15a;
      --band: rgba(224, 122, 104, 0.12);
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--paper);
    color: var(--ink);
    font-family: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
    line-height: 1.45;
  }
  body::before {
    content: "";
    position: fixed;
    left: 0; top: 0; bottom: 0;
    width: 8px;
    background: var(--oxide);
  }
  main, header { max-width: 68rem; margin: 0 auto; padding: 0 1.5rem 0 2.2rem; }
  header { padding-top: 2.2rem; padding-bottom: 1.2rem; }
  .kicker {
    margin: 0;
    font-family: ui-monospace, "SF Mono", Menlo, monospace;
    font-size: 0.72rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--oxide);
  }
  h1 { margin: 0.15rem 0 0.4rem; font-weight: 500; font-size: 2.6rem; letter-spacing: -0.03em; }
  .lede, .source { margin: 0.3rem 0; max-width: 40rem; color: var(--faded); }
  .chooser { margin-top: 1rem; display: flex; align-items: center; gap: 0.7rem; }
  label[for="scene"] { font-family: ui-monospace, Menlo, monospace; font-size: 0.78rem; letter-spacing: 0.08em; text-transform: uppercase; }
  select {
    font: inherit;
    color: var(--ink);
    background: var(--paper);
    border: 1px solid var(--rule);
    padding: 0.35rem 0.5rem;
  }
  .rail { display: flex; flex-wrap: wrap; gap: 0.45rem; margin: 0.6rem 0; }
  .rail button {
    font: inherit;
    color: var(--ink);
    background: transparent;
    border: 1px solid var(--rule);
    padding: 0.35rem 0.65rem 0.45rem;
    text-align: left;
    cursor: pointer;
    max-width: 100%;
  }
  .rail button[aria-pressed="true"] { border-color: var(--oxide); }
  .rail b, .figures b, .st, .tick {
    font-family: ui-monospace, "SF Mono", Menlo, monospace;
    font-variant-numeric: tabular-nums;
  }
  .rail b { display: block; font-size: 1rem; }
  .rail span, .rail em { display: block; color: var(--faded); font-style: normal; font-size: 0.82rem; overflow-wrap: anywhere; }
  .rail em { color: var(--oxide); }
  .why {
    margin: 1.1rem 0 0.35rem;
    font-family: ui-monospace, Menlo, monospace;
    font-size: 0.72rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--oxide);
  }
  .reasons { margin: 0.2rem 0 0.8rem; }
  .reasons p { margin: 0.15rem 0; }
  .st { font-size: 0.72rem; letter-spacing: 0.06em; text-transform: uppercase; margin-right: 0.4rem; }
  .st.refused, .st.error { color: var(--oxide); }
  .st.ok { color: var(--pine); }
  .st.rationed { color: var(--ochre); }
  section {
    display: grid;
    grid-template-columns: 9.5rem 1fr;
    column-gap: 1.2rem;
    border-top: 1px solid var(--rule);
    padding: 1rem 0 1.15rem;
  }
  h2 { margin: 0; font-size: 1.15rem; font-weight: 500; }
  h2 span {
    display: block;
    margin-bottom: 0.2rem;
    color: var(--oxide);
    font-family: ui-monospace, Menlo, monospace;
    font-size: 0.72rem;
    letter-spacing: 0.14em;
  }
  .plot:empty { display: none; }
  svg { width: 100%; height: auto; display: block; }
  .tick { fill: var(--faded); font-size: 11px; text-anchor: end; }
  .tick.month { text-anchor: middle; fill: var(--ink); }
  .tick.unit { text-anchor: end; letter-spacing: 0.08em; text-transform: uppercase; font-size: 10px; }
  .rule { stroke: var(--rule); stroke-width: 1; }
  .band { fill: var(--band); }
  .figures { list-style: none; padding: 0; margin: 0 0 0.3rem; display: flex; flex-wrap: wrap; gap: 0.7rem 1.3rem; }
  .figures b { display: block; font-size: 1.35rem; font-weight: 500; }
  .figures label { color: var(--faded); font-size: 0.85rem; }
  [data-hue="0"] b { color: var(--ink); }
  [data-hue="1"] b { color: var(--oxide); }
  [data-hue="2"] b { color: var(--pine); }
  [data-hue="3"] b { color: var(--ochre); }
  .absent, .note, .aside, .warn { margin: 0.25rem 0 0; color: var(--faded); }
  .warn { color: var(--ochre); }
  footer { border-top: 1px solid var(--rule); padding: 0.8rem 0 2.5rem; }
  @media (max-width: 720px) {
    section { grid-template-columns: 1fr; }
    h1 { font-size: 2rem; }
  }
</style>
</head>
<body>
<header>
  <p class="kicker">Economy</p>
  <h1>Five markets</h1>
  <p class="lede">A reader of the journal and the intent log. A price is a listing still on the book. These scenes are separate seeds, and they do not share an axis.</p>
  <p class="source">Read from ${esc(opts.source)}.</p>
  <div class="chooser"><label for="scene">Scene</label><select id="scene">${options}</select></div>
</header>
<main>
${articles}
</main>
<script>
${Deno.readTextFileSync(CLIENT_URL)}
</script>
</body>
</html>
`;
}

function article(tape: Tape, selected: boolean): string {
  const rail = tape.marks.map((mark) => {
    const effects = mark.effects.length ? mark.effects.join(" · ") : "no journal line";
    const refused = mark.refused > 0 ? `<em>${mark.refused} refused</em>` : "";
    const pressed = mark.month === tape.month ? "true" : "false";
    return `<button type="button" data-month="${mark.month}" aria-pressed="${pressed}"><b>${mark.month}</b><span>${
      esc(effects)
    }</span>${refused}</button>`;
  }).join("");
  const reasons = tape.marks.map((mark) => {
    const lines = mark.reasons.length
      ? mark.reasons.map((row) =>
        `<p><span class="st ${esc(row.status)}">${esc(row.status)}</span> ${
          esc(row.agent)
        } — ${esc(row.reason)}</p>`
      ).join("")
      : `<p>No intent line this month.</p>`;
    const hidden = mark.month === tape.month ? "" : " hidden";
    return `<div class="reasons" data-month="${mark.month}"${hidden}>${lines}</div>`;
  }).join("");
  const panels = tape.panels.map((panel, index) => section(panel, index + 1, tape.month))
    .join("\n");
  const aside = tape.aside.map((line) => `<p class="aside">${esc(line)}</p>`).join("");
  const warnings = tape.warnings.map((line) => `<p class="warn">${esc(line)}</p>`).join(
    "",
  );
  const foot = aside || warnings ? `<footer>${aside}${warnings}</footer>` : "";
  const hidden = selected ? "" : " hidden";
  return `<article data-scene="${
    esc(tape.scene)
  }" data-book="${tape.month}" data-month="${tape.month}"${hidden}>
  <div class="rail" role="tablist">${rail}</div>
  ${panels}
  <p class="why">Reasons this month</p>
  ${reasons}
  ${foot}
  <script type="application/json" class="tape">${json(tape)}</script>
</article>`;
}

function section(panel: Panel, index: number, month: number): string {
  const figures = panel.tracks.flatMap((track) =>
    track.series.map((series, hue) => {
      return `<li data-figure="${esc(series.id)}" data-hue="${
        hue % 4
      }"><label><input type="checkbox" checked data-series="${esc(series.id)}"> ${
        esc(series.label)
      }</label><b>${esc(figure(series, month))}</b></li>`;
    })
  ).join("");
  const absent = panel.absent ? `<p class="absent">${esc(panel.absent)}</p>` : "";
  const note = panel.note ? `<p class="note">${esc(panel.note)}</p>` : "";
  return `<section data-panel="${panel.id}">
  <h2><span>${index}</span>${esc(panel.title)}</h2>
  <div>
    <ul class="figures">${figures}</ul>
    <div class="plot"></div>
    ${absent}
    ${note}
  </div>
</section>`;
}

/** The number under a series. Unemployment is a share of the living. A loan rate is the integer on the bank. */
export function figure(series: Series, month: number): string {
  const point = series.points.find((row) => row.month === month);
  if (!point) return "—";
  if (series.id === "unemployment") return `${Math.round(point.value * 1000) / 10}%`;
  if (Number.isInteger(point.value)) return String(point.value);
  return String(Math.round(point.value * 1000) / 1000);
}

function prefer(tapes: readonly Tape[]): string {
  if (tapes.length === 0) return "";
  const special = tapes.find((tape) => tape.scene === "special");
  if (special) return special.scene;
  return [...tapes].sort((a, b) => priceCount(b) - priceCount(a))[0].scene;
}

function priceCount(tape: Tape): number {
  return tape.panels.reduce((count, panel) => {
    const prices = panel.tracks.find((track) => track.unit === "price");
    return count + (prices?.series.length ?? 0);
  }, 0);
}

function json(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => {
    if (ch === "&") return "&amp;";
    if (ch === "<") return "&lt;";
    if (ch === ">") return "&gt;";
    if (ch === '"') return "&quot;";
    return "&#39;";
  });
}
