// invest.ts — the bridge driver for invest day: the restricted special month
// that does ONLY what an expanding firm needs — buy a machine and hire its
// crew. No dividend, no shares, no house sales, no rent changes. It observes
// each month's sellouts, and once a year turns a `decideInvestment` plan into
// ordinary commits through the machine and job gates.
//
// The money is real: the buying firm pays a tech firm for the machine
// (`deliverMachine`), and the new operators draw a wage from the firm that hired
// them. Capacity then answers demand on the next month's `commitProduce`.
//
// It sweeps every producing firm that stocks a shelf — supermarkets, luxury
// shops and nightclubs — through one PRODUCERS table. A machine is typed by the
// CAREER that staffs it (retail machines serve both the staple and luxury shops;
// hospitality machines the clubs), so purchases are grouped by career and the
// vendor posts one listing per career. Widening the market set is a row here.

import { loadWorld } from "../world/store.ts";
import { params } from "../world/params.ts";
import { firmOutput, ops, output } from "../world/tech.ts";
import { decideInvestment, type InvestCandidate } from "../world/invest.ts";
import {
  deliverMachineGate,
  type GateResult,
  hireGate,
  postJobGate,
  postMachineGate,
} from "../world/gates.ts";
import { commitEngine } from "../cli/econ.ts";
import type { HarnessCtx } from "./harness.ts";
import { goodOf } from "../world/types.ts";
import type { Career, FirmKind, Id, ShelfGood, World } from "../world/types.ts";

/** The producing markets invest day serves: the firm kind, the career whose
 *  operators staff its machine, and the shelf good it sells. Add a row to widen
 *  the set. */
type Producer = { kind: FirmKind; career: Career; good: ShelfGood };
const PRODUCERS: readonly Producer[] = [
  { kind: "supermarket", career: "retail", good: "staple" },
  { kind: "luxury", career: "retail", good: "luxuryFood" },
  { kind: "nightclub", career: "hospitality", good: "nightclub" },
];
const producerOf = (kind: FirmKind): Producer | null =>
  PRODUCERS.find((p) => p.kind === kind) ?? null;

/** Sellout history the trigger reads: firm id → 1/0 per observed month. Lives at
 *  the bridge layer, not in World, so a frozen fixture's serialized shape never
 *  changes. One tracker spans a `runIgnition` call. */
export type InvestTracker = { history: Record<Id, number[]> };

export function newInvestTracker(): InvestTracker {
  return { history: {} };
}

const firmCash = (w: World, id: Id): number =>
  w.firms[id].deposits.a + w.firms[id].deposits.b;

/** Firms of a producing kind that are still open, each tagged with its row. */
function liveProducers(w: World): { id: Id; p: Producer }[] {
  const out: { id: Id; p: Producer }[] = [];
  for (const id of Object.keys(w.firms).sort()) {
    const firm = w.firms[id];
    if (firm.folded) continue;
    const p = producerOf(firm.kind);
    if (p) out.push({ id, p });
  }
  return out;
}

/** This firm's currently posted price for its good — the cheapest fresh lot. */
function postedPrice(w: World, id: Id, good: ShelfGood): number {
  const mine = w.listings.filter((l) =>
    l.seller === id && l.kind === "good" && goodOf(l.payload) === good
  );
  return mine.length ? Math.min(...mine.map((l) => l.price)) : 0;
}

function soldOutThisMonth(w: World, id: Id, good: ShelfGood): boolean {
  const made = firmOutput(w, id);
  if (!made || made.good !== good || made.qty <= 0) return false;
  const remaining = w.listings
    .filter((l) => l.seller === id && l.kind === "good" && goodOf(l.payload) === good)
    .reduce((s, l) => s + l.qty, 0);
  return remaining === 0;
}

/** Record every live producer's sellout for the month just settled. Call once a
 *  month, after the discretionary buys, before the month advances. */
export function observeSellouts(w: World, tracker: InvestTracker): void {
  for (const { id, p } of liveProducers(w)) {
    (tracker.history[id] ??= []).push(soldOutThisMonth(w, id, p.good) ? 1 : 0);
  }
}

function commit(ctx: HarnessCtx, gate: GateResult): void {
  if (!gate.ok) throw new Error(gate.reason);
  commitEngine(
    { world: ctx.worldPath, journal: ctx.journalPath },
    gate.effect,
    ctx.ids,
    ctx.clock,
  );
}

function newListingId(
  w: World,
  seller: Id,
  kind: "machine" | "job",
  pick: (payload: Record<string, unknown>) => boolean,
): Id | null {
  const hit = w.listings.find((l) =>
    l.seller === seller && l.kind === kind && l.qty > 0 &&
    !!l.payload && pick(l.payload as Record<string, unknown>)
  );
  return hit ? hit.id : null;
}

