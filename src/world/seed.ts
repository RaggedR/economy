// seed.ts — the smallest worlds the milestones drive. Domain ids are fields of
// the world. Log ids are not.

import type { Bank, Career, Deposits, Firm, Person, World } from "./types.ts";
import { params } from "./params.ts";
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

/** The four scripted leaves. Ada wants happiness, Ben wants education, Cleo
 *  saves and can lend. Doc and teach are the public staff. The shop can pay
 *  maintenance and still keep a reserve. */
export function leafSeed(): World {
  const ada = makePerson("ada", 40, 0, "happiness");
  ada.diseases = ["d0"];
  const ben = makePerson("ben", 40, 0, "education");
  ben.diseases = ["d0"];
  const cleo = makePerson("cleo", 200, 0, "savings");
  const doc = makePerson("doc", 0, 0);
  doc.job = { firm: "pub-hosp", career: "doctor", salary: 1 };
  const teach = makePerson("teach", 0, 0);
  teach.job = { firm: "pub-uni", career: "teacher", salary: 1 };
  let world = shell({ ada, ben, cleo, doc, teach }, 280, 0);
  world = placeFirm(world, firmShell("shop", "ada", { a: 80, b: 0 }));
  world.firms = {
    ...world.firms,
    mill: firmShell("mill", "ben", { a: 0, b: 0 }, "tech"),
    club: firmShell("club", "cleo", { a: 0, b: 0 }, "nightclub"),
    "pub-hosp": firmShell("pub-hosp", "gov", { a: 0, b: 0 }, "publicHospital"),
    "pub-uni": firmShell("pub-uni", "gov", { a: 0, b: 0 }, "publicUniversity"),
    "priv-uni": firmShell("priv-uni", "gov", { a: 0, b: 0 }, "privateUniversity"),
  };
  world.people.ben.firm = "mill";
  world.people.cleo.firm = "club";
  world.firms.club.inventory = { nightclub: 1 };
  world.firms["pub-hosp"].machines = ["m-doc"];
  world.firms["pub-uni"].machines = ["m-teach"];
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
  world.listings = [
    {
      id: "club-lot",
      seller: "club",
      kind: "good",
      price: 10,
      qty: 1,
      payload: { good: "nightclub" },
    },
    {
      id: "eng-level",
      seller: "priv-uni",
      kind: "good",
      price: 1,
      qty: 10,
      payload: { good: "tuition", career: "engineer" },
    },
  ];
  world.jobArchive = {
    year: 0,
    listings: [
      { career: "engineer", generation: 0, salary: 8, slots: 3 },
      { career: "retail", generation: 0, salary: 4, slots: 1 },
    ],
  };
  world.government.taxLastMonth = 40;
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

type TownPost = {
  firm: string;
  kind: Firm["kind"];
  career: Career;
  who: string;
  owner: string;
};

/** One of each kind the plan names. Public firms are the government's. The
 *  owner of a private firm is also its worker. Nobody is a level-1 engineer. */
const TOWN: readonly TownPost[] = [
  { firm: "tech-1", kind: "tech", career: "engineer", who: "nia", owner: "nia" },
  { firm: "tech-2", kind: "tech", career: "engineer", who: "omar", owner: "omar" },
  { firm: "tech-3", kind: "tech", career: "engineer", who: "pia", owner: "pia" },
  { firm: "tech-4", kind: "tech", career: "engineer", who: "quin", owner: "quin" },
  { firm: "shop-1", kind: "supermarket", career: "retail", who: "ria", owner: "ria" },
  { firm: "shop-2", kind: "supermarket", career: "retail", who: "sol", owner: "sol" },
  { firm: "lux-1", kind: "luxury", career: "retail", who: "tara", owner: "tara" },
  { firm: "lux-2", kind: "luxury", career: "retail", who: "uma", owner: "uma" },
  { firm: "club-1", kind: "nightclub", career: "hospitality", who: "vic", owner: "vic" },
  { firm: "club-2", kind: "nightclub", career: "hospitality", who: "wes", owner: "wes" },
  { firm: "club-3", kind: "nightclub", career: "hospitality", who: "xia", owner: "xia" },
  {
    firm: "priv-hosp",
    kind: "privateHospital",
    career: "doctor",
    who: "yara",
    owner: "yara",
  },
  {
    firm: "priv-uni",
    kind: "privateUniversity",
    career: "teacher",
    who: "zed",
    owner: "zed",
  },
  {
    firm: "pub-hosp",
    kind: "publicHospital",
    career: "doctor",
    who: "doc",
    owner: "gov",
  },
  {
    firm: "pub-uni",
    kind: "publicUniversity",
    career: "teacher",
    who: "teach",
    owner: "gov",
  },
];

const TOWN_WAGE = 8;

export type TownCensus = {
  people: number;
  firms: number;
  housed: number;
  engineer: number;
  commonMines: number;
  advancedMines: number;
};

export function townCensus(world: World): TownCensus {
  let housed = 0;
  let engineer = 0;
  for (const person of Object.values(world.people)) {
    if (person.dwelling !== null) housed += 1;
    if (person.education.engineer > engineer) engineer = person.education.engineer;
  }
  let commonMines = 0;
  let advancedMines = 0;
  for (const mine of Object.values(world.mines)) {
    if (mine.depositedAt !== null) continue;
    if (mine.material === "common") commonMines += 1;
    else advancedMines += 1;
  }
  return {
    people: Object.keys(world.people).length,
    firms: Object.keys(world.firms).length,
    housed,
    engineer,
    commonMines,
    advancedMines,
  };
}

/** t₀. Full employment, every person housed, indigenous mine owners, no
 *  level-1 engineer. Not the month prefix: that prefix still asks Ada. */
export function townSeed(): World {
  const people: Record<string, Person> = {};
  for (const post of TOWN) {
    const person = makePerson(post.who, 10, 0);
    person.dwelling = `h-${post.who}`;
    person.job = { firm: post.firm, career: post.career, salary: TOWN_WAGE };
    if (post.owner === post.who) person.firm = post.firm;
    people[post.who] = person;
  }
  const deposited = Object.keys(people).length * 10;
  const world = shell(people, deposited, 0);
  for (const post of TOWN) {
    world.firms[post.firm] = firmShell(
      post.firm,
      post.owner,
      { a: 0, b: 0 },
      post.kind,
    );
    world.houses[`h-${post.who}`] = {
      id: `h-${post.who}`,
      units: params.houseQuantum,
      owner: post.who,
      occupant: post.who,
      lien: null,
    };
  }
  world.mines = {
    c1: {
      id: "c1",
      material: "common",
      stock: 100,
      owner: "nia",
      depositedAt: null,
      lien: null,
    },
    c2: {
      id: "c2",
      material: "common",
      stock: 100,
      owner: "omar",
      depositedAt: null,
      lien: null,
    },
    a1: {
      id: "a1",
      material: "advanced",
      stock: 40,
      owner: "pia",
      depositedAt: null,
      lien: null,
    },
    a2: {
      id: "a2",
      material: "advanced",
      stock: 40,
      owner: "quin",
      depositedAt: null,
      lien: null,
    },
  };
  assertInvariant(world);
  return world;
}

/** Ada is over the mandatory line. Ben owns one quantum and nothing liquid.
 *  Cleo is homeless, so Ben's house has one place to go. */
export function kinSeed(): World {
  const ada = makePerson("ada", params.fertilityMultiple * params.cashGift, 0, "savings");
  ada.dwelling = "h-ada";
  const ben = makePerson("ben", 0, 0);
  ben.dwelling = "h-ben";
  const cleo = makePerson("cleo", 0, 0);
  const cash = ada.deposits.a;
  const world = shell({ ada, ben, cleo }, cash, 0);
  world.houses = {
    "h-ada": {
      id: "h-ada",
      units: params.fertilityUnits,
      owner: "ada",
      occupant: "ada",
      lien: null,
    },
    "h-ben": {
      id: "h-ben",
      units: params.houseQuantum,
      owner: "ben",
      occupant: "ben",
      lien: null,
    },
  };
  assertInvariant(world);
  return world;
}
