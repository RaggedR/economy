// kin.ts — births and the estate. Reproduction has no shape. The fertility
// gate is engine code. A voluntary weight of zero does not birth.
//
// Inheritance, once, in this order: the bank takes its lien, the decedent's
// own unsecured debts are written off, then either the first living child
// receives the net estate or the childless estate splits. Houses go to the
// homeless in quanta of `houseQuantum`. A quantum with no homeless recipient,
// and every liquid asset, escheats to the government. The gift of cash is a
// deposit transfer. Shares and mines are not sold; the distress sale is still
// not a market.

import { params } from "./params.ts";
import { nextIndex } from "./rng.ts";
import type { Effect, House, Id, World } from "./types.ts";
import { applyEffect } from "./world.ts";

export type Fertility = "none" | "voluntary" | "mandatory";

function byId<T extends { id: Id }>(rows: T[]): T[] {
  return [...rows].sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
}

export function ownedUnits(world: World, personId: Id): number {
  let units = 0;
  for (const house of Object.values(world.houses)) {
    if (house.owner === personId) units += house.units;
  }
  return units;
}

/** Unliened units above the quantum the person lives in. A lien cannot be given. */
export function spareUnits(world: World, personId: Id): number {
  const person = world.people[personId];
  if (!person) return 0;
  let spare = 0;
  for (const house of Object.values(world.houses)) {
    if (house.owner !== personId || house.lien !== null) continue;
    const reserved = house.id === person.dwelling ? params.houseQuantum : 0;
    spare += Math.max(0, house.units - reserved);
  }
  return spare;
}

export function depositCash(world: World, personId: Id): number {
  const purse = world.people[personId]?.deposits;
  return purse ? purse.a + purse.b : 0;
}

function livingChildren(world: World, personId: Id): number {
  const person = world.people[personId];
  if (!person) return 0;
  let n = 0;
  for (const id of person.children) {
    if (world.people[id]?.alive) n += 1;
  }
  return n;
}

/** Mandatory wins over the voluntary band. A renter, who owns nothing, is none. */
export function fertility(world: World, personId: Id): Fertility {
  const person = world.people[personId];
  if (!person || !person.alive) return "none";
  const units = ownedUnits(world, personId);
  const cash = depositCash(world, personId);
  const spare = spareUnits(world, personId);
  if (
    units >= params.fertilityUnits &&
    cash >= params.fertilityMultiple * params.cashGift &&
    spare >= params.houseQuantum
  ) {
    return "mandatory";
  }
  if (units === 0) return "none";
  const n = livingChildren(world, personId);
  const needSpare = params.houseQuantum * (n + 1);
  const needCash = params.fertilityLiquidMultiple * params.cashGift * (n + 1);
  if (spare >= needSpare && cash >= needCash) return "voluntary";
  return "none";
}

/** One forced birth per parent. The voluntary band is not taken. */
export function planBirths(world: World): Effect[] {
  const effects: Effect[] = [];
  let cursor = world;
  const ids = Object.values(world.people)
    .filter((person) => person.alive)
    .map((person) => person.id)
    .sort();
  for (const id of ids) {
    const band = fertility(cursor, id);
    if (
      band === "voluntary" && params.fertilityWeight[cursor.people[id].objective] !== 0
    ) {
      throw new Error(
        `voluntary weight for ${id} is set; this milestone does not roll it`,
      );
    }
    if (band !== "mandatory") continue;
    const effect: Effect = { tag: "birth", parent: id };
    effects.push(effect);
    cursor = applyEffect(cursor, effect);
  }
  return effects;
}

export type BirthBand = "mandatory" | "voluntary" | "none";

/** The special-month fertility bands, as the town's rule states them. A parent
 *  with `fertilityUnits` of real estate and `fertilityMultiple`×G liquid MUST
 *  split off a child; one with `fertilityLiquidMultiple` quanta of real estate
 *  (30 = 3×`houseQuantum`) and `fertilityLiquidMultiple`×G liquid MAY. Either
 *  way the child is endowed with one quantum of house and one gift of cash
 *  (`bear`), so a parent qualifies only if it can fund that — a spare quantum to
 *  subdivide and at least one G of cash. Kept apart from `fertility`/`planBirths`,
 *  which the milestone town rides unchanged. */
export function specialBirthBand(world: World, personId: Id): BirthBand {
  const person = world.people[personId];
  if (!person || !person.alive) return "none";
  const units = ownedUnits(world, personId);
  const cash = depositCash(world, personId);
  const spare = spareUnits(world, personId);
  // Cannot endow a child: no spare quantum to give, or not enough cash to fund
  // the newborn's endowment.
  if (spare < params.houseQuantum || cash < params.birthEndowment) return "none";
  if (
    units >= params.fertilityUnits &&
    cash >= params.fertilityMultiple * params.cashGift
  ) {
    return "mandatory";
  }
  const voluntaryUnits = params.fertilityLiquidMultiple * params.houseQuantum; // 30
  const voluntaryCash = params.fertilityLiquidMultiple * params.cashGift; // 3G
  if (units >= voluntaryUnits && cash >= voluntaryCash) return "voluntary";
  return "none";
}

