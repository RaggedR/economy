// params.ts — knobs the interface left without a default, named in one place.
// Reducers read these. They do not invent a number inline.
//
// leverageMultiple is the interface's default of 10. The others are
// placeholders. Sweeping them is not part of milestones 0–5.

import type { Material, Money } from "./types.ts";

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
  /** Money of one staple unit, used to size the fold's food reserve. */
  stapleReservePrice: 5,
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
};
