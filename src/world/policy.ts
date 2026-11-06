// policy.ts — the scripted slot from Part IV. A pure function of the world.
// The leaf posts the number this returns. The reducer does not compute a second one.
//
// A marked base of zero is not a full book: there is no positive ceiling to
// have reached. sellCapital still treats loans against a zero base as distress,
// because that test is `loans > multiple × base`.

import { params } from "./params.ts";
import { collateralValue, markedMineBase, purseOf } from "./world.ts";
import { requestLoanGate } from "./gates.ts";
import type {
  BankId,
  Career,
  Disease,
  FlowRow,
  Good,
  Id,
  Listing,
  Material,
  Money,
  Objective,
  Qty,
  World,
} from "./types.ts";
import {
  CAREERS,
  diseaseOf,
  DISEASES,
  goodOf,
  otherBank,
  tuitionCareer,
} from "./types.ts";

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

function scale(price: Money, ratio: { num: number; den: number }): Money {
  if (
    !Number.isInteger(ratio.num) || !Number.isInteger(ratio.den) ||
    ratio.num < 1 || ratio.den < 1
  ) {
    throw new Error("reprice factor is not a positive integer ratio");
  }
  const next = Math.floor(price * ratio.num / ratio.den);
  // A post at 0 is refused, so the next price stays at 1.
  return next < 1 ? 1 : next;
}

function goodPosts(world: World, firmId: Id, good: Good): Listing[] {
  return world.listings.filter((listing) =>
    listing.seller === firmId && listing.kind === "good" &&
    goodOf(listing.payload) === good
  );
}

/** Next staple post, from the latest listing. None yet keeps the t₀ price.
 *  Nothing left on it sold out, so the price multiplies by `raiseFactor`.
 *  Bread left on it went unsold, so the price multiplies by `cutFactor`.
 *  The listing does not remember its original qty, so any remainder is the
 *  cut. A competitor's latest post, when lower, caps the result at that
 *  post times `undercutFactor`. */
/** The reprice rule, for any continuously posted good. From the firm's latest
 *  listing of that good: none yet keeps `opening`; nothing left sold out, so the
 *  price multiplies by `raiseFactor`; stock left went unsold, so it multiplies by
 *  `cutFactor`. A cheaper rival's latest post caps the result at that post times
 *  `undercutFactor`. Staple and the discretionary goods share this; only the
 *  opening price and (for discretionary) the `discretionaryDiscovery` switch
 *  differ. */
export function nextPostPrice(
  world: World,
  firmId: Id,
  good: Good,
  opening: Money,
): Money {
  const mine = goodPosts(world, firmId, good);
  const last = mine[mine.length - 1];
  if (!last) return opening;
  // Staple cuts by its own (frozen) factor; a want cuts by the discretionary
  // one, so a leftover shelf can fall toward a clearing level without dragging
  // the necessity down with it. Both raise by the shared raiseFactor.
  const cut = good === "staple" ? params.cutFactor : params.discretionaryCut;
  const ratio = last.qty > 0 ? cut : params.raiseFactor;
  let price = scale(last.price, ratio);
  let cap = price;
  let bound = false;
  for (const other of Object.keys(world.firms).sort()) {
    if (other === firmId) continue;
    const posts = goodPosts(world, other, good);
    const posted = posts[posts.length - 1];
    if (!posted || posted.price >= price) continue;
    const there = scale(posted.price, params.undercutFactor);
    if (!bound || there < cap) {
      cap = there;
      bound = true;
    }
  }
  return bound && cap < price ? cap : price;
}

