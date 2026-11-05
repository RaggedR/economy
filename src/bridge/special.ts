// special.ts — one special day. Sellers post, the plan is fixed, then each
// leaf commits only what the plan gave it. The dividend is the engine, after
// the share book and before anyone spends it. Share trades are not run on any
// other month. Mine trades and debt are not this day.

import type { Fib } from "../lib/algebra.ts";
import { type Decoders, leafLocal, type Runner } from "../lib/algebra.ts";
import { commitEngine } from "../cli/econ.ts";
import { type Act, decodeAct } from "./containers.ts";
import { householdLeaf } from "./household.ts";
import type { HarnessCtx } from "./harness.ts";
import { type MutationOutcome, type Registry, runMutation } from "./harness.ts";
import { dividendGate, pinHealthGate } from "../world/gates.ts";
import { loadWorld, saveWorld } from "../world/store.ts";
import {
  clearHouses,
  clearMachines,
  clearShares,
  type HouseBid,
  isSpecialMonth,
  type JobWish,
  type MachineBid,
  postedJobs,
  type RentBid,
  seatJobs,
  seatRents,
  type ShareBid,
} from "../world/special.ts";
import type { BankId, Career, Id, Money, Qty, World } from "../world/types.ts";
import { houseOf } from "../world/types.ts";

type FirmDayC =
  | Fib<
    {
      tag: "postJob";
      firm: Id;
      career: Career;
      generation: number;
      salary: Money;
      slots: number;
      reason: string;
    },
    Act
  >
  | Fib<
    {
      tag: "postMachine";
      firm: Id;
      type: Career;
      generation: number;
      price: Money;
      qty: Qty;
      reason: string;
    },
    Act
  >
  | Fib<
    {
      tag: "orderMachine";
      firm: Id;
      listing: Id;
      qty: Qty;
      asked: Qty;
      reason: string;
    },
    Act
  >;

function asAct(o: MutationOutcome): Act {
  if (!o.ok) return { tag: "refused", reason: o.reason };
  if (
    o.filled !== undefined &&
    (o.filled === 0 || (o.asked !== undefined && o.filled < o.asked))
  ) {
    return { tag: "rationed", correlationId: o.correlationId, filled: o.filled };
  }
  return { tag: "done", correlationId: o.correlationId };
}

export function firmLeaf(ctx: HarnessCtx, firm: Id): Runner<FirmDayC> {
  const agentId = `firm:${firm}`;
  const reg: Registry = {
    agentId,
    allowed: new Set(["post-job", "post-machine", "order-machine"]),
    argScope: (_tool, args) => {
      if (args.firm === firm) return null;
      return `${agentId} cannot act for ${String(args.firm)}`;
    },
  };
  const decoders: Decoders<FirmDayC> = {
    postJob: decodeAct,
    postMachine: decodeAct,
    orderMachine: decodeAct,
  };
  return leafLocal(
    agentId,
    (shape) => {
      if (shape.tag === "postJob") {
        return asAct(runMutation(
          ctx,
          reg,
          "post-job",
          [
            "post-job",
            "--firm",
            firm,
            "--career",
            shape.career,
            "--generation",
            String(shape.generation),
            "--salary",
            String(shape.salary),
            "--slots",
            String(shape.slots),
          ],
          { firm },
          shape.reason,
        ));
      }
      if (shape.tag === "postMachine") {
        return asAct(runMutation(
          ctx,
          reg,
          "post-machine",
          [
            "post-machine",
            "--firm",
            firm,
            "--type",
            shape.type,
            "--generation",
            String(shape.generation),
            "--price",
            String(shape.price),
            "--qty",
            String(shape.qty),
          ],
          { firm },
          shape.reason,
        ));
      }
      return asAct(runMutation(
        ctx,
        reg,
        "order-machine",
        [
          "order-machine",
          "--firm",
          firm,
          "--listing",
          shape.listing,
          "--qty",
          String(shape.qty),
          "--asked",
          String(shape.asked),
        ],
        { firm },
        shape.reason,
      ));
    },
    decoders,
  );
}

