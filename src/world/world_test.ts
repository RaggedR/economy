// world_test.ts — the five rows after every effect, and the two pays that the
// one-line test joins with an "and".
//
// A person-to-person pay, including one drawn from both of the payer's banks,
// leaves interbank and every deposit liability where they were. A pay to a
// bank destroys deposits into equity, so the money supply moves, and the
// deposit identity moves the sum of deposit liabilities with it. Interbank
// moves only when that pay is funded at the other bank.

import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import {
  depositMineGate,
  dividendGate,
  type GateResult,
  issuePrivateGate,
  lendGate,
  payGate,
  postMaterialGate,
  repayGate,
  sellCapitalGate,
  transferPrivateGate,
  writeOffGate,
} from "./gates.ts";
import { monthSeed, storySeed } from "./seed.ts";
import type { Effect, World } from "./types.ts";
import {
  applyEffect,
  assertFlowIdentity,
  assertInvariant,
  depositsAt,
  type Instrument,
  instrumentSums,
  LeakError,
  moneySupply,
  openingNfa,
} from "./world.ts";

const NAMES: Instrument[] = ["deposits", "loans", "privateLoans", "shares", "interbank"];

function held(g: GateResult): Effect {
  if (!g.ok) throw new Error(g.reason);
  return g.effect;
}

function closed(world: World): void {
  assertInvariant(world);
  const sums = instrumentSums(world);
  for (const name of NAMES) assertEquals(sums[name], 0, name);
}

function sumDL(world: World): number {
  return world.banks.a.depositLiability + world.banks.b.depositLiability;
}

Deno.test("the story seed and the month seed close", () => {
  closed(storySeed());
  closed(monthSeed());
  assertEquals(depositsAt(monthSeed(), "a"), 700);
  assertEquals(monthSeed().banks.a.equity, -700);
});

Deno.test("a drifted counter fails naming the instrument", () => {
  const deposits = storySeed();
  deposits.banks.a.depositLiability -= 1;
  assertThrows(() => assertInvariant(deposits), LeakError, "deposits");

  const loans = storySeed();
  loans.banks.a.loansOutstanding += 1;
  assertThrows(() => assertInvariant(loans), LeakError, "loans");

  const shares = monthSeed();
  shares.banks.a.sharesOutstanding += 1;
  assertThrows(() => assertInvariant(shares), LeakError, "shares");
});

Deno.test("the four-step story keeps every row at zero", () => {
  let w = storySeed();
  const base = openingNfa(w);
  const dl0 = sumDL(w);
  const ms0 = moneySupply(w);

  w = applyEffect(w, held(payGate(w, "ada", "ben", 200, "wages")));
  closed(w);
  assertEquals(w.interbank, 0);
  assertEquals(sumDL(w), dl0);
  assertEquals(moneySupply(w), ms0);
  assertEquals(w.banks.a.depositLiability, -1000);

  w = applyEffect(w, held(payGate(w, "ada", "b", 100, "bankInterest")));
  closed(w);
  assertEquals(w.interbank, -100);
  assertEquals(w.banks.b.equity, -700);
  assertEquals(w.banks.a.equity, -1000);
  assertEquals(moneySupply(w), ms0 - 100);

  w = applyEffect(w, held(lendGate(w, "a", "ada", 300, "note", 30, 10)));
  closed(w);
  assertEquals(w.banks.a.loansOutstanding, 300);
  assertEquals(moneySupply(w), ms0 - 100 + 300);
  const loanId = Object.keys(w.loans)[0];
  assertEquals(w.loans[loanId].principal, 300);

  w = applyEffect(w, held(repayGate(w, loanId, 100)));
  closed(w);
  assertEquals(w.loans[loanId].principal, 200);
  assertEquals(w.banks.a.equity, -1000);

  w = applyEffect(w, held(payGate(w, "ada", "a", 40, "bankInterest")));
  closed(w);
  assertEquals(w.loans[loanId].principal, 200);
  assertEquals(w.banks.a.equity, -960);
  assertEquals(w.banks.a.loansOutstanding, 200);
  assertEquals(w.people.ada.deposits.a, 860);
  assertEquals(w.people.ben.deposits.a, 200);
  assertEquals(w.people.ben.deposits.b, 800);
  assertEquals(moneySupply(w), 1860);
  assertEquals(sumDL(w), -1860);
  assertFlowIdentity(w, base);
});

