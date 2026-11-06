// sweep.ts — tune the living town by sampling a Store comonad over its params.
//
// The sweep IS a Store<Params, Result>: a readout "run the town at these params"
// paired with a focus at the baseline. `extract` is the baseline run; each
// scenario is a `peek` at a neighbouring params point; the grid is `experiment`
// over a shape of points; and a local sensitivity — ∂metric/∂knob — is `extend`
// with a forward-difference kernel. See analysis/store.ts for the laws.
//
// The one impure cell is `readout`: params is a module singleton, so a peek
// snapshots it, assigns the position, runs, and restores. The run is
// deterministic (seeded RNG, fixed clock), so the comonad above stays lawful.

import { runIgnition } from "./bridge/ignition.ts";
import { openRig } from "./bridge/rig.ts";
import { fixedClock, seededIds } from "./log/ids.ts";
import { params } from "./world/params.ts";
import { livingTownSeed } from "./world/seed.ts";
import { loadWorld } from "./world/store.ts";
import {
  experiment,
  extend,
  extract,
  peek,
  type Store,
  store,
} from "./analysis/store.ts";

const RIG =
  "/private/tmp/claude-501/-Users-robin-git-harness-worker-orchestration-economy/" +
  "3ff44a91-5cb5-4f57-a58d-113323515fc4/scratchpad/sweep-rig";

/** A position in the store: a full params snapshot. */
type Params = typeof params;

type Result = {
  firstDeath: number | null;
  fedEnd: number;
  firmsAlive: number; // 15 − folded
  // Welfare, by objective: the mean of each group's own metric at the end, and
  // the count of happiness/health/education people sustaining any progress.
  happyMean: number;
  healthMean: number;
  eduMean: number;
  savMean: number;
  thriving: number;
};

let MONTHS = 36;

/** The welfare each objective actually achieved. Happiness and health read the
 *  decaying stock; education reads the engineer level; savings read deposits. */
function welfare(worldPath: string): {
  happyMean: number;
  healthMean: number;
  eduMean: number;
  savMean: number;
  thriving: number;
} {
  const world = loadWorld(worldPath);
  const hap: number[] = [], hea: number[] = [], edu: number[] = [], sav: number[] = [];
  for (const p of Object.values(world.people)) {
    if (!p.alive) continue;
    if (p.objective === "happiness") hap.push(p.happiness);
    else if (p.objective === "health") hea.push(p.health);
    else if (p.objective === "education") edu.push(p.education.engineer);
    else if (p.objective === "savings") sav.push(p.deposits.a + p.deposits.b);
  }
  const mean = (a: number[]) => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
  const up = (a: number[]) => a.filter((x) => x > 0).length;
  return {
    happyMean: mean(hap),
    healthMean: mean(hea),
    eduMean: mean(edu),
    savMean: mean(sav),
    thriving: up(hap) + up(hea) + up(edu),
  };
}

// runIgnition is async, but the Store readout is synchronous, so we cannot run
// the model inside `peek`. Instead we PRECOMPUTE every position's Result first
// (async), memoise it, and let the readout look it up. The store is still a
// faithful Store<Params, Result>; we have merely tabulated the readout over the
// finite set of positions the sweep touches — which is all `experiment` and the
// finite-difference `extend` ever ask for.
const MEMO = new Map<string, Result>();

function keyOf(p: Params): string {
  return JSON.stringify(p);
}

async function runToResultAsync(p: Params): Promise<Result> {
  const snap: Params = structuredClone(params);
  for (const key of Object.keys(p)) {
    (params as Record<string, unknown>)[key] = structuredClone(
      (p as Record<string, unknown>)[key],
    );
  }
  try {
    const ctx = openRig(RIG, livingTownSeed(), seededIds("sweep"), fixedClock());
    const lines = await runIgnition(ctx, MONTHS, { spend: true });
    let firstDeath: number | null = null;
    for (const line of lines) {
      if (line.dead > 0) {
        firstDeath = line.month;
        break;
      }
    }
    const end = lines[lines.length - 1];
    return {
      firstDeath,
      fedEnd: end.fed,
      firmsAlive: 15 - end.folded,
      ...welfare(ctx.worldPath),
    };
  } finally {
    for (const key of Object.keys(snap)) {
      (params as Record<string, unknown>)[key] = structuredClone(
        (snap as Record<string, unknown>)[key],
      );
    }
  }
}

/** The store's synchronous readout: a lookup into the precomputed table. */
function tabulated(p: Params): Result {
  const hit = MEMO.get(keyOf(p));
  if (!hit) throw new Error("position was not precomputed; call precompute first");
  return hit;
}

async function precompute(positions: Params[]): Promise<void> {
  for (const p of positions) {
    const k = keyOf(p);
    if (!MEMO.has(k)) MEMO.set(k, await runToResultAsync(p));
  }
}

// ── positions ────────────────────────────────────────────────────────────────

function set(p: Params, over: Partial<Params>): Params {
  return { ...structuredClone(p), ...structuredClone(over) };
}

type Named = { name: string; pos: Params };