/** The gen-0 operators and output one machine of this career needs/makes, and
 *  the wage a new hire draws. decideInvestment's labour cap assumes these are
 *  uniform across the targeted careers (one shared idle pool, one ops figure);
 *  `uniformCrew` below guards that, so a future career-varying table fails loud
 *  rather than silently over-hiring. */
function newWage(): number {
  return params.townWage * params.metroWageScale;
}

/** The single (ops, output) the decision math uses, or a thrown error if the
 *  targeted careers disagree at gen 0 (then the uniform-labour assumption no
 *  longer holds and the rule must allocate the pool per career). */
function uniformCrew(): { opsPerMachine: number; fullOutput: number } {
  const careers = [...new Set(PRODUCERS.map((p) => p.career))];
  const opsSet = new Set(careers.map((c) => ops(c, 0)));
  const outSet = new Set(careers.map((c) => output(c, 0)));
  if (opsSet.size !== 1 || outSet.size !== 1) {
    throw new Error("invest day assumes uniform gen-0 ops/output across producing careers");
  }
  return { opsPerMachine: ops(careers[0], 0), fullOutput: output(careers[0], 0) };
}

/** Invest day. Reads the plan from the tracker's history and the world, then
 *  buys and hires across every producing market. A no-op when nothing qualifies,
 *  or there is no tech firm to supply a machine. Returns a short tally. */
export function runInvestDay(
  ctx: HarnessCtx,
  tracker: InvestTracker,
): { bought: number; hired: number } {
  const w0 = loadWorld(ctx.worldPath);
  const window = params.investWindow;
  const { opsPerMachine, fullOutput } = uniformCrew();
  const wage = newWage();

  const producers = liveProducers(w0);
  const careerOf = new Map<Id, Career>(producers.map(({ id, p }) => [id, p.career]));
  const candidates: InvestCandidate[] = producers.map(({ id, p }) => ({
    id,
    cash: firmCash(w0, id),
    price: postedPrice(w0, id, p.good),
    sellouts: (tracker.history[id] ?? []).slice(-window).reduce((s, x) => s + x, 0),
  }));
  const idle = Object.values(w0.people).filter((person) => person.alive && !person.job).length;

  const plan = decideInvestment({
    candidates,
    idle,
    opsPerMachine,
    fullOutput,
    newWage: wage,
    machinePrice: params.machinePrice,
    triggerSellouts: params.investTriggerSellouts,
    marginHeadroom: params.investMarginHeadroom,
  });
  if (plan.buyers.length === 0) return { bought: 0, hired: 0 };

  const vendor = Object.keys(w0.firms)
    .filter((id) => w0.firms[id].kind === "tech" && !w0.firms[id].folded)
    .sort()[0];
  if (!vendor) return { bought: 0, hired: 0 };

  // Group the planned buyers by the career that staffs their machine; the vendor
  // posts one machine listing per career (retail serves the staple and luxury
  // shops; hospitality the clubs). Priority order within a career is preserved.
  const byCareer = new Map<Career, Id[]>();
  for (const id of plan.buyers) {
    const career = careerOf.get(id)!;
    const group = byCareer.get(career) ?? [];
    group.push(id);
    byCareer.set(career, group);
  }

  let bought = 0, hired = 0;
  for (const career of [...byCareer.keys()].sort()) {
    const buyers = byCareer.get(career)!;
    commit(ctx, postMachineGate(
      loadWorld(ctx.worldPath), vendor, career, 0, params.machinePrice, buyers.length,
    ));
    const machineId = newListingId(
      loadWorld(ctx.worldPath), vendor, "machine", (pl) => pl.type === career,
    );
    if (!machineId) continue;

    for (const firm of buyers) {
      // take delivery (pays the vendor)
      try {
        commit(ctx, deliverMachineGate(loadWorld(ctx.worldPath), machineId, firm, 1));
        bought += 1;
      } catch {
        continue; // funds moved since the plan was read; skip this buyer
      }
      // open a full crew's seats and hire idle townsfolk into them
      commit(ctx, postJobGate(
        loadWorld(ctx.worldPath), firm, career, 0, wage, opsPerMachine,
      ));
      const jobId = newListingId(
        loadWorld(ctx.worldPath), firm, "job", (pl) => pl.career === career,
      );
      if (!jobId) continue;
      for (let seat = 0; seat < opsPerMachine; seat++) {
        const w = loadWorld(ctx.worldPath);
        const idlePerson = Object.values(w.people)
          .filter((person) => person.alive && !person.job).map((person) => person.id).sort()[0];
        if (!idlePerson) break;
        try {
          commit(ctx, hireGate(loadWorld(ctx.worldPath), jobId, idlePerson, true, false));
          hired += 1;
        } catch {
          // ineligible or no seat left; leave the seat empty
        }
      }
    }
  }
  return { bought, hired };
}
