// lend_test.ts — the wealthy lender's two guards, in isolation. The savings
// threshold and funds check stop a lender; the serviceability test sizes and
// caps the loan; a solvent saver meets a creditworthy firm's want.

import { assertEquals } from "jsr:@std/assert@1";
import {
  type Borrower,
  decideLending,
  type Lender,
  maxInstallment,
} from "./lend.ts";

// Defaults matching the levelled town: savings threshold 100, revenue covers an
// installment twice, loans written over at most 12 months.
const base = { savingsThreshold: 100, revenueCover: 2, term: 12 };
const firm = (id: string, over: Partial<Borrower> = {}): Borrower => ({
  id,
  want: 48, // a club short of the 58 floor by, say, 48
  revenue: 200, // plenty of sale revenue to service the loan
  ...over,
});
const saver = (id: string, cash = 500): Lender => ({ id, cash });

Deno.test("max installment is floor(revenue / cover); zero when revenue cannot carry one", () => {
  assertEquals(maxInstallment(200, 2), 100);
  assertEquals(maxInstallment(1, 2), 0);
  assertEquals(maxInstallment(100, 0), 0);
});

Deno.test("a solvent saver funds a creditworthy firm's whole want", () => {
  const { loans } = decideLending({
    ...base,
    borrowers: [firm("club-01")],
    lenders: [saver("p0")],
  });
  assertEquals(loans.length, 1);
  const loan = loans[0];
  assertEquals(loan.lender, "p0");
  assertEquals(loan.firm, "club-01");
  assertEquals(loan.principal, 48);
  // revenue 200 / cover 2 = 100 serviceable/mo; want 48 clears in one month.
  assertEquals(loan.installment, 48);
  assertEquals(loan.months, 1);
});

Deno.test("a lender under the savings threshold does not lend", () => {
  const { loans } = decideLending({
    ...base,
    borrowers: [firm("club-01")],
    lenders: [saver("p0", 80)], // below 100
  });
  assertEquals(loans, []);
});

Deno.test("a lender who cannot fund the whole principal is passed over", () => {
  const { loans } = decideLending({
    ...base,
    borrowers: [firm("club-01", { want: 300 })],
    lenders: [saver("p0", 200)], // above threshold, but 200 < 300
  });
  assertEquals(loans, []);
});

Deno.test("a firm with no revenue cannot service any loan", () => {
  const { loans } = decideLending({
    ...base,
    borrowers: [firm("club-01", { revenue: 0 })],
    lenders: [saver("p0")],
  });
  assertEquals(loans, []);
});

Deno.test("thin revenue caps the principal at serviceable × term, below the want", () => {
  // revenue 20 / cover 2 = 10 serviceable/mo; over a 12-month term that carries
  // at most 120, so a want of 500 is lent only 120.
  const { loans } = decideLending({
    ...base,
    borrowers: [firm("club-01", { want: 500, revenue: 20 })],
    lenders: [saver("p0", 1000)],
  });
  assertEquals(loans.length, 1);
  assertEquals(loans[0].principal, 120);
  assertEquals(loans[0].installment, 10);
  assertEquals(loans[0].months, 12);
});

Deno.test("hungriest borrower first; richest free lender each; one loan apiece", () => {
  const { loans } = decideLending({
    ...base,
    borrowers: [firm("club-01", { want: 40 }), firm("club-02", { want: 90 })],
    lenders: [saver("p0", 300), saver("p1", 500)],
  });
  // club-02 (want 90) is served first by the richest lender p1; club-01 by p0.
  assertEquals(loans.map((l) => [l.firm, l.lender]), [
    ["club-02", "p1"],
    ["club-01", "p0"],
  ]);
});

Deno.test("more borrowers than lenders: the extra firm goes unfunded this cycle", () => {
  const { loans } = decideLending({
    ...base,
    borrowers: [firm("club-01"), firm("club-02"), firm("club-03")],
    lenders: [saver("p0"), saver("p1")],
  });
  assertEquals(loans.length, 2);
});

Deno.test("a want below one is not a loan", () => {
  const { loans } = decideLending({
    ...base,
    borrowers: [firm("club-01", { want: 0 })],
    lenders: [saver("p0")],
  });
  assertEquals(loans, []);
});
