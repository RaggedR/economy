// fold_test.ts — maintenance, the waterfall, the reserve, the unmortgaged house,
// and a loan that arrives after the opening.

import { assertEquals } from "jsr:@std/assert@1";
import { lendGate } from "./gates.ts";
import { maintenanceCharge, planOpening } from "./fold.ts";
import { firmShell, makePerson, placeFirm, storySeed } from "./seed.ts";
import type { Id, Money, World } from "./types.ts";
import { applyEffect, assertFlowIdentity, assertInvariant, openingNfa } from "./world.ts";

function applyPlan(world: World): World {
  const plan = planOpening(world);
  const settled = plan.effects.reduce((w, effect) => applyEffect(w, effect), world);
  return plan.mark(settled);
}

function shop(depositsA: Money, month = 0): World {
  let world = storySeed();
  world = { ...world, month };
  world = placeFirm(world, firmShell("shop", "ada", { a: depositsA, b: 0 }));
  return world;
}

function hire(world: World, person: Id, salary: Money): World {
  const current = world.people[person];
  return {
    ...world,
    people: {
      ...world.people,
      [person]: { ...current, job: { firm: "shop", career: "retail", salary } },
    },
  };
}

Deno.test("maintenance is zero once the builder has folded", () => {
  let world = shop(0);
  world = placeFirm(world, { ...firmShell("tech", "ben", { a: 0, b: 0 }, "tech"), folded: true });
  world = {
    ...world,
    machines: {
      m: { id: "m", type: "retail", generation: 0, owner: "shop", builder: "tech" },
    },
    firms: {
      ...world.firms,
      shop: { ...world.firms.shop, machines: ["m"] },
    },
  };
  assertEquals(maintenanceCharge(world, "m"), 0);
  const settled = applyPlan(world);
  assertEquals(settled.firms.shop.folded, false);
  assertEquals(settled.firms.shop.deposits.a, 0);
  assertEquals(settled.firms.tech.deposits.a, 0);
});

Deno.test("a live builder is paid maintenance from the holder", () => {
  let world = shop(10);
  world = placeFirm(world, firmShell("tech", "ben", { a: 0, b: 0 }, "tech"));
  world = {
    ...world,
    machines: {
      m: { id: "m", type: "retail", generation: 0, owner: "shop", builder: "tech" },
    },
    firms: {
      ...world.firms,
      shop: { ...world.firms.shop, machines: ["m"] },
    },
  };
  const settled = applyPlan(world);
  assertEquals(settled.firms.shop.folded, false);
  assertEquals(settled.firms.shop.deposits.a, 0);
  assertEquals(settled.firms.tech.deposits.a, 10);
  assertInvariant(settled);
});

Deno.test("the waterfall pays wages, then tax, then the bank, and keeps the house", () => {
  // Month 11: one month until the next special day, so the reserve is one staple.
  let world = hire(shop(80, 11), "ben", 20);
  world.firms.shop.taxOwed = 40;
  world.people.cleo = makePerson("cleo", 0, 0);
  world.houses["h-ada"] = {
    id: "h-ada",
    units: 10,
    owner: "ada",
    occupant: "ada",
    lien: null,
  };
  world.houses["h-shop"] = {
    id: "h-shop",
    units: 10,
    owner: "shop",
    occupant: null,
    lien: "loan-shop",
  };
  const bank = world.banks.a;
  world = {
    ...world,
    loans: {
      ...world.loans,
      "loan-shop": {
        kind: "bank",
        id: "loan-shop",
        bank: "a",
        borrower: "shop",
        principal: 30,
        installment: 30,
        months: 10,
        collateral: "h-shop",
      },
      "debt-shop": {
        kind: "private",
        id: "debt-shop",
        issuer: "shop",
        holder: "cleo",
        principal: 25,
        installment: 25,
        months: 10,
        issuerKind: "firm",
      },
    },
    banks: {
      ...world.banks,
      a: {
        ...bank,
        loansOutstanding: bank.loansOutstanding + 30,
        equity: bank.equity + 30,
      },
    },
  };
  const base = openingNfa(world);
  const settled = applyPlan(world);
  assertEquals(settled.firms.shop.folded, true);
  assertEquals(settled.firms.shop.deposits, { a: 0, b: 0 });
  assertEquals(settled.people.ada.deposits.a, 1005);
  assertEquals(settled.people.ben.deposits.a, 20);
  assertEquals(settled.government.deposits.a, 40);
  assertEquals(settled.loans["loan-shop"], undefined);
  assertEquals(settled.loans["debt-shop"], undefined);
  assertEquals(settled.houses["h-shop"].owner, "a");
  assertEquals(settled.houses["h-ada"].owner, "ada");
  assertEquals(settled.houses["h-ada"].lien, null);
  assertEquals(settled.people.ada.firm, null);
  assertInvariant(settled);
  assertFlowIdentity(settled, base);
});

Deno.test("a loan after the fold does not pay the wage", () => {
  const world = hire(shop(50), "ben", 100);
  const settled = applyPlan(world);
  assertEquals(settled.firms.shop.folded, true);
  assertEquals(settled.people.ben.deposits.a, 0);
  assertEquals(settled.people.ada.deposits.a, 1050);
  const lent = applyEffect(
    settled,
    (() => {
      const gated = lendGate(settled, "a", "shop", 80, "h-ada", 8, 10);
      if (!gated.ok) throw new Error(gated.reason);
      return gated.effect;
    })(),
  );
  assertEquals(lent.people.ben.deposits.a, 0);
  assertEquals(lent.firms.shop.folded, true);
  assertEquals(lent.firms.shop.deposits.a, 80);
  assertInvariant(lent);
});

Deno.test("a short wage bill is a seeded lottery, and the same seed replays", () => {
  const build = (seed: number): World => {
    let world = hire(shop(40, 11), "ben", 30);
    world.people.cleo = makePerson("cleo", 0, 0);
    world = hire(world, "cleo", 30);
    world = { ...world, rng: { seed, stream: 0 } };
    return world;
  };
  const once = (seed: number) => applyPlan(build(seed));
  const a = once(1);
  const again = once(1);
  assertEquals(a.people.ben.deposits.a, again.people.ben.deposits.a);
  assertEquals(a.people.cleo.deposits.a, again.people.cleo.deposits.a);
  const paid = [a.people.ben.deposits.a, a.people.cleo.deposits.a].sort((x, y) => x - y);
  assertEquals(paid, [5, 30]);
  let differed = false;
  for (let seed = 2; seed < 30; seed++) {
    const other = once(seed);
    if (other.people.ben.deposits.a !== a.people.ben.deposits.a) {
      differed = true;
      break;
    }
  }
  assertEquals(differed, true);
  assertInvariant(a);
});
