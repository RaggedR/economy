// purses.ts — a firm purse and a household purse are different deposits.
//
// Opening wages are paid from the firm. What remains after that is drawn to
// the owner. A firm that cannot meet its wage bill is left untouched: the fold
// takes that cash, and drawing it to the owner first would spend the creditors'
// estate. Cash inside the firm is not what a household spends on food. The
// household pays from its own purse, which is a separate `pay`.

import { drawGate, payGate } from "./gates.ts";
import { drawAmount } from "./policy.ts";
import type { Effect, Id, World } from "./types.ts";
import { applyEffect, purseOf } from "./world.ts";

function byId<T extends { id: Id }>(rows: T[]): T[] {
  return [...rows].sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
}

export function wageBill(world: World, firmId: Id): { person: Id; salary: number }[] {
  const owed: { person: Id; salary: number }[] = [];
  for (const person of byId(Object.values(world.people))) {
    if (!person.alive || !person.job) continue;
    if (person.job.firm !== firmId || person.job.salary <= 0) continue;
    owed.push({ person: person.id, salary: person.job.salary });
  }
  return owed;
}

function cash(world: World, id: Id): number {
  const purse = purseOf(world, id);
  return purse ? purse.a + purse.b : 0;
}

/** Solvent firms pay every wage, in id order. An insolvent firm pays nothing. */
export function openingPays(world: World): Effect[] {
  const effects: Effect[] = [];
  let cursor = world;
  for (const firm of byId(Object.values(world.firms))) {
    if (firm.folded) continue;
    const owed = wageBill(cursor, firm.id);
    const bill = owed.reduce((s, row) => s + row.salary, 0);
    if (bill === 0 || cash(cursor, firm.id) < bill) continue;
    for (const row of owed) {
      const gated = payGate(cursor, firm.id, row.person, row.salary, "wages");
      if (!gated.ok) throw new Error(gated.reason);
      effects.push(gated.effect);
      cursor = applyEffect(cursor, gated.effect);
    }
  }
  return effects;
}

function wagesPaidBy(world: World, firmId: Id): number {
  let paid = 0;
  for (const line of world.flows) {
    if (line.holder === firmId && line.row === "wages" && line.amount < 0) {
      paid -= line.amount;
    }
  }
  return paid;
}

/** After the capital step. Only a firm that met its opening wages is drawn.
 *  The test is the original bill, not the cash left after paying it.
 *  The amount is the cash above this month's wage, maintenance, tax, and debt
 *  service. A reserve of zero draws the purse. */
export function remainderDraws(world: World): Effect[] {
  const effects: Effect[] = [];
  let cursor = world;
  for (const firm of byId(Object.values(cursor.firms))) {
    if (firm.folded) continue;
    const bill = wageBill(cursor, firm.id).reduce((s, row) => s + row.salary, 0);
    const unpaid = bill - wagesPaidBy(cursor, firm.id);
    if (unpaid > 0 && cash(cursor, firm.id) < unpaid) continue;
    const amount = drawAmount(cursor, firm.id);
    if (amount === 0) continue;
    const gated = drawGate(cursor, firm.id, firm.owner, amount);
    if (!gated.ok) throw new Error(gated.reason);
    effects.push(gated.effect);
    cursor = applyEffect(cursor, gated.effect);
  }
  return effects;
}
