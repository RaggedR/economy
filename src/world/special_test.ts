// special_test.ts — the special day is a plan. Shares are cheapest-first.
// A house is a lottery. The incumbent keeps the chair. The sitting tenant
// keeps the house.

import { assertEquals } from "jsr:@std/assert@1";
import { makePerson, storySeed } from "./seed.ts";
import {
  clearHouses,
  clearMachines,
  clearShares,
  seatJobs,
  seatRents,
} from "./special.ts";
import type { Listing, World } from "./types.ts";
import { applyEffect, assertInvariant } from "./world.ts";

function bankBook(): World {
  const world = storySeed();
  world.people.ada = makePerson("ada", 0, 0);
  world.people.ben = makePerson("ben", 60, 0);
  world.people.cleo = makePerson("cleo", 0, 40);
  world.people.ben.health = 0;
  world.people.cleo.health = 5;
  world.people.ben.job = { firm: "shop", career: "retail", salary: 8 };
  world.banks.a.depositLiability = -60;
  world.banks.a.equity = 40;
  world.banks.a.loansOutstanding = 100;
  world.banks.a.sharesOutstanding = 2;
  world.banks.b.depositLiability = -40;
  world.banks.b.equity = -40;
  world.banks.b.loansOutstanding = 0;
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
    "h-ben": { id: "h-ben", units: 10, owner: "ben", occupant: "cleo", lien: "L" },
    "h-cleo": { id: "h-cleo", units: 10, owner: "cleo", occupant: "cleo", lien: null },
    "h-ada": { id: "h-ada", units: 10, owner: "ada", occupant: "ada", lien: null },
  };
  world.people.cleo.dwelling = "h-ben";
  world.people.ada.dwelling = "h-ada";
  assertInvariant(world);
  return world;
}

function list(partial: Listing): Listing {
  return partial;
}

Deno.test("an uncontested share does not draw, and a sell-out does", () => {
  const posted = bankBook();
  posted.listings = [
    list({
      id: "cheap",
      seller: "ada",
      kind: "share",
      price: 10,
      qty: 1,
      payload: { bank: "a" },
    }),
    list({
      id: "dear",
      seller: "ada",
      kind: "share",
      price: 25,
      qty: 1,
      payload: { bank: "a" },
    }),
  ];
  const quiet = clearShares(posted, [{ buyer: "ben", bank: "a", qty: 1, limit: 10 }]);
  assertEquals(quiet.byBuyer[0].lots, [{ listing: "cheap", qty: 1 }]);
  assertEquals(quiet.world.rng, posted.rng);

  const fought = clearShares(posted, [
    { buyer: "ben", bank: "a", qty: 1, limit: 10 },
    { buyer: "cleo", bank: "a", qty: 1, limit: 30 },
  ]);
  assertEquals(fought.byBuyer[0].filled + fought.byBuyer[1].filled, 1);
  assertEquals(fought.world.rng.stream > posted.rng.stream, true);
  assertEquals(fought.world.people.ben.deposits.a, 60);
});

Deno.test("one solvent bidder takes the house without a draw", () => {
  const world = bankBook();
  world.listings = [
    list({
      id: "sale",
      seller: "cleo",
      kind: "houseSale",
      price: 30,
      qty: 1,
      payload: { house: "h-cleo" },
    }),
  ];
  world.people.ada.deposits = { a: 30, b: 0 };
  world.banks.a.depositLiability = -90;
  world.banks.a.equity = 10;
  assertInvariant(world);
  const alone = clearHouses(world, [{ buyer: "ada", house: "h-cleo" }]);
  assertEquals(alone.byBuyer[0].won, true);
  assertEquals(alone.world.rng, world.rng);

  world.people.cleo.deposits = { a: 0, b: 0 };
  world.banks.b.depositLiability = 0;
  world.banks.b.equity = 0;
  const poor = clearHouses(world, [
    { buyer: "cleo", house: "h-cleo" },
    { buyer: "ada", house: "h-cleo" },
  ]);
  assertEquals(poor.byBuyer[0].won, false);
  assertEquals(poor.byBuyer[1].won, true);
  assertEquals(poor.world.rng, world.rng);
});

