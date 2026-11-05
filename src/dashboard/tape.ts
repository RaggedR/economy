// tape.ts — one scene, read for the five panels.
//
// The journal stores the effect tag and not the price. A posted price is a
// listing still on the world, and it is dated at world.month because that is
// the only book the file holds. Cleared quantity is the positive side of the
// flow divided by that price, and only when one price was posted and it
// divides the flow. A missing series is absent. It is not drawn as zero.

import type { IntentRecord, IntentStatus } from "../log/intentlog.ts";
import type { JournalEntry } from "../log/journal.ts";
import {
  diseaseOf,
  type FlowEntry,
  goodOf,
  houseOf,
  type Listing,
  shareBank,
  tuitionCareer,
} from "../world/types.ts";

export type Unit = "price" | "rate" | "qty" | "count";

export type Point = { month: number; value: number };

export type Series = {
  id: string;
  label: string;
  unit: Unit;
  points: Point[];
};

export type PanelId = "consumer" | "employment" | "housing" | "machines" | "capital";

export type Panel = {
  id: PanelId;
  title: string;
  /** Each unit keeps its own scale. Quantity is not drawn on the price axis. */
  tracks: { unit: Unit; series: Series[] }[];
  /** Spec series this scene did not post. */
  absent: string;
  /** A stock the world holds that is not itself a price. */
  note: string;
};

export type ReasonLine = {
  agent: string;
  status: IntentStatus;
  reason: string;
};

export type MonthMark = {
  month: number;
  effects: string[];
  refused: number;
  reasons: ReasonLine[];
};

export type Tape = {
  scene: string;
  month: number;
  months: number[];
  panels: Panel[];
  marks: MonthMark[];
  /** Seen in the book, and named by no panel. */
  aside: string[];
  /** A flow the reader refused to turn into a quantity. */
  warnings: string[];
};

export type TapePerson = {
  alive: boolean;
  dwelling: string | null;
  job: { career: string; salary: number } | null;
};

/** The fields the panels read. A full world JSON has them, and the rest is ignored. */
export type TapeInput = {
  month: number;
  listings: Listing[];
  flows: FlowEntry[];
  people: Record<string, TapePerson>;
  houses: Record<string, { units: number }>;
  machines: Record<string, { type: string; generation: number }>;
  banks: Record<string, { loanRate: number }>;
};

type Raw = {
  id: string;
  label: string;
  unit: Unit;
  month: number;
  value: number;
  order: number;
};

const PANEL_ORDER: { id: PanelId; title: string }[] = [
  { id: "consumer", title: "Consumer" },
  { id: "employment", title: "Employment" },
  { id: "housing", title: "Housing" },
  { id: "machines", title: "Machines" },
  { id: "capital", title: "Capital" },
];

const CAREERS = ["retail", "hospitality", "bureaucrat", "doctor", "teacher", "engineer"];

export function tapeOf(
  scene: string,
  input: TapeInput,
  journal: readonly JournalEntry[],
  intent: readonly IntentRecord[],
): Tape {
  const warnings: string[] = [];
  const aside: string[] = [];
  const month = input.month;
  const built = {
    consumer: consumer(input, month, warnings),
    employment: employment(input, month, warnings),
    housing: housing(input, month, intent, warnings),
    machines: machines(input, month, warnings),
    capital: capital(input, month, warnings),
  };
  const known = new Set([
    "good",
    "ore",
    "machine",
    "job",
    "houseSale",
    "rent",
    "mine",
    "debt",
    "share",
    "cure",
  ]);
  for (const listing of input.listings) {
    if (listing.kind === "share") aside.push(shareAside(listing));
    if (!known.has(listing.kind)) {
      warnings.push(
        `listing ${listing.id || listing.seller} kind ${listing.kind} is not on a panel`,
      );
    }
  }
  const months = monthAxis(input, journal);
  return {
    scene,
    month,
    months,
    panels: PANEL_ORDER.map((panel) => ({
      id: panel.id,
      title: panel.title,
      tracks: built[panel.id].tracks,
      absent: built[panel.id].absent,
      note: built[panel.id].note,
    })),
    marks: marks(months, journal, intent),
    aside,
    warnings,
  };
}

