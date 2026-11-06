// types.ts — the world, from interfaces.tex Part II, plus the completions
// PLAN.md records so the five-row invariant can fail: three counters on Bank,
// and source/ts on the journal (the journal type itself lives in log/journal.ts).
//
// Money is an integer number of minor units. A float is not a value here.

export type Money = number;
export type Qty = number;
export type Id = string;
/** Integer rate units. The scripted bank steps by `params.rateStep`. */
export type Rate = number;

export type BankId = "a" | "b";

export type Career =
  | "teacher"
  | "doctor"
  | "bureaucrat"
  | "retail"
  | "hospitality"
  | "engineer";

export type MachineType = Career;
export type Material = "common" | "advanced";
export type Disease = "d0" | "d1" | "d2" | "d3" | "d4";

export const DISEASES: readonly Disease[] = ["d0", "d1", "d2", "d3", "d4"];

export function isDisease(id: string): id is Disease {
  return (DISEASES as readonly string[]).includes(id);
}

export type FirmKind =
  | "supermarket"
  | "luxury"
  | "nightclub"
  | "privateHospital"
  | "privateUniversity"
  | "publicHospital"
  | "publicUniversity"
  | "tech";

export type Objective =
  | "happiness"
  | "health"
  | "education"
  | "savings"
  | "investment";

export type Specialty = Disease;

export type FlowRow =
  | "wages"
  | "staple"
  | "luxuryFood"
  | "nightclub"
  | "tuition"
  | "privateCure"
  | "rent"
  | "ore"
  | "machinePurchase"
  | "maintenance"
  | "tax"
  | "bankInterest"
  | "bankPrincipal"
  | "privateInstallment"
  | "profitDraw"
  | "dividend"
  | "houseTrade"
  | "mineTrade"
  | "debtTrade"
  | "shareTrade"
  | "writeOff"
  | "estate";

/** A signed line. The sum of a holder's lines equals that holder's ΔNFA. */
export type FlowEntry = {
  month: number;
  row: FlowRow | `Δ${string}`;
  holder: Id;
  amount: Money;
};

export type Deposits = Record<BankId, Money>;

export type RngState = { seed: number; stream: number };

export type Person = {
  id: Id;
  alive: boolean;
  objective: Objective;
  health: number;
  happiness: number;
  education: Record<Career, number>;
  diseases: Disease[];
  /** What a public doctor or teacher is pointed at this month. Null is unassigned. */
  assignment: Disease | Career | null;
  starvation: number;
  job: { firm: Id; career: Career; salary: Money } | null;
  dwelling: Id | null;
  parent: Id | null;
  children: Id[];
  firm: Id | null;
  deposits: Deposits;
};

export type Firm = {
  id: Id;
  kind: FirmKind;
  owner: Id;
  deposits: Deposits;
  machines: Id[];
  inventory: Record<string, Qty>;
  salesLastMonth: Qty;
  taxOwed: Money;
  /** Set by the fold. A missing builder firm is not how "folded" is written. */
  folded: boolean;
};

export type Machine = {
  id: Id;
  type: MachineType;
  generation: number;
  owner: Id;
  builder: Id;
};

export type House = {
  id: Id;
  units: number;
  owner: Id;
  occupant: Id | null;
  lien: Id | null;
};

export type Mine = {
  id: Id;
  material: Material;
  stock: Qty;
  owner: Id;
  depositedAt: BankId | null;
  lien: Id | null;
};

export type BankLoan = {
  kind: "bank";
  id: Id;
  bank: BankId;
  borrower: Id;
  principal: Money;
  installment: Money;
  months: number;
  collateral: Id;
};

export type PrivateLoan = {
  kind: "private";
  id: Id;
  issuer: Id;
  holder: Id;
  principal: Money;
  installment: Money;
  months: number;
  issuerKind: "firm" | "government";
};

export type Loan = BankLoan | PrivateLoan;

export type Share = {
  id: Id;
  bank: BankId;
  holder: Id;
  units: Qty;
};

