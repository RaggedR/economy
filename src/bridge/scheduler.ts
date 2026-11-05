// scheduler.ts — one month, as a function.
//
// This is not seqC. Phase order is fixed by Part I of the interface, and the
// scheduler already knows the phase and the role before it asks. seqC would be
// the wrong tool: seqC(phase, sumC(food, welfare)) is written as "ask, then
// decide", but a container is a union of fibres and the TypeScript conditional
// distributes ◁ over +, so the library computes "decide, then ask".
// seqBranchC in ~/git/gold/stalin/branch.ts is the repair, and
// ~/git/gold/stalin/gosplan.server.ts uses it only where a reply must choose
// the next fibre. It is deliberately not in lib/. Nothing in this prefix
// routes on a reply, so the repair is not needed either. The month is
// ordinary code.
//
// The legal loan is committed inside the household leaf. Step 3 does not
// apply it again. A refused Act has no journal line, and it is not applied.

import { tensorC } from "../lib/algebra.ts";
import { commitEngine } from "../cli/econ.ts";
import { fileJournal } from "../log/journal.ts";
import type { ReconcileReport } from "../log/reconcile.ts";
import type { BooksReport } from "../world/books.ts";
import { payGate } from "../world/gates.ts";
import { planOpening } from "../world/fold.ts";
import { remainderDraws } from "../world/purses.ts";
import { runDiscretionary, runDisease, runPublic } from "./health.ts";
import { runSpecialDay } from "./special.ts";
import { runStaple } from "./staple.ts";
import { loadWorld, saveWorld } from "../world/store.ts";
import { assertFlowIdentity, assertInvariant, openingNfa } from "../world/world.ts";
import { auditorLeaf } from "./auditor.ts";
import type { Act } from "./containers.ts";
import type { HarnessCtx } from "./harness.ts";
import { householdLeaf } from "./household.ts";

const WAGE = 200;

export type MonthResult = {
  wage: string;
  households: { left: Act; right: Act };
  books: BooksReport;
  recon: ReconcileReport;
};

function commitOpening(ctx: HarnessCtx): void {
  const plan = planOpening(loadWorld(ctx.worldPath));
  for (const effect of plan.effects) {
    commitEngine(
      { world: ctx.worldPath, journal: ctx.journalPath },
      effect,
      ctx.ids,
      ctx.clock,
    );
  }
  saveWorld(ctx.worldPath, plan.mark(loadWorld(ctx.worldPath)));
}

export async function runMonth(ctx: HarnessCtx): Promise<MonthResult> {
  const opening = openingNfa(loadWorld(ctx.worldPath));

  // Opening obligations come out of the firm purse, before any leaf borrows.
  // A firm that cannot meet them folds here. A later loan does not reach back.
  // monthSeed has no firm, so this writes nothing.
  commitOpening(ctx);

  // 1. Engine: one contractual wage. Journal source "engine". No intent record.
  const funded = payGate(loadWorld(ctx.worldPath), "gov", "ada", WAGE, "wages");
  if (!funded.ok) throw new Error(funded.reason);
  const posted = commitEngine(
    { world: ctx.worldPath, journal: ctx.journalPath },
    funded.effect,
    ctx.ids,
    ctx.clock,
  );

  // Disease, with the opening. monthSeed's two draws miss, so the journal
  // stays pay then lendBank. The stream still advances.
  runDisease(ctx);
  // The mix and the bids are handed in. The month prefix hands nothing.
  await runPublic(ctx, {});

  // 2. Both households owe a reply. The shapes are fixed before either runs.
  //    Ada's loan is inside the LTV. Ben's is not. The gate refuses Ben.
  const ada = householdLeaf(ctx, "ada");
  const ben = householdLeaf(ctx, "ben");
  const both = tensorC(ada, ben);
  const households = await both.run(
    both.both(
      {
        tag: "requestLoan",
        bank: "a",
        borrower: "ada",
        amount: 500,
        collateral: "h-ada",
        installment: 50,
        months: 10,
        reason: "ada borrows against her house",
      },
      {
        tag: "requestLoan",
        bank: "a",
        borrower: "ben",
        amount: 600,
        collateral: "h-ben",
        installment: 60,
        months: 10,
        reason: "ben asks for more than the house will secure",
      },
    ),
    0,
  );

  // 3. Do not re-apply. The leaf's commit is the writeback. A refusal is not
  //    an effect, so there is nothing to apply.
  const journal = fileJournal(ctx.journalPath);
  for (const act of [households.left, households.right]) {
    if (act.tag === "done" && !journal.trace(act.correlationId)) {
      throw new Error(`ok act ${act.correlationId} has no journal line`);
    }
  }
  const loans = Object.values(loadWorld(ctx.worldPath).loans);
  const adaLoans = loans.filter((l) => l.kind === "bank" && l.borrower === "ada");
  const benLoans = loans.filter((l) => l.kind === "bank" && l.borrower === "ben");
  if (adaLoans.length !== 1) throw new Error(`ada's loan was not committed once`);
  if (benLoans.length !== 0) throw new Error("a refused loan was applied");

  // Staple, after loans and before draws. Food is not bought with cash this
  // step has not yet swept out of the firm. No listing, or no bid: nothing
  // is asked, and monthSeed's journal stays pay then lendBank.
  await runStaple(ctx, []);

  // The special day, after staple and before discretionary buys. monthSeed is
  // month 0, so the day is open, and it writes nothing: no listings, no bids,
  // and the bank's equity is negative so the dividend does not pay. Share
  // trades are not repeated later in the month. Mine trades and debt are not
  // this call.
  await runSpecialDay(ctx, {});

  // Private cures and tuition. After staple and after the special day's rent.
  // The month prefix hands nothing, so this writes nothing.
  await runDiscretionary(ctx, {});

  // After the capital step. Remainder of a solvent firm goes to its owner.
  // A folded firm is skipped.
  for (const effect of remainderDraws(loadWorld(ctx.worldPath))) {
    commitEngine(
      { world: ctx.worldPath, journal: ctx.journalPath },
      effect,
      ctx.ids,
      ctx.clock,
    );
  }

  // 4. Auditor: invariant and reconcile. Two asks, not a tensor.
  const auditor = auditorLeaf(ctx);
  const books = await auditor.run({ tag: "invariant" }, 0);
  const recon = await auditor.run({ tag: "reconcile" }, 0);

  const world = loadWorld(ctx.worldPath);
  assertInvariant(world);
  assertFlowIdentity(world, opening);
  return {
    wage: posted.correlationId,
    households,
    books: books.value,
    recon: recon.value,
  };
}
