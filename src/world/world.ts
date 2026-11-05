// world.ts — the worker's writeback. bwdS = applyEffect.
//
// The reducer accepts an effect and does not judge it again. assertInvariant
// runs after every effect and throws on a leak. That throw is a bug, not a
// refusal. A refusal never becomes an effect.
//
// Net financial assets, the quantity the flow column is checked against:
//   a person, firm, or the government — deposits, minus bank-loan principal
//     owed, plus private-loan principal held, minus private-loan principal
//     issued;
//   a bank — equity.
// Interbank claims and deposit liabilities are inside the bank-sheet identity
// (equity = loansOutstanding + depositLiability + signed interbank), so they
// are not added on top of equity. Share units are a separate instrument, not
// money, so they are not in NFA. Each effect records flow lines independently
// of that diff; applyEffect throws if the lines do not equal the diff.

import { params } from "./params.ts";
import type {
  BankId,
  Career,
  Deposits,
  Effect,
  FlowEntry,
  House,
  Id,
  Listing,
  Loan,
  Machine,
  Material,
  Money,
  Person,
  Qty,
  World,
} from "./types.ts";
import {
  CAREERS,
  consumptionGood,
  diseaseOf,
  houseOf,
  isBankId,
  otherBank,
  shareBank,
  signedInterbank,
  tuitionCareer,
} from "./types.ts";

export class LeakError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LeakError";
  }
}

export function purseOf(world: World, id: Id): Deposits | null {
  if (world.people[id]) return world.people[id].deposits;
  if (world.firms[id]) return world.firms[id].deposits;
  if (world.government.id === id) return world.government.deposits;
  return null;
}

function setPurse(world: World, id: Id, deposits: Deposits): World {
  if (world.people[id]) {
    return {
      ...world,
      people: { ...world.people, [id]: { ...world.people[id], deposits } },
    };
  }
  if (world.firms[id]) {
    return {
      ...world,
      firms: { ...world.firms, [id]: { ...world.firms[id], deposits } },
    };
  }
  if (world.government.id === id) {
    return { ...world, government: { ...world.government, deposits } };
  }
  throw new LeakError(`no purse for ${id}`);
}

function credit(world: World, id: Id, bank: BankId, delta: Money): World {
  const p = purseOf(world, id);
  if (!p) throw new LeakError(`no purse for ${id}`);
  return setPurse(world, id, { ...p, [bank]: p[bank] + delta });
}

function takeId(world: World, prefix: string): { world: World; id: Id } {
  const id = `${prefix}-${world.nextId}`;
  return { world: { ...world, nextId: world.nextId + 1 }, id };
}

export function holderIds(world: World): Id[] {
  return [
    ...Object.keys(world.people),
    ...Object.keys(world.firms),
    world.government.id,
    "a",
    "b",
  ];
}

export function nfa(world: World, id: Id): Money {
  if (isBankId(id)) return world.banks[id].equity;
  const purse = purseOf(world, id);
  let n = purse ? purse.a + purse.b : 0;
  for (const loan of Object.values(world.loans)) {
    if (loan.kind === "bank" && loan.borrower === id) n -= loan.principal;
    if (loan.kind === "private" && loan.holder === id) n += loan.principal;
    if (loan.kind === "private" && loan.issuer === id) n -= loan.principal;
  }
  return n;
}

export function moneySupply(world: World): Money {
  let s = 0;
  for (const id of holderIds(world)) {
    if (isBankId(id)) continue;
    const p = purseOf(world, id);
    if (p) s += p.a + p.b;
  }
  return s;
}

export function depositsAt(world: World, bank: BankId): Money {
  let s = 0;
  for (const id of holderIds(world)) {
    if (isBankId(id)) continue;
    const p = purseOf(world, id);
    if (p) s += p[bank];
  }
  return s;
}

/** Reference ore price. Milestones 0–5 record no independent unit sale, so the
 *  carried initial reference is the whole rule. `world` is in the signature
 *  because a later market pass reads it. */
export function refPrice(_world: World, material: Material): Money {
  return params.initialRef[material];
}

export function markedMineBase(world: World, bank: BankId): Money {
  let s = 0;
  for (const mine of Object.values(world.mines)) {
    if (mine.depositedAt === bank) s += mine.stock * refPrice(world, mine.material);
  }
  return s;
}

export function collateralValue(world: World, id: Id): Money | null {
  const house = world.houses[id];
  if (house) return house.units * params.houseUnitValue;
  const mine = world.mines[id];
  if (mine) return mine.stock * refPrice(world, mine.material);
  return null;
}

export type Instrument =
  | "deposits"
  | "loans"
  | "privateLoans"
  | "shares"
  | "interbank";

export function instrumentSums(world: World): Record<Instrument, Money> {
  const depositAssets = depositsAt(world, "a") + depositsAt(world, "b");
  const depositLiabilities = world.banks.a.depositLiability +
    world.banks.b.depositLiability;

  let loanLiabilities = 0;
  let privateNet = 0;
  for (const loan of Object.values(world.loans)) {
    if (loan.kind === "bank") loanLiabilities -= loan.principal;
    else {
      privateNet += loan.principal;
      privateNet -= loan.principal;
    }
  }
  const loansOutstanding = world.banks.a.loansOutstanding +
    world.banks.b.loansOutstanding;

  let shareUnits = 0;
  for (const share of Object.values(world.shares)) shareUnits += share.units;
  const sharesOutstanding = world.banks.a.sharesOutstanding +
    world.banks.b.sharesOutstanding;

  return {
    deposits: depositAssets + depositLiabilities,
    loans: loansOutstanding + loanLiabilities,
    privateLoans: privateNet,
    shares: shareUnits - sharesOutstanding,
    interbank: world.interbank + -world.interbank,
  };
}

function assertInteger(name: string, n: number): void {
  if (!Number.isInteger(n)) throw new LeakError(`${name} is not an integer`);
}

