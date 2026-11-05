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
  assignGate,
  buyCureGate,
  buyTuitionGate,
  cureGate,
  deliverMachineGate,
  depositMineGate,
  dividendGate,
  drawGate,
  fillGate,
  type GateResult,
  hireGate,
  issuePrivateGate,
  lendGate,
  levelUpGate,
  occupyGate,
  payGate,
  postCureGate,
  postHouseGate,
  postJobGate,
  postMachineGate,
  postMaterialGate,
  postRentGate,
  postShareGate,
  postTuitionGate,
  rentGate,
  repayGate,
  requestLoanGate,
  seizeGate,
  sellCapitalGate,
  setLoanRateGate,
  strategyGate,
  tradeShareGate,
  transferHouseGate,
  transferPrivateGate,
  writeOffGate,
} from "../world/gates.ts";
import { loadWorld, saveWorld } from "../world/store.ts";
import type {
  BankId,
  Career,
  Disease,
  Effect,
  FlowRow,
  Id,
  Qty,
} from "../world/types.ts";
import { CAREERS, DISEASES, FLOW_ROWS, isBankId } from "../world/types.ts";
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

function parseCareer(s: string | undefined): Career {
  if (!s || !(CAREERS as readonly string[]).includes(s)) {
    throw new Refusal(`unknown career ${s ?? ""}`);
  }
  return s as Career;
}

function parseDisease(s: string | undefined): Disease {
  if (!s || !(DISEASES as readonly string[]).includes(s)) {
    throw new Refusal(`unknown disease ${s ?? ""}`);
  }
  return s as Disease;
}

function parseBool(s: string | undefined, name: string): boolean {
  if (s === "true") return true;
  if (s === "false") return false;
  throw new Refusal(`${name} must be true or false`);
}

