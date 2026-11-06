// kin.ts — the engine's births, and the estate after a death. No leaf is asked.
// A month with nobody over the line and nobody dead writes nothing.

import { commitEngine } from "../cli/econ.ts";
import { holdsEstate, planBirths, planEstate, planSpecialBirths } from "../world/kin.ts";
import { loadWorld, saveWorld } from "../world/store.ts";
import type { Id } from "../world/types.ts";
import type { HarnessCtx } from "./harness.ts";

function paths(ctx: HarnessCtx): { world: string; journal: string } {
  return { world: ctx.worldPath, journal: ctx.journalPath };
}

/** Forced births only. The voluntary weight is zero, so that band writes nothing. */
export function runBirths(ctx: HarnessCtx): void {
  const effects = planBirths(loadWorld(ctx.worldPath));
  for (const effect of effects) {
    commitEngine(paths(ctx), effect, ctx.ids, ctx.clock);
  }
}

/** The special month's births (mandatory, and voluntary when exercised). The
 *  first thing the special month does, ahead of any real-estate sale, so a
 *  parent's child is split off before holdings can trade. Returns how many were
 *  born, for the caller to log. */
export function runSpecialBirths(ctx: HarnessCtx, exerciseVoluntary = true): number {
  const effects = planSpecialBirths(loadWorld(ctx.worldPath), exerciseVoluntary);
  for (const effect of effects) {
    commitEngine(paths(ctx), effect, ctx.ids, ctx.clock);
  }
  return effects.length;
}

/** Seize, route, then the death mark. The draw, if there is one, is saved first. */
export function commitDeath(ctx: HarnessCtx, personId: Id): void {
  const current = loadWorld(ctx.worldPath);
  const plan = planEstate(current, personId);
  saveWorld(ctx.worldPath, { ...current, rng: plan.world.rng });
  for (const effect of plan.effects) {
    commitEngine(paths(ctx), effect, ctx.ids, ctx.clock);
  }
}

/** A death that was only a mark still owes its estate. A cleared estate writes nothing. */
export function settleDead(ctx: HarnessCtx): void {
  const ids = Object.values(loadWorld(ctx.worldPath).people)
    .filter((person) => !person.alive)
    .map((person) => person.id)
    .sort();
  for (const id of ids) {
    const current = loadWorld(ctx.worldPath);
    if (!holdsEstate(current, id)) continue;
    const plan = planEstate(current, id);
    saveWorld(ctx.worldPath, { ...current, rng: plan.world.rng });
    for (const effect of plan.effects) {
      commitEngine(paths(ctx), effect, ctx.ids, ctx.clock);
    }
  }
}
