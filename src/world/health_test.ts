// health_test.ts — the draw names the disease. The lottery serves homeless
// first. A cure clears that disease and does not raise health.

import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import { assignGate, buyCureGate, cureGate, diseaseGate } from "./gates.ts";
import { drawDiseases, planDiscretionary, planLottery } from "./health.ts";
import { healthSeed, monthSeed } from "./seed.ts";
import type { World } from "./types.ts";
import { applyEffect, assertInvariant } from "./world.ts";

function staff(): World {
  const world = healthSeed();
  world.rng = { seed: 1, stream: 0 };
  world.people.ada.diseases = ["d0"];
  world.people.ada.dwelling = null;
  world.people.ben.diseases = ["d0"];
  world.people.ben.dwelling = null;
  world.people.cleo.diseases = ["d0"];
  world.people.doc.assignment = "d0";
  return world;
}

Deno.test("seed 8 strikes ben with d2 and misses the rest", () => {
  const plan = drawDiseases(healthSeed());
  assertEquals(plan.strikes, [{ person: "ben", disease: "d2" }]);
  assertEquals(plan.world.rng, { seed: 8, stream: 6 });
  assertEquals(plan.world.people.ben.diseases, []);
});

Deno.test("monthSeed's draw misses both people", () => {
  const plan = drawDiseases(monthSeed());
  assertEquals(plan.strikes, []);
  assertEquals(plan.world.rng, { seed: 1, stream: 2 });
});

Deno.test("a disease already held is not a second pin", () => {
  const world = healthSeed();
  world.people.ben.diseases = ["d2"];
  const plan = drawDiseases(world);
  assertEquals(plan.strikes, []);
  assertEquals(plan.world.rng.stream, 6);
  const gate = diseaseGate(world, "ben", "d2");
  assertEquals(gate.ok, false);
});

Deno.test("the disease pin records the identity and sets health to zero", () => {
  let world = healthSeed();
  const gate = diseaseGate(world, "ben", "d2");
  if (!gate.ok) throw new Error(gate.reason);
  world = applyEffect(world, gate.effect);
  assertEquals(world.people.ben.diseases, ["d2"]);
  assertEquals(world.people.ben.health, 0);
  assertEquals(gate.effect.tag, "pinHealth");
  assertInvariant(world);
});

Deno.test("seed 1 gives the one public cure to ben, and the owner does not draw", () => {
  const world = staff();
  const plan = planLottery(
    world,
    [
      { person: "ada", disease: "d0" },
      { person: "ben", disease: "d0" },
      { person: "cleo", disease: "d0" },
    ],
    [],
  );
  assertEquals(plan.cures.map((row) => [row.person, row.granted]), [
    ["ada", false],
    ["ben", true],
    ["cleo", false],
  ]);
  assertEquals(plan.world.rng, { seed: 1, stream: 2 });
});

Deno.test("a disease the government does not staff is not drawn", () => {
  const world = healthSeed();
  world.people.cleo.diseases = ["d0"];
  const before = world.rng;
  const plan = planLottery(world, [{ person: "cleo", disease: "d0" }], []);
  assertEquals(plan.cures[0].granted, false);
  assertEquals(plan.world.rng, before);
});

Deno.test("one assigned teacher levels the only bidder, and a cure adds no health", () => {
  const world = healthSeed();
  world.people.teach.assignment = "engineer";
  world.people.ben.diseases = ["d2"];
  world.people.ben.health = 0;
  world.people.doc.assignment = "d2";
  const plan = planLottery(
    world,
    [{ person: "ben", disease: "d2" }],
    [{ person: "ada", career: "engineer" }],
  );
  assertEquals(plan.cures[0].granted, true);
  assertEquals(plan.education[0].granted, true);
  assertEquals(plan.world.rng.stream, world.rng.stream);

  let next = world;
  const cure = cureGate(next, "ben", "d2", true);
  if (!cure.ok) throw new Error(cure.reason);
  next = applyEffect(next, cure.effect);
  assertEquals(next.people.ben.diseases, []);
  assertEquals(next.people.ben.health, 0);

  const lost = cureGate(next, "cleo", "d0", false);
  if (!lost.ok) throw new Error(lost.reason);
  const stayed = applyEffect(next, lost.effect);
  assertEquals(stayed.people.cleo.diseases, ["d0"]);
  assertEquals(stayed.people.cleo.health, 0);
});

Deno.test("a retail worker cannot be pointed at a disease", () => {
  const world = healthSeed();
  world.people.ada.job = { firm: "priv-hosp", career: "retail", salary: 1 };
  const gate = assignGate(world, "ada", "d0");
  assertEquals(gate.ok, false);
});

Deno.test("a private doctor is not a public award", () => {
  const world = healthSeed();
  world.people.doc.job = { firm: "priv-hosp", career: "doctor", salary: 1 };
  world.people.doc.assignment = "d2";
  world.people.ben.diseases = ["d2"];
  const plan = planLottery(world, [{ person: "ben", disease: "d2" }], []);
  assertEquals(plan.cures[0].granted, false);
});

Deno.test("a private cure is refused when the purse is short and rationed when the bundle is", () => {
  const world = healthSeed();
  world.listings = [{
    id: "c-d0",
    seller: "priv-hosp",
    kind: "cure",
    price: 2,
    qty: 10,
    payload: { disease: "d0" },
  }];
  world.people.cleo.deposits = { a: 0, b: 0 };
  const broke = planDiscretionary(
    world,
    [{ person: "cleo", disease: "d0", provider: "priv-hosp" }],
    [],
  );
  assertEquals(broke.cures[0].refuse, true);

  world.people.cleo.deposits = { a: 80, b: 0 };
  world.listings[0].qty = 5;
  const short = planDiscretionary(
    world,
    [{ person: "cleo", disease: "d0", provider: "priv-hosp" }],
    [],
  );
  assertEquals(short.cures[0], {
    person: "cleo",
    listing: "c-d0",
    qty: 0,
    refuse: false,
  });
  const gate = buyCureGate(world, "cleo", "d0", "c-d0", 0);
  assertEquals(gate.ok, true);
});

Deno.test("duplicate cure bids are rejected", () => {
  const world = healthSeed();
  assertThrows(() =>
    planLottery(
      world,
      [
        { person: "cleo", disease: "d0" },
        { person: "cleo", disease: "d0" },
      ],
      [],
    )
  );
});

Deno.test("paying the private bundle clears the disease and keeps the row at zero", () => {
  let world = healthSeed();
  world.listings = [{
    id: "c-d0",
    seller: "priv-hosp",
    kind: "cure",
    price: 2,
    qty: 10,
    payload: { disease: "d0" },
  }];
  const gate = buyCureGate(world, "cleo", "d0", "c-d0", 10);
  if (!gate.ok) throw new Error(gate.reason);
  world = applyEffect(world, gate.effect);
  assertEquals(world.people.cleo.diseases, []);
  assertEquals(world.people.cleo.health, 0);
  assertEquals(world.people.cleo.deposits.a, 60);
  assertEquals(world.firms["priv-hosp"].deposits.a, 20);
  assertEquals(world.listings[0].qty, 0);
  assertInvariant(world);
});
