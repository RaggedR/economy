// equity_test.ts — the share math and the interest figure, in isolation. A free
// mine with a purse-holding owner deposits; a deposited, liened, or bank-owned
// mine does not; shares track stock; interest is a round fraction of principal.

import { assertEquals } from "jsr:@std/assert@1";
import { interestDue, type MineDeposit, planMineDeposits } from "./equity.ts";
import { params } from "./params.ts";
import type { Mine, World } from "./types.ts";

const mine = (id: string, over: Partial<Mine> = {}): Mine => ({
  id,
  material: "common",
  stock: 5,
  owner: "p0",
  depositedAt: null,
  lien: null,
  ...over,
});

/** A world carrying only what planMineDeposits reads. */
function worldWith(mines: Mine[]): World {
  const byId: Record<string, Mine> = {};
  for (const m of mines) byId[m.id] = m;
  return {
    mines: byId,
    people: { p0: {}, p1: {} },
    firms: {},
  } as unknown as World;
}

Deno.test("a free mine with a purse-holding owner deposits, one share per unit of stock", () => {
  const got = planMineDeposits(worldWith([mine("m0", { stock: 7 })]));
  assertEquals(got, [{ owner: "p0", mine: "m0", shares: 7 }] as MineDeposit[]);
});

Deno.test("a zero-stock mine still mints at least one share", () => {
  const got = planMineDeposits(worldWith([mine("m0", { stock: 0 })]));
  assertEquals(got, [{ owner: "p0", mine: "m0", shares: 1 }]);
});

Deno.test("deposited, liened and bank-owned mines are skipped", () => {
  const got = planMineDeposits(worldWith([
    mine("m0", { depositedAt: "a" }),
    mine("m1", { lien: "loan-1" }),
    mine("m2", { owner: "a" }), // owned by a bank
    mine("m3"), // the only free one
  ]));
  assertEquals(got.map((d) => d.mine), ["m3"]);
});

Deno.test("a mine whose owner has no purse is skipped", () => {
  const got = planMineDeposits(worldWith([mine("m0", { owner: "ghost" })]));
  assertEquals(got, []);
});

Deno.test("deposits are ordered by mine id", () => {
  const got = planMineDeposits(worldWith([
    mine("m2", { owner: "p1" }),
    mine("m0", { owner: "p0" }),
    mine("m1", { owner: "p1" }),
  ]));
  assertEquals(got.map((d) => d.mine), ["m0", "m1", "m2"]);
});

Deno.test("interest is a round fraction of principal, at least one", () => {
  assertEquals(interestDue(300), Math.floor(300 / params.equityInterestDivisor));
  assertEquals(interestDue(5), 1); // floor(5/10)=0 is lifted to 1
});
