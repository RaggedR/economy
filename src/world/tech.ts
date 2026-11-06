// tech.ts — the tech summand, as a pure plan.
//
// stay posts the current generation at the current volume. expand lists more
// engineer slots at that generation. upgrade lists one engineer slot at the
// next level and offers that generation. None of the three mints a machine.
// A generation enters the world when a built machine of it is delivered.
//
// ops(c, g) falls in g until it reaches 1. A positive integer cannot fall
// forever. output(c, g) does not fall. β is ops(bureaucrat, 0), and it is 1.
// The placeholder does not vary by career. It varies by generation.
//
// Public supply is this output, staffed. One assignee is not one award.
// Operators are consumed in machine-id order. A firm with admin machines and
// not enough bureaucrats runs only the productive share it can staff. No
// admin machine means there is nothing to be short of.

import { params } from "./params.ts";
import type {
  Career,
  Disease,
  Firm,
  FirmKind,
  Good,
  Id,
  Listing,
  Machine,
  MachineType,
  Money,
  Person,
  Qty,
  ShelfGood,
  World,
} from "./types.ts";
import { CAREERS, isDisease } from "./types.ts";

export type StrategyMode = "stay" | "expand" | "upgrade";

export type ProductLine = {
  type: MachineType;
  generation: number;
  volume: Qty;
};

export function isStrategyMode(mode: string): mode is StrategyMode {
  return mode === "stay" || mode === "expand" || mode === "upgrade";
}

function positive(n: number, least: number, name: string): void {
  if (!Number.isInteger(n) || n < least) {
    throw new Error(`${name} is not an integer ≥ ${least}`);
  }
}

/** The placeholder table. A reducer reads `ops` and `output`, not these fields. */
export function checkTechTable(): void {
  positive(params.opsAt0, 2, "opsAt0");
  positive(params.opsLater, 1, "opsLater");
  if (params.opsLater >= params.opsAt0) throw new Error("ops does not fall in g");
  if (params.bureaucratOps !== 1) throw new Error("β is ops(bureaucrat, 0), and it is 1");
  positive(params.outputAt0, 1, "outputAt0");
  positive(params.outputLater, 1, "outputLater");
  if (params.outputLater < params.outputAt0) throw new Error("output falls in g");
  positive(params.machinePrice, 1, "machinePrice");
  positive(params.upgradePremium, 1, "upgradePremium");
  positive(params.engineerSalary, 1, "engineerSalary");
  if (params.advancedSalary <= params.engineerSalary) {
    throw new Error("an advanced engineer is not paid more");
  }
  positive(params.expandSlots, 1, "expandSlots");
  const half = Math.floor(params.outputAt0 / params.opsAt0);
  if (params.outputAt0 % params.opsAt0 !== 0 || half !== params.cureSize) {
    throw new Error("one operator on a generation-0 machine is not one cure");
  }
  if (half !== params.unitsPerLevel) {
    throw new Error("one operator on a generation-0 machine is not one level");
  }
}

export function ops(career: Career, generation: number): number {
  checkTechTable();
  if (!Number.isInteger(generation) || generation < 0) {
    throw new Error("generation must be a non-negative integer");
  }
  if (career === "bureaucrat") return params.bureaucratOps;
  return generation === 0 ? params.opsAt0 : params.opsLater;
}

export function output(career: Career, generation: number): number {
  checkTechTable();
  if (!Number.isInteger(generation) || generation < 0) {
    throw new Error("generation must be a non-negative integer");
  }
  // The placeholder is one number per generation. The career is still an
  // argument, so a later table can differ without a new call.
  if (!(CAREERS as readonly string[]).includes(career)) {
    throw new Error(`unknown career ${career}`);
  }
  return generation === 0 ? params.outputAt0 : params.outputLater;
}

/** The generation this firm has delivered, and the volume it posts. */
export function currentLine(world: World, firmId: Id): ProductLine | null {
  const built = Object.values(world.machines).filter((machine) =>
    machine.builder === firmId && Number.isInteger(machine.generation) &&
    machine.generation >= 0
  );
  if (built.length === 0) return null;
  const generation = built.reduce(
    (highest, machine) => machine.generation > highest ? machine.generation : highest,
    0,
  );
  const at = built.filter((machine) => machine.generation === generation);
  let type: MachineType = CAREERS[0];
  let count = -1;
  for (const career of CAREERS) {
    const n = at.filter((machine) => machine.type === career).length;
    if (n > count) {
      count = n;
      type = career;
    }
  }
  if (count < 1) return null;
  const sold = world.firms[firmId]?.salesLastMonth ?? 0;
  const volume = Number.isInteger(sold) && sold > 0 ? sold : count;
  return { type, generation, volume };
}

