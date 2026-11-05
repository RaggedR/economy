// health.ts — disease draws and the public lottery, as pure plans.
//
// pinHealth names the cause. The disease cause also names which of the five,
// because Person.diseases and cure need that identity and a second effect tag
// would only repeat it. A miss writes nothing. A hit the person already carries
// writes nothing either. Both still advance the stream.
//
// The lottery is not productC. Bids are collected first. Homeless, then renters,
// then owners. Inside a tier that has more claimants than awards left, the
// house-sale permutation draws once per claimant, including the last. A tier
// the awards cover, and a tier with nothing left, does not draw.
//
// Public supply is output(c, g) of the machines those assignees staff. One
// assignee is not one award. A winner takes the whole cure or the whole level.
// A loser takes nothing. Private cures and tuition are not this draw.

import { params } from "./params.ts";
import { nextIndex, nextUint } from "./rng.ts";
import { awardSupply } from "./tech.ts";
import type { Career, Disease, Id, Money, Qty, World } from "./types.ts";
import { CAREERS, diseaseOf, DISEASES, tuitionCareer } from "./types.ts";
import { purseOf } from "./world.ts";

export type Tenure = "homeless" | "renter" | "owner";

export type Strike = { person: Id; disease: Disease };

export type CureBid = { person: Id; disease: Disease };
export type EducationBid = { person: Id; career: Career };

export type CureRow = CureBid & { granted: boolean; eligible: boolean };
export type EducationRow = EducationBid & { granted: boolean; eligible: boolean };

export type PrivateRow = {
  person: Id;
  listing: Id;
  qty: Qty;
  refuse: boolean;
};

function chance(): { hit: number; outOf: number } {
  const { diseaseHit: hit, diseaseOutOf: outOf } = params;
  if (
    !Number.isInteger(hit) || !Number.isInteger(outOf) || hit < 0 || outOf <= 0 ||
    hit > outOf
  ) {
    throw new Error("disease chance is not an integer fraction");
  }
  return { hit, outOf };
}

export function tenure(world: World, personId: Id): Tenure {
  const person = world.people[personId];
  if (!person || person.dwelling === null) return "homeless";
  const house = world.houses[person.dwelling];
  if (!house) return "homeless";
  return house.owner === personId ? "owner" : "renter";
}

