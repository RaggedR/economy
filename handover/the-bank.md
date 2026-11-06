# Switching on the bank — lending, equity, and raw-material income

Follows `handover/invest-and-births.md`. That arc ended on a conclusion: the
metropolis is structurally demand-deficient, there is no free demand lever, and
sustained purchasing power must be a *flow from production into households*. The
handover named "build the credit sector" as the next step. This arc built three
ways to mobilise idle wealth into a household income flow, measured each, and
found which actually creates demand. All additive behind flags; **193 tests pass
and the byte-identical replay holds.**

**Committed and pushed:** `3ca6e1b` "Switch on the bank: lending, equity, and
raw-material income" on `origin/price-discovery` (RaggedR/economy, not a fork).
No PR opened yet. The branch is unmerged to `main`.

See `before-the-bank.pdf` for the written narrative of the demand-deficiency arc,
and `turns.pdf` for the per-agent turn structure (citizen, entrepreneur, miner,
tech, bank, government) and the annual/monthly interleaving.

## The three channels (all opt-in, default off)

### 1. Private lending — `IgnitionOpts.lend` — INERT
- `src/world/lend.ts` (`decideLending`, pure, 9 tests) + `src/bridge/lend.ts`
  (`runLending`, 2 tests). Wealthy savers (cash ≥ `savingsThreshold`, not
  shop-owners) lend to firms that cleared invest's demand+margin case but sit
  below its cash floor. Commits through the real `acceptDebt` gate.
- `src/bridge/invest.ts` gained `investShortfalls` (the cash-short borrowers,
  labour-capped) and a shared `investCandidates`, so lend and invest cannot
  drift. `producerOf` exported.
- **Finding:** fires ZERO loans on the levelled town. Firms are not
  capital-short — they hoard 15–25× the ~58 a machine needs — and idle labour is
  down to 2. Credit to firms is a supply channel in a demand-short economy.

### 2. Equity / dividend — `IgnitionOpts.equity` (+ `dividend`) — DIVIDEND BLOCKED
- `src/world/equity.ts` (`planMineDeposits`, `interestDue`, pure, 6 tests) +
  `src/bridge/equity.ts` (`runEquityDay`, 2 tests). Mines → shares (and the
  deposit raises the leverage ceiling, which is what lets the next step borrow);
  each entrepreneur mortgages his own house (`loanAsk`) and pays the bank
  `interestDue` = `floor(principal / equityInterestDivisor)`.
- **Finding:** the mechanism fires correctly (shares minted, 21 mortgages,
  interest paid) and bank equity rises by *exactly* the interest — but the
  dividend never pays. Genesis bank equity is `-(all deposits)` (`seed.ts:54`):
  a pure deposit ledger with no reserve asset, so equity = loans − deposits +
  interbank is pinned at ≈ −26 600. A year of interest (~1 000) can't fill it;
  `dividendGate` always refuses. **The dividend needs the bank balance sheet
  fixed** (back deposits with a reserve asset so genesis equity ≈ 0).
- **But the mortgage leg lifted demand on its own:** entrepreneurs borrowing
  against their frozen houses and spending the proceeds took luxury survival
  2/6 → 6/6 (cap 80 → 240), fed 84 → 86 (24-month run, equity off vs on). The
  real-estate credit channel is the first lever that *created* demand.

### 3. Raw-material income — `params.machineMaterialUnits > 0` — the intended loop
- New core effect **`sellOre`** (`types.ts`, `world.ts` reducer, `gates.ts`
  `sellOreGate`, 2 tests in `sellore_test.ts`): a direct mine→buyer ore sale —
  money to the owner (row `ore`), mine stock down. Unlike the bank's ore listing
  (`postMaterialGate`, proceeds to the bank), this reaches the owner.
- `src/bridge/invest.ts`: when `machineMaterialUnits > 0`, invest day sources
  that many ore units per machine from an indigenous mine (`oreSupplier`, lowest
  id first), the tech firm paying the owner at `refPrice`. Checked BEFORE
  delivery, so a machine is never built the town can't supply; no ore ⇒ no
  machine. Default 0 keeps machines free (replay untouched). 1 bridge test.