export function parseScene(
  scene: string,
  world: unknown,
  journal: unknown,
  intent: unknown,
): Tape {
  return tapeOf(
    scene,
    worldOf(scene, world),
    journalOf(scene, journal),
    intentOf(scene, intent),
  );
}

function consumer(input: TapeInput, month: number, warnings: string[]): PanelBody {
  const rows: Offer[] = [];
  for (const listing of input.listings) {
    const offer = consumerOffer(listing);
    if (offer) {
      rows.push({
        ...offer,
        price: listing.price,
        qty: listing.qty,
        seller: listing.seller,
      });
    } else if (listing.kind === "good" || listing.kind === "cure") {
      warnings.push(`${listing.id || listing.kind} has no readable offer`);
    }
  }
  const present = new Set(rows.map((row) => row.family));
  const missing = ["staple", "luxury food", "nightclub", "private hospital", "tuition"]
    .filter((name) => !present.has(name));
  return {
    tracks: [
      ...track("price", pack(priced(rows, month))),
      ...track(
        "qty",
        pack([...unsold(rows, month), ...sold(input, month, rows, warnings)]),
      ),
    ],
    absent: missing.length ? `No posting for ${list(missing)}.` : "",
    note: "",
  };
}

function employment(input: TapeInput, month: number, warnings: string[]): PanelBody {
  const rows: Offer[] = [];
  const posted = new Set<string>();
  for (const listing of input.listings) {
    if (listing.kind !== "job") continue;
    const payload = listing.payload;
    if (
      !payload || !("career" in payload) || !("generation" in payload) ||
      !("salary" in payload) || typeof payload.career !== "string" ||
      typeof payload.generation !== "number" || typeof payload.salary !== "number"
    ) {
      warnings.push(`job listing ${listing.id || listing.seller} has no salary`);
      continue;
    }
    posted.add(payload.career);
    const order = careerOrder(payload.career) * 10 + payload.generation;
    rows.push({
      family: "wage",
      label: `wage · ${payload.career} · g${payload.generation}`,
      row: "wages",
      order,
      price: payload.salary,
      qty: listing.qty,
      seller: listing.seller,
    });
  }
  const seated = new Map<string, number[]>();
  let seatedWage = false;
  for (const person of Object.values(input.people)) {
    if (!person.alive || !person.job) continue;
    if (posted.has(person.job.career)) continue;
    const got = seated.get(person.job.career) ?? [];
    got.push(person.job.salary);
    seated.set(person.job.career, got);
  }
  for (const [career, salaries] of seated) {
    const unique = new Set(salaries);
    if (unique.size !== 1) {
      warnings.push(`seated ${career} wages differ`);
      continue;
    }
    seatedWage = true;
    rows.push({
      family: "wage",
      label: `wage · ${career} · seated`,
      row: "wages",
      order: careerOrder(career) * 10,
      price: salaries[0],
      qty: 0,
      seller: career,
    });
  }
  const alive = Object.values(input.people).filter((person) => person.alive);
  const overlays: Raw[] = [];
  if (alive.length > 0) {
    const unemployed = alive.filter((person) => person.job === null).length;
    overlays.push({
      id: "unemployment",
      label: "unemployment",
      unit: "rate",
      month,
      value: unemployed / alive.length,
      order: 1000,
    });
  }
  const prices = pack(priced(rows, month));
  return {
    tracks: [
      ...track("price", prices),
      ...track("rate", pack(overlays)),
    ],
    absent: posted.size || seatedWage ? "" : "No wage was posted.",
    note: "",
  };
}

