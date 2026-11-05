// tape_test.ts — the reader. A price is a listing. A quantity is a flow that
// divides by that price. A refusal stays a refusal, and a short purse is not
// filed as a rent renewal unless the reason says so.

import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import { figure, renderPage } from "./html.ts";
import { loadScenes } from "./render.ts";
import { type Panel, parseScene, type Series, type TapeInput, tapeOf } from "./tape.ts";
import type { IntentRecord } from "../log/intentlog.ts";
import type { JournalEntry } from "../log/journal.ts";
import type { Listing } from "../world/types.ts";

function input(over: Partial<TapeInput> = {}): TapeInput {
  return {
    month: 0,
    listings: [],
    flows: [],
    people: {},
    houses: {},
    machines: {},
    banks: { a: { loanRate: 100 }, b: { loanRate: 105 } },
    ...over,
  };
}

function panel(tape: ReturnType<typeof tapeOf>, id: Panel["id"]): Panel {
  const found = tape.panels.find((row) => row.id === id);
  if (!found) throw new Error(`no ${id}`);
  return found;
}

function at(row: Panel, label: string): number | undefined {
  for (const track of row.tracks) {
    const series = track.series.find((item) => item.label === label);
    if (series) return series.points[0]?.value;
  }
  return undefined;
}

function listing(over: Partial<Listing> & Pick<Listing, "kind" | "price">): Listing {
  return {
    id: "l",
    seller: "shop",
    qty: 0,
    payload: null,
    ...over,
  };
}

Deno.test("staple price is the listing, and the flow divides into a quantity", () => {
  const tape = tapeOf(
    "market",
    input({
      listings: [listing({ kind: "good", price: 10, payload: { good: "staple" } })],
      flows: [
        { month: 0, row: "staple", holder: "ada", amount: -10 },
        { month: 0, row: "staple", holder: "shop", amount: 10 },
      ],
    }),
    [],
    [],
  );
  const consumer = panel(tape, "consumer");
  assertEquals(at(consumer, "staple"), 10);
  assertEquals(at(consumer, "unsold staple"), 0);
  assertEquals(at(consumer, "sold staple"), 1);
  assertEquals(consumer.absent.includes("staple"), false);
  assertEquals(consumer.absent.includes("nightclub"), true);
});

Deno.test("a flow that does not divide by the posted price is not a quantity", () => {
  const tape = tapeOf(
    "market",
    input({
      listings: [listing({ kind: "good", price: 3, payload: { good: "staple" } })],
      flows: [
        { month: 0, row: "staple", holder: "ada", amount: -10 },
        { month: 0, row: "staple", holder: "shop", amount: 10 },
      ],
    }),
    [],
    [],
  );
  assertEquals(at(panel(tape, "consumer"), "sold staple"), undefined);
  assertEquals(tape.warnings, ["staple cleared 10, which does not divide by 3"]);
});

Deno.test("two staple prices are not averaged", () => {
  const tape = tapeOf(
    "market",
    input({
      listings: [
        listing({
          id: "a",
          seller: "shop",
          kind: "good",
          price: 10,
          payload: { good: "staple" },
        }),
        listing({
          id: "b",
          seller: "mill",
          kind: "good",
          price: 12,
          payload: { good: "staple" },
        }),
      ],
      flows: [{ month: 0, row: "staple", holder: "shop", amount: 10 }],
    }),
    [],
    [],
  );
  const consumer = panel(tape, "consumer");
  assertEquals(at(consumer, "staple · shop"), 10);
  assertEquals(at(consumer, "staple · mill"), 12);
  assertEquals(at(consumer, "sold staple"), undefined);
  assertEquals(tape.warnings, ["staple cleared 10 against more than one posted price"]);
});

Deno.test("a short purse is refused, and it is not counted as a renewal", () => {
  const intent: IntentRecord[] = [
    line("c1", "attempted", "cleo has 70, short of 80", "08:00"),
    line("c1", "refused", "cleo has 70, short of 80", "08:01"),
  ];
  const tape = tapeOf("special", input(), journal("pay"), intent);
  assertEquals(tape.marks[0].refused, 1);
  assertEquals(tape.marks[0].reasons.length, 1);
  assertEquals(tape.marks[0].reasons[0].status, "refused");
  assertEquals(at(panel(tape, "housing"), "refused renewal"), undefined);
});

Deno.test("a reason that names the rent is the renewal count", () => {
  const tape = tapeOf(
    "special",
    input(),
    [],
    [line("c1", "refused", "the landlord refused the rent renewal", "08:00")],
  );
  assertEquals(at(panel(tape, "housing"), "refused renewal"), 1);
});

