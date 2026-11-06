// metropolis-invest.ts — the metropolis run WITH the restricted invest day on.
//
// The plain metropolis (metropolis.ts) runs the frozen defaults, where demand
// is deficient and nothing ever sells out, so the invest day would never fire.
// This entry sets the "levelled" market — incomes tripled, supply pinched to
// gen-0, and discretionary price discovery on — so nightclubs genuinely sell
// out, and then runs runIgnition with { spend, invest }. The entrepreneurs
// answer the demand: they buy machines and hire crews each year, and because
// the decision is margin- and labour-aware, capacity climbs and then holds
// instead of over-expanding into a collapse.
//
// It only mutates the shared params at process start — it is a program, never
// imported by a test — so the frozen fixtures are untouched.

import { params } from "./world/params.ts";
import { runIgnition } from "./bridge/ignition.ts";
import { openRig } from "./bridge/rig.ts";
import { fixedClock, seededIds } from "./log/ids.ts";
import { metropolisSeed } from "./world/metropolis.ts";
import { loadWorld } from "./world/store.ts";
import { firmOutput } from "./world/tech.ts";
import { goodOf } from "./world/types.ts";
import type { World } from "./world/types.ts";
import { assertInvariant } from "./world/world.ts";

// --- the levelled market (the only one with excess demand) ---
params.discretionaryDiscovery = true;
params.perishable = true;
params.discretionaryCut = { num: 4, den: 5 };
params.demandBudgetFraction = { num: 1, den: 4 };
params.metroWageScale = 3;
params.metroWeakMachines = true;
// A generous newborn: five years of staple, not one — enough that the baby boom
// adds real purchasing power, not just bodies for the labour pool.
params.birthEndowment = 5 * params.cashGift; // 300

/** A demo-only overlay on metropolisSeed: make the firm owners a landed,
 *  liquid propertied class — dwelling raised to the voluntary-birth bar of 3
 *  quanta, and cash topped to a mandatory level — so they both qualify to have
 *  children on the special month AND can fund the generous endowment. The seed's
 *  flat one-house-each, modest-cash distribution never could. metropolisSeed and
 *  its frozen tests are untouched. All metropolis deposits sit in bank a, so one
 *  balancing adjustment to that bank keeps the books lawful. */
function landedMetropolisSeed(): World {
  const w = metropolisSeed();
  const owners = new Set<string>();
  for (const f of Object.values(w.firms)) {
    if (f.owner && f.owner !== "gov") owners.add(f.owner);
  }
  const units = params.fertilityLiquidMultiple * params.houseQuantum; // 30
  const cash = params.fertilityMultiple * params.cashGift; // 10G = 600
  const houses = { ...w.houses };
  const people = { ...w.people };
  let delta = 0; // extra deposits minted into bank a
  for (const id of owners) {
    const person = people[id];
    const dwell = person?.dwelling;
    if (dwell && houses[dwell]) houses[dwell] = { ...houses[dwell], units };
    if (person) {
      delta += cash - person.deposits.a;
      people[id] = { ...person, deposits: { a: cash, b: person.deposits.b } };
    }
  }
  const banks = {
    ...w.banks,
    a: {
      ...w.banks.a,
      depositLiability: w.banks.a.depositLiability - delta, // liabilities are negative
      equity: w.banks.a.equity - delta,
    },
  };
  const world = { ...w, houses, people, banks };
  assertInvariant(world);
  return world;
}

const p = (s = "") => console.log(s);
const pad = (n: number | string, w: number) => String(n).padStart(w, " ");

export async function start(argv: string[]): Promise<number> {
  const months = argv.length === 0 ? 60 : Number(argv[0]);
  if (!Number.isInteger(months) || months < 1) {
    console.error("months must be a positive integer");
    return 1;
  }
  const ctx = openRig(
    "demo-out/metropolis-invest",
    landedMetropolisSeed(),
    seededIds("economy-metropolis-invest"),
    fixedClock(),
  );

  // One month at a time so the nightclub market can be read between steps. The
  // invest day fires inside runIgnition at each year boundary; its tracker
  // accumulates across the whole horizon, so the run is one call, not many.
  const lines = await runIgnition(ctx, months, { spend: true, invest: true, births: true, dividend: true });

  // The producing markets invest day serves: kind → the good it stocks.
  const MARKETS: { kind: string; good: "staple" | "luxuryFood" | "nightclub" }[] = [
    { kind: "supermarket", good: "staple" },
    { kind: "luxury", good: "luxuryFood" },
    { kind: "nightclub", good: "nightclub" },
  ];
  const capacityOf = (
    w: ReturnType<typeof loadWorld>,
    kind: string,
    good: string,
  ): { open: number; cap: number } => {
    let open = 0, cap = 0;
    for (const id of Object.keys(w.firms)) {
      if (w.firms[id].kind !== kind || w.firms[id].folded) continue;
      open += 1;
      const out = firmOutput(w, id);
      if (out && out.good === good) cap += out.qty;
    }
    return { open, cap };
  };

  p("month  alive  fed  folded  firmCash");
  for (const line of lines) {
    if (line.month % 3 !== 0 && line.month !== months - 1) continue;
    p(
      `${pad(line.month, 5)}  ${pad(line.alive, 5)}  ${pad(line.fed, 3)}  ` +
        `${pad(line.folded, 6)}  ${pad(line.firmCash, 8)}`,
    );
  }

  // Final producing markets: did capacity grow, and did the firms survive?
  const world = loadWorld(ctx.worldPath);
  p();
  p("firm       kind         folded  cash  workers  machines  price");
  for (const m of MARKETS) {
    for (const id of Object.keys(world.firms).filter((f) => world.firms[f].kind === m.kind).sort()) {
      const f = world.firms[id];
      const workers = Object.values(world.people).filter((pr) =>
        pr.alive && pr.job?.firm === id
      ).length;
      const posts = world.listings.filter((l) =>
        l.seller === id && l.kind === "good" && goodOf(l.payload) === m.good
      );
      const price = posts.length ? Math.min(...posts.map((l) => l.price)) : 0;
      p(
        `${id.padEnd(9, " ")}  ${m.kind.padEnd(11, " ")}  ${(f.folded ? "yes" : "no").padStart(6, " ")}  ` +
          `${pad(f.deposits.a + f.deposits.b, 4)}  ${pad(workers, 7)}  ` +
          `${pad(f.machines.length, 8)}  ${pad(price, 5)}`,
      );
    }
  }
  p();
  const year = Math.floor(months / 12);
  for (const m of MARKETS) {
    const { open, cap } = capacityOf(world, m.kind, m.good);
    p(`${pad(open, 2)} ${m.kind} still open, making ${cap} units/month at year ${year}.`);
  }
  return 0;
}

if (import.meta.main) {
  Deno.exit(await start(Deno.args));
}