export function nextStaplePrice(world: World, firmId: Id): Money {
  return nextPostPrice(world, firmId, "staple", params.stapleReservePrice);
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

// The other scripted leaves. Each one is a pure function of the world.
// None of them reads a forecast of the price level.
//
// The government sees the diseases people hold when it is asked. The opening
// draw has already run, and there is no disease ledger, so that count is the
// observation. "Last month" in the plan is the ban on a forecast.
//
// The entrepreneur's reserve is this month's outflow on maintenance, tax, and
// debt service. Those lines are last month's bill settling at the opening.
// The draw stays an engine writeback. The policy is what "remains" means.
//
// A lender who declines is not asked. Silence is not a shape.
//
// A household buys down its objective's chain, one lot at a time, cheapest
// first. Savings and investment buy none of these goods. Investment's assets
// are the markets this milestone does not build. A jobless person trains
// toward the archive career with the most slots.

const RESERVE_ROWS: readonly FlowRow[] = [
  "wages",
  "maintenance",
  "tax",
  "bankInterest",
  "bankPrincipal",
  "privateInstallment",
];

const SALE_ROWS: readonly FlowRow[] = [
  "staple",
  "luxuryFood",
  "nightclub",
  "tuition",
  "privateCure",
  "ore",
];

export const DOCTOR_REASON = "doctors are pointed at the diseases people hold";
export const TEACHER_REASON = "teachers are pointed at the careers that listed slots";

function byId(ids: Id[]): Id[] {
  return [...ids].sort((x, y) => (x < y ? -1 : x > y ? 1 : 0));
}

function publicStaff(world: World, career: "doctor" | "teacher"): Id[] {
  const kind = career === "doctor" ? "publicHospital" : "publicUniversity";
  const ids: Id[] = [];
  for (const person of Object.values(world.people)) {
    if (!person.alive || !person.job || person.job.career !== career) continue;
    const firm = world.firms[person.job.firm];
    if (!firm || firm.folded || firm.kind !== kind) continue;
    ids.push(person.id);
  }
  return byId(ids);
}

export function doctorMix(world: World): { person: Id; disease: Disease }[] {
  const counts = new Map<Disease, number>();
  for (const person of Object.values(world.people)) {
    if (!person.alive) continue;
    for (const disease of person.diseases) {
      counts.set(disease, (counts.get(disease) ?? 0) + 1);
    }
  }
  const diseases = DISEASES.filter((disease) => (counts.get(disease) ?? 0) > 0).sort(
    (x, y) => {
      const delta = (counts.get(y) ?? 0) - (counts.get(x) ?? 0);
      if (delta !== 0) return delta;
      return DISEASES.indexOf(x) - DISEASES.indexOf(y);
    },
  );
  return publicStaff(world, "doctor").slice(0, diseases.length).map((person, i) => ({
    person,
    disease: diseases[i],
  }));
}

export function teacherMix(world: World): { person: Id; career: Career }[] {
  const slots = new Map<Career, number>();
  for (const row of world.jobArchive.listings) {
    slots.set(row.career, (slots.get(row.career) ?? 0) + row.slots);
  }
  const careers = CAREERS.filter((career) => (slots.get(career) ?? 0) > 0).sort(
    (x, y) => {
      const delta = (slots.get(y) ?? 0) - (slots.get(x) ?? 0);
      if (delta !== 0) return delta;
      return CAREERS.indexOf(x) - CAREERS.indexOf(y);
    },
  );
  return publicStaff(world, "teacher").slice(0, careers.length).map((person, i) => ({
    person,
    career: careers[i],
  }));
}

/** The archive career with the most slots. Ties break by `CAREERS` order. */
export function archiveCareer(world: World): { career: Career; slots: number } | null {
  let best: { career: Career; slots: number } | null = null;
  const slots = new Map<Career, number>();
  for (const row of world.jobArchive.listings) {
    slots.set(row.career, (slots.get(row.career) ?? 0) + row.slots);
  }
  for (const career of CAREERS) {
    const n = slots.get(career) ?? 0;
    if (n <= 0) continue;
    if (!best || n > best.slots) best = { career, slots: n };
  }
  return best;
}

export type TrainingBid = { person: Id; career: Career; reason: string };

/** Jobless living people train toward the archive. A person with a job does not. */
export function trainingBids(world: World): TrainingBid[] {
  const top = archiveCareer(world);
  if (!top) return [];
  const bids: TrainingBid[] = [];
  for (const person of byId(Object.keys(world.people)).map((id) => world.people[id])) {
    if (!person.alive || person.job) continue;
    bids.push({
      person: person.id,
      career: top.career,
      reason: `${person.id} trains toward ${top.career}, which listed ${top.slots} slots`,
    });
  }
  return bids;
}

/** This month's wage, maintenance, tax, and debt service. Older lines are a
 *  bill already met. The builder's inflow is not a reserve. */
/** Wages owed this month by one firm. Inlined from purses.wageBill to avoid an
 *  import cycle: purses already reads drawAmount from here. */
function wageBillSum(world: World, firmId: Id): Money {
  let sum = 0;
  for (const person of Object.values(world.people)) {
    if (!person.alive || !person.job) continue;
    if (person.job.firm !== firmId || person.job.salary <= 0) continue;
    sum += person.job.salary;
  }
  return sum;
}

export function operatingReserve(world: World, firmId: Id): Money {
  let reserve = 0;
  for (const line of world.flows) {
    if (line.month !== world.month) continue;
    if (line.holder !== firmId || line.amount >= 0) continue;
    if (!RESERVE_ROWS.includes(line.row as FlowRow)) continue;
    reserve -= line.amount;
  }
  // Working capital: a year of payroll, so the draw leaves the firm a buffer
  // instead of sweeping it hand-to-mouth. The month's own bill is still a floor.
  const working = params.firmReserveMonths * wageBillSum(world, firmId);
  return Math.max(reserve, working);
}

/** Cash left after the reserve. Folded, missing, and fully reserved firms draw nothing. */
export function drawAmount(world: World, firmId: Id): Money {
  const firm = world.firms[firmId];
  if (!firm || firm.folded) return 0;
  const cash = firm.deposits.a + firm.deposits.b;
  return Math.max(0, cash - operatingReserve(world, firmId));
}

/** A firm's sale inflows, or the government's tax. Not a forecast. */
export function disclosedRevenue(world: World, issuer: Id): Money {
  if (issuer === world.government.id) return world.government.taxLastMonth;
  let revenue = 0;
  for (const line of world.flows) {
    if (line.holder !== issuer || line.amount <= 0) continue;
    if (!SALE_ROWS.includes(line.row as FlowRow)) continue;
    revenue += line.amount;
  }
  return revenue;
}

/** True when disclosed revenue covers `revenueCover` installments. */
export function lenderAccepts(world: World, issuer: Id, installment: Money): boolean {
  if (!Number.isInteger(installment) || installment <= 0) return false;
  const cover = params.revenueCover * installment;
  if (!Number.isSafeInteger(cover)) return false;
  return disclosedRevenue(world, issuer) >= cover;
}

const CHAIN: Record<
  Objective,
  readonly ("nightclub" | "luxuryFood" | "cure" | "tuition")[]
> = {
  happiness: ["nightclub"],
  health: ["nightclub", "luxuryFood", "cure"],
  education: ["nightclub", "luxuryFood", "tuition"],
  savings: [],
  investment: [],
};

export type SpendOrder =
  | {
    tag: "good";
    person: Id;
    good: "luxuryFood" | "nightclub";
    listing: Id;
    qty: 1;
    reason: string;
  }
  | {
    tag: "tuition";
    person: Id;
    career: Career;
    provider: Id;
    listing: Id;
    qty: Qty;
    reason: string;
  }
  | {
    tag: "cure";
    person: Id;
    disease: Disease;
    provider: Id;
    listing: Id;
    qty: Qty;
    reason: string;
  };

function cashOf(world: World, id: Id): Money {
  const purse = purseOf(world, id);
  return purse ? purse.a + purse.b : 0;
}

function cheapest(
  world: World,
  taken: Map<Id, Qty>,
  need: Qty,
  pred: (listing: Listing) => boolean,
): Listing | null {
  let best: Listing | null = null;
  for (const listing of world.listings) {
    if (!pred(listing)) continue;
    if (listing.price <= 0) continue;
    const left = listing.qty - (taken.get(listing.id) ?? 0);
    if (left < need) continue;
    if (
      !best || listing.price < best.price ||
      (listing.price === best.price && listing.id < best.id)
    ) {
      best = listing;
    }
  }
  return best;
}

function hold(taken: Map<Id, Qty>, listing: Listing, qty: Qty): void {
  taken.set(listing.id, (taken.get(listing.id) ?? 0) + qty);
}

/** One pass down each living person's chain. Cheapest lot. Buyers in id order. */
export function householdSpend(world: World): SpendOrder[] {
  const orders: SpendOrder[] = [];
  const taken = new Map<Id, Qty>();
  const cash = new Map<Id, Money>();
  for (const person of byId(Object.keys(world.people)).map((id) => world.people[id])) {
    if (!person.alive) continue;
    cash.set(person.id, cashOf(world, person.id));
    for (const step of CHAIN[person.objective]) {
      const have = cash.get(person.id) ?? 0;
      if (step === "nightclub" || step === "luxuryFood") {
        // Elastic demand: buy up to params.demandLots lots this step, cheapest
        // first, re-reading cash after each. At demandLots = 1 this is one lot —
        // the frozen pass. Above 1, a buyer keeps buying, so demand can outrun a
        // seller's shelf and a listing can sell out.
        const verb = step === "nightclub" ? "a nightclub unit" : "luxury food";
        for (let lot = 0; lot < params.demandLots; lot++) {
          const left = cash.get(person.id) ?? 0;
          const listing = cheapest(
            world,
            taken,
            1,
            (row) => row.kind === "good" && goodOf(row.payload) === step,
          );
          if (!listing || listing.price > left) break;
          hold(taken, listing, 1);
          cash.set(person.id, left - listing.price);
          orders.push({
            tag: "good",
            person: person.id,
            good: step,
            listing: listing.id,
            qty: 1,
            reason: `${person.id} buys ${verb} for ${person.objective}`,
          });
        }
        continue;
      }
      if (step === "tuition") {
        const top = archiveCareer(world);
        if (!top) continue;
        const need = params.unitsPerLevel;
        const listing = cheapest(
          world,
          taken,
          need,
          (row) => tuitionCareer(row.payload) === top.career,
        );
        if (!listing) continue;
        const cost = listing.price * need;
        if (!Number.isSafeInteger(cost) || cost > have) continue;
        hold(taken, listing, need);
        cash.set(person.id, have - cost);
        orders.push({
          tag: "tuition",
          person: person.id,
          career: top.career,
          provider: listing.seller,
          listing: listing.id,
          qty: need,
          reason: `${person.id} trains toward ${top.career}`,
        });
        continue;
      }
      const diseases = DISEASES.filter((disease) => person.diseases.includes(disease));
      for (const disease of diseases) {
        const need = params.cureSize;
        const listing = cheapest(
          world,
          taken,
          need,
          (row) => row.kind === "cure" && diseaseOf(row.payload) === disease,
        );
        if (!listing) continue;
        const cost = listing.price * need;
        if (!Number.isSafeInteger(cost) || cost > have) continue;
        hold(taken, listing, need);
        cash.set(person.id, have - cost);
        orders.push({
          tag: "cure",
          person: person.id,
          disease,
          provider: listing.seller,
          listing: listing.id,
          qty: need,
          reason: `${person.id} buys a ${disease} cure for health`,
        });
        break;
      }
    }
  }
  return orders;
}