function housing(
  input: TapeInput,
  month: number,
  intent: readonly IntentRecord[],
  warnings: string[],
): PanelBody {
  const rows: Offer[] = [];
  let sawRent = false;
  let sawSale = false;
  for (const listing of input.listings) {
    if (listing.kind !== "rent" && listing.kind !== "houseSale") continue;
    const houseId = houseOf(listing.payload);
    const units = houseId ? input.houses[houseId]?.units : undefined;
    if (units === undefined) {
      warnings.push(`${listing.kind} ${listing.id || listing.seller} names no house`);
    }
    const size = units === undefined ? "" : ` · ${units} units`;
    const sale = listing.kind === "houseSale";
    if (sale) sawSale = true;
    else sawRent = true;
    rows.push({
      family: sale ? "house" : "rent",
      label: `${sale ? "sale" : "rent"}${size}`,
      row: sale ? "houseTrade" : "rent",
      order: (sale ? 100 : 0) + (units ?? 0),
      price: listing.price,
      qty: listing.qty,
      seller: listing.seller,
    });
  }
  const overlays: Raw[] = unsold(rows, month);
  overlays.push(...sold(input, month, rows, warnings));
  const alive = Object.values(input.people).filter((person) => person.alive);
  if (alive.length > 0) {
    overlays.push({
      id: "homeless",
      label: "homeless",
      unit: "count",
      month,
      value: alive.filter((person) => person.dwelling === null).length,
      order: 1000,
    });
  }
  const refusedRenewal =
    latest(intent).filter((row) =>
      row.status === "refused" && /rent|renew|evict/i.test(row.reason)
    ).length;
  if (refusedRenewal > 0) {
    overlays.push({
      id: "refused-renewal",
      label: "refused renewal",
      unit: "count",
      month,
      value: refusedRenewal,
      order: 1001,
    });
  }
  const missing = [
    sawRent ? "" : "rent",
    sawSale ? "" : "sale",
  ].filter((name) => name);
  return {
    tracks: [
      ...track("price", pack(priced(rows, month))),
      ...track("qty", pack(overlays.filter((row) => row.unit === "qty"))),
      ...track("count", pack(overlays.filter((row) => row.unit === "count"))),
    ],
    absent: missing.length ? `No posting for ${list(missing)}.` : "",
    note: "",
  };
}

function machines(input: TapeInput, month: number, warnings: string[]): PanelBody {
  const rows: Offer[] = [];
  let sawOre = false;
  for (const listing of input.listings) {
    if (listing.kind === "machine") {
      const payload = listing.payload;
      if (
        !payload || !("type" in payload) || !("generation" in payload) ||
        typeof payload.type !== "string" || typeof payload.generation !== "number"
      ) {
        warnings.push(
          `machine listing ${listing.id || listing.seller} has no generation`,
        );
        continue;
      }
      const order = payload.generation * 10 + careerOrder(payload.type);
      rows.push({
        family: "machine",
        label: `${payload.type} · g${payload.generation}`,
        row: "machinePurchase",
        order,
        price: listing.price,
        qty: listing.qty,
        seller: listing.seller,
      });
    } else if (listing.kind === "ore") {
      sawOre = true;
      rows.push({
        family: "ore",
        label: "ore",
        row: "ore",
        order: 10_000,
        price: listing.price,
        qty: listing.qty,
        seller: listing.seller,
      });
    }
  }
  const held = Object.values(input.machines)
    .map((machine) => ({ type: machine.type, generation: machine.generation }))
    .sort((a, b) => a.generation - b.generation || a.type.localeCompare(b.type));
  const note = held.length
    ? `The world holds ${
      held.map((machine) => `${machine.type} g${machine.generation}`).join(", ")
    }.`
    : "";
  const missing = [
    rows.some((row) => row.family === "machine") ? "" : "a machine",
    sawOre ? "" : "ore",
  ].filter((name) => name);
  return {
    tracks: [
      ...track("price", pack(priced(rows, month))),
      ...track(
        "qty",
        pack([...unsold(rows, month), ...sold(input, month, rows, warnings)]),
      ),
    ],
    absent: missing.length ? `No posting for ${list(missing)}.` : "",
    note,
  };
}

