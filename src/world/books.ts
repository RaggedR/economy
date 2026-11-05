// books.ts — the read the auditor asks for. One function, so the CLI's JSON and
// the demo's text are the same numbers.

import type { BankId, Id, Money, World } from "./types.ts";
import { isBankId } from "./types.ts";
import {
  holderIds,
  type Instrument,
  instrumentSums,
  moneySupply,
  nfa,
  purseOf,
} from "./world.ts";

export type BankLine = {
  equity: Money;
  depositLiability: Money;
  loansOutstanding: Money;
  sharesOutstanding: number;
  loanRate: number;
  losses: Money;
};

export type HolderLine = { id: Id; a: Money; b: Money; nfa: Money };

export type BooksReport = {
  month: number;
  moneySupply: Money;
  interbank: Money;
  instruments: Record<Instrument, Money>;
  banks: Record<BankId, BankLine>;
  holders: HolderLine[];
};

function bankLine(world: World, id: BankId): BankLine {
  const b = world.banks[id];
  return {
    equity: b.equity,
    depositLiability: b.depositLiability,
    loansOutstanding: b.loansOutstanding,
    sharesOutstanding: b.sharesOutstanding,
    loanRate: b.loanRate,
    losses: b.losses,
  };
}

export function booksReport(world: World): BooksReport {
  const holders: HolderLine[] = [];
  for (const id of holderIds(world)) {
    if (isBankId(id)) continue;
    const purse = purseOf(world, id);
    if (!purse) continue;
    holders.push({ id, a: purse.a, b: purse.b, nfa: nfa(world, id) });
  }
  return {
    month: world.month,
    moneySupply: moneySupply(world),
    interbank: world.interbank,
    instruments: instrumentSums(world),
    banks: { a: bankLine(world, "a"), b: bankLine(world, "b") },
    holders,
  };
}

export function formatBooks(world: World): string {
  const r = booksReport(world);
  const lines = [
    `month ${r.month}`,
    `money supply ${r.moneySupply}`,
    `interbank (a on b) ${r.interbank}`,
  ];
  for (const h of r.holders) {
    lines.push(`  ${h.id}  a ${h.a}  b ${h.b}  nfa ${h.nfa}`);
  }
  for (const id of ["a", "b"] as const) {
    const b = r.banks[id];
    lines.push(
      `  bank ${id}  equity ${b.equity}  deposit ${b.depositLiability}  ` +
        `loans ${b.loansOutstanding}  shares ${b.sharesOutstanding}  ` +
        `rate ${b.loanRate}  losses ${b.losses}`,
    );
  }
  const i = r.instruments;
  lines.push(
    `  deposits ${i.deposits}  loans ${i.loans}  privateLoans ${i.privateLoans}  ` +
      `shares ${i.shares}  interbank ${i.interbank}`,
  );
  return lines.join("\n");
}
