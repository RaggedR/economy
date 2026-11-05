// live_test.ts — a model refusal is only in the intent log. A reply that
// invents a correlation id does not decode. A read is not asked of the model.

import { assertEquals, assertRejects } from "jsr:@std/assert@1";
import { fileIntentLog } from "../log/intentlog.ts";
import { fixedClock, seededIds } from "../log/ids.ts";
import type { Brain } from "../model/brain.ts";
import { monthSeed } from "../world/seed.ts";
import { householdLeaf } from "./household.ts";
import { openRig } from "./rig.ts";

const loan = {
  tag: "requestLoan" as const,
  bank: "a" as const,
  borrower: "ada",
  amount: 500,
  collateral: "h-ada",
  installment: 50,
  months: 10,
  reason: "ada borrows against her house",
};

function brain(reply: unknown): Brain & { calls: number } {
  const seen = { calls: 0, reply };
  return {
    calls: 0,
    reply() {
      seen.calls += 1;
      this.calls = seen.calls;
      return Promise.resolve(reply);
    },
  };
}

Deno.test("a model refusal is logged and not applied", async () => {
  const saying = brain({ tag: "refused", reason: "not this month" });
  const ctx = {
    ...openRig("demo-out/live-refuse", monthSeed(), seededIds("live"), fixedClock()),
    brain: saying,
  };
  const act = await householdLeaf(ctx, "ada").run(loan, 0);
  assertEquals(act, { tag: "refused", reason: "not this month" });
  assertEquals(saying.calls, 1);
  let journal = false;
  try {
    Deno.statSync("demo-out/live-refuse/journal.jsonl");
    journal = true;
  } catch {
    journal = false;
  }
  assertEquals(journal, false);
  const intent = fileIntentLog("demo-out/live-refuse/intent-log.jsonl").all();
  assertEquals(intent.map((r) => r.status), ["refused"]);
  assertEquals(intent[0].reason, "not this month");
  assertEquals(intent[0].correlationId, null);
});

Deno.test("a model-authored done does not decode and does not commit", async () => {
  const ctx = {
    ...openRig("demo-out/live-bad", monthSeed(), seededIds("live"), fixedClock()),
    brain: brain({ tag: "done", correlationId: "fake" }),
  };
  await assertRejects(
    () => householdLeaf(ctx, "ada").run(loan, 0),
    Error,
    "did not validate",
  );
  let journal = false;
  try {
    Deno.statSync("demo-out/live-bad/journal.jsonl");
    journal = true;
  } catch {
    journal = false;
  }
  assertEquals(journal, false);
});

Deno.test("a read is not asked of the model", async () => {
  const saying = brain({ tag: "commit" });
  const ctx = {
    ...openRig("demo-out/live-read", monthSeed(), seededIds("live"), fixedClock()),
    brain: saying,
  };
  const books = await householdLeaf(ctx, "ada").run({ tag: "readBooks" }, 0);
  assertEquals(books.tag, "read");
  assertEquals(saying.calls, 0);
});