/** Stock laws. Throws LeakError naming the instrument when a row does not close. */
export function assertInvariant(world: World): void {
  for (const bank of ["a", "b"] as const) {
    const b = world.banks[bank];
    assertInteger(`${bank}.equity`, b.equity);
    assertInteger(`${bank}.depositLiability`, b.depositLiability);
    assertInteger(`${bank}.loansOutstanding`, b.loansOutstanding);
    assertInteger(`${bank}.sharesOutstanding`, b.sharesOutstanding);
    const at = depositsAt(world, bank);
    if (b.depositLiability !== -at) {
      throw new LeakError(
        `deposits: ${bank} liability ${b.depositLiability} ≠ -${at}`,
      );
    }
    let principals = 0;
    for (const loan of Object.values(world.loans)) {
      if (loan.kind === "bank" && loan.bank === bank) principals += loan.principal;
    }
    if (b.loansOutstanding !== principals) {
      throw new LeakError(
        `loans: ${bank} outstanding ${b.loansOutstanding} ≠ principals ${principals}`,
      );
    }
    let units = 0;
    for (const share of Object.values(world.shares)) {
      if (share.bank === bank) units += share.units;
    }
    if (b.sharesOutstanding !== units) {
      throw new LeakError(
        `shares: ${bank} outstanding ${b.sharesOutstanding} ≠ units ${units}`,
      );
    }
    const sheet = b.loansOutstanding + b.depositLiability +
      signedInterbank(bank, world.interbank);
    if (b.equity !== sheet) {
      throw new LeakError(
        `equity: ${bank} equity ${b.equity} ≠ loans + deposits + interbank ${sheet}`,
      );
    }
  }

  const sums = instrumentSums(world);
  for (const name of Object.keys(sums) as Instrument[]) {
    if (sums[name] !== 0) {
      throw new LeakError(`${name} sums to ${sums[name]}, not 0`);
    }
  }

  let totalNfa = 0;
  for (const id of holderIds(world)) totalNfa += nfa(world, id);
  if (totalNfa !== 0) throw new LeakError(`nfa sums to ${totalNfa}, not 0`);

  for (const house of Object.values(world.houses)) {
    if (house.units <= 0 || house.units % 10 !== 0) {
      throw new LeakError(
        `house ${house.id} units ${house.units} are not a positive multiple of 10`,
      );
    }
  }
  for (const mine of Object.values(world.mines)) {
    if (mine.stock < 0) throw new LeakError(`mine ${mine.id} stock is negative`);
    if (mine.depositedAt !== null && !isBankId(mine.owner)) {
      throw new LeakError(`mine ${mine.id} is deposited but owned by ${mine.owner}`);
    }
  }
  for (const line of world.flows) assertInteger(`flow ${line.row}`, line.amount);

  for (const person of Object.values(world.people)) {
    if (person.alive) continue;
    if (person.deposits.a !== 0 || person.deposits.b !== 0) {
      throw new LeakError(`${person.id} is dead and still holds deposits`);
    }
    if (person.firm !== null) {
      throw new LeakError(`${person.id} is dead and still owns ${person.firm}`);
    }
    for (const house of Object.values(world.houses)) {
      if (house.owner === person.id) {
        throw new LeakError(`${person.id} is dead and still owns ${house.id}`);
      }
    }
    for (const share of Object.values(world.shares)) {
      if (share.holder === person.id && share.units > 0) {
        throw new LeakError(`${person.id} is dead and still holds ${share.id}`);
      }
    }
    for (const loan of Object.values(world.loans)) {
      if (loan.kind === "private" && loan.holder === person.id && loan.principal > 0) {
        throw new LeakError(`${person.id} is dead and still holds ${loan.id}`);
      }
    }
    for (const mine of Object.values(world.mines)) {
      if (mine.owner === person.id) {
        throw new LeakError(`${person.id} is dead and still owns ${mine.id}`);
      }
    }
    for (const firm of Object.values(world.firms)) {
      if (firm.owner === person.id) {
        throw new LeakError(`${person.id} is dead and still owns ${firm.id}`);
      }
    }
  }
}

function linesOf(built: FlowEntry[], month: number): FlowEntry[] {
  return built.map((l) => ({ ...l, month }));
}

function withFlows(before: World, after: World, lines: FlowEntry[]): World {
  const next: World = { ...after, flows: [...before.flows, ...lines] };
  const ids = new Set<Id>([...holderIds(before), ...holderIds(after)]);
  for (const line of lines) ids.add(line.holder);
  for (const id of ids) {
    const d = nfa(next, id) - nfa(before, id);
    const f = lines.filter((l) => l.holder === id).reduce((s, l) => s + l.amount, 0);
    if (d !== f) {
      throw new LeakError(`flow column ${id}: recorded ${f} ≠ ΔNFA ${d}`);
    }
  }
  const rows = new Map<string, number>();
  for (const line of next.flows) {
    rows.set(line.row, (rows.get(line.row) ?? 0) + line.amount);
  }
  for (const [row, sum] of rows) {
    if (sum !== 0) throw new LeakError(`flow row ${row} sums to ${sum}, not 0`);
  }
  assertInvariant(next);
  return next;
}

function pair(
  month: number,
  row: FlowEntry["row"],
  from: Id,
  to: Id,
  amount: Money,
): FlowEntry[] {
  if (amount === 0) return [];
  return [
    { month, row, holder: from, amount: -amount },
    { month, row, holder: to, amount },
  ];
}

/** Debit `from`'s largest balance first. Credit `to` at each bank that was
 *  debited, so that bank's deposit liability is unchanged. */
function payAcrossHolders(world: World, from: Id, to: Id, amount: Money): World {
  const purse = purseOf(world, from);
  if (!purse) throw new LeakError(`no purse for ${from}`);
  const order: BankId[] = purse.a > purse.b
    ? ["a", "b"]
    : purse.b > purse.a
    ? ["b", "a"]
    : ["a", "b"];
  let left = amount;
  let next = world;
  for (const bank of order) {
    const have = purseOf(next, from)![bank];
    const take = Math.min(have, left);
    if (take <= 0) continue;
    next = credit(next, from, bank, -take);
    next = credit(next, to, bank, take);
    left -= take;
  }
  if (left !== 0) {
    throw new LeakError(`pay of ${amount} from ${from} could not be funded`);
  }
  return next;
}

/** Share units move. The bank's shares outstanding do not. A buyer with no
 *  record of that bank receives a new one. An emptied record is dropped. */
function moveShareUnits(
  world: World,
  bank: BankId,
  from: Id,
  to: Id,
  qty: Qty,
): World {
  if (from === to) throw new LeakError(`${from} cannot buy their own shares`);
  let left = qty;
  let shares = { ...world.shares };
  const records = Object.values(shares)
    .filter((share) => share.bank === bank && share.holder === from)
    .sort((x, y) => x.id < y.id ? -1 : x.id > y.id ? 1 : 0);
  for (const rec of records) {
    if (left <= 0) break;
    const take = Math.min(rec.units, left);
    left -= take;
    if (rec.units === take) {
      const { [rec.id]: _gone, ...rest } = shares;
      shares = rest;
    } else {
      shares = { ...shares, [rec.id]: { ...rec, units: rec.units - take } };
    }
  }
  if (left !== 0) {
    throw new LeakError(`${from} holds too few ${bank} shares to move ${qty}`);
  }
  const held = Object.values(shares)
    .filter((share) => share.bank === bank && share.holder === to)
    .sort((x, y) => x.id < y.id ? -1 : x.id > y.id ? 1 : 0);
  if (held.length > 0) {
    const rec = held[0];
    return {
      ...world,
      shares: { ...shares, [rec.id]: { ...rec, units: rec.units + qty } },
    };
  }
  const taken = takeId({ ...world, shares }, "share");
  return {
    ...taken.world,
    shares: {
      ...taken.world.shares,
      [taken.id]: { id: taken.id, bank, holder: to, units: qty },
    },
  };
}

