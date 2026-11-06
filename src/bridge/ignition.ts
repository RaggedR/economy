// ignition.ts — twelve months of the town, and nothing else.
//
// The month prefix still pays Ada and refuses Ben. This is the other entry.
// The opening pays from cash already in the firm. Then each supermarket bakes
// and posts, then each living person bids for one staple, then the remainder
// draw. No disease, no special day, no discretionary spend. Each firm starts
// with one wage. A supermarket also holds this month's maintenance on its one
// oven. The draw leaves that wage and that maintenance, and gives the owner
// the rest. The shelf is the oven. The post is last month's price, cut when
// bread was left and raised when that listing sold out, then capped by a
// cheaper shop. A bid against an empty book still counts as a zero fill. A
// deposit is liquid, and the distress sale is not built, so savings block death.
//
// With { spend: true } the loop also runs the living town: after the bake, each
// producing firm makes and posts its good (luxury, nightclub); after staple,
// households buy down their objective chains; then consumption becomes wellbeing
// — a nightclub is happiness, luxury food is health — which decays each month,
// so a sustained level needs sustained spending. Still no special day, no tech
// orders, and no hiring; those markets are built but not driven here.

import { commitEngine } from "../cli/econ.ts";
import { commitDeath } from "./kin.ts";
import { commitOpening } from "./scheduler.ts";
import { runStaple, type StapleBid } from "./staple.ts";
import type { HarnessCtx } from "./harness.ts";
import { postGoodGate, postInventoryGate } from "../world/gates.ts";
import { markStarvation, starvationDeaths } from "../world/market.ts";
import { params } from "../world/params.ts";
import { householdSpend, nextStaplePrice } from "../world/policy.ts";
import { runSpend } from "./spend.ts";
import { remainderDraws } from "../world/purses.ts";
import { loadWorld, saveWorld } from "../world/store.ts";
import { bakeStaple, firmOutput, stapleOutput } from "../world/tech.ts";
import { type Good, goodOf, type World } from "../world/types.ts";

export type MonthLine = {
  month: number;
  alive: number;
  fed: number;
  dead: number;
  folded: number;
  stapleLeft: number;
  cashMin: number;
  cashMax: number;
  householdCash: number;
  firmCash: number;
};

function stapleLeft(world: World): number {
  let n = 0;
  for (const firm of Object.values(world.firms)) n += firm.inventory.staple ?? 0;
  return n;
}

function postedStaple(world: World): boolean {
  return world.listings.some((listing) =>
    listing.kind === "good" && goodOf(listing.payload) === "staple" && listing.qty > 0
  );
}

function bids(world: World): StapleBid[] {
  const out: StapleBid[] = [];
  for (const id of Object.keys(world.people).sort()) {
    const person = world.people[id];
    if (!person.alive) continue;
    out.push({ buyer: id, qty: 1, reason: `${id} buys one staple` });
  }
  return out;
}

function lineOf(world: World): MonthLine {
  let alive = 0;
  let fed = 0;
  let dead = 0;
  let cashMin = 0;
  let cashMax = 0;
  let householdCash = 0;
  let seen = false;
  for (const person of Object.values(world.people)) {
    if (!person.alive) {
      dead += 1;
      continue;
    }
    alive += 1;
    if (person.starvation === 0) fed += 1;
    const cash = person.deposits.a + person.deposits.b;
    householdCash += cash;
    if (!seen || cash < cashMin) cashMin = cash;
    if (!seen || cash > cashMax) cashMax = cash;
    seen = true;
  }
  let folded = 0;
  let firmCash = 0;
  for (const firm of Object.values(world.firms)) {
    if (firm.folded) folded += 1;
    firmCash += firm.deposits.a + firm.deposits.b;
  }
  return {
    month: world.month,
    alive,
    fed,
    dead,
    folded,
    stapleLeft: stapleLeft(world),
    cashMin,
    cashMax,
    householdCash,
    firmCash,
  };
}

function commitRemainder(ctx: HarnessCtx): void {
  for (const effect of remainderDraws(loadWorld(ctx.worldPath))) {
    commitEngine(
      { world: ctx.worldPath, journal: ctx.journalPath },
      effect,
      ctx.ids,
      ctx.clock,
    );
  }
}

/** The posted price of a continuously produced good. The param price, the same
 *  one stockShelves opened at. Discretionary price discovery is a later market. */
function priceOf(good: Good): number {
  switch (good) {
    case "luxuryFood":
      return params.luxuryPrice;
    case "nightclub":
      return params.nightclubPrice;
    default:
      return params.stapleReservePrice;
  }
}

/** Produce and post the continuous non-staple goods — luxury food and the
 *  nightclub — the way commitBake does staple. A firm with the machine and the
 *  worker refills its shelf each month, so the discretionary market does not run
 *  dry after the opening stock. Staple stays with commitBake. */
