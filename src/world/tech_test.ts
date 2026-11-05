// tech_test.ts — the plan does not mint a generation. ops falls. output does
// not. Public supply is the machines, not the headcount.

import { assertEquals } from "jsr:@std/assert@1";
import { deliverMachineGate, strategyGate } from "./gates.ts";
import { healthSeed, techSeed } from "./seed.ts";
import { awardSupply, currentLine, ops, output } from "./tech.ts";
import type { Career, Effect, Listing, World } from "./types.ts";
import { CAREERS } from "./types.ts";
import { applyEffect, assertInvariant } from "./world.ts";

function postsOf(effect: Effect): Listing[] {
  if (effect.tag !== "strategy") throw new Error(effect.tag);
  return effect.posts;
}

function generationOf(world: World, listingId: string): number | null {
  const listing = world.listings.find((row) => row.id === listingId);
  const payload = listing?.payload;
  if (!payload || !("generation" in payload)) return null;
  return payload.generation;
}

Deno.test("ops falls in g and output does not", () => {
  for (const career of CAREERS) {
    assertEquals(ops(career, 2), ops(career, 1));
    assertEquals(output(career, 1) >= output(career, 0), true);
    assertEquals(output(career, 2), output(career, 1));
    if (career === "bureaucrat") {
      assertEquals(ops(career, 0), 1);
      assertEquals(ops(career, 1), 1);
    } else {
      assertEquals(ops(career, 0) > ops(career, 1), true);
    }
  }
  assertEquals(output("engineer", 1) > output("engineer", 0), true);
});

Deno.test("stay posts the current generation at the current volume", () => {
  const world = techSeed();
  world.firms.mill.salesLastMonth = 4;
  const gate = strategyGate(world, "mill", "stay");
  if (!gate.ok) throw new Error(gate.reason);
  const stay = postsOf(gate.effect);
  assertEquals(stay.length, 1);
  assertEquals(stay[0].kind, "machine");
  assertEquals(stay[0].qty, 4);
  const next = applyEffect(world, gate.effect);
  assertEquals(Object.keys(next.machines), ["m0"]);
  assertEquals(next.listings[0].kind, "machine");
  assertEquals(next.listings[0].qty, 4);
  assertEquals(generationOf(next, next.listings[0].id), 0);
  assertInvariant(next);
});

Deno.test("a firm with no sales posts the number it has delivered", () => {
  const world = techSeed();
  world.firms.mill.salesLastMonth = 0;
  assertEquals(currentLine(world, "mill"), { type: "retail", generation: 0, volume: 1 });
});

Deno.test("the current line is the highest generation delivered", () => {
  const world = techSeed();
  world.machines.m1 = {
    id: "m1",
    type: "engineer",
    generation: 1,
    owner: "shop",
    builder: "mill",
  };
  assertEquals(currentLine(world, "mill")?.generation, 1);
  assertEquals(currentLine(world, "mill")?.type, "engineer");

  delete world.machines.m1;
  world.machines.e0 = {
    id: "e0",
    type: "engineer",
    generation: 0,
    owner: "shop",
    builder: "mill",
  };
  assertEquals(currentLine(world, "mill")?.type, "retail");
});

Deno.test("expand lists engineer slots and does not mint a machine", () => {
  const world = techSeed();
  const gate = strategyGate(world, "mill", "expand");
  if (!gate.ok) throw new Error(gate.reason);
  const posted = postsOf(gate.effect);
  assertEquals(posted.map((post) => post.kind), ["job"]);
  const payload = posted[0].payload;
  if (!payload || !("slots" in payload)) throw new Error("not a job");
  assertEquals(payload.career, "engineer");
  assertEquals(payload.generation, 0);
  const next = applyEffect(world, gate.effect);
  assertEquals(Object.keys(next.machines), ["m0"]);
  assertEquals(next.listings.some((listing) => listing.kind === "machine"), false);
  assertInvariant(next);
});

Deno.test("upgrade offers the next generation and delivery is what mints it", () => {
  const world = techSeed();
  const gate = strategyGate(world, "mill", "upgrade");
  if (!gate.ok) throw new Error(gate.reason);
  assertEquals(postsOf(gate.effect).map((post) => post.kind), ["job", "machine"]);
  const offered = applyEffect(world, gate.effect);
  assertEquals(
    Object.values(offered.machines).map((machine) => machine.generation),
    [0],
  );
  const listing = offered.listings.find((row) => row.kind === "machine");
  if (!listing) throw new Error("no offer");
  assertEquals(generationOf(offered, listing.id), 1);
  const job = offered.listings.find((row) => row.kind === "job");
  assertEquals(job && generationOf(offered, job.id), 1);
  const buy = deliverMachineGate(offered, listing.id, "shop", 1);
  if (!buy.ok) throw new Error(buy.reason);
  const delivered = applyEffect(offered, buy.effect);
  const minted = Object.values(delivered.machines).filter((machine) =>
    machine.generation === 1
  );
  assertEquals(minted.length, 1);
  assertEquals(minted[0].owner, "shop");
  assertEquals(minted[0].builder, "mill");
  assertEquals(delivered.firms.shop.deposits.a, 15);
  assertEquals(delivered.firms.mill.deposits.a, 15);
  assertInvariant(delivered);
});

Deno.test("a shop and a firm that has built nothing are refused", () => {
  const world = techSeed();
  world.firms.mill.kind = "supermarket";
  const shop = strategyGate(world, "mill", "stay");
  assertEquals(shop.ok, false);

  const bare = techSeed();
  bare.machines = {};
  bare.firms.shop.machines = [];
  const none = strategyGate(bare, "mill", "upgrade");
  assertEquals(none.ok, false);
});

Deno.test("one public operator is one award, and a machine caps the rest", () => {
  const world = healthSeed();
  world.people.doc.assignment = "d2";
  assertEquals(awardSupply(world, "doctor", "d2"), 1);

  world.people.ada.job = { firm: "pub-hosp", career: "doctor", salary: 1 };
  world.people.ada.assignment = "d2";
  world.people.ben.job = { firm: "pub-hosp", career: "doctor", salary: 1 };
  world.people.ben.assignment = "d2";
  assertEquals(awardSupply(world, "doctor", "d2"), 2);
});

Deno.test("no machine, a fold, or an unstaffed admin machine is no award", () => {
  const world = healthSeed();
  world.people.doc.assignment = "d2";
  world.firms["pub-hosp"].machines = [];
  assertEquals(awardSupply(world, "doctor", "d2"), 0);

  const folded = healthSeed();
  folded.people.doc.assignment = "d2";
  folded.firms["pub-hosp"].folded = true;
  assertEquals(awardSupply(folded, "doctor", "d2"), 0);

  const admin = healthSeed();
  admin.people.doc.assignment = "d2";
  admin.machines["m-admin"] = {
    id: "m-admin",
    type: "bureaucrat",
    generation: 0,
    owner: "pub-hosp",
    builder: "mill",
  };
  admin.firms["pub-hosp"].machines = ["m-doc", "m-admin"];
  assertEquals(awardSupply(admin, "doctor", "d2"), 0);
  admin.people.cleo.job = { firm: "pub-hosp", career: "bureaucrat", salary: 1 };
  assertEquals(awardSupply(admin, "doctor", "d2"), 1);
});

Deno.test("output is the same number for every career at one generation", () => {
  const at0 = output("teacher" as Career, 0);
  const at1 = output("hospitality", 1);
  for (const career of CAREERS) {
    assertEquals(output(career, 0), at0);
    assertEquals(output(career, 1), at1);
  }
});
