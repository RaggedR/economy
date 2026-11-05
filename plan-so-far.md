# Economy Simulation — Modelling Plan

Companion to `prompt-so-far.txt` (the spec). This file is the *how*.

---

## 0. The one architectural decision

Two ways to model this:

- **Equilibrium (DSGE-style):** write equations, solve for market-clearing
  prices. **Rejected** — it *assumes* markets clear, baking in full
  employment and no gluts, which buries the exact phenomena we want
  (unemployment, unsold inventory, deflation).
- **Agent-Based + Stock-Flow Consistent (AB-SFC):** simulate heterogeneous
  agents acting on simple rules tick by tick; let prices, employment and
  money be whatever the interactions produce. **Chosen.** Disequilibrium is
  the point, and here it is *emergent*, not forbidden.

The **SFC** half is non-negotiable: every dollar comes from a named source
and lands in a named destination — **no leaks**. That invariant makes the
money-creation-through-debt mechanics correct by construction.

**Corollary — NO agent models the economy (anti-homunculus).** A direct
consequence of choosing AB over equilibrium: no agent may hold a model or
forecast of the *whole economy*. Every decision uses **local rules over
observed/disclosed state with naive (adaptive) expectations** — never
rational-expectations DCF. In particular the **bank does not forecast**: it is a
mechanical secured lender (LTV gate on real estate + mine land, mark-to-market,
margin call — §5), with the LTV *haircut* as its entire risk model. The only
forward-looking credit (the direct debt market, §prompt-11d) uses a **one-line
coverage heuristic** over the borrower's JSON, not a simulation; the *market*
prices risk, not any agent's brain. **If a design ever seems to need "a model of
the economy inside the economy", that is the rational-expectations trap
re-entering — reject it.** (Machines are excluded as collateral for the same
spirit of simplicity *and* because they are wrong-way risk — see §5.)

Prior art to build on (do not reinvent):
- **Minsky** (Steve Keen) — SFC monetary dynamics via "Godley tables".
- **Caiani, Godin, Guerini, Lavoie, Stiglitz (2016)** benchmark AB-SFC model;
  the **JMAB** framework. Our economy is essentially a variant with a named
  mining→tech capital chain and a real-estate/collateral twist. **Read first.**
- **Acemoglu–Restrepo** task-based model — the rigorous form of the
  automation shock.

---

## 1. Sectors / agent types

| Agent | Count at seed | Role |
|---|---|---|
| Individuals | many, heterogeneous | labour + consumption + asset ownership |
| Mine | 2 | raw materials; owns/rents mining land |
| Tech company | 4 | machines from raw materials (needs both mines) |
| Supermarket | 2 | staple food (health maintenance) |
| Luxury supermarket | 2 | premium food (health boost) |
| Nightclub | 3 | happiness |
| Public hospital | 1 | health (govt-run, tax-funded) |
| Private hospital | 1 | health (paid) |
| Public university | 1 | education (govt-run); hires teachers + bureaucrats |
| Private university | 1 | education (paid tuition); hires teachers + bureaucrats |
| Government | 1 | taxes in; hospitals + public uni + wages out |
| Bank | 1 | credit, deposits, **fixes interest rates** |

Individuals are sub-typed by endowment, not hard-coded class: **worker**
(labour income), **owner-occupier**, **rentier** (houses + land + debt
holdings, little/no labour — there is no equity to hold, §prompt-4). Behaviour
is identical; outcomes differ by what they were seeded with.

**The indigenous people — the seed capital source.** At t0 the indigenous class
owns *all* mining land and the mines, giving them a strong steady income
(raw-material sales + land rent), 10 house-units each (reproduction-eligible
immediately), premium consumption, and surplus they deploy as **loans to
entrepreneurs** (debt only — no equity exists, §prompt-4) (§prompt-6/-10). Two
modelling consequences: (i)
**raw materials are FINITE but ample** (REVISED from "bottomless") — total stock
is calibrated to *just* reach full automation, so materials don't bind early,
but mines deplete, run out, and tighten over time (a slow rising-input-cost
drag, and a slowly shrinking bank-lending base, §5); (ii) **all capital
initially radiates from one class** — every start-up's debt finance and much of
the early credit originates with the mine-owners, so the capital market has a
single gravitational center at t0, and whether it stays centred there is a
headline distributional *outcome*. The mine→tech **raw-materials market** is a
sixth, intermediate market with competing mine sellers — no own panel; its price
shows as an input-cost line on the Machines panel.

---

## 2. The two SFC matrices (the state and the law)

