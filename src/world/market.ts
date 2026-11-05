// market.ts — one staple book. The allocation is pure. Leaves commit it later.
//
// Sellers have already posted. A buyer who names a seller takes only that
// seller's lots. Otherwise the book is walked cheapest first (price, then id).
// A lot whose claimants want more than it holds is a sell-out: RngState
// permutes them, one draw per remaining claimant, and each receives one unit
// in that order while the lot lasts. An uncontested lot does not draw.
//
// A buyer whose fill is still zero, who still has cash, gets one retry on
// whatever staple remains, at the posted price, and the named seller is not
// binding on that pass. Shares and mines are not sold here.
// distressDiscountPercent stays unread.

import { nextIndex } from "./rng.ts";
import type { Id, Money, Qty, World } from "./types.ts";
import { goodOf } from "./types.ts";
import { purseOf } from "./world.ts";

export type StapleOrder = {
  buyer: Id;
  qty: Qty;
  seller?: Id;
};

export type PlannedLot = { listing: Id; qty: Qty };

export type BuyerPlan = {
  buyer: Id;
  filled: Qty;
  lots: PlannedLot[];
};

export type StaplePlan = {
  world: World;
  byBuyer: BuyerPlan[];
};

type Lot = { id: Id; seller: Id; price: Money; qty: Qty };

type Buyer = {
  id: Id;
  seller?: Id;
  demand: Qty;
  cash: Money;
  alive: boolean;
  taken: PlannedLot[];
};

function byBuyerId(x: Buyer, y: Buyer): number {
  return x.id < y.id ? -1 : x.id > y.id ? 1 : 0;
}

function cashOf(world: World, id: Id): Money {
  const purse = purseOf(world, id);
  return purse ? purse.a + purse.b : 0;
}

