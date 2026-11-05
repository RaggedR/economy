// fold.ts — opening obligations, then the waterfall if the firm cannot meet them.
//
// A solvent firm pays wages, bank installments, private installments, tax, and
// maintenance, in that order, from its own purse. A firm that cannot is folded
// before any of those pays. The estate above the food reserve then pays wages,
// tax, the bank, and unsecured holders. Unmortgaged houses are not collateral,
// so seize never sees them. Maintenance owed to a folded builder is zero.
//
// The reserve is senior only inside a fold. A solvent firm may spend it on the
// bill. Month 0 is a special-day month, so the reserve covers the twelve months
// until the next one.

import { params } from "./params.ts";
import { drawGate, payGate, repayGate, seizeGate, writeOffGate } from "./gates.ts";
import { nextIndex } from "./rng.ts";
import type { Effect, FlowRow, Id, Money, World } from "./types.ts";
import { applyEffect, purseOf } from "./world.ts";
import { wageBill } from "./purses.ts";

export type OpeningPlan = {
  effects: Effect[];
  mark: (world: World) => World;
};

type Wage = { person: Id; salary: Money };

type Bill = {
  wages: Wage[];
  tax: Money;
  maintenance: { builder: Id; amount: Money }[];
  bank: { loan: Id; amount: Money }[];
  unsecured: { loan: Id; holder: Id; amount: Money }[];
  total: Money;
};

function byId<T extends { id: Id }>(rows: T[]): T[] {
  return [...rows].sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
}

function cashOf(world: World, id: Id): Money {
  const purse = purseOf(world, id);
  return purse ? purse.a + purse.b : 0;
}

/** Months until the next special day. The special day itself still owes a year. */
export function monthsUntilSpecial(month: number): number {
  const mod = ((month % 12) + 12) % 12;
  return mod === 0 ? 12 : 12 - mod;
}

export function foodReserve(world: World): Money {
  return monthsUntilSpecial(world.month) * params.stapleReservePrice;
}

export function maintenanceCharge(world: World, machineId: Id): Money {
  const machine = world.machines[machineId];
  if (!machine) return 0;
  const builder = world.firms[machine.builder];
  if (!builder || builder.folded) return 0;
  return params.maintenance;
}

export function openingBill(world: World, firmId: Id): Bill {
  const firm = world.firms[firmId];
  const wages = firm && !firm.folded ? wageBill(world, firmId) : [];
  const maintenance: Bill["maintenance"] = [];
  if (firm && !firm.folded) {
    for (const machineId of firm.machines) {
      const amount = maintenanceCharge(world, machineId);
      const machine = world.machines[machineId];
      if (amount > 0 && machine) maintenance.push({ builder: machine.builder, amount });
    }
  }
  const bank: Bill["bank"] = [];
  const unsecured: Bill["unsecured"] = [];
  for (const loan of byId(Object.values(world.loans))) {
    if (loan.kind === "bank" && loan.borrower === firmId && loan.installment > 0) {
      bank.push({ loan: loan.id, amount: Math.min(loan.installment, loan.principal) });
    }
    if (loan.kind === "private" && loan.issuer === firmId && loan.installment > 0) {
      unsecured.push({
        loan: loan.id,
        holder: loan.holder,
        amount: Math.min(loan.installment, loan.principal),
      });
    }
  }
  const tax = firm?.taxOwed ?? 0;
  const total = wages.reduce((s, row) => s + row.salary, 0) + tax +
    maintenance.reduce((s, row) => s + row.amount, 0) +
    bank.reduce((s, row) => s + row.amount, 0) +
    unsecured.reduce((s, row) => s + row.amount, 0);
  return { wages, tax, maintenance, bank, unsecured, total };
}

function push(
  world: World,
  effects: Effect[],
  gate: { ok: true; effect: Effect } | { ok: false; reason: string },
): World {
  if (!gate.ok) throw new Error(gate.reason);
  effects.push(gate.effect);
  return applyEffect(world, gate.effect);
}

function payWhat(
  world: World,
  effects: Effect[],
  from: Id,
  to: Id,
  amount: Money,
  row: FlowRow,
): { world: World; paid: Money } {
  const payable = Math.min(amount, cashOf(world, from));
  if (payable <= 0) return { world, paid: 0 };
  return {
    world: push(world, effects, payGate(world, from, to, payable, row)),
    paid: payable,
  };
}

/** Id order when everyone can be paid. A shortfall draws the order from RngState. */
function wageOrder(world: World, wages: Wage[], budget: Money): { world: World; order: Wage[] } {
  const sorted = [...wages].sort((x, y) => (x.person < y.person ? -1 : x.person > y.person ? 1 : 0));
  const total = sorted.reduce((s, row) => s + row.salary, 0);
  if (budget >= total || sorted.length <= 1) return { world, order: sorted };
  const pool = [...sorted];
  const order: Wage[] = [];
  let cursor = world;
  while (pool.length > 0) {
    const picked = nextIndex(cursor, pool.length);
    cursor = picked.world;
    order.push(pool.splice(picked.index, 1)[0]);
  }
  return { world: cursor, order };
}

function payWages(
  world: World,
  effects: Effect[],
  firmId: Id,
  wages: Wage[],
  budget: Money,
): World {
  const ordered = wageOrder(world, wages, budget);
  let cursor = ordered.world;
  let left = budget;
  for (const row of ordered.order) {
    const amount = Math.min(row.salary, left, cashOf(cursor, firmId));
    if (amount <= 0) continue;
    cursor = push(cursor, effects, payGate(cursor, firmId, row.person, amount, "wages"));
    left -= amount;
  }
  return cursor;
}