### Balance-sheet matrix (stocks)
Rows = instrument/asset; columns = sector. Sign: `+asset / −liability`.
Each **financial** row sums to **zero** (every asset is someone's liability).
**Real** rows (houses, land, machines, inventory) do not — their sum is real
wealth.

Financial instruments: `deposits, bank_loans, market_debt`. There is **one
type of debt** on the direct market (`market_debt`): an amortising fixed-rate
term loan (amount + rate + fixed monthly payments to a maturity date), issued
**identically** by any entrepreneur, tech entrepreneur, or the government, and
buyable by **any agent clearing a savings threshold** (§prompt-11d). `bank_loans`
is the separate collateralised bank-credit channel (§5). There is **no equity
instrument** — entrepreneurs own firms outright (§prompt-4); a firm's net worth
sits on its owner-household's balance sheet, not as tradeable shares.
Real stocks: `houses (sized), mining land (sized), machines, inventory`.

### Transactions-flow matrix (flows / tick)
Every **row** sums to zero (a payment received is a payment made) and every
**column** sums to zero (each agent: income − spending = Δ net financial
assets). Capital-account rows `ΔLoans, ΔDeposits, ΔBonds` are where
**money is created and destroyed**.

Flow rows: wages; consumption (staple food, premium food, private medical,
public medical, housing rent, nightclub); intermediate (raw materials,
machines); land rent; interest; taxes; **owner profit-draw** (the sole-owner
entrepreneur takes firm profit as personal income — there are no dividends);
asset trades; + the three capital rows.

---

## 3. Household optimization (the keystone)

Each individual carries two **welfare stocks** that *decay* each tick and are
replenished by consumption — stock-flow structure mirroring money:

```
happiness_{t+1} = happiness_t·(1−δ_q) + Σ(nightclub, house-size)      [unbounded above]
health_{t+1}    = min( health_t·(1−δ_h) + Σ(luxury food, private hospital) ,
                       H_max(happiness_{t+1}) )                        [capped by happiness]
```

**The coupling matters for the optimizer.** Both stocks are unbounded above and
bought in any amount (supply permitting), but **happiness caps health** —
`health ≤ H_max(happiness)`, an increasing ceiling ("you can only be so healthy
if you're not happy"). Consequences: (i) spending on medical/luxury-food past
the ceiling is *wasted*, so a rational agent interleaves happiness purchases to
lift the cap first; (ii) even a **pure health-maximiser must buy happiness** —
the two welfare axes can't be optimised independently, which kills the naive
"spend everything on the one stock my objective names" strategy and couples
demand across the nightclub/house and hospital/luxury-food markets.

**Per-turn order (strict):** collect income (wages + rent received + debt
repayments owned + mine-land yield) **plus the government's free in-kind health
& education** → buy food (or die) → [pay rent, only on real-estate day] →
welfare & education (happiness, health, private education — happiness capping
health) → investment (property/mine-land, then debt) → save the remainder. Same
necessity-first shape as the entrepreneur (§4b) and government.
Because rent is one big annual lump while food is monthly, eleven months are
cheap and the twelfth carries a rent spike — eleven months of apparent solvency
can mask a household that can't make the annual payment (the §4e eviction
cliff).

**Goods → welfare map**

| Purchase | Provider | Boosts | Nature |
|---|---|---|---|
| Staple food | supermarket | health (maintenance / survival) | necessity |
| Premium food | luxury supermarket | health (+) | discretionary |
| Private medical | private hospital | health (++) | semi-discretionary |
| Public medical | govt hospital | health (+) | subsidised |
| Housing quality | own/rent | happiness | shelter = necessity, size = discretionary |
| Nightclub | nightclub | happiness (+) | discretionary |

**Objective — configurable per agent.** Each individual is assigned an
objective weighting; the population is a *mix* of types, and outcomes depend
on the mix:

```
U = w_health·ln(health) + w_happy·ln(happiness) + w_edu·ln(education)
      + w_save·ln(savings) + w_invest·ln(net worth)
```

Five strategies sprinkled at random: **happiness, health, education, savings,
investment-revenue** — one weight dominant each. Log → diminishing returns.
Income = wages + rents + interest + (for entrepreneurs) owner profit-draw −
interest paid.

**The dependency chains make every strategy secretly multi-objective** — this
is the point, not a nuisance:
- *health* can't rise past `H_max(happiness)`, so a health-optimiser is forced
  to buy happiness too;
- a *good job* needs health (healthiest-wins hiring), so an education-optimiser
  must keep health up — a three-link chain *education → health → happiness*;
- so a "pure" single-objective agent is impossible; the couplings drag every
  optimiser into spending across several markets.

**Opposite housing signatures (sets rental supply endogenously).** A
*happiness*-optimiser buys real estate for own-use and **withdraws** it from the
rental pool; an *investment*-optimiser buys real estate **to rent out** and
**supplies** the pool. So the random strategy mix *is* the determinant of rental
supply (and thus rent levels and homelessness) — a population heavy in
happiness-optimisers starves the rental market; one heavy in
investment-optimisers floods it. A dial worth sweeping in experiments.

**Budget splits three ways — spend / invest / save:**

- **SPEND:** rent, food, entertainment, health.
- **INVEST:** real estate, mine land, company debt, govt debt (no equity, §prompt-4).
- **SAVE:** hold cash (the precautionary buffer).

The marginal-utility-per-dollar fill now ranges over *all three* — an
investment-optimiser routes marginal dollars into assets; a health-optimiser
into food/medical — so the spend/invest/save split is itself emergent from
the agent's configured weights, not fixed.

**The exclusion loop (init + coupling + hiring rule, together).** Everyone
starts at health 10 / happiness 10. Free government health makes health *drift
up*, but **happiness is never free** (bought at nightclubs or via bigger/more
real estate) and it **caps health** — and job day hires the **healthiest**.
Chain those: income → buy happiness → raises the health ceiling → gets
healthier → wins job day → income. The unemployed run the chain in reverse:
free health alone can't lift them far because, lacking income, they can't buy
the happiness that raises their ceiling, so they stay low-health and **lose
job-day competitions to the employed**. The employed stay employable; the
unemployed get locked out. The poverty trap is now *executed by the hiring
rule itself* — and because rehiring only comes round on job day, each lockout
lasts half a year to a year, long enough for the health gap to widen before the
next chance.

**Allocation rule (the design choice):**
- **Myopic / buffer-stock, NOT intertemporal.** Per-period greedy allocation
  by *marginal utility per dollar*, keeping a precautionary cash buffer.
  Reasons: intertemporal optimization needs price/income forecasts
  (unrealistic) and re-imports the equilibrium assumptions we rejected; and
  precautionary buffers let the **paradox of thrift / velocity collapse
  emerge** in a downturn instead of being assumed.
- **Necessity first:** staple food and shelter are a first claim on the
  budget.

**Two hard feedback rules (and the micro-spiral they create):**

- **Homeless ⇒ health = 0.** No house owned or rented drops health to zero
  immediately. Shelter is absolute; rent is the hardest constraint.
- **Low health ⇒ harder to get hired.** Employers prefer healthy applicants,
  so job-match probability rises with health.

Together these form a **poverty trap** that is *structurally identical to the
macro debt-deflation spiral*, one level down:

```
job loss → income↓ → can't pay rent/food → health↓ → employability↓ → job loss…
```

This fractal self-similarity (the same self-reinforcing-collapse structure at
the micro health–employment scale and the macro debt–deflation scale) is a
feature worth instrumenting: the automation shock lights *both* spirals at
once, and a worker can fall into the micro-trap even before the macro one
engages.
- Because `dU/d(health) = α/health`, a sick or poor agent *automatically*
  prioritises food and medical over nightclubs — the sectoral order of
  demand collapse (nightclub → luxury supermarket → staple) falls out of the
  optimization, it is not scripted.

**Mortality — death = starvation, and it can strike the illiquid.** Health → 0
does *not* kill. A homeless agent lives at health 0 and still receives public
health and education (§5), so that state is **recoverable**. An agent dies only
of **starvation — no food this tick**. The earlier "never die while holding
property" is **wrong and corrected**: real estate sells *only* on the annual
real-estate day (§prompt-12), so it is **illiquid between those days**. A
house-rich but cash-poor owner who runs out of savings mid-year therefore
**starves while waiting for the market to open** — death by *illiquidity*, not
insolvency. The only mid-year means to food are cash and **mine land** (traded
monthly); houses cannot be sold in time. So the lethal edge is "the illiquid,"
which is wider than "the propertyless." A death frees any rented dwelling and
defaults any loans → bank seizes collateral → feeds asset-price falls.

**Circuit-breaker (why the micro-spiral is escapable).** Because public health
(§5) restores health even to the homeless, the health→employability spiral is
*not* a one-way ratchet — a homeless agent treated back up can re-qualify for
work, and public education lets them climb §3b. The trap's severity is
therefore a **function of public hospital/university funding** — a policy dial,
not a fixed doom. What the state never supplies is cash, housing, or food, so
starvation at the very bottom stays possible.

Concretely, the free allocation each citizen gets is **public production ÷
population** — an egalitarian split of what the public hospital and university
actually *produced* this turn with their machines and workers (§prompt-5). So
the circuit-breaker **weakens endogenously**: fire public workers (austerity),
run too few public machines, or grow the population, and the per-capita free
health/education falls — i.e. it fails precisely in a downturn or a demographic
boom, when it is needed most. The government's own turn order (tax → pay/fire
workers → debt interest → borrow more → distribute) makes *firing public
workers* its adjustment valve, so a fiscal squeeze directly thins the safety
net and adds to unemployment in the same move — a public-sector amplifier of
the §1 downturn.

