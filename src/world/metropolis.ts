// metropolis.ts — the 5× town. Where townSeed is one of each firm and fifteen
// identical savers, this is ~40 firms spread across competing markets and 75
// people split into four economic roles:
//
//   • owner-operators — own a firm and work it (the matched career);
//   • rentiers        — own a firm, hold no job, live off the draw;
//   • employees       — hold a job, own nothing (they staff others' firms);
//   • idle savers     — neither own nor work, just consume and save.
//
// Wealth, objectives, wages, and machine generations all vary across people and
// firms. It is strictly additive: townSeed and livingTownSeed are untouched, and
// this reuses their `shell`/`makePerson`/`firmShell`/`placeFirm` builders. It
// runs on the same `runIgnition(..., { spend: true })` loop as livetown — no
// engine change — because every reducer already reads the town's shape
// dynamically (per-worker salaries via wageBill, multi-worker output via
// firmOutput, the draw's reserve via operatingReserve).
//
// Determinism: every heterogeneous value is a pure function of an agent or firm
// index (metroHash) — the build takes no RNG and no clock. The month loop's own
// seeded rng + fixedClock keep a run byte-replayable, exactly as livetown.

import { firmShell, makePerson, placeFirm, shell } from "./seed.ts";
import { params } from "./params.ts";
import { assertInvariant } from "./world.ts";
import type {
  Career,
  FirmKind,
  Listing,
  Objective,
  Person,
  World,
} from "./types.ts";

/** A deterministic value in [0,1) from an index and a salt. Knuth's
 *  multiplicative hash followed by an xorshift finaliser — no global state, so
 *  the seed builds identically on every call. */
function metroHash(i: number, salt: number): number {
  let x = ((i + 1) * 2654435761 + salt * 40503) >>> 0;
  x ^= x >>> 15;
  x = (x * 2246822519) >>> 0;
  x ^= x >>> 13;
  return (x >>> 0) / 4294967296;
}

/** A deterministic integer in [lo, hi]. */
function spread(i: number, salt: number, lo: number, hi: number): number {
  return lo + Math.floor(metroHash(i, salt) * (hi - lo + 1));
}

type FirmSpec = {
  prefix: string;
  kind: FirmKind;
  count: number;
  /** The career that staffs this firm's machine (producers) or its post. */
  career: Career;
  /** Supermarket/luxury/nightclub/privateUniversity refill a shelf each month
   *  from a machine + a matched worker. The others post nothing continuous. */
  produces: boolean;
  /** Government-owned, staffed by an employee rather than an owner-operator. */
  pub: boolean;
};

// ~40 firms: 7+6+8 competing sellers in the three goods markets, 4 private
// universities competing on tuition, 3 private hospitals, 6 tech employers, and
// 3+3 public institutions. Enough rivals that a price has somewhere to move.
const FIRMS: readonly FirmSpec[] = [
  { prefix: "shop", kind: "supermarket", count: 7, career: "retail", produces: true, pub: false },
  { prefix: "lux", kind: "luxury", count: 6, career: "retail", produces: true, pub: false },
  { prefix: "club", kind: "nightclub", count: 8, career: "hospitality", produces: true, pub: false },
  { prefix: "puni", kind: "privateUniversity", count: 4, career: "teacher", produces: true, pub: false },
  { prefix: "phosp", kind: "privateHospital", count: 3, career: "doctor", produces: false, pub: false },
  { prefix: "tech", kind: "tech", count: 6, career: "engineer", produces: false, pub: false },
  { prefix: "guni", kind: "publicUniversity", count: 3, career: "teacher", produces: false, pub: true },
  { prefix: "ghosp", kind: "publicHospital", count: 3, career: "doctor", produces: false, pub: true },
];

const PEOPLE = 75;
/** Producing firms that get a second matched worker — a real staff, not a
 *  sole operator. The first SECOND_WORKERS producing firms carry two. */
const SECOND_WORKERS = 15;

type FirmRec = {
  id: string;
  kind: FirmKind;
  career: Career;
  produces: boolean;
  pub: boolean;
  generation: number;
  owner: string | null;
  workers: number[]; // person indices
};

type Job = { firm: string; career: Career; salary: number };

