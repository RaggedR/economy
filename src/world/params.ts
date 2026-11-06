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
   * Deposits each person holds at t₀. The same year of staple as `cashGift`,
   * named apart so a sweep can move the adult purse without moving the gift.
   * Twelve times `stapleReservePrice`.
   */
  startingSavings: 60,
  /**
   * Incumbent wage at t₀, every career. Raised to the welfare optimum the sweep
   * found: a higher wage is the non-rival lever — it lifts health, education,
   * savings and the fed count together, because prices, and so firm revenue,
   * stay put. A job-day listing is a later post.
   */
  townWage: 16,
  /**
   * Cash each firm holds at t₀. A year of wages — the firm's analogue of a
   * person's `startingSavings`, so a firm survives a dry spell instead of
   * folding at the first opening it cannot self-fund. `firmReserveMonths`
   * times `townWage`.
   */
  firmFloat: 192,
  /**
   * Months of wages a solvent firm retains against the owner draw — its
   * working capital. The draw sweeps only what sits above this reserve, so a
   * firm keeps a buffer the way a person keeps savings. One month reproduces
   * the old hand-to-mouth firm; twelve is a year of payroll. Floors the
   * operating reserve; the current month's full bill still floors it too.
   */
  firmReserveMonths: 12,
  /**
   * The fraction of wellbeing that decays each month. Happiness and health are a
   * flow, not a stock: a nightclub consumed adds one happiness, luxury food adds
   * one health, and a fifth of the standing level erodes each month. Proportional
   * decay gives a bounded steady state — a sustained consumption of c a month
   * settles near c × den/num — so income and price set a ceiling on wellbeing,
   * not an ever-rising floor.
   */
  wellbeingDecay: { num: 1, den: 5 },
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
