// gates_test.ts — an illegal effect cannot be held. ok: false is the position.
// The reducer is not called.

import { assertEquals } from "jsr:@std/assert@1";
import {
  depositMineGate,
  dividendGate,
  type GateResult,
  issueDebtGate,
  lendGate,
  payGate,
  postMaterialGate,
  repayGate,
  requestLoanGate,
  sellCapitalGate,
  setLoanRateGate,
  transferPrivateGate,
  writeOffGate,
} from "./gates.ts";
import { monthSeed, storySeed } from "./seed.ts";
import { collateralValue, markedMineBase } from "./world.ts";
import type { World } from "./types.ts";

function why(g: GateResult): string {
  if (g.ok) throw new Error("expected a refusal");
  return g.reason;
}

function mineOwnedByAda(w: World): World {
  return {
    ...w,
    mines: {
      ...w.mines,
      m: {
        id: "m",
        material: "common",
        stock: 10,
        owner: "ada",
        depositedAt: null,
        lien: null,
      },
    },
  };
}

Deno.test("schedule, funds, and the same party cannot be held", () => {
  const w = storySeed();
  assertEquals(payGate(w, "ada", "ada", 10, "wages").ok, false);
  assertEquals(why(payGate(w, "ada", "ben", 0, "wages")).includes("positive"), true);
  assertEquals(why(payGate(w, "ada", "ben", 5000, "wages")).includes("short"), true);
  assertEquals(why(payGate(w, "a", "ben", 10, "wages")).includes("bank"), true);
  assertEquals(lendGate(w, "a", "ada", 100, "note", 9, 10).ok, false);
  assertEquals(lendGate(w, "a", "ada", 100, "note", 10, 10).ok, true);
  assertEquals(issueDebtGate(w, "gov", "ada", 10, 2, 3, "government").ok, false);
  assertEquals(issueDebtGate(w, "gov", "ada", 10, 5, 2, "government").ok, true);
  assertEquals(repayGate(w, "missing", 1).ok, false);
  assertEquals(writeOffGate(w, "missing").ok, false);
  assertEquals(transferPrivateGate(w, "missing", "ada", "ben", 1).ok, false);
});

Deno.test("a lien blocks deposit and a sale, and an empty mine does not deposit", () => {
  const w = mineOwnedByAda(storySeed());
  assertEquals(depositMineGate(w, "m", "a", 4).ok, true);
  const liened = { ...w, mines: { m: { ...w.mines.m, lien: "loan-9" } } };
  assertEquals(why(depositMineGate(liened, "m", "a", 4)).includes("lien"), true);
  const deposited = {
    ...w,
    mines: { m: { ...w.mines.m, depositedAt: "a" as const, owner: "a" } },
  };
  assertEquals(depositMineGate(deposited, "m", "b", 4).ok, false);
});

Deno.test("sellCapital requires distress, and a zero base is not a full book", () => {
  const month = monthSeed();
  assertEquals(sellCapitalGate(month, "a", "m1", 15).ok, true);
  assertEquals(why(sellCapitalGate(month, "a", "m1", 0)).includes("positive"), true);

  let calm = storySeed();
  calm = mineOwnedByAda(calm);
  // Pay ada's whole deposit to her own bank. Equity and the liability both reach 0.
  calm = {
    ...calm,
    people: { ...calm.people, ada: { ...calm.people.ada, deposits: { a: 0, b: 0 } } },
    banks: {
      ...calm.banks,
      a: { ...calm.banks.a, equity: 0, depositLiability: 0 },
    },
  };
  const deposited = {
    ...calm,
    mines: { m: { ...calm.mines.m, owner: "a", depositedAt: "a" as const } },
    banks: { ...calm.banks, a: { ...calm.banks.a, sharesOutstanding: 1 } },
    shares: { s: { id: "s", bank: "a" as const, holder: "ada", units: 1 } },
  };
  assertEquals(sellCapitalGate(deposited, "a", "m", 10).ok, false);
  const over = {
    ...deposited,
    banks: { ...deposited.banks, a: { ...deposited.banks.a, loansOutstanding: 1001 } },
  };
  assertEquals(sellCapitalGate(over, "a", "m", 10).ok, true);
});

Deno.test("requestLoan judges LTV and the ceiling, and the bank is not asked", () => {
  const w = monthSeed();
  assertEquals(collateralValue(w, "h-ada"), 1000);
  assertEquals(markedMineBase(w, "a"), 1000);
  assertEquals(requestLoanGate(w, "a", "ada", 500, "h-ada", 50, 10).ok, true);
  assertEquals(
    why(requestLoanGate(w, "a", "ben", 501, "h-ben", 51, 10)).includes("LTV"),
    true,
  );
  assertEquals(
    why(requestLoanGate(w, "a", "ada", 500, "h-ben", 50, 10)).includes("own"),
    true,
  );
  const liened = {
    ...w,
    houses: { ...w.houses, "h-ada": { ...w.houses["h-ada"], lien: "loan-1" } },
  };
  assertEquals(
    why(requestLoanGate(liened, "a", "ada", 100, "h-ada", 10, 10)).includes("lien"),
    true,
  );

  const rich = mineOwnedByAda(w);
  rich.mines.m.stock = 100_000;
  const leverage = requestLoanGate(rich, "a", "ada", 20_000, "m", 20_000, 1);
  assertEquals(why(leverage).includes("leverage"), true);
});

Deno.test("a rate is an integer and may be negative; a dividend needs equity and shares", () => {
  const w = storySeed();
  assertEquals(setLoanRateGate(w, "a", -3).ok, true);
  assertEquals(setLoanRateGate(w, "a", 0).ok, true);
  assertEquals(setLoanRateGate(w, "a", 1.5).ok, false);
  assertEquals(dividendGate(w, "a").ok, false);
  const broke = monthSeed();
  broke.banks.a.sharesOutstanding = 0;
  broke.shares = {};
  broke.banks.a.equity = 10;
  broke.banks.a.depositLiability = 0;
  assertEquals(why(dividendGate(broke, "a")).includes("shares"), true);
});

Deno.test("ore cannot be posted beyond the stock or from a mine the bank does not hold", () => {
  const w = monthSeed();
  assertEquals(postMaterialGate(w, "a", "m1", 12, 100).ok, true);
  assertEquals(postMaterialGate(w, "a", "m1", 12, 101).ok, false);
  assertEquals(postMaterialGate(w, "b", "m1", 12, 1).ok, false);
});