function capital(input: TapeInput, month: number, warnings: string[]): PanelBody {
  const rates: Raw[] = [];
  for (const id of ["a", "b"] as const) {
    const bank = input.banks[id];
    if (!bank) continue;
    rates.push({
      id: `rate-${id}`,
      label: `loan rate · ${id}`,
      unit: "rate",
      month,
      value: bank.loanRate,
      order: id === "a" ? 0 : 1,
    });
  }
  const rows: Offer[] = [];
  let sawMine = false;
  let sawDebt = false;
  for (const listing of input.listings) {
    if (listing.kind === "mine") {
      sawMine = true;
      rows.push({
        family: "mine",
        label: "mine land",
        row: "mineTrade",
        order: 0,
        price: listing.price,
        qty: listing.qty,
        seller: listing.seller,
      });
    } else if (listing.kind === "debt") {
      sawDebt = true;
      const issuer = issuerOf(listing);
      rows.push({
        family: "debt",
        label: `debt · ${issuer}`,
        row: "debtTrade",
        order: 10,
        price: listing.price,
        qty: listing.qty,
        seller: listing.seller,
      });
    }
  }
  const missing = [
    rates.length ? "" : "a loan rate",
    sawDebt ? "" : "a debt offer",
    sawMine ? "" : "mine land",
  ].filter((name) => name);
  return {
    tracks: [
      ...track("rate", pack(rates)),
      ...track("price", pack(priced(rows, month))),
      ...track(
        "qty",
        pack([...unsold(rows, month), ...sold(input, month, rows, warnings)]),
      ),
    ],
    absent: missing.length ? `No posting for ${list(missing)}.` : "",
    note: "",
  };
}

type Offer = {
  family: string;
  label: string;
  row: string;
  order: number;
  price: number;
  qty: number;
  seller: string;
};

type PanelBody = Pick<Panel, "tracks" | "absent" | "note">;

function consumerOffer(
  listing: Listing,
): { family: string; label: string; row: string; order: number } | null {
  if (listing.kind === "cure") {
    const disease = diseaseOf(listing.payload);
    if (!disease) return null;
    return {
      family: "private hospital",
      label: `private hospital · ${disease}`,
      row: "privateCure",
      order: 30,
    };
  }
  if (listing.kind !== "good") return null;
  const good = goodOf(listing.payload);
  if (good === "staple") {
    return { family: "staple", label: "staple", row: "staple", order: 0 };
  }
  if (good === "luxuryFood") {
    return { family: "luxury food", label: "luxury food", row: "luxuryFood", order: 10 };
  }
  if (good === "nightclub") {
    return { family: "nightclub", label: "nightclub", row: "nightclub", order: 20 };
  }
  const career = tuitionCareer(listing.payload);
  if (career) {
    return {
      family: "tuition",
      label: `tuition · ${career}`,
      row: "tuition",
      order: 40 + careerOrder(career),
    };
  }
  return null;
}

/** One series per label when the posted price agrees. Split by seller when it does not. */
function priced(rows: readonly Offer[], month: number): Raw[] {
  const out: Raw[] = [];
  for (const [label, group] of groups(rows, (row) => row.label)) {
    const prices = new Set(group.map((row) => row.price));
    if (prices.size <= 1) {
      out.push({
        id: slug(label),
        label,
        unit: "price",
        month,
        value: group[0].price,
        order: group[0].order,
      });
      continue;
    }
    group.forEach((row, index) => {
      const split = `${label} · ${row.seller}`;
      out.push({
        id: slug(split),
        label: split,
        unit: "price",
        month,
        value: row.price,
        order: row.order + index / 100,
      });
    });
  }
  return out;
}