/** Living people, id order. The returned world differs only in `rng`. */
export function drawDiseases(world: World): { world: World; strikes: Strike[] } {
  const { hit, outOf } = chance();
  const ids = Object.values(world.people)
    .filter((person) => person.alive)
    .map((person) => person.id)
    .sort();
  const strikes: Strike[] = [];
  let cursor = world;
  for (const id of ids) {
    const drawn = nextUint(cursor.rng);
    cursor = { ...cursor, rng: drawn.state };
    if (drawn.value % outOf >= hit) continue;
    const which = nextIndex(cursor, DISEASES.length);
    cursor = which.world;
    const disease = DISEASES[which.index];
    if (cursor.people[id].diseases.includes(disease)) continue;
    strikes.push({ person: id, disease });
  }
  return { world: cursor, strikes };
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

function publicDoctors(world: World, disease: Disease): number {
  return awardSupply(world, "doctor", disease);
}

function publicTeachers(world: World, career: Career): number {
  return awardSupply(world, "teacher", career);
}

function serve<T extends { person: Id }>(
  world: World,
  pool: readonly T[],
  awards: number,
): { world: World; winners: Set<Id> } {
  const winners = new Set<Id>();
  let left = awards;
  let cursor = world;
  for (const tier of ["homeless", "renter", "owner"] as const) {
    const band = pool.filter((row) => tenure(world, row.person) === tier)
      .sort((x, y) => (x.person < y.person ? -1 : x.person > y.person ? 1 : 0));
    if (band.length === 0) continue;
    if (left <= 0) continue;
    if (left >= band.length) {
      for (const row of band) winners.add(row.person);
      left -= band.length;
      continue;
    }
    const drawn = permute(cursor, band);
    cursor = drawn.world;
    for (const row of drawn.order.slice(0, left)) winners.add(row.person);
    left = 0;
  }
  return { world: cursor, winners };
}

function cureEligible(world: World, bid: CureBid): boolean {
  const person = world.people[bid.person];
  return !!person && person.alive && person.diseases.includes(bid.disease);
}

function educationEligible(world: World, bid: EducationBid): boolean {
  const person = world.people[bid.person];
  return !!person && person.alive;
}

/** Bids for one disease, or one career, are unique. The world differs only in `rng`. */
export function planLottery(
  world: World,
  cures: readonly CureBid[],
  education: readonly EducationBid[],
): { world: World; cures: CureRow[]; education: EducationRow[] } {
  const seen = new Set<string>();
  for (const bid of cures) {
    const key = `${bid.person}:cure:${bid.disease}`;
    if (seen.has(key)) throw new Error(`duplicate cure bid ${key}`);
    seen.add(key);
  }
  for (const bid of education) {
    const key = `${bid.person}:level:${bid.career}`;
    if (seen.has(key)) throw new Error(`duplicate education bid ${key}`);
    seen.add(key);
  }
  let cursor = world;
  const cureGranted = new Map<string, boolean>();
  for (const disease of DISEASES) {
    const pool = cures.filter((bid) =>
      bid.disease === disease && cureEligible(world, bid)
    );
    const served = serve(cursor, pool, publicDoctors(world, disease));
    cursor = served.world;
    for (const bid of pool) {
      cureGranted.set(
        `${bid.person}:${bid.disease}`,
        served.winners.has(bid.person),
      );
    }
  }
  const levelGranted = new Map<string, boolean>();
  for (const career of CAREERS) {
    const pool = education.filter((bid) =>
      bid.career === career && educationEligible(world, bid)
    );
    const served = serve(cursor, pool, publicTeachers(world, career));
    cursor = served.world;
    for (const bid of pool) {
      levelGranted.set(`${bid.person}:${bid.career}`, served.winners.has(bid.person));
    }
  }
  return {
    world: cursor,
    cures: cures.map((bid) => ({
      ...bid,
      eligible: cureEligible(world, bid),
      granted: cureGranted.get(`${bid.person}:${bid.disease}`) ?? false,
    })),
    education: education.map((bid) => ({
      ...bid,
      eligible: educationEligible(world, bid),
      granted: levelGranted.get(`${bid.person}:${bid.career}`) ?? false,
    })),
  };
}

function cashOf(world: World, id: Id): Money {
  const purse = purseOf(world, id);
  return purse ? purse.a + purse.b : 0;
}

function oneListing(
  rows: World["listings"],
  label: string,
): World["listings"][number] | null {
  if (rows.length > 1) throw new Error(`${label} matches ${rows.length} listings`);
  return rows[0] ?? null;
}

/** Named provider, one listing. No draw. A short bundle is rationed. A purse
 *  that cannot pay the posted bundle is a refusal. Cash and stock are spent
 *  in order, cures then tuition, so a later buy sees the earlier one. */
export function planDiscretionary(
  world: World,
  cures: readonly { person: Id; disease: Disease; provider: Id }[],
  tuition: readonly { person: Id; career: Career; provider: Id }[],
): { cures: PrivateRow[]; tuition: PrivateRow[] } {
  const cash = new Map<Id, Money>();
  const stock = new Map<Id, Qty>();
  const held = (id: Id): Money => cash.get(id) ?? cashOf(world, id);
  const listed = (id: Id, qty: Qty): Qty => stock.get(id) ?? qty;

  const cureRows: PrivateRow[] = cures.map((bid) => {
    const bundle = params.cureSize;
    const rows = world.listings.filter((listing) =>
      listing.kind === "cure" && listing.seller === bid.provider &&
      diseaseOf(listing.payload) === bid.disease
    );
    const listing = oneListing(rows, `${bid.provider} ${bid.disease}`);
    const person = world.people[bid.person];
    const has = !!person && person.alive && person.diseases.includes(bid.disease);
    if (!has || !listing) {
      return {
        person: bid.person,
        listing: listing?.id ?? "",
        qty: bundle,
        refuse: true,
      };
    }
    if (listed(listing.id, listing.qty) < bundle) {
      return { person: bid.person, listing: listing.id, qty: 0, refuse: false };
    }
    const cost = listing.price * bundle;
    if (held(bid.person) < cost) {
      return { person: bid.person, listing: listing.id, qty: bundle, refuse: true };
    }
    cash.set(bid.person, held(bid.person) - cost);
    stock.set(listing.id, listed(listing.id, listing.qty) - bundle);
    return { person: bid.person, listing: listing.id, qty: bundle, refuse: false };
  });

  const tuitionRows: PrivateRow[] = tuition.map((bid) => {
    const bundle = params.unitsPerLevel;
    const rows = world.listings.filter((listing) =>
      listing.kind === "good" && listing.seller === bid.provider &&
      tuitionCareer(listing.payload) === bid.career
    );
    const listing = oneListing(rows, `${bid.provider} ${bid.career}`);
    const person = world.people[bid.person];
    if (!person || !person.alive || !listing) {
      return {
        person: bid.person,
        listing: listing?.id ?? "",
        qty: bundle,
        refuse: true,
      };
    }
    if (listed(listing.id, listing.qty) < bundle) {
      return { person: bid.person, listing: listing.id, qty: 0, refuse: false };
    }
    const cost = listing.price * bundle;
    if (held(bid.person) < cost) {
      return { person: bid.person, listing: listing.id, qty: bundle, refuse: true };
    }
    cash.set(bid.person, held(bid.person) - cost);
    stock.set(listing.id, listed(listing.id, listing.qty) - bundle);
    return { person: bid.person, listing: listing.id, qty: bundle, refuse: false };
  });

  return { cures: cureRows, tuition: tuitionRows };
}
