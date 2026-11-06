// ignition_test.ts — the town's purse, its prices, and one year of food.
// Savings are a year of staple. Each firm holds a year of wages as working
// capital. Each supermarket also holds one oven's maintenance, and bakes. The
// post then follows last month's listing.

import { assertEquals } from "jsr:@std/assert@1";
import { runIgnition } from "./ignition.ts";
import { openRig } from "./rig.ts";
import { fixedClock, seededIds } from "../log/ids.ts";
import { params } from "../world/params.ts";
import { townSeed } from "../world/seed.ts";
import { loadWorld } from "../world/store.ts";
import { goodOf } from "../world/types.ts";
import { assertInvariant, instrumentSums } from "../world/world.ts";

Deno.test("t₀ gives every person a year of staple and posts the price vector", () => {
  assertEquals(params.startingSavings, 12 * params.stapleReservePrice);
  assertEquals(params.cashGift, 12 * params.stapleReservePrice);
  assertEquals(params.firmFloat, params.firmReserveMonths * params.townWage);
  const world = townSeed();
  assertInvariant(world);
  for (const person of Object.values(world.people)) {
    assertEquals(person.deposits.a, params.startingSavings);
    assertEquals(person.deposits.b, 0);
    assertEquals(person.job?.salary, params.townWage);
  }
  for (const firm of Object.values(world.firms)) {
    const till = firm.kind === "supermarket"
      ? params.firmFloat + params.maintenance
      : params.firmFloat;
    assertEquals(firm.deposits.a, till, firm.id);
    assertEquals(firm.deposits.b, 0, firm.id);
  }
  for (const id of ["shop-1", "shop-2"]) {
    assertEquals(world.firms[id].machines, [`m-${id}`]);
    const machine = world.machines[`m-${id}`];
    assertEquals(machine.type, "retail");
    assertEquals(machine.generation, 0);
    assertEquals(machine.owner, id);
    assertEquals(machine.builder, "tech-1");
  }
  const staple = world.listings.filter((listing) => goodOf(listing.payload) === "staple");
  assertEquals(staple.length, 0);
  assertEquals(
    world.listings.find((listing) => listing.id === "tuition-priv-uni")?.price,
    params.tuitionPrice,
  );
  assertEquals(
    world.listings.find((listing) => listing.id === "cure-priv-hosp")?.price,
    params.curePrice,
  );
  const rent = world.listings.filter((listing) => listing.kind === "rent");
  assertEquals(rent.length, 0);
});

Deno.test("both shops keep posting 5 while either has bread left", async () => {
  const dir = Deno.makeTempDirSync({ prefix: "econ-ignite-" });
  const ctx = openRig(dir, townSeed(), seededIds("economy-ignition"), fixedClock());
  const lines = await runIgnition(ctx, 12);
  const cashMin = [63, 66, 69, 72, 75, 78, 81, 84, 87, 90, 93, 96];
  const cashMax = [105, 140, 150, 160, 195, 205, 240, 250, 285, 295, 330, 340];
  // Working capital keeps every firm solvent through the year, so nobody folds,
  // every worker is paid, and the household sector gains what the firms pay out
  // of their year-of-wages float (household + firm cash stay a constant 2360).
  const householdCash = [
    1016,
    1112,
    1208,
    1304,
    1400,
    1496,
    1592,
    1688,
    1784,
    1880,
    1976,
    2072,
  ];
  const firmCash = [1344, 1248, 1152, 1056, 960, 864, 768, 672, 576, 480, 384, 288];
  for (let i = 0; i < 12; i++) {
    const line = lines[i];
    assertEquals(line.month, i);
    assertEquals(line.alive, 15);
    assertEquals(line.fed, 15);
    assertEquals(line.dead, 0);
    assertEquals(line.folded, 0);
    assertEquals(line.stapleLeft, 5 * (i + 1));
    assertEquals(line.householdCash, householdCash[i]);
    assertEquals(line.firmCash, firmCash[i]);
    assertEquals(line.cashMin, cashMin[i]);
    assertEquals(line.cashMax, cashMax[i]);
  }
  const world = loadWorld(ctx.worldPath);
  assertEquals(world.month, 12);
  for (const person of Object.values(world.people)) {
    assertEquals(person.alive, true);
    assertEquals(person.starvation, 0);
  }
  for (const listing of world.listings) {
    if (goodOf(listing.payload) !== "staple") continue;
    assertEquals(listing.price, params.stapleReservePrice);
  }
  assertEquals(world.firms["shop-1"].folded, false);
  assertEquals(world.firms["shop-2"].folded, false);
  assertEquals(world.firms["tech-1"].folded, false);
  assertInvariant(world);
  for (const [name, sum] of Object.entries(instrumentSums(world))) {
    assertEquals(sum, 0, name);
  }
});