function unsold(rows: readonly Offer[], month: number): Raw[] {
  const out: Raw[] = [];
  for (const [label, group] of groups(rows, (row) => row.label)) {
    const prices = new Set(group.map((row) => row.price));
    if (prices.size <= 1) {
      out.push({
        id: slug(`unsold ${label}`),
        label: `unsold ${label}`,
        unit: "qty",
        month,
        value: group.reduce((sum, row) => sum + row.qty, 0),
        order: group[0].order,
      });
      continue;
    }
    for (const row of group) {
      const split = `unsold ${label} · ${row.seller}`;
      out.push({
        id: slug(split),
        label: split,
        unit: "qty",
        month,
        value: row.qty,
        order: row.order,
      });
    }
  }
  return out;
}

function sold(
  input: TapeInput,
  month: number,
  rows: readonly Offer[],
  warnings: string[],
): Raw[] {
  const out: Raw[] = [];
  for (const [row, group] of groups(rows, (offer) => offer.row)) {
    const prices = new Set(group.map((offer) => offer.price));
    const paid = positive(input.flows, row, month);
    const label = `sold ${group[0].family}`;
    if (prices.size !== 1) {
      if (paid !== 0) {
        warnings.push(
          `${group[0].family} cleared ${paid} against more than one posted price`,
        );
      }
      continue;
    }
    const price = group[0].price;
    if (!Number.isInteger(price) || price <= 0) {
      warnings.push(`${group[0].family} is posted at ${price}`);
      continue;
    }
    if (paid === 0) {
      out.push({
        id: slug(label),
        label,
        unit: "qty",
        month,
        value: 0,
        order: group[0].order,
      });
      continue;
    }
    if (paid % price !== 0) {
      warnings.push(
        `${group[0].family} cleared ${paid}, which does not divide by ${price}`,
      );
      continue;
    }
    out.push({
      id: slug(label),
      label,
      unit: "qty",
      month,
      value: paid / price,
      order: group[0].order,
    });
  }
  return out;
}

function positive(flows: readonly FlowEntry[], row: string, month: number): number {
  return flows
    .filter((flow) => flow.row === row && flow.month === month && flow.amount > 0)
    .reduce((sum, flow) => sum + flow.amount, 0);
}

function shareAside(listing: Listing): string {
  const bank = shareBank(listing.payload);
  const where = bank ? `bank ${bank}` : listing.seller;
  return `share · ${where} posted at ${listing.price}`;
}

function issuerOf(listing: Listing): string {
  const payload = listing.payload;
  if (payload && "issuer" in payload && typeof payload.issuer === "string") {
    return payload.issuer;
  }
  return listing.seller;
}

function monthAxis(input: TapeInput, journal: readonly JournalEntry[]): number[] {
  const months = new Set<number>([input.month]);
  for (const entry of journal) months.add(entry.month);
  for (const flow of input.flows) months.add(flow.month);
  return [...months].sort((a, b) => a - b);
}

function marks(
  months: readonly number[],
  journal: readonly JournalEntry[],
  intent: readonly IntentRecord[],
): MonthMark[] {
  const outcomes = latest(intent);
  return months.map((month) => {
    const effects: string[] = [];
    for (const entry of journal) {
      if (entry.month !== month || effects.includes(entry.effect)) continue;
      effects.push(entry.effect);
    }
    const reasons = outcomes
      .filter((row) => row.month === month)
      .sort((a, b) => a.ts.localeCompare(b.ts))
      .map((row) => ({ agent: row.agent, status: row.status, reason: row.reason }));
    return {
      month,
      effects,
      refused: reasons.filter((row) => row.status === "refused").length,
      reasons,
    };
  });
}

function latest(intent: readonly IntentRecord[]): IntentRecord[] {
  const byCall = new Map<string, IntentRecord>();
  for (const row of intent) byCall.set(row.callId, row);
  return [...byCall.values()];
}

function track(unit: Unit, series: Series[]): Panel["tracks"] {
  const kept = series.filter((row) => row.unit === unit);
  return kept.length ? [{ unit, series: kept }] : [];
}