/** Anyone whose dwelling is this house loses it, and the house loses its occupant. */
function clearDwelling(world: World, houseId: Id): World {
  const house = world.houses[houseId];
  if (!house) return world;
  let people = world.people;
  for (const person of Object.values(people)) {
    if (person.dwelling !== houseId) continue;
    people = { ...people, [person.id]: { ...person, dwelling: null } };
  }
  return {
    ...world,
    people,
    houses: { ...world.houses, [houseId]: { ...house, occupant: null } },
  };
}

/** Pay `amount` to a bank. Funds at that bank are destroyed into equity, so the
 *  money supply, and with it the sum of deposit liabilities, moves by the same
 *  amount. A shortfall is funded at the other bank and booked as that bank's
 *  claim. A person-to-person pay never comes through here, and never moves
 *  interbank. */
function payToBank(world: World, from: Id, bank: BankId, amount: Money): World {
  const purse = purseOf(world, from);
  if (!purse) throw new LeakError(`no purse for ${from}`);
  const here = Math.min(purse[bank], amount);
  const rest = amount - here;
  let next = world;
  if (here > 0) {
    next = credit(next, from, bank, -here);
    const b = next.banks[bank];
    next = {
      ...next,
      banks: {
        ...next.banks,
        [bank]: {
          ...b,
          depositLiability: b.depositLiability + here,
          equity: b.equity + here,
        },
      },
    };
  }
  if (rest > 0) {
    const other = otherBank(bank);
    const there = purseOf(next, from)![other];
    if (there < rest) {
      throw new LeakError(`pay of ${amount} to ${bank} could not be funded`);
    }
    next = credit(next, from, other, -rest);
    const payerBank = next.banks[other];
    const payee = next.banks[bank];
    // The other bank owes the payee. Claim of a on b moves accordingly.
    const interbank = next.interbank + (bank === "a" ? rest : -rest);
    next = {
      ...next,
      interbank,
      banks: {
        ...next.banks,
        [other]: { ...payerBank, depositLiability: payerBank.depositLiability + rest },
        [bank]: { ...payee, equity: payee.equity + rest },
      },
    };
  }
  return next;
}

/** Take `amount` from the borrower's deposit at `bank` first, then the other
 *  bank, booking interbank the same way as a payment to `bank`. Equity is not
 *  touched: this funds a principal repayment, which destroys deposits. */
function fundRepayment(world: World, from: Id, bank: BankId, amount: Money): World {
  const purse = purseOf(world, from);
  if (!purse) throw new LeakError(`no purse for ${from}`);
  const here = Math.min(purse[bank], amount);
  const rest = amount - here;
  let next = world;
  if (here > 0) {
    next = credit(next, from, bank, -here);
    const b = next.banks[bank];
    next = {
      ...next,
      banks: {
        ...next.banks,
        [bank]: { ...b, depositLiability: b.depositLiability + here },
      },
    };
  }
  if (rest > 0) {
    const other = otherBank(bank);
    if (purseOf(next, from)![other] < rest) {
      throw new LeakError(`repay of ${amount} to ${bank} could not be funded`);
    }
    next = credit(next, from, other, -rest);
    const payerBank = next.banks[other];
    const interbank = next.interbank + (bank === "a" ? rest : -rest);
    next = {
      ...next,
      interbank,
      banks: {
        ...next.banks,
        [other]: { ...payerBank, depositLiability: payerBank.depositLiability + rest },
      },
    };
  }
  return next;
}

function setLien(world: World, collateral: Id, loanId: Id | null): World {
  if (world.houses[collateral]) {
    return {
      ...world,
      houses: {
        ...world.houses,
        [collateral]: { ...world.houses[collateral], lien: loanId },
      },
    };
  }
  if (world.mines[collateral]) {
    return {
      ...world,
      mines: {
        ...world.mines,
        [collateral]: { ...world.mines[collateral], lien: loanId },
      },
    };
  }
  return world;
}

function clearLien(world: World, loanId: Id): World {
  let next = world;
  for (const house of Object.values(world.houses)) {
    if (house.lien === loanId) next = setLien(next, house.id, null);
  }
  for (const mine of Object.values(world.mines)) {
    if (mine.lien === loanId) next = setLien(next, mine.id, null);
  }
  return next;
}

function dropLoan(world: World, id: Id): World {
  const loans = { ...world.loans };
  delete loans[id];
  return clearLien({ ...world, loans }, id);
}

function writeOffNumbers(world: World, loan: Loan): { world: World; lines: FlowEntry[] } {
  const month = world.month;
  if (loan.kind === "private") {
    const next = dropLoan(world, loan.id);
    return {
      world: next,
      lines: pair(month, "writeOff", loan.holder, loan.issuer, loan.principal),
    };
  }
  const bank = world.banks[loan.bank];
  const stripped = dropLoan(world, loan.id);
  const next: World = {
    ...stripped,
    banks: {
      ...stripped.banks,
      [loan.bank]: {
        ...stripped.banks[loan.bank],
        loansOutstanding: bank.loansOutstanding - loan.principal,
        equity: bank.equity - loan.principal,
        losses: bank.losses + loan.principal,
      },
    },
  };
  return {
    world: next,
    lines: pair(month, "writeOff", loan.bank, loan.borrower, loan.principal),
  };
}

function blankEducation(): Record<Career, number> {
  return Object.fromEntries(CAREERS.map((career) => [career, 0])) as Record<
    Career,
    number
  >;
}

/** Prefer a house that is not the dwelling, then the lowest id. */
function giftSource(world: World, parentId: Id): House | null {
  const person = world.people[parentId];
  if (!person) return null;
  const rows = Object.values(world.houses)
    .filter((house) => {
      if (house.owner !== parentId || house.lien !== null) return false;
      const reserved = house.id === person.dwelling ? params.houseQuantum : 0;
      return house.units - reserved >= params.houseQuantum;
    })
    .sort((x, y) => {
      const xd = x.id === person.dwelling ? 1 : 0;
      const yd = y.id === person.dwelling ? 1 : 0;
      if (xd !== yd) return xd - yd;
      return x.id < y.id ? -1 : x.id > y.id ? 1 : 0;
    });
  return rows[0] ?? null;
}

