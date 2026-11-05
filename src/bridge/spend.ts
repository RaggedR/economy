// spend.ts — the scripted leaves commit what the policy already decided.
// A decline by the lender is not a shape. An empty spend list does not write.

import { commitEngine } from "../cli/econ.ts";
import { payGate } from "../world/gates.ts";
import { params } from "../world/params.ts";
import {
  DOCTOR_REASON,
  doctorMix,
  householdSpend,
  lenderAccepts,
  type SpendOrder,
  TEACHER_REASON,
  teacherMix,
  trainingBids,
} from "../world/policy.ts";
import { remainderDraws } from "../world/purses.ts";
import { loadWorld } from "../world/store.ts";
import { assertFlowIdentity, assertInvariant, openingNfa } from "../world/world.ts";
import type { Act } from "./containers.ts";
import type { HarnessCtx } from "./harness.ts";
import { runPublic } from "./health.ts";
import { householdLeaf } from "./household.ts";

function paths(ctx: HarnessCtx) {
  return { world: ctx.worldPath, journal: ctx.journalPath };
}

/** Objective buys, in the order the policy named them. No orders: no write. */
export async function runSpend(
  ctx: HarnessCtx,
  orders: readonly SpendOrder[],
): Promise<Act[]> {
  if (orders.length === 0) return [];
  const acts: Act[] = [];
  for (const order of orders) {
    const leaf = householdLeaf(ctx, order.person);
    const act = order.tag === "good"
      ? await leaf.run(
        {
          tag: "buy",
          good: order.good,
          qty: order.qty,
          reason: order.reason,
          lots: [{ listing: order.listing, qty: order.qty }],
        },
        0,
      )
      : order.tag === "tuition"
      ? await leaf.run(
        {
          tag: "buyTuition",
          career: order.career,
          provider: order.provider,
          listing: order.listing,
          qty: order.qty,
          reason: order.reason,
        },
        0,
      )
      : await leaf.run(
        {
          tag: "buyCure",
          disease: order.disease,
          provider: order.provider,
          listing: order.listing,
          qty: order.qty,
          reason: order.reason,
        },
        0,
      );
    if (act.tag === "refused") throw new Error(`${order.person}: ${act.reason}`);
    acts.push(act);
  }
  return acts;
}

/** The four policies on `leafSeed`. The month prefix does not call this. */
export async function runLeaves(ctx: HarnessCtx): Promise<void> {
  const opening = openingNfa(loadWorld(ctx.worldPath));
  const observed = loadWorld(ctx.worldPath);
  await runPublic(ctx, {
    doctors: doctorMix(observed),
    teachers: teacherMix(observed),
    education: trainingBids(observed),
    doctorReason: DOCTOR_REASON,
    teacherReason: TEACHER_REASON,
  });
  await runSpend(ctx, householdSpend(loadWorld(ctx.worldPath)));

  const maintained = payGate(loadWorld(ctx.worldPath), "shop", "mill", 30, "maintenance");
  if (!maintained.ok) throw new Error(maintained.reason);
  commitEngine(paths(ctx), maintained.effect, ctx.ids, ctx.clock);
  for (const effect of remainderDraws(loadWorld(ctx.worldPath))) {
    commitEngine(paths(ctx), effect, ctx.ids, ctx.clock);
  }

  const booked = loadWorld(ctx.worldPath);
  const installment = 10;
  if (lenderAccepts(booked, "shop", installment)) {
    throw new Error("the shop was asked with no revenue");
  }
  if (!lenderAccepts(booked, booked.government.id, installment)) {
    throw new Error("the government was silent");
  }
  const accepted = await householdLeaf(ctx, "cleo").run(
    {
      tag: "acceptDebt",
      issuer: booked.government.id,
      principal: installment,
      installment,
      months: 1,
      issuerKind: "government",
      reason: `tax revenue covers the installment ${params.revenueCover} times`,
    },
    0,
  );
  if (accepted.tag !== "done") throw new Error("cleo did not accept");

  const world = loadWorld(ctx.worldPath);
  assertInvariant(world);
  assertFlowIdentity(world, opening);
}
