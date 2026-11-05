// market_test.ts — cheapest lots, a named seller, the sell-out draw, and the
// one retry that still does not sell a share.

import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import { fillGate, postGoodGate } from "./gates.ts";
import { clearStaple, hasLiquid, markStarvation, starvationDeaths } from "./market.ts";
import { firmShell, marketSeed, placeFirm } from "./seed.ts";
import type { Listing, World } from "./types.ts";
import { applyEffect, assertFlowIdentity, assertInvariant, openingNfa } from "./world.ts";
import { LeakError } from "./world.ts";

function lot(id: string, price: number, qty: number, seller = "shop"): Listing {
  return { id, seller, kind: "good", price, qty, payload: { good: "staple" } };
}

function withLots(world: World, inventory: number, listings: Listing[]): World {
  return {
    ...world,
    listings,
    firms: {
      ...world.firms,
      shop: { ...world.firms.shop, inventory: { staple: inventory } },
    },
  };
}

Deno.test("an unnamed buyer takes the cheapest lot and does not draw", () => {
  const world = withLots(marketSeed(), 2, [lot("dear", 9, 1), lot("cheap", 4, 1)]);
  const plan = clearStaple(world, [{ buyer: "ada", qty: 1 }]);
  assertEquals(plan.byBuyer[0], {
    buyer: "ada",
    filled: 1,
    lots: [{ listing: "cheap", qty: 1 }],
  });
  assertEquals(plan.world.rng, world.rng);
});

Deno.test("a named seller is not replaced by a cheaper lot", () => {
  let world = marketSeed();
  world = placeFirm(world, firmShell("bodega", "ben", { a: 0, b: 0 }));
  world.firms.shop.inventory = { staple: 1 };
  world.firms.bodega.inventory = { staple: 1 };
  world.listings = [lot("shop-lot", 9, 1, "shop"), lot("bodega-lot", 4, 1, "bodega")];
  const plan = clearStaple(world, [{ buyer: "ada", qty: 1, seller: "shop" }]);
  assertEquals(plan.byBuyer[0].lots, [{ listing: "shop-lot", qty: 1 }]);
  assertEquals(plan.world.rng.stream, 0);
});

Deno.test("a zero fill retries once, at the posted price, off the named seller", () => {
  const world = withLots(marketSeed(), 1, [lot("shop-lot", 4, 1)]);
  const plan = clearStaple(world, [{ buyer: "ada", qty: 1, seller: "nobody" }]);
  assertEquals(plan.byBuyer[0], {
    buyer: "ada",
    filled: 1,
    lots: [{ listing: "shop-lot", qty: 1 }],
  });
  assertEquals(plan.world.rng.stream, 0);
});

Deno.test("a partial fill does not reach across to the seller it did not name", () => {
  let world = marketSeed();
  world = placeFirm(world, firmShell("bodega", "ben", { a: 0, b: 0 }));
  world.firms.shop.inventory = { staple: 1 };
  world.firms.bodega.inventory = { staple: 1 };
  world.listings = [lot("shop-lot", 5, 1, "shop"), lot("bodega-lot", 5, 1, "bodega")];
  const plan = clearStaple(world, [{ buyer: "ada", qty: 2, seller: "shop" }]);
  assertEquals(plan.byBuyer[0], {
    buyer: "ada",
    filled: 1,
    lots: [{ listing: "shop-lot", qty: 1 }],
  });
});

Deno.test("a sell-out gives one unit to one claimant, and the seed replays", () => {
  const world = withLots(marketSeed(), 1, [lot("only", 10, 1)]);
  const once = (seed: number) => {
    const w = { ...world, rng: { seed, stream: 0 } };
    return clearStaple(w, [
      { buyer: "ada", qty: 1 },
      { buyer: "ben", qty: 1 },
    ]);
  };
  const first = once(1);
  const again = once(1);
  assertEquals(again.byBuyer, first.byBuyer);
  assertEquals(again.world.rng, first.world.rng);
  assertEquals(first.byBuyer.reduce((s, b) => s + b.filled, 0), 1);
  assertEquals(first.world.rng.stream > 0, true);
  const winners = new Set<string>();
  for (let seed = 1; seed <= 40; seed++) {
    const plan = once(seed);
    const winner = plan.byBuyer.find((b) => b.filled === 1);
    if (winner) winners.add(winner.buyer);
  }
  assertEquals(winners.has("ada") && winners.has("ben"), true);
});

Deno.test("two units on one lot are split before either leaf would commit", () => {
  const world = withLots(marketSeed(), 2, [lot("only", 10, 2)]);
  const plan = clearStaple(world, [
    { buyer: "ada", qty: 2 },
    { buyer: "ben", qty: 2 },
  ]);
  assertEquals(plan.byBuyer.map((b) => b.filled), [1, 1]);
});

Deno.test("cash and inventory cap the fill, and an empty purse takes nothing", () => {
  const rich = withLots(marketSeed(), 10, [lot("only", 10, 10)]);
  const capped = clearStaple(rich, [{ buyer: "ada", qty: 10 }]);
  assertEquals(capped.byBuyer[0].filled, 5);
  const thin = withLots(marketSeed(), 2, [lot("only", 10, 5)]);
  assertEquals(clearStaple(thin, [{ buyer: "ada", qty: 5 }]).byBuyer[0].filled, 2);
  const broke = clearStaple(rich, [{ buyer: "cleo", qty: 1 }]);
  assertEquals(broke.byBuyer[0], { buyer: "cleo", filled: 0, lots: [] });
  assertEquals(broke.world.rng.stream, 0);
});