function pack(raw: readonly Raw[]): Series[] {
  const byId = new Map<string, Series & { order: number }>();
  for (const row of raw) {
    let series = byId.get(row.id);
    if (!series) {
      series = {
        id: row.id,
        label: row.label,
        unit: row.unit,
        points: [],
        order: row.order,
      };
      byId.set(row.id, series);
    }
    if (!series.points.some((point) => point.month === row.month)) {
      series.points.push({ month: row.month, value: row.value });
    }
  }
  return [...byId.values()]
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))
    .map((series) => ({
      id: series.id,
      label: series.label,
      unit: series.unit,
      points: series.points.sort((a, b) => a.month - b.month),
    }));
}

function groups<T>(rows: readonly T[], key: (row: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const row of rows) {
    const id = key(row);
    const got = out.get(id) ?? [];
    got.push(row);
    out.set(id, got);
  }
  return out;
}

function careerOrder(career: string): number {
  const index = CAREERS.indexOf(career);
  return index === -1 ? CAREERS.length : index;
}

function slug(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function list(names: readonly string[]): string {
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}`;
}

function worldOf(scene: string, raw: unknown): TapeInput {
  const world = record(scene, raw, "world");
  if (typeof world.month !== "number") fail(scene, "world.month is not a number");
  if (!Array.isArray(world.listings)) fail(scene, "world.listings is not a list");
  if (!Array.isArray(world.flows)) fail(scene, "world.flows is not a list");
  return {
    month: world.month,
    listings: world.listings.map((listing, index) => listingOf(scene, listing, index)),
    flows: world.flows.map((flow, index) => flowOf(scene, flow, index)),
    people: mapRecord(scene, world.people, "people", personOf),
    houses: mapRecord(scene, world.houses, "houses", houseOfTape),
    machines: mapRecord(scene, world.machines, "machines", machineOf),
    banks: mapRecord(scene, world.banks, "banks", bankOf),
  };
}

function listingOf(scene: string, raw: unknown, index: number): Listing {
  const listing = record(scene, raw, `listing ${index}`);
  if (typeof listing.kind !== "string" || typeof listing.price !== "number") {
    fail(scene, `listing ${index} has no kind or price`);
  }
  if (typeof listing.qty !== "number" || typeof listing.seller !== "string") {
    fail(scene, `listing ${index} has no qty or seller`);
  }
  const payload = listing.payload;
  if (payload !== null && (typeof payload !== "object" || Array.isArray(payload))) {
    fail(scene, `listing ${index} payload is not an object`);
  }
  return {
    id: typeof listing.id === "string" ? listing.id : "",
    seller: listing.seller,
    kind: listing.kind as Listing["kind"],
    price: listing.price,
    qty: listing.qty,
    payload: payload as Listing["payload"],
  };
}

function flowOf(scene: string, raw: unknown, index: number): FlowEntry {
  const flow = record(scene, raw, `flow ${index}`);
  if (
    typeof flow.month !== "number" || typeof flow.row !== "string" ||
    typeof flow.amount !== "number"
  ) {
    fail(scene, `flow ${index} is missing month, row, or amount`);
  }
  if (typeof flow.holder !== "string") fail(scene, `flow ${index} has no holder`);
  return {
    month: flow.month,
    row: flow.row as FlowEntry["row"],
    holder: flow.holder,
    amount: flow.amount,
  };
}

function personOf(scene: string, id: string, raw: unknown): TapePerson {
  const person = record(scene, raw, `person ${id}`);
  if (typeof person.alive !== "boolean") fail(scene, `person ${id} has no alive flag`);
  if (
    !("dwelling" in person) ||
    (person.dwelling !== null && typeof person.dwelling !== "string")
  ) {
    fail(scene, `person ${id} has no dwelling`);
  }
  if (!("job" in person)) fail(scene, `person ${id} has no job`);
  return {
    alive: person.alive,
    dwelling: person.dwelling,
    job: jobOf(scene, id, person.job),
  };
}

function jobOf(scene: string, id: string, raw: unknown): TapePerson["job"] {
  if (raw === null) return null;
  const job = record(scene, raw, `person ${id} job`);
  if (typeof job.career !== "string" || typeof job.salary !== "number") {
    fail(scene, `person ${id} job has no career or salary`);
  }
  return { career: job.career, salary: job.salary };
}

function houseOfTape(scene: string, id: string, raw: unknown): { units: number } {
  const house = record(scene, raw, `house ${id}`);
  if (typeof house.units !== "number") fail(scene, `house ${id} has no units`);
  return { units: house.units };
}

function machineOf(
  scene: string,
  id: string,
  raw: unknown,
): { type: string; generation: number } {
  const machine = record(scene, raw, `machine ${id}`);
  if (typeof machine.type !== "string" || typeof machine.generation !== "number") {
    fail(scene, `machine ${id} has no type or generation`);
  }
  return { type: machine.type, generation: machine.generation };
}

function bankOf(scene: string, id: string, raw: unknown): { loanRate: number } {
  const bank = record(scene, raw, `bank ${id}`);
  if (typeof bank.loanRate !== "number") fail(scene, `bank ${id} has no loan rate`);
  if (id !== "a" && id !== "b") fail(scene, `bank ${id} is not a or b`);
  return { loanRate: bank.loanRate };
}

function journalOf(scene: string, raw: unknown): JournalEntry[] {
  if (!Array.isArray(raw)) fail(scene, "journal is not a list");
  return raw.map((entry, index) => {
    const row = record(scene, entry, `journal ${index}`);
    if (typeof row.correlationId !== "string" || typeof row.month !== "number") {
      fail(scene, `journal ${index} has no correlation id or month`);
    }
    if (typeof row.ts !== "string" || typeof row.effect !== "string") {
      fail(scene, `journal ${index} has no ts or effect`);
    }
    if (row.source !== "agent" && row.source !== "engine") {
      fail(scene, `journal ${index} source is ${String(row.source)}`);
    }
    return {
      correlationId: row.correlationId,
      month: row.month,
      ts: row.ts,
      effect: row.effect as JournalEntry["effect"],
      source: row.source,
    };
  });
}

function intentOf(scene: string, raw: unknown): IntentRecord[] {
  if (!Array.isArray(raw)) fail(scene, "intent is not a list");
  const statuses: readonly IntentStatus[] = [
    "attempted",
    "ok",
    "rationed",
    "refused",
    "error",
  ];
  return raw.map((entry, index) => {
    const row = record(scene, entry, `intent ${index}`);
    if (
      typeof row.callId !== "string" || typeof row.month !== "number" ||
      typeof row.ts !== "string"
    ) {
      fail(scene, `intent ${index} has no call id, month, or ts`);
    }
    if (typeof row.agent !== "string" || typeof row.reason !== "string") {
      fail(scene, `intent ${index} has no agent or reason`);
    }
    if (
      typeof row.status !== "string" || !statuses.includes(row.status as IntentStatus)
    ) {
      fail(scene, `intent ${index} status is ${String(row.status)}`);
    }
    const correlationId = row.correlationId;
    if (correlationId !== null && typeof correlationId !== "string") {
      fail(scene, `intent ${index} correlation id is not a string`);
    }
    return {
      callId: row.callId,
      correlationId: correlationId ?? null,
      month: row.month,
      ts: row.ts,
      agent: row.agent,
      status: row.status as IntentStatus,
      reason: row.reason,
    };
  });
}

function mapRecord<T>(
  scene: string,
  raw: unknown,
  name: string,
  read: (scene: string, id: string, value: unknown) => T,
): Record<string, T> {
  const table = record(scene, raw, name);
  const out: Record<string, T> = {};
  for (const [id, value] of Object.entries(table)) out[id] = read(scene, id, value);
  return out;
}

function record(scene: string, raw: unknown, name: string): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    fail(scene, `${name} is not an object`);
  }
  return raw as Record<string, unknown>;
}

function fail(scene: string, message: string): never {
  throw new Error(`${scene}: ${message}`);
}