function giveHouse(
  world: World,
  house: House,
  personId: Id,
  units: number,
): { world: World; houseId: Id } {
  if (!Number.isInteger(units) || units <= 0 || units % params.houseQuantum !== 0) {
    throw new LeakError(`grant of ${units} is not a positive quantum`);
  }
  if (units > house.units) {
    throw new LeakError(`${house.id} has ${house.units}, short of ${units}`);
  }
  const person = world.people[personId];
  if (!person || !person.alive) throw new LeakError(`no living person ${personId}`);
  if (house.lien !== null) throw new LeakError(`lien blocks grant of ${house.id}`);
  if (!world.people[house.owner]) {
    throw new LeakError(`${house.id} is not owned by a person`);
  }

  let next = world;
  let grantedId = house.id;
  let houses = { ...world.houses };
  if (units < house.units) {
    const taken = takeId(world, "house");
    next = taken.world;
    grantedId = taken.id;
    houses = {
      ...taken.world.houses,
      [house.id]: { ...house, units: house.units - units },
      [grantedId]: {
        id: grantedId,
        units,
        owner: personId,
        occupant: null,
        lien: null,
      },
    };
  } else {
    houses = {
      ...houses,
      [house.id]: { ...house, owner: personId, occupant: null },
    };
  }

  let people = { ...next.people };
  if (person.dwelling === null) {
    houses = {
      ...houses,
      [grantedId]: { ...houses[grantedId], occupant: personId },
    };
    people = {
      ...people,
      [personId]: { ...people[personId], dwelling: grantedId },
    };
  }
  return { world: { ...next, houses, people }, houseId: grantedId };
}

/** Deposits, receivables, shares, mines, leftover houses, and firms. */
function convey(
  world: World,
  from: Id,
  to: Id,
): { world: World; lines: FlowEntry[] } {
  if (from === to) throw new LeakError(`${from} cannot receive their own estate`);
  if (!purseOf(world, to)) throw new LeakError(`no purse for ${to}`);
  const month = world.month;
  let lines: FlowEntry[] = [];
  let next = world;

  const purse = purseOf(next, from);
  const cash = purse ? purse.a + purse.b : 0;
  if (cash > 0) {
    next = payAcrossHolders(next, from, to, cash);
    lines = pair(month, "estate", from, to, cash);
  }

  let shares = { ...next.shares };
  for (const share of Object.values(world.shares)) {
    if (share.holder !== from || share.units <= 0) continue;
    shares = { ...shares, [share.id]: { ...share, holder: to } };
  }
  next = { ...next, shares };

  let loans = { ...next.loans };
  for (const loan of Object.values(world.loans)) {
    if (loan.kind !== "private" || loan.holder !== from) continue;
    loans = { ...loans, [loan.id]: { ...loan, holder: to } };
    lines = [...lines, ...pair(month, "Δprivate", from, to, loan.principal)];
  }
  next = { ...next, loans };

  let mines = { ...next.mines };
  for (const mine of Object.values(world.mines)) {
    if (mine.owner !== from) continue;
    if (mine.depositedAt !== null) continue;
    if (mine.lien !== null) throw new LeakError(`lien remains on ${mine.id}`);
    mines = { ...mines, [mine.id]: { ...mine, owner: to } };
  }
  next = { ...next, mines };

  let houses = { ...next.houses };
  for (const house of Object.values(world.houses)) {
    if (house.owner !== from) continue;
    if (house.lien !== null) throw new LeakError(`lien remains on ${house.id}`);
    const occupant = house.occupant === from ? null : house.occupant;
    houses = { ...houses, [house.id]: { ...house, owner: to, occupant } };
  }
  next = { ...next, houses };

  let firms = { ...next.firms };
  for (const firm of Object.values(world.firms)) {
    if (firm.owner !== from) continue;
    firms = { ...firms, [firm.id]: { ...firm, owner: to } };
  }
  next = { ...next, firms };

  const gone = next.people[from];
  if (gone) {
    next = {
      ...next,
      people: { ...next.people, [from]: { ...gone, firm: null } },
    };
  }
  const heir = next.people[to];
  if (heir && heir.firm === null) {
    const owned = Object.values(next.firms)
      .filter((firm) => firm.owner === to)
      .sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
    if (owned.length > 0) {
      next = {
        ...next,
        people: { ...next.people, [to]: { ...heir, firm: owned[0].id } },
      };
    }
  }
  return { world: next, lines };
}

function bear(world: World, parentId: Id): { world: World; lines: FlowEntry[] } {
  const parent = world.people[parentId];
  if (!parent || !parent.alive) throw new LeakError(`no living parent ${parentId}`);
  const source = giftSource(world, parentId);
  if (!source) throw new LeakError(`${parentId} has no house to give`);
  const childTaken = takeId(world, "child");
  let next = childTaken.world;
  const childId = childTaken.id;
  const quantum = params.houseQuantum;
  let houseId = source.id;
  let houses = { ...next.houses };
  if (source.units === quantum) {
    houses = {
      ...houses,
      [source.id]: { ...source, owner: childId, occupant: childId },
    };
  } else {
    const houseTaken = takeId(next, "house");
    next = houseTaken.world;
    houseId = houseTaken.id;
    houses = {
      ...houseTaken.world.houses,
      [source.id]: { ...source, units: source.units - quantum },
      [houseId]: {
        id: houseId,
        units: quantum,
        owner: childId,
        occupant: childId,
        lien: null,
      },
    };
  }
  const child: Person = {
    id: childId,
    alive: true,
    objective: parent.objective,
    health: 0,
    happiness: 0,
    education: blankEducation(),
    diseases: [],
    assignment: null,
    starvation: 0,
    job: null,
    dwelling: houseId,
    parent: parentId,
    children: [],
    firm: null,
    deposits: { a: 0, b: 0 },
  };
  const mother = next.people[parentId];
  next = {
    ...next,
    houses,
    people: {
      ...next.people,
      [childId]: child,
      [parentId]: { ...mother, children: [...mother.children, childId] },
    },
  };
  next = payAcrossHolders(next, parentId, childId, params.cashGift);
  return {
    world: next,
    lines: pair(next.month, "estate", parentId, childId, params.cashGift),
  };
}

