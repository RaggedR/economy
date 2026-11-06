// params.ts — knobs the interface left without a default, named in one place.
// Reducers read these. They do not invent a number inline.
//
// leverageMultiple is the interface's default of 10. The others are
// placeholders. Sweeping them is not part of milestones 0–5.

import type { Material, Money, Objective } from "./types.ts";

export const params = {
  /** Percent of collateral value a bank loan may reach. No spec default. */
  ltvPercent: 50,
  /** Ceiling on new bank loans, as a multiple of the marked mine base. */
  leverageMultiple: 10,
  /** Money value of one house unit. No spec default. */
  houseUnitValue: 100,
  /** Carried-forward ore reference when no independent sale is in the window. */
  initialRef: { common: 10, advanced: 40 } as Record<Material, Money>,
  /** Integer units the scripted bank moves a rate or an ore price. */
  rateStep: 1,
  /**
   * Monthly maintenance for every (career, generation). The t₀ vector is not
   * in this range, so the price is one named integer rather than a table.
   */
  maintenance: 10,
  /** Money of one staple unit, used to size the fold's food reserve. The t₀ post. */
  stapleReservePrice: 5,
  /**
   * Sold-out staple multiplies by num/den. No spec default. 5/4 lifts 4 to 5
   * and 5 to 6. 6/5 left a price of 4 where it was. The price is floored.
   */
  raiseFactor: { num: 5, den: 4 },
  /**
   * Staple left on the listing multiplies by num/den. No spec default.
   * 1/1 holds the price. A fraction that cuts 5 to 4 then cuts 4 to 3, and
   * five loaves at 3 are 15, short of the opening bill of 18. The thin shop
   * folds, and the town bakes ten.
   */
  cutFactor: { num: 1, den: 1 },
  /**
   * The cut for a discretionary good (luxury, nightclub) under
   * discretionaryDiscovery, kept separate from staple's cutFactor so a working
   * cut can find a clearing price for a want without deflating the necessity.
   * 1/1 holds the price (the frozen default); a fraction like 4/5 lets a
   * leftover shelf fall until the better-off buyers clear the month's make.
   */
  discretionaryCut: { num: 1, den: 1 },
  /**
   * A cheaper competitor caps the next price at that post times num/den.
   * 1/1 matches. No spec default.
   */
  undercutFactor: { num: 1, den: 1 },
  /**
   * Percent knocked off a posted price when starvation sells an asset.
   * No spec default. Selling shares and mines is a later market; the number
   * lives here so a reducer does not invent it.
   */
  distressDiscountPercent: 20,
  /**
   * Disease strikes when `nextUint % diseaseOutOf < diseaseHit`. No spec
   * default. The second draw, only on a hit, picks one of the five uniformly.
   * One in five is the placeholder, so the fraction is named rather than written
   * into the draw.
   */
  diseaseHit: 1,
  diseaseOutOf: 5,
  /** Doctor units in one cure. Fixed by the interface. All or nothing. */
  cureSize: 10,
  /** Teacher-time for one level-up. No spec default. */
  unitsPerLevel: 10,
  /**
   * ops(c, 0) for every career except bureaucrat. It falls to `opsLater` once
   * g ≥ 1. The floor is 1: a positive integer cannot fall forever.
   */
  opsAt0: 2,
  /** ops(c, g) for g ≥ 1, other than bureaucrat. */
  opsLater: 1,
  /** β. ops(bureaucrat, g) at every g. The interface's default is 1. */
  bureaucratOps: 1,
  /**
   * output(c, 0), units per machine. The placeholder does not vary by career.
   * Half of it, one operator against ops(c, 0), is one cure and one level.
   */
  outputAt0: 20,
  /** output(c, g) for g ≥ 1. It does not fall. This placeholder rises once. */
  outputLater: 40,
  /** Posted price of the current generation. No spec default. */
  machinePrice: 10,
  /** Added to that price when the next generation is offered. */
  upgradePremium: 5,
  /** Wage on an engineer slot at the current generation. */
  engineerSalary: 8,
  /** Wage on the advanced slot upgrade lists. Higher than the current one. */
  advancedSalary: 12,
  /** Engineer slots expand adds. */
  expandSlots: 1,
  /** House quantum. Fixed by the interface: gift, escheat, sizes. */
  houseQuantum: 10,
  /**
   * Cash gifted to a newborn. The spec says about a year of staple. Twelve
   * months at `stapleReservePrice` is the placeholder.
   */
  cashGift: 60,
  /**
   * Cash a newborn receives on the special month, transferred from the parent
   * (who must hold at least this much to fund the child). Defaults to `cashGift`
   * — one year of staple, the frozen gift — kept as its own knob so the town can
   * endow children more generously (making the baby boom add demand, not just
   * labour) without moving the fertility thresholds, which are multiples of G.
   */
  birthEndowment: 60,
  /**
   * Deposits each person holds at t₀. The same year of staple as `cashGift`,
   * named apart so a sweep can move the adult purse without moving the gift.
   * Twelve times `stapleReservePrice`.
   */
  startingSavings: 60,
  /** Incumbent wage at t₀, every career. A job-day listing is a later post. */
  townWage: 8,
  /**
   * Cash each firm holds at t₀. A year of wages — the firm's analogue of a
   * person's `startingSavings`, so a firm survives a dry spell instead of
   * folding at the first opening it cannot self-fund. `firmReserveMonths`
   * times `townWage`.
   */
  firmFloat: 96,
  /**
   * Months of wages a solvent firm retains against the owner draw — its
   * working capital. The draw sweeps only what sits above this reserve, so a
   * firm keeps a buffer the way a person keeps savings. One month reproduces
   * the old hand-to-mouth firm; twelve is a year of payroll. Floors the
   * operating reserve; the current month's full bill still floors it too.
   */
  firmReserveMonths: 12,
  /**
   * Wellbeing decays this much each month toward zero. Happiness and health are
   * a flow, not a stock: a nightclub consumed adds one happiness, luxury food
   * adds one health, and both erode by this each month. So a person must keep
   * consuming to hold a level, and income funds a steady state rather than a
   * one-time climb.
   */
  wellbeingDecay: 1,
  /**
   * Lots a household buys per discretionary step (nightclub, luxury food) each
   * month. 1 is one pass down the chain — the frozen demand, capped at a single
   * lot, which pins happiness and health near their consumption rate. Above 1,
   * demand is elastic: a person buys up to this many lots per step, cash and
   * shelf permitting, so demand can outrun a seller's supply and a listing can
   * sell out. The one lever the welfare sweep could not reach.
   */
  demandLots: 1,
  /**
   * When > 0, discretionary demand is a budget, not a lot count: each month a
   * household spends up to this fraction of its cash (after staple) on the
   * nightclub/luxury steps, buying as many lots as that budget affords at the
   * going price. This makes demand slope — budget/price lots, so fewer as price
   * rises — and wealth-scaled: the rich buy many, the poor buy few and keep the
   * rest as savings. 0 is off: the flat demandLots cap applies (the frozen
   * default). A fraction is num/den to stay integer-exact.
   */
  demandBudgetFraction: { num: 0, den: 1 },
  /**
   * When true, a continuously produced good (luxury food, nightclub) reposts on
   * the same rule staple uses — cut a leftover shelf, raise a sellout, capped by
   * a cheaper rival — instead of the fixed posted price. Off is the frozen
   * market: commitProduce reposts at the param price every month, so the
   * discretionary price never discovers a level.
   */
  discretionaryDiscovery: false,
  /**
   * When true, a continuously produced good (luxury food, nightclub) is
   * perishable: last month's unsold shelf is discarded before this month's make
   * is posted, so supply is one month's production, not a pile that grows every
   * month. Off is the frozen market, where unsold stock accumulates without
   * bound and nothing is ever scarce — so no listing sells out and no price can
   * rise. A nightclub's empty night and a day's fresh food do not keep; this
   * flag says so. Scarcity is the precondition price discovery actually needs.
   */
  perishable: false,
  /**
   * Multiplies every metropolis job salary (the town's incomes). 1 is the frozen
   * wage spread of 6–14. Above 1 raises purchasing power: the lever the
   * price-discovery arc points at, since the discovered price deflates when
   * production capacity outruns what the town can afford. A knob on metropolis
   * incomes only; the milestone towns do not read it.
   */
  metroWageScale: 1,
  /**
   * When true, every metropolis producing machine is generation 0 — the weak
   * machine — instead of the gen-0/gen-1 mix. Lower output per firm, so the
   * month's supply can sit below demand and the price clears above the floor.
   * A knob on metropolis supply only; the milestone towns do not read it.
   */
  metroWeakMachines: false,
  /**
   * Invest day (opt-in, `runIgnition(..., { invest })`). A nightclub that sold
   * out at least this many of the trailing `investWindow` months has made the
   * demand case to add a machine. 6 of 12 is a persistent, not a one-off,
   * sellout. Read only when invest is on; the milestone loop never is.
   */
  investTriggerSellouts: 6,
  /** Months of sellout history the trigger looks back over. A year. */
  investWindow: 12,
  /**
   * Units of price a firm demands above the crew's break-even before it buys.
   * The break-even is where a full machine's output just covers its operators;
   * one unit of headroom keeps the firm from expanding into a price its own new
   * supply would push below cost — the guard that turns the boom-bust into a
   * soft landing.
   */
  investMarginHeadroom: 1,
  /** One unit of luxury food. Above staple. No spec default. */
  luxuryPrice: 8,
  /** One nightclub unit. No spec default. */
  nightclubPrice: 10,
  /** One teacher-unit. A level costs `unitsPerLevel` of these. */
  tuitionPrice: 1,
  /** One doctor-unit. A cure costs `cureSize` of these. */
  curePrice: 2,
  /**
   * A year of rent on the smallest house. The prompt's lowest rent. Not a
   * listing at t₀: every house is owner-occupied.
   */
  rentPrice: 10,
  /** Spare real-estate quanta, and this multiple of G, per voluntary child. */
  fertilityLiquidMultiple: 3,
  /** Owned units that force a birth. */
  fertilityUnits: 100,
  /** This multiple of G in deposits, with the unit test, forces a birth. */
  fertilityMultiple: 10,
  /**
   * Minimum deposits before `acceptDebt` exists. No spec default. One hundred
   * minor units is the placeholder.
   */
  savingsThreshold: 100,
  /**
   * A lender accepts when disclosed revenue is at least this multiple of the
   * installment. No spec default. Two is the placeholder.
   */
  revenueCover: 2,
  /**
   * Percent chance of a voluntary birth, by objective. All zero: the
   * voluntary band is visible and does not fire. A positive weight is a
   * later calibration, not a policy chosen here.
   */
  fertilityWeight: {
    happiness: 0,
    health: 0,
    education: 0,
    savings: 0,
    investment: 0,
  } as Record<Objective, number>,
};