**Stabiliser-or-amplifier is itself emergent (resolved, §prompt-5).** The
government *tries* to be counter-cyclical — it would rather borrow than fire in
a downturn. But whether it can is decided by the debt market: its crisis JSON
(tax revenue down, obligations up) is exactly what makes savers decline or
demand a ruinous rate, and in a deflationary slump cash itself earns a positive
real return, so lending must beat the mattress. The only savers left to ask are
the rentier/indigenous class — so **the richest agents hold the fate of the
safety net**, and they win either way (lend → collect interest from the state;
refuse → austerity, then buy the cheap dip). The headline consequence for the
whole model: **whether a fiscal *exit* from the §1 nightmare exists is not a
policy knob — it is an emergent property of the savings distribution at the
moment of crisis.** This is the model's sovereign-debt / bond-vigilante
dynamic, and it means the simulation can genuinely *trap itself* with no way
out, which is the honest outcome rather than a scripted recovery.

---

## 3b. Education — the third stock, and the gate

Education is a **third stock, but categorically different** from health and
happiness: it is *not* an argument of the utility function (you don't enjoy
education directly here) — it is **human capital that gates which jobs you may
hold**. It is produced by universities and acquired by individuals over
several ticks.

**Job-eligibility matrix** (minimum education by job):

| Job | Min education |
|---|---|
| retail / hospitality | low |
| machine operator (simple machines) | low–medium |
| machine operator (complex machines) | medium–high |
| bureaucrat | medium |
| teacher | high |
| doctor | high |
| **engineer** — *produces* current-gen machines (the EXPAND role) | high |
| **advanced engineer** — *upgrades* to the next generation (R&D; starts empty at t0) | **highest** |

A worker can only take a job whose education floor they clear. **Retraining =
acquiring education = enrolling at a university for several ticks** — this is
the concrete form of the "slow retraining" friction flagged in the labour
market. The displaced bureaucrat cannot instantly become a doctor; they must
first clear the education gate, which costs time and (for private uni) money.

**The honest wrinkle this creates.** Education is inherently an
*intertemporal investment*: you pay now (tuition + forgone wages) for a
*future* wage gain. A purely **myopic** household (§3) would therefore *never*
enrol — it only sees this period's utility. Resolution: treat education as a
**separate heuristic investment decision**, not part of the per-period utility
fill. A simple, defensible rule:

> enrol if affordable (or public-uni free) AND expected lifetime wage gain
> from the next tier, discounted, exceeds the cost — with bounded lookahead.

This keeps the rest of the model myopic while letting the one genuinely
forward-looking decision be forward-looking. Flag as a key modelling choice.

**Two consequences that matter for the thesis:**

1. **Intergenerational trap (second inheritance channel).** Low education →
   low-wage jobs → can't afford private uni / can't forgo wages to study →
   children seeded with low education → repeat. This is the *second* channel
   of the intergenerational divide — alongside asset ownership — that the
   model can now exhibit and *measure*. (Public university is the designed
   circuit-breaker; whether it's funded enough is a policy experiment.)

2. **Automation shifts labour demand UP the ladder.** More complex machines
   displace low-education operators/bureaucrats but *require* high-education
   engineers to build. So the shock doesn't just reduce labour demand — it
   **moves the demand to the top of the education distribution the displaced
   cannot reach**. Education becomes the binding constraint, and the
   unemployment is *structural*, not merely cyclical. This is the mechanism
   behind "this time is different": the escape ladder exists but its rungs
   are gated by a stock that takes years to build.

---

## 3c. Reproduction — endogenous population, propertied fertility

**Rule:** children are an *option for owners only* (renters cannot
reproduce), gated by real estate held: **≥10 units for children, +5 per
additional child**. A child spawns as a full new agent, housed under the
parent's property, starting in the **retail/hospitality** tier (lowest
education). Population is thus endogenous — births and deaths (§3 mortality)
both move it.

This is the **third inheritance channel**, stacked on assets (§7) and
education (§3b), and it's the most radical:

1. **The divide becomes demographic, not just distributional.** Renters are a
   reproductive dead-end; only the propertied have children. Run the model long
   enough and the population isn't a fixed set of agents with an unequal
   distribution — it is **increasingly *composed of* the descendants of
   owners**. Inequality stops being about who has what and becomes about *who
   exists*. (This is a strong, almost Malthusian assumption — worth stating
   plainly to the modeller, because it will dominate long-horizon runs.)

