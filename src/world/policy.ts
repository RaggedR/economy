// policy.ts — the scripted slot from Part IV. A pure function of the world.
// The leaf posts the number this returns. The reducer does not compute a second one.
//
// A marked base of zero is not a full book: there is no positive ceiling to
// have reached. sellCapital still treats loans against a zero base as distress,
// because that test is `loans > multiple × base`.

import { params } from "./params.ts";
import { collateralValue, markedMineBase } from "./world.ts";
import { requestLoanGate } from "./gates.ts";
import type { BankId, Id, Material, Money, World } from "./types.ts";
import { otherBank } from "./types.ts";

function stressed(world: World, bank: BankId): boolean {
  const ceiling = params.leverageMultiple * markedMineBase(world, bank);
  const full = ceiling > 0 && world.banks[bank].loansOutstanding >= ceiling;
  return world.banks[bank].losses > 0 || full;
}

/** One step toward `other`, then one step up when the book is stressed. */
function stepToward(current: number, other: number, up: boolean): number {
  let next = current;
  if (other > current) next += params.rateStep;
  else if (other < current) next -= params.rateStep;
  if (up) next += params.rateStep;
  return next;
}

export function nextLoanRate(world: World, bank: BankId): number {
  return stepToward(
    world.banks[bank].loanRate,
    world.banks[otherBank(bank)].loanRate,
    stressed(world, bank),
  );
}

function postedOre(world: World, bank: BankId): Money | null {
  const listings = world.listings.filter((l) => l.kind === "ore" && l.seller === bank);
  if (listings.length === 0) return null;
  return listings[listings.length - 1].price;
}

/** Ore listings carry no material. The observation is the bank's latest ore
 *  listing, and the initial reference of `material` when it has posted none. */
export function nextOrePrice(world: World, bank: BankId, material: Material): Money {
  const current = postedOre(world, bank) ?? params.initialRef[material];
  const other = postedOre(world, otherBank(bank)) ?? params.initialRef[material];
  return stepToward(current, other, stressed(world, bank));
}

export type LoanAsk = {
  bank: BankId;
  borrower: Id;
  amount: Money;
  collateral: Id;
  installment: Money;
  months: number;
};

/** A loan the gate would accept, against an unliened house or mine. Null when
 *  nothing qualifies. The failing LTV scenario is a shape built by hand, not
 *  this function. */
export function loanAsk(world: World, borrower: Id, bank: BankId): LoanAsk | null {
  const candidates: Id[] = [];
  for (const house of Object.values(world.houses)) {
    if (house.owner === borrower && house.lien === null) candidates.push(house.id);
  }
  for (const mine of Object.values(world.mines)) {
    if (mine.owner === borrower && mine.lien === null && mine.depositedAt === null) {
      candidates.push(mine.id);
    }
  }
  candidates.sort();
  for (const collateral of candidates) {
    const value = collateralValue(world, collateral);
    if (value === null) continue;
    const amount = Math.floor((value * params.ltvPercent) / 100);
    if (amount < 1) continue;
    const gate = requestLoanGate(world, bank, borrower, amount, collateral, amount, 1);
    if (gate.ok) {
      return { bank, borrower, amount, collateral, installment: amount, months: 1 };
    }
  }
  return null;
}
