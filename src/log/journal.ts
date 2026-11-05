// journal.ts — Layer 1, the command surface's audit. WHAT committed, no reason.
//
// Append-only JSONL. A refusal never lands here. Engine writebacks land here
// with source "engine" and no intent record; agent commits land with source
// "agent". Reconciliation alarms only on the agent lines.

import type { Effect } from "../world/types.ts";

export type JournalSource = "agent" | "engine";

export type JournalEntry = {
  correlationId: string;
  month: number;
  ts: string;
  effect: Effect["tag"];
  source: JournalSource;
};

export interface Journal {
  append(entry: JournalEntry): void;
  all(): readonly JournalEntry[];
  recent(n: number): readonly JournalEntry[];
  trace(correlationId: string): JournalEntry | null;
}

export function memJournal(seed: readonly JournalEntry[] = []): Journal {
  const entries: JournalEntry[] = [...seed];
  return {
    append(e) {
      entries.push(e);
    },
    all: () => entries,
    recent(n) {
      return entries.slice(Math.max(0, entries.length - n));
    },
    trace(id) {
      return entries.find((e) => e.correlationId === id) ?? null;
    },
  };
}

export function fileJournal(path: string): Journal {
  const readAll = (): JournalEntry[] => {
    try {
      return Deno.readTextFileSync(path)
        .split("\n")
        .filter((l) => l.trim().length > 0)
        .map((l) => JSON.parse(l) as JournalEntry);
    } catch {
      return [];
    }
  };
  const mem = memJournal(readAll());
  return {
    append(e) {
      mem.append(e);
      Deno.writeTextFileSync(path, JSON.stringify(e) + "\n", { append: true });
    },
    all: () => mem.all(),
    recent: (n) => mem.recent(n),
    trace: (id) => mem.trace(id),
  };
}
