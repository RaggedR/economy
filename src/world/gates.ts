// gates.ts — smart constructors. Ok carries an effect the reducer may apply
// without judging it again. Refused is a position, not an exception. There is
// no other way to build an effect that the command surface will commit.

import { params } from "./params.ts";
import type { BankId, Effect, FlowRow, Id, Money, Qty, Rate, World } from "./types.ts";
import { FLOW_ROWS, goodOf, isBankId } from "./types.ts";
import { collateralValue, markedMineBase, purseOf } from "./world.ts";

export type GateResult =
  | { ok: true; effect: Effect }
  | { ok: false; reason: string };

const ok = (effect: Effect): GateResult => ({ ok: true, effect });
const refused = (reason: string): GateResult => ({ ok: false, reason });

function posInt(n: number, name: string): string | null {
  if (!Number.isInteger(n) || n <= 0) return `${name} must be a positive integer`;
  return null;
}

function schedule(installment: Money, months: number, principal: Money): string | null {
  const bad = posInt(installment, "installment") ?? posInt(months, "months") ??
    posInt(principal, "principal");
  if (bad) return bad;
  const product = installment * months;
  if (!Number.isInteger(product)) return "installment × months is not an integer";
  if (product < principal) {
    return `installment × months ${product} is below principal ${principal}`;
  }
  return null;
}

function funds(world: World, id: Id, amount: Money): string | null {
  const purse = purseOf(world, id);
  if (!purse) return `no purse for ${id}`;
  if (purse.a + purse.b < amount) {
    return `${id} has ${purse.a + purse.b}, short of ${amount}`;
  }
  return null;
}

export function drawGate(
  world: World,
  firmId: Id,
  owner: Id,
  amount: Money,
): GateResult {
  const bad = posInt(amount, "amount");
  if (bad) return refused(bad);
  const firm = world.firms[firmId];
  if (!firm) return refused(`no firm ${firmId}`);
  if (firm.folded) return refused(`${firmId} has folded`);
  if (firm.owner !== owner) return refused(`${owner} does not own ${firmId}`);
  if (!purseOf(world, owner)) return refused(`no purse for ${owner}`);
  const short = funds(world, firmId, amount);
  if (short) return refused(short);
  return ok({ tag: "draw", firm: firmId, owner, amount });
}

function listedStaple(world: World, firmId: Id): Qty {
  let n = 0;
  for (const listing of world.listings) {
    if (listing.seller !== firmId || listing.kind !== "good") continue;
    if (goodOf(listing.payload) !== "staple") continue;
    n += listing.qty;
  }
  return n;
}

/** Staple only. Other goods are later markets. The listing id is minted in
 *  applyEffect; the gate's id is empty. */
export function postGoodGate(
  world: World,
  firmId: Id,
  price: Money,
  qty: Qty,
): GateResult {
  const bad = posInt(price, "price") ?? posInt(qty, "qty");
  if (bad) return refused(bad);
  const firm = world.firms[firmId];
  if (!firm) return refused(`no firm ${firmId}`);
  if (firm.folded) return refused(`${firmId} has folded`);
  const stock = firm.inventory.staple ?? 0;
  const already = listedStaple(world, firmId);
  if (already + qty > stock) {
    return refused(`qty ${qty} plus listed ${already} exceeds staple inventory ${stock}`);
  }
  return ok({
    tag: "post",
    listing: {
      id: "",
      seller: firmId,
      kind: "good",
      price,
      qty,
      payload: { good: "staple" },
    },
  });
}

/** A zero qty is a legal order that bought nothing. It commits, and it does
 *  not require a listing. */
export function fillGate(
  world: World,
  listingId: Id,
  buyer: Id,
  qty: Qty,
): GateResult {
  if (!Number.isInteger(qty) || qty < 0) {
    return refused("qty must be a non-negative integer");
  }
  const person = world.people[buyer];
  if (!person) return refused(`no person ${buyer}`);
  if (!person.alive) return refused(`${buyer} is dead`);
  if (qty === 0) return ok({ tag: "fill", listing: listingId, buyer, qty: 0 });
  const listing = world.listings.find((l) => l.id === listingId);
  if (!listing) return refused(`no listing ${listingId}`);
  if (goodOf(listing.payload) !== "staple") return refused(`${listingId} is not staple`);
  if (listing.qty < qty) {
    return refused(`listing ${listingId} has ${listing.qty}, short of ${qty}`);
  }
  const firm = world.firms[listing.seller];
  if (!firm) return refused(`no firm ${listing.seller}`);
  const stock = firm.inventory.staple ?? 0;
  if (stock < qty) return refused(`staple inventory ${stock} is short of ${qty}`);
  const cost = listing.price * qty;
  if (!Number.isSafeInteger(cost)) return refused("price × qty is not a safe integer");
  const short = funds(world, buyer, cost);
  if (short) return refused(short);
  if (!purseOf(world, listing.seller)) return refused(`no purse for ${listing.seller}`);
  return ok({ tag: "fill", listing: listingId, buyer, qty });
}