Deno.test("lend then repay restores the deposit total and the loan total", () => {
  const w0 = storySeed();
  const dl = sumDL(w0);
  const ms = moneySupply(w0);
  let w = applyEffect(w0, held(lendGate(w0, "a", "ada", 250, "note", 25, 10)));
  const id = Object.keys(w.loans)[0];
  w = applyEffect(w, held(repayGate(w, id, 250)));
  closed(w);
  assertEquals(sumDL(w), dl);
  assertEquals(w.banks.a.loansOutstanding + w.banks.b.loansOutstanding, 0);
  assertEquals(moneySupply(w), ms);
  assertEquals(w.people.ada.deposits.a, 1000);
  assertEquals(Object.keys(w.loans).length, 0);
});

Deno.test("interest between a loan and its repayment changes equity only", () => {
  let w = storySeed();
  w = applyEffect(w, held(lendGate(w, "a", "ada", 250, "note", 25, 10)));
  const id = Object.keys(w.loans)[0];
  const equity = w.banks.a.equity;
  w = applyEffect(w, held(payGate(w, "ada", "a", 25, "bankInterest")));
  assertEquals(w.loans[id].principal, 250);
  assertEquals(w.banks.a.loansOutstanding, 250);
  assertEquals(w.banks.a.equity, equity + 25);
  w = applyEffect(w, held(repayGate(w, id, 250)));
  closed(w);
  assertEquals(w.banks.a.loansOutstanding, 0);
  assertEquals(w.banks.a.equity, equity + 25);
  assertEquals(moneySupply(w), moneySupply(storySeed()) - 25);
});

Deno.test("a person-to-person pay drawn from both banks leaves interbank and liabilities", () => {
  let w = storySeed();
  const dl = sumDL(w);
  w = applyEffect(w, held(payGate(w, "ben", "ada", 300, "wages")));
  w = applyEffect(w, held(payGate(w, "ada", "ben", 1100, "wages")));
  closed(w);
  assertEquals(w.interbank, 0);
  assertEquals(sumDL(w), dl);
  assertEquals(w.banks.a.depositLiability, -1000);
  assertEquals(w.banks.b.depositLiability, -800);
  assertEquals(w.people.ada.deposits, { a: 0, b: 200 });
  assertEquals(w.people.ben.deposits, { a: 1000, b: 600 });
});

Deno.test("an equal balance is drawn from bank a first", () => {
  const w0 = storySeed();
  w0.people.ada.deposits = { a: 100, b: 100 };
  w0.people.ben.deposits = { a: 0, b: 0 };
  w0.banks.a.depositLiability = -100;
  w0.banks.a.equity = -100;
  w0.banks.b.depositLiability = -100;
  w0.banks.b.equity = -100;
  closed(w0);
  const w = applyEffect(w0, held(payGate(w0, "ada", "ben", 50, "wages")));
  assertEquals(w.people.ada.deposits, { a: 50, b: 100 });
  assertEquals(w.interbank, 0);
});

Deno.test("a pay the gate refuses throws if it is applied anyway", () => {
  const w = storySeed();
  const g = payGate(w, "ada", "ben", 5000, "wages");
  assertEquals(g.ok, false);
  assertThrows(
    () =>
      applyEffect(w, { tag: "pay", from: "ada", to: "ben", amount: 5000, row: "wages" }),
    LeakError,
  );
  assertEquals(w.people.ada.deposits.a, 1000);
  const fromBank = payGate(w, "a", "ada", 10, "dividend");
  assertEquals(fromBank.ok, false);
  assertThrows(
    () =>
      applyEffect(w, { tag: "pay", from: "a", to: "ada", amount: 10, row: "dividend" }),
    LeakError,
  );
});