Deno.test("one special day posts wage, rent, sale, machine, and leaves the share off the panels", () => {
  const tape = tapeOf(
    "special",
    input({
      listings: [
        listing({
          kind: "job",
          price: 20,
          qty: 0,
          payload: { career: "retail", generation: 0, salary: 20, slots: 1 },
        }),
        listing({
          id: "rent",
          seller: "ben",
          kind: "rent",
          price: 80,
          qty: 1,
          payload: { house: "h-ben" },
        }),
        listing({
          id: "sale",
          seller: "cleo",
          kind: "houseSale",
          price: 30,
          qty: 0,
          payload: { house: "h-cleo" },
        }),
        listing({
          id: "machine",
          seller: "mill",
          kind: "machine",
          price: 10,
          qty: 0,
          payload: { type: "engineer", generation: 2 },
        }),
        listing({
          id: "share",
          seller: "ada",
          kind: "share",
          price: 10,
          qty: 0,
          payload: { bank: "a" },
        }),
      ],
      houses: { "h-ben": { units: 10 }, "h-cleo": { units: 20 } },
      machines: { m: { type: "engineer", generation: 2 } },
      flows: [
        { month: 0, row: "houseTrade", holder: "cleo", amount: 30 },
        { month: 0, row: "machinePurchase", holder: "mill", amount: 10 },
      ],
      people: {
        ada: { alive: true, dwelling: "h-ada", job: { career: "retail", salary: 20 } },
        ben: { alive: true, dwelling: null, job: null },
      },
    }),
    [],
    [],
  );
  assertEquals(at(panel(tape, "employment"), "wage · retail · g0"), 20);
  assertEquals(at(panel(tape, "employment"), "unemployment"), 0.5);
  assertEquals(at(panel(tape, "housing"), "rent · 10 units"), 80);
  assertEquals(at(panel(tape, "housing"), "sold rent"), 0);
  assertEquals(at(panel(tape, "housing"), "sale · 20 units"), 30);
  assertEquals(at(panel(tape, "housing"), "sold house"), 1);
  assertEquals(at(panel(tape, "housing"), "homeless"), 1);
  assertEquals(at(panel(tape, "machines"), "engineer · g2"), 10);
  assertEquals(at(panel(tape, "machines"), "sold machine"), 1);
  assertEquals(panel(tape, "machines").note, "The world holds engineer g2.");
  assertEquals(tape.aside, ["share · bank a posted at 10"]);
  assertEquals(
    panel(tape, "capital").tracks.some((track) =>
      track.series.some((series) => series.label.startsWith("share"))
    ),
    false,
  );
});

Deno.test("mine land and ore keep their panels, and the loan rate is the bank's", () => {
  const tape = tapeOf(
    "capital",
    input({
      listings: [
        listing({ seller: "a", kind: "mine", price: 40, qty: 1 }),
        listing({ seller: "a", kind: "ore", price: 6, qty: 3 }),
      ],
    }),
    [],
    [],
  );
  assertEquals(at(panel(tape, "capital"), "mine land"), 40);
  assertEquals(at(panel(tape, "capital"), "loan rate · a"), 100);
  assertEquals(at(panel(tape, "machines"), "ore"), 6);
  assertEquals(panel(tape, "capital").absent.includes("debt"), true);
});

Deno.test("a journal month with no posting is still on the axis", () => {
  const tape = tapeOf("month", input({ month: 1 }), journal("pay", 0), []);
  assertEquals(tape.months, [0, 1]);
});

Deno.test("parseScene rejects a journal line with no effect", () => {
  assertThrows(
    () => parseScene("x", input(), [{ correlationId: "c", month: 0 }], []),
    Error,
    "journal 0",
  );
});

Deno.test("the page escapes a reason and opens on the special scene", () => {
  const nasty = tapeOf(
    "market",
    input({
      listings: [listing({ kind: "good", price: 10, payload: { good: "staple" } })],
    }),
    [],
    [line("c1", "refused", "<script>alert(1)</script>", "08:00")],
  );
  const special = tapeOf("special", input(), [], []);
  const html = renderPage([nasty, special], { source: "demo-out" });
  assertEquals(html.includes("<script>alert"), false);
  assertEquals(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"), true);
  assertEquals(html.includes('value="special" selected'), true);
  for (const title of ["Consumer", "Employment", "Housing", "Machines", "Capital"]) {
    assertEquals(html.includes(title), true);
  }
  assertEquals(html.includes("separate seeds"), true);
});

Deno.test("unemployment renders as a share of the living", () => {
  const series: Series = {
    id: "unemployment",
    label: "unemployment",
    unit: "rate",
    points: [{ month: 0, value: 0.5 }],
  };
  assertEquals(figure(series, 0), "50%");
});

Deno.test("loadScenes reads a scene directory and skips a partial one", () => {
  const root = Deno.makeTempDirSync({ prefix: "econ-dash-" });
  Deno.mkdirSync(`${root}/market`);
  Deno.writeTextFileSync(
    `${root}/market/world.json`,
    JSON.stringify(input({
      listings: [listing({ kind: "good", price: 10, payload: { good: "staple" } })],
    })),
  );
  Deno.writeTextFileSync(`${root}/market/journal.jsonl`, "");
  Deno.writeTextFileSync(`${root}/market/intent-log.jsonl`, "");
  Deno.mkdirSync(`${root}/partial`);
  Deno.writeTextFileSync(`${root}/partial/world.json`, "{}");
  const tapes = loadScenes(root);
  assertEquals(tapes.map((tape) => tape.scene), ["market"]);
  assertEquals(at(panel(tapes[0], "consumer"), "staple"), 10);
});

function line(
  callId: string,
  status: IntentRecord["status"],
  reason: string,
  clock: string,
): IntentRecord {
  return {
    callId,
    correlationId: null,
    month: 0,
    ts: `2025-10-09T${clock}:00.000Z`,
    agent: "household:cleo",
    status,
    reason,
  };
}

function journal(effect: JournalEntry["effect"], month = 0): JournalEntry[] {
  return [{
    correlationId: "c",
    month,
    ts: "2025-10-09T08:00:00.000Z",
    effect,
    source: "engine",
  }];
}
