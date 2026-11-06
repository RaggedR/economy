// lend.ts — the wealthy lender's decision, as a pure plan.
//
// The metropolis is demand-deficient not because the wealthy are absent but
// because their wealth is inert: a saver's large *stock* only leaks into demand
// at a thin monthly fraction, and the three ways real wealth re-enters an
// economy — property, credit, equity — are switched off in the town the
// engine runs. This rule turns one of them on: private credit.
//
// The invest rule already finds a firm that keeps selling out and *wants* a
// machine, but excludes it when its cash is below the buffer the machine plus
// first payroll needs (`invest.ts`, the `cash >= floor` filter). Today such a
// firm simply never invests, while idle savings sit beside it untouchable. This
// rule matches that firm with a wealthy lender: the lender holds a private loan
// issued by the firm (the `issuePrivate` effect moves the principal
// lender → firm), the firm clears the floor, and invest day — run straight
// after — funds the machine and hires the crew. Idle stock becomes a producing
// firm's working capital, and the wages it then pays are the demand *flow* the
// town could not manufacture from a knob.
//
// Two pieces of judgment, mirroring invest's labour/margin guards:
//
//   • SOLVENCY of the lender — only a saver above the savings threshold lends,
//     and only what they can actually fund (the acceptDebt gate's own tests).
//   • SERVICEABILITY of the borrower — a firm may only take an installment its
//     disclosed revenue covers `revenueCover` times (the lenderAccepts test).
//     A loan is sized and termed so the firm can service it; if it cannot
//     service even a one-month term within the cap, it is not lent to.
//
// It decides nothing about money moving or ids — the bridge takes this plan and
// commits it through the ordinary acceptDebt gate. Pure, so the guards are
// tested in isolation.

import type { Id, Money } from "./types.ts";

/** One firm that would invest if it held more cash: it has cleared invest's
 *  demand and margin case, but its cash is below the buffer a machine wants. */
export type Borrower = {
  id: Id;
  /** The buffer still to raise: invest's floor minus cash on hand (≥ 1). */
  want: Money;
  /** This firm's disclosed sale revenue — the serviceability ceiling. */
  revenue: Money;
};

/** One wealthy saver who could lend. */
export type Lender = {
  id: Id;
  /** Deposits on hand across the saver's banks. */
  cash: Money;
};

export type LendInputs = {
  borrowers: readonly Borrower[];
  lenders: readonly Lender[];
  /** A lender must hold at least this much to lend at all (acceptDebt gate). */
  savingsThreshold: Money;
  /** A borrower's revenue must cover its installment this many times. */
  revenueCover: number;
  /** The longest term a loan is written over. Caps the principal a thin
   *  revenue can carry: a firm that can service `m` per month borrows at most
   *  `m × term`, however large its want. */
  term: number;
};

export type Loan = {
  lender: Id;
  firm: Id;
  principal: Money;
  installment: Money;
  months: number;
};

export type LendPlan = { loans: Loan[] };

/** The largest installment a firm's revenue can service: `floor(revenue /
 *  revenueCover)`. Zero when revenue cannot cover even a unit installment. */
export function maxInstallment(revenue: Money, revenueCover: number): Money {
  if (revenueCover <= 0) return 0;
  return Math.floor(revenue / revenueCover);
}

/** Who lends to whom this cycle. Hungriest borrowers first (largest want, then
 *  id); each is funded by the best-capitalised lender who can cover the whole
 *  principal and clears the savings threshold. A lender funds one firm per
 *  cycle; a firm takes one loan. A firm whose revenue cannot service any
 *  installment, and a want no remaining lender can fund, are passed over. */
export function decideLending(inp: LendInputs): LendPlan {
  const loans: Loan[] = [];
  const used = new Set<Id>();

  const borrowers = inp.borrowers
    .slice()
    .sort((a, b) =>
      b.want - a.want || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
    );

  for (const b of borrowers) {
    if (b.want < 1) continue;
    const perMonth = maxInstallment(b.revenue, inp.revenueCover);
    if (perMonth < 1) continue; // cannot service even a unit installment
    // Size the loan to what the firm can carry over the term, never above its
    // want. Installment is the serviceable monthly figure; the term is the
    // shortest that clears the principal, capped at `term`.
    const principal = Math.min(b.want, perMonth * inp.term);
    if (principal < 1) continue;
    const installment = Math.min(perMonth, principal);
    const months = Math.ceil(principal / installment);

    // The best-capitalised free lender who can fund the whole principal and is
    // above the savings threshold.
    let pick: Lender | null = null;
    for (const l of inp.lenders) {
      if (used.has(l.id)) continue;
      if (l.cash < inp.savingsThreshold) continue;
      if (l.cash < principal) continue;
      if (
        !pick || l.cash > pick.cash ||
        (l.cash === pick.cash && l.id < pick.id)
      ) {
        pick = l;
      }
    }
    if (!pick) continue;

    used.add(pick.id);
    loans.push({ lender: pick.id, firm: b.id, principal, installment, months });
  }

  return { loans };
}
