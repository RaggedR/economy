// equity.ts — the bridge driver for equity day: the step that makes the bank
// earn, so a dividend can reach the shareholders. Three moves, in order:
//
//   1. DEPOSIT every free mine the propertied class holds → shares. This both
//      makes them shareholders AND lifts the bank's leverage ceiling (it may
//      lend `leverageMultiple ×` the deposited-mine base), which is what makes
//      step 2 possible at all — no deposited mines, no loans.
//   2. MORTGAGE: each entrepreneur who has not already borrowed puts his own
//      house up as collateral and takes the loan `loanAsk` approves. The
//      principal enters his deposit — the frozen housing wealth, mobilised.
//   3. INTEREST: each mortgaged entrepreneur pays the bank `interestDue` of his
//      principal. A payment to a bank is the bank's earnings; equity turns
//      positive, and the dividend (run next, by the ignition loop) carries it to
//      the mine-depositing households.
//
// Everything commits through the ordinary gates, exactly as invest day does.

import { loadWorld } from "../world/store.ts";
import { interestDue, planMineDeposits } from "../world/equity.ts";
import { loanAsk } from "../world/policy.ts";
import { producerOf } from "./invest.ts";
import { depositMineGate, type GateResult, payGate, requestLoanGate } from "../world/gates.ts";
import { commitEngine } from "../cli/econ.ts";
import type { HarnessCtx } from "./harness.ts";
import type { BankId, Id, Money, World } from "../world/types.ts";

const BANK: BankId = "a"; // every metropolis deposit sits in bank a

function commit(ctx: HarnessCtx, gate: GateResult): void {
  if (!gate.ok) throw new Error(gate.reason);
  commitEngine(
    { world: ctx.worldPath, journal: ctx.journalPath },
    gate.effect,
    ctx.ids,
    ctx.clock,
  );
}

/** Owner-operators of live producing firms — the entrepreneurs who borrow
 *  against their own houses. People, deterministic by id. */
function entrepreneurs(w: World): Id[] {
  const ids = new Set<Id>();
  for (const f of Object.values(w.firms)) {
    if (!f.folded && producerOf(f.kind) && w.people[f.owner]) ids.add(f.owner);
  }
  return [...ids].sort();
}

/** The bank-loan principal a borrower already owes at the bank. */
function bankLoanPrincipal(w: World, borrower: Id): Money {
  let s = 0;
  for (const loan of Object.values(w.loans)) {
    if (loan.kind === "bank" && loan.borrower === borrower) s += loan.principal;
  }
  return s;
}

/** Equity day. A no-op when no mine is free and no entrepreneur can borrow.
 *  Returns a short tally. */
export function runEquityDay(
  ctx: HarnessCtx,
): { deposited: number; borrowed: number; interest: Money } {
  let deposited = 0, borrowed = 0, interest = 0;

  // 1. deposit every free mine → shares (and raise the leverage ceiling)
  for (const d of planMineDeposits(loadWorld(ctx.worldPath))) {
    commit(ctx, depositMineGate(loadWorld(ctx.worldPath), d.mine, BANK, d.shares));
    deposited += 1;
  }

  // 2. each un-mortgaged entrepreneur borrows against his house
  for (const person of entrepreneurs(loadWorld(ctx.worldPath))) {
    if (bankLoanPrincipal(loadWorld(ctx.worldPath), person) > 0) continue;
    const ask = loanAsk(loadWorld(ctx.worldPath), person, BANK);
    if (!ask) continue;
    try {
      commit(ctx, requestLoanGate(
        loadWorld(ctx.worldPath),
        ask.bank, ask.borrower, ask.amount, ask.collateral, ask.installment, ask.months,
      ));
      borrowed += 1;
    } catch { /* ceiling or funds moved; skip this one */ }
  }

  // 3. each mortgaged entrepreneur pays interest → the bank earns
  for (const person of entrepreneurs(loadWorld(ctx.worldPath))) {
    const principal = bankLoanPrincipal(loadWorld(ctx.worldPath), person);
    if (principal <= 0) continue;
    const due = interestDue(principal);
    try {
      commit(ctx, payGate(loadWorld(ctx.worldPath), person, BANK, due, "bankInterest"));
      interest += due;
    } catch { /* cannot afford the interest this month; skip */ }
  }

  return { deposited, borrowed, interest };
}
