// seed.ts — the smallest worlds the milestones drive. Domain ids are fields of
// the world. Log ids are not.

import type { Bank, Career, Person, World } from "./types.ts";
import { CAREERS } from "./types.ts";

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
