// intentlog.ts — Layer 2, the harness intent log. WHY, write-ahead.
//
// The command surface never writes this file. A mutation appends `attempted`
// before the command runs, then one outcome under the same callId. A refusal
// is visible only here.

export type IntentStatus = "attempted" | "ok" | "rationed" | "refused" | "error";

export type IntentRecord = {
  callId: string;
  correlationId: string | null;
  month: number;
  ts: string;
  agent: string;
  status: IntentStatus;
  reason: string;
};

export interface IntentLog {
  append(record: IntentRecord): void;
  all(): readonly IntentRecord[];
  /** Later lines overwrite earlier ones, so the outcome wins over `attempted`. */
  latestByCall(): Map<string, IntentRecord>;
}

function latest(entries: readonly IntentRecord[]): Map<string, IntentRecord> {
  const m = new Map<string, IntentRecord>();
  for (const e of entries) m.set(e.callId, e);
  return m;
}

export function memIntentLog(seed: readonly IntentRecord[] = []): IntentLog {
  const entries: IntentRecord[] = [...seed];
  return {
    append(r) {
      entries.push(r);
    },
    all: () => entries,
    latestByCall: () => latest(entries),
  };
}

export function fileIntentLog(path: string): IntentLog {
  const readAll = (): IntentRecord[] => {
    try {
      return Deno.readTextFileSync(path)
        .split("\n")
        .filter((l) => l.trim().length > 0)
        .map((l) => JSON.parse(l) as IntentRecord);
    } catch {
      return [];
    }
  };
  const mem = memIntentLog(readAll());
  return {
    append(r) {
      mem.append(r);
      Deno.writeTextFileSync(path, JSON.stringify(r) + "\n", { append: true });
    },
    all: () => mem.all(),
    latestByCall: () => mem.latestByCall(),
  };
}