Deno.test("two solvent bidders draw, and only one wins", () => {
  const world = bankBook();
  world.people.ada.deposits = { a: 30, b: 0 };
  world.banks.a.depositLiability = -90;
  world.banks.a.equity = 10;
  world.listings = [
    list({
      id: "sale",
      seller: "cleo",
      kind: "houseSale",
      price: 30,
      qty: 1,
      payload: { house: "h-cleo" },
    }),
  ];
  assertInvariant(world);
  const plan = clearHouses(world, [
    { buyer: "ada", house: "h-cleo" },
    { buyer: "ben", house: "h-cleo" },
  ]);
  const wins = plan.byBuyer.filter((row) => row.won).map((row) => row.buyer);
  assertEquals(wins.length, 1);
  // One draw per bidder, including the last one left in the pool.
  assertEquals(plan.world.rng.stream, world.rng.stream + 2);
  assertEquals(plan.world.people.ada.deposits.a, 30);
});

Deno.test("the incumbent keeps the chair and the old salary's claim on it", () => {
  const world = bankBook();
  world.listings = [
    list({
      id: "seat",
      seller: "shop",
      kind: "job",
      price: 20,
      qty: 1,
      payload: { career: "retail", generation: 0, salary: 20, slots: 1 },
    }),
  ];
  const plan = seatJobs(world, [
    { person: "ben", kind: "keep" },
    { person: "cleo", kind: "apply", listing: "seat" },
  ]);
  assertEquals(plan.rows.find((row) => row.person === "ben")?.outcome, "seated");
  assertEquals(plan.rows.find((row) => row.person === "cleo")?.outcome, "rationed");
  assertEquals(plan.world.rng, world.rng);
});

Deno.test("a chair left for another listing stays empty for the rest of the day", () => {
  const world = bankBook();
  world.listings = [
    list({
      id: "new",
      seller: "mill",
      kind: "job",
      price: 20,
      qty: 1,
      payload: { career: "retail", generation: 0, salary: 20, slots: 1 },
    }),
    list({
      id: "old",
      seller: "shop",
      kind: "job",
      price: 8,
      qty: 1,
      payload: { career: "retail", generation: 0, salary: 8, slots: 1 },
    }),
  ];
  const plan = seatJobs(world, [
    { person: "ben", kind: "keep" },
    { person: "ben", kind: "apply", listing: "new" },
    { person: "cleo", kind: "apply", listing: "old" },
  ]);
  const ben = plan.rows.filter((row) => row.person === "ben");
  assertEquals(ben.find((row) => row.listing === "old")?.outcome, "rationed");
  assertEquals(ben.find((row) => row.listing === "new")?.outcome, "seated");
  assertEquals(plan.rows.find((row) => row.person === "cleo")?.outcome, "rationed");
});

Deno.test("a low-health applicant is hired when the healthier ones do not fill the slots", () => {
  const world = bankBook();
  world.people.ada.health = 0;
  world.people.ada.education.retail = 0;
  world.listings = [
    list({
      id: "seat",
      seller: "shop",
      kind: "job",
      price: 20,
      qty: 2,
      payload: { career: "retail", generation: 0, salary: 20, slots: 2 },
    }),
  ];
  const plan = seatJobs(world, [
    { person: "cleo", kind: "apply", listing: "seat" },
    { person: "ada", kind: "apply", listing: "seat" },
  ]);
  assertEquals(plan.rows.find((row) => row.person === "ada")?.outcome, "seated");
  assertEquals(plan.rows.find((row) => row.person === "cleo")?.outcome, "seated");
});

Deno.test("applyJob below the generation is ineligible, and a health tie draws", () => {
  const world = bankBook();
  world.people.ada.health = 5;
  world.people.ada.education.engineer = 0;
  world.listings = [
    list({
      id: "eng",
      seller: "shop",
      kind: "job",
      price: 20,
      qty: 1,
      payload: { career: "engineer", generation: 1, salary: 20, slots: 1 },
    }),
  ];
  const blocked = seatJobs(world, [{ person: "ada", kind: "apply", listing: "eng" }]);
  assertEquals(blocked.rows[0].outcome, "ineligible");

  world.listings[0] = {
    ...world.listings[0],
    payload: { career: "retail", generation: 0, salary: 20, slots: 1 },
  };
  world.people.ben.job = null;
  const tie = seatJobs(world, [
    { person: "ada", kind: "apply", listing: "eng" },
    { person: "cleo", kind: "apply", listing: "eng" },
  ]);
  const seated = tie.rows.filter((row) => row.outcome === "seated");
  assertEquals(seated.length, 1);
  assertEquals(tie.world.rng.stream > world.rng.stream, true);
});