export type Bank = {
  id: BankId;
  loanRate: Rate;
  equity: Money;
  losses: Money;
  /** Negative. Equals minus the deposits held at this bank. */
  depositLiability: Money;
  /** Equals the sum of this bank's loan principals. */
  loansOutstanding: Money;
  /** Equals the units of this bank's share records. */
  sharesOutstanding: Qty;
};

export type Government = {
  id: Id;
  deposits: Deposits;
  taxLastMonth: Money;
  salaryBill: Money;
};

export type JobPayload = {
  career: Career;
  generation: number;
  salary: Money;
  slots: number;
};

export type DebtOffer = {
  issuer: Id;
  principal: Money;
  installment: Money;
  months: number;
};

export type MachineOffer = {
  type: MachineType;
  generation: number;
};

/** Which bank's shares a listing sells. The interface payload union has no
 *  share. A holder can own both banks, so the bank is not implied by the seller. */
export type ShareOffer = { bank: BankId };

/** The house a sale or a tenancy names. An owner can hold more than one. */
export type HouseOffer = { house: Id };

/** The interface's payload union has no good. A good listing carries this and
 *  nothing else, so staple is not stored in a spare field of another offer.
 *  Tuition names a career. The other goods do not. */
export type Good = "staple" | "luxuryFood" | "nightclub" | "tuition";

/** The goods that post as a plain shelf lot, without the tuition career tag.
 *  These are the ones a firm produces continuously. */
export type ShelfGood = "staple" | "luxuryFood" | "nightclub";

export type GoodOffer =
  | { good: ShelfGood }
  | { good: "tuition"; career: Career };

/** A private-hospital cure. Ten units of one disease. A cure is not a Good. */
export type CureOffer = { disease: Disease };

export function goodOf(payload: Listing["payload"]): Good | null {
  if (!payload || !("good" in payload)) return null;
  const good = payload.good;
  if (
    good === "staple" || good === "luxuryFood" || good === "nightclub" ||
    good === "tuition"
  ) {
    return good;
  }
  return null;
}

/** Staple, luxury food, and the nightclub. Tuition and cures have their own gates. */
export function consumptionGood(
  payload: Listing["payload"],
): "staple" | "luxuryFood" | "nightclub" | null {
  const good = goodOf(payload);
  if (good === "staple" || good === "luxuryFood" || good === "nightclub") return good;
  return null;
}

export type Listing = {
  id: Id;
  seller: Id;
  kind:
    | "good"
    | "ore"
    | "machine"
    | "job"
    | "houseSale"
    | "rent"
    | "mine"
    | "debt"
    | "share"
    | "cure";
  price: Money;
  qty: Qty;
  payload:
    | JobPayload
    | DebtOffer
    | MachineOffer
    | GoodOffer
    | ShareOffer
    | HouseOffer
    | CureOffer
    | null;
};

export function shareBank(payload: Listing["payload"]): BankId | null {
  if (!payload || !("bank" in payload)) return null;
  return payload.bank === "a" || payload.bank === "b" ? payload.bank : null;
}

export function houseOf(payload: Listing["payload"]): Id | null {
  if (!payload || !("house" in payload)) return null;
  return typeof payload.house === "string" ? payload.house : null;
}

export function diseaseOf(payload: Listing["payload"]): Disease | null {
  if (!payload || !("disease" in payload)) return null;
  return isDisease(payload.disease) ? payload.disease : null;
}

export function tuitionCareer(payload: Listing["payload"]): Career | null {
  if (!payload || !("good" in payload) || payload.good !== "tuition") return null;
  if (!("career" in payload)) return null;
  return (CAREERS as readonly string[]).includes(payload.career) ? payload.career : null;
}

export type StandingOrder = {
  firm: Id;
  material: Material;
  qtyRemaining: Qty;
  limit: Money;
  nextBid: Money;
};

export type JobArchive = {
  year: number;
  listings: { career: Career; generation: number; salary: Money; slots: number }[];
};

