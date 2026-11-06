// kin_test.ts — the fertility gate, and the estate's routing. The reducer
// does not choose. A voluntary weight of zero births nobody.

import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import { birthGate } from "./gates.ts";
import {
  depositCash,
  fertility,
  heirOf,
  holdsEstate,
  planBirths,
  planEstate,
  spareUnits,
} from "./kin.ts";
import { params } from "./params.ts";
import { kinSeed, makePerson, storySeed, townCensus, townSeed } from "./seed.ts";
import type { Effect, Id, World } from "./types.ts";
import { applyEffect, assertInvariant, instrumentSums, moneySupply } from "./world.ts";

function applyAll(world: World, effects: readonly Effect[]): World {
  return effects.reduce(applyEffect, world);
}

function settled(world: World, personId: Id): World {
  const plan = planEstate(world, personId);
  return applyAll(plan.world, plan.effects);
}

function zeroBooks(world: World): void {
  for (const person of Object.values(world.people)) person.deposits = { a: 0, b: 0 };
  for (const bank of ["a", "b"] as const) {
    world.banks[bank].depositLiability = 0;
    world.banks[bank].equity = 0;
    world.banks[bank].loansOutstanding = 0;
    world.banks[bank].sharesOutstanding = 0;
  }
  world.houses = {};
  world.shares = {};
  world.loans = {};
  world.interbank = 0;
}

function payIn(world: World, personId: Id, amount: number): void {
  world.people[personId].deposits.a += amount;
  world.banks.a.depositLiability -= amount;
  world.banks.a.equity -= amount;
}

function cast(): World {
  const world = storySeed();
  world.people.cleo = makePerson("cleo", 0, 0);
  zeroBooks(world);
  return world;
}

Deno.test("t₀ is employed, housed, and has no level-1 engineer", () => {
  const world = townSeed();
  const census = townCensus(world);
  assertEquals(census, {
    people: 15,
    firms: 15,
    housed: 15,
    engineer: 0,
    commonMines: 2,
    advancedMines: 2,
  });
  for (const person of Object.values(world.people)) {
    assertEquals(person.job !== null, true);
    assertEquals(person.education.engineer, 0);
  }
  const kinds = Object.values(world.firms).map((firm) => firm.kind).sort();
  assertEquals(kinds.filter((kind) => kind === "tech").length, 4);
  assertEquals(kinds.filter((kind) => kind === "supermarket").length, 2);
  assertEquals(kinds.filter((kind) => kind === "luxury").length, 2);
  assertEquals(kinds.filter((kind) => kind === "nightclub").length, 3);
  assertEquals(kinds.filter((kind) => kind === "privateHospital").length, 1);
  assertEquals(kinds.filter((kind) => kind === "publicHospital").length, 1);
  assertEquals(kinds.filter((kind) => kind === "privateUniversity").length, 1);
  assertEquals(kinds.filter((kind) => kind === "publicUniversity").length, 1);
  for (const mine of Object.values(world.mines)) {
    assertEquals(mine.depositedAt, null);
    assertEquals(typeof world.people[mine.owner], "object");
  }
  for (const weight of Object.values(params.fertilityWeight)) assertEquals(weight, 0);
});

Deno.test("the mandatory line births once, and the voluntary line does not", () => {
  const forced = kinSeed();
  assertEquals(fertility(forced, "ada"), "mandatory");
  assertEquals(fertility(forced, "ben"), "none");
  assertEquals(fertility(forced, "cleo"), "none");
  assertEquals(spareUnits(forced, "ada"), 90);
  const gate = birthGate(forced, "ada");
  assertEquals(gate.ok, true);
  assertEquals(birthGate(forced, "cleo").ok, false);

  const before = moneySupply(forced);
  const born = applyAll(forced, planBirths(forced));
  const child = Object.values(born.people).find((person) => person.parent === "ada");
  if (!child) throw new Error("no child");
  assertEquals(child.deposits.a, params.cashGift);
  assertEquals(child.objective, "savings");
  assertEquals(child.education.engineer, 0);
  assertEquals(child.job, null);
  assertEquals(born.houses[child.dwelling ?? ""].units, params.houseQuantum);
  assertEquals(born.houses[child.dwelling ?? ""].owner, child.id);
  assertEquals(born.people.ada.children, [child.id]);
  assertEquals(born.houses["h-ada"].units, params.fertilityUnits - params.houseQuantum);
  assertEquals(depositCash(born, "ada"), 600 - params.cashGift);
  assertEquals(moneySupply(born), before);
  assertEquals(planBirths(born).length, 0);
  for (const sum of Object.values(instrumentSums(born))) assertEquals(sum, 0);

  const voluntary = cast();
  voluntary.people.ada.dwelling = "h-ada";
  voluntary.houses["h-ada"] = {
    id: "h-ada",
    units: 20,
    owner: "ada",
    occupant: "ada",
    lien: null,
  };
  payIn(voluntary, "ada", params.fertilityLiquidMultiple * params.cashGift);
  assertInvariant(voluntary);
  assertEquals(fertility(voluntary, "ada"), "voluntary");
  assertEquals(planBirths(voluntary), []);
  assertEquals(birthGate(voluntary, "ada").ok, false);

  voluntary.people.ada.children = ["ben"];
  voluntary.people.ben.parent = "ada";
  voluntary.people.ben.alive = true;
  assertEquals(fertility(voluntary, "ada"), "none");
  voluntary.houses["h-ada"].units = 30;
  payIn(voluntary, "ada", params.fertilityLiquidMultiple * params.cashGift);
  assertEquals(spareUnits(voluntary, "ada"), 20);
  assertEquals(fertility(voluntary, "ada"), "voluntary");
  assertEquals(planBirths(voluntary), []);
});

