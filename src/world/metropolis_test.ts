// metropolis_test.ts — the 5× town is additive and lawful: it balances, it is
// built to a known census, every producing firm actually produces, it is
// deterministic, and a month of the living loop runs over it without a leak.

import { assertEquals } from "jsr:@std/assert@1";
import { metropolisSeed } from "./metropolis.ts";
import { townCensus } from "./seed.ts";
import { assertInvariant } from "./world.ts";
import { firmOutput, tuitionOutput } from "./tech.ts";
import { runIgnition } from "../bridge/ignition.ts";
import { openRig } from "../bridge/rig.ts";
import { fixedClock, seededIds } from "../log/ids.ts";

Deno.test("metropolis balances", () => {
  // assertInvariant throws on any accounting leak; a clean build is the test.
  assertInvariant(metropolisSeed());
});

Deno.test("metropolis census: 75 people, 40 firms, all housed", () => {
  const census = townCensus(metropolisSeed());
  assertEquals(census.people, 75);
  assertEquals(census.firms, 40);
  assertEquals(census.housed, 75);
});

Deno.test("every producing firm makes its good at t₀", () => {
  const world = metropolisSeed();
  let shelves = 0;
  let unis = 0;
  for (const id of Object.keys(world.firms)) {
    const kind = world.firms[id].kind;
    if (kind === "supermarket" || kind === "luxury" || kind === "nightclub") {
      const out = firmOutput(world, id);
      if (!out || out.qty <= 0) throw new Error(`${id} (${kind}) makes nothing`);
      shelves += 1;
    } else if (kind === "privateUniversity") {
      if (tuitionOutput(world, id) <= 0) throw new Error(`${id} trains nobody`);
      unis += 1;
    }
  }
  assertEquals(shelves, 7 + 6 + 8); // shops + luxury + clubs
  assertEquals(unis, 4);
});

Deno.test("metropolis is deterministic", () => {
  assertEquals(
    JSON.stringify(metropolisSeed()),
    JSON.stringify(metropolisSeed()),
  );
});

Deno.test("a month of the living loop runs over the metropolis", async () => {
  const ctx = openRig(
    "demo-out/metropolis-test",
    metropolisSeed(),
    seededIds("economy-metropolis-test"),
    fixedClock(),
  );
  const lines = await runIgnition(ctx, 1, { spend: true });
  assertEquals(lines.length, 1);
  assertEquals(lines[0].alive, 75); // nobody starves in a single month
});