export function deathGate(world: World, personId: Id): GateResult {
  const person = world.people[personId];
  if (!person) return refused(`no person ${personId}`);
  if (!person.alive) return refused(`${personId} is already dead`);
  return ok({ tag: "death", person: personId });
}

export function payGate(
  world: World,
  from: Id,
  to: Id,
  amount: Money,
  row: FlowRow,
): GateResult {
  if (from === to) return refused("payer and payee are the same");
  const bad = posInt(amount, "amount");
  if (bad) return refused(bad);
  if (!FLOW_ROWS.includes(row)) return refused(`unknown flow row ${row}`);
  if (isBankId(from)) return refused("a bank does not pay through pay");
  if (!purseOf(world, from)) return refused(`no purse for ${from}`);
  if (!isBankId(to) && !purseOf(world, to)) return refused(`no purse for ${to}`);
  if (isBankId(to) && !world.banks[to]) return refused(`no bank ${to}`);
  const short = funds(world, from, amount);
  if (short) return refused(short);
  return ok({ tag: "pay", from, to, amount, row });
}

export function lendGate(
  world: World,
  bank: BankId,
  borrower: Id,
  amount: Money,
  collateral: Id,
  installment: Money,
  months: number,
): GateResult {
  if (!world.banks[bank]) return refused(`no bank ${bank}`);
  if (!purseOf(world, borrower)) return refused(`no purse for ${borrower}`);
  const bad = schedule(installment, months, amount);
  if (bad) return refused(bad);
  return ok({ tag: "lendBank", bank, borrower, amount, collateral, installment, months });
}

export function repayGate(world: World, loanId: Id, amount: Money): GateResult {
  const bad = posInt(amount, "amount");
  if (bad) return refused(bad);
  const loan = world.loans[loanId];
  if (!loan || loan.kind !== "bank") return refused(`no bank loan ${loanId}`);
  if (amount > loan.principal) {
    return refused(`repay ${amount} exceeds principal ${loan.principal}`);
  }
  const short = funds(world, loan.borrower, amount);
  if (short) return refused(short);
  return ok({ tag: "repayBank", loan: loanId, amount });
}

export function issuePrivateGate(
  world: World,
  issuer: Id,
  holder: Id,
  principal: Money,
  installment: Money,
  months: number,
  issuerKind: "firm" | "government",
): GateResult {
  if (issuer === holder) return refused("issuer and holder are the same");
  if (!purseOf(world, issuer)) return refused(`no purse for ${issuer}`);
  if (!purseOf(world, holder)) return refused(`no purse for ${holder}`);
  const bad = schedule(installment, months, principal);
  if (bad) return refused(bad);
  const short = funds(world, holder, principal);
  if (short) return refused(short);
  return ok({
    tag: "issuePrivate",
    issuer,
    holder,
    principal,
    installment,
    months,
    issuerKind,
  });
}

/** issueDebt is the shape; the effect is a private loan. */
export function issueDebtGate(
  world: World,
  issuer: Id,
  holder: Id,
  principal: Money,
  installment: Money,
  months: number,
  issuerKind: "firm" | "government",
): GateResult {
  return issuePrivateGate(
    world,
    issuer,
    holder,
    principal,
    installment,
    months,
    issuerKind,
  );
}

export function transferPrivateGate(
  world: World,
  instrument: Id,
  from: Id,
  to: Id,
  price: Money,
): GateResult {
  const bad = posInt(price, "price");
  if (bad) return refused(bad);
  const loan = world.loans[instrument];
  if (!loan || loan.kind !== "private") return refused(`no private loan ${instrument}`);
  if (loan.holder !== from) return refused(`${from} does not hold ${instrument}`);
  if (to === from) return refused("buyer is already the holder");
  if (!purseOf(world, to)) return refused(`no purse for ${to}`);
  const short = funds(world, to, price);
  if (short) return refused(short);
  return ok({ tag: "transferPrivate", instrument, from, to, price });
}

export function writeOffGate(world: World, instrument: Id): GateResult {
  const loan = world.loans[instrument];
  if (!loan) return refused(`no loan ${instrument}`);
  if (loan.principal <= 0) return refused(`loan ${instrument} has no principal`);
  return ok({ tag: "writeOff", instrument });
}

export function depositMineGate(
  world: World,
  mineId: Id,
  bank: BankId,
  shares: Qty,
): GateResult {
  const bad = posInt(shares, "shares");
  if (bad) return refused(bad);
  const mine = world.mines[mineId];
  if (!mine) return refused(`no mine ${mineId}`);
  if (mine.depositedAt !== null) return refused(`${mineId} is already deposited`);
  if (mine.lien !== null) return refused(`lien blocks deposit of ${mineId}`);
  if (isBankId(mine.owner)) return refused(`${mineId} is already owned by a bank`);
  if (!purseOf(world, mine.owner)) {
    return refused(`owner ${mine.owner} has no purse to receive shares`);
  }
  if (!world.banks[bank]) return refused(`no bank ${bank}`);
  return ok({ tag: "depositMine", mine: mineId, bank, shares });
}

