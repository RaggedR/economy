// equity.ts — the equity/dividend channel, as pure plans.
//
// The last untested way the wealthy's idle stock can become a household income
// FLOW: the bank earns, and distributes the earnings to shareholders. Two pure
// decisions feed the bridge driver:
//
//   • MINE DEPOSITS — a rentier who holds a mine deposits it at the bank and is
//     minted shares in return (the mine becomes a bank asset; `depositMine`).
//     This makes the rentier a shareholder — the claim on future dividends.
//     Shares are a free count; only their RATIO sets each holder's dividend cut,
//     so one share per unit of the mine's stock keeps bigger mines worth more.
//
//   • INTEREST — the bank's equity only turns positive when a borrower pays it
//     interest (the engine accrues none on its own; interest is a `pay`). An
//     entrepreneur who has mortgaged his own house pays `floor(principal /
//     equityInterestDivisor)` each special month. Because an entrepreneur draws
//     his income from a firm — a non-consumer — this interest is the firm's
//     surplus reaching a rentier household as dividend: a demand flow, not a
//     reshuffle between two consumers.
//
// Which entrepreneurs borrow, and the loan each takes against his house, is
// `loanAsk` (policy.ts) — already a gate-accepted mortgage. The bridge pairs it
// with these. Pure, so the share math and the interest figure are tested alone.

import { params } from "./params.ts";
import type { Id, Money, Qty, World } from "./types.ts";
import { isBankId } from "./types.ts";

export type MineDeposit = { owner: Id; mine: Id; shares: Qty };

/** Every mine a non-bank owner still holds free (not deposited, not liened),
 *  with the shares its deposit mints — one per unit of stock, at least one.
 *  Deterministic by mine id. */
export function planMineDeposits(world: World): MineDeposit[] {
  const out: MineDeposit[] = [];
  for (const id of Object.keys(world.mines).sort()) {
    const mine = world.mines[id];
    if (mine.depositedAt !== null || mine.lien !== null) continue;
    if (isBankId(mine.owner)) continue;
    const purse = world.people[mine.owner] ?? world.firms[mine.owner];
    if (!purse) continue; // no purse to receive the shares
    out.push({ owner: mine.owner, mine: id, shares: Math.max(1, mine.stock) });
  }
  return out;
}

/** The interest an entrepreneur pays the bank on a mortgage of `principal`:
 *  a round fraction, so the bank earns a plain annual rate on what it lent. */
export function interestDue(principal: Money): Money {
  return Math.max(1, Math.floor(principal / params.equityInterestDivisor));
}
