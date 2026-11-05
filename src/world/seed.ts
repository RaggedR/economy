// seed.ts — the smallest worlds the milestones drive. Domain ids are fields of
// the world. Log ids are not.

import type { Bank, Career, Deposits, Firm, Person, World } from "./types.ts";
import { CAREERS } from "./types.ts";
import { assertInvariant } from "./world.ts";

function education(): Record<Career, number> {
  return Object.fromEntries(CAREERS.map((c) => [c, 0])) as Record<Career, number>;
}

export function makePerson(
  id: string,
  a: number,
  b: number,
  objective: Person["objective"] = "savings",
): Person {
  return {
    id,
    alive: true,
    objective,
    health: 0,
    happiness: 0,
    education: education(),
    diseases: [],
    assignment: null,
    starvation: 0,
    job: null,
    dwelling: null,
    parent: null,
    children: [],
    firm: null,
    deposits: { a, b },
  };
}

function bank(id: "a" | "b", deposits: number, rate: number): Bank {
  return {
    id,
    loanRate: rate,
    equity: -deposits,
    losses: 0,
    depositLiability: -deposits,
    loansOutstanding: 0,
    sharesOutstanding: 0,
  };
}

function shell(
  people: Record<string, Person>,
  depositsA: number,
  depositsB: number,
): World {
  return {
    month: 0,
    nextId: 1,
    rng: { seed: 1, stream: 0 },
    people,
    firms: {},
    houses: {},
    mines: {},
    machines: {},
    loans: {},
    shares: {},
    banks: {
      a: bank("a", depositsA, 100),
      b: bank("b", depositsB, 105),
    },
    interbank: 0,
    government: {
      id: "gov",
      deposits: { a: 0, b: 0 },
      taxLastMonth: 0,
      salaryBill: 0,
    },
    listings: [],
    standing: [],
    jobArchive: { year: 0, listings: [] },
    flows: [],
  };
}

/** Two people, two banks, the government. No firms, houses, or mines. */
export function storySeed(): World {
  return shell(
    {
      ada: makePerson("ada", 1000, 0),
      ben: makePerson("ben", 0, 800),
    },
    1000,
    800,
  );
}

/** Book a firm's deposits against the bank that owes them. */
export function placeFirm(world: World, firm: Firm): World {
  let next: World = { ...world, firms: { ...world.firms, [firm.id]: firm } };
  for (const bank of ["a", "b"] as const) {
    const amount = firm.deposits[bank];
    if (amount === 0) continue;
    const b = next.banks[bank];
    next = {
      ...next,
      banks: {
        ...next.banks,
        [bank]: {
          ...b,
          depositLiability: b.depositLiability - amount,
          equity: b.equity - amount,
        },
      },
    };
  }
  const owner = next.people[firm.owner];
  if (owner && owner.firm === null) {
    next = {
      ...next,
      people: { ...next.people, [owner.id]: { ...owner, firm: firm.id } },
    };
  }
  return next;
}

export function firmShell(
  id: string,
  owner: string,
  deposits: Deposits,
  kind: Firm["kind"] = "supermarket",
): Firm {
  return {
    id,
    kind,
    owner,
    deposits,
    machines: [],
    inventory: {},
    salesLastMonth: 0,
    taxOwed: 0,
    folded: false,
  };
}

/** Ada owns a shop. Ben works there. Cleo holds nothing, so she cannot buy. */
export function purseSeed(): World {
  let world = storySeed();
  world = placeFirm(world, firmShell("shop", "ada", { a: 400, b: 0 }));
  world.people.ben.job = { firm: "shop", career: "retail", salary: 100 };
  world.people.cleo = makePerson("cleo", 0, 0);
  world.houses = {
    "h-ada": { id: "h-ada", units: 10, owner: "ada", occupant: "ada", lien: null },
  };
  world.people.ada.dwelling = "h-ada";
  return world;
}

/** Ada owns a shop with one staple on the shelf. Ben can pay. Cleo cannot. */
export function marketSeed(): World {
  let world = shell(
    {
      ada: makePerson("ada", 50, 0),
      ben: makePerson("ben", 50, 0),
      cleo: makePerson("cleo", 0, 0),
    },
    100,
    0,
  );
  world = placeFirm(world, firmShell("shop", "ada", { a: 0, b: 0 }));
  world.firms.shop.inventory = { staple: 1 };
  return world;
}

/** One special day. Ada holds both shares of bank a and lives in h-ada. Ben holds
 *  the loan against h-ben, works the shop, and has no dwelling yet. Cleo lives
 *  in h-ben and owns h-cleo vacant. Bank a has earned 40 of interest. The shop's
 *  deposit at b is already on that bank's sheet. */