function applyBare(world: World, effect: Effect): { world: World; lines: FlowEntry[] } {
  const month = world.month;
  switch (effect.tag) {
    case "pay": {
      if (isBankId(effect.from)) {
        throw new LeakError("a bank does not pay through pay; use dividend");
      }
      const next = isBankId(effect.to)
        ? payToBank(world, effect.from, effect.to, effect.amount)
        : payAcrossHolders(world, effect.from, effect.to, effect.amount);
      return {
        world: next,
        lines: pair(month, effect.row, effect.from, effect.to, effect.amount),
      };
    }
    case "lendBank": {
      const taken = takeId(world, "loan");
      const loan: Loan = {
        kind: "bank",
        id: taken.id,
        bank: effect.bank,
        borrower: effect.borrower,
        principal: effect.amount,
        installment: effect.installment,
        months: effect.months,
        collateral: effect.collateral,
      };
      let next = credit(taken.world, effect.borrower, effect.bank, effect.amount);
      const bank = next.banks[effect.bank];
      next = {
        ...next,
        loans: { ...next.loans, [loan.id]: loan },
        banks: {
          ...next.banks,
          [effect.bank]: {
            ...bank,
            depositLiability: bank.depositLiability - effect.amount,
            loansOutstanding: bank.loansOutstanding + effect.amount,
          },
        },
      };
      next = setLien(next, effect.collateral, loan.id);
      return { world: next, lines: [] };
    }
    case "repayBank": {
      const loan = world.loans[effect.loan];
      if (!loan || loan.kind !== "bank") {
        throw new LeakError(`no bank loan ${effect.loan}`);
      }
      let next = fundRepayment(world, loan.borrower, loan.bank, effect.amount);
      const bank = next.banks[loan.bank];
      const remaining = loan.principal - effect.amount;
      if (remaining === 0) {
        next = dropLoan(next, loan.id);
      } else {
        next = {
          ...next,
          loans: { ...next.loans, [loan.id]: { ...loan, principal: remaining } },
        };
      }
      next = {
        ...next,
        banks: {
          ...next.banks,
          [loan.bank]: {
            ...bank,
            loansOutstanding: bank.loansOutstanding - effect.amount,
          },
        },
      };
      return { world: next, lines: [] };
    }
    case "issuePrivate": {
      const taken = takeId(world, "debt");
      let next = payAcrossHolders(
        taken.world,
        effect.holder,
        effect.issuer,
        effect.principal,
      );
      const loan: Loan = {
        kind: "private",
        id: taken.id,
        issuer: effect.issuer,
        holder: effect.holder,
        principal: effect.principal,
        installment: effect.installment,
        months: effect.months,
        issuerKind: effect.issuerKind,
      };
      next = { ...next, loans: { ...next.loans, [loan.id]: loan } };
      return { world: next, lines: [] };
    }
    case "transferPrivate": {
      const loan = world.loans[effect.instrument];
      if (!loan || loan.kind !== "private") {
        throw new LeakError(`no private loan ${effect.instrument}`);
      }
      const nextWorld = payAcrossHolders(world, effect.to, effect.from, effect.price);
      const moved: Loan = { ...loan, holder: effect.to };
      const next = { ...nextWorld, loans: { ...nextWorld.loans, [loan.id]: moved } };
      const lines = [
        ...pair(month, "debtTrade", effect.to, effect.from, effect.price),
        ...pair(month, "Δprivate", effect.from, effect.to, loan.principal),
      ];
      return { world: next, lines };
    }
    case "writeOff": {
      const loan = world.loans[effect.instrument];
      if (!loan) throw new LeakError(`no loan ${effect.instrument}`);
      return writeOffNumbers(world, loan);
    }
    case "seize": {
      const loan = world.loans[effect.loan];
      if (!loan || loan.kind !== "bank") {
        throw new LeakError(`no bank loan ${effect.loan}`);
      }
      const written = writeOffNumbers(world, loan);
      let next = written.world;
      const house = next.houses[loan.collateral];
      const mine = next.mines[loan.collateral];
      if (house) {
        next = {
          ...next,
          houses: {
            ...next.houses,
            [house.id]: { ...house, owner: loan.bank, lien: null },
          },
        };
      } else if (mine) {
        next = {
          ...next,
          mines: {
            ...next.mines,
            [mine.id]: { ...mine, owner: loan.bank, lien: null },
          },
        };
      }
      return { world: next, lines: written.lines };
    }
    case "depositMine": {
      const mine = world.mines[effect.mine];
      if (!mine) throw new LeakError(`no mine ${effect.mine}`);
      const previous = mine.owner;
      const taken = takeId(world, "share");
      const bank = world.banks[effect.bank];
      const next: World = {
        ...taken.world,
        mines: {
          ...world.mines,
          [mine.id]: { ...mine, owner: effect.bank, depositedAt: effect.bank },
        },
        shares: {
          ...world.shares,
          [taken.id]: {
            id: taken.id,
            bank: effect.bank,
            holder: previous,
            units: effect.shares,
          },
        },
        banks: {
          ...world.banks,
          [effect.bank]: {
            ...bank,
            sharesOutstanding: bank.sharesOutstanding + effect.shares,
          },
        },
      };
      return { world: next, lines: [] };
    }
    case "dividend": {
      const bank = world.banks[effect.bank];
      const shares = Object.values(world.shares)
        .filter((s) => s.bank === effect.bank)
        .sort((x, y) => x.id < y.id ? -1 : x.id > y.id ? 1 : 0);
      let paid = 0;
      const cuts: { holder: Id; cut: Money }[] = [];
      for (const share of shares) {
        const cut = Math.floor(bank.equity * share.units / bank.sharesOutstanding);
        if (cut > 0) {
          cuts.push({ holder: share.holder, cut });
          paid += cut;
        }
      }
      let next = world;
      for (const { holder, cut } of cuts) {
        next = credit(next, holder, effect.bank, cut);
      }
      const b = next.banks[effect.bank];
      next = {
        ...next,
        banks: {
          ...next.banks,
          [effect.bank]: {
            ...b,
            equity: b.equity - paid,
            depositLiability: b.depositLiability - paid,
          },
        },
      };
      const lines: FlowEntry[] = [];
      if (paid !== 0) {
        lines.push({ month, row: "dividend", holder: effect.bank, amount: -paid });
        for (const { holder, cut } of cuts) {
          lines.push({ month, row: "dividend", holder, amount: cut });
        }
      }
      return { world: next, lines };
    }
    case "post": {
      // The gate's listing id is a placeholder. Minting here keeps two posts
      // gated against the same world from colliding, and consumes nextId.
      const taken = takeId(world, "list");
      const listing = { ...effect.listing, id: taken.id };
      return {
        world: { ...taken.world, listings: [...world.listings, listing] },
        lines: [],
      };
    }
    case "setLoanRate": {
      const bank = world.banks[effect.bank];
      return {
        world: {
          ...world,
          banks: {
            ...world.banks,
            [effect.bank]: { ...bank, loanRate: effect.rate },
          },
        },
        lines: [],
      };
    }
    case "draw": {
      const firm = world.firms[effect.firm];
      if (!firm) throw new LeakError(`no firm ${effect.firm}`);
      if (firm.owner !== effect.owner) {
        throw new LeakError(`${effect.owner} does not own ${effect.firm}`);
      }
      const next = payAcrossHolders(world, effect.firm, effect.owner, effect.amount);
      return {
        world: next,
        lines: pair(month, "profitDraw", effect.firm, effect.owner, effect.amount),
      };
    }
    case "fill": {
      // A zero fill is a committed outcome. No money moves, and the listing
      // stays where it is, including when the id is empty because nothing was posted.
      if (effect.qty === 0) return { world, lines: [] };
      if (!Number.isInteger(effect.qty) || effect.qty < 0) {
        throw new LeakError(`fill qty ${effect.qty} is not a non-negative integer`);
      }
      const listing = world.listings.find((l) => l.id === effect.listing);
      if (!listing) throw new LeakError(`no listing ${effect.listing}`);
      const good = consumptionGood(listing.payload);
      if (!good) {
        throw new LeakError(`${effect.listing} is not a consumption good`);
      }
      if (listing.qty < effect.qty) {
        throw new LeakError(
          `listing ${effect.listing} has ${listing.qty}, short of ${effect.qty}`,
        );
      }
      const firm = world.firms[listing.seller];
      if (!firm) throw new LeakError(`no firm ${listing.seller}`);
      const stock = firm.inventory[good] ?? 0;
      if (stock < effect.qty) {
        throw new LeakError(`${good} inventory ${stock} is short of ${effect.qty}`);
      }
      const cost = listing.price * effect.qty;
      if (!Number.isSafeInteger(cost) || cost <= 0) {
        throw new LeakError(`price × qty ${cost} is not a positive safe integer`);
      }
      if (!world.people[effect.buyer]) throw new LeakError(`no person ${effect.buyer}`);
      let next = payAcrossHolders(world, effect.buyer, listing.seller, cost);
      const seller = next.firms[firm.id];
      next = {
        ...next,
        listings: next.listings.map((l) =>
          l.id === listing.id ? { ...l, qty: l.qty - effect.qty } : l
        ),
        firms: {
          ...next.firms,
          [firm.id]: {
            ...seller,
            inventory: {
              ...seller.inventory,
              [good]: stock - effect.qty,
            },
          },
        },
      };
      return {
        world: next,
        lines: pair(month, good, effect.buyer, listing.seller, cost),
      };
    }
    case "tradeShare": {
      if (effect.qty === 0) return { world, lines: [] };
      const listing = world.listings.find((l) => l.id === effect.listing);
      if (!listing || listing.kind !== "share") {
        throw new LeakError(`no share listing ${effect.listing}`);
      }
      const bank = shareBank(listing.payload);
      if (!bank) throw new LeakError(`${effect.listing} names no bank`);
      if (listing.qty < effect.qty) {
        throw new LeakError(
          `listing ${effect.listing} has ${listing.qty}, short of ${effect.qty}`,
        );
      }
      const cost = listing.price * effect.qty;
      if (!Number.isSafeInteger(cost) || cost <= 0) {
        throw new LeakError(`price × qty ${cost} is not a positive safe integer`);
      }
      let next = payAcrossHolders(world, effect.buyer, listing.seller, cost);
      next = moveShareUnits(next, bank, listing.seller, effect.buyer, effect.qty);
      next = {
        ...next,
        listings: next.listings.map((l) =>
          l.id === listing.id ? { ...l, qty: l.qty - effect.qty } : l
        ),
      };
      return {
        world: next,
        lines: pair(month, "shareTrade", effect.buyer, listing.seller, cost),
      };
    }
    case "transferHouse": {
      if (effect.qty === 0) return { world, lines: [] };
      if (effect.qty !== 1) {
        throw new LeakError(`a house sells as one unit, not ${effect.qty}`);
      }
      const listing = world.listings.find((l) => l.id === effect.listing);
      if (!listing || listing.kind !== "houseSale") {
        throw new LeakError(`no house listing ${effect.listing}`);
      }
      const houseId = houseOf(listing.payload);
      const house = houseId ? world.houses[houseId] : undefined;
      if (!house) throw new LeakError(`listing ${effect.listing} names no house`);
      if (house.lien) throw new LeakError(`lien blocks transfer of ${house.id}`);
      if (house.owner !== listing.seller) {
        throw new LeakError(`${listing.seller} does not own ${house.id}`);
      }
      if (listing.qty < 1) {
        throw new LeakError(`listing ${effect.listing} is already filled`);
      }
      const cost = listing.price;
      let next = payAcrossHolders(world, effect.buyer, listing.seller, cost);
      next = clearDwelling(next, house.id);
      next = {
        ...next,
        houses: {
          ...next.houses,
          [house.id]: { ...next.houses[house.id], owner: effect.buyer, occupant: null },
        },
        listings: next.listings.map((l) =>
          l.id === listing.id ? { ...l, qty: l.qty - 1 } : l
        ),
      };
      return {
        world: next,
        lines: pair(month, "houseTrade", effect.buyer, listing.seller, cost),
      };
    }
    case "occupy": {
      const house = world.houses[effect.house];
      if (!house) throw new LeakError(`no house ${effect.house}`);
      const owner = world.people[house.owner];
      if (!owner || !owner.alive) throw new LeakError(`no living owner for ${house.id}`);
      if (effect.mode === "let") {
        if (house.occupant !== owner.id) return { world, lines: [] };
        return {
          world: {
            ...world,
            people: {
              ...world.people,
              [owner.id]: {
                ...owner,
                dwelling: owner.dwelling === house.id ? null : owner.dwelling,
              },
            },
            houses: { ...world.houses, [house.id]: { ...house, occupant: null } },
          },
          lines: [],
        };
      }
      let next = world;
      if (house.occupant && house.occupant !== owner.id) {
        next = clearDwelling(next, house.id);
      }
      const moved = next.people[owner.id];
      if (moved.dwelling && moved.dwelling !== house.id) {
        const left = next.houses[moved.dwelling];
        if (left && left.occupant === owner.id) {
          next = {
            ...next,
            houses: { ...next.houses, [left.id]: { ...left, occupant: null } },
          };
        }
      }
      return {
        world: {
          ...next,
          people: {
            ...next.people,
            [owner.id]: { ...next.people[owner.id], dwelling: house.id },
          },
          houses: {
            ...next.houses,
            [house.id]: { ...next.houses[house.id], occupant: owner.id },
          },
        },
        lines: [],
      };
    }
    case "hire": {
      if (!effect.seated) return { world, lines: [] };
      const listing = world.listings.find((l) => l.id === effect.listing);
      if (
        !listing || listing.kind !== "job" || !listing.payload ||
        !("career" in listing.payload)
      ) {
        throw new LeakError(`no job listing ${effect.listing}`);
      }
      const payload = listing.payload;
      if (!("generation" in payload) || !("salary" in payload)) {
        throw new LeakError(`${effect.listing} is not a job`);
      }
      const person = world.people[effect.person];
      if (!person || !person.alive) {
        throw new LeakError(`no living person ${effect.person}`);
      }
      const incumbent = person.job !== null && person.job.firm === listing.seller &&
        person.job.career === payload.career;
      if (effect.keep && !incumbent) {
        throw new LeakError(`${person.id} is not the incumbent`);
      }
      if (!effect.keep && person.education[payload.career] < payload.generation) {
        throw new LeakError(
          `${person.id} is at level ${
            person.education[payload.career]
          } in ${payload.career}`,
        );
      }
      if (listing.qty < 1) throw new LeakError(`listing ${listing.id} has no seat left`);
      const salary = incumbent && person.job ? person.job.salary : payload.salary;
      return {
        world: {
          ...world,
          listings: world.listings.map((l) =>
            l.id === listing.id ? { ...l, qty: l.qty - 1 } : l
          ),
          people: {
            ...world.people,
            [person.id]: {
              ...person,
              job: { firm: listing.seller, career: payload.career, salary },
            },
          },
        },
        lines: [],
      };
    }
    case "deliverMachine": {
      if (effect.qty === 0) return { world, lines: [] };
      const listing = world.listings.find((l) => l.id === effect.listing);
      if (
        !listing || listing.kind !== "machine" || !listing.payload ||
        !("type" in listing.payload)
      ) {
        throw new LeakError(`no machine listing ${effect.listing}`);
      }
      const offer = listing.payload;
      if (!("generation" in offer)) {
        throw new LeakError(`${effect.listing} is not a machine`);
      }
      const buyer = world.firms[effect.firm];
      if (!buyer) throw new LeakError(`no firm ${effect.firm}`);
      if (!world.firms[listing.seller]) throw new LeakError(`no firm ${listing.seller}`);
      if (listing.qty < effect.qty) {
        throw new LeakError(
          `listing ${listing.id} has ${listing.qty}, short of ${effect.qty}`,
        );
      }
      const cost = listing.price * effect.qty;
      if (!Number.isSafeInteger(cost) || cost <= 0) {
        throw new LeakError(`price × qty ${cost} is not a positive safe integer`);
      }
      let next = payAcrossHolders(world, effect.firm, listing.seller, cost);
      const made: Machine[] = [];
      for (let i = 0; i < effect.qty; i++) {
        const taken = takeId(next, "machine");
        const machine: Machine = {
          id: taken.id,
          type: offer.type,
          generation: offer.generation,
          owner: effect.firm,
          builder: listing.seller,
        };
        made.push(machine);
        next = {
          ...taken.world,
          machines: { ...taken.world.machines, [machine.id]: machine },
        };
      }
      const firm = next.firms[effect.firm];
      next = {
        ...next,
        listings: next.listings.map((l) =>
          l.id === listing.id ? { ...l, qty: l.qty - effect.qty } : l
        ),
        firms: {
          ...next.firms,
          [firm.id]: { ...firm, machines: [...firm.machines, ...made.map((m) => m.id)] },
        },
      };
      return {
        world: next,
        lines: pair(month, "machinePurchase", effect.firm, listing.seller, cost),
      };
    }
    case "rent": {
      if (!effect.pay) return { world, lines: [] };
      const listing = world.listings.find((l) => l.id === effect.listing);
      if (!listing || listing.kind !== "rent") {
        throw new LeakError(`no rent listing ${effect.listing}`);
      }
      const houseId = houseOf(listing.payload);
      const house = houseId ? world.houses[houseId] : undefined;
      if (!house) throw new LeakError(`listing ${effect.listing} names no house`);
      if (listing.qty < 1) throw new LeakError(`listing ${listing.id} is already let`);
      const tenant = world.people[effect.tenant];
      if (!tenant || !tenant.alive) {
        throw new LeakError(`no living person ${effect.tenant}`);
      }
      let next = payAcrossHolders(world, effect.tenant, listing.seller, listing.price);
      if (tenant.dwelling && tenant.dwelling !== house.id) {
        const left = next.houses[tenant.dwelling];
        if (left && left.occupant === tenant.id) {
          next = {
            ...next,
            houses: { ...next.houses, [left.id]: { ...left, occupant: null } },
          };
        }
      }
      if (house.occupant && house.occupant !== tenant.id) {
        const prev = next.people[house.occupant];
        if (prev && prev.dwelling === house.id) {
          next = {
            ...next,
            people: {
              ...next.people,
              [prev.id]: { ...prev, dwelling: null },
            },
          };
        }
      }
      const current = next.people[tenant.id];
      return {
        world: {
          ...next,
          people: {
            ...next.people,
            [tenant.id]: { ...current, dwelling: house.id },
          },
          houses: {
            ...next.houses,
            [house.id]: { ...next.houses[house.id], occupant: tenant.id },
          },
          listings: next.listings.map((l) =>
            l.id === listing.id ? { ...l, qty: l.qty - 1 } : l
          ),
        },
        lines: pair(month, "rent", effect.tenant, listing.seller, listing.price),
      };
    }
    case "vacate": {
      const house = world.houses[effect.house];
      if (!house) throw new LeakError(`no house ${effect.house}`);
      return { world: clearDwelling(world, house.id), lines: [] };
    }
    case "pinHealth": {
      const person = world.people[effect.person];
      if (!person) throw new LeakError(`no person ${effect.person}`);
      if (!person.alive) throw new LeakError(`${effect.person} is already dead`);
      if (effect.cause === "homeless") {
        return {
          world: {
            ...world,
            people: {
              ...world.people,
              [person.id]: { ...person, health: 0 },
            },
          },
          lines: [],
        };
      }
      if (person.diseases.includes(effect.disease)) {
        throw new LeakError(`${effect.person} already has ${effect.disease}`);
      }
      return {
        world: {
          ...world,
          people: {
            ...world.people,
            [person.id]: {
              ...person,
              health: 0,
              diseases: [...person.diseases, effect.disease],
            },
          },
        },
        lines: [],
      };
    }
    case "assign": {
      const person = world.people[effect.person];
      if (!person) throw new LeakError(`no person ${effect.person}`);
      if (!person.alive) throw new LeakError(`${effect.person} is already dead`);
      return {
        world: {
          ...world,
          people: {
            ...world.people,
            [person.id]: { ...person, assignment: effect.specialty },
          },
        },
        lines: [],
      };
    }
    case "cure": {
      const person = world.people[effect.person];
      if (!person) throw new LeakError(`no person ${effect.person}`);
      if (!effect.granted) return { world, lines: [] };
      const at = person.diseases.indexOf(effect.disease);
      if (at < 0) throw new LeakError(`${effect.person} does not have ${effect.disease}`);
      const diseases = person.diseases.slice();
      diseases.splice(at, 1);
      return {
        world: {
          ...world,
          people: {
            ...world.people,
            [person.id]: { ...person, diseases },
          },
        },
        lines: [],
      };
    }
    case "levelUp": {
      const person = world.people[effect.person];
      if (!person) throw new LeakError(`no person ${effect.person}`);
      if (!effect.granted) return { world, lines: [] };
      return {
        world: {
          ...world,
          people: {
            ...world.people,
            [person.id]: {
              ...person,
              education: {
                ...person.education,
                [effect.career]: person.education[effect.career] + 1,
              },
            },
          },
        },
        lines: [],
      };
    }
    case "buyCure": {
      if (effect.qty === 0) return { world, lines: [] };
      if (effect.qty !== params.cureSize) {
        throw new LeakError(`cure qty ${effect.qty} is not ${params.cureSize}`);
      }
      const person = world.people[effect.person];
      if (!person) throw new LeakError(`no person ${effect.person}`);
      const listing = world.listings.find((row) => row.id === effect.listing);
      if (!listing || listing.kind !== "cure") {
        throw new LeakError(`no cure listing ${effect.listing}`);
      }
      const disease = diseaseOf(listing.payload);
      if (!disease) throw new LeakError(`${effect.listing} names no disease`);
      const at = person.diseases.indexOf(disease);
      if (at < 0) throw new LeakError(`${effect.person} does not have ${disease}`);
      if (listing.qty < effect.qty) {
        throw new LeakError(`listing ${effect.listing} is short of ${effect.qty}`);
      }
      const cost = listing.price * effect.qty;
      const diseases = person.diseases.slice();
      diseases.splice(at, 1);
      const paid = payAcrossHolders(world, effect.person, listing.seller, cost);
      const buyer = paid.people[effect.person];
      return {
        world: {
          ...paid,
          people: {
            ...paid.people,
            [effect.person]: { ...buyer, diseases },
          },
          listings: paid.listings.map((row) =>
            row.id === listing.id ? { ...row, qty: row.qty - effect.qty } : row
          ),
        },
        lines: pair(month, "privateCure", effect.person, listing.seller, cost),
      };
    }
    case "buyTuition": {
      if (effect.qty === 0) return { world, lines: [] };
      if (effect.qty !== params.unitsPerLevel) {
        throw new LeakError(`tuition qty ${effect.qty} is not ${params.unitsPerLevel}`);
      }
      const person = world.people[effect.person];
      if (!person) throw new LeakError(`no person ${effect.person}`);
      const listing = world.listings.find((row) => row.id === effect.listing);
      if (!listing) throw new LeakError(`no tuition listing ${effect.listing}`);
      const career = tuitionCareer(listing.payload);
      if (!career) throw new LeakError(`${effect.listing} names no career`);
      if (listing.qty < effect.qty) {
        throw new LeakError(`listing ${effect.listing} is short of ${effect.qty}`);
      }
      const cost = listing.price * effect.qty;
      const paid = payAcrossHolders(world, effect.person, listing.seller, cost);
      const buyer = paid.people[effect.person];
      return {
        world: {
          ...paid,
          people: {
            ...paid.people,
            [effect.person]: {
              ...buyer,
              education: {
                ...buyer.education,
                [career]: buyer.education[career] + 1,
              },
            },
          },
          listings: paid.listings.map((row) =>
            row.id === listing.id ? { ...row, qty: row.qty - effect.qty } : row
          ),
        },
        lines: pair(month, "tuition", effect.person, listing.seller, cost),
      };
    }
    case "archiveJobs": {
      return {
        world: {
          ...world,
          jobArchive: {
            year: Math.floor(month / 12),
            listings: effect.listings.map((row) => ({ ...row })),
          },
        },
        lines: [],
      };
    }
    case "death": {
      const person = world.people[effect.person];
      if (!person) throw new LeakError(`no person ${effect.person}`);
      if (!person.alive) throw new LeakError(`${effect.person} is already dead`);
      let houses = world.houses;
      for (const house of Object.values(world.houses)) {
        if (house.occupant !== person.id) continue;
        houses = { ...houses, [house.id]: { ...house, occupant: null } };
      }
      return {
        world: {
          ...world,
          houses,
          people: {
            ...world.people,
            [person.id]: { ...person, alive: false, job: null, dwelling: null },
          },
        },
        lines: [],
      };
    }
    case "birth":
      return bear(world, effect.parent);
    case "grantHouse": {
      const house = world.houses[effect.house];
      if (!house) throw new LeakError(`no house ${effect.house}`);
      return {
        world: giveHouse(world, house, effect.person, effect.units).world,
        lines: [],
      };
    }
    case "escheat":
      return convey(world, effect.person, world.government.id);
    case "vest":
      return convey(world, effect.person, effect.heir);
    case "strategy": {
      if (effect.posts.length === 0) throw new LeakError("strategy posted nothing");
      let next = world;
      for (const post of effect.posts) {
        if (post.seller !== effect.firm) {
          throw new LeakError(`${post.seller} is not ${effect.firm}`);
        }
        if (post.kind !== "job" && post.kind !== "machine") {
          throw new LeakError(`strategy cannot post ${post.kind}`);
        }
        const taken = takeId(next, "list");
        const listing: Listing = { ...post, id: taken.id };
        next = { ...taken.world, listings: [...next.listings, listing] };
      }
      if (Object.keys(next.machines).length !== Object.keys(world.machines).length) {
        throw new LeakError("strategy minted a machine");
      }
      return { world: next, lines: [] };
    }
  }
}

/** Apply one effect. The result has already passed assertInvariant. */
export function applyEffect(world: World, effect: Effect): World {
  const { world: after, lines } = applyBare(world, effect);
  return withFlows(world, after, linesOf(lines, world.month));
}

export function openingNfa(world: World): Record<Id, Money> {
  const out: Record<Id, Money> = {};
  for (const id of holderIds(world)) out[id] = nfa(world, id);
  return out;
}

/** Inflows minus outflows equal the change in net financial assets since
 *  `baseline`, which is the NFA snapshot from when `flows` was last empty. */
export function assertFlowIdentity(
  world: World,
  baseline: Readonly<Record<Id, Money>>,
): void {
  const ids = new Set<Id>([...holderIds(world), ...Object.keys(baseline)]);
  for (const id of ids) {
    const d = nfa(world, id) - (baseline[id] ?? 0);
    const f = world.flows.filter((l) => l.holder === id).reduce(
      (s, l) => s + l.amount,
      0,
    );
    if (d !== f) throw new LeakError(`flow column ${id}: flows ${f} ≠ ΔNFA ${d}`);
  }
}