function parseLots(s: string | undefined): { listing: Id; qty: Qty }[] {
  if (s === undefined || s.trim() === "") return [{ listing: "", qty: 0 }];
  return s.split(",").map((part) => {
    const cut = part.lastIndexOf(":");
    if (cut < 0) throw new Refusal("lot must be listing:qty");
    const qty = parseIntStrict(part.slice(cut + 1), "qty");
    if (qty < 0) throw new Refusal("qty must be a non-negative integer");
    return { listing: part.slice(0, cut), qty };
  });
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

/** Several effects, one correlation id, one market answer. `filled` is what
 *  the intent log compares with `asked`. */
function commitMany(
  worldPath: string,
  journalPath: string,
  ids: IdSource,
  clock: Clock,
  flags: Parsed["flags"],
  effects: Effect[],
  asked: number,
): {
  committed: true;
  correlationId: string;
  effect: string;
  filled: number;
  asked: number;
} {
  const current = loadWorld(worldPath);
  let cursor = current;
  for (const effect of effects) cursor = applyEffect(cursor, effect);
  saveWorld(worldPath, cursor);
  const correlationId = str(flags, "corr") ?? ids.next();
  for (const effect of effects) {
    const entry: JournalEntry = {
      correlationId,
      month: current.month,
      ts: clock.now(),
      effect: effect.tag,
      source: "agent",
    };
    fileJournal(journalPath).append(entry);
  }
  const filled = effects.reduce((sum, effect) => {
    if (
      effect.tag === "tradeShare" || effect.tag === "transferHouse" ||
      effect.tag === "deliverMachine"
    ) return sum + effect.qty;
    if (effect.tag === "hire") return sum + (effect.seated ? 1 : 0);
    if (effect.tag === "rent") return sum + (effect.pay ? 1 : 0);
    if (effect.tag === "cure" || effect.tag === "levelUp") {
      return sum + (effect.granted ? 1 : 0);
    }
    if (effect.tag === "buyCure" || effect.tag === "buyTuition") return sum + effect.qty;
    return sum;
  }, 0);
  return {
    committed: true,
    correlationId,
    effect: effects[0]?.tag ?? "tradeShare",
    filled,
    asked,
  };
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
    case "draw": {
      const current = world();
      return {
        value: commit(
          "draw",
          drawGate(
            current,
            str(flags, "firm") ?? "",
            str(flags, "owner") ?? "",
            parseIntStrict(str(flags, "amount"), "amount"),
          ),
        ),
      };
    }
    case "fill": {
      reqReason(flags, "fill");
      const buyer = str(flags, "buyer") ?? "";
      const asked = parseIntStrict(str(flags, "asked") ?? "0", "asked");
      if (asked < 0) throw new Refusal("asked must be a non-negative integer");
      const lots = parseLots(str(flags, "lots"));
      let cursor = world();
      const effects: Effect[] = [];
      for (const lot of lots) {
        const gate = fillGate(cursor, lot.listing, buyer, lot.qty);
        if (!gate.ok) throw new Refusal(gate.reason);
        effects.push(gate.effect);
        cursor = applyEffect(cursor, gate.effect);
      }
      const month = world().month;
      saveWorld(worldPath, cursor);
      const correlationId = str(flags, "corr") ?? ids.next();
      for (const effect of effects) {
        const entry: JournalEntry = {
          correlationId,
          month,
          ts: clock.now(),
          effect: effect.tag,
          source: "agent",
        };
        fileJournal(journalPath).append(entry);
      }
      const filled = effects.reduce(
        (s, effect) => s + (effect.tag === "fill" ? effect.qty : 0),
        0,
      );
      return {
        value: { committed: true, correlationId, effect: "fill", filled, asked },
      };
    }
    case "sell-share": {
      const current = world();
      return {
        value: commit(
          "sell-share",
          postShareGate(
            current,
            str(flags, "seller") ?? "",
            parseBank(str(flags, "bank")),
            parseIntStrict(str(flags, "price"), "price"),
            parseIntStrict(str(flags, "qty"), "qty"),
          ),
        ),
      };
    }
    case "buy-share": {
      reqReason(flags, "buy-share");
      const buyer = str(flags, "buyer") ?? "";
      const asked = parseIntStrict(str(flags, "asked") ?? "0", "asked");
      if (asked < 0) throw new Refusal("asked must be a non-negative integer");
      const lots = parseLots(str(flags, "lots"));
      let cursor = world();
      const effects: Effect[] = [];
      for (const lot of lots) {
        const gate = tradeShareGate(cursor, lot.listing, buyer, lot.qty);
        if (!gate.ok) throw new Refusal(gate.reason);
        effects.push(gate.effect);
        cursor = applyEffect(cursor, gate.effect);
      }
      return {
        value: commitMany(worldPath, journalPath, ids, clock, flags, effects, asked),
      };
    }
    case "offer-house": {
      const current = world();
      return {
        value: commit(
          "offer-house",
          postHouseGate(
            current,
            str(flags, "owner") ?? "",
            str(flags, "house") ?? "",
            parseIntStrict(str(flags, "ask"), "ask"),
          ),
        ),
      };
    }
    case "buy-house": {
      reqReason(flags, "buy-house");
      const buyer = str(flags, "buyer") ?? "";
      const qty = parseIntStrict(str(flags, "qty"), "qty");
      const gate = transferHouseGate(world(), str(flags, "listing") ?? "", buyer, qty);
      if (!gate.ok) throw new Refusal(gate.reason);
      const asked = 1;
      return {
        value: commitMany(
          worldPath,
          journalPath,
          ids,
          clock,
          flags,
          [gate.effect],
          asked,
        ),
      };
    }
    case "occupy": {
      const mode = str(flags, "mode");
      if (mode !== "occupy" && mode !== "let") {
        throw new Refusal("mode must be occupy or let");
      }
      return {
        value: commit(
          "occupy",
          occupyGate(world(), str(flags, "owner") ?? "", str(flags, "house") ?? "", mode),
        ),
      };
    }
    case "post-job": {
      return {
        value: commit(
          "post-job",
          postJobGate(
            world(),
            str(flags, "firm") ?? "",
            parseCareer(str(flags, "career")),
            parseIntStrict(str(flags, "generation"), "generation"),
            parseIntStrict(str(flags, "salary"), "salary"),
            parseIntStrict(str(flags, "slots"), "slots"),
          ),
        ),
      };
    }
    case "hire": {
      reqReason(flags, "hire");
      const seated = parseBool(str(flags, "seated"), "seated");
      const keep = parseBool(str(flags, "keep"), "keep");
      const gate = hireGate(
        world(),
        str(flags, "listing") ?? "",
        str(flags, "person") ?? "",
        seated,
        keep,
      );
      if (!gate.ok) throw new Refusal(gate.reason);
      const asked = 1;
      return {
        value: commitMany(
          worldPath,
          journalPath,
          ids,
          clock,
          flags,
          [gate.effect],
          asked,
        ),
      };
    }
    case "post-machine": {
      return {
        value: commit(
          "post-machine",
          postMachineGate(
            world(),
            str(flags, "firm") ?? "",
            parseCareer(str(flags, "type")),
            parseIntStrict(str(flags, "generation"), "generation"),
            parseIntStrict(str(flags, "price"), "price"),
            parseIntStrict(str(flags, "qty"), "qty"),
          ),
        ),
      };
    }
    case "order-machine": {
      reqReason(flags, "order-machine");
      const asked = parseIntStrict(str(flags, "asked") ?? "0", "asked");
      const qty = parseIntStrict(str(flags, "qty"), "qty");
      const gate = deliverMachineGate(
        world(),
        str(flags, "listing") ?? "",
        str(flags, "firm") ?? "",
        qty,
      );
      if (!gate.ok) throw new Refusal(gate.reason);
      return {
        value: commitMany(
          worldPath,
          journalPath,
          ids,
          clock,
          flags,
          [gate.effect],
          asked,
        ),
      };
    }
    case "post-rent": {
      return {
        value: commit(
          "post-rent",
          postRentGate(
            world(),
            str(flags, "owner") ?? "",
            str(flags, "house") ?? "",
            parseIntStrict(str(flags, "rent"), "rent"),
          ),
        ),
      };
    }
    case "apply-rent": {
      reqReason(flags, "apply-rent");
      const pay = parseBool(str(flags, "pay"), "pay");
      const gate = rentGate(
        world(),
        str(flags, "listing") ?? "",
        str(flags, "tenant") ?? "",
        pay,
      );
      if (!gate.ok) throw new Refusal(gate.reason);
      return {
        value: commitMany(worldPath, journalPath, ids, clock, flags, [gate.effect], 1),
      };
    }
    case "assign": {
      const person = str(flags, "person") ?? "";
      const disease = str(flags, "disease");
      const career = str(flags, "career");
      if (disease && career) throw new Refusal("assign names a disease or a career");
      const specialty = disease
        ? parseDisease(disease)
        : career
        ? parseCareer(career)
        : null;
      return { value: commit("assign", assignGate(world(), person, specialty)) };
    }
    case "bid-cure": {
      reqReason(flags, "bid-cure");
      const granted = parseBool(str(flags, "granted"), "granted");
      const gate = cureGate(
        world(),
        str(flags, "person") ?? "",
        parseDisease(str(flags, "disease")),
        granted,
      );
      if (!gate.ok) throw new Refusal(gate.reason);
      return {
        value: commitMany(worldPath, journalPath, ids, clock, flags, [gate.effect], 1),
      };
    }
    case "bid-education": {
      reqReason(flags, "bid-education");
      const granted = parseBool(str(flags, "granted"), "granted");
      const gate = levelUpGate(
        world(),
        str(flags, "person") ?? "",
        parseCareer(str(flags, "career")),
        granted,
      );
      if (!gate.ok) throw new Refusal(gate.reason);
      return {
        value: commitMany(worldPath, journalPath, ids, clock, flags, [gate.effect], 1),
      };
    }
    case "post-cure": {
      return {
        value: commit(
          "post-cure",
          postCureGate(
            world(),
            str(flags, "firm") ?? "",
            parseDisease(str(flags, "disease")),
            parseIntStrict(str(flags, "price"), "price"),
            parseIntStrict(str(flags, "qty"), "qty"),
          ),
        ),
      };
    }
    case "post-tuition": {
      return {
        value: commit(
          "post-tuition",
          postTuitionGate(
            world(),
            str(flags, "firm") ?? "",
            parseCareer(str(flags, "career")),
            parseIntStrict(str(flags, "price"), "price"),
            parseIntStrict(str(flags, "qty"), "qty"),
          ),
        ),
      };
    }
    case "buy-cure": {
      reqReason(flags, "buy-cure");
      const qty = parseIntStrict(str(flags, "qty"), "qty");
      const asked = parseIntStrict(str(flags, "asked") ?? String(qty), "asked");
      const gate = buyCureGate(
        world(),
        str(flags, "person") ?? "",
        parseDisease(str(flags, "disease")),
        str(flags, "listing") ?? "",
        qty,
      );
      if (!gate.ok) throw new Refusal(gate.reason);
      return {
        value: commitMany(
          worldPath,
          journalPath,
          ids,
          clock,
          flags,
          [gate.effect],
          asked,
        ),
      };
    }
    case "strategy": {
      const mode = str(flags, "mode");
      if (mode !== "stay" && mode !== "expand" && mode !== "upgrade") {
        throw new Refusal("mode must be stay, expand, or upgrade");
      }
      return {
        value: commit(
          "strategy",
          strategyGate(world(), str(flags, "firm") ?? "", mode),
        ),
      };
    }
    case "buy-tuition": {
      reqReason(flags, "buy-tuition");
      const qty = parseIntStrict(str(flags, "qty"), "qty");
      const asked = parseIntStrict(str(flags, "asked") ?? String(qty), "asked");
      const gate = buyTuitionGate(
        world(),
        str(flags, "person") ?? "",
        parseCareer(str(flags, "career")),
        str(flags, "listing") ?? "",
        qty,
      );
      if (!gate.ok) throw new Refusal(gate.reason);
      return {
        value: commitMany(
          worldPath,
          journalPath,
          ids,
          clock,
          flags,
          [gate.effect],
          asked,
        ),
      };
    }

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
