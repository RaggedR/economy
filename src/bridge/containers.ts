// containers.ts — the fibres a leaf can be asked, and the decoders that make a
// raw reply into a position. A reply that does not decode is null. The leaf
// throws. Nothing here picks a default.

import type { Fib } from "../lib/algebra.ts";
import type { BooksReport } from "../world/books.ts";
import type { ReconcileReport } from "../log/reconcile.ts";
import type {
  BankId,
  Career,
  Disease,
  FlowRow,
  Good,
  Id,
  Money,
  Qty,
  Rate,
} from "../world/types.ts";

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

export type PayShape = {
  tag: "pay";
  to: Id;
  amount: Money;
  row: FlowRow;
  reason: string;
};

/** `lots` is the allocation already computed. It is not part of the interface
 *  shape. The leaf commits those lots and does not clear the book itself. */
export type BuyShape = {
  tag: "buy";
  good: Good;
  qty: Qty;
  seller?: Id;
  reason: string;
  lots: { listing: Id; qty: Qty }[];
};

/** The listing, the won flag, and the seated flag are the plan. The interface
 *  shapes do not carry them. The leaf commits the plan and does not clear. */
export type SellShareShape = {
  tag: "sellShare";
  bank: BankId;
  qty: Qty;
  price: Money;
  reason: string;
};

export type BuyShareShape = {
  tag: "buyShare";
  bank: BankId;
  qty: Qty;
  limit: Money;
  reason: string;
  lots: { listing: Id; qty: Qty }[];
};

export type OfferHouseShape = {
  tag: "offerHouse";
  house: Id;
  ask: Money;
  reason: string;
};

export type BuyHouseShape = {
  tag: "buyHouse";
  house: Id;
  listing: Id;
  won: boolean;
  reason: string;
};

export type OccupyShape = {
  tag: "occupyOrLet";
  house: Id;
  mode: "occupy" | "let";
  reason: string;
};

export type KeepJobShape = {
  tag: "keepJob";
  listing: Id;
  seated: boolean;
  reason: string;
};

export type ApplyJobShape = {
  tag: "applyJob";
  listing: Id;
  seated: boolean;
  reason: string;
};

export type PostRentShape = {
  tag: "postRent";
  house: Id;
  rent: Money;
  reason: string;
};

export type ApplyRentShape = {
  tag: "applyRent";
  house: Id;
  listing: Id;
  pay: boolean;
  reason: string;
};

/** `granted` is the lottery. It is not an interface field. */
export type BidCureShape = {
  tag: "bidCure";
  disease: Disease;
  granted: boolean;
  reason: string;
};

export type BidEducationShape = {
  tag: "bidEducation";
  career: Career;
  granted: boolean;
  reason: string;
};

/** `listing` and `qty` are the plan. The interface shape names the provider. */
export type BuyCureShape = {
  tag: "buyCure";
  disease: Disease;
  provider: Id;
  listing: Id;
  qty: Qty;
  reason: string;
};

export type BuyTuitionShape = {
  tag: "buyTuition";
  career: Career;
  provider: Id;
  listing: Id;
  qty: Qty;
  reason: string;
};

export type AcceptDebtShape = {
  tag: "acceptDebt";
  issuer: Id;
  principal: Money;
  installment: Money;
  months: number;
  issuerKind: "firm" | "government";
  reason: string;
};

export type HouseholdC =
  | Fib<LoanShape, Act>
  | Fib<PayShape, Act>
  | Fib<BuyShape, Act>
  | Fib<SellShareShape, Act>
  | Fib<BuyShareShape, Act>
  | Fib<OfferHouseShape, Act>
  | Fib<BuyHouseShape, Act>
  | Fib<OccupyShape, Act>
  | Fib<KeepJobShape, Act>
  | Fib<ApplyJobShape, Act>
  | Fib<PostRentShape, Act>
  | Fib<ApplyRentShape, Act>
  | Fib<BidCureShape, Act>
  | Fib<BidEducationShape, Act>
  | Fib<BuyCureShape, Act>
  | Fib<BuyTuitionShape, Act>
  | Fib<AcceptDebtShape, Act>
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
