// invest.ts — the entrepreneur's decision, as a pure plan.
//
// A producing firm that keeps selling out has a case to add a machine. But a
// naive "sold out → buy" rule over-expands: it buys capital it cannot staff,
// and it keeps buying as its own new supply deflates the price below what the
// crew costs, until the sector folds. (That boom-bust is what the unguarded
// loop produces — capacity 100→290 then a cascade to zero over five years.)
//
// This rule gives the entrepreneur the two pieces of judgment that turn the
// bust into a soft landing:
//
//   • LABOUR — a machine makes nothing without operators, so never plan more
//     machines than the idle pool can staff (`floor(idle / opsPerMachine)`).
//   • MARGIN — a full machine makes `fullOutput` units for `opsPerMachine ×
//     newWage` of wages, so it breaks even at that ratio; invest only while the
//     going price clears that break-even with a unit of headroom.
//
// It decides nothing about money moving or ids — the bridge takes this plan and
// commits it through the ordinary machine and job gates. Pure, so the guards
// are tested in isolation.

import type { Id, Money, Qty } from "./types.ts";

/** One candidate firm, flattened to the four numbers the rule reads. */
export type InvestCandidate = {
  id: Id;
  /** Deposits on hand (across the firm's holders). */
  cash: Money;
  /** The firm's currently posted price for the good it sells. */
  price: Money;
  /** How many of the trailing window's months it sold out. */
  sellouts: number;
};

export type InvestInputs = {
  candidates: readonly InvestCandidate[];
  /** Living people with no job — the hire pool. */
  idle: number;
  /** Operators one new machine wants to run at full output. */
  opsPerMachine: number;
  /** Units a fully-staffed new machine makes a month. */
  fullOutput: Qty;
  /** Wage a new operator is hired at. */
  newWage: Money;
  /** Posted price of one machine. */
  machinePrice: Money;
  /** Sellouts in the window at or above which the demand case is made. */
  triggerSellouts: number;
  /** Units of price required above the crew break-even before investing. */
  marginHeadroom: number;
};

export type InvestPlan = {
  /** Firms that should each take one machine and hire a full crew, best case
   *  first. Capped so the idle pool can staff every one. */
  buyers: Id[];
};

/** The lowest integer price at which a full machine's output covers its crew.
 *  `ceil(opsPerMachine × newWage / fullOutput)`: below it the machine loses
 *  money on wages alone, so no amount of volume rescues it. */
export function breakEvenPrice(
  opsPerMachine: number,
  newWage: Money,
  fullOutput: Qty,
): Money {
  if (fullOutput <= 0) return Infinity;
  return Math.ceil((opsPerMachine * newWage) / fullOutput);
}

/** The cash a buyer must hold: the machine plus one crew's first month of
 *  wages. Not a year — the firm pays wages monthly from revenue, and the draw
 *  keeps it near its reserve, so a year up front gates almost everyone out. */
export function minBuffer(
  machinePrice: Money,
  opsPerMachine: number,
  newWage: Money,
): Money {
  return machinePrice + opsPerMachine * newWage;
}

/** Who invests this cycle. A candidate qualifies when it sold out enough of the
 *  window, can afford the machine and first payroll, and its price still clears
 *  the crew's break-even with headroom. The field is then capped at what labour
 *  can staff, hungriest (then best-capitalised) first, so no machine is bought
 *  that would stand idle. */
export function decideInvestment(inp: InvestInputs): InvestPlan {
  const floor = minBuffer(inp.machinePrice, inp.opsPerMachine, inp.newWage);
  const minPrice = breakEvenPrice(inp.opsPerMachine, inp.newWage, inp.fullOutput) +
    inp.marginHeadroom;
  const labourCap = inp.opsPerMachine > 0
    ? Math.floor(inp.idle / inp.opsPerMachine)
    : 0;

  const buyers = inp.candidates
    .filter((c) =>
      c.sellouts >= inp.triggerSellouts && c.cash >= floor && c.price >= minPrice
    )
    .slice()
    .sort((a, b) =>
      b.sellouts - a.sellouts || b.cash - a.cash || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
    )
    .slice(0, Math.max(0, labourCap))
    .map((c) => c.id);

  return { buyers };
}
