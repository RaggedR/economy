// special.ts — the annual day, as pure plans. Leaves commit them later.
//
// The order is the interface's: shares, then the dividend (not planned here),
// then house sales, occupy-or-let (a shape, not a plan), jobs and machine
// orders, then rents. Share trades are not planned for any other month.
// Mine trades and debt are not this day.
//
// A share book is cheapest-first, like staple, with no named seller and no
// retry. A house is not an auction: one solvent bidder takes it without a
// draw, and two or more are permuted. Jobs seat incumbents first, in id
// order, at the salary they already hold. Everyone else is descending health,
// and a tie at one health is a draw. Rents seat the sitting tenant first.
// Everyone else is descending salary, and a tie at one salary is a draw.

import { nextIndex } from "./rng.ts";
import type { BankId, Career, Id, Money, Qty, World } from "./types.ts";
import { houseOf, shareBank } from "./types.ts";
import { purseOf } from "./world.ts";

export function isSpecialMonth(month: number): boolean {
  return month >= 0 && month % 12 === 0;
}

export type PlannedLot = { listing: Id; qty: Qty };

export type ShareBid = {
  buyer: Id;
  bank: BankId;
  qty: Qty;
  limit: Money;
};

export type SharePlan = {
  world: World;
  byBuyer: { buyer: Id; filled: Qty; lots: PlannedLot[] }[];
};

export type HouseBid = { buyer: Id; house: Id };

export type HousePlan = {
  world: World;
  byBuyer: { buyer: Id; house: Id; listing: Id; won: boolean }[];
};

export type JobWish =
  | { person: Id; kind: "keep" }
  | { person: Id; kind: "apply"; listing: Id };

export type JobOutcome = "seated" | "rationed" | "ineligible" | "unposted";

export type JobPlan = {
  world: World;
  rows: { person: Id; listing: Id; outcome: JobOutcome }[];
};

export type MachineBid = { firm: Id; listing: Id; qty: Qty; limit: Money };

export type MachinePlan = {
  world: World;
  byFirm: { firm: Id; filled: Qty; lots: PlannedLot[] }[];
};

export type RentBid = { person: Id; house: Id };

export type RentOutcome = "seated" | "rationed" | "short";

export type RentPlan = {
  world: World;
  rows: { person: Id; listing: Id; outcome: RentOutcome }[];
};

type Lot = { id: Id; seller: Id; price: Money; qty: Qty; bank?: BankId };

function cashOf(world: World, id: Id): Money {
  const purse = purseOf(world, id);
  return purse ? purse.a + purse.b : 0;
}

function byId(x: { id: Id }, y: { id: Id }): number {
  return x.id < y.id ? -1 : x.id > y.id ? 1 : 0;
}

function permute<T>(world: World, pool: readonly T[]): { world: World; order: T[] } {
  const rest = [...pool];
  const order: T[] = [];
  let cursor = world;
  while (rest.length > 0) {
    const picked = nextIndex(cursor, rest.length);
    cursor = picked.world;
    order.push(rest.splice(picked.index, 1)[0]);
  }
  return { world: cursor, order };
}