- **Design:** machine price covers the ore cost (Robin's call), so the tech firm
  is a pass-through: a producing firm's machine spend → tech → indigenous
  household → spent ¼ on luxury/nightclub. Recycles firm hoards into demand.
- **Measurement (rawmat-compare.ts, 24mo, ore OFF vs ON, machinePrice 100 both):**
  the money flows (0 → 110 ore units sold, ≈1,100 to indigenous that was tech
  hoard before) but aggregate demand does NOT move — luxury 1→1, nightclub 8→8,
  fed 85→84. Why: machine-building is labour-capped at a handful/year (idle pool
  ≈2), so total ore spend is ~46/month; and `oreSupplier` takes the lowest-id
  mine first, so the whole 1,100 landed on ONE owner. A trickle to one household
  cannot move the town. Scaling material cost up just moves more money without
  more machines; spreading across owners thins it further. The channel routes
  money the right way (firm→household) but is throttled by the same labour cap
  that bounds every production-linked lever.

## Canonical special-month order (ignition.ts)

Applied to Robin's spec: **dividend → children → capital market (equity, private
debt; government debt not built) → real estate (not built) → jobs & machines
(invest) → rental (not built)**. Then the usual turn resumes.

Usual turn, reconciled against the code (for the next instance): `commitOpening`
pays each firm's whole bill FIRST (wages→workers' income, maintenance, tax, bank
+ private debt) — income *is* the salary payment, not a separate step; then bake
+ staple market (food), then `commitProduce` (discretionary shelves), then
`runSpend` (luxury/nightclub), then `commitRemainder` (the draw to owners, LAST).
Gaps vs the intended turn: no mining-land/ore market in the loop, and tech builds
machines with no raw-material input unless `machineMaterialUnits > 0`.

## New params (all frozen-safe defaults)
`lendTermMonths` (12), `equityInterestDivisor` (10), `machineMaterialUnits` (0).

## The finding that should steer the next instance

The town is **near full employment (idle ≈ 2) AND demand-deficient at the same
time** — the paradox of thrift. Income leaks out of circulation (the ¾ saving
rate, the ~20% with the `savings` objective who buy nothing, firm reserves)
faster than production returns it. Two consequences that every future lever
should be judged against:

1. **A demand lever only works by *un-leaking a frozen stock* back into the spend
   stream.** Redistribution between equal-propensity spenders is demand-neutral;
   added supply is useless in a demand-short town; a one-off stock gift depletes.
2. **Magnitude must be comparable to the money supply (~26k).** Real-estate
   credit mobilised ~31k and moved demand (luxury 2→6); ore flows were ~1.1k and
   did nothing. Production-linked flows (ore, machine purchases) are structurally
   small because machine-building is labour-capped — so they can't be the answer.

## Live directions (pick one)
- **Fix the bank balance sheet** so the dividend can fire *at scale* (reserve
  asset backing deposits → genesis equity ≈ 0). The dividend recirculates hoards;
  it's the natural second large lever after real-estate credit. Measure dividends
  + mortgages together, 48–60 months.
- **Switch tech to monthly building** (turns.pdf §4.1): build through the year
  consuming ore monthly, sell machines only at year-end — smoother indigenous
  income. A refactor of the year-end bundle in `runInvestDay`.
- **Attack the leak directly** — model a lower savings propensity, make the
  `savings`-objective consume, or circulate firm reserves. This is the root
  cause; everything else is downstream.
- **Build the missing markets** the turns doc names: real estate, rental,
  mining-land / ore trade, government debt.

## Housekeeping for the next instance
- `oreSupplier` takes the lowest-id mine first, so ore income concentrates on one
  owner; spread it (or target consumers) if the raw-material channel is revisited.
- Scratch harnesses used for the measurements (NOT committed, in the session
  scratchpad): `lend-compare.ts`, `equity-compare.ts`, `rawmat-compare.ts`. They
  seed a landed/mined metropolis and A/B a flag; re-create from the committed
  `metropolis-invest.ts` pattern if needed.
- No PR yet. If shipping to `main`, open one off `price-discovery`.
