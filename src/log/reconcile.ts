// reconcile.ts — the auditor's join of the journal to the intent log.
//
// An alarm is a committed agent mutation with no recorded ok/rationed reason.
// Engine lines are excluded: they have no intent record, by spec. A blocked
// entry is a refusal, present only in the intent log. An ok intent that never
// reached the journal is the other alarm (the harness believed it landed).

import type { IntentLog, IntentRecord } from "./intentlog.ts";
import type { Journal, JournalEntry } from "./journal.ts";

export type Matched = {
  correlationId: string;
  effect: JournalEntry["effect"];
  agent: string;
};

export type Alarm =
  | { kind: "write-without-reason"; entry: JournalEntry }
  | { kind: "reason-without-write"; intent: IntentRecord };

export type ReconcileReport = {
  ok: boolean;
  matched: Matched[];
  blocked: IntentRecord[];
  alarms: Alarm[];
};

const LANDED: ReadonlySet<IntentRecord["status"]> = new Set(["ok", "rationed"]);

export function reconcile(journal: Journal, intentLog: IntentLog): ReconcileReport {
  const latest = [...intentLog.latestByCall().values()];
  const landedByCorr = new Map<string, IntentRecord>();
  for (const r of latest) {
    if (r.correlationId && LANDED.has(r.status)) {
      landedByCorr.set(r.correlationId, r);
    }
  }

  const matched: Matched[] = [];
  const alarms: Alarm[] = [];
  const agentEntries = journal.all().filter((e) => e.source === "agent");
  const journalCorrs = new Set(agentEntries.map((e) => e.correlationId));

  for (const e of agentEntries) {
    const intent = landedByCorr.get(e.correlationId);
    if (intent) {
      matched.push({
        correlationId: e.correlationId,
        effect: e.effect,
        agent: intent.agent,
      });
    } else {
      alarms.push({ kind: "write-without-reason", entry: e });
    }
  }

  for (const [corr, intent] of landedByCorr) {
    if (!journalCorrs.has(corr)) alarms.push({ kind: "reason-without-write", intent });
  }

  const blocked = latest.filter((r) => r.status === "refused");
  return { ok: alarms.length === 0, matched, blocked, alarms };
}

export function reconSummary(r: ReconcileReport): string {
  const head = r.ok ? "OK" : `${r.alarms.length} ALARM(S)`;
  return `reconciliation: ${head} — ${r.matched.length} matched, ` +
    `${r.blocked.length} blocked (refused, visible only in the intent log), ` +
    `${r.alarms.length} alarm(s)`;
}
