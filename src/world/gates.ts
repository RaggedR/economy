// gates.ts — smart constructors. Ok carries an effect the reducer may apply
// without judging it again. Refused is a position, not an exception. There is
// no other way to build an effect that the command surface will commit.

import { params } from "./params.ts";
import type {
  BankId,
  Career,
  Disease,
  Effect,
  FlowRow,
  Id,
  MachineType,
  Money,
  Qty,
  Rate,
  World,
} from "./types.ts";
import {
  diseaseOf,
  FLOW_ROWS,
  goodOf,
  houseOf,
  isBankId,
  isDisease,
  shareBank,
  tuitionCareer,
} from "./types.ts";
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

function shareUnits(world: World, holder: Id, bank: BankId): Qty {
  let n = 0;
  for (const share of Object.values(world.shares)) {
    if (share.holder === holder && share.bank === bank) n += share.units;
  }
  return n;
}

/** A holder posts units of one bank. Listed units cannot exceed the holding. */
export function postShareGate(
  world: World,
  holder: Id,
  bank: BankId,
  price: Money,
  qty: Qty,
): GateResult {
  const bad = posInt(price, "price") ?? posInt(qty, "qty");
  if (bad) return refused(bad);
  const person = world.people[holder];
  if (!person || !person.alive) return refused(`no living person ${holder}`);
  const held = shareUnits(world, holder, bank);
  const already = world.listings.filter((l) =>
    l.seller === holder && l.kind === "share" && shareBank(l.payload) === bank
  ).reduce((s, l) => s + l.qty, 0);
  if (already + qty > held) {
    return refused(`qty ${qty} plus listed ${already} exceeds ${bank} shares ${held}`);
  }
  return ok({
    tag: "post",
    listing: {
      id: "",
      seller: holder,
      kind: "share",
      price,
      qty,
      payload: { bank },
    },
  });
}

/** A zero qty is a legal bid that bought nothing. */
export function tradeShareGate(
  world: World,
  listingId: Id,
  buyer: Id,
  qty: Qty,
): GateResult {
  if (!Number.isInteger(qty) || qty < 0) {
    return refused("qty must be a non-negative integer");
  }
  const person = world.people[buyer];
  if (!person || !person.alive) return refused(`no living person ${buyer}`);
  if (qty === 0) return ok({ tag: "tradeShare", listing: listingId, buyer, qty: 0 });
  const listing = world.listings.find((l) => l.id === listingId);
  if (!listing || listing.kind !== "share") {
    return refused(`no share listing ${listingId}`);
  }
  const bank = shareBank(listing.payload);
  if (!bank) return refused(`${listingId} names no bank`);
  if (listing.seller === buyer) return refused(`${buyer} cannot buy their own shares`);
  if (listing.qty < qty) {
    return refused(`listing ${listingId} has ${listing.qty}, short of ${qty}`);
  }
  if (shareUnits(world, listing.seller, bank) < qty) {
    return refused(`${listing.seller} holds fewer than ${qty} ${bank} shares`);
  }
  const cost = listing.price * qty;
  if (!Number.isSafeInteger(cost)) return refused("price × qty is not a safe integer");
  const short = funds(world, buyer, cost);
  if (short) return refused(short);
  return ok({ tag: "tradeShare", listing: listingId, buyer, qty });
}

export function postHouseGate(
  world: World,
  owner: Id,
  houseId: Id,
  ask: Money,
): GateResult {
  const bad = posInt(ask, "ask");
  if (bad) return refused(bad);
  const house = world.houses[houseId];
  if (!house) return refused(`no house ${houseId}`);
  if (house.owner !== owner) return refused(`${owner} does not own ${houseId}`);
  if (house.lien) return refused(`lien blocks sale of ${houseId}`);
  if (
    world.listings.some((l) =>
      l.kind === "houseSale" && houseOf(l.payload) === houseId && l.qty > 0
    )
  ) {
    return refused(`${houseId} is already offered`);
  }
  return ok({
    tag: "post",
    listing: {
      id: "",
      seller: owner,
      kind: "houseSale",
      price: ask,
      qty: 1,
      payload: { house: houseId },
    },
  });
}

export function transferHouseGate(
  world: World,
  listingId: Id,
  buyer: Id,
  qty: Qty,
): GateResult {
  if (qty !== 0 && qty !== 1) return refused("a house sells as one unit or none");
  const person = world.people[buyer];
  if (!person || !person.alive) return refused(`no living person ${buyer}`);
  if (qty === 0) return ok({ tag: "transferHouse", listing: listingId, buyer, qty: 0 });
  const listing = world.listings.find((l) => l.id === listingId);
  if (!listing || listing.kind !== "houseSale") {
    return refused(`no house listing ${listingId}`);
  }
  const houseId = houseOf(listing.payload);
  const house = houseId ? world.houses[houseId] : undefined;
  if (!house) return refused(`listing ${listingId} names no house`);
  if (house.lien) return refused(`lien blocks sale of ${house.id}`);
  if (house.owner !== listing.seller) {
    return refused(`${listing.seller} does not own ${house.id}`);
  }
  if (buyer === listing.seller) return refused(`${buyer} already owns ${house.id}`);
  const short = funds(world, buyer, listing.price);
  if (short) return refused(short);
  return ok({ tag: "transferHouse", listing: listingId, buyer, qty: 1 });
}