export type SpecialOrders = {
  shareSells?: readonly {
    seller: Id;
    bank: BankId;
    qty: Qty;
    price: Money;
    reason: string;
  }[];
  shareBids?: readonly (ShareBid & { reason: string })[];
  houseOffers?: readonly { owner: Id; house: Id; ask: Money; reason: string }[];
  houseBids?: readonly (HouseBid & { reason: string })[];
  occupies?: readonly { owner: Id; house: Id; mode: "occupy" | "let"; reason: string }[];
  jobPosts?: readonly {
    firm: Id;
    career: Career;
    generation: number;
    salary: Money;
    slots: number;
    reason: string;
  }[];
  /** An apply may name the listing, or the firm and career. The id is minted
   *  when the firm posts, so the scene names the chair and the runner binds it. */
  jobWishes?: readonly (
    | { person: Id; kind: "keep"; reason: string }
    | {
      person: Id;
      kind: "apply";
      reason: string;
      listing?: Id;
      firm?: Id;
      career?: Career;
    }
  )[];
  machinePosts?: readonly {
    firm: Id;
    type: Career;
    generation: number;
    price: Money;
    qty: Qty;
    reason: string;
  }[];
  /** A bid may name the listing, or the builder. One open listing from that
   *  builder is bound after the post. */
  machineBids?: readonly {
    firm: Id;
    qty: Qty;
    limit: Money;
    reason: string;
    listing?: Id;
    seller?: Id;
  }[];
  rentPosts?: readonly { owner: Id; house: Id; rent: Money; reason: string }[];
  rentBids?: readonly (RentBid & { reason: string })[];
};

/** The scripted special day on `specialSeed`. Seed 1 gives h-cleo to Ben. */
export function specialSceneOrders(): SpecialOrders {
  return {
    shareSells: [{
      seller: "ada",
      bank: "a",
      qty: 1,
      price: 10,
      reason: "ada sells one share of bank a",
    }],
    shareBids: [{
      buyer: "ben",
      bank: "a",
      qty: 1,
      limit: 10,
      reason: "ben buys one share of bank a",
    }],
    houseOffers: [{
      owner: "cleo",
      house: "h-cleo",
      ask: 30,
      reason: "cleo offers her house",
    }],
    houseBids: [
      { buyer: "ada", house: "h-cleo", reason: "ada bids for cleo's house" },
      { buyer: "ben", house: "h-cleo", reason: "ben bids for cleo's house" },
    ],
    occupies: [
      { owner: "ada", house: "h-ada", mode: "occupy", reason: "ada keeps her house" },
      {
        owner: "ben",
        house: "h-cleo",
        mode: "occupy",
        reason: "ben moves into the house he won",
      },
    ],
    jobPosts: [{
      firm: "shop",
      career: "retail",
      generation: 0,
      salary: 20,
      slots: 1,
      reason: "the shop posts its retail chair",
    }],
    jobWishes: [
      { person: "ben", kind: "keep", reason: "ben keeps the shop" },
      {
        person: "cleo",
        kind: "apply",
        firm: "shop",
        career: "retail",
        reason: "cleo applies to the shop",
      },
    ],
    machinePosts: [{
      firm: "mill",
      type: "engineer",
      generation: 2,
      price: 10,
      qty: 1,
      reason: "the mill posts an engineer machine",
    }],
    machineBids: [{
      firm: "shop",
      seller: "mill",
      qty: 1,
      limit: 10,
      reason: "the shop orders the machine",
    }],
    rentPosts: [{
      owner: "ben",
      house: "h-ben",
      rent: 80,
      reason: "ben posts the year's rent",
    }],
    rentBids: [
      { person: "cleo", house: "h-ben", reason: "cleo tries to keep the house" },
      { person: "ada", house: "h-ben", reason: "ada tries to rent ben's house" },
    ],
  };
}

function paths(ctx: HarnessCtx) {
  return { world: ctx.worldPath, journal: ctx.journalPath };
}

function keepRng(ctx: HarnessCtx, planned: World): void {
  const current = loadWorld(ctx.worldPath);
  if (
    current.rng.seed === planned.rng.seed && current.rng.stream === planned.rng.stream
  ) return;
  saveWorld(ctx.worldPath, { ...current, rng: planned.rng });
}

function expect(act: Act, refusal: boolean, who: string): void {
  if (refusal) {
    if (act.tag !== "refused") throw new Error(`${who} was accepted`);
    return;
  }
  if (act.tag === "refused") throw new Error(`${who}: ${act.reason}`);
}

function boundJob(world: World, firm: Id | undefined, career: Career | undefined): Id {
  if (!firm || !career) return "";
  const found = world.listings.filter((listing) => {
    if (listing.kind !== "job" || listing.seller !== firm || listing.qty <= 0) {
      return false;
    }
    const payload = listing.payload;
    return !!payload && "career" in payload && payload.career === career;
  });
  if (found.length !== 1) {
    throw new Error(`${firm} ${career} matches ${found.length} job listings`);
  }
  return found[0].id;
}

