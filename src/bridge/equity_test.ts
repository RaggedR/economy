// equity_test.ts — equity day end to end through the real gates. A rentier's
// mine is deposited for shares (and opens the leverage ceiling), an entrepreneur
// mortgages his house and pays interest, the bank's equity turns positive, and
// the dividend that follows reaches the shareholder. With no mine on deposit,
// the ceiling is zero and nothing can be borrowed, so the bank never earns.
//
// Default params throughout, so the frozen fixtures are untouched. A mine is a
// real asset outside the financial-instrument sums, so seeding one is lawful on
// its own (assertInvariant is re-checked after).

import { assertEquals, assert } from "jsr:@std/assert@1";
import { openRig } from "./rig.ts";
import { runIgnition } from "./ignition.ts";
import { runEquityDay } from "./equity.ts";
import { fixedClock, seededIds } from "../log/ids.ts";
import { metropolisSeed } from "../world/metropolis.ts";
import { loadWorld, saveWorld } from "../world/store.ts";
import { dividendGate } from "../world/gates.ts";
import { assertInvariant } from "../world/world.ts";
import type { World } from "../world/types.ts";

function openMetro(dir: string) {
  return openRig(dir, metropolisSeed(), seededIds("equity-test"), fixedClock());
}

/** Give `owner` a fat common-ore mine, so a deposit both mints shares and opens
 *  a generous leverage ceiling. */
function giveMine(ctx: { worldPath: string }, owner: string): void {
  const w = loadWorld(ctx.worldPath);
  w.mines["m-seed"] = {
    id: "m-seed",
    material: "common",
    stock: 500,
    owner,
    depositedAt: null,
    lien: null,
  };
  assertInvariant(w); // a mine is lawful on its own
  saveWorld(ctx.worldPath, w);
}

/** An entrepreneur: owner-operator of a producing firm. */
function anEntrepreneur(w: World): string {
  const f = Object.values(w.firms).find((f) =>
    ["supermarket", "luxury", "nightclub"].includes(f.kind) && !!w.people[f.owner]
  )!;
  return f.owner;
}
/** A rentier: owns a firm, none of them a shop; a natural mine holder. */
function aRentier(w: World): string {
  return Object.keys(w.people).filter((id) => {
    const owns = Object.values(w.firms).some((f) => f.owner === id);
    const shop = Object.values(w.firms).some((f) =>
      f.owner === id && ["supermarket", "luxury", "nightclub"].includes(f.kind)
    );
    return owns && !shop;
  }).sort()[0];
}

Deno.test("equity day: the mechanism fires (shares minted, mortgage taken, interest paid), but the bank's structural insolvency keeps the dividend unreachable", async () => {
  // The bank's genesis equity is -(all deposits) (seed.ts): it is a pure deposit
  // ledger with no reserve asset, so equity = loans - deposits + interbank is
  // pinned at minus the money supply. Interest income raises equity exactly, but
  // a year of entrepreneur mortgage interest is a rounding error against that
  // hole, so the dividend gate still refuses. This is the finding, mechanised.
  const ctx = openMetro("demo-out/equity-test");
  await runIgnition(ctx, 1, { spend: true });

  const w0 = loadWorld(ctx.worldPath);
  const rentier = aRentier(w0);
  const entre = anEntrepreneur(w0);
  giveMine(ctx, rentier);

  const before = loadWorld(ctx.worldPath);
  assert(before.banks.a.equity < 0, "bank starts insolvent (equity = -deposits)");
  assertEquals(before.banks.a.sharesOutstanding, 0);

  const tally = runEquityDay(ctx);
  assertEquals(tally.deposited, 1, "the mine was deposited");
  assert(tally.borrowed >= 1, "an entrepreneur mortgaged his house");
  assert(tally.interest > 0, "interest was paid to the bank");

  const after = loadWorld(ctx.worldPath);
  // shares were minted to the rentier, and the entrepreneur holds a bank loan
  assertEquals(after.banks.a.sharesOutstanding, 500);
  assert(
    Object.values(after.loans).some((l) => l.kind === "bank" && l.borrower === entre),
    "the entrepreneur holds a bank loan against his house",
  );
  // equity rose by EXACTLY the interest — the mechanism is correct …
  assertEquals(after.banks.a.equity, before.banks.a.equity + tally.interest);
  // … but it is still deeply negative, so the dividend cannot fire.
  assert(after.banks.a.equity < 0, "one year of interest cannot fill a -money-supply hole");
  assert(!dividendGate(after, "a").ok, "the dividend gate refuses an insolvent bank");
});

Deno.test("equity day: with no mine on deposit, the leverage ceiling is zero and the bank never earns", async () => {
  const ctx = openMetro("demo-out/equity-test-quiet");
  await runIgnition(ctx, 1, { spend: true });
  const tally = runEquityDay(ctx); // no mine seeded
  assertEquals(tally, { deposited: 0, borrowed: 0, interest: 0 });
  assert(loadWorld(ctx.worldPath).banks.a.equity <= 0, "bank stays insolvent");
});
