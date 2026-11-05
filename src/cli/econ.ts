// econ.ts — the one executable. Reads are free. Mutations require --reason and
// pass a gate before anything is written. The reason is not stored here. The
// journal line is appended only inside commit, after the reason check and the
// gate. Exit 0 on success, 1 on refusal.
//
// commit() is the agent door: source "agent". commitEngine is the worker's own
// writeback: source "engine", no reason, no intent line. It is not a command
// an agent can pass on argv.

import { booksReport } from "../world/books.ts";
import {
  depositMineGate,
  dividendGate,
  type GateResult,
  issuePrivateGate,
  lendGate,
  payGate,
  postMaterialGate,
  repayGate,
  requestLoanGate,
  seizeGate,
  sellCapitalGate,
  setLoanRateGate,
  transferPrivateGate,
  writeOffGate,
} from "../world/gates.ts";
import { loadWorld, saveWorld } from "../world/store.ts";
import type { BankId, Effect, FlowRow } from "../world/types.ts";
import { FLOW_ROWS, isBankId } from "../world/types.ts";
import { applyEffect } from "../world/world.ts";
import { fileJournal, type JournalEntry } from "../log/journal.ts";
import { fileIntentLog } from "../log/intentlog.ts";
import { reconcile } from "../log/reconcile.ts";
import { type Clock, type IdSource, realClock, realIds } from "../log/ids.ts";
import { Refusal } from "./refusal.ts";

type Parsed = { positional: string[]; flags: Record<string, string | boolean> };

function parseArgs(argv: string[]): Parsed {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      if (eq !== -1) {
        flags[a.slice(2, eq)] = a.slice(eq + 1);
      } else {
        const next = argv[i + 1];
        if (next !== undefined && !next.startsWith("--")) {
          flags[a.slice(2)] = next;
          i++;
        } else flags[a.slice(2)] = true;
      }
    } else positional.push(a);
  }
  return { positional, flags };
}

function str(flags: Parsed["flags"], key: string): string | undefined {
  const v = flags[key];
  return typeof v === "string" ? v : undefined;
}

function reqReason(flags: Parsed["flags"], command: string): string {
  const reason = str(flags, "reason");
  if (!reason || reason.trim() === "") {
    throw new Refusal(`${command} requires a non-empty --reason`);
  }
  return reason;
}

function parseIntStrict(s: string | undefined, name: string): number {
  if (s === undefined || !/^-?\d+$/.test(s)) {
    throw new Refusal(`${name} must be an integer`);
  }
  const n = Number(s);
  if (!Number.isSafeInteger(n)) throw new Refusal(`${name} must be an integer`);
  return n;
}

function parseBank(s: string | undefined): BankId {
  if (!s || !isBankId(s)) throw new Refusal("bank must be a or b");
  return s;
}

function parseRow(s: string | undefined): FlowRow {
  if (!s || !(FLOW_ROWS as readonly string[]).includes(s)) {
    throw new Refusal(`unknown flow row ${s ?? ""}`);
  }
  return s as FlowRow;
}

export type EconPaths = { world: string; journal: string };

/** Engine writeback. No reason, no intent record. */
export function commitEngine(
  paths: EconPaths,
  effect: Effect,
  ids: IdSource,
  clock: Clock,
): { correlationId: string } {
  const world = loadWorld(paths.world);
  const next = applyEffect(world, effect);
  saveWorld(paths.world, next);
  const correlationId = ids.next();
  const entry: JournalEntry = {
    correlationId,
    month: world.month,
    ts: clock.now(),
    effect: effect.tag,
    source: "engine",
  };
  fileJournal(paths.journal).append(entry);
  return { correlationId };
}