export function occupyGate(
  world: World,
  owner: Id,
  houseId: Id,
  mode: "occupy" | "let",
): GateResult {
  const house = world.houses[houseId];
  if (!house) return refused(`no house ${houseId}`);
  if (house.owner !== owner) return refused(`${owner} does not own ${houseId}`);
  const person = world.people[owner];
  if (!person || !person.alive) return refused(`no living person ${owner}`);
  return ok({ tag: "occupy", house: houseId, mode });
}

export function postJobGate(
  world: World,
  firmId: Id,
  career: Career,
  generation: number,
  salary: Money,
  slots: number,
): GateResult {
  const bad = posInt(salary, "salary") ?? posInt(slots, "slots");
  if (bad) return refused(bad);
  if (!Number.isInteger(generation) || generation < 0) {
    return refused("generation must be a non-negative integer");
  }
  const firm = world.firms[firmId];
  if (!firm) return refused(`no firm ${firmId}`);
  if (firm.folded) return refused(`${firmId} has folded`);
  return ok({
    tag: "post",
    listing: {
      id: "",
      seller: firmId,
      kind: "job",
      price: salary,
      qty: slots,
      payload: { career, generation, salary, slots },
    },
  });
}

export function hireGate(
  world: World,
  listingId: Id,
  personId: Id,
  seated: boolean,
  keep: boolean,
): GateResult {
  const person = world.people[personId];
  if (!person || !person.alive) return refused(`no living person ${personId}`);
  const listing = world.listings.find((l) => l.id === listingId);
  if (
    !listing || listing.kind !== "job" || !listing.payload ||
    !("career" in listing.payload)
  ) {
    return refused(`no job listing ${listingId}`);
  }
  const payload = listing.payload;
  if (!("generation" in payload)) return refused(`${listingId} is not a job`);
  if (!seated) {
    return ok({ tag: "hire", listing: listingId, person: personId, seated: false, keep });
  }
  const incumbent = person.job !== null && person.job.firm === listing.seller &&
    person.job.career === payload.career;
  if (keep && !incumbent) return refused(`${personId} is not the incumbent`);
  if (!keep && person.education[payload.career] < payload.generation) {
    return refused(
      `${personId} is at level ${
        person.education[payload.career]
      } in ${payload.career}, short of ${payload.generation}`,
    );
  }
  if (listing.qty < 1) return refused(`listing ${listingId} has no seat left`);
  return ok({ tag: "hire", listing: listingId, person: personId, seated: true, keep });
}

export function postMachineGate(
  world: World,
  firmId: Id,
  type: MachineType,
  generation: number,
  price: Money,
  qty: Qty,
): GateResult {
  const bad = posInt(price, "price") ?? posInt(qty, "qty");
  if (bad) return refused(bad);
  if (!Number.isInteger(generation) || generation < 0) {
    return refused("generation must be a non-negative integer");
  }
  const firm = world.firms[firmId];
  if (!firm) return refused(`no firm ${firmId}`);
  if (firm.folded) return refused(`${firmId} has folded`);
  if (firm.kind !== "tech") return refused(`${firmId} is not a tech firm`);
  return ok({
    tag: "post",
    listing: {
      id: "",
      seller: firmId,
      kind: "machine",
      price,
      qty,
      payload: { type, generation },
    },
  });
}

export function deliverMachineGate(
  world: World,
  listingId: Id,
  firmId: Id,
  qty: Qty,
): GateResult {
  if (!Number.isInteger(qty) || qty < 0) {
    return refused("qty must be a non-negative integer");
  }
  const firm = world.firms[firmId];
  if (!firm) return refused(`no firm ${firmId}`);
  if (firm.folded) return refused(`${firmId} has folded`);
  if (qty === 0) {
    return ok({ tag: "deliverMachine", listing: listingId, firm: firmId, qty: 0 });
  }
  const listing = world.listings.find((l) => l.id === listingId);
  if (!listing || listing.kind !== "machine") {
    return refused(`no machine listing ${listingId}`);
  }
  if (listing.seller === firmId) return refused(`${firmId} cannot buy its own machine`);
  if (listing.qty < qty) {
    return refused(`listing ${listingId} has ${listing.qty}, short of ${qty}`);
  }
  const cost = listing.price * qty;
  if (!Number.isSafeInteger(cost)) return refused("price × qty is not a safe integer");
  const short = funds(world, firmId, cost);
  if (short) return refused(short);
  return ok({ tag: "deliverMachine", listing: listingId, firm: firmId, qty });
}