Deno.test("the sitting tenant keeps the house ahead of a higher salary", () => {
  const world = bankBook();
  world.listings = [
    list({
      id: "let",
      seller: "ben",
      kind: "rent",
      price: 15,
      qty: 1,
      payload: { house: "h-ben" },
    }),
  ];
  const plan = seatRents(world, [
    { person: "cleo", house: "h-ben" },
    { person: "ada", house: "h-ben" },
  ]);
  // ada has no cash in bankBook, so she is short. Give her the year.
  void plan;
  world.people.ada.deposits = { a: 30, b: 0 };
  world.banks.a.depositLiability = -90;
  world.banks.a.equity = 10;
  assertInvariant(world);
  const seated = seatRents(world, [
    { person: "cleo", house: "h-ben" },
    { person: "ada", house: "h-ben" },
  ]);
  assertEquals(seated.rows[0].outcome, "seated");
  assertEquals(seated.rows[1].outcome, "rationed");
  assertEquals(seated.world.rng, world.rng);
});

Deno.test("a tenant who cannot pay the year is short, and the next salary takes it", () => {
  const world = bankBook();
  world.people.cleo.deposits = { a: 0, b: 0 };
  world.banks.b.depositLiability = 0;
  world.banks.b.equity = 0;
  world.people.ada.deposits = { a: 30, b: 0 };
  world.banks.a.depositLiability = -90;
  world.banks.a.equity = 10;
  world.people.ada.job = { firm: "shop", career: "retail", salary: 4 };
  world.listings = [
    list({
      id: "let",
      seller: "ben",
      kind: "rent",
      price: 15,
      qty: 1,
      payload: { house: "h-ben" },
    }),
  ];
  assertInvariant(world);
  const plan = seatRents(world, [
    { person: "cleo", house: "h-ben" },
    { person: "ada", house: "h-ben" },
  ]);
  assertEquals(plan.rows[0].outcome, "short");
  assertEquals(plan.rows[1].outcome, "seated");
});

Deno.test("a share trade then the dividend pays the buyer of record", () => {
  let world = bankBook();
  world.listings = [
    list({
      id: "lot",
      seller: "ada",
      kind: "share",
      price: 10,
      qty: 1,
      payload: { bank: "a" },
    }),
  ];
  world = applyEffect(world, { tag: "tradeShare", listing: "lot", buyer: "ben", qty: 1 });
  assertEquals(world.people.ben.deposits.a, 50);
  assertEquals(world.people.ada.deposits.a, 10);
  const adaUnits = Object.values(world.shares).filter((s) => s.holder === "ada")
    .reduce((n, s) => n + s.units, 0);
  const benUnits = Object.values(world.shares).filter((s) => s.holder === "ben")
    .reduce((n, s) => n + s.units, 0);
  assertEquals(adaUnits, 1);
  assertEquals(benUnits, 1);
  assertEquals(world.banks.a.sharesOutstanding, 2);
  world = applyEffect(world, { tag: "dividend", bank: "a" });
  assertEquals(world.people.ada.deposits.a, 30);
  assertEquals(world.people.ben.deposits.a, 70);
  assertEquals(world.banks.a.equity, 0);
  assertInvariant(world);
});

Deno.test("a machine order mints the generation and pays the builder", () => {
  const world = bankBook();
  world.firms = {
    shop: {
      id: "shop",
      kind: "supermarket",
      owner: "ada",
      deposits: { a: 0, b: 20 },
      machines: [],
      inventory: {},
      salesLastMonth: 0,
      taxOwed: 0,
      folded: false,
    },
    mill: {
      id: "mill",
      kind: "tech",
      owner: "ben",
      deposits: { a: 0, b: 0 },
      machines: [],
      inventory: {},
      salesLastMonth: 0,
      taxOwed: 0,
      folded: false,
    },
  };
  world.banks.b.depositLiability -= 20;
  world.banks.b.equity -= 20;
  world.listings = [
    list({
      id: "m",
      seller: "mill",
      kind: "machine",
      price: 10,
      qty: 1,
      payload: { type: "engineer", generation: 2 },
    }),
  ];
  assertInvariant(world);
  const plan = clearMachines(world, [{ firm: "shop", listing: "m", qty: 1, limit: 10 }]);
  assertEquals(plan.byFirm[0], {
    firm: "shop",
    filled: 1,
    lots: [{ listing: "m", qty: 1 }],
  });
  assertEquals(plan.world.rng, world.rng);
  const next = applyEffect(world, {
    tag: "deliverMachine",
    listing: "m",
    firm: "shop",
    qty: 1,
  });
  const machine = Object.values(next.machines)[0];
  assertEquals(machine.generation, 2);
  assertEquals(machine.owner, "shop");
  assertEquals(machine.builder, "mill");
  assertEquals(next.firms.shop.machines, [machine.id]);
  assertEquals(next.firms.shop.deposits.b, 10);
  assertEquals(next.firms.mill.deposits.b, 10);
  assertInvariant(next);
});
