// invest_test.ts — the entrepreneur's two guards, in isolation. Labour caps the
// field; margin stops the field; the demand trigger and affordability floor let
// the obvious case through.

import { assertEquals } from "jsr:@std/assert@1";
import {
  breakEvenPrice,
  decideInvestment,
  type InvestCandidate,
  minBuffer,
} from "./invest.ts";

// A gen-0 hospitality machine in the levelled town: 2 operators at wage 24 make
// 20 units, so it breaks even at ceil(48/20)=3; invest at 3+1=4. The machine is
// 10, the first payroll 48, so the floor is 58.
const OPS = 2, WAGE = 24, OUT = 20, PRICE = 10, HEADROOM = 1;
const base = {
  idle: 100, // plenty of labour unless a test says otherwise
  opsPerMachine: OPS,
  fullOutput: OUT,
  newWage: WAGE,
  machinePrice: PRICE,
  triggerSellouts: 6,
  marginHeadroom: HEADROOM,
};
const club = (id: string, over: Partial<InvestCandidate> = {}): InvestCandidate => ({
  id,
  cash: 900,
  price: 10,
  sellouts: 12,
  ...over,
});

Deno.test("break-even is ceil(crew wages / full output); floor is machine + first payroll", () => {
  assertEquals(breakEvenPrice(OPS, WAGE, OUT), 3);
  assertEquals(minBuffer(PRICE, OPS, WAGE), 58);
  assertEquals(breakEvenPrice(OPS, WAGE, 0), Infinity);
});

Deno.test("a sold-out, solvent, well-priced club invests", () => {
  const { buyers } = decideInvestment({ ...base, candidates: [club("club-01")] });
  assertEquals(buyers, ["club-01"]);
});

Deno.test("too few sellouts: the demand case is not made", () => {
  const { buyers } = decideInvestment({
    ...base,
    candidates: [club("club-01", { sellouts: 5 })],
  });
  assertEquals(buyers, []);
});

Deno.test("price below break-even + headroom: the margin guard stops it", () => {
  // price 3 clears break-even (3) but not the +1 headroom.
  const { buyers } = decideInvestment({
    ...base,
    candidates: [club("club-01", { price: 3 })],
  });
  assertEquals(buyers, []);
  // price 4 is exactly the headroom bar and passes.
  assertEquals(
    decideInvestment({ ...base, candidates: [club("c", { price: 4 })] }).buyers,
    ["c"],
  );
});

Deno.test("cash below the machine + first payroll: affordability gates it", () => {
  const { buyers } = decideInvestment({
    ...base,
    candidates: [club("club-01", { cash: 57 })],
  });
  assertEquals(buyers, []);
  assertEquals(
    decideInvestment({ ...base, candidates: [club("c", { cash: 58 })] }).buyers,
    ["c"],
  );
});

Deno.test("labour caps the field: three eager clubs, room to staff one", () => {
  const { buyers } = decideInvestment({
    ...base,
    idle: 2, // floor(2 / 2 ops) = one machine
    candidates: [
      club("club-01", { sellouts: 8, cash: 300 }),
      club("club-02", { sellouts: 12, cash: 300 }),
      club("club-03", { sellouts: 12, cash: 900 }),
    ],
  });
  // hungriest first, then best-capitalised: club-03 and club-02 tie on sellouts,
  // club-03 wins on cash.
  assertEquals(buyers, ["club-03"]);
});

Deno.test("no idle labour: nobody invests however hot demand is", () => {
  const { buyers } = decideInvestment({
    ...base,
    idle: 1, // floor(1/2) = 0
    candidates: [club("club-01"), club("club-02")],
  });
  assertEquals(buyers, []);
});

Deno.test("ordering is deterministic by sellouts, then cash, then id", () => {
  const { buyers } = decideInvestment({
    ...base,
    idle: 100,
    candidates: [
      club("club-03", { sellouts: 10, cash: 500 }),
      club("club-01", { sellouts: 10, cash: 500 }),
      club("club-02", { sellouts: 12, cash: 100 }),
    ],
  });
  assertEquals(buyers, ["club-02", "club-01", "club-03"]);
});
