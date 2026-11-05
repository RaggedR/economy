// staple.ts — post is already on the book. Clear once, then each household
// commits the lots it was handed. Starvation runs after those commits, and
// only for the people who bid. A later loan's draw has not happened yet when
// the month calls this: food is not bought with cash the firm still holds.

import { commitEngine } from "../cli/econ.ts";
import { fileJournal } from "../log/journal.ts";
import { deathGate } from "../world/gates.ts";
import {
  type BuyerPlan,
  clearStaple,
  markStarvation,
  type StapleOrder,
  starvationDeaths,
} from "../world/market.ts";
import { loadWorld, saveWorld } from "../world/store.ts";
import { goodOf } from "../world/types.ts";
import type { Act, BuyShape } from "./containers.ts";
import type { HarnessCtx } from "./harness.ts";
import { householdLeaf } from "./household.ts";

export type StapleBid = StapleOrder & { reason: string };

function buyShape(bid: StapleBid, plan: BuyerPlan): BuyShape {
  const lots = plan.lots.length > 0 ? plan.lots : [{ listing: "", qty: 0 }];
  return {
    tag: "buy",
    good: "staple",
    qty: bid.qty,
    seller: bid.seller,
    reason: bid.reason,
    lots,
  };
}

/** No staple listing, or nobody asked: the world is not touched. monthSeed
 *  takes this path. */
export async function runStaple(
  ctx: HarnessCtx,
  bids: readonly StapleBid[],
): Promise<Act[]> {
  const seen = new Set<string>();
  for (const bid of bids) {
    if (seen.has(bid.buyer)) throw new Error(`duplicate staple bid from ${bid.buyer}`);
    seen.add(bid.buyer);
  }
  const world = loadWorld(ctx.worldPath);
  const posted = world.listings.some((l) =>
    l.kind === "good" && goodOf(l.payload) === "staple" && l.qty > 0
  );
  if (!posted || bids.length === 0) return [];

  const plan = clearStaple(world, bids);
  // The lottery lives in the world. Persist it before the leaves write, so a
  // fill's save does not put the pre-draw stream back.
  saveWorld(ctx.worldPath, { ...loadWorld(ctx.worldPath), rng: plan.world.rng });

  const acts: Act[] = [];
  for (const bid of bids) {
    const row = plan.byBuyer.find((p) => p.buyer === bid.buyer);
    if (!row) throw new Error(`no plan for ${bid.buyer}`);
    const leaf = householdLeaf(ctx, bid.buyer);
    const act = await leaf.run(buyShape(bid, row), 0);
    if (act.tag === "refused") throw new Error(act.reason);
    const journal = fileJournal(ctx.journalPath);
    if (!journal.trace(act.correlationId)) {
      throw new Error(`fill ${act.correlationId} has no journal line`);
    }
    acts.push(act);
  }

  const rows = plan.byBuyer.map((p) => ({ person: p.buyer, filled: p.filled }));
  const marked = markStarvation(loadWorld(ctx.worldPath), rows);
  saveWorld(ctx.worldPath, marked);
  for (const person of starvationDeaths(loadWorld(ctx.worldPath), rows)) {
    const gate = deathGate(loadWorld(ctx.worldPath), person);
    if (!gate.ok) throw new Error(gate.reason);
    commitEngine(
      { world: ctx.worldPath, journal: ctx.journalPath },
      gate.effect,
      ctx.ids,
      ctx.clock,
    );
  }
  return acts;
}
