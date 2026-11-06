// purses_test.ts — the firm purse pays the wage. The household purse pays for
// food. draw moves what remains to the owner, and it does not move interbank.

import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import { drawGate, payGate } from "./gates.ts";
import { openingPays, remainderDraws } from "./purses.ts";
import { firmShell, placeFirm, purseSeed, storySeed } from "./seed.ts";
import type { Effect, World } from "./types.ts";
import { applyEffect, assertFlowIdentity, assertInvariant, openingNfa } from "./world.ts";

function held(
  gate: { ok: true; effect: Effect } | { ok: false; reason: string },
): Effect {
  if (!gate.ok) throw new Error(gate.reason);
  return gate.effect;
}

function applyAll(world: World, effects: Effect[]): World {
  return effects.reduce((w, effect) => applyEffect(w, effect), world);
}

Deno.test("a firm below its working-capital reserve keeps its purse", () => {
  const start = purseSeed();
  const base = openingNfa(start);
  const dl = start.banks.a.depositLiability + start.banks.b.depositLiability;
  let world = applyAll(start, openingPays(start));
  assertEquals(world.firms.shop.deposits.a, 300);
  assertEquals(world.people.ada.deposits.a, 1000);
  assertEquals(world.people.ben.deposits.a, 100);
  assertEquals(world.people.ben.deposits.b, 800);

  // A year of the shop worker's wage is 1200; the till holds 300, so the draw
  // takes nothing and the working capital stays in the firm. The interbank
  // position is untouched because no deposit moved. (A draw that does move a
  // purse is covered by the next test.)
  world = applyAll(world, remainderDraws(world));
  assertEquals(world.firms.shop.deposits, { a: 300, b: 0 });
  assertEquals(world.people.ada.deposits.a, 1000);
  assertEquals(world.interbank, 0);
  assertEquals(world.banks.a.depositLiability + world.banks.b.depositLiability, dl);
  assertInvariant(world);
  assertFlowIdentity(world, base);
  const draw = world.flows.filter((l) => l.row === "profitDraw");
  assertEquals(draw.reduce((s, l) => s + l.amount, 0), 0);
});

Deno.test("a draw funded at both banks still does not move interbank", () => {
  let world = storySeed();
  world = placeFirm(world, firmShell("shop", "ada", { a: 100, b: 50 }));
  const dl = world.banks.a.depositLiability + world.banks.b.depositLiability;
  world = applyEffect(world, held(drawGate(world, "shop", "ada", 150)));
  assertEquals(world.people.ada.deposits, { a: 1100, b: 50 });
  assertEquals(world.firms.shop.deposits, { a: 0, b: 0 });
  assertEquals(world.interbank, 0);
  assertEquals(world.banks.a.depositLiability + world.banks.b.depositLiability, dl);
});

Deno.test("the household cannot buy food with the firm's cash", () => {
  const world = purseSeed();
  const gated = payGate(world, "cleo", "shop", 20, "staple");
  assertEquals(gated.ok, false);
  if (gated.ok) return;
  assertEquals(gated.reason.includes("cleo"), true);
  assertEquals(world.firms.shop.deposits.a, 400);
  assertThrows(() =>
    applyEffect(world, { tag: "draw", firm: "shop", owner: "ada", amount: 401 })
  );
});

Deno.test("an insolvent firm is not drawn and does not pay a partial wage", () => {
  let world = storySeed();
  world = placeFirm(world, firmShell("shop", "ada", { a: 400, b: 0 }));
  world.people.ben.job = { firm: "shop", career: "retail", salary: 500 };
  assertEquals(openingPays(world), []);
  assertEquals(remainderDraws(world), []);
  assertEquals(world.firms.shop.deposits.a, 400);
  assertEquals(world.people.ben.deposits.a, 0);
});

Deno.test("a draw the gate refuses is not an effect the caller can commit", () => {
  const world = purseSeed();
  const gated = drawGate(world, "shop", "ben", 10);
  assertEquals(gated.ok, false);
  const stranger = drawGate(world, "shop", "ada", 0);
  assertEquals(stranger.ok, false);
});