function machineListing(
  seller: Id,
  type: MachineType,
  generation: number,
  price: Money,
  qty: Qty,
): Listing {
  return {
    id: "",
    seller,
    kind: "machine",
    price,
    qty,
    payload: { type, generation },
  };
}

function jobListing(
  seller: Id,
  generation: number,
  salary: Money,
  slots: number,
): Listing {
  return {
    id: "",
    seller,
    kind: "job",
    price: salary,
    qty: slots,
    payload: { career: "engineer", generation, salary, slots },
  };
}

/** The posts a mode writes. A string is a refusal. No machine is among them. */
export function strategyPlan(
  world: World,
  firmId: Id,
  mode: StrategyMode,
): { posts: Listing[] } | { reason: string } {
  checkTechTable();
  const firm = world.firms[firmId];
  if (!firm) return { reason: `no firm ${firmId}` };
  if (firm.folded) return { reason: `${firmId} has folded` };
  if (firm.kind !== "tech") return { reason: `${firmId} is not a tech firm` };
  const line = currentLine(world, firmId);
  if (!line) return { reason: `no generation has been delivered by ${firmId}` };
  if (mode === "stay") {
    return {
      posts: [
        machineListing(
          firmId,
          line.type,
          line.generation,
          params.machinePrice,
          line.volume,
        ),
      ],
    };
  }
  if (mode === "expand") {
    return {
      posts: [
        jobListing(firmId, line.generation, params.engineerSalary, params.expandSlots),
      ],
    };
  }
  return {
    posts: [
      jobListing(firmId, line.generation + 1, params.advancedSalary, 1),
      machineListing(
        firmId,
        line.type,
        line.generation + 1,
        params.machinePrice + params.upgradePremium,
        1,
      ),
    ],
  };
}

function held(world: World, firm: Firm, type: MachineType): Machine[] {
  const machines: Machine[] = [];
  for (const id of firm.machines) {
    const machine = world.machines[id];
    if (!machine || machine.owner !== firm.id || machine.type !== type) continue;
    if (!Number.isInteger(machine.generation) || machine.generation < 0) continue;
    machines.push(machine);
  }
  machines.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return machines;
}

function byId(a: Person, b: Person): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function crew(world: World, firm: Firm, career: Career): Person[] {
  return Object.values(world.people).filter((person) => {
    if (!person.alive || !person.job) return false;
    if (person.job.firm !== firm.id || person.job.career !== career) return false;
    if (career === "bureaucrat") return true;
    if (person.assignment === null) return false;
    if (career === "doctor") return isDisease(person.assignment);
    return (CAREERS as readonly string[]).includes(person.assignment);
  }).sort(byId);
}

/** Units credited to each assignment. Operators are consumed in id order. */
function staffUnits(
  machines: readonly Machine[],
  operators: readonly { assignment: string }[],
  career: Career,
): Map<string, number> {
  const bags = new Map<string, number>();
  let index = 0;
  for (const machine of machines) {
    const need = ops(career, machine.generation);
    const made = output(career, machine.generation);
    const take = Math.min(need, operators.length - index);
    if (take <= 0) break;
    const units = Math.floor(made * take / need);
    const base = Math.floor(units / take);
    let rest = units - base * take;
    for (let k = 0; k < take; k++) {
      const key = operators[index + k].assignment;
      const share = base + (rest > 0 ? 1 : 0);
      if (rest > 0) rest -= 1;
      bags.set(key, (bags.get(key) ?? 0) + share);
    }
    index += take;
  }
  return bags;
}

function adminRatio(world: World, firm: Firm): { staffed: number; full: number } {
  const machines = held(world, firm, "bureaucrat");
  if (machines.length === 0) return { staffed: 1, full: 1 };
  const operators = crew(world, firm, "bureaucrat").map((person) => ({
    assignment: person.id,
  }));
  let staffed = 0;
  for (const units of staffUnits(machines, operators, "bureaucrat").values()) {
    staffed += units;
  }
  let full = 0;
  for (const machine of machines) full += output("bureaucrat", machine.generation);
  if (full <= 0) return { staffed: 0, full: 1 };
  return { staffed, full };
}