export type World = {
  month: number;
  nextId: number;
  rng: RngState;
  people: Record<Id, Person>;
  firms: Record<Id, Firm>;
  houses: Record<Id, House>;
  mines: Record<Id, Mine>;
  machines: Record<Id, Machine>;
  loans: Record<Id, Loan>;
  shares: Record<Id, Share>;
  banks: Record<BankId, Bank>;
  /** Claim of "a" on "b". Negative when "b" claims on "a". */
  interbank: Money;
  government: Government;
  listings: Listing[];
  standing: StandingOrder[];
  jobArchive: JobArchive;
  flows: FlowEntry[];
};

export type Effect =
  | { tag: "pay"; from: Id; to: Id; amount: Money; row: FlowRow }
  | {
    tag: "lendBank";
    bank: BankId;
    borrower: Id;
    amount: Money;
    collateral: Id;
    installment: Money;
    months: number;
  }
  | { tag: "repayBank"; loan: Id; amount: Money }
  | {
    tag: "issuePrivate";
    issuer: Id;
    holder: Id;
    principal: Money;
    installment: Money;
    months: number;
    issuerKind: "firm" | "government";
  }
  | { tag: "transferPrivate"; instrument: Id; from: Id; to: Id; price: Money }
  | { tag: "writeOff"; instrument: Id }
  | { tag: "post"; listing: Listing }
  | { tag: "fill"; listing: Id; buyer: Id; qty: Qty }
  | { tag: "tradeShare"; listing: Id; buyer: Id; qty: Qty }
  | { tag: "transferHouse"; listing: Id; buyer: Id; qty: Qty }
  | { tag: "occupy"; house: Id; mode: "occupy" | "let" }
  | { tag: "hire"; listing: Id; person: Id; seated: boolean; keep: boolean }
  | { tag: "deliverMachine"; listing: Id; firm: Id; qty: Qty }
  | { tag: "rent"; listing: Id; tenant: Id; pay: boolean }
  | { tag: "vacate"; house: Id }
  | { tag: "pinHealth"; person: Id; cause: "homeless" }
  | { tag: "pinHealth"; person: Id; cause: "disease"; disease: Disease }
  | { tag: "assign"; person: Id; specialty: Disease | Career | null }
  | { tag: "cure"; person: Id; disease: Disease; granted: boolean }
  | { tag: "levelUp"; person: Id; career: Career; granted: boolean }
  | { tag: "buyCure"; person: Id; listing: Id; qty: Qty }
  | { tag: "buyTuition"; person: Id; listing: Id; qty: Qty }
  | { tag: "archiveJobs"; listings: JobArchive["listings"] }
  | { tag: "death"; person: Id }
  | { tag: "birth"; parent: Id }
  | { tag: "grantHouse"; house: Id; person: Id; units: number }
  | { tag: "escheat"; person: Id }
  | { tag: "vest"; person: Id; heir: Id }
  | { tag: "depositMine"; mine: Id; bank: BankId; shares: Qty }
  | { tag: "seize"; loan: Id }
  | { tag: "dividend"; bank: BankId }
  | { tag: "setLoanRate"; bank: BankId; rate: Rate }
  | { tag: "draw"; firm: Id; owner: Id; amount: Money }
  | {
    tag: "strategy";
    firm: Id;
    mode: "stay" | "expand" | "upgrade";
    posts: Listing[];
  };

export const FLOW_ROWS: readonly FlowRow[] = [
  "wages",
  "staple",
  "luxuryFood",
  "nightclub",
  "tuition",
  "privateCure",
  "rent",
  "ore",
  "machinePurchase",
  "maintenance",
  "tax",
  "bankInterest",
  "bankPrincipal",
  "privateInstallment",
  "profitDraw",
  "dividend",
  "houseTrade",
  "mineTrade",
  "debtTrade",
  "shareTrade",
  "writeOff",
  "estate",
];

export const CAREERS: readonly Career[] = [
  "teacher",
  "doctor",
  "bureaucrat",
  "retail",
  "hospitality",
  "engineer",
];

export function isBankId(id: string): id is BankId {
  return id === "a" || id === "b";
}

export function otherBank(bank: BankId): BankId {
  return bank === "a" ? "b" : "a";
}

/** Claim of `bank` on the other bank. `interbank` itself is a's claim on b. */
export function signedInterbank(bank: BankId, interbank: Money): Money {
  return bank === "a" ? interbank : -interbank;
}
