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
};