export function specialSeed(): World {
  const ada = makePerson("ada", 0, 0);
  const ben = makePerson("ben", 60, 0);
  const cleo = makePerson("cleo", 0, 40);
  ada.dwelling = "h-ada";
  ada.health = 1;
  ben.health = 0;
  ben.job = { firm: "shop", career: "retail", salary: 8 };
  cleo.health = 5;
  cleo.dwelling = "h-ben";
  const world = shell(
    { ada, ben, cleo },
    60,
    40,
  );
  world.banks.a.equity = 40;
  world.banks.a.loansOutstanding = 100;
  world.banks.a.sharesOutstanding = 2;
  world.shares = { s: { id: "s", bank: "a", holder: "ada", units: 2 } };
  world.loans = {
    L: {
      kind: "bank",
      id: "L",
      bank: "a",
      borrower: "ben",
      principal: 100,
      installment: 10,
      months: 10,
      collateral: "h-ben",
    },
  };
  world.houses = {
    "h-ada": { id: "h-ada", units: 10, owner: "ada", occupant: "ada", lien: null },
    "h-ben": { id: "h-ben", units: 10, owner: "ben", occupant: "cleo", lien: "L" },
    "h-cleo": { id: "h-cleo", units: 10, owner: "cleo", occupant: null, lien: null },
  };
  world.firms = {
    shop: firmShell("shop", "ada", { a: 0, b: 20 }),
    mill: firmShell("mill", "ben", { a: 0, b: 0 }, "tech"),
  };
  world.people.ada.firm = "shop";
  world.people.ben.firm = "mill";
  world.banks.b.depositLiability -= 20;
  world.banks.b.equity -= 20;
  assertInvariant(world);
  return world;
}

/** The month scene: a wage, one loan the gate accepts, one it refuses. */
export function monthSeed(): World {
  const world = shell(
    {
      ada: makePerson("ada", 400, 0),
      ben: makePerson("ben", 0, 400),
    },
    700,
    400,
  );
  world.government.deposits = { a: 300, b: 0 };
  world.people.ada.dwelling = "h-ada";
  world.people.ben.dwelling = "h-ben";
  world.houses = {
    "h-ada": { id: "h-ada", units: 10, owner: "ada", occupant: "ada", lien: null },
    "h-ben": { id: "h-ben", units: 10, owner: "ben", occupant: "ben", lien: null },
  };
  world.mines = {
    m1: {
      id: "m1",
      material: "common",
      stock: 100,
      owner: "a",
      depositedAt: "a",
      lien: null,
    },
  };
  world.shares = {
    s1: { id: "s1", bank: "a", holder: "ada", units: 100 },
  };
  world.banks.a.sharesOutstanding = 100;
  return world;
}

/** Disease, the two mixes, and a private cure. Seed 8 strikes Ben with d2 and
 *  misses the other four. Cleo already holds d0. Doc and teach are public staff. */
export function healthSeed(): World {
  const ada = makePerson("ada", 100, 0);
  ada.dwelling = "h-ada";
  ada.health = 5;
  const ben = makePerson("ben", 0, 0);
  ben.health = 5;
  const cleo = makePerson("cleo", 80, 0);
  cleo.dwelling = "h-cleo";
  cleo.health = 0;
  cleo.diseases = ["d0"];
  const doc = makePerson("doc", 0, 0);
  doc.dwelling = "h-doc";
  doc.health = 4;
  doc.job = { firm: "pub-hosp", career: "doctor", salary: 1 };
  const teach = makePerson("teach", 0, 0);
  teach.dwelling = "h-teach";
  teach.health = 4;
  teach.job = { firm: "pub-uni", career: "teacher", salary: 1 };
  const world = shell(
    { ada, ben, cleo, doc, teach },
    180,
    0,
  );
  world.rng = { seed: 8, stream: 0 };
  world.houses = {
    "h-ada": { id: "h-ada", units: 10, owner: "ada", occupant: "ada", lien: null },
    "h-cleo": { id: "h-cleo", units: 10, owner: "cleo", occupant: "cleo", lien: null },
    "h-doc": { id: "h-doc", units: 10, owner: "doc", occupant: "doc", lien: null },
    "h-teach": {
      id: "h-teach",
      units: 10,
      owner: "teach",
      occupant: "teach",
      lien: null,
    },
  };
  world.firms = {
    "pub-hosp": firmShell("pub-hosp", "gov", { a: 0, b: 0 }, "publicHospital"),
    "pub-uni": firmShell("pub-uni", "gov", { a: 0, b: 0 }, "publicUniversity"),
    "priv-hosp": firmShell("priv-hosp", "ada", { a: 0, b: 0 }, "privateHospital"),
    "priv-uni": firmShell("priv-uni", "ada", { a: 0, b: 0 }, "privateUniversity"),
  };
  // One generation-0 machine each. One operator staffs half of ops(c, 0) and
  // that half is one award. The builder is not a firm, so maintenance is zero.
  world.machines = {
    "m-doc": {
      id: "m-doc",
      type: "doctor",
      generation: 0,
      owner: "pub-hosp",
      builder: "mill",
    },
    "m-teach": {
      id: "m-teach",
      type: "teacher",
      generation: 0,
      owner: "pub-uni",
      builder: "mill",
    },
  };
  world.firms["pub-hosp"].machines = ["m-doc"];
  world.firms["pub-uni"].machines = ["m-teach"];
  assertInvariant(world);
  return world;
}

/** Mill has delivered one generation-0 retail machine. The shop can pay for
 *  the next one. The plan offers it. Delivery is what mints generation 1. */
export function techSeed(): World {
  let world = shell(
    {
      ada: makePerson("ada", 0, 0),
      ben: makePerson("ben", 0, 0),
    },
    0,
    0,
  );
  world = placeFirm(world, firmShell("mill", "ada", { a: 0, b: 0 }, "tech"));
  world = placeFirm(world, firmShell("shop", "ben", { a: 30, b: 0 }));
  world.firms.mill.salesLastMonth = 1;
  world.machines = {
    m0: {
      id: "m0",
      type: "retail",
      generation: 0,
      owner: "shop",
      builder: "mill",
    },
  };
  world.firms.shop.machines = ["m0"];
  assertInvariant(world);
  return world;
}