function boundMachine(world: World, seller: Id | undefined, listing: Id | undefined): Id {
  if (listing) return listing;
  if (!seller) return "";
  const found = world.listings.filter((row) =>
    row.kind === "machine" && row.seller === seller && row.qty > 0
  );
  if (found.length !== 1) {
    throw new Error(`${seller} matches ${found.length} machine listings`);
  }
  return found[0].id;
}

/** A month that is not a multiple of 12 returns before any write. On a special
 *  month the dividend pays when equity and the shares outstanding are both
 *  positive, and anyone still without a dwelling is pinned, even when no
 *  orders were handed in. monthSeed takes the quiet path: negative equity, and
 *  both people housed. Share trades are not run on any other month. */
export async function runSpecialDay(
  ctx: HarnessCtx,
  orders: SpecialOrders,
): Promise<void> {
  const opened = loadWorld(ctx.worldPath);
  if (!isSpecialMonth(opened.month)) return;

  for (const sell of orders.shareSells ?? []) {
    const act = await householdLeaf(ctx, sell.seller).run(
      {
        tag: "sellShare",
        bank: sell.bank,
        qty: sell.qty,
        price: sell.price,
        reason: sell.reason,
      },
      0,
    );
    expect(act, false, `${sell.seller} sell share`);
  }
  const shareBids = orders.shareBids ?? [];
  const sharePlan = clearShares(loadWorld(ctx.worldPath), shareBids);
  keepRng(ctx, sharePlan.world);
  for (let i = 0; i < shareBids.length; i++) {
    const bid = shareBids[i];
    const row = sharePlan.byBuyer[i];
    const act = await householdLeaf(ctx, bid.buyer).run(
      {
        tag: "buyShare",
        bank: bid.bank,
        qty: bid.qty,
        limit: bid.limit,
        reason: bid.reason,
        lots: row?.lots ?? [],
      },
      0,
    );
    expect(act, false, `${bid.buyer} buy share`);
  }

  for (const bank of ["a", "b"] as const) {
    const gate = dividendGate(loadWorld(ctx.worldPath), bank);
    if (!gate.ok) continue;
    commitEngine(paths(ctx), gate.effect, ctx.ids, ctx.clock);
  }

  for (const offer of orders.houseOffers ?? []) {
    const act = await householdLeaf(ctx, offer.owner).run(
      { tag: "offerHouse", house: offer.house, ask: offer.ask, reason: offer.reason },
      0,
    );
    expect(act, false, `${offer.owner} offer house`);
  }
  const houseBids = orders.houseBids ?? [];
  const housePlan = clearHouses(loadWorld(ctx.worldPath), houseBids);
  keepRng(ctx, housePlan.world);
  for (let i = 0; i < houseBids.length; i++) {
    const bid = houseBids[i];
    const row = housePlan.byBuyer[i];
    const act = await householdLeaf(ctx, bid.buyer).run(
      {
        tag: "buyHouse",
        house: bid.house,
        listing: row?.listing ?? "",
        won: row?.won ?? false,
        reason: bid.reason,
      },
      0,
    );
    const broke = act.tag === "refused";
    if (row?.won && broke) {
      throw new Error(
        `${bid.buyer} won ${bid.house} and was refused: ${
          act.tag === "refused" ? act.reason : ""
        }`,
      );
    }
    if (!row?.won && !broke && act.tag === "done") {
      throw new Error(`${bid.buyer} was sold ${bid.house} without winning the draw`);
    }
  }

  for (const wish of orders.occupies ?? []) {
    const act = await householdLeaf(ctx, wish.owner).run(
      { tag: "occupyOrLet", house: wish.house, mode: wish.mode, reason: wish.reason },
      0,
    );
    const owns = loadWorld(ctx.worldPath).houses[wish.house]?.owner === wish.owner;
    expect(act, !owns, `${wish.owner} occupy ${wish.house}`);
  }

  for (const post of orders.jobPosts ?? []) {
    const act = await firmLeaf(ctx, post.firm).run({ tag: "postJob", ...post }, 0);
    expect(act, false, `${post.firm} post job`);
  }
  for (const post of orders.machinePosts ?? []) {
    const act = await firmLeaf(ctx, post.firm).run({ tag: "postMachine", ...post }, 0);
    expect(act, false, `${post.firm} post machine`);
  }

  const posted = loadWorld(ctx.worldPath);
  const archive = postedJobs(posted);
  const jobOrders = orders.jobWishes ?? [];
  const jobWishes: JobWish[] = jobOrders.map((wish) => {
    if (wish.kind === "keep") return { person: wish.person, kind: "keep" };
    const listing = wish.listing
      ? wish.listing
      : boundJob(posted, wish.firm, wish.career);
    return { person: wish.person, kind: "apply", listing };
  });
  const jobPlan = seatJobs(posted, jobWishes);
  keepRng(ctx, jobPlan.world);
  for (let i = 0; i < jobWishes.length; i++) {
    const wish = jobWishes[i];
    const row = jobPlan.rows.find((r) => {
      if (r.person !== wish.person) return false;
      if (wish.kind === "keep") return true;
      return r.listing === wish.listing && r.outcome !== "unposted";
    });
    const outcome = row?.outcome ?? "unposted";
    const listing = row?.listing || (wish.kind === "apply" ? wish.listing : "");
    const refusal = outcome === "ineligible" || outcome === "unposted";
    const act = await householdLeaf(ctx, wish.person).run(
      {
        tag: wish.kind === "keep" ? "keepJob" : "applyJob",
        listing,
        seated: outcome === "seated" || refusal,
        reason: jobOrders[i].reason,
      },
      0,
    );
    expect(
      act,
      outcome === "ineligible" || outcome === "unposted",
      `${wish.person} ${wish.kind}`,
    );
  }
  if (archive.length > 0) {
    commitEngine(
      paths(ctx),
      { tag: "archiveJobs", listings: archive },
      ctx.ids,
      ctx.clock,
    );
  }

  const machineBids: MachineBid[] = (orders.machineBids ?? []).map((bid) => ({
    firm: bid.firm,
    listing: boundMachine(loadWorld(ctx.worldPath), bid.seller, bid.listing),
    qty: bid.qty,
    limit: bid.limit,
  }));
  const machinePlan = clearMachines(loadWorld(ctx.worldPath), machineBids);
  keepRng(ctx, machinePlan.world);
  for (let i = 0; i < machineBids.length; i++) {
    const bid = machineBids[i];
    const row = machinePlan.byFirm.find((p) =>
      p.firm === bid.firm && p.lots.some((l) =>
        l.listing === bid.listing
      )
    ) ??
      machinePlan.byFirm.find((p) => p.firm === bid.firm);
    const filled = row?.lots.find((l) => l.listing === bid.listing)?.qty ?? 0;
    const act = await firmLeaf(ctx, bid.firm).run(
      {
        tag: "orderMachine",
        firm: bid.firm,
        listing: bid.listing,
        qty: filled,
        asked: bid.qty,
        reason: orders.machineBids?.[i].reason ?? "",
      },
      0,
    );
    expect(act, false, `${bid.firm} order machine`);
  }

  for (const post of orders.rentPosts ?? []) {
    const act = await householdLeaf(ctx, post.owner).run(
      { tag: "postRent", house: post.house, rent: post.rent, reason: post.reason },
      0,
    );
    expect(act, false, `${post.owner} post rent`);
  }
  const rentBids = orders.rentBids ?? [];
  const rentPlan = seatRents(loadWorld(ctx.worldPath), rentBids);
  keepRng(ctx, rentPlan.world);
  for (let i = 0; i < rentBids.length; i++) {
    const bid = rentBids[i];
    const row = rentPlan.rows[i];
    const outcome = row?.outcome ?? "short";
    const act = await householdLeaf(ctx, bid.person).run(
      {
        tag: "applyRent",
        house: bid.house,
        listing: row?.listing ?? "",
        pay: outcome === "seated",
        reason: bid.reason,
      },
      0,
    );
    expect(act, outcome === "short", `${bid.person} rent ${bid.house}`);
  }
  // A listed house is kept only by winning the seat. A sitting tenant who
  // cannot pay the year, and a house nobody takes, is vacated by the engine.
  // The refusal is already in the intent log and writes no journal line.
  const afterRent = loadWorld(ctx.worldPath);
  for (const listing of afterRent.listings) {
    if (listing.kind !== "rent" || listing.qty <= 0) continue;
    const houseId = houseOf(listing.payload);
    if (!houseId) continue;
    const taken = rentPlan.rows.some((row) =>
      row.listing === listing.id && row.outcome === "seated"
    );
    if (taken) continue;
    if (!afterRent.houses[houseId]?.occupant) continue;
    commitEngine(paths(ctx), { tag: "vacate", house: houseId }, ctx.ids, ctx.clock);
  }

  const undwelled = Object.values(loadWorld(ctx.worldPath).people)
    .filter((person) => person.alive && person.dwelling === null)
    .map((person) => person.id)
    .sort();
  for (const person of undwelled) {
    const gate = pinHealthGate(loadWorld(ctx.worldPath), person);
    if (!gate.ok) throw new Error(gate.reason);
    commitEngine(paths(ctx), gate.effect, ctx.ids, ctx.clock);
  }
}
