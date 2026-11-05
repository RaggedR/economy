// containers.ts — the fibres a leaf can be asked, and the decoders that make a
// raw reply into a position. A reply that does not decode is null. The leaf
// throws. Nothing here picks a default.

import type { Fib } from "../lib/algebra.ts";
import type { BooksReport } from "../world/books.ts";
import type { ReconcileReport } from "../log/reconcile.ts";
import type { BankId, Id, Money, Qty, Rate } from "../world/types.ts";

export type Act =
  | { tag: "done"; correlationId: string }
  | { tag: "rationed"; correlationId: string; filled: Qty }
  | { tag: "refused"; reason: string };

export type Read<T> = { tag: "read"; value: T };

export type LoanShape = {
  tag: "requestLoan";
  bank: BankId;
  borrower: Id;
  amount: Money;
  collateral: Id;
  installment: Money;
  months: number;
  reason: string;
};

export type HouseholdC =
  | Fib<LoanShape, Act>
  | Fib<{ tag: "readBooks" }, Read<BooksReport>>;

export type BankC =
  | Fib<{ tag: "postLoanRate"; bank: BankId; rate: Rate; reason: string }, Act>
  | Fib<
    {
      tag: "postMaterial";
      bank: BankId;
      mine: Id;
      price: Money;
      maxUnits: Qty;
      reason: string;
    },
    Act
  >
  | Fib<{ tag: "sellCapital"; bank: BankId; mine: Id; ask: Money; reason: string }, Act>;

export type AuditorC =
  | Fib<{ tag: "invariant" }, Read<BooksReport>>
  | Fib<{ tag: "reconcile" }, Read<ReconcileReport>>;

function isRecord(u: unknown): u is Record<string, unknown> {
  return typeof u === "object" && u !== null;
}

function isNum(u: unknown): u is number {
  return typeof u === "number" && Number.isFinite(u);
}

export function decodeAct(u: unknown): Act | null {
  if (!isRecord(u)) return null;
  if (u.tag === "done" && typeof u.correlationId === "string") {
    return { tag: "done", correlationId: u.correlationId };
  }
  if (
    u.tag === "rationed" && typeof u.correlationId === "string" &&
    isNum(u.filled) && Number.isInteger(u.filled) && u.filled >= 0
  ) {
    return { tag: "rationed", correlationId: u.correlationId, filled: u.filled };
  }
  if (u.tag === "refused" && typeof u.reason === "string") {
    return { tag: "refused", reason: u.reason };
  }
  return null;
}

const INSTRUMENTS = ["deposits", "loans", "privateLoans", "shares", "interbank"] as const;

export function decodeBooks(u: unknown): BooksReport | null {
  if (!isRecord(u)) return null;
  if (!isNum(u.month) || !isNum(u.moneySupply) || !isNum(u.interbank)) return null;
  if (!isRecord(u.instruments) || !Array.isArray(u.holders) || !isRecord(u.banks)) {
    return null;
  }
  for (const name of INSTRUMENTS) {
    if (!isNum(u.instruments[name])) return null;
  }
  for (const id of ["a", "b"] as const) {
    const bank = u.banks[id];
    if (!isRecord(bank) || !isNum(bank.equity) || !isNum(bank.depositLiability)) {
      return null;
    }
    if (!isNum(bank.loansOutstanding) || !isNum(bank.sharesOutstanding)) return null;
    if (!isNum(bank.loanRate) || !isNum(bank.losses)) return null;
  }
  return u as BooksReport;
}

export function decodeReconcile(u: unknown): ReconcileReport | null {
  if (!isRecord(u)) return null;
  if (typeof u.ok !== "boolean") return null;
  if (
    !Array.isArray(u.matched) || !Array.isArray(u.blocked) || !Array.isArray(u.alarms)
  ) {
    return null;
  }
  return u as ReconcileReport;
}

export function decodeRead<T>(
  decodeValue: (u: unknown) => T | null,
): (u: unknown) => Read<T> | null {
  return (u) => {
    if (!isRecord(u) || u.tag !== "read") return null;
    const value = decodeValue(u.value);
    if (value === null) return null;
    return { tag: "read", value };
  };
}
