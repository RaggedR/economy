// sellore_test.ts — the direct raw-material sale, in isolation. A tech firm buys
// ore from an indigenous mine: the money reaches the owner (a positive "ore"
// flow — income), the mine's stock falls, and the books stay lawful. The gate
// refuses a bank-held mine, an over-draw, a self-purchase, and an unfunded buyer.

import { assert, assertEquals } from "jsr:@std/assert@1";
import { metropolisSeed } from "./metropolis.ts";
import { sellOreGate } from "./gates.ts";
import { applyEffect, assertInvariant } from "./world.ts";
import type { World } from "./types.ts";

const cash = (w: World, id: string) =>
  (w.people[id]?.deposits.a ?? w.firms[id]?.deposits.a ?? 0) +
  (w.people[id]?.deposits.b ?? w.firms[id]?.deposits.b ?? 0);

/** metropolisSeed with a common-ore mine of `stock` placed on `owner`. */
function withMine(owner: string, stock = 100): World {
  const w = metropolisSeed();
  const world = {
    ...w,
    mines: {
      ...w.mines,
      "m-test": { id: "m-test", material: "common" as const, stock, owner, depositedAt: null, lien: null },
    },
  };
  assertInvariant(world);
  return world;
}

/** A person (indigenous owner) and a tech firm (the buyer with cash). */
function cast(w: World): { owner: string; tech: string } {
  const owner = Object.keys(w.people).sort()[0];
  const tech = Object.keys(w.firms).filter((id) => w.firms[id].kind === "tech").sort()[0];
  return { owner, tech };
}

Deno.test("a tech firm buys ore: money to the owner, stock down, books lawful", () => {
  const w0 = withMine("p0", 100);
  const { tech } = cast(w0);
  const ownerBefore = cash(w0, "p0");
  const techBefore = cash(w0, tech);

  const gate = sellOreGate(w0, "m-test", tech, 5, 10); // 5 units × 10 = 50
  assert(gate.ok, gate.ok ? "" : gate.reason);
  const w1 = applyEffect(w0, gate.effect);
  assertInvariant(w1); // nfa/instrument sums still balance

  assertEquals(cash(w1, "p0"), ownerBefore + 50); // the indigenous income
  assertEquals(cash(w1, tech), techBefore - 50);
  assertEquals(w1.mines["m-test"].stock, 95);
  // the owner's "ore" flow is positive — it reads as revenue
  const oreIn = w1.flows.filter((l) => l.holder === "p0" && l.row === "ore").reduce((s, l) => s + l.amount, 0);
  assertEquals(oreIn, 50);
});

Deno.test("the gate refuses a bank-held, over-drawn, self-bought, or unfunded sale", () => {
  const w = withMine("p0", 4);
  const { tech } = cast(w);
  // over-draw: 5 > stock 4
  assert(!sellOreGate(w, "m-test", tech, 5, 10).ok);
  // self-purchase: owner cannot buy its own ore
  assert(!sellOreGate(w, "m-test", "p0", 1, 10).ok);
  // deposited mine is not for private sale
  const deposited = { ...w, mines: { ...w.mines, "m-test": { ...w.mines["m-test"], depositedAt: "a" as const } } };
  assert(!sellOreGate(deposited, "m-test", tech, 1, 10).ok);
  // unfunded buyer: a non-owner cannot fund a lot priced beyond any purse
  const other = Object.keys(w.people).filter((id) => id !== "p0").sort()[0];
  assert(!sellOreGate(w, "m-test", other, 4, 1_000_000_000).ok);
});
