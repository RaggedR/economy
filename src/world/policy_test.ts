// policy_test.ts — the rate and the ore price move toward the other bank, and
// step up once when the book is stressed. The household's ask is an amount the
// gate accepts.

import { assertEquals } from "jsr:@std/assert@1";
import { requestLoanGate } from "./gates.ts";
import { loanAsk, nextLoanRate, nextOrePrice } from "./policy.ts";
import { monthSeed } from "./seed.ts";
import { markedMineBase } from "./world.ts";
import { params } from "./params.ts";

Deno.test("the rate steps toward the other bank, and once more when stressed", () => {
  const w = monthSeed();
  assertEquals(nextLoanRate(w, "a"), 101);
  assertEquals(nextLoanRate(w, "b"), 104);

  w.banks.a.losses = 1;
  assertEquals(nextLoanRate(w, "a"), 102);

  w.banks.a.losses = 0;
  w.banks.a.loansOutstanding = params.leverageMultiple * markedMineBase(w, "a");
  assertEquals(nextLoanRate(w, "a"), 102);

  // Losses and a full book are one condition, so the extra step is still one.
  w.banks.a.losses = 5;
  assertEquals(nextLoanRate(w, "a"), 102);
});

Deno.test("a zero ceiling is not a full book", () => {
  const w = monthSeed();
  w.mines = {};
  w.banks.a.loansOutstanding = 50;
  assertEquals(nextLoanRate(w, "a"), 101);
});

Deno.test("ore starts at the reference and steps toward the other bank's listing", () => {
  const w = monthSeed();
  assertEquals(nextOrePrice(w, "a", "common"), params.initialRef.common);
  w.listings.push({
    id: "posted",
    seller: "b",
    kind: "ore",
    price: 12,
    qty: 1,
    payload: null,
  });
  assertEquals(nextOrePrice(w, "a", "common"), 11);
});

Deno.test("loanAsk is an amount requestLoan would accept", () => {
  const w = monthSeed();
  const ask = loanAsk(w, "ada", "a");
  if (!ask) throw new Error("ada has a house");
  assertEquals(ask.amount, 500);
  assertEquals(ask.collateral, "h-ada");
  assertEquals(
    requestLoanGate(
      w,
      ask.bank,
      ask.borrower,
      ask.amount,
      ask.collateral,
      ask.installment,
      ask.months,
    )
      .ok,
    true,
  );
  assertEquals(loanAsk(storyless(), "ada", "a"), null);
});

function storyless() {
  const w = monthSeed();
  w.houses = {};
  w.people.ada.dwelling = null;
  return w;
}