// The affordability frontier: can people earn enough, against the prices of
// their objective goods, to durably pursue them? Each scenario raises income or
// cheapens a wellbeing good; firmFloat tracks the wage so a raise does not
// starve the firms of working capital.
function scenarios(base: Params): Named[] {
  const wage = (w: number) => ({ townWage: w, firmFloat: w * base.firmReserveMonths });
  return [
    { name: "baseline", pos: base },
    { name: "wage 16", pos: set(base, wage(16)) },
    { name: "wage 24", pos: set(base, wage(24)) },
    { name: "nightclub 6", pos: set(base, { nightclubPrice: 6 }) },
    { name: "luxury 5", pos: set(base, { luxuryPrice: 5 }) },
    { name: "cheap goods", pos: set(base, { nightclubPrice: 6, luxuryPrice: 5 }) },
    {
      name: "wage24+cheap",
      pos: set(base, { ...wage(24), nightclubPrice: 6, luxuryPrice: 5 }),
    },
  ];
}

// ── sensitivity: ∂welfare/∂knob as an `extend` kernel ────────────────────────

const KNOBS: (keyof Params)[] = [
  "townWage",
  "nightclubPrice",
  "luxuryPrice",
  "tuitionPrice",
];

/** Step for the finite difference along a knob: a wage moves in fours, a price
 *  in twos (prices are small, so a 4-step would overshoot). */
function stepOf(knob: keyof Params): number {
  return knob === "townWage" ? 4 : 2;
}

/** Forward difference of `metric` along `axis` by `step`, as a Store kernel. */
function slope(
  axis: keyof Params,
  step: number,
  metric: (r: Result) => number,
): (w: Store<Params, Result>) => number {
  return (w) => {
    const here = metric(extract(w));
    const up = metric(
      peek(set(w.pos, { [axis]: (w.pos[axis] as number) + step } as Partial<Params>), w),
    );
    return (up - here) / step;
  };
}

// ── driver ───────────────────────────────────────────────────────────────────

export async function start(argv: string[]): Promise<number> {
  if (argv.length > 0) {
    const n = Number(argv[0]);
    if (!Number.isInteger(n) || n < 1) {
      console.error("months must be a positive integer");
      return 1;
    }
    MONTHS = n;
  }

  const base: Params = structuredClone(params);
  const named = scenarios(base);

  // Precompute the grid AND the finite-difference neighbours the kernels touch.
  const neighbours = KNOBS.map((k) =>
    set(base, { [k]: (base[k] as number) + stepOf(k) } as Partial<Params>)
  );
  await precompute([...named.map((n) => n.pos), ...neighbours]);

  // The store. extract(w) is the baseline; experiment is the grid.
  const w = store(tabulated, base);

  console.log(
    `living town welfare — Store<Params,Result> over ${MONTHS} months\n` +
      "means are each objective group's own metric; thriving counts non-savers " +
      "above zero\n",
  );
  const results = experiment((_s) => named.map((n) => n.pos), w);
  const padR = (s: string, n: number) => s.padEnd(n, " ");
  const pad = (s: string | number, n: number) => String(s).padStart(n, " ");
  const f1 = (x: number) => x.toFixed(1);
  console.log(
    `${padR("scenario", 14)}  ${pad("happy", 5)}  ${pad("health", 6)}  ${
      pad("edu", 5)
    }  ` +
      `${pad("savings", 7)}  ${pad("thrive", 6)}  ${pad("fed", 3)}  ${pad("firms", 5)}`,
  );
  named.forEach((n, i) => {
    const r = results[i];
    console.log(
      `${padR(n.name, 14)}  ${pad(f1(r.happyMean), 5)}  ${pad(f1(r.healthMean), 6)}  ` +
        `${pad(f1(r.eduMean), 5)}  ${pad(r.savMean.toFixed(0), 7)}  ${
          pad(r.thriving, 6)
        }  ` +
        `${pad(r.fedEnd, 3)}  ${pad(r.firmsAlive, 5)}`,
    );
  });

  // Sensitivities at the baseline focus: extract(extend(kernel, w)). How much
  // each objective's welfare moves per unit of the knob.
  console.log("\nlocal welfare sensitivity at baseline (forward difference)");
  console.log(
    `${padR("knob", 16)}  ${pad("∂happy", 8)}  ${pad("∂edu", 8)}  ${pad("∂thrive", 8)}`,
  );
  for (const knob of KNOBS) {
    const s = stepOf(knob);
    const dHap = extract(extend(slope(knob, s, (r) => r.happyMean), w));
    const dEdu = extract(extend(slope(knob, s, (r) => r.eduMean), w));
    const dThr = extract(extend(slope(knob, s, (r) => r.thriving), w));
    console.log(
      `${padR(String(knob), 16)}  ${pad(dHap.toFixed(3), 8)}  ${
        pad(dEdu.toFixed(3), 8)
      }  ` +
        `${pad(dThr.toFixed(3), 8)}`,
    );
  }
  return 0;
}

if (import.meta.main) {
  Deno.exit(await start(Deno.args));
}
