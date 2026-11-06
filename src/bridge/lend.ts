// lend.ts — the bridge driver for lending day: the step that mobilises idle
// private wealth. Before invest day runs, it finds the firms that have made the
// demand-and-margin case to add a machine but sit below the cash a machine
// needs (`investShortfalls`), finds the wealthy savers who are not themselves
// running a shop, and turns a `decideLending` plan into ordinary `acceptDebt`
// commits: each lender holds a private loan issued by a firm, and the principal
// moves lender → firm.
//
// The money is real and the gates are the ordinary ones: `acceptDebtGate`
// refuses a lender below the savings threshold or short of the principal, and
// the plan only offers an installment the firm's disclosed revenue covers
// `revenueCover` times. Run just before invest day, a funded firm clears the
// affordability floor and buys its machine the same month — so a saver's stock
// becomes a producer's working capital, and the wages that machine then pays
// are the demand *flow* no knob could inject.

import { loadWorld } from "../world/store.ts";
import { params } from "../world/params.ts";
import { decideLending, type Lender } from "../world/lend.ts";
import { type InvestTracker, investShortfalls, producerOf } from "./invest.ts";
import { householdLeaf } from "./household.ts";
import type { HarnessCtx } from "./harness.ts";
import type { Id, Money, World } from "../world/types.ts";

const personCash = (w: World, id: Id): Money =>
  (w.people[id]?.deposits.a ?? 0) + (w.people[id]?.deposits.b ?? 0);

/** The people who own a producing firm — excluded from lending, so credit is a
 *  genuine transfer from a rentier/saver to an entrepreneur, not an owner
 *  topping up their own shop (which the draw would only sweep back out). */
function producingOwners(w: World): Set<Id> {
  const owners = new Set<Id>();
  for (const firm of Object.values(w.firms)) {
    if (!firm.folded && producerOf(firm.kind) && w.people[firm.owner]) {
      owners.add(firm.owner);
    }
  }
  return owners;
}

/** Living savers above the threshold who run no shop, richest-relevant first is
 *  left to the pure rule. Cash is personal deposits, not any firm's book. */
function lenders(w: World): Lender[] {
  const shopkeepers = producingOwners(w);
  const out: Lender[] = [];
  for (const id of Object.keys(w.people).sort()) {
    const person = w.people[id];
    if (!person.alive || shopkeepers.has(id)) continue;
    const cash = personCash(w, id);
    if (cash < params.savingsThreshold) continue;
    out.push({ id, cash });
  }
  return out;
}

/** Lending day. A no-op when no firm is short of capital or no saver qualifies.
 *  Returns a short tally. Async: it commits through the household leaf, exactly
 *  as the milestone story's `acceptDebt` does. */
export async function runLending(
  ctx: HarnessCtx,
  tracker: InvestTracker,
): Promise<{ lent: number; principal: Money }> {
  const w0 = loadWorld(ctx.worldPath);
  const borrowers = investShortfalls(w0, tracker);
  if (borrowers.length === 0) return { lent: 0, principal: 0 };

  const plan = decideLending({
    borrowers,
    lenders: lenders(w0),
    savingsThreshold: params.savingsThreshold,
    revenueCover: params.revenueCover,
    term: params.lendTermMonths,
  });

  let lent = 0, principal = 0;
  for (const loan of plan.loans) {
    const act = await householdLeaf(ctx, loan.lender).run(
      {
        tag: "acceptDebt",
        issuer: loan.firm,
        principal: loan.principal,
        installment: loan.installment,
        months: loan.months,
        issuerKind: "firm",
        reason:
          `${loan.lender} lends ${loan.principal} to ${loan.firm} for working capital`,
      },
      0,
    );
    if (act.tag === "done") {
      lent += 1;
      principal += loan.principal;
    }
    // A refusal means the world shifted under the plan (it should not, lending
    // runs first); leave that firm unfunded rather than force it.
  }
  return { lent, principal };
}