function commitProduce(ctx: HarnessCtx): void {
  const firmIds = Object.keys(loadWorld(ctx.worldPath).firms).sort();
  for (const id of firmIds) {
    const world = loadWorld(ctx.worldPath);
    const out = firmOutput(world, id);
    if (!out || out.good === "staple") continue;
    const firm = world.firms[id];
    const have = firm.inventory[out.good] ?? 0;
    saveWorld(ctx.worldPath, {
      ...world,
      firms: {
        ...world.firms,
        [id]: { ...firm, inventory: { ...firm.inventory, [out.good]: have + out.qty } },
      },
    });
    const posted = loadWorld(ctx.worldPath);
    const gated = postInventoryGate(posted, id, out.good, priceOf(out.good), out.qty);
    if (!gated.ok) throw new Error(gated.reason);
    commitEngine(
      { world: ctx.worldPath, journal: ctx.journalPath },
      gated.effect,
      ctx.ids,
      ctx.clock,
    );
  }
}

/** Consumption becomes wellbeing, then wellbeing decays. A nightclub bought this
 *  month is one happiness; luxury food is one health; both erode by
 *  params.wellbeingDecay toward zero, so a level must be maintained by spending.
 *  Derived from the month's flows, so the market reducers stay untouched. */
function commitWellbeing(ctx: HarnessCtx): void {
  const world = loadWorld(ctx.worldPath);
  const happy: Record<string, number> = {};
  const healthy: Record<string, number> = {};
  for (const flow of world.flows) {
    if (flow.month !== world.month || flow.amount >= 0) continue;
    if (flow.row === "nightclub") {
      happy[flow.holder] = (happy[flow.holder] ?? 0) +
        -flow.amount / params.nightclubPrice;
    } else if (flow.row === "luxuryFood") {
      healthy[flow.holder] = (healthy[flow.holder] ?? 0) +
        -flow.amount / params.luxuryPrice;
    }
  }
  // Decay last month's stock first, then add this month's consumption. So a
  // person who buys one unit a month converges to a steady level of one, not to
  // zero — the steady state is the sustained consumption rate.
  const decay = params.wellbeingDecay;
  const people = { ...world.people };
  for (const id of Object.keys(people)) {
    const person = people[id];
    if (!person.alive) continue;
    people[id] = {
      ...person,
      happiness: Math.max(0, person.happiness - decay) + (happy[id] ?? 0),
      health: Math.max(0, person.health - decay) + (healthy[id] ?? 0),
    };
  }
  saveWorld(ctx.worldPath, { ...world, people });
}

/** Bake, then post exactly that bake. Older listings stay on the book. */
function commitBake(ctx: HarnessCtx): void {
  saveWorld(ctx.worldPath, bakeStaple(loadWorld(ctx.worldPath)));
  const firmIds = Object.keys(loadWorld(ctx.worldPath).firms).sort();
  for (const id of firmIds) {
    const world = loadWorld(ctx.worldPath);
    const n = stapleOutput(world, id);
    if (n <= 0) continue;
    const gated = postGoodGate(world, id, nextStaplePrice(world, id), n);
    if (!gated.ok) throw new Error(gated.reason);
    commitEngine(
      { world: ctx.worldPath, journal: ctx.journalPath },
      gated.effect,
      ctx.ids,
      ctx.clock,
    );
  }
}

/** Options on the opening loop. `spend` runs the objective chain after staple,
 *  the way the full scheduler does, so the non-staple firms get a customer. Off
 *  by default: the milestone ignition is staple-only. */
export type IgnitionOpts = { spend?: boolean };

/** `months` openings. Each one bakes before the bids, then draws. The month
 *  counter advances after the draw, so line 0 is the first opening. With
 *  `spend`, a discretionary pass sits between the staple fills and the draw —
 *  the same seam the scheduler uses: householdSpend names the lots, runSpend
 *  commits them, and the firm's take reaches its owner on the remainder draw. */
export async function runIgnition(
  ctx: HarnessCtx,
  months: number,
  opts: IgnitionOpts = {},
): Promise<MonthLine[]> {
  if (!Number.isInteger(months) || months < 1) {
    throw new Error("months must be a positive integer");
  }
  const lines: MonthLine[] = [];
  for (let i = 0; i < months; i++) {
    commitOpening(ctx);
    commitBake(ctx);
    if (opts.spend) commitProduce(ctx);
    const world = loadWorld(ctx.worldPath);
    const asked = bids(world);
    if (postedStaple(world)) {
      await runStaple(ctx, asked);
    } else {
      const rows = asked.map((bid) => ({ person: bid.buyer, filled: 0 }));
      const marked = markStarvation(world, rows);
      saveWorld(ctx.worldPath, marked);
      for (const person of starvationDeaths(loadWorld(ctx.worldPath), rows)) {
        commitDeath(ctx, person);
      }
    }
    if (opts.spend) {
      await runSpend(ctx, householdSpend(loadWorld(ctx.worldPath)));
      commitWellbeing(ctx);
    }
    commitRemainder(ctx);
    const settled = loadWorld(ctx.worldPath);
    lines.push(lineOf(settled));
    saveWorld(ctx.worldPath, { ...settled, month: settled.month + 1 });
  }
  return lines;
}