Deno.test("a private loan moves a deposit and does not create one", () => {
  let w = storySeed();
  const ms = moneySupply(w);
  w = applyEffect(w, held(issuePrivateGate(w, "gov", "ada", 100, 10, 10, "government")));
  closed(w);
  assertEquals(moneySupply(w), ms);
  assertEquals(w.interbank, 0);
  assertEquals(w.people.ada.deposits.a, 900);
  assertEquals(w.government.deposits.a, 100);
  const id = Object.keys(w.loans)[0];
  w = applyEffect(w, held(transferPrivateGate(w, id, "ada", "ben", 30)));
  closed(w);
  assertEquals(moneySupply(w), ms);
  assertEquals(w.interbank, 0);
  assertEquals(w.loans[id].kind === "private" && w.loans[id].holder, "ben");
  w = applyEffect(w, held(writeOffGate(w, id)));
  closed(w);
  assertEquals(Object.keys(w.loans).length, 0);
  assertEquals(moneySupply(w), ms);
});

Deno.test("depositing a mine mints shares and moves no money", () => {
  let w = storySeed();
  w = {
    ...w,
    mines: {
      m: {
        id: "m",
        material: "common",
        stock: 8,
        owner: "ada",
        depositedAt: null,
        lien: null,
      },
    },
  };
  const ms = moneySupply(w);
  w = applyEffect(w, held(depositMineGate(w, "m", "a", 7)));
  closed(w);
  assertEquals(moneySupply(w), ms);
  assertEquals(w.mines.m.owner, "a");
  assertEquals(w.mines.m.depositedAt, "a");
  assertEquals(w.banks.a.sharesOutstanding, 7);
  assertEquals(Object.values(w.shares)[0].holder, "ada");
  assertEquals(Object.values(w.shares)[0].units, 7);
});

Deno.test("a dividend pays the floor and leaves the dust as equity", () => {
  let w = storySeed();
  w = {
    ...w,
    mines: {
      m: {
        id: "m",
        material: "common",
        stock: 8,
        owner: "ada",
        depositedAt: null,
        lien: null,
      },
    },
  };
  const base = openingNfa(w);
  w = applyEffect(w, held(depositMineGate(w, "m", "b", 10)));
  w = applyEffect(w, held(payGate(w, "ada", "b", 1000, "bankInterest")));
  w = {
    ...w,
    shares: {
      "share-1": { id: "share-1", bank: "b", holder: "ada", units: 1 },
      "share-2": { id: "share-2", bank: "b", holder: "ben", units: 2 },
    },
    banks: { ...w.banks, b: { ...w.banks.b, sharesOutstanding: 3 } },
  };
  closed(w);
  w = applyEffect(w, held(dividendGate(w, "b")));
  closed(w);
  assertEquals(w.banks.b.equity, 1);
  assertEquals(w.people.ada.deposits.b, 66);
  assertEquals(w.people.ben.deposits.b, 933);
  assertFlowIdentity(w, base);
});

Deno.test("seizing a house writes the loan off and gives the house to the bank", () => {
  let w = monthSeed();
  w = applyEffect(w, held(lendGate(w, "a", "ada", 100, "h-ada", 10, 10)));
  const id = Object.keys(w.loans)[0];
  assertEquals(w.houses["h-ada"].lien, id);
  const equity = w.banks.a.equity;
  w = applyEffect(w, held({ ok: true, effect: { tag: "seize", loan: id } }));
  closed(w);
  assertEquals(w.banks.a.loansOutstanding, 0);
  assertEquals(w.banks.a.equity, equity - 100);
  assertEquals(w.banks.a.losses, 100);
  assertEquals(w.houses["h-ada"].owner, "a");
  assertEquals(w.houses["h-ada"].lien, null);
  assertEquals(w.loans[id], undefined);
});

Deno.test("two posts gated against one world receive distinct listing ids", () => {
  let w = monthSeed();
  const sell = sellCapitalGate(w, "a", "m1", 20);
  const ore = postMaterialGate(w, "a", "m1", 11, 5);
  w = applyEffect(w, held(sell));
  w = applyEffect(w, held(ore));
  closed(w);
  assertEquals(w.listings.map((l) => l.id), ["list-1", "list-2"]);
  assertEquals(w.listings.map((l) => l.kind), ["mine", "ore"]);
});
