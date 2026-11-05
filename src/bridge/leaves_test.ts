// leaves_test.ts — the decoder throws on an out-of-union reply. The bank is
// fenced to its own id. The household's failing loan is only in the intent log.

import { assertEquals, assertRejects } from "jsr:@std/assert@1";
import { type Fib, leafLocal } from "../lib/algebra.ts";
import { fixedClock, seededIds } from "../log/ids.ts";
import { fileJournal } from "../log/journal.ts";
import { monthSeed } from "../world/seed.ts";
import { loadWorld } from "../world/store.ts";
import { nextLoanRate, nextOrePrice } from "../world/policy.ts";
import { bankLeaf } from "./bank.ts";
import { type Act, decodeAct } from "./containers.ts";
import { householdLeaf } from "./household.ts";
import { openRig } from "./rig.ts";

Deno.test("a decoder rejects an out-of-union reply and does not coerce it", async () => {
  type Probe = Fib<{ tag: "ping" }, Act>;
  const bad = leafLocal<Probe>("probe", () => ({ tag: "nope" }), { ping: decodeAct });
  await assertRejects(
    () => bad.run({ tag: "ping" }, 0),
    Error,
    "probe/ping: reply did not validate",
  );

  const half = leafLocal<Probe>("probe", () => ({ tag: "done" }), { ping: decodeAct });
  await assertRejects(() => half.run({ tag: "ping" }, 0), Error, "did not validate");

  const refused = leafLocal<Probe>(
    "probe",
    () => ({ tag: "refused", reason: "no" }),
    { ping: decodeAct },
  );
  assertEquals(await refused.run({ tag: "ping" }, 0), { tag: "refused", reason: "no" });
});

Deno.test("bank a cannot post bank b's rate", async () => {
  const dir = Deno.makeTempDirSync({ prefix: "econ-bank-" });
  try {
    const ctx = openRig(dir, monthSeed(), seededIds("bank"), fixedClock());
    const bank = bankLeaf(ctx, "a");
    const act = await bank.run(
      { tag: "postLoanRate", bank: "b", rate: 90, reason: "reaching across" },
      0,
    );
    assertEquals(act.tag, "refused");
    if (act.tag === "refused") {
      assertEquals(act.reason, "bank a cannot post bank b's rate");
    }
    assertEquals(ctx.intentLog.all().map((r) => r.status), ["refused"]);
    assertEquals(loadWorld(ctx.worldPath).banks.b.loanRate, 105);
    assertThrowsMissing(ctx.journalPath);
  } finally {
    Deno.removeSync(dir, { recursive: true });
  }
});

Deno.test("the bank posts the rate and the ore price it was handed", async () => {
  const dir = Deno.makeTempDirSync({ prefix: "econ-post-" });
  try {
    const ctx = openRig(dir, monthSeed(), seededIds("bank"), fixedClock());
    const world = loadWorld(ctx.worldPath);
    const rate = nextLoanRate(world, "a");
    const price = nextOrePrice(world, "a", "common");
    const bank = bankLeaf(ctx, "a");
    const posted = await bank.run(
      { tag: "postLoanRate", bank: "a", rate, reason: "one step toward bank b" },
      0,
    );
    assertEquals(posted.tag, "done");
    assertEquals(loadWorld(ctx.worldPath).banks.a.loanRate, rate);
    const ore = await bank.run(
      {
        tag: "postMaterial",
        bank: "a",
        mine: "m1",
        price,
        maxUnits: 5,
        reason: "ore from the reference, this bank's mine",
      },
      0,
    );
    assertEquals(ore.tag, "done");
    const listing = loadWorld(ctx.worldPath).listings[0];
    assertEquals(listing.kind, "ore");
    assertEquals(listing.price, price);
    assertEquals(listing.seller, "a");
    const journal = fileJournal(ctx.journalPath).all();
    assertEquals(journal.map((e) => e.effect), ["setLoanRate", "post"]);
    assertEquals(journal.every((e) => e.source === "agent"), true);
  } finally {
    Deno.removeSync(dir, { recursive: true });
  }
});

Deno.test("a loan past LTV is refused only in the intent log", async () => {
  const dir = Deno.makeTempDirSync({ prefix: "econ-ltv-" });
  try {
    const ctx = openRig(dir, monthSeed(), seededIds("house"), fixedClock());
    const ada = householdLeaf(ctx, "ada");
    const ben = householdLeaf(ctx, "ben");
    const ok = await ada.run(
      {
        tag: "requestLoan",
        bank: "a",
        borrower: "ada",
        amount: 500,
        collateral: "h-ada",
        installment: 50,
        months: 10,
        reason: "ada borrows against her house",
      },
      0,
    );
    assertEquals(ok.tag, "done");
    const no = await ben.run(
      {
        tag: "requestLoan",
        bank: "a",
        borrower: "ben",
        amount: 600,
        collateral: "h-ben",
        installment: 60,
        months: 10,
        reason: "ben asks for more than the house will secure",
      },
      0,
    );
    assertEquals(no.tag, "refused");
    if (no.tag === "refused") assertEquals(no.reason.includes("LTV"), true);
    const lines = ctx.intentLog.all();
    const benLines = lines.filter((r) => r.agent === "household:ben");
    assertEquals(benLines.map((r) => r.status), ["attempted", "refused"]);
    assertEquals(benLines[0].callId, benLines[1].callId);
    const journal = fileJournal(ctx.journalPath).all();
    assertEquals(journal.map((e) => e.effect), ["lendBank"]);
    const loans = Object.values(loadWorld(ctx.worldPath).loans);
    assertEquals(loans.length, 1);
    assertEquals(loans[0].kind === "bank" && loans[0].borrower, "ada");
  } finally {
    Deno.removeSync(dir, { recursive: true });
  }
});

function assertThrowsMissing(path: string): void {
  let missing = false;
  try {
    Deno.statSync(path);
  } catch {
    missing = true;
  }
  assertEquals(missing, true);
}
