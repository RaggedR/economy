// staple_test.ts — the committed fill is rationed in both logs, including zero.
// The plan is fixed before the first leaf runs.

import { assertEquals } from "jsr:@std/assert@1";
import { fixedClock, seededIds } from "../log/ids.ts";
import { fileJournal } from "../log/journal.ts";
import { reconcile } from "../log/reconcile.ts";
import { postGoodGate } from "../world/gates.ts";
import { marketSeed } from "../world/seed.ts";
import { loadWorld, saveWorld } from "../world/store.ts";
import { assertInvariant, instrumentSums } from "../world/world.ts";
import { commitEngine } from "../cli/econ.ts";
import { openRig } from "./rig.ts";
import { runStaple } from "./staple.ts";

function postOne(dir: ReturnType<typeof openRig>, qty: number, inventory: number): void {
  const world = loadWorld(dir.worldPath);
  world.firms.shop.inventory = { staple: inventory };
  saveWorld(dir.worldPath, world);
  const gate = postGoodGate(world, "shop", 10, qty);
  if (!gate.ok) throw new Error(gate.reason);
  commitEngine(
    { world: dir.worldPath, journal: dir.journalPath },
    gate.effect,
    dir.ids,
    dir.clock,
  );
}

Deno.test("a full fill is ok and a zero fill is rationed, both with a journal line", async () => {
  const dir = Deno.makeTempDirSync({ prefix: "econ-staple-" });
  const ctx = openRig(dir, marketSeed(), seededIds("staple"), fixedClock());
  postOne(ctx, 1, 1);
  const acts = await runStaple(ctx, [
    { buyer: "ada", qty: 1, reason: "ada buys staple" },
    { buyer: "cleo", qty: 1, reason: "cleo buys staple" },
  ]);
  assertEquals(acts[0].tag, "done");
  assertEquals(acts[1].tag, "rationed");
  if (acts[1].tag !== "rationed") return;
  assertEquals(acts[1].filled, 0);

  const journal = fileJournal(ctx.journalPath).all();
  assertEquals(journal.map((e) => e.effect), ["post", "fill", "fill"]);
  assertEquals(journal[0].source, "engine");
  assertEquals(journal[1].source, "agent");
  assertEquals(
    journal[1].correlationId,
    acts[0].tag === "done" ? acts[0].correlationId : "",
  );
  assertEquals(journal[2].correlationId, acts[1].correlationId);

  const cleo = ctx.intentLog.all().filter((r) => r.agent === "household:cleo");
  assertEquals(cleo.map((r) => r.status), ["attempted", "rationed"]);
  assertEquals(cleo[0].callId, cleo[1].callId);
  const ada = ctx.intentLog.all().filter((r) => r.agent === "household:ada");
  assertEquals(ada.map((r) => r.status), ["attempted", "ok"]);

  const world = loadWorld(ctx.worldPath);
  assertEquals(world.people.ada.deposits.a, 40);
  assertEquals(world.people.cleo.deposits.a, 0);
  assertEquals(world.people.cleo.starvation, 1);
  assertEquals(world.people.ada.starvation, 0);
  assertEquals(world.people.ben.starvation, 0);
  assertEquals(world.listings[0].qty, 0);
  assertEquals(world.month, 0);
  assertEquals(world.interbank, 0);
  for (const [name, sum] of Object.entries(instrumentSums(world))) {
    assertEquals(sum, 0, name);
  }
  assertInvariant(world);
  assertEquals(reconcile(fileJournal(ctx.journalPath), ctx.intentLog).ok, true);
});

Deno.test("the second buyer keeps the unit the plan gave them", async () => {
  const dir = Deno.makeTempDirSync({ prefix: "econ-split-" });
  const ctx = openRig(dir, marketSeed(), seededIds("staple"), fixedClock());
  postOne(ctx, 2, 2);
  const acts = await runStaple(ctx, [
    { buyer: "ada", qty: 2, reason: "ada buys staple" },
    { buyer: "ben", qty: 2, reason: "ben buys staple" },
  ]);
  assertEquals(acts[0].tag, "rationed");
  assertEquals(acts[1].tag, "rationed");
  if (acts[0].tag !== "rationed" || acts[1].tag !== "rationed") return;
  assertEquals(acts[0].filled, 1);
  assertEquals(acts[1].filled, 1);
  const world = loadWorld(ctx.worldPath);
  assertEquals(world.people.ada.deposits.a, 40);
  assertEquals(world.people.ben.deposits.a, 40);
  assertEquals(world.firms.shop.deposits.a, 20);
  assertEquals(world.listings[0].qty, 0);
  const journal = fileJournal(ctx.journalPath).all().filter((e) => e.effect === "fill");
  assertEquals(journal.length, 2);
  assertEquals(reconcile(fileJournal(ctx.journalPath), ctx.intentLog).alarms, []);
});

Deno.test("three foodless months and a house, and nothing else, is death", async () => {
  const dir = Deno.makeTempDirSync({ prefix: "econ-death-" });
  const seed = marketSeed();
  seed.people.cleo.starvation = 2;
  seed.houses = {
    "h-cleo": { id: "h-cleo", units: 10, owner: "cleo", occupant: "cleo", lien: null },
  };
  seed.people.cleo.dwelling = "h-cleo";
  const ctx = openRig(dir, seed, seededIds("staple"), fixedClock());
  postOne(ctx, 1, 1);
  await runStaple(ctx, [{ buyer: "cleo", qty: 1, reason: "cleo buys staple" }]);
  const world = loadWorld(ctx.worldPath);
  assertEquals(world.people.cleo.alive, false);
  assertEquals(world.people.cleo.starvation, 3);
  assertEquals(world.people.cleo.dwelling, null);
  assertEquals(world.people.cleo.deposits.a + world.people.cleo.deposits.b, 0);
  // Ada and Ben are both homeless. Seed 1's first draw picks Ben.
  assertEquals(world.houses["h-cleo"].owner, "ben");
  assertEquals(world.houses["h-cleo"].occupant, "ben");
  assertEquals(world.people.ben.dwelling, "h-cleo");
  assertEquals(world.people.ada.dwelling, null);
  assertEquals(world.listings[0].qty, 1);
  assertEquals(world.firms.shop.inventory.staple, 1);
  const journal = fileJournal(ctx.journalPath).all();
  assertEquals(journal.map((e) => e.effect), ["post", "fill", "grantHouse", "death"]);
  assertEquals(journal[2].source, "engine");
  assertEquals(journal[3].source, "engine");
  assertInvariant(world);
  const intent = ctx.intentLog.all().filter((r) =>
    r.correlationId === journal[2].correlationId ||
    r.correlationId === journal[3].correlationId
  );
  assertEquals(intent, []);
});