export function dividendGate(world: World, bank: BankId): GateResult {
  const b = world.banks[bank];
  if (!b) return refused(`no bank ${bank}`);
  if (b.equity <= 0) return refused(`${bank} equity is ${b.equity}`);
  if (b.sharesOutstanding <= 0) return refused(`${bank} has no shares outstanding`);
  return ok({ tag: "dividend", bank });
}

export function seizeGate(world: World, loanId: Id): GateResult {
  const loan = world.loans[loanId];
  if (!loan || loan.kind !== "bank") return refused(`no bank loan ${loanId}`);
  const house = world.houses[loan.collateral];
  const mine = world.mines[loan.collateral];
  if (!house && !mine) return refused(`loan ${loanId} has no collateral to seize`);
  const lien = house ? house.lien : mine ? mine.lien : null;
  if (lien !== loanId) return refused(`collateral is not liened to ${loanId}`);
  return ok({ tag: "seize", loan: loanId });
}

export function sellCapitalGate(
  world: World,
  bank: BankId,
  mineId: Id,
  ask: Money,
): GateResult {
  const bad = posInt(ask, "ask");
  if (bad) return refused(bad);
  const b = world.banks[bank];
  if (!b) return refused(`no bank ${bank}`);
  const base = markedMineBase(world, bank);
  const distressed = b.equity < 0 || b.loansOutstanding > params.leverageMultiple * base;
  if (!distressed) {
    return refused(
      `${bank} is not distressed: equity ${b.equity}, loans ${b.loansOutstanding}`,
    );
  }
  const mine = world.mines[mineId];
  if (!mine) return refused(`no mine ${mineId}`);
  if (mine.depositedAt !== bank) return refused(`${mineId} is not deposited at ${bank}`);
  if (mine.lien !== null) return refused(`lien blocks sale of ${mineId}`);
  return ok({
    tag: "post",
    listing: {
      id: "",
      seller: bank,
      kind: "mine",
      price: ask,
      qty: 1,
      payload: null,
    },
  });
}

export function setLoanRateGate(world: World, bank: BankId, rate: Rate): GateResult {
  if (!world.banks[bank]) return refused(`no bank ${bank}`);
  if (!Number.isInteger(rate)) return refused("rate must be an integer");
  return ok({ tag: "setLoanRate", bank, rate });
}

export function postMaterialGate(
  world: World,
  bank: BankId,
  mineId: Id,
  price: Money,
  maxUnits: Qty,
): GateResult {
  const bad = posInt(price, "price") ?? posInt(maxUnits, "maxUnits");
  if (bad) return refused(bad);
  const mine = world.mines[mineId];
  if (!mine) return refused(`no mine ${mineId}`);
  if (mine.depositedAt !== bank) return refused(`${mineId} is not deposited at ${bank}`);
  if (maxUnits > mine.stock) {
    return refused(`maxUnits ${maxUnits} exceeds stock ${mine.stock}`);
  }
  return ok({
    tag: "post",
    listing: {
      id: "",
      seller: bank,
      kind: "ore",
      price,
      qty: maxUnits,
      payload: null,
    },
  });
}

/** The household shape. The bank leaf never sees this decision. */
export function requestLoanGate(
  world: World,
  bank: BankId,
  borrower: Id,
  amount: Money,
  collateral: Id,
  installment: Money,
  months: number,
): GateResult {
  const scheduled = lendGate(
    world,
    bank,
    borrower,
    amount,
    collateral,
    installment,
    months,
  );
  if (!scheduled.ok) return scheduled;
  const house = world.houses[collateral];
  const mine = world.mines[collateral];
  if (!house && !mine) return refused(`${collateral} is not a house or a mine`);
  if (house && house.owner !== borrower) {
    return refused(`${borrower} does not own ${collateral}`);
  }
  if (mine && mine.owner !== borrower) {
    return refused(`${borrower} does not own ${collateral}`);
  }
  // A house stores `lien: null` when it is free. `??` would treat that null as
  // missing and go on to look up a mine that is not there.
  const lien = house ? house.lien : mine ? mine.lien : null;
  if (lien !== null) return refused(`${collateral} is liened`);
  if (mine?.depositedAt) return refused(`${collateral} is deposited`);
  const value = collateralValue(world, collateral);
  if (value === null) return refused(`${collateral} has no value`);
  if (value * params.ltvPercent < amount * 100) {
    return refused(`LTV: value ${value} × ${params.ltvPercent}% is below ${amount}`);
  }
  const base = markedMineBase(world, bank);
  const ceiling = params.leverageMultiple * base;
  const outstanding = world.banks[bank].loansOutstanding;
  if (outstanding + amount > ceiling) {
    return refused(`leverage: ${outstanding + amount} exceeds ceiling ${ceiling}`);
  }
  return scheduled;
}