export function metropolisSeed(): World {
  // 1. Flatten the roster into concrete firms. A third of the producing firms
  //    run a generation-1 machine (one operator, four times a gen-0 lot's
  //    output); the rest are generation 0. So supply differs seller to seller.
  const firms: FirmRec[] = [];
  let fi = 0;
  for (const spec of FIRMS) {
    for (let n = 1; n <= spec.count; n++) {
      const generation = !params.metroWeakMachines && spec.produces &&
          metroHash(fi, 11) < 0.34
        ? 1
        : 0;
      firms.push({
        id: `${spec.prefix}-${String(n).padStart(2, "0")}`,
        kind: spec.kind,
        career: spec.career,
        produces: spec.produces,
        pub: spec.pub,
        generation,
        owner: null,
        workers: [],
      });
      fi++;
    }
  }

  // 2. Assign the 75 people to roles with one walking pointer. Order:
  //    producing owner-operators, tech owner-operators, hospital rentiers,
  //    public-firm employees, second workers, then the idle tail.
  const role: string[] = new Array(PEOPLE).fill("idle");
  const jobOf: (Job | null)[] = new Array(PEOPLE).fill(null);
  const salary = (i: number) => spread(i, 23, 6, 14) * params.metroWageScale;
  let k = 0;

  for (const f of firms) {
    if (!f.produces) continue; // producing firm's owner also works it
    f.owner = `p${k}`;
    f.workers.push(k);
    role[k] = "operator";
    jobOf[k] = { firm: f.id, career: f.career, salary: salary(k) };
    k++;
  }
  for (const f of firms) {
    if (f.produces || f.pub) continue; // private, non-producing
    f.owner = `p${k}`;
    if (f.kind === "tech") {
      // A tech owner operates it as an engineer: a payroll, a wage.
      f.workers.push(k);
      role[k] = "operator";
      jobOf[k] = { firm: f.id, career: f.career, salary: salary(k) };
    } else {
      // A hospital owner is a rentier: no job, lives off the cure sales booked.
      role[k] = "rentier";
    }
    k++;
  }
  for (const f of firms) {
    if (!f.pub) continue; // government-owned, staffed by an employee
    f.owner = "gov";
    f.workers.push(k);
    role[k] = "employee";
    jobOf[k] = { firm: f.id, career: f.career, salary: salary(k) };
    k++;
  }
  const producing = firms.filter((f) => f.produces);
  for (let s = 0; s < SECOND_WORKERS && k < PEOPLE; s++) {
    const f = producing[s % producing.length];
    f.workers.push(k);
    role[k] = "employee";
    jobOf[k] = { firm: f.id, career: f.career, salary: salary(k) };
    k++;
  }
  // k..74 stay idle: no firm, no job.

  // 3. Objective and starting wealth per person, by index and role. Objectives
  //    spread ~30/25/25/20 across happiness/health/education/savings; wealth is
  //    a spread keyed to role, so owners and rentiers hold more than employees.
  const objectiveOf = (i: number): Objective => {
    const u = metroHash(i, 7);
    if (u < 0.30) return "happiness";
    if (u < 0.55) return "health";
    if (u < 0.80) return "education";
    return "savings";
  };
  const wealthOf = (i: number): number => {
    switch (role[i]) {
      case "rentier":
        return spread(i, 31, 240, 600);
      case "operator":
        return spread(i, 31, 150, 450);
      case "employee":
        return spread(i, 31, 120, 300);
      default:
        return spread(i, 31, 120, 360);
    }
  };

  // 4. Build the people. makePerson banks the savings in bank a; we set the job,
  //    objective, disease, and dwelling. person.firm stays null — placeFirm sets
  //    the owner back-pointer when each firm is booked.
  const people: Record<string, Person> = {};
  let depositsA = 0;
  for (let i = 0; i < PEOPLE; i++) {
    const id = `p${i}`;
    const objective = objectiveOf(i);
    const person = makePerson(id, wealthOf(i), 0, objective);
    person.job = jobOf[i];
    person.dwelling = `h-${id}`;
    if (objective === "health") person.diseases = ["d0"];
    people[id] = person;
    depositsA += person.deposits.a;
  }

  // 5. The shell holds every person's deposits against bank a.
  let world = shell(people, depositsA, 0);

  // 6. Book each firm. Its float is a year of its own payroll — the working
  //    capital the draw will not sweep — so a producing firm survives a dry
  //    spell and none fold at t₀ for want of the first wage. A rentier hospital
  //    has no payroll, so it opens flat and lives off what it sells.
  for (const f of firms) {
    const payroll = f.workers.reduce((s, w) => s + (jobOf[w]?.salary ?? 0), 0);
    const float = params.firmReserveMonths * payroll;
    world = placeFirm(world, firmShell(f.id, f.owner!, { a: float, b: 0 }, f.kind));
  }

  // 7. One indigenous machine per producing firm, of its career and chosen
  //    generation. Indigenous builder: zero maintenance, no money moves — an
  //    endowment, as livingTownSeed's machines are.
  const machines = { ...world.machines };
  const firmsOut = { ...world.firms };
  for (const f of firms) {
    if (!f.produces) continue;
    const id = `m-${f.id}`;
    machines[id] = {
      id,
      type: f.career,
      generation: f.generation,
      owner: f.id,
      builder: "indigenous",
    };
    firmsOut[f.id] = {
      ...firmsOut[f.id],
      machines: [...firmsOut[f.id].machines, id],
    };
  }
  world = { ...world, machines, firms: firmsOut };

  // 8. A house per person, so death's "a dead owner holds nothing" invariant has
  //    something to reassign, exactly as townSeed.
  const houses = { ...world.houses };
  for (let i = 0; i < PEOPLE; i++) {
    const id = `p${i}`;
    houses[`h-${id}`] = {
      id: `h-${id}`,
      units: params.houseQuantum,
      owner: id,
      occupant: id,
      lien: null,
    };
  }
  world = { ...world, houses };

  // 9. Each private hospital posts a one-shot d0 cure — the health chain's third
  //    step. Cures are not refilled (diseases are rare), so this is the only good
  //    stocked at t₀; every shelf good fills from commitProduce in month 0.
  const cures: Listing[] = firms
    .filter((f) => f.kind === "privateHospital")
    .map((f) => ({
      id: `cure-${f.id}`,
      seller: f.id,
      kind: "cure" as const,
      price: params.curePrice,
      qty: params.cureSize,
      payload: { disease: "d0" as const },
    }));
  world = { ...world, listings: [...world.listings, ...cures] };

  // 10. Tuition trains toward the career the archive lists — one engineer row, as
  //     livingTownSeed: archiveCareer picks it, and the education chain ratchets
  //     the engineer level up.
  world = {
    ...world,
    jobArchive: {
      year: 0,
      listings: [{
        career: "engineer",
        generation: 0,
        salary: params.townWage,
        slots: 6,
      }],
    },
  };

  assertInvariant(world);
  return world;
}