function solventEffects(world: World, firmId: Id, bill: Bill): { world: World; effects: Effect[] } {
  const effects: Effect[] = [];
  let cursor = payWages(world, effects, firmId, bill.wages, cashOf(world, firmId));
  for (const row of bill.bank) {
    const amount = Math.min(row.amount, cashOf(cursor, firmId));
    if (amount <= 0) continue;
    cursor = push(cursor, effects, repayGate(cursor, row.loan, amount));
  }
  for (const row of bill.unsecured) {
    const step = payWhat(cursor, effects, firmId, row.holder, row.amount, "privateInstallment");
    cursor = step.world;
  }
  const tax = payWhat(cursor, effects, firmId, "gov", bill.tax, "tax");
  cursor = tax.world;
  for (const row of bill.maintenance) {
    const step = payWhat(cursor, effects, firmId, row.builder, row.amount, "maintenance");
    cursor = step.world;
  }
  return { world: cursor, effects };
}

function foldEffects(world: World, firmId: Id, bill: Bill): { world: World; effects: Effect[] } {
  const effects: Effect[] = [];
  const firm = world.firms[firmId];
  let cursor = world;
  const reserve = Math.min(foodReserve(cursor), cashOf(cursor, firmId));
  if (reserve > 0) {
    cursor = push(cursor, effects, drawGate(cursor, firmId, firm.owner, reserve));
  }
  const wageBudget = Math.min(
    cashOf(cursor, firmId),
    bill.wages.reduce((s, row) => s + row.salary, 0),
  );
  cursor = payWages(cursor, effects, firmId, bill.wages, wageBudget);
  const tax = payWhat(cursor, effects, firmId, "gov", bill.tax, "tax");
  cursor = tax.world;
  for (const row of bill.bank) {
    const loan = cursor.loans[row.loan];
    if (!loan || loan.kind !== "bank") continue;
    const amount = Math.min(loan.principal, row.amount, cashOf(cursor, firmId));
    if (amount > 0) cursor = push(cursor, effects, repayGate(cursor, row.loan, amount));
    const still = cursor.loans[row.loan];
    if (still && still.kind === "bank" && still.principal > 0) {
      const house = cursor.houses[still.collateral];
      const mine = cursor.mines[still.collateral];
      const lien = house ? house.lien : mine ? mine.lien : null;
      if (lien === still.id) cursor = push(cursor, effects, seizeGate(cursor, still.id));
    }
  }
  for (const row of bill.unsecured) {
    const step = payWhat(cursor, effects, firmId, row.holder, row.amount, "privateInstallment");
    cursor = step.world;
    const unpaid = cursor.loans[row.loan];
    if (unpaid && unpaid.kind === "private" && unpaid.principal > 0) {
      cursor = push(cursor, effects, writeOffGate(cursor, unpaid.id));
    }
  }
  const leftover = cashOf(cursor, firmId);
  if (leftover > 0) {
    cursor = push(cursor, effects, drawGate(cursor, firmId, firm.owner, leftover));
  }
  return { world: cursor, effects };
}

function markFirm(
  firmId: Id,
  folded: boolean,
  taxLeft: Money,
  rng: World["rng"],
): (world: World) => World {
  return (world) => {
    const firm = world.firms[firmId];
    if (!firm) return world;
    let next: World = {
      ...world,
      rng,
      firms: {
        ...world.firms,
        [firmId]: { ...firm, folded: folded || firm.folded, taxOwed: taxLeft },
      },
    };
    if (!folded) return next;
    const owner = next.people[firm.owner];
    if (owner && owner.firm === firmId) {
      next = {
        ...next,
        people: { ...next.people, [owner.id]: { ...owner, firm: null } },
      };
    }
    return next;
  };
}

function taxLeft(before: World, after: World, firmId: Id): Money {
  const firm = before.firms[firmId];
  const owed = firm?.taxOwed ?? 0;
  let paid = 0;
  for (const line of after.flows) {
    if (line.holder === firmId && line.row === "tax" && line.amount < 0) paid -= line.amount;
  }
  for (const line of before.flows) {
    if (line.holder === firmId && line.row === "tax" && line.amount < 0) paid += line.amount;
  }
  return Math.max(0, owed - paid);
}

/** One pass over the firms. Folds until every survivor can meet the bill, then pays. */
export function planOpening(world: World): OpeningPlan {
  const effects: Effect[] = [];
  const marks: ((world: World) => World)[] = [];
  let cursor = world;
  const done = new Set<Id>();
  const pending = () =>
    byId(Object.values(cursor.firms)).filter((firm) => !firm.folded && !done.has(firm.id));

  let guard = 0;
  while (guard++ < 32) {
    const short = pending().find((firm) => cashOf(cursor, firm.id) < openingBill(cursor, firm.id).total);
    if (!short) break;
    const bill = openingBill(cursor, short.id);
    const folded = foldEffects(cursor, short.id, bill);
    effects.push(...folded.effects);
    marks.push(markFirm(short.id, true, taxLeft(cursor, folded.world, short.id), folded.world.rng));
    cursor = markFirm(short.id, true, taxLeft(cursor, folded.world, short.id), folded.world.rng)(
      folded.world,
    );
    done.add(short.id);
  }

  for (const firm of pending()) {
    const bill = openingBill(cursor, firm.id);
    const paid = solventEffects(cursor, firm.id, bill);
    effects.push(...paid.effects);
    const marked = markFirm(firm.id, false, taxLeft(cursor, paid.world, firm.id), paid.world.rng);
    marks.push(marked);
    cursor = marked(paid.world);
    done.add(firm.id);
  }

  return {
    effects,
    mark: (settled) => marks.reduce((w, mark) => mark(w), settled),
  };
}
