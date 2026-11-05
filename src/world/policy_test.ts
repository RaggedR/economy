// policy_test.ts — the rate and the ore price move toward the other bank, and
// step up once when the book is stressed. The household's ask is an amount the
// gate accepts.

import { assertEquals } from "jsr:@std/assert@1";
import { payGate, requestLoanGate } from "./gates.ts";
import {
  archiveCareer,
  doctorMix,
  drawAmount,
  householdSpend,
  lenderAccepts,
  loanAsk,
  nextLoanRate,
  nextOrePrice,
  operatingReserve,
  teacherMix,
  trainingBids,
} from "./policy.ts";
import { firmShell, healthSeed, monthSeed, placeFirm, purseSeed } from "./seed.ts";
import { applyEffect, markedMineBase } from "./world.ts";
import { params } from "./params.ts";
import { remainderDraws } from "./purses.ts";

Deno.test("the rate steps toward the other bank, and once more when stressed", () => {
  const w = monthSeed();
  assertEquals(nextLoanRate(w, "a"), 101);
  assertEquals(nextLoanRate(w, "b"), 104);

  w.banks.a.losses = 1;
  assertEquals(nextLoanRate(w, "a"), 102);

  w.banks.a.losses = 0;
  w.banks.a.loansOutstanding = params.leverageMultiple * markedMineBase(w, "a");
  assertEquals(nextLoanRate(w, "a"), 102);

  // Losses and a full book are one condition, so the extra step is still one.
  w.banks.a.losses = 5;
  assertEquals(nextLoanRate(w, "a"), 102);
});

Deno.test("a zero ceiling is not a full book", () => {
  const w = monthSeed();
  w.mines = {};
  w.banks.a.loansOutstanding = 50;
  assertEquals(nextLoanRate(w, "a"), 101);
});

Deno.test("ore starts at the reference and steps toward the other bank's listing", () => {
  const w = monthSeed();
  assertEquals(nextOrePrice(w, "a", "common"), params.initialRef.common);
  w.listings.push({
    id: "posted",
    seller: "b",
    kind: "ore",
    price: 12,
    qty: 1,
    payload: null,
  });
  assertEquals(nextOrePrice(w, "a", "common"), 11);
});

Deno.test("loanAsk is an amount requestLoan would accept", () => {
  const w = monthSeed();
  const ask = loanAsk(w, "ada", "a");
  if (!ask) throw new Error("ada has a house");
  assertEquals(ask.amount, 500);
  assertEquals(ask.collateral, "h-ada");
  assertEquals(
    requestLoanGate(
      w,
      ask.bank,
      ask.borrower,
      ask.amount,
      ask.collateral,
      ask.installment,
      ask.months,
    )
      .ok,
    true,
  );
  assertEquals(loanAsk(storyless(), "ada", "a"), null);
});

function storyless() {
  const w = monthSeed();
  w.houses = {};
  w.people.ada.dwelling = null;
  return w;
}

function held(
  gate: { ok: true; effect: import("./types.ts").Effect } | { ok: false; reason: string },
) {
  if (!gate.ok) throw new Error(gate.reason);
  return gate.effect;
}

Deno.test("doctors follow the disease count and teachers follow listed slots", () => {
  const w = healthSeed();
  w.people.ada.diseases = ["d2"];
  w.jobArchive = {
    year: 0,
    listings: [
      { career: "engineer", generation: 0, salary: 8, slots: 3 },
      { career: "retail", generation: 0, salary: 4, slots: 1 },
    ],
  };
  assertEquals(doctorMix(w), [{ person: "doc", disease: "d0" }]);
  assertEquals(teacherMix(w), [{ person: "teach", career: "engineer" }]);
  assertEquals(archiveCareer(w), { career: "engineer", slots: 3 });

  w.people.ada.diseases = [];
  w.people.cleo.diseases = [];
  assertEquals(doctorMix(w), []);
  w.jobArchive = { year: 0, listings: [] };
  assertEquals(teacherMix(w), []);
  assertEquals(trainingBids(w), []);
});

Deno.test("a tie of disease counts breaks toward d0, and extra staff are not invented a specialty", () => {
  const w = healthSeed();
  w.people.cleo.diseases = ["d0"];
  w.people.ada.diseases = ["d2"];
  w.people.doc2 = {
    ...w.people.doc,
    id: "doc2",
    job: { firm: "pub-hosp", career: "doctor", salary: 1 },
  };
  assertEquals(doctorMix(w).map((row) => row.disease), ["d0", "d2"]);
  assertEquals(doctorMix(w).map((row) => row.person), ["doc", "doc2"]);
});

