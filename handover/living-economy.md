# Living economy — beyond milestone 14

The staple-only ignition became a circulating town, and a comonadic sweep was
built to tune it. Three PRs on `main`: #1 (the living layer and the harness), #2
(continuous education), #3 (the welfare sweep). The milestone fixtures are
untouched: the living town rides a `{ spend }` flag on `runIgnition` and a
separate seed, `livingTownSeed`, so every earlier test still pins what it pinned.

## What landed

`runIgnition(ctx, months, { spend })` is the one entry. Off, it is the
staple-only milestone loop. On, each month also runs: `commitProduce` (the
non-staple firms make and post their good), the objective-chain buys
(`householdSpend` + `runSpend`), and `commitWellbeing`. Order inside a month is
opening → bake → produce → staple → spend → wellbeing → draw.

`livingTownSeed` post-processes `townSeed`: it diversifies objectives
(`LIVING_OBJECTIVES`), gives the health folk `d0`, adds a `jobArchive`, and puts
a generation-0 machine on each producing firm (`LIVING_MACHINES`, builder
`indigenous`, so maintenance is zero and no money moves).

- **Working capital.** `firmFloat` is a year of wages (`firmReserveMonths ×
  townWage`), and `operatingReserve` floors the owner draw at that same year of
  payroll. A firm now survives a dry spell the way a person's savings block
  starvation. The old hand-to-mouth firm is `firmReserveMonths = 1`.
- **Production.** `firmOutput` generalises `stapleOutput`; `postInventoryGate`
  generalises the staple post to any `ShelfGood`. Luxury and nightclub refill
  every month instead of selling out once. `tuitionOutput` + the existing
  `postTuitionGate` do the same for the private university — tuition is a
  service, posted directly, no inventory — so education ratchets.
- **Wellbeing.** `commitWellbeing` turns consumption into stock: a nightclub is
  one happiness, luxury food one health. It decays the prior stock first, then
  adds the month's consumption (`max(0, x − decay) + gained`), so a buyer of one
  unit a month converges to a steady one, not to zero. Derived from the month's
  flows; the market reducers are untouched.
- **The harness.** `src/analysis/store.ts` is the sweep as a lawful Store comonad
  (`extract`/`peek`/`duplicate`/`extend`/`experiment`), with comonad-law tests.
  `src/sweep.ts` expresses the grid as `experiment` and the ∂welfare/∂knob
  sensitivities as `extend`, over a deterministic, memoised readout.
  `comonadic-sweep-harness.pdf` documents the structure and the State/Store
  adjunction. CLI entries: `src/livetown.ts`, `src/sweep.ts`.

## What ./verify.sh did

- `deno check` clean across `src/`.
- `ok | 150 passed | 0 failed` (142 milestone + 8 comonad-law tests).
- `PASS: stdout, worlds and logs are byte-identical across two runs.`

Four milestone tests were re-pinned to the working-capital behaviour, with the
reasoning in the diffs: `ignition_test` (t₀ float and the 12-month trajectory —
firms now survive the year, nobody folds), `policy_test` and `purses_test` (a
firm below its year-of-wages reserve draws nothing).

## The measured finding

Over 36 months, `deno run -A src/sweep.ts` reads welfare by objective. Income is
the dominant, **non-rival** lever: raising the wage lifts health, education,
savings, thriving and the fed count together, because prices — and so firm
revenue — stay put. Cheapening a good is **rival**: it helps that good's buyers
but strips the producer, folding firms and lowering `fed`. `wage 16` is the best
all-round point in the grid. It was **not** applied: it re-pins the milestone
town for a welfare reason, and that is a deliberate baseline choice, not a knob
the sweep should bake in.

## Rulings

- The milestone town (`townSeed`) and the staple-only loop are frozen. The living
  economy is additive, behind `{ spend }` and `livingTownSeed`.
- Working capital is a reserve floor on the draw, not just a bigger float: the
  draw is what swept the float out before.
- Wellbeing decays before it accrues, so the steady state is the consumption
  rate, not zero.
- Indigenous machines (builder not a firm) carry no maintenance and move no
  money; that is how `livingTownSeed` adds them without touching the banks.
- Happiness and health are flows (decay equilibria); education and savings are
  stocks (ratchets). Each hits the same ceiling: affordability.

## Next

- **The happiness ceiling is a policy change, not a knob.** Households buy at
  most one lot per objective per month, so happiness is pinned near its
  consumption rate no matter how prices or wages move. Lifting that one-lot cap
  (spend to a target, or buy a budget) is the only lever the sweep cannot reach.
- **Apply `wage 16`?** Robin's call. It is a param change plus the milestone
  re-pin it implies.
- **Still built but not driven in the loop:** the special day (houses, jobs,
  share dividends, mine trades), the tech orders (hire, upgrade, new machine),
  and price discovery. Each would make the next objective-ceiling move.
- Cure is still one-shot (diseases are rare); only tuition was made continuous.
