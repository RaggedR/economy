// invest_test.ts — the restricted invest day, end to end through the real
// gates. A sold-out club buys a machine from a tech firm (money moves) and
// hires idle townsfolk to run it; with no sellouts on record, nothing happens.
//
// Default params throughout: the test never mutates the shared knobs the frozen
// fixtures ride, so it cannot perturb the milestone suite. The sellout history
// is injected directly onto the tracker, which is exactly the signal the live
// loop accumulates over a year.

import { assertEquals } from "jsr:@std/assert@1";
import { openRig } from "./rig.ts";
import { runIgnition } from "./ignition.ts";
import { newInvestTracker, runInvestDay } from "./invest.ts";
import { fixedClock, seededIds } from "../log/ids.ts";
import { metropolisSeed } from "../world/metropolis.ts";
import { loadWorld } from "../world/store.ts";
import { params } from "../world/params.ts";

function openMetro(dir: string) {
  return openRig(dir, metropolisSeed(), seededIds("invest-test"), fixedClock());
}

const firmCash = (w: ReturnType<typeof loadWorld>, id: string) =>
  w.firms[id].deposits.a + w.firms[id].deposits.b;
const idleCount = (w: ReturnType<typeof loadWorld>) =>
  Object.values(w.people).filter((p) => p.alive && !p.job).length;
const hospAt = (w: ReturnType<typeof loadWorld>, firm: string) =>
  Object.values(w.people).filter((p) =>
    p.alive && p.job?.firm === firm && p.job.career === "hospitality"
  ).length;

Deno.test("invest day: a sold-out club buys a machine and hires a crew", async () => {
  const ctx = openMetro("demo-out/invest-test");
  // one spend month so the clubs post a nightclub shelf (a price to read)
  await runIgnition(ctx, 1, { spend: true });

  const before = loadWorld(ctx.worldPath);
  const club = Object.keys(before.firms)
    .filter((id) => before.firms[id].kind === "nightclub").sort()[0];
  const vendor = Object.keys(before.firms)
    .filter((id) => before.firms[id].kind === "tech").sort()[0];
  const machinesBefore = before.firms[club].machines.length;
  const hospBefore = hospAt(before, club);
  const vendorCashBefore = firmCash(before, vendor);
  const idleBefore = idleCount(before);

  // put just this one club over the sellout trigger; the rest stay empty
  const tracker = newInvestTracker();
  tracker.history[club] = Array.from({ length: params.investWindow }, () => 1);

  const tally = runInvestDay(ctx, tracker);
  assertEquals(tally, { bought: 1, hired: 2 }); // ops("hospitality",0) === 2

  const after = loadWorld(ctx.worldPath);
  // the machine was minted onto the club, of the right type and generation
  assertEquals(after.firms[club].machines.length, machinesBefore + 1);
  const newId = after.firms[club].machines.find((m) =>
    !before.firms[club].machines.includes(m)
  )!;
  assertEquals(after.machines[newId].type, "hospitality");
  assertEquals(after.machines[newId].generation, 0);
  assertEquals(after.machines[newId].owner, club);
  assertEquals(after.machines[newId].builder, vendor); // bought, not indigenous
  // money moved club → vendor, exactly the machine price
  assertEquals(firmCash(after, vendor), vendorCashBefore + params.machinePrice);
  // two idle people became hospitality crew at the club
  assertEquals(hospAt(after, club), hospBefore + 2);
  assertEquals(idleCount(after), idleBefore - 2);
});

Deno.test("invest day: supermarket and luxury shop invest too, on one retail machine", async () => {
  const ctx = openMetro("demo-out/invest-test-retail");
  await runIgnition(ctx, 1, { spend: true });

  const before = loadWorld(ctx.worldPath);
  const shop = Object.keys(before.firms)
    .filter((id) => before.firms[id].kind === "supermarket").sort()[0];
  const lux = Object.keys(before.firms)
    .filter((id) => before.firms[id].kind === "luxury").sort()[0];
  const vendor = Object.keys(before.firms)
    .filter((id) => before.firms[id].kind === "tech").sort()[0];
  const vendorCashBefore = firmCash(before, vendor);
  const idleBefore = idleCount(before);
  const machinesShop = before.firms[shop].machines.length;
  const machinesLux = before.firms[lux].machines.length;

  const tracker = newInvestTracker();
  tracker.history[shop] = Array.from({ length: params.investWindow }, () => 1);
  tracker.history[lux] = Array.from({ length: params.investWindow }, () => 1);

  const tally = runInvestDay(ctx, tracker);
  assertEquals(tally, { bought: 2, hired: 4 }); // two retail machines, 2 ops each

  const after = loadWorld(ctx.worldPath);
  // both firms took a RETAIL machine (staple and luxury share the career)
  assertEquals(after.firms[shop].machines.length, machinesShop + 1);
  assertEquals(after.firms[lux].machines.length, machinesLux + 1);
  const shopNew = after.firms[shop].machines.find((m) => !before.firms[shop].machines.includes(m))!;
  const luxNew = after.firms[lux].machines.find((m) => !before.firms[lux].machines.includes(m))!;
  assertEquals(after.machines[shopNew].type, "retail");
  assertEquals(after.machines[luxNew].type, "retail");
  // the vendor was paid for both machines; four idle people became retail crew
  assertEquals(firmCash(after, vendor), vendorCashBefore + 2 * params.machinePrice);
  assertEquals(idleCount(after), idleBefore - 4);
});

Deno.test("invest day: no sellouts on record, nothing happens", async () => {
  const ctx = openMetro("demo-out/invest-test-quiet");
  await runIgnition(ctx, 1, { spend: true });
  const before = loadWorld(ctx.worldPath);
  const machinesBefore = Object.values(before.machines).length;

  const tally = runInvestDay(ctx, newInvestTracker()); // empty history
  assertEquals(tally, { bought: 0, hired: 0 });
  assertEquals(Object.values(loadWorld(ctx.worldPath).machines).length, machinesBefore);
});
