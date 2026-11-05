// tech.ts — the tech summand. The mode is handed in. The leaf does not choose
// it. That choice is milestone 13. The plan posts. It does not mint a
// generation. Delivery does, and that command is the shop's order.
// An empty order returns before any write.

import type { Fib } from "../lib/algebra.ts";
import { type Decoders, leafLocal, type Runner } from "../lib/algebra.ts";
import { type Act, decodeAct } from "./containers.ts";
import type { HarnessCtx } from "./harness.ts";
import { type MutationOutcome, type Registry, runMutation } from "./harness.ts";
import { firmLeaf } from "./special.ts";
import { loadWorld } from "../world/store.ts";
import type { Id, Listing } from "../world/types.ts";
import { type StrategyMode } from "../world/tech.ts";

type TechC = Fib<
  { tag: "strategy"; firm: Id; mode: StrategyMode; reason: string },
  Act
>;

function asAct(o: MutationOutcome): Act {
  if (!o.ok) return { tag: "refused", reason: o.reason };
  return { tag: "done", correlationId: o.correlationId };
}

/** strategy is on the registry only when the firm is tech. Absence is the
 *  position a shop gets. It is not a gate refusal. */
export function techLeaf(ctx: HarnessCtx, firm: Id): Runner<TechC> {
  const kind = loadWorld(ctx.worldPath).firms[firm]?.kind;
  const allowed = new Set<string>();
  if (kind === "tech") allowed.add("strategy");
  const agentId = `firm:${firm}`;
  const reg: Registry = {
    agentId,
    allowed,
    argScope: (_tool, args) => {
      if (args.firm === firm) return null;
      return `${agentId} cannot act for ${String(args.firm)}`;
    },
  };
  const decoders: Decoders<TechC> = { strategy: decodeAct };
  return leafLocal(agentId, (shape) => {
    return asAct(runMutation(
      ctx,
      reg,
      "strategy",
      ["strategy", "--firm", firm, "--mode", shape.mode],
      { firm },
      shape.reason,
    ));
  }, decoders);
}

export type TechOrder = {
  firm?: Id;
  mode?: StrategyMode;
  reason?: string;
};

/** No firm, or no mode: the world is not touched. */
export async function runTech(ctx: HarnessCtx, order: TechOrder): Promise<Act | null> {
  if (!order.firm || !order.mode) return null;
  const act = await techLeaf(ctx, order.firm).run(
    {
      tag: "strategy",
      firm: order.firm,
      mode: order.mode,
      reason: order.reason ?? "",
    },
    0,
  );
  if (act.tag === "refused") throw new Error(act.reason);
  return act;
}

export function techSceneOrder(): TechOrder {
  return {
    firm: "mill",
    mode: "upgrade",
    reason: "mill offers the next generation",
  };
}

function openOffer(listings: readonly Listing[]): Listing | undefined {
  return listings.find((listing) => {
    if (listing.kind !== "machine" || listing.qty <= 0) return false;
    const payload = listing.payload;
    return !!payload && "generation" in payload && payload.generation >= 1;
  });
}

/** Upgrade, then the shop takes delivery. The plan's world has no generation 1. */
export async function runTechScene(ctx: HarnessCtx): Promise<void> {
  const before = loadWorld(ctx.worldPath);
  if (Object.values(before.machines).some((machine) => machine.generation >= 1)) {
    throw new Error("generation 1 is already in the world");
  }
  const posted = await runTech(ctx, techSceneOrder());
  if (!posted || posted.tag !== "done") throw new Error("upgrade did not post");
  const offered = loadWorld(ctx.worldPath);
  if (Object.values(offered.machines).some((machine) => machine.generation >= 1)) {
    throw new Error("the plan minted a generation");
  }
  const listing = openOffer(offered.listings);
  if (!listing) throw new Error("upgrade posted no machine");
  const bought = await firmLeaf(ctx, "shop").run(
    {
      tag: "orderMachine",
      firm: "shop",
      listing: listing.id,
      qty: 1,
      asked: 1,
      reason: "shop takes delivery of generation 1",
    },
    0,
  );
  if (bought.tag !== "done") {
    throw new Error(bought.tag === "refused" ? bought.reason : "delivery was rationed");
  }
}