2. **Shelter is inherited; skill is not.** A child starts *housed* (escapes the
   homelessness trap at birth) but at the *bottom* job/education tier. So the
   parent transmits the shelter + the future *option to reproduce* (if the
   child ever acquires property), but education must still be earned up the
   §3b ladder. The two inheritance channels interact: owners' children have the
   buffer (a roof) to afford university; renters have no children to send.

3. **Inheritance — RESOLVED, and it's two opposing forces at once (§prompt-2d).**
   - **Die *with* children → undivided PRIMOGENITURE:** the first child inherits
     *everything*. This is the *most concentrating* inheritance regime possible —
     property compounds within one bloodline, undivided, generation on
     generation (full Piketty `r > g` *with heredity*). Younger children get a
     10-unit split-off at most (§2c), or nothing — a feudal firstborn-line /
     cadet-branch structure.
   - **Die *without* children → RADICAL REDISTRIBUTION + DEBT JUBILEE:** the real
     estate is cut into 10-unit pieces handed to **random homeless** people (each
     instantly a housed, reproduction-eligible owner), **and all debts in the
     estate are cleared both ways** — the decedent's creditors are written off,
     the decedent's borrowers are freed. So a childless death is *purely*
     anti-concentration: houses to the bottom, debt dissolved. And it has a
     **macro kick**: in a death-wave (a crash/famine), mass childless deaths
     **cancel debt en masse** — a grim *debt jubilee by mortality* that partly
     brakes the §1 debt-deflation spiral by destroying the very debt that was
     compounding, while handing the dead's houses to the homeless.
   - **The model now contains both the strongest concentrator and a strong
     leveller, and which dominates is EMERGENT** — it turns entirely on *how
     often property-owners die childless*. Note the selection: renters can't
     reproduce, but they also own no real estate to redistribute; so the
     leveller only fires on the estate of a *propertied* agent who died
     childless. Whether that's rare (owners reliably have a first child → near-
     pure dynastic concentration) or common (lifts the homeless regularly) is a
     headline distributional outcome to measure, not assume. **This is the
     single most important dynamic in the long-run model**, and it's now a live
     tension rather than an open question.

4. **A generational slow mode — the slowest in the system.** Fertility is
   pro-cyclical (property values up → more eligible owners → more children),
   but the labour-supply effect lags by a childhood (many ticks). This adds an
   **even-lower-frequency mode** than housing (§4e): booms breed labour bulges
   that arrive *years later*, possibly into a slump — a demographic overshoot.
   The multiscale stack is now: monthly (goods/labour/credit) ≪ annual
   (housing) ≪ generational (population).

5. **Property becomes a reproductive good.** Because fertility is gated by real
   estate, owners may buy property *to unlock children*, not only for yield —
   a **reproductive premium** that can push house prices above what rents alone
   justify. Demographics thus feed back into the capital/housing market, not
   just out of it.

**Household fission (splitting).** A child lives under the parent's property
until the parent *chooses* to split it off, permitted once parent+child hold
**≥20 units** (each keeps ≥10). On split the child takes a 10-unit dwelling and
becomes independently eligible to reproduce. So **household formation is itself
gated by real estate**: a propertied lineage spawns new 10-unit households as
it accumulates land — buying the 20th unit is simultaneously an *investment*
and the *creation of a new household*. This also answers "when does a child get
its own dwelling": at the split, parent's discretion. (Inter-vivos transfer is
thus specified; inheritance *at death* is still the OPEN question that decides
whether dynasties compound — §prompt-OPEN.)

---

## 4. Firm behaviour (closures)

One engine, parameterised per type:
1. **Price** = markup over unit cost, adjusted by inventory (inventory above
   target ⇒ cut price). ← the **deflation generator**.