export function postRentGate(
  world: World,
  owner: Id,
  houseId: Id,
  rent: Money,
): GateResult {
  const bad = posInt(rent, "rent");
  if (bad) return refused(bad);
  const house = world.houses[houseId];
  if (!house) return refused(`no house ${houseId}`);
  if (house.owner !== owner) return refused(`${owner} does not own ${houseId}`);
  if (house.occupant === owner) return refused(`${owner} occupies ${houseId}`);
  if (
    world.listings.some((l) =>
      l.kind === "rent" && houseOf(l.payload) === houseId && l.qty > 0
    )
  ) {
    return refused(`${houseId} is already listed for rent`);
  }
  return ok({
    tag: "post",
    listing: {
      id: "",
      seller: owner,
      kind: "rent",
      price: rent,
      qty: 1,
      payload: { house: houseId },
    },
  });
}

/** Inability to pay the posted year is a refusal. A solvent loss still commits. */
export function rentGate(
  world: World,
  listingId: Id,
  tenant: Id,
  pay: boolean,
): GateResult {
  const person = world.people[tenant];
  if (!person || !person.alive) return refused(`no living person ${tenant}`);
  const listing = world.listings.find((l) => l.id === listingId);
  if (!listing || listing.kind !== "rent") return refused(`no rent listing ${listingId}`);
  const short = funds(world, tenant, listing.price);
  if (short) return refused(short);
  if (pay && listing.qty < 1) return refused(`listing ${listingId} is already let`);
  return ok({ tag: "rent", listing: listingId, tenant, pay });
}

export function pinHealthGate(world: World, personId: Id): GateResult {
  const person = world.people[personId];
  if (!person) return refused(`no person ${personId}`);
  if (!person.alive) return refused(`${personId} is already dead`);
  if (person.dwelling !== null) return refused(`${personId} has a dwelling`);
  return ok({ tag: "pinHealth", person: personId, cause: "homeless" });
}

/** The disease cause carries the identity. A disease already on the person is
 *  not a second pin. */
export function diseaseGate(world: World, personId: Id, disease: Disease): GateResult {
  if (!isDisease(disease)) return refused(`unknown disease ${disease}`);
  const person = world.people[personId];
  if (!person) return refused(`no person ${personId}`);
  if (!person.alive) return refused(`${personId} is already dead`);
  if (person.diseases.includes(disease)) {
    return refused(`${personId} already has ${disease}`);
  }
  return ok({ tag: "pinHealth", person: personId, cause: "disease", disease });
}

function publicPost(
  world: World,
  personId: Id,
  career: "doctor" | "teacher",
): string | null {
  const person = world.people[personId];
  if (!person) return `no person ${personId}`;
  if (!person.alive) return `${personId} is already dead`;
  const job = person.job;
  if (!job || job.career !== career) return `${personId} is not a ${career}`;
  const firm = world.firms[job.firm];
  if (!firm || firm.folded) return `${personId} has no open employer`;
  const kind = career === "doctor" ? "publicHospital" : "publicUniversity";
  if (firm.kind !== kind) return `${personId} does not work at a ${kind}`;
  return null;
}

/** A doctor is pointed at a disease. A teacher is pointed at a career. Null clears. */
export function assignGate(
  world: World,
  personId: Id,
  specialty: Disease | Career | null,
): GateResult {
  if (specialty === null) {
    const bad = publicPost(world, personId, "doctor") &&
      publicPost(world, personId, "teacher");
    if (bad) return refused(`${personId} is not public staff`);
    return ok({ tag: "assign", person: personId, specialty: null });
  }
  if (isDisease(specialty)) {
    const bad = publicPost(world, personId, "doctor");
    if (bad) return refused(bad);
    return ok({ tag: "assign", person: personId, specialty });
  }
  const bad = publicPost(world, personId, "teacher");
  if (bad) return refused(bad);
  return ok({ tag: "assign", person: personId, specialty });
}

/** A lost bid still commits. The person must hold the disease either way. */
export function cureGate(
  world: World,
  personId: Id,
  disease: Disease,
  granted: boolean,
): GateResult {
  const person = world.people[personId];
  if (!person) return refused(`no person ${personId}`);
  if (!person.alive) return refused(`${personId} is already dead`);
  if (!person.diseases.includes(disease)) {
    return refused(`${personId} does not have ${disease}`);
  }
  return ok({ tag: "cure", person: personId, disease, granted });
}

