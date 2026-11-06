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
import { livingTownSeed, townSeed } from "./world/seed.ts";
import { loadWorld } from "./world/store.ts";
import { goodOf } from "./world/types.ts";
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
  aliveEnd: number;
  fedEnd: number;
  folded: number;
  firmsAlive: number; // 15 − folded
  finalPrice: number;
  stapleLeft: number;
  cashMinEnd: number;
  cashMaxEnd: number;
};

let MONTHS = 24;
let LIVING = true;

function finalStaplePrice(worldPath: string): number {
  const world = loadWorld(worldPath);
  for (const listing of world.listings) {
    if (listing.kind === "good" && goodOf(listing.payload) === "staple") {
      return listing.price;
    }
  }
  return 0;
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
    const seed = LIVING ? livingTownSeed() : townSeed();
    const ctx = openRig(RIG, seed, seededIds("sweep"), fixedClock());
    const lines = await runIgnition(ctx, MONTHS, { spend: LIVING });
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
      aliveEnd: end.alive,
      fedEnd: end.fed,
      folded: end.folded,
      firmsAlive: 15 - end.folded,
      finalPrice: finalStaplePrice(ctx.worldPath),
      stapleLeft: end.stapleLeft,
      cashMinEnd: end.cashMin,
      cashMaxEnd: end.cashMax,
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

function scenarios(base: Params): Named[] {
  return [
    { name: "baseline", pos: base },
    { name: "float 24", pos: set(base, { firmFloat: 24 }) },
    { name: "float 60", pos: set(base, { firmFloat: 60 }) },
    { name: "savings 120", pos: set(base, { startingSavings: 120 }) },
    { name: "savings 30", pos: set(base, { startingSavings: 30 }) },
    { name: "staple 3", pos: set(base, { stapleReservePrice: 3 }) },
    { name: "wage 12", pos: set(base, { firmFloat: 24, townWage: 12 }) },
    { name: "float60+sav120", pos: set(base, { firmFloat: 60, startingSavings: 120 }) },
  ];
}

// ── sensitivity: ∂metric/∂knob as an `extend` kernel ─────────────────────────

const KNOBS: (keyof Params)[] = [
  "firmFloat",
  "startingSavings",
  "townWage",
  "stapleReservePrice",
  "maintenance",
];

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
  const rest: string[] = [];
  for (const a of argv) {
    if (a === "--savings-town") LIVING = false;
    else rest.push(a);
  }
  if (rest.length > 0) {
    const n = Number(rest[0]);
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
    set(
      base,
      { [k]: (base[k] as number) + (k === "firmFloat" ? 8 : 4) } as Partial<Params>,
    )
  );
  await precompute([...named.map((n) => n.pos), ...neighbours]);

  // The store. extract(w) is the baseline; experiment is the grid.
  const w = store(tabulated, base);

  console.log(
    `${LIVING ? "living" : "savings-only"} town — Store<Params,Result> over ` +
      `${MONTHS} months\n`,
  );
  const results = experiment((_s) => named.map((n) => n.pos), w);
  const padR = (s: string, n: number) => s.padEnd(n, " ");
  const pad = (s: string | number, n: number) => String(s).padStart(n, " ");
  console.log(
    `${padR("scenario", 16)}  ${pad("1stDeath", 8)}  ${pad("alive", 5)}  ${
      pad("fed", 3)
    }  ` +
      `${pad("firms", 5)}  ${pad("price", 5)}  ${pad("cashMin", 7)}  ${
        pad("cashMax", 7)
      }`,
  );
  named.forEach((n, i) => {
    const r = results[i];
    console.log(
      `${padR(n.name, 16)}  ${pad(r.firstDeath ?? "—", 8)}  ${pad(r.aliveEnd, 5)}  ` +
        `${pad(r.fedEnd, 3)}  ${pad(r.firmsAlive, 5)}  ${pad(r.finalPrice, 5)}  ` +
        `${pad(r.cashMinEnd, 7)}  ${pad(r.cashMaxEnd, 7)}`,
    );
  });

  // Sensitivities at the baseline focus: extract(extend(kernel, w)).
  console.log("\nlocal sensitivity at baseline (forward difference)");
  console.log(`${padR("knob", 18)}  ${pad("∂firms", 8)}  ${pad("∂fed", 8)}`);
  for (const knob of KNOBS) {
    const step = knob === "firmFloat" ? 8 : 4;
    const dFirms = extract(extend(slope(knob, step, (r) => r.firmsAlive), w));
    const dFed = extract(extend(slope(knob, step, (r) => r.fedEnd), w));
    console.log(
      `${padR(String(knob), 18)}  ${pad(dFirms.toFixed(3), 8)}  ${
        pad(dFed.toFixed(3), 8)
      }`,
    );
  }
  return 0;
}

if (import.meta.main) {
  Deno.exit(await start(Deno.args));
}