2. **Output** = expected demand (adaptive: last period's sales).
3. **Input mix** = pick machine generation(s) to meet target throughput at
   least cost; labour demand is *derived* as machines × ops_per_machine (see
   §6). ← the **automation margin**.
4. **Investment**: buy machines when expected return > real cost of capital;
   finance from retained profit + bank loan (needs collateral).
5. **Hire/fire** by job type to hit planned output given capital.

Supply chain: mines → raw materials; 4 tech cos → machines (need both mines);
consumer firms buy machines as capital. The capital-goods sector is
Samuelson's **accelerator** — investment responds to the *change* in output,
which is what makes the system oscillate.

---

## 4b. The tech entrepreneur — automation's *supply* side

The generic firm closure (§4) *buys* machines; the **tech firm sells them**,
so it needs its own closure. Its entrepreneur makes three nested choices each
tick.

**(A) Product generation — what to sell.** Stay on the current generation
(regular engineers + mine inputs, lower price) or pay to move the product up
one generation (advanced engineers, higher sale price). *This is the only
place new machine generations are born.* The economy-wide `ops_per_machine`
ladder therefore descends exactly as fast as tech entrepreneurs choose to
climb the product ladder — and no faster. **The automation dial of §6 is not
exogenous after all: it is the *aggregate* of these product decisions, each
gated by the advanced-engineer supply (which is gated by the universities).**
That closes the loop promised in §6 — the governor on automation is now a
real agent decision, not a knob we turn.

**(B) Displacement vs reinstatement — the keystone choice.** When the firm
upgrades its own production machines (lower ops_per_machine) it either *fires*
surplus engineers (output fixed, cost down) or *redeploys* them (headcount
fixed, output up). This is Acemoglu–Restrepo **displacement vs reinstatement**
as a per-firm, per-tick decision. We do NOT hardcode which dominates:

```
redeploy (scale up)  iff  expected demand supports the extra output
fire     (shed)      otherwise
```

Because expected demand is adaptive (last period's sales, §4), a deflationary
downturn makes *shedding* individually rational for every firm at once — and
the shedding destroys the wage income that *was* the demand. The
**fallacy of composition** (each firm right, all firms wrong together) is thus
emergent, not assumed. This is the firm-level engine of the §1 nightmare.

**(C) The entrepreneur is a household.** Profits fork between firm
reinvestment (A/B) and the owner's personal §3 allocation: a bigger house
(happiness), mine land (**backward vertical integration** — hedging its own
input cost), or **lending to other firms** (buying their debt). There is no
equity, so concentration shows up as *debt claims + real-asset accumulation*,
not share ownership — and, because the owner takes 100% of profit (no
dividends split among shareholders), **income concentration is sharper** than
an equity economy would produce. *Reinvest vs. extract* is itself a weight in
the entrepreneur's objective.

---

## 4c. Firm entry & exit — the firm count is endogenous

The number of firms is **not fixed**. Both ends are modelled:

- **Entry.** A household crosses into entrepreneurship when its wealth clears a
  **savings threshold**. Start-up capital is raised by **liquidating assets**
  (real estate, mine land, business/govt debt → deposits; no equity exists), so entry
  *consumes* the entrant's portfolio and *moves asset prices* via the sales.
  The new firm then buys machines, pays wages + taxes, and earns by selling
  output.
- **Exit.** Default/mortality (§3): health→0 or insolvency frees assets and
  defaults loans → bank seizes collateral.

The pair is the model's **restoring force**. §7 step 4 ("survivors with cheap
machines/assets expand → recovery") is no longer hand-waved: *cheap post-crash
assets lower the entry cost*, so savings-rich households re-enter precisely
when prices are low — a counter-cyclical entry rate that can pull the economy
out of the trough, or, if savings were wiped out in the crash, *fail to*,
leaving the depressed state of §1. Whether recovery happens is then an
*outcome* of the distribution of surviving savings, not an assumption.

---

## 4d. Market protocol — posted-offer, adaptive, rationed (all four markets)

Prices are **not** cleared by an auctioneer (the equilibrium assumption §0
rejects). Every market — consumer, employment, machines, capital — runs one
**posted-offer** loop per tick: (1) sellers post, (2) buyers choose, (3) excess
demand is **rationed by random lottery** (a sell-out), (4) sellers **adapt**
next tick from feedback (sold-out → raise; unsold → cut; undercut/match
competitors). Disequilibrium is a first-class state, not an error — a sell-out
and a glut are both *data the agents act on*.

Per-market specialisations that carry the dynamics:
- **Consumer (§11a):** demand is **sticky** — one subscribed provider, a
  switching cost to leave. Stickiness is load-bearing: it lets unsold inventory
  *persist*, so a price cut need not win back demand — which is how the model
  sustains a glut *into* deflation instead of clearing it away.
- **Employment (§11b):** opens only on **job day** (annual, 6 months offset
  from real-estate day). Eligibility gated by education; the **incumbent has
  first preference** (same-salary retention, mirroring the sitting tenant), and
  among other eligible applicants the **healthiest wins**. Wage rises only by
  winning a higher-salary listing on job day — no continuous poaching. **Firing
  can happen any month** (automation/distress) but **rehiring only on job day**,
  so job loss is a *durable* 6–12-month event, not a blip — which is why the
  savings buffer is life-or-death (§2b starvation). Labour is therefore **not**
  fluid month-to-month; it is sticky-by-calendar, the opposite of what I wrote
  before.
- **Machines (§11c):** homogeneous good, price competition among tech cos,
  sell-outs push producer prices up. This is the *supply price of capital* — it
  gates the §4b upgrade decision.
- **Capital (§11d):** posted-ask with a buyer lottery, **plus the mirror rule**
  — excess sellers force the ask *down*. That falling branch is the margin-call
  amplifier of §5; it must be implemented symmetrically or the debt-deflation
  spiral is unreachable.

Random rationing is the only stochasticity in matching — **seed it** so runs
are reproducible (bears on the §8 serialisation/run-ahead concern).

---

## 4e. The clock & the two annual market-days (the slow variables)

**Tick = one month; 12 ticks = one year.** Monthly activity runs every tick,
but **two** markets open only once a year, on their own day, **six months
apart**: **real-estate day** (housing — rent + buy/sell) and **job day**
(employment — hiring/switching). Schedule: month 0 real-estate, month 6 jobs,
month 12 real-estate, … Two annual bottlenecks offset by half a year give the
oscillator a **forcing comb at 6- and 12-month harmonics** — richer than a
single annual forcing, and more prone to lock the cycle onto the calendar.
Job day's own bite: firing happens any month but rehiring waits for job day, so
unemployment is a **durable 6–12-month trough**, which is what makes the
savings buffer life-or-death. The housing mechanism (the other day) gets its
own treatment below.

**Housing mechanism (annual).** Each real-estate day, per property: the owner
re-advertises rent; the **sitting tenant has first refusal**; other applicants
are ranked by **salary/job title** (not lottery, not health — a third
rationing rule, matching §prompt-12); **rent is paid a full year upfront** and
a would-be tenant who can't front the year fails to secure it; an individual
left with no dwelling has **health → 0** (§3). Owners may instead list the
property **for sale**, buyers resolved by **random** draw.

**Four emergent consequences worth instrumenting** — none scripted:

1. **Annual liquidity cliff → a sawtooth, not a slide.** A year's rent due in
   one lump means a worker who lost income in month *k* can limp on until the
   next real-estate day, then be evicted *all at once* with everyone else in
   the same position. Discrete lumpy rent converts a smooth income decline into
   a **synchronised annual eviction step**. Expect the homelessness/mortality
   series to show *year-boundary cliffs*, not gradual drift.

2. **Real-estate day is where the divide is executed.** Income-ranked
   applicants mean that in any squeeze landlords swap unemployed/low-paid
   tenants for higher-paid ones. The housing reallocation of §7 (houses migrate
   to the strong) doesn't happen continuously — it happens *on this one day*,
   which is therefore the model's main distributional event.

3. **Frequency separation / phase-locking (ties to §1's oscillator).** Housing
   is now the system's **slow variable** (annual) coupled to fast monthly
   variables (wages, prices, credit). This is a textbook multiple-timescale
   system — and a periodic annual *forcing* term. If the endogenous
   debt-deflation cycle has a period near an integer number of years, the two
   can **phase-lock / resonate**, clustering crashes at year boundaries. The
   derivative/oscillator framing from the first conversation now has a concrete
   forcing frequency to resonate with.

4. **Upfront rent manufactures precautionary saving — and asset sales.**
   Rational tenants must hold a **12-month rent buffer**, raising the
   precautionary cash weight (feeding the paradox of thrift / velocity
   collapse). And the lumpy outflow can itself *force asset sales* to raise the
   year's rent on the day — a direct monthly→annual coupling from the capital
   market into housing.

The sitting-tenant-first rule is a **stabiliser (hysteresis)** pulling against
consequence 2; the balance between incumbency and income-ranking sets how much
housing churn a downturn produces. That balance is a dial worth exposing.

---

## 5. Bank & credit (the financial accelerator)

- **Single bank, fixes the interest rate** (exogenous policy lever we can
  shock). Loan rate = fixed rate + risk markup.
- **Mechanical secured lender — no forecasting.** Approve a loan iff
  `collateral_value × LTV ≥ loan`. Collateral = **real estate or mine land
  only** (a firm's entrepreneur pledges *personal* property — a personal
  guarantee linking firm risk to household risk). The bank does **no DCF** and
  holds no model of the economy; the LTV haircut is its whole risk model. The
  decision is a smart-constructor gate, `Ok | Refused`.
- **Machines are never collateral** — wrong-way risk: a firm usually fails
  *because* its machines are an obsolete generation, i.e. exactly what nobody
  will buy. Excluding them also removes any need for a second-hand machine
  market (machines depreciate to scrap, not resale).
- **Mark collateral to market every tick**; issue margin call / foreclose
  when collateral value falls below the loan. ← the cascade amplifier. (This is
  *reactive*, not predictive — the only "forecasting" anywhere is the direct
  debt market's one-line coverage heuristic, §prompt-11d.)
- Bank equity absorbs default losses; if wiped out, credit freezes.
- Add a minimal monetary base (govt bonds / overdraft) so we can model the
  **zero lower bound** and test reflation.

**The bank's capital base is MINING LAND, at 10× leverage (§prompt-8).** The
only "deposits" the bank takes are *mining land*, not cash; it may lend up to
**10× the value of deposited mining land** — a system-wide credit ceiling
(`total loans ≤ 10 × deposited-mine-land value`), *separate* from the per-loan
LTV gate. Depositors are quasi-shareholders: they forgo the land's rent for a
**yearly dividend from the bank's profit** (interest earned − losses) — the
*one* dividend in the whole model (companies pay none).

- **Terminology hazard (for the SFC core):** "deposit" now has **two senses** —
  the monetary deposits of the ledger (cash balances, the broad money) and the
  **mining-land capital** contributed to the bank. Keep them as distinct
  instruments in `types.ts`; do not let the balance sheet conflate them. The
  bank's *dividend* is a new flow row in the transactions-flow matrix (the lone
  exception to "no dividends").
- **Pro-cyclical amplifier (a second financial accelerator).** The capital base
  is endogenous: good years → high dividend → agents deposit more land → ceiling
  rises → more lending → boom; crash → defaults/fold losses cut profit →
  dividend falls → depositors *withdraw* land → ceiling falls → **forced credit
  contraction exactly when borrowers are most stressed**. So the model now has
  *two* accelerators — the collateral mark-to-market (above) *and* the
  mining-land capital base — and a crash **bites the depositors (the wealthy)**
  via a collapsing dividend. A mining-land "bank run" is a real failure mode.
- **Concentration at t0:** mining land starts entirely with the indigenous, so
  they own the mines, *capitalise the bank, and collect its dividend* — triple
  financial concentration from the first tick.
- Open (flagged in §prompt-8): how deposited-land value is marked for the 10×
  cap; withdrawal cadence (any month vs a set day → run dynamics); and whether
  the bank calls loans when withdrawals push the ceiling below outstanding loans
  (forced deleveraging).

---

## 6. The automation shock — a single parameter

The shock enters through **one dial**, exactly as specified:

```
ops_per_machine(type, generation)  — operators of the matching class needed
                                     to run one machine. Falls with generation;
                                     the "shock" accelerates the fall.
```

**Machines** carry a `type` (medical, admin/bureaucratic, mining, retail,
hospitality, …) and a `generation`. **Operators** come in matching classes
(a *bureaucrat* is the operator class for admin machines). A firm's labour
demand for class T is therefore not free-standing — it is *derived* from its
machine stock:

```
operators_needed(T) = (# machines of type T) × ops_per_machine(T, generation)
```

**Firm's capital/labour choice** (replaces the abstract CES): to deliver a
target throughput in function T, the firm picks a machine generation to
minimise cost:

```
cost(gen) = n_machines(gen)·(price(gen) + upkeep + loan interest)
          + n_machines(gen)·ops_per_machine(T,gen)·wage(T)
```

A newer generation has higher `price` but lower `ops_per_machine`. When the
newer generation wins, the firm **borrows (needs collateral), buys it, and
fires the surplus operators** — the hospital example: advanced admin machines
→ fewer bureaucrats per machine → bureaucrats fired, same throughput.

**Supply side — why the pace is endogenous.** Tech companies *choose* which
(type, generation) to build. Producing *more of the current* generation needs
only regular **engineers** (the EXPAND path); building a *higher* generation
requires scarce **advanced engineers** (the UPGRADE path, top of the ladder).
So:

```
pace of automation  ⟵  supply of advanced machines
                    ⟵  supply of engineers
                    ⟵  universities / the education stock
```

This is the elegant closure: **the same automation that strands low-education
operators is throttled by high-education engineers.** The education system is
the governor on the whole dynamic — which makes university funding (public vs
private) a lever that controls not just inequality but the *speed of the shock
itself*. Academic lineage: this is a concrete, firm-level realisation of the
Acemoglu–Restrepo task-based model (operators-per-machine ≈ the labour share
of tasks; falling it = automating tasks).

---

## 7. What should EMERGE (validation targets)

With only balance sheets + the rules above + the shock, the cascade we derived
analytically should appear, in order:
1. Automation fires → tech + mines boom, hire operators (output surges).
2. Bureaucrats/operators fired → wage income falls → households cut the
   *residual* first → nightclub then luxury-supermarket output and prices fall
   → **deflation**.
3. Deflation raises real debt → defaults destroy deposits (money shrinks) →
   collateral dumped → asset prices fall → margin calls → more defaults
   (**debt-deflation spiral**).
4. Debt cleared by default, or government deficit-spends into the hole →
   survivors with cheap machines/assets expand → recovery.

Read off the end-state balance sheet: did houses and mining land **migrate to
the rentier column** (wealth concentration) and did the **health/happiness gap
widen** even as total goods output rose? That is the distributional nightmare,
made measurable.

> **Remark — the dark stabiliser.** Do *not* expect (or engineer) a clean
> recovery. This model has a built-in damper that is *mortality itself*: a
> childless death clears debts both ways and scatters houses to the homeless
> (§3c / §prompt-2d), so a death-wave in a crash is a **debt jubilee by
> mortality** — negative feedback that lets the economy find a floor through
> *attrition* rather than rescue. The honest emergent outcome is often a
> smaller, poorer, de-levered population that stops spiralling because the debt
> (and the debtors) died, not because policy fixed anything — and the losers are
> disproportionately the **lenders** (the wealthy), whose loan books the deaths
> destroy. A run that bottoms out this way is a *correct* result, not a failure
> to model recovery. Never patch in a scripted upturn to avoid it.

---

## 8. Implementation status & path

- [x] **Accounting core** (`absfc_core.py`, in this directory): balanced
      double-entry ledger, money primitives (`pay`/`lend`/`repay`), invariant
      asserted after every transaction. **Verified:** money supply ≡ loans
      outstanding; repayment destroys money. (`python3 absfc_core.py` runs the
      four-step endogenous-money demo.)
- [ ] **Gold two-layer log + CLI + gates** — replace the core's toy `ledger`
      (a list of strings) with Layer-1 audit + Layer-2 intent-log +
      reconciliation; wrap mutations in `--reason`-gated CLI subcommands (§10).
      **Prerequisite for the dashboard.**
- [ ] **Household layer:** welfare stocks + myopic utility optimization +
      heterogeneous seeded endowments.
- [ ] **Firm layer:** pricing/inventory, input mix, investment, hire/fire.
- [ ] **Markets:** labour matching (by job type, slow retraining), goods
      (price adjusts to inventory), credit (collateral/LTV), asset (house/land
      prices from excess demand).
- [ ] **Government + minimal monetary base.**
- [ ] **Automation shock** protocol + scenario runner.

**The invariant to assert every tick** (worth more than any test suite):
each transactions-flow column sums to zero, and total deposits = total loans
+ base money. A non-zero column *is* a money leak — a bug caught instantly.

Build order: get the accounting to balance with trivial behaviour FIRST, then
layer behaviour one piece at a time, re-checking the invariant, and only then
introduce the shock.

Language: Python (Mesa) for legibility, or Julia (Agents.jl) for speed.

---

## 9. Aside — the categorical structure

SFC double-entry is secretly a functor into the category of abelian groups
(T-accounts as the Grothendieck group of differences, transactions as
morphisms, the balance condition as a conservation law). If we want
correctness to be *structural* rather than *asserted*, that's the lens.

---

## 10. Logging, audit & the dashboard — the gold-demo discipline

This economy is **not merely compatible with** the gold spine — it is a
**treasury-pole gold demo** almost exactly. Treasury's defining amalgamation is
"sub-balances **sum** up a chart of accounts; debits = credits." That *is* our
SFC invariant — the `check()` in `absfc_core.py` (every instrument sums to
zero) is the treasury fold, already running. So we inherit the whole spine; we
do not invent a logging scheme.

### The gates ARE the economic rules (the reason the fit is so clean)

In a gold demo, every mutation passes a **smart-constructor gate** returning
`Ok(effect) | Refused(reason)` — a refusal is a *position*, not an exception.
In this model, **your economic rules are already exactly these gates**:

| Mutation | Gate (Ok / Refused) |
|---|---|
| rent a home | year's rent upfront? else `Refused` → homeless → health 0 |
| take a job | education floor cleared? else `Refused` |
| borrow | collateral ≥ loan/LTV? else `Refused` |
| have a child | own ≥ 10 units (+5/child)? else `Refused` |
| split off a child | parent+child ≥ 20 units? else `Refused` |
| buy food | has cash or property to liquidate? else → **starvation** |

Nothing is bolted on: the permission model and the economics are the *same
object*. An illegal action can't be represented, only refused-with-a-reason.

### The two-layer log (what the dashboard reads)

- **Layer 1 — the ledger/ship's-log (WHAT).** The CLI's own append-only audit:
  every *committed* mutation — each SFC transaction, market fill, hire/fire,
  loan, machine upgrade, birth, death, rent payment — with a correlation id and
  **no reason**. This is literally the transactions-flow matrix, streamed.
- **Layer 2 — the intent-log (WHY).** The reasoned action behind each mutation,
  **write-ahead**: an `attempted` record with a *non-empty reason* before the
  call, then the outcome, sharing a call id. E.g. a firm's
  `"upgrade admin machines: price+interest < m·wage ⇒ fire 4 bureaucrats"`; a
  landlord's `"renew tenant B, salary 60 > applicant A's 40"`; a household's
  `"buy staple food, health 12 and falling"`.
- **Reconciliation.** Join on correlation id. **Alarm** = a committed mutation
  with no reason (must never exist). **Blocked** = a *refused* mutation, visible
  **only in Layer 2** — and this is gold dust for the dashboard: it lets us show
  not just what happened but *what was attempted and denied*. "47 households
  tried to renew rent on real-estate day and were refused for lack of the
  upfront year" — **the eviction cliff rendered as a wall of blocked
  mutations**, which the ledger alone could never show.

### The dashboard

This is the gold "visible rendering" (recipe §6). It reads **Layer 1** for the
price/fill time series of each of the four markets (consumer, employment,
machines, capital) across the months, and overlays **Layer 2** reasons as
annotations — so a price crash is shown *together with the reasoned decisions
that drove it* (ignition, the fire-vs-redeploy flips, margin-call cascades, the
annual eviction cliffs, deaths). Cross-referencing WHAT against WHY is the
whole value. Natural form: a **self-contained HTML Artifact** reading exported
JSON logs (theme-aware, publishable). *But the sim must emit gold logs first* —
the dashboard is a reader, not a source of truth.

### Determinism (so the dashboard is reproducible)

Ids and clock are **injectable seams** (`seededIds`/`fixedClock` for the
byte-identical demo, `realIds`/`realClock` otherwise). A `verify.sh` runs the
sim twice and diffs stdout **and both logs**. Never stamp a `--live` LLM run
with the fixed clock (that writes a false audit — the exact dishonesty
reconciliation exists to catch).

### The one decision this forces — language

The gold spine's **typed `Runner<C>` plug + decoder is forced TypeScript**
(dependent `(s:S)→P s`, discriminated-union exhaustiveness). Two honest paths:

- **(A) Port to the TS/Deno starship spine.** Reuse `lib/algebra.ts`, the typed
  agents, the real two-layer log, and get `--live` LLM agents *for free* — an
  LLM running a firm and *writing its own reason* into Layer 2 is the dream fit.
  Cost: rebuild the Python core in TS (a deterministic numeric toy — fine in TS).
- **(B) Keep the Python core, adopt the discipline.** Implement the two-layer
  log, the smart-constructor gates, determinism seams, and reconciliation in
  Python now — fastest path to *your dashboard* — and defer/skip the TS
  container-algebra combinators (agents stay scripted optimizers).

**Recommendation:** (B) now to unblock the dashboard quickly on the working
core, with (A) as a deliberate later port *if* we want `--live` LLM-run firms
and the full typed algebra. The two-layer log + gates + reconciliation — the
part you actually asked for — is identical either way.

---

## 11a. Key parameters & the regime map (what to tune for an interesting run)

"Interesting" = the model sits near **three bifurcations at once**:
- **cycle vs. monotone** — automation yields an oscillation, not one-way drift;
- **spiral vs. absorbed** — a downturn ignites debt-deflation, or doesn't;
- **dynasty vs. churn** — wealth calcifies into bloodlines, or keeps churning.

The boring runs are the corners (stagnation / instant death / frozen dynasty);
the interesting ones are the **edge of chaos** between them. Master dials, each
tagged with the boundary it gates:

1. **Automation speed** — the *forcing*: `(rate ops_per_machine falls per
   generation) × (engineer + advanced-engineer throughput from universities)`.
   Too slow → EXPAND forever, no displacement; too fast → instant collapse.
   **Gates cycle vs. monotone.**
2. **Leverage** — LTV + the bank's fixed rate. High → any dip Fisher-spirals;
   low → absorbed. **Gates spiral vs. absorbed.**
3. **Concentration vs. recirculation** — demand-collapse balance. Concentrators:
   primogeniture, rent/interest/land-yield, the exclusion loop, saver/investor
   hoarding. Recirculators: wages, childless redistribution, debt-jubilee-by-
   death, the sales tax. Concentration > recirculation → underconsumption glut.
   Tuned by strategy mix, tax rate, wage-vs-profit share, childless-death ratio.
   **Gates whether demand implodes.**
4. **Damper strength** — childless-redistribution rate + safety-net capacity
   (free health/education per capita) + government counter-cyclical borrowing.
   **Gates recovery vs. ratchet-to-the-attrition-floor.**
5. **Welfare coupling & decay** — `H_max(happiness)` tightness + δ_health /
   δ_happiness. Sets exclusion-loop / micro-spiral speed.
6. **Price stickiness** — seller adjustment speed + consumer switching cost.
   How fast deflation propagates and how long gluts persist.
7. **Initial conditions** — strategy-mix sprinkle (happiness-vs-investment *is*
   rental supply), t0 wealth concentration, population & firm counts.

**Tune 1, 2, 4 first** — they map onto the three qualitative questions (cycle?
spiral? recover?). **And tune RATIOS, not levels:** automation-speed vs demand-
growth, concentration-speed vs recirculation-speed, damper-strength vs spiral-
strength. Sweeping raw magnitudes mostly just rescales boring outcomes; the
bifurcations live in the ratios.

---

## 11. Dashboard spec — the five panels (CONFIRMED)

Five panels, one per market (§4d/§prompt-11 + housing split out, confirmed).
Each panel is a price time-series over **months** on a **shared x-axis**, with
Layer-2 reasons annotated so the whole cross-market cascade lines up left to
right.

| Panel | Price series | Key non-price overlay |
|---|---|---|
| **1 Consumer** | staple ×2, premium ×2, nightclub ×3, private hospital, tuition | unsold inventory / units sold (glut forming before price falls) |
| **2 Employment** | wage per job class (retail/hosp, bureaucrat, operator-by-gen, doctor, teacher, engineer, adv. engineer) | **unemployment rate** |
| **3 Housing** | rent ×3 sizes, sale price ×3 sizes | **homelessness count**; vertical markers at each real-estate day; Layer-2 spike of **refused renewals** (the eviction cliff) |
| **4 Machines** | **step-stacked** price per (type × generation) | marker at each **generation birth**; raw-material **input-cost** line (from the mines) |
| **5 Capital** | offered **interest rate by debt issuer** (one instrument; distressed issuers ratchet their rate up turn-to-turn); mine-land price | rates spiking on disclosed-distressed issuers → credit crunch; asks forced **down** in a crash (dumping / margin-call branch) |

**Layout (default chosen):** a single scrolling **column of five vertically
stacked panels sharing one x-axis**, with a **master event rail** across the
top. The vertical alignment is the point — a wage collapse (panel 2), a
nightclub glut (panel 1), the eviction cliff (panel 3), and the asset dump
(panel 5) all fall on the *same months*, read top-to-bottom. (A 2×3 grid breaks
that alignment and is rejected.)

**Data source:** exported JSON from the two-layer log — Layer 1 for
prices/fills, Layer 2 for reasons and **blocked** mutations. Rendered as a
**self-contained, theme-aware HTML Artifact**. Hovering a month surfaces the
Layer-2 reasons active across all five markets that month (the "why" behind the
"what"). Series toggleable.

**Placement defaults adopted** (the two open questions, defaulted — change on
request): house transactions (rent *and* sale, any motive) → **Housing** panel;
mine land → **Capital** panel.

**Build dependency:** the dashboard is a *reader*. It needs the sim emitting
gold logs first (path B, §10), then it is pure front-end over exported JSON.