Deno.test("a fill moves the staple row and leaves interbank where it was", () => {
  let world = withLots(marketSeed(), 1, []);
  const base = openingNfa(world);
  const posted = postGoodGate(world, "shop", 10, 1);
  if (!posted.ok) throw new Error(posted.reason);
  world = applyEffect(world, posted.effect);
  const id = world.listings[0].id;
  const gated = fillGate(world, id, "ada", 1);
  if (!gated.ok) throw new Error(gated.reason);
  world = applyEffect(world, gated.effect);
  assertEquals(world.people.ada.deposits.a, 40);
  assertEquals(world.firms.shop.deposits.a, 10);
  assertEquals(world.firms.shop.inventory.staple, 0);
  assertEquals(world.listings[0].qty, 0);
  assertEquals(world.interbank, 0);
  assertInvariant(world);
  assertFlowIdentity(world, base);
  const row = world.flows.filter((l) => l.row === "staple").reduce(
    (s, l) => s + l.amount,
    0,
  );
  assertEquals(row, 0);
});

Deno.test("a zero fill commits nothing onto the listing, and an overfill throws", () => {
  let world = withLots(marketSeed(), 1, []);
  const posted = postGoodGate(world, "shop", 10, 1);
  if (!posted.ok) throw new Error(posted.reason);
  world = applyEffect(world, posted.effect);
  const id = world.listings[0].id;
  const zero = fillGate(world, "", "cleo", 0);
  if (!zero.ok) throw new Error(zero.reason);
  const after = applyEffect(world, zero.effect);
  assertEquals(after.listings[0].qty, 1);
  assertEquals(after.people.cleo.deposits.a, 0);
  assertEquals(after.flows.length, world.flows.length);
  assertThrows(
    () => applyEffect(world, { tag: "fill", listing: id, buyer: "ada", qty: 2 }),
    LeakError,
  );
});

Deno.test("posting cannot exceed staple on hand, and a folded firm cannot post", () => {
  const world = withLots(marketSeed(), 1, []);
  assertEquals(postGoodGate(world, "shop", 10, 2).ok, false);
  assertEquals(postGoodGate(world, "shop", 0, 1).ok, false);
  const once = postGoodGate(world, "shop", 10, 1);
  if (!once.ok) throw new Error(once.reason);
  const posted = applyEffect(world, once.effect);
  assertEquals(postGoodGate(posted, "shop", 10, 1).ok, false);
  const folded = {
    ...world,
    firms: { ...world.firms, shop: { ...world.firms.shop, folded: true } },
  };
  assertEquals(postGoodGate(folded, "shop", 10, 1).ok, false);
});

Deno.test("starvation counts only a zero fill, and a house is not liquid", () => {
  const world = marketSeed();
  world.people.ada.starvation = 2;
  world.people.cleo.starvation = 2;
  world.houses = {
    "h-cleo": { id: "h-cleo", units: 10, owner: "cleo", occupant: "cleo", lien: null },
  };
  world.people.cleo.dwelling = "h-cleo";
  world.people.ben.starvation = 2;
  const marked = markStarvation(world, [
    { person: "cleo", filled: 0 },
    { person: "ada", filled: 1 },
  ]);
  assertEquals(marked.people.cleo.starvation, 3);
  assertEquals(marked.people.ada.starvation, 0);
  assertEquals(marked.people.ben.starvation, 2);
  const once = markStarvation(world, [{ person: "ben", filled: 0 }]);
  assertEquals(once.people.ben.starvation, 3);
  const twice = markStarvation(once, [{ person: "ben", filled: 0 }]);
  assertEquals(twice.people.ben.starvation, 3);
  assertEquals(hasLiquid(marked, "cleo"), false);
  assertEquals(starvationDeaths(marked, [{ person: "cleo", filled: 0 }]), ["cleo"]);
  const share = {
    ...marked,
    shares: { s: { id: "s", bank: "a" as const, holder: "cleo", units: 1 } },
  };
  assertEquals(hasLiquid(share, "cleo"), true);
  const mine = {
    ...marked,
    mines: {
      m: {
        id: "m",
        material: "common" as const,
        stock: 0,
        owner: "cleo",
        depositedAt: null,
        lien: null,
      },
    },
  };
  assertEquals(hasLiquid(mine, "cleo"), true);
  const deposited = {
    ...mine,
    mines: {
      m: { ...mine.mines.m, depositedAt: "a" as const },
    },
  };
  assertEquals(hasLiquid(deposited, "cleo"), false);
  const debt = {
    ...marked,
    loans: {
      d: {
        kind: "private" as const,
        id: "d",
        issuer: "shop",
        holder: "cleo",
        principal: 5,
        installment: 5,
        months: 1,
        issuerKind: "firm" as const,
      },
    },
  };
  assertEquals(hasLiquid(debt, "cleo"), true);
  const saved = markStarvation(
    {
      ...world,
      people: {
        ...world.people,
        cleo: { ...world.people.cleo, deposits: { a: 1, b: 0 } },
      },
    },
    [{ person: "cleo", filled: 0 }],
  );
  assertEquals(hasLiquid(saved, "cleo"), true);
  assertEquals(starvationDeaths(saved, [{ person: "cleo", filled: 0 }]), []);
});
