// special_test.ts — the special day commits what the plan handed each leaf.
// A month that is not a multiple of 12 does not open the day.

import { assertEquals } from "jsr:@std/assert@1";
import { fixedClock, seededIds } from "../log/ids.ts";
import { fileJournal } from "../log/journal.ts";
import { reconcile } from "../log/reconcile.ts";
import { specialSeed } from "../world/seed.ts";
import { loadWorld } from "../world/store.ts";
import { assertInvariant } from "../world/world.ts";
import { openRig } from "./rig.ts";
import { runSpecialDay, specialSceneOrders } from "./special.ts";

Deno.test("the scripted special day pays the dividend, draws the house, and evicts", async () => {
  const dir = Deno.makeTempDirSync({ prefix: "econ-special-" });
  const ctx = openRig(dir, specialSeed(), seededIds("special"), fixedClock());
  await runSpecialDay(ctx, specialSceneOrders());

  const world = loadWorld(ctx.worldPath);
  assertEquals(world.month, 0);
  assertEquals(world.rng, { seed: 1, stream: 2 });
  assertEquals(world.interbank, 0);
  assertEquals(world.people.ada.deposits, { a: 30, b: 0 });
  assertEquals(world.people.ben.deposits, { a: 40, b: 0 });
  assertEquals(world.people.cleo.deposits, { a: 30, b: 40 });
  assertEquals(world.firms.shop.deposits, { a: 0, b: 10 });
  assertEquals(world.firms.mill.deposits, { a: 0, b: 10 });
  assertEquals(world.banks.a.equity, 0);
  assertEquals(world.banks.a.depositLiability, -100);
  assertEquals(world.banks.a.loansOutstanding, 100);
  assertEquals(world.banks.a.sharesOutstanding, 2);
  assertEquals(world.banks.b.equity, -60);
  assertEquals(world.banks.b.depositLiability, -60);

  const units = (holder: string) =>
    Object.values(world.shares).filter((share) => share.holder === holder)
      .reduce((n, share) => n + share.units, 0);
  assertEquals(units("ada"), 1);
  assertEquals(units("ben"), 1);

  assertEquals(world.houses["h-cleo"].owner, "ben");
  assertEquals(world.houses["h-cleo"].occupant, "ben");
  assertEquals(world.houses["h-ada"].owner, "ada");
  assertEquals(world.houses["h-ada"].occupant, "ada");
  assertEquals(world.houses["h-ben"].owner, "ben");
  assertEquals(world.houses["h-ben"].occupant, null);
  assertEquals(world.houses["h-ben"].lien, "L");

  assertEquals(world.people.ben.job, { firm: "shop", career: "retail", salary: 8 });
  assertEquals(world.people.cleo.job, null);
  assertEquals(world.people.ben.dwelling, "h-cleo");
  assertEquals(world.people.ada.dwelling, "h-ada");
  assertEquals(world.people.ada.health, 1);
  assertEquals(world.people.cleo.dwelling, null);
  assertEquals(world.people.cleo.health, 0);
  assertEquals(world.people.ben.health, 0);

  const machine = Object.values(world.machines);
  assertEquals(machine.length, 1);
  assertEquals(machine[0].generation, 2);
  assertEquals(machine[0].type, "engineer");
  assertEquals(machine[0].owner, "shop");
  assertEquals(machine[0].builder, "mill");
  assertEquals(world.firms.shop.machines, [machine[0].id]);

  assertEquals(world.jobArchive, {
    year: 0,
    listings: [{ career: "retail", generation: 0, salary: 20, slots: 1 }],
  });
  assertEquals(world.listings.map((listing) => [listing.kind, listing.qty]), [
    ["share", 0],
    ["houseSale", 0],
    ["job", 0],
    ["machine", 0],
    ["rent", 1],
  ]);

  const journal = fileJournal(ctx.journalPath).all();
  assertEquals(journal.map((entry) => `${entry.source} ${entry.effect}`), [
    "agent post",
    "agent tradeShare",
    "engine dividend",
    "agent post",
    "agent transferHouse",
    "agent transferHouse",
    "agent occupy",
    "agent occupy",
    "agent post",
    "agent post",
    "agent hire",
    "agent hire",
    "engine archiveJobs",
    "agent deliverMachine",
    "agent post",
    "engine vacate",
    "engine pinHealth",
  ]);
  const outcomes = ctx.intentLog.all().filter((row) => row.status !== "attempted");
  assertEquals(outcomes.map((row) => `${row.agent} ${row.status}`), [
    "household:ada ok",
    "household:ben ok",
    "household:cleo ok",
    "household:ada rationed",
    "household:ben ok",
    "household:ada ok",
    "household:ben ok",
    "firm:shop ok",
    "firm:mill ok",
    "household:ben ok",
    "household:cleo rationed",
    "firm:shop ok",
    "household:ben ok",
    "household:cleo refused",
    "household:ada refused",
  ]);
  assertEquals(reconcile(fileJournal(ctx.journalPath), ctx.intentLog).ok, true);
  assertInvariant(world);
});

Deno.test("an empty special day still pays the dividend and pins the undwelled", async () => {
  const dir = Deno.makeTempDirSync({ prefix: "econ-special-quiet-" });
  const ctx = openRig(dir, specialSeed(), seededIds("special-quiet"), fixedClock());
  await runSpecialDay(ctx, {});
  const world = loadWorld(ctx.worldPath);
  assertEquals(world.people.ada.deposits.a, 40);
  assertEquals(world.people.ben.deposits.a, 60);
  assertEquals(world.banks.a.equity, 0);
  assertEquals(world.people.ben.health, 0);
  assertEquals(world.people.ben.dwelling, null);
  assertEquals(world.people.cleo.health, 5);
  assertEquals(world.rng.stream, 0);
  const journal = fileJournal(ctx.journalPath).all();
  assertEquals(journal.map((entry) => `${entry.source} ${entry.effect}`), [
    "engine dividend",
    "engine pinHealth",
  ]);
  assertEquals(ctx.intentLog.all(), []);
  assertEquals(reconcile(fileJournal(ctx.journalPath), ctx.intentLog).ok, true);
  assertInvariant(world);
});

Deno.test("a month that is not a multiple of 12 ignores special-day orders", async () => {
  const dir = Deno.makeTempDirSync({ prefix: "econ-special-off-" });
  const seed = specialSeed();
  seed.month = 1;
  const ctx = openRig(dir, seed, seededIds("special-off"), fixedClock());
  const before = Deno.readTextFileSync(ctx.worldPath);
  await runSpecialDay(ctx, specialSceneOrders());
  assertEquals(Deno.readTextFileSync(ctx.worldPath), before);
  assertEquals(fileJournal(ctx.journalPath).all(), []);
  assertEquals(ctx.intentLog.all(), []);
});