function stapleLots(world: World): Lot[] {
  const lots: Lot[] = [];
  for (const listing of world.listings) {
    if (listing.kind !== "good" || goodOf(listing.payload) !== "staple") continue;
    if (listing.qty <= 0 || listing.price <= 0) continue;
    lots.push({
      id: listing.id,
      seller: listing.seller,
      price: listing.price,
      qty: listing.qty,
    });
  }
  lots.sort((x, y) => x.price - y.price || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
  return lots;
}

function give(buyer: Buyer, lot: Lot, n: Qty, inventory: Map<Id, Qty>): void {
  buyer.demand -= n;
  buyer.cash -= lot.price * n;
  lot.qty -= n;
  inventory.set(lot.seller, (inventory.get(lot.seller) ?? 0) - n);
  const last = buyer.taken[buyer.taken.length - 1];
  if (last && last.listing === lot.id) last.qty += n;
  else buyer.taken.push({ listing: lot.id, qty: n });
}

function eligible(
  buyers: Buyer[],
  lot: Lot,
  inventory: Map<Id, Qty>,
  respectSeller: boolean,
): Buyer[] {
  const stock = inventory.get(lot.seller) ?? 0;
  if (stock <= 0 || lot.qty <= 0 || lot.price <= 0) return [];
  return buyers.filter((b) => {
    if (!b.alive || b.demand <= 0 || b.cash < lot.price) return false;
    if (!respectSeller) return true;
    return b.seller === undefined || b.seller === lot.seller;
  }).sort(byBuyerId);
}

/** Walk one lot. Returns the world so a sell-out's rng is kept. */
function takeLot(
  world: World,
  buyers: Buyer[],
  lot: Lot,
  inventory: Map<Id, Qty>,
  respectSeller: boolean,
): World {
  let cursor = world;
  let guard = 0;
  while (lot.qty > 0 && (inventory.get(lot.seller) ?? 0) > 0 && guard++ < 10000) {
    const now = eligible(buyers, lot, inventory, respectSeller);
    if (now.length === 0) break;
    const supply = Math.min(lot.qty, inventory.get(lot.seller) ?? 0);
    const wants = now.map((b) => Math.min(b.demand, Math.floor(b.cash / lot.price)));
    const total = wants.reduce((s, n) => s + n, 0);
    if (now.length === 1 || total <= supply) {
      for (let i = 0; i < now.length; i++) {
        const n = Math.min(wants[i], lot.qty, inventory.get(lot.seller) ?? 0);
        if (n > 0) give(now[i], lot, n, inventory);
      }
      break;
    }
    const pool = [...now];
    const order: Buyer[] = [];
    while (pool.length > 0) {
      const picked = nextIndex(cursor, pool.length);
      cursor = picked.world;
      order.push(pool.splice(picked.index, 1)[0]);
    }
    for (const buyer of order) {
      if (lot.qty <= 0 || (inventory.get(lot.seller) ?? 0) <= 0) break;
      if (buyer.demand <= 0 || buyer.cash < lot.price) continue;
      give(buyer, lot, 1, inventory);
    }
  }
  return cursor;
}

function pass(
  world: World,
  buyers: Buyer[],
  lots: Lot[],
  inventory: Map<Id, Qty>,
  respectSeller: boolean,
): World {
  let cursor = world;
  for (const lot of lots) {
    cursor = takeLot(cursor, buyers, lot, inventory, respectSeller);
  }
  return cursor;
}

/** Plan every bid before any fill commits. The returned world differs only in rng. */
export function clearStaple(world: World, orders: readonly StapleOrder[]): StaplePlan {
  const inventory = new Map<Id, Qty>();
  for (const firm of Object.values(world.firms)) {
    inventory.set(firm.id, firm.inventory.staple ?? 0);
  }
  const buyers: Buyer[] = orders.map((order) => {
    const person = world.people[order.buyer];
    const qty = Number.isInteger(order.qty) && order.qty > 0 ? order.qty : 0;
    return {
      id: order.buyer,
      seller: order.seller,
      demand: person && person.alive ? qty : 0,
      cash: person ? cashOf(world, person.id) : 0,
      alive: !!person && person.alive,
      taken: [],
    };
  });
  const lots = stapleLots(world);
  let cursor = pass(world, buyers, lots, inventory, true);
  const retry = buyers.filter((b) =>
    b.alive && b.taken.every((lot) => lot.qty === 0) && b.demand > 0 && b.cash > 0
  );
  if (retry.length > 0) cursor = pass(cursor, retry, lots, inventory, false);
  return {
    world: cursor,
    byBuyer: buyers.map((b) => ({
      buyer: b.id,
      filled: b.taken.reduce((s, lot) => s + lot.qty, 0),
      lots: b.taken.filter((lot) => lot.qty > 0),
    })),
  };
}

/** Deposits, bank shares, private loans held, undeposited mines. Houses are not. */
export function hasLiquid(world: World, personId: Id): boolean {
  const person = world.people[personId];
  if (!person) return false;
  if (person.deposits.a > 0 || person.deposits.b > 0) return true;
  for (const share of Object.values(world.shares)) {
    if (share.holder === personId && share.units > 0) return true;
  }
  for (const loan of Object.values(world.loans)) {
    if (loan.kind === "private" && loan.holder === personId && loan.principal > 0) {
      return true;
    }
  }
  for (const mine of Object.values(world.mines)) {
    if (mine.owner === personId && mine.depositedAt === null) return true;
  }
  return false;
}

/** Participants only. A positive staple fill resets the counter. A zero fill
 *  steps it, capped at 3. People who did not bid are left alone. */
export function markStarvation(
  world: World,
  rows: readonly { person: Id; filled: Qty }[],
): World {
  let people = world.people;
  const seen = new Set<Id>();
  const ordered = [...rows].sort((x, y) =>
    x.person < y.person ? -1 : x.person > y.person ? 1 : 0
  );
  for (const row of ordered) {
    if (seen.has(row.person)) continue;
    seen.add(row.person);
    const person = people[row.person];
    if (!person || !person.alive) continue;
    const starvation = row.filled > 0 ? 0 : Math.min(3, person.starvation + 1);
    people = { ...people, [person.id]: { ...person, starvation } };
  }
  return { ...world, people };
}

/** The world has already been marked. Three foodless months and nothing liquid
 *  is death. A house does not count. The effect moves no asset. */
export function starvationDeaths(
  world: World,
  rows: readonly { person: Id; filled: Qty }[],
): Id[] {
  const seen = new Set<Id>();
  const deaths: Id[] = [];
  const ordered = [...rows].sort((x, y) =>
    x.person < y.person ? -1 : x.person > y.person ? 1 : 0
  );
  for (const row of ordered) {
    if (seen.has(row.person)) continue;
    seen.add(row.person);
    const person = world.people[row.person];
    if (!person || !person.alive) continue;
    if (person.starvation >= 3 && !hasLiquid(world, person.id)) deaths.push(person.id);
  }
  return deaths;
}
