# Invest day & special-month births — and six demand levers

The living economy had demand, production, consumption and a welfare sweep, but
supply was frozen: nothing ever drove the (already-built) `strategyPlan` /
`clearMachines` / `seatJobs` machinery, so firms never added capacity and the
population only fell (deaths ran; births didn't). This arc wired a restricted
**special month** into `runIgnition` — machines + hiring + births, opt-in behind
flags — and used it to probe what actually makes the town thrive. It does not,
yet, change the frozen fixtures: every milestone test and the byte-identical
replay still pass (171 tests), because all of it is additive behind
`IgnitionOpts` flags that default off.

## What landed (working tree, not committed)

- **Price discovery, measured.** Over a 5-year metropolis the nightclub market
  only discovers a clearing price when incomes are lifted (the "levelled" config:
  `metroWageScale`, `metroWeakMachines`, `discretionaryDiscovery`, `perishable`,
  `demandBudgetFraction`). The undercut cap (`undercutFactor` 1/1) pins every
  competitor to its cheapest rival, so sold-out markets sit at the floor.

- **The invest rule** (`src/world/invest.ts`, pure + tested). A firm that sold
  out ≥`investTriggerSellouts` of the trailing `investWindow` months, can afford
  the machine + first payroll, and whose price clears the crew's break-even +
  `investMarginHeadroom`, buys one machine — capped at what the idle pool can
  staff (`floor(idle/ops)`). The margin and labour guards turn a naive
  "sold-out → buy" boom-bust (bought 32 machines, every club folded) into a soft
  landing (9 machines, capacity 100→280 held, all clubs survive). Generalised to
  all producing kinds via a `PRODUCERS` table (supermarket/luxury/nightclub).
  Driver: `src/bridge/invest.ts` (`runInvestDay` + `InvestTracker`), committing
  through the real machine/job gates; a tech firm supplies the machine and is
  paid.

- **Special-month births** (`src/world/kin.ts`: `specialBirthBand`,
  `planSpecialBirths`; `src/bridge/kin.ts`: `runSpecialBirths`). The town's rule:
  mandatory at ≥`fertilityUnits`(100) real estate + ≥`fertilityMultiple`·G(10G)
  liquid; voluntary (exercised) at ≥3·quantum(30) + ≥3G. The child is endowed
  with one quantum of house and `birthEndowment` of cash, liquidated from the
  parent — reusing the existing `birth` effect/`bear`. Births are the first thing
  the special month does, ahead of any real-estate sale. `fertility` /
  `planBirths` / `bear` are otherwise untouched, so the scheduler/story path is
  unchanged.

- **`birthEndowment`** param (default `cashGift`, frozen-safe) decouples the
  newborn's cash from the fertility thresholds so the town can endow children
  generously.

- **Bank dividend** wired into the special month (`IgnitionOpts.dividend`,
  canonical order births → dividend → invest). Inert in the metropolis — the
  bank is an insolvent deposit ledger (negative equity, no shares), so
  `dividendGate` always refuses. A dividend is distributed *earned* profit, not
  free demand.

- **Demo**: `src/metropolis-invest.ts` runs the levelled town with
  `{ spend, invest, births, dividend }` on a demo-only `landedMetropolisSeed`
  (firm owners made a landed, liquid class so births can fire — `metropolisSeed`
  and its frozen tests untouched).

## The measured finding — six demand levers, one conclusion

| lever | result |
|---|---|
| loosen price undercut (discretionary) | **worse** — budget demand buys fewer units at a higher price; a false "healthy price" lures over-investment |
| raise income (`metroWageScale` 3→6) | **starvation** — higher wages bankrupt the low-margin, inelastic staple producers; `fed`→0 |
| population / births | **collapse** — poor newborns add labour (not demand), the swollen idle pool un-caps the invest brake, clubs over-expand and fold |
| generous endowment (5G) | **partial** — helps in proportion to size, but a stock depletes in ~4 months; demand is a flow off current cash |
| bank dividend | **inert** — no credit sector, so no earned profit to distribute |
| the invest rule itself | **works** — self-limits, keeps the sustainable market alive |

The economy is structurally demand-deficient, and there is no free demand lever.
Sustained purchasing power must be a **flow from genuine production**, not a
stock or a redistribution knob. The one untested "proper" path to dividend
income is a real **credit sector**: bank lends → funds productive investment →
earns interest → positive equity → shares → dividends → household income that
does not bankrupt producers. That is the missing half of the economy, and a
build in its own right, not a toggle.

## Verification

- `./verify.sh`: `deno check` clean, **171 passed / 0 failed**, byte-identical
  replay holds. All additive; frozen fixtures and `fertility`/`bear` untouched.
- New tests: `src/world/invest_test.ts` (8), `src/bridge/invest_test.ts` (3),
  `src/world/kin_test.ts` (+5 special-birth).

## Next

- **Build the credit sector** — the only lever left that adds real demand.
- Or **ship this** (invest + births) as a reviewed PR off `price-discovery`.
- Scratchpad harnesses used to find the above (not in the repo): `probe.ts`,
  `machineday.ts` (naive-vs-smart invest), `undercut-sweep.ts` (the price and
  income sweeps).