Deno.test("the first living child inherits the net estate and no debt", () => {
  const world = cast();
  world.people.ada.children = ["ben", "cleo"];
  world.people.ben.parent = "ada";
  world.people.cleo.parent = "ada";
  world.people.ada.dwelling = "h-ada";
  world.people.ben.dwelling = "h-ben";
  world.people.cleo.dwelling = "h-cleo";
  world.houses = {
    "h-ada": { id: "h-ada", units: 10, owner: "ada", occupant: "ada", lien: null },
    "h-ben": { id: "h-ben", units: 10, owner: "ben", occupant: "ben", lien: null },
    "h-cleo": { id: "h-cleo", units: 10, owner: "cleo", occupant: "cleo", lien: null },
  };
  payIn(world, "ada", 40);
  world.shares = { s: { id: "s", bank: "a", holder: "ada", units: 3 } };
  world.banks.a.sharesOutstanding = 3;
  world.firms = {
    shop: {
      id: "shop",
      kind: "supermarket",
      owner: "ada",
      deposits: { a: 0, b: 0 },
      machines: [],
      inventory: {},
      salesLastMonth: 0,
      taxOwed: 0,
      folded: false,
    },
  };
  world.people.ada.firm = "shop";
  assertInvariant(world);
  assertEquals(heirOf(world, "ada"), "ben");

  const next = settled(world, "ada");
  assertEquals(next.people.ada.alive, false);
  assertEquals(holdsEstate(next, "ada"), false);
  assertEquals(next.people.ada.dwelling, null);
  assertEquals(next.people.ada.firm, null);
  assertEquals(next.houses["h-ada"].owner, "ben");
  assertEquals(depositCash(next, "ben"), 40);
  assertEquals(depositCash(next, "cleo"), 0);
  assertEquals(next.houses["h-cleo"].owner, "cleo");
  assertEquals(next.shares.s.holder, "ben");
  assertEquals(next.firms.shop.owner, "ben");
  assertEquals(next.people.ben.firm, "shop");
  for (const sum of Object.values(instrumentSums(next))) assertEquals(sum, 0);

  world.people.ben.alive = false;
  world.people.ben.dwelling = null;
  delete world.houses["h-ben"];
  const skipped = settled(world, "ada");
  assertEquals(heirOf(world, "ada"), "cleo");
  assertEquals(skipped.houses["h-ada"].owner, "cleo");
  assertEquals(depositCash(skipped, "cleo"), 40);
  assertEquals(skipped.shares.s.holder, "cleo");
});

Deno.test("a childless estate seizes, scatters quanta, and escheats the rest", () => {
  const world = cast();
  world.people.ben.dwelling = "h-ben";
  world.houses = {
    "h-ada": { id: "h-ada", units: 30, owner: "ada", occupant: "ada", lien: "L" },
    "h-free": { id: "h-free", units: 30, owner: "ada", occupant: null, lien: null },
    "h-ben": { id: "h-ben", units: 10, owner: "ben", occupant: "ben", lien: null },
  };
  world.people.ada.dwelling = "h-ada";
  world.loans = {
    L: {
      kind: "bank",
      id: "L",
      bank: "a",
      borrower: "ada",
      principal: 30,
      installment: 10,
      months: 3,
      collateral: "h-ada",
    },
  };
  world.banks.a.loansOutstanding = 30;
  world.banks.a.equity = 30;
  world.loans.D = {
    kind: "private",
    id: "D",
    issuer: "gov",
    holder: "ada",
    principal: 25,
    installment: 5,
    months: 5,
    issuerKind: "government",
  };
  assertInvariant(world);

  const next = settled(world, "ada");
  assertEquals(next.loans.L, undefined);
  assertEquals(next.houses["h-ada"].owner, "a");
  assertEquals(next.houses["h-ada"].lien, null);
  assertEquals(next.banks.a.equity, 0);
  assertEquals(next.banks.a.loansOutstanding, 0);
  // One homeless person, so the free house's first quantum does not draw.
  assertEquals(next.rng, world.rng);
  const gifted = Object.values(next.houses).find((house) => house.owner === "cleo");
  if (!gifted) throw new Error("cleo received no house");
  assertEquals(gifted.units, 10);
  assertEquals(gifted.occupant, "cleo");
  assertEquals(next.people.cleo.dwelling, gifted.id);
  const left = Object.values(next.houses).filter((house) => house.owner === "gov");
  assertEquals(left.length, 1);
  assertEquals(left[0].units, 20);
  const debt = next.loans.D;
  if (!debt || debt.kind !== "private") throw new Error("receivable missing");
  assertEquals(debt.holder, "gov");
  assertEquals(debt.issuer, "gov");
  assertEquals(holdsEstate(next, "ada"), false);
  assertEquals(next.people.ada.alive, false);
  for (const sum of Object.values(instrumentSums(next))) assertEquals(sum, 0);
  const owed = Object.values(next.loans).filter((loan) =>
    loan.kind === "bank" && loan.borrower === "ada"
  );
  assertEquals(owed, []);
});

