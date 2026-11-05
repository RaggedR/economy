// reconcile_test.ts — engine lines are quiet. An agent line with no reason alarms.
// A refusal is blocked, and it is not an alarm.

import { assertEquals } from "jsr:@std/assert@1";
import { type JournalEntry, memJournal } from "./journal.ts";
import { type IntentRecord, memIntentLog } from "./intentlog.ts";
import { reconcile } from "./reconcile.ts";

const agent = (correlationId: string): JournalEntry => ({
  correlationId,
  month: 0,
  ts: "t",
  effect: "pay",
  source: "agent",
});

const engine = (correlationId: string): JournalEntry => ({
  correlationId,
  month: 0,
  ts: "t",
  effect: "pay",
  source: "engine",
});

const intent = (
  correlationId: string | null,
  status: IntentRecord["status"],
  reason = "because",
): IntentRecord => ({
  callId: `c-${correlationId}-${status}`,
  correlationId,
  month: 0,
  ts: "t",
  agent: "household:ada",
  status,
  reason,
});

Deno.test("an engine wage with no intent record does not alarm", () => {
  const r = reconcile(memJournal([engine("W")]), memIntentLog([]));
  assertEquals(r.ok, true);
  assertEquals(r.alarms.length, 0);
  assertEquals(r.matched.length, 0);
});

Deno.test("an agent line with no intent record alarms", () => {
  const r = reconcile(memJournal([agent("ROGUE")]), memIntentLog([]));
  assertEquals(r.ok, false);
  assertEquals(r.alarms[0].kind, "write-without-reason");
});

Deno.test("a matched loan is quiet, and a refusal is blocked", () => {
  const r = reconcile(
    memJournal([agent("C1"), engine("W")]),
    memIntentLog([
      intent("C1", "attempted"),
      intent("C1", "ok"),
      intent("C2", "attempted", "ben asks"),
      intent("C2", "refused", "LTV"),
    ]),
  );
  assertEquals(r.ok, true);
  assertEquals(r.matched.length, 1);
  assertEquals(r.blocked.length, 1);
  assertEquals(r.blocked[0].reason, "LTV");
});

Deno.test("an ok intent that never reached the journal alarms", () => {
  const r = reconcile(memJournal([]), memIntentLog([intent("C3", "ok")]));
  assertEquals(r.ok, false);
  assertEquals(r.alarms[0].kind, "reason-without-write");
});

Deno.test("an error with no journal line is not an alarm and not a block", () => {
  const r = reconcile(memJournal([]), memIntentLog([intent("C4", "error")]));
  assertEquals(r.ok, true);
  assertEquals(r.blocked.length, 0);
  assertEquals(r.alarms.length, 0);
});