export function levelUpGate(
  world: World,
  personId: Id,
  career: Career,
  granted: boolean,
): GateResult {
  const person = world.people[personId];
  if (!person) return refused(`no person ${personId}`);
  if (!person.alive) return refused(`${personId} is already dead`);
  return ok({ tag: "levelUp", person: personId, career, granted });
}

export function postCureGate(
  world: World,
  firmId: Id,
  disease: Disease,
  price: Money,
  qty: Qty,
): GateResult {
  const bad = posInt(price, "price") ?? posInt(qty, "qty");
  if (bad) return refused(bad);
  const firm = world.firms[firmId];
  if (!firm) return refused(`no firm ${firmId}`);
  if (firm.folded) return refused(`${firmId} has folded`);
  if (firm.kind !== "privateHospital") {
    return refused(`${firmId} is not a private hospital`);
  }
  return ok({
    tag: "post",
    listing: {
      id: "",
      seller: firmId,
      kind: "cure",
      price,
      qty,
      payload: { disease },
    },
  });
}

export function postTuitionGate(
  world: World,
  firmId: Id,
  career: Career,
  price: Money,
  qty: Qty,
): GateResult {
  const bad = posInt(price, "price") ?? posInt(qty, "qty");
  if (bad) return refused(bad);
  const firm = world.firms[firmId];
  if (!firm) return refused(`no firm ${firmId}`);
  if (firm.folded) return refused(`${firmId} has folded`);
  if (firm.kind !== "privateUniversity") {
    return refused(`${firmId} is not a private university`);
  }
  return ok({
    tag: "post",
    listing: {
      id: "",
      seller: firmId,
      kind: "good",
      price,
      qty,
      payload: { good: "tuition", career },
    },
  });
}

function bundleQty(qty: Qty, bundle: Qty, name: string): string | null {
  if (qty !== 0 && qty !== bundle) return `${name} qty must be 0 or ${bundle}`;
  return null;
}

/** Inability to pay the posted bundle is a refusal. A short listing commits
 *  qty 0. The buyer must hold the disease either way. */
export function buyCureGate(
  world: World,
  personId: Id,
  disease: Disease,
  listingId: Id,
  qty: Qty,
): GateResult {
  const bad = bundleQty(qty, params.cureSize, "cure");
  if (bad) return refused(bad);
  const person = world.people[personId];
  if (!person) return refused(`no person ${personId}`);
  if (!person.alive) return refused(`${personId} is already dead`);
  if (!person.diseases.includes(disease)) {
    return refused(`${personId} does not have ${disease}`);
  }
  if (qty === 0) {
    return ok({ tag: "buyCure", person: personId, listing: listingId, qty: 0 });
  }
  const listing = world.listings.find((row) => row.id === listingId);
  if (!listing || listing.kind !== "cure") return refused(`no cure listing ${listingId}`);
  if (diseaseOf(listing.payload) !== disease) {
    return refused(`${listingId} is not ${disease}`);
  }
  const firm = world.firms[listing.seller];
  if (!firm || firm.kind !== "privateHospital") {
    return refused(`${listingId} is not a private hospital`);
  }
  if (listing.qty < qty) {
    return refused(`listing ${listingId} has ${listing.qty}, short of ${qty}`);
  }
  const cost = listing.price * qty;
  if (!Number.isSafeInteger(cost)) return refused("price × qty is not a safe integer");
  const short = funds(world, personId, cost);
  if (short) return refused(short);
  return ok({ tag: "buyCure", person: personId, listing: listingId, qty });
}

export function buyTuitionGate(
  world: World,
  personId: Id,
  career: Career,
  listingId: Id,
  qty: Qty,
): GateResult {
  const bad = bundleQty(qty, params.unitsPerLevel, "tuition");
  if (bad) return refused(bad);
  const person = world.people[personId];
  if (!person) return refused(`no person ${personId}`);
  if (!person.alive) return refused(`${personId} is already dead`);
  if (qty === 0) {
    return ok({ tag: "buyTuition", person: personId, listing: listingId, qty: 0 });
  }
  const listing = world.listings.find((row) => row.id === listingId);
  if (!listing) return refused(`no tuition listing ${listingId}`);
  if (tuitionCareer(listing.payload) !== career) {
    return refused(`${listingId} is not ${career}`);
  }
  const firm = world.firms[listing.seller];
  if (!firm || firm.kind !== "privateUniversity") {
    return refused(`${listingId} is not a private university`);
  }
  if (listing.qty < qty) {
    return refused(`listing ${listingId} has ${listing.qty}, short of ${qty}`);
  }
  const cost = listing.price * qty;
  if (!Number.isSafeInteger(cost)) return refused("price × qty is not a safe integer");
  const short = funds(world, personId, cost);
  if (short) return refused(short);
  return ok({ tag: "buyTuition", person: personId, listing: listingId, qty });
}