Deno.test("the entrepreneur leaves the opening bill and draws the rest", () => {
  let world = purseSeed();
  world = placeFirm(world, firmShell("mill", "cleo", { a: 0, b: 0 }, "tech"));
  world = applyEffect(world, held(payGate(world, "shop", "mill", 30, "maintenance")));
  assertEquals(operatingReserve(world, "shop"), 30);
  assertEquals(operatingReserve(world, "mill"), 0);
  assertEquals(drawAmount(world, "shop"), 340);
  const draws = remainderDraws(world);
  assertEquals(
    draws.find((effect) => effect.tag === "draw" && effect.firm === "shop"),
    { tag: "draw", firm: "shop", owner: "ada", amount: 340 },
  );
  assertEquals(
    draws.find((effect) => effect.tag === "draw" && effect.firm === "mill"),
    { tag: "draw", firm: "mill", owner: "cleo", amount: 30 },
  );
});

Deno.test("a lender accepts when revenue covers the installment twice", () => {
  const w = healthSeed();
  assertEquals(params.revenueCover, 2);
  assertEquals(params.savingsThreshold, 100);
  w.government.taxLastMonth = 40;
  assertEquals(lenderAccepts(w, "gov", 10), true);
  assertEquals(lenderAccepts(w, "gov", 21), false);
  w.flows = [
    { month: 0, row: "staple", holder: "shop", amount: 30 },
    { month: 0, row: "staple", holder: "ada", amount: -30 },
  ];
  assertEquals(lenderAccepts(w, "shop", 10), true);
  assertEquals(lenderAccepts(w, "shop", 16), false);
  w.flows = [
    { month: 0, row: "maintenance", holder: "shop", amount: 30 },
    { month: 0, row: "maintenance", holder: "mill", amount: -30 },
  ];
  assertEquals(lenderAccepts(w, "shop", 10), false);
});

Deno.test("households spend down the objective chain and train toward the archive", () => {
  const w = healthSeed();
  w.people.ada.objective = "happiness";
  w.people.ada.deposits = { a: 100, b: 0 };
  w.people.ben.objective = "education";
  w.people.ben.deposits = { a: 100, b: 0 };
  w.people.cleo.objective = "savings";
  w.people.cleo.deposits = { a: 100, b: 0 };
  w.people.cleo.diseases = [];
  w.jobArchive = {
    year: 0,
    listings: [{ career: "engineer", generation: 0, salary: 8, slots: 2 }],
  };
  w.firms.club = firmShell("club", "cleo", { a: 0, b: 0 }, "nightclub");
  w.firms.club.inventory = { nightclub: 2, luxuryFood: 1 };
  w.listings = [
    {
      id: "club-lot",
      seller: "club",
      kind: "good",
      price: 5,
      qty: 2,
      payload: { good: "nightclub" },
    },
    {
      id: "lux-lot",
      seller: "club",
      kind: "good",
      price: 7,
      qty: 1,
      payload: { good: "luxuryFood" },
    },
    {
      id: "eng-level",
      seller: "priv-uni",
      kind: "good",
      price: 1,
      qty: 10,
      payload: { good: "tuition", career: "engineer" },
    },
  ];
  const spent = householdSpend(w);
  assertEquals(
    spent.map((row) => `${row.person}:${row.tag}:${"good" in row ? row.good : row.tag}`),
    [
      "ada:good:nightclub",
      "ben:good:nightclub",
      "ben:good:luxuryFood",
      "ben:tuition:tuition",
    ],
  );
  assertEquals(spent.some((row) => row.person === "cleo"), false);
  const bids = trainingBids(w).map((bid) => bid.person);
  assertEquals(bids.includes("ada"), true);
  assertEquals(bids.includes("doc"), false);
  assertEquals(bids.includes("teach"), false);

  w.people.ada.objective = "health";
  w.people.ada.diseases = ["d2"];
  w.listings.push({
    id: "cure-d2",
    seller: "priv-hosp",
    kind: "cure",
    price: 1,
    qty: 10,
    payload: { disease: "d2" },
  });
  const health = householdSpend(w).filter((row) => row.person === "ada").map((row) =>
    row.tag
  );
  assertEquals(health, ["good", "good", "cure"]);
});