function shareLots(world: World): Lot[] {
  const lots: Lot[] = [];
  for (const listing of world.listings) {
    if (listing.kind !== "share" || listing.qty <= 0 || listing.price <= 0) continue;
    const bank = shareBank(listing.payload);
    if (!bank) continue;
    lots.push({
      id: listing.id,
      seller: listing.seller,
      price: listing.price,
      qty: listing.qty,
      bank,
    });
  }
  lots.sort((x, y) => x.price - y.price || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
  return lots;
}

function heldShares(world: World, holder: Id, bank: BankId): Qty {
  let n = 0;
  for (const share of Object.values(world.shares)) {
    if (share.holder === holder && share.bank === bank) n += share.units;
  }
  return n;
}

type ShareBuyer = {
  id: Id;
  bank: BankId;
  limit: Money;
  demand: Qty;
  cash: Money;
  taken: PlannedLot[];
};

function giveShare(buyer: ShareBuyer, lot: Lot, n: Qty, stock: Map<string, Qty>): void {
  const key = `${lot.seller}:${lot.bank}`;
  buyer.demand -= n;
  buyer.cash -= lot.price * n;
  lot.qty -= n;
  stock.set(key, (stock.get(key) ?? 0) - n);
  const last = buyer.taken[buyer.taken.length - 1];
  if (last && last.listing === lot.id) last.qty += n;
  else buyer.taken.push({ listing: lot.id, qty: n });
}

/** Cheapest share lots of the bid's bank, at or under the limit. A contested
 *  lot draws. The buyer does not take their own lot. */
export function clearShares(world: World, bids: readonly ShareBid[]): SharePlan {
  const stock = new Map<string, Qty>();
  for (const share of Object.values(world.shares)) {
    const key = `${share.holder}:${share.bank}`;
    stock.set(key, (stock.get(key) ?? 0) + share.units);
  }
  const buyers: ShareBuyer[] = bids.map((bid) => {
    const person = world.people[bid.buyer];
    const qty = Number.isInteger(bid.qty) && bid.qty > 0 ? bid.qty : 0;
    return {
      id: bid.buyer,
      bank: bid.bank,
      limit: bid.limit,
      demand: person && person.alive ? qty : 0,
      cash: person ? cashOf(world, person.id) : 0,
      taken: [],
    };
  });
  let cursor = world;
  for (const lot of shareLots(world)) {
    let guard = 0;
    while (lot.qty > 0 && guard++ < 10000) {
      const key = `${lot.seller}:${lot.bank}`;
      const onHand = stock.get(key) ?? 0;
      if (onHand <= 0) break;
      const now = buyers.filter((b) => {
        if (b.demand <= 0 || b.bank !== lot.bank || b.limit < lot.price) return false;
        if (b.id === lot.seller || b.cash < lot.price) return false;
        return true;
      }).sort(byId);
      if (now.length === 0) break;
      const supply = Math.min(lot.qty, onHand);
      const wants = now.map((b) => Math.min(b.demand, Math.floor(b.cash / lot.price)));
      const total = wants.reduce((s, n) => s + n, 0);
      if (now.length === 1 || total <= supply) {
        for (let i = 0; i < now.length; i++) {
          const n = Math.min(wants[i], lot.qty, stock.get(key) ?? 0);
          if (n > 0) giveShare(now[i], lot, n, stock);
        }
        break;
      }
      const drawn = permute(cursor, now);
      cursor = drawn.world;
      for (const buyer of drawn.order) {
        if (lot.qty <= 0 || (stock.get(key) ?? 0) <= 0) break;
        if (buyer.demand <= 0 || buyer.cash < lot.price) continue;
        giveShare(buyer, lot, 1, stock);
      }
    }
  }
  return {
    world: cursor,
    byBuyer: buyers.map((b) => ({
      buyer: b.id,
      filled: b.taken.reduce((s, lot) => s + lot.qty, 0),
      lots: b.taken.filter((lot) => lot.qty > 0),
    })),
  };
}

export function sharesHeld(world: World, holder: Id, bank: BankId): Qty {
  return heldShares(world, holder, bank);
}

function houseListing(
  world: World,
  houseId: Id,
): { id: Id; price: Money; seller: Id } | null {
  for (const listing of world.listings) {
    if (listing.kind !== "houseSale" || listing.qty <= 0) continue;
    if (houseOf(listing.payload) !== houseId) continue;
    return { id: listing.id, price: listing.price, seller: listing.seller };
  }
  return null;
}

/** One solvent bidder wins without a draw. Two or more are permuted, and the
 *  first in that order wins. A bidder who cannot pay the ask is not in the draw. */
export function clearHouses(world: World, bids: readonly HouseBid[]): HousePlan {
  const byHouse = new Map<Id, HouseBid[]>();
  for (const bid of bids) {
    const rows = byHouse.get(bid.house) ?? [];
    rows.push(bid);
    byHouse.set(bid.house, rows);
  }
  const houses = [...byHouse.keys()].sort();
  let cursor = world;
  const cash = new Map<Id, Money>();
  const won = new Map<string, boolean>();
  for (const houseId of houses) {
    const listing = houseListing(world, houseId);
    const rows = byHouse.get(houseId) ?? [];
    const solvent = listing
      ? rows.filter((bid) => {
        const person = world.people[bid.buyer];
        if (!person || !person.alive || bid.buyer === listing.seller) return false;
        const have = cash.get(bid.buyer) ?? cashOf(world, bid.buyer);
        return have >= listing.price;
      }).sort((x, y) => x.buyer < y.buyer ? -1 : x.buyer > y.buyer ? 1 : 0)
      : [];
    let winner: Id | null = null;
    if (solvent.length === 1) winner = solvent[0].buyer;
    if (solvent.length >= 2) {
      const drawn = permute(cursor, solvent);
      cursor = drawn.world;
      winner = drawn.order[0].buyer;
    }
    for (const bid of rows) won.set(`${bid.buyer}:${houseId}`, bid.buyer === winner);
    if (winner && listing) {
      const have = cash.get(winner) ?? cashOf(world, winner);
      cash.set(winner, have - listing.price);
    }
  }
  return {
    world: cursor,
    byBuyer: bids.map((bid) => ({
      buyer: bid.buyer,
      house: bid.house,
      listing: houseListing(world, bid.house)?.id ?? "",
      won: won.get(`${bid.buyer}:${bid.house}`) ?? false,
    })),
  };
}

function jobPayload(world: World, listingId: Id) {
  const listing = world.listings.find((l) => l.id === listingId);
  if (
    !listing || listing.kind !== "job" || !listing.payload ||
    !("career" in listing.payload)
  ) {
    return null;
  }
  const payload = listing.payload;
  if (!("slots" in payload) || !("generation" in payload) || !("salary" in payload)) {
    return null;
  }
  return { listing, payload };
}

/** Incumbents who keep, and who do not also win another listing, take slots
 *  first. Their salary is not decided here. Applicants need a level at least
 *  the listing's generation. A shortfall of healthier applicants is what lets
 *  a low-health applicant in. */
export function seatJobs(world: World, wishes: readonly JobWish[]): JobPlan {
  const slots = new Map<Id, Qty>();
  for (const listing of world.listings) {
    if (listing.kind === "job" && listing.qty > 0) slots.set(listing.id, listing.qty);
  }
  const rows: JobPlan["rows"] = [];

  const keeps = wishes.filter((w) => w.kind === "keep").map((w) => w.person).sort();
  for (const personId of keeps) {
    const person = world.people[personId];
    const match = person?.job
      ? world.listings.find((l) => {
        if (l.kind !== "job" || l.seller !== person.job?.firm) return false;
        const found = jobPayload(world, l.id);
        return found?.payload.career === person.job?.career;
      })
      : undefined;
    if (!person || !person.alive || !person.job || !match) {
      rows.push({ person: personId, listing: match?.id ?? "", outcome: "unposted" });
      continue;
    }
    const left = slots.get(match.id) ?? 0;
    if (left <= 0) {
      rows.push({ person: personId, listing: match.id, outcome: "rationed" });
      continue;
    }
    slots.set(match.id, left - 1);
    rows.push({ person: personId, listing: match.id, outcome: "seated" });
  }

  const applies = wishes.filter((w): w is { person: Id; kind: "apply"; listing: Id } =>
    w.kind === "apply"
  );
  const byListing = new Map<Id, string[]>();
  for (const wish of applies) {
    const people = byListing.get(wish.listing) ?? [];
    people.push(wish.person);
    byListing.set(wish.listing, people);
  }
  let cursor = world;
  for (const listingId of [...byListing.keys()].sort()) {
    const found = jobPayload(world, listingId);
    for (const personId of byListing.get(listingId) ?? []) {
      const person = world.people[personId];
      if (!person || !person.alive || !found) {
        rows.push({ person: personId, listing: listingId, outcome: "unposted" });
        continue;
      }
      if (person.education[found.payload.career] < found.payload.generation) {
        rows.push({ person: personId, listing: listingId, outcome: "ineligible" });
      }
    }
    const eligible = (byListing.get(listingId) ?? []).filter((personId) => {
      const person = world.people[personId];
      if (!person || !person.alive || !found) return false;
      if (
        rows.some((row) =>
          row.person === personId && row.listing === listingId && row.outcome === "seated"
        )
      ) return false;
      return person.education[found.payload.career] >= found.payload.generation;
    });
    const bands = new Map<number, Id[]>();
    for (const personId of eligible) {
      const health = world.people[personId].health;
      const band = bands.get(health) ?? [];
      band.push(personId);
      bands.set(health, band);
    }
    const healths = [...bands.keys()].sort((x, y) => y - x);
    let left = slots.get(listingId) ?? 0;
    const winners: Id[] = [];
    for (const health of healths) {
      if (left <= 0) break;
      const band = (bands.get(health) ?? []).slice().sort();
      let ordered = band;
      if (band.length > left) {
        const drawn = permute(cursor, band);
        cursor = drawn.world;
        ordered = drawn.order;
      }
      for (const personId of ordered) {
        if (left <= 0) break;
        winners.push(personId);
        left -= 1;
      }
    }
    slots.set(listingId, left);
    for (const personId of winners) {
      // The chair they leave stays empty until next year. Putting the slot
      // back would hire someone into a post the incumbent has already vacated.
      const earlier = rows.find((row) =>
        row.person === personId && row.outcome === "seated"
      );
      if (earlier) earlier.outcome = "rationed";
      rows.push({ person: personId, listing: listingId, outcome: "seated" });
    }
    for (const personId of eligible) {
      if (winners.includes(personId)) continue;
      rows.push({ person: personId, listing: listingId, outcome: "rationed" });
    }
  }
  return { world: cursor, rows };
}

export function postedJobs(
  world: World,
): { career: Career; generation: number; salary: Money; slots: number }[] {
  const rows = [];
  for (const listing of world.listings) {
    if (listing.kind !== "job") continue;
    const found = jobPayload(world, listing.id);
    if (!found) continue;
    rows.push({
      career: found.payload.career,
      generation: found.payload.generation,
      salary: found.payload.salary,
      slots: found.payload.slots,
    });
  }
  return rows;
}

/** Cheapest machine lots at or under the limit. A contested lot draws.
 *  The buyer is a firm. It does not buy its own listing. */
export function clearMachines(world: World, bids: readonly MachineBid[]): MachinePlan {
  const lots: Lot[] = [];
  for (const listing of world.listings) {
    if (listing.kind !== "machine" || listing.qty <= 0 || listing.price <= 0) continue;
    lots.push({
      id: listing.id,
      seller: listing.seller,
      price: listing.price,
      qty: listing.qty,
    });
  }
  lots.sort((x, y) => x.price - y.price || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
  const buyers = bids.map((bid) => {
    const firm = world.firms[bid.firm];
    const qty = Number.isInteger(bid.qty) && bid.qty > 0 ? bid.qty : 0;
    return {
      id: bid.firm,
      listing: bid.listing,
      limit: bid.limit,
      demand: firm && !firm.folded ? qty : 0,
      cash: firm ? cashOf(world, firm.id) : 0,
      taken: [] as PlannedLot[],
    };
  });
  let cursor = world;
  for (const lot of lots) {
    let guard = 0;
    while (lot.qty > 0 && guard++ < 10000) {
      const now = buyers.filter((b) => {
        if (b.demand <= 0 || b.listing !== lot.id || b.limit < lot.price) return false;
        if (b.id === lot.seller || b.cash < lot.price) return false;
        return true;
      }).sort(byId);
      if (now.length === 0) break;
      const wants = now.map((b) => Math.min(b.demand, Math.floor(b.cash / lot.price)));
      const total = wants.reduce((s, n) => s + n, 0);
      if (now.length === 1 || total <= lot.qty) {
        for (let i = 0; i < now.length; i++) {
          const n = Math.min(wants[i], lot.qty);
          if (n <= 0) continue;
          now[i].demand -= n;
          now[i].cash -= lot.price * n;
          lot.qty -= n;
          now[i].taken.push({ listing: lot.id, qty: n });
        }
        break;
      }
      const drawn = permute(cursor, now);
      cursor = drawn.world;
      for (const buyer of drawn.order) {
        if (lot.qty <= 0 || buyer.demand <= 0 || buyer.cash < lot.price) continue;
        buyer.demand -= 1;
        buyer.cash -= lot.price;
        lot.qty -= 1;
        const last = buyer.taken[buyer.taken.length - 1];
        if (last && last.listing === lot.id) last.qty += 1;
        else buyer.taken.push({ listing: lot.id, qty: 1 });
      }
    }
  }
  return {
    world: cursor,
    byFirm: buyers.map((b) => ({
      firm: b.id,
      filled: b.taken.reduce((s, lot) => s + lot.qty, 0),
      lots: b.taken.filter((lot) => lot.qty > 0),
    })),
  };
}

function rentListing(world: World, houseId: Id) {
  for (const listing of world.listings) {
    if (listing.kind !== "rent" || listing.qty <= 0) continue;
    if (houseOf(listing.payload) !== houseId) continue;
    return listing;
  }
  return null;
}

/** The sitting tenant, if they bid and can pay the year, takes the house.
 *  Otherwise the highest salary does. A tie at one salary draws. A bid the
 *  purse cannot cover is `short`, which the gate refuses. */
export function seatRents(world: World, bids: readonly RentBid[]): RentPlan {
  const byHouse = new Map<Id, RentBid[]>();
  for (const bid of bids) {
    const rows = byHouse.get(bid.house) ?? [];
    rows.push(bid);
    byHouse.set(bid.house, rows);
  }
  let cursor = world;
  const cash = new Map<Id, Money>();
  const outcome = new Map<string, RentOutcome>();
  const listingOf = new Map<string, Id>();
  for (const houseId of [...byHouse.keys()].sort()) {
    const listing = rentListing(world, houseId);
    const house = world.houses[houseId];
    const rows = byHouse.get(houseId) ?? [];
    for (const bid of rows) listingOf.set(`${bid.person}:${houseId}`, listing?.id ?? "");
    if (!listing || !house) {
      for (const bid of rows) outcome.set(`${bid.person}:${houseId}`, "short");
      continue;
    }
    const solvent: RentBid[] = [];
    for (const bid of rows) {
      const person = world.people[bid.person];
      const have = cash.get(bid.person) ?? cashOf(world, bid.person);
      if (!person || !person.alive || have < listing.price) {
        outcome.set(`${bid.person}:${houseId}`, "short");
        continue;
      }
      solvent.push(bid);
    }
    const sitting = solvent.find((bid) => house.occupant === bid.person);
    let winner: Id | null = sitting ? sitting.person : null;
    if (!winner) {
      const bands = new Map<number, RentBid[]>();
      for (const bid of solvent) {
        const salary = world.people[bid.person].job?.salary ?? 0;
        const band = bands.get(salary) ?? [];
        band.push(bid);
        bands.set(salary, band);
      }
      const salaries = [...bands.keys()].sort((x, y) => y - x);
      if (salaries.length > 0) {
        const top = (bands.get(salaries[0]) ?? []).slice().sort((x, y) =>
          x.person < y.person ? -1 : x.person > y.person ? 1 : 0
        );
        if (top.length === 1) winner = top[0].person;
        if (top.length >= 2) {
          const drawn = permute(cursor, top);
          cursor = drawn.world;
          winner = drawn.order[0].person;
        }
      }
    }
    for (const bid of solvent) {
      outcome.set(
        `${bid.person}:${houseId}`,
        bid.person === winner ? "seated" : "rationed",
      );
    }
    if (winner) {
      const have = cash.get(winner) ?? cashOf(world, winner);
      cash.set(winner, have - listing.price);
    }
  }
  return {
    world: cursor,
    rows: bids.map((bid) => ({
      person: bid.person,
      listing: listingOf.get(`${bid.person}:${bid.house}`) ?? "",
      outcome: outcome.get(`${bid.person}:${bid.house}`) ?? "short",
    })),
  };
}
