// lend_test.ts — lending day, end to end through the real acceptDebt gate. A
// club that sold out but was drained below the machine floor is lifted back to
// it by a wealthy saver's private loan; the money moves saver → firm, and a
// private loan issued by the firm now exists. With every firm able to afford a
// machine from its own book, nothing is lent.
//
// Default params throughout, so the frozen fixtures are untouched. The cash is
// moved by a balanced transfer (firm ↓, a saver ↑ by the same amount at the
// same bank), so the banking invariant still holds.

import { assertEquals } from "jsr:@std/assert@1";
import { openRig } from "./rig.ts";
import { runIgnition } from "./ignition.ts";
import { newInvestTracker } from "./invest.ts";
import { runLending } from "./lend.ts";
import { fixedClock, seededIds } from "../log/ids.ts";
import { metropolisSeed } from "../world/metropolis.ts";
import { loadWorld, saveWorld } from "../world/store.ts";
import { disclosedRevenue } from "../world/policy.ts";
import { params } from "../world/params.ts";
import type { PrivateLoan, World } from "../world/types.ts";

function openMetro(dir: string) {
  return openRig(dir, metropolisSeed(), seededIds("lend-test"), fixedClock());
}
const firmCash = (w: World, id: string) => w.firms[id].deposits.a + w.firms[id].deposits.b;
const personCash = (w: World, id: string) => w.people[id].deposits.a + w.people[id].deposits.b;
const privateLoansTo = (w: World, firm: string): PrivateLoan[] =>
  Object.values(w.loans).filter((l): l is PrivateLoan =>
    l.kind === "private" && l.issuer === firm
  );

Deno.test("lending day: a saver funds a drained club back up to the machine floor", async () => {
  const ctx = openMetro("demo-out/lend-test");
  await runIgnition(ctx, 1, { spend: true }); // clubs post a shelf and earn revenue

  const w = loadWorld(ctx.worldPath);
  const wage = params.townWage * params.metroWageScale;
  const floor = params.machinePrice + 2 * wage; // one hospitality machine + first crew
  const want = Math.min(50, floor - 1);
  const target = floor - want; // where we park the club's cash: short of the floor

  // a club that actually earned nightclub revenue this month (so it is creditworthy)
  const club = Object.keys(w.firms)
    .filter((id) => w.firms[id].kind === "nightclub" && disclosedRevenue(w, id) > 0)
    .sort()[0];
  if (!club) throw new Error("no club earned revenue to lend against");

  // a rentier saver (owns a private hospital, not a shop) to hold the drained cash
  const saver = Object.keys(w.people)
    .filter((id) => {
      const owns = Object.values(w.firms).some((f) => f.owner === id);
      const ownsShop = Object.values(w.firms).some((f) =>
        f.owner === id && (f.kind === "nightclub" || f.kind === "supermarket" || f.kind === "luxury")
      );
      return owns && !ownsShop; // a rentier: owns a firm, none of them a shop
    })
    .sort()[0];
  if (!saver) throw new Error("no rentier to lend");

  // Balanced move: drain the club to `target`, park the difference with the saver.
  const diff = firmCash(w, club) - target;
  w.firms[club] = {
    ...w.firms[club],
    deposits: { ...w.firms[club].deposits, a: w.firms[club].deposits.a - diff },
  };
  w.people[saver] = {
    ...w.people[saver],
    deposits: { ...w.people[saver].deposits, a: w.people[saver].deposits.a + diff },
  };
  saveWorld(ctx.worldPath, w);

  const before = loadWorld(ctx.worldPath);
  assertEquals(firmCash(before, club), target);
  assertEquals(privateLoansTo(before, club).length, 0);
  const saverBefore = personCash(before, saver);

  // put the club over the sellout trigger; no other firm qualifies
  const tracker = newInvestTracker();
  tracker.history[club] = Array.from({ length: params.investWindow }, () => 1);

  const tally = await runLending(ctx, tracker);
  assertEquals(tally, { lent: 1, principal: want });

  const after = loadWorld(ctx.worldPath);
  // the club is funded exactly to the floor — ready for invest day
  assertEquals(firmCash(after, club), floor);
  // a private loan issued by the club now exists, held by some saver
  const loans = privateLoansTo(after, club);
  assertEquals(loans.length, 1);
  assertEquals(loans[0].principal, want);
  assertEquals(loans[0].issuerKind, "firm");
  // the lender paid the principal out of pocket
  const lender = loans[0].holder;
  assertEquals(personCash(after, lender), personCash(before, lender) - want);
  // and if the saver we parked the cash on was the lender, it is now down by want
  if (lender === saver) assertEquals(personCash(after, saver), saverBefore - want);
});

Deno.test("lending day: every firm can self-fund, so nothing is lent", async () => {
  const ctx = openMetro("demo-out/lend-test-quiet");
  await runIgnition(ctx, 1, { spend: true });
  const before = loadWorld(ctx.worldPath);
  const loansBefore = Object.values(before.loans).length;

  // sellouts on record, but no firm was drained — all sit at/above the floor
  const tracker = newInvestTracker();
  for (const id of Object.keys(before.firms)) {
    if (before.firms[id].kind === "nightclub") {
      tracker.history[id] = Array.from({ length: params.investWindow }, () => 1);
    }
  }
  const tally = await runLending(ctx, tracker);
  assertEquals(tally, { lent: 0, principal: 0 });
  assertEquals(Object.values(loadWorld(ctx.worldPath).loans).length, loansBefore);
});