/** The special month's births, the first thing that happens. Every mandatory
 *  parent splits off a child; when `exerciseVoluntary`, every voluntary parent
 *  takes the option too. Sequential in id order, so a parent's own split is
 *  reflected before the next is judged. Reuses the `birth` effect, so the child
 *  is endowed exactly as `bear` endows it — one quantum of real estate and one
 *  G of cash, liquidated from the parent. */
export function planSpecialBirths(world: World, exerciseVoluntary: boolean): Effect[] {
  const effects: Effect[] = [];
  let cursor = world;
  const ids = Object.values(world.people)
    .filter((person) => person.alive)
    .map((person) => person.id)
    .sort();
  for (const id of ids) {
    const band = specialBirthBand(cursor, id);
    if (band === "mandatory" || (band === "voluntary" && exerciseVoluntary)) {
      const effect: Effect = { tag: "birth", parent: id };
      effects.push(effect);
      cursor = applyEffect(cursor, effect);
    }
  }
  return effects;
}

function ownedHouses(world: World, owner: Id): House[] {
  return byId(Object.values(world.houses).filter((house) => house.owner === owner));
}

/** First living child in birth order. A dead firstborn does not inherit. */
export function heirOf(world: World, personId: Id): Id | null {
  const person = world.people[personId];
  if (!person) return null;
  for (const id of person.children) {
    if (world.people[id]?.alive) return id;
  }
  return null;
}

function homeless(world: World, except: Id): Id[] {
  return Object.values(world.people)
    .filter((person) => person.alive && person.id !== except && person.dwelling === null)
    .map((person) => person.id)
    .sort();
}

function owes(world: World, personId: Id): Id[] {
  return byId(Object.values(world.loans))
    .filter((loan) =>
      (loan.kind === "bank" && loan.borrower === personId) ||
      (loan.kind === "private" && loan.issuer === personId)
    )
    .map((loan) => loan.id);
}

/** Deposits, receivables, shares, mines, houses, or a firm. A job is not an asset. */
export function holdsEstate(world: World, personId: Id): boolean {
  if (depositCash(world, personId) > 0) return true;
  for (const share of Object.values(world.shares)) {
    if (share.holder === personId && share.units > 0) return true;
  }
  for (const loan of Object.values(world.loans)) {
    if (loan.kind === "private" && loan.holder === personId && loan.principal > 0) {
      return true;
    }
  }
  for (const mine of Object.values(world.mines)) {
    if (mine.owner === personId) return true;
  }
  for (const house of Object.values(world.houses)) {
    if (house.owner === personId) return true;
  }
  for (const firm of Object.values(world.firms)) {
    if (firm.owner === personId) return true;
  }
  return false;
}

export type EstatePlan = { world: World; effects: Effect[] };

/**
 * Route one person's estate, then mark them dead if they are still alive.
 * The returned world differs from the input only in `rng`: a childless gift
 * draws when more than one person is homeless. One recipient does not draw.
 */
export function planEstate(world: World, personId: Id): EstatePlan {
  const person = world.people[personId];
  if (!person) throw new Error(`no person ${personId}`);
  const effects: Effect[] = [];
  let cursor = world;
  const push = (effect: Effect) => {
    effects.push(effect);
    cursor = applyEffect(cursor, effect);
  };

  for (const loanId of owes(world, personId)) {
    const loan = cursor.loans[loanId];
    if (!loan) continue;
    if (loan.kind === "bank") {
      const house = cursor.houses[loan.collateral];
      const mine = cursor.mines[loan.collateral];
      const lien = house?.lien ?? mine?.lien ?? null;
      if ((house || mine) && lien === loan.id) push({ tag: "seize", loan: loan.id });
      else push({ tag: "writeOff", instrument: loan.id });
    } else {
      push({ tag: "writeOff", instrument: loan.id });
    }
  }

  const heir = heirOf(cursor, personId);
  if (heir) {
    for (const house of ownedHouses(cursor, personId)) {
      if (house.lien !== null) throw new Error(`lien remains on ${house.id}`);
      push({ tag: "grantHouse", house: house.id, person: heir, units: house.units });
    }
    if (holdsEstate(cursor, personId)) push({ tag: "vest", person: personId, heir });
  } else {
    for (let guard = 0; guard < 10000; guard++) {
      const pool = homeless(cursor, personId);
      const house = ownedHouses(cursor, personId).find((row) =>
        row.lien === null && row.units >= params.houseQuantum
      );
      if (!house || pool.length === 0) break;
      let recipient = pool[0];
      if (pool.length > 1) {
        const picked = nextIndex(cursor, pool.length);
        cursor = picked.world;
        recipient = pool[picked.index];
      }
      push({
        tag: "grantHouse",
        house: house.id,
        person: recipient,
        units: params.houseQuantum,
      });
    }
    if (holdsEstate(cursor, personId)) push({ tag: "escheat", person: personId });
  }

  if (cursor.people[personId]?.alive) push({ tag: "death", person: personId });
  return { world: { ...world, rng: cursor.rng }, effects };
}