Deno.test("two homeless recipients draw, and a bare death still refuses twice", () => {
  const world = cast();
  world.houses = {
    "h-ada": { id: "h-ada", units: 10, owner: "ada", occupant: "ada", lien: null },
  };
  world.people.ada.dwelling = "h-ada";
  world.rng = { seed: 1, stream: 0 };
  assertInvariant(world);
  const plan = planEstate(world, "ada");
  assertEquals(plan.world.rng, { seed: 1, stream: 1 });
  const next = applyAll(plan.world, plan.effects);
  assertEquals(next.houses["h-ada"].owner, "cleo");
  assertEquals(next.people.ben.dwelling, null);
  assertThrows(() => applyEffect(next, { tag: "death", person: "ada" }));
});

// --- special-month births (the town's two-tier rule) ---
import { planSpecialBirths, specialBirthBand } from "./kin.ts";

/** kinSeed, but ben holds `units` of real estate and `cash` liquid, with bank a
 *  balanced so the world stays lawful. ada stays the mandatory parent. */
function withBen(units: number, cash: number): World {
  const world = kinSeed();
  world.houses["h-ben"] = { ...world.houses["h-ben"], units };
  const was = world.people.ben.deposits.a;
  world.people.ben.deposits = { a: cash, b: 0 };
  // Liabilities are stored negative, and equity = loans + deposits + interbank,
  // so a bigger deposit drops the bank's equity by the same amount.
  world.banks.a.depositLiability -= cash - was;
  world.banks.a.equity -= cash - was;
  assertInvariant(world);
  return world;
}

Deno.test("special birth band: mandatory at fertilityUnits + fertilityMultiple·G", () => {
  const world = kinSeed(); // ada: 100 units, 10G cash
  assertEquals(specialBirthBand(world, "ada"), "mandatory");
  assertEquals(specialBirthBand(world, "ben"), "none"); // 10 units, no cash
  assertEquals(specialBirthBand(world, "cleo"), "none"); // no house
});

Deno.test("special birth band: voluntary at 3·quantum units + 3·G, not below", () => {
  const units = params.fertilityLiquidMultiple * params.houseQuantum; // 30
  const cash = params.fertilityLiquidMultiple * params.cashGift; // 3G
  assertEquals(specialBirthBand(withBen(units, cash), "ben"), "voluntary");
  // one quantum short of the real-estate bar (units are multiples of the quantum)
  assertEquals(specialBirthBand(withBen(units - params.houseQuantum, cash), "ben"), "none");
  assertEquals(specialBirthBand(withBen(units, cash - 1), "ben"), "none"); // 3G − 1
});

Deno.test("special birth band: a parent who cannot fund a child is none", () => {
  // 100 units but under one gift of cash: cannot endow, so not even mandatory.
  assertEquals(specialBirthBand(withBen(params.fertilityUnits, params.birthEndowment - 1), "ben"), "none");
});

Deno.test("planSpecialBirths: mandatory always, voluntary only when exercised", () => {
  const units = params.fertilityLiquidMultiple * params.houseQuantum;
  const cash = params.fertilityLiquidMultiple * params.cashGift;
  const world = withBen(units, cash); // ada mandatory, ben voluntary
  assertEquals(planSpecialBirths(world, false).length, 1); // ada only
  assertEquals(planSpecialBirths(world, true).length, 2); // ada + ben
});

Deno.test("special birth endows the child with a quantum of house and a gift of cash", () => {
  const world = kinSeed();
  const [effect] = planSpecialBirths(world, true);
  const after = applyEffect(world, effect);
  const child = after.people.ada.children.at(-1)!;
  const units = Object.values(after.houses)
    .filter((h) => h.owner === child).reduce((s, h) => s + h.units, 0);
  assertEquals(units, params.houseQuantum); // 10 real estate
  assertEquals(depositCash(after, child), params.birthEndowment); // one G
  assertInvariant(after); // the split kept the books lawful
});