function run(argv: string[], ids: IdSource, clock: Clock): { value: unknown } {
  const { positional, flags } = parseArgs(argv);
  const worldPath = str(flags, "world") ?? "world.json";
  const journalPath = str(flags, "journal") ?? "journal.jsonl";
  const intentPath = str(flags, "intent") ?? "intent-log.jsonl";
  const [group, sub, ...rest] = positional;

  const world = () => loadWorld(worldPath);

  // The reason is checked and then dropped. It is not a field of the entry.
  const commit = (command: string, gate: GateResult): unknown => {
    reqReason(flags, command);
    if (!gate.ok) throw new Refusal(gate.reason);
    const current = world();
    const next = applyEffect(current, gate.effect);
    saveWorld(worldPath, next);
    const correlationId = str(flags, "corr") ?? ids.next();
    const entry: JournalEntry = {
      correlationId,
      month: current.month,
      ts: clock.now(),
      effect: gate.effect.tag,
      source: "agent",
    };
    fileJournal(journalPath).append(entry);
    return { committed: true, correlationId, effect: gate.effect.tag };
  };

  switch (group) {
    case "books":
      return { value: booksReport(world()) };
    case "reconcile":
      return { value: reconcile(fileJournal(journalPath), fileIntentLog(intentPath)) };
    case "journal": {
      const jrnl = fileJournal(journalPath);
      if (sub === "recent") {
        const n = parseIntStrict(str(flags, "n") ?? "10", "--n");
        if (n < 0) throw new Refusal("--n must be a non-negative integer");
        return { value: jrnl.recent(n) };
      }
      if (sub === "trace") {
        const corr = rest[0] ?? str(flags, "corr");
        if (!corr) throw new Refusal("journal trace needs a correlation id");
        const entry = jrnl.trace(corr);
        if (!entry) throw new Refusal(`no journal entry for ${corr}`);
        return { value: entry };
      }
      throw new Refusal(`unknown journal command: ${sub ?? "(none)"}`);
    }
    case "pay": {
      const current = world();
      return {
        value: commit(
          "pay",
          payGate(
            current,
            str(flags, "from") ?? "",
            str(flags, "to") ?? "",
            parseIntStrict(str(flags, "amount"), "amount"),
            parseRow(str(flags, "row")),
          ),
        ),
      };
    }
    case "lend": {
      const current = world();
      return {
        value: commit(
          "lend",
          lendGate(
            current,
            parseBank(str(flags, "bank")),
            str(flags, "borrower") ?? "",
            parseIntStrict(str(flags, "amount"), "amount"),
            str(flags, "collateral") ?? "",
            parseIntStrict(str(flags, "installment"), "installment"),
            parseIntStrict(str(flags, "months"), "months"),
          ),
        ),
      };
    }
    case "repay": {
      const current = world();
      return {
        value: commit(
          "repay",
          repayGate(
            current,
            str(flags, "loan") ?? "",
            parseIntStrict(str(flags, "amount"), "amount"),
          ),
        ),
      };
    }
    case "request-loan": {
      const current = world();
      return {
        value: commit(
          "request-loan",
          requestLoanGate(
            current,
            parseBank(str(flags, "bank")),
            str(flags, "borrower") ?? "",
            parseIntStrict(str(flags, "amount"), "amount"),
            str(flags, "collateral") ?? "",
            parseIntStrict(str(flags, "installment"), "installment"),
            parseIntStrict(str(flags, "months"), "months"),
          ),
        ),
      };
    }
    case "post-rate": {
      const current = world();
      return {
        value: commit(
          "post-rate",
          setLoanRateGate(
            current,
            parseBank(str(flags, "bank")),
            parseIntStrict(str(flags, "rate"), "rate"),
          ),
        ),
      };
    }
    case "post-material": {
      const current = world();
      return {
        value: commit(
          "post-material",
          postMaterialGate(
            current,
            parseBank(str(flags, "bank")),
            str(flags, "mine") ?? "",
            parseIntStrict(str(flags, "price"), "price"),
            parseIntStrict(str(flags, "max-units"), "maxUnits"),
          ),
        ),
      };
    }
    case "sell-capital": {
      const current = world();
      return {
        value: commit(
          "sell-capital",
          sellCapitalGate(
            current,
            parseBank(str(flags, "bank")),
            str(flags, "mine") ?? "",
            parseIntStrict(str(flags, "ask"), "ask"),
          ),
        ),
      };
    }
    case "issue-private":
    case "issue-debt": {
      const current = world();
      const kind = str(flags, "issuer-kind");
      if (kind !== "firm" && kind !== "government") {
        throw new Refusal("issuer-kind must be firm or government");
      }
      return {
        value: commit(
          group,
          issuePrivateGate(
            current,
            str(flags, "issuer") ?? "",
            str(flags, "holder") ?? "",
            parseIntStrict(str(flags, "principal"), "principal"),
            parseIntStrict(str(flags, "installment"), "installment"),
            parseIntStrict(str(flags, "months"), "months"),
            kind,
          ),
        ),
      };
    }
    case "transfer-private": {
      const current = world();
      return {
        value: commit(
          "transfer-private",
          transferPrivateGate(
            current,
            str(flags, "instrument") ?? "",
            str(flags, "from") ?? "",
            str(flags, "to") ?? "",
            parseIntStrict(str(flags, "price"), "price"),
          ),
        ),
      };
    }
    case "write-off": {
      return {
        value: commit("write-off", writeOffGate(world(), str(flags, "instrument") ?? "")),
      };
    }
    case "deposit-mine": {
      const current = world();
      return {
        value: commit(
          "deposit-mine",
          depositMineGate(
            current,
            str(flags, "mine") ?? "",
            parseBank(str(flags, "bank")),
            parseIntStrict(str(flags, "shares"), "shares"),
          ),
        ),
      };
    }
    case "dividend":
      return {
        value: commit("dividend", dividendGate(world(), parseBank(str(flags, "bank")))),
      };
    case "seize":
      return { value: commit("seize", seizeGate(world(), str(flags, "loan") ?? "")) };

    default:
      throw new Refusal(
        `unknown command: ${group ?? "(none)"}. ` +
          `try: books | reconcile | journal | pay | lend | repay | request-loan | ` +
          `post-rate | post-material | sell-capital`,
      );
  }
}

function main() {
  try {
    const { value } = run(Deno.args, realIds(), realClock());
    console.log(JSON.stringify(value, null, 2));
    Deno.exit(0);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`refused: ${msg}`);
    Deno.exit(1);
  }
}

if (import.meta.main) main();

export { run };