/** Awards one public career can hand out for one specialty. */
export function awardSupply(
  world: World,
  career: "doctor" | "teacher",
  specialty: Disease | Career,
): number {
  checkTechTable();
  const kind = career === "doctor" ? "publicHospital" : "publicUniversity";
  let units = 0;
  for (const firm of Object.values(world.firms)) {
    if (firm.folded || firm.kind !== kind) continue;
    const bags = staffUnits(
      held(world, firm, career),
      crew(world, firm, career).map((person) => ({
        assignment: String(person.assignment),
      })),
      career,
    );
    const raw = bags.get(specialty) ?? 0;
    const ratio = adminRatio(world, firm);
    units += Math.floor(raw * ratio.staffed / ratio.full);
  }
  const bundle = career === "doctor" ? params.cureSize : params.unitsPerLevel;
  if (!Number.isInteger(bundle) || bundle <= 0) {
    throw new Error("award bundle is not a positive integer");
  }
  return Math.floor(units / bundle);
}

/** Loaves one supermarket bakes. A generation-0 retail machine wants two
 *  operators and makes `outputAt0`. One worker staffs half of it, so a second
 *  machine adds nothing until a second worker arrives. Town retail workers
 *  have no assignment, so this counts the job. `crew` would drop them. */
export function stapleOutput(world: World, firmId: Id): Qty {
  const firm = world.firms[firmId];
  if (!firm || firm.folded || firm.kind !== "supermarket") return 0;
  const workers =
    Object.values(world.people).filter((person) =>
      person.alive && person.job?.firm === firmId && person.job.career === "retail"
    ).length;
  let left = workers;
  let made = 0;
  for (const machine of held(world, firm, "retail")) {
    const need = ops("retail", machine.generation);
    const take = Math.min(need, left);
    if (take <= 0) break;
    made += Math.floor(output("retail", machine.generation) * take / need);
    left -= take;
  }
  return made;
}

/** Add this month's bake to staple inventory. Does not post the listing. */
/** The good a producing firm makes. Public firms award health and education
 *  through the doctor/teacher machines, not a shelf good, so they return null.
 *  Cure and tuition are shelf-posted one-shot elsewhere; this is the continuous
 *  shelf. */
export function firmGood(kind: FirmKind): ShelfGood | null {
  switch (kind) {
    case "supermarket":
      return "staple";
    case "luxury":
      return "luxuryFood";
    case "nightclub":
      return "nightclub";
    default:
      return null;
  }
}

/** The career that staffs a producing firm's machine. */
function productionCareer(kind: FirmKind): Career | null {
  switch (kind) {
    case "supermarket":
    case "luxury":
      return "retail";
    case "nightclub":
      return "hospitality";
    default:
      return null;
  }
}

/** Units of its good a firm makes this month. The staple generalisation:
 *  career-matched operators staff career-typed machines, and each fully-staffed
 *  machine yields output(career, generation). Returns null for a firm with no
 *  continuous good (banks, mills, public staff, hospitals, universities). */
export function firmOutput(
  world: World,
  firmId: Id,
): { good: ShelfGood; qty: Qty } | null {
  const firm = world.firms[firmId];
  if (!firm || firm.folded) return null;
  const good = firmGood(firm.kind);
  const career = productionCareer(firm.kind);
  if (!good || !career) return null;
  const workers =
    Object.values(world.people).filter((person) =>
      person.alive && person.job?.firm === firmId && person.job.career === career
    ).length;
  let left = workers;
  let made = 0;
  for (const machine of held(world, firm, career)) {
    const need = ops(career, machine.generation);
    const take = Math.min(need, left);
    if (take <= 0) break;
    made += Math.floor(output(career, machine.generation) * take / need);
    left -= take;
  }
  return made > 0 ? { good, qty: made } : null;
}

/** Tuition units a private university trains this month. Teacher operators staff
 *  teacher machines, output(teacher, generation) each. The same shape as
 *  stapleOutput, for a good that posts with a career rather than a shelf lot. */
export function tuitionOutput(world: World, firmId: Id): Qty {
  const firm = world.firms[firmId];
  if (!firm || firm.folded || firm.kind !== "privateUniversity") return 0;
  const workers =
    Object.values(world.people).filter((person) =>
      person.alive && person.job?.firm === firmId && person.job.career === "teacher"
    ).length;
  let left = workers;
  let made = 0;
  for (const machine of held(world, firm, "teacher")) {
    const need = ops("teacher", machine.generation);
    const take = Math.min(need, left);
    if (take <= 0) break;
    made += Math.floor(output("teacher", machine.generation) * take / need);
    left -= take;
  }
  return made;
}

export function bakeStaple(world: World): World {
  let firms = world.firms;
  for (const firmId of Object.keys(world.firms).sort()) {
    const n = stapleOutput(world, firmId);
    if (n <= 0) continue;
    const firm = firms[firmId];
    const have = firm.inventory.staple ?? 0;
    firms = {
      ...firms,
      [firmId]: { ...firm, inventory: { ...firm.inventory, staple: have + n } },
    };
  }
  return firms === world.firms ? world : { ...world, firms };
}
