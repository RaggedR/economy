# ECONOMY SIMULATION — CUMULATIVE SPEC (Robin's prompt, consolidated)
This is a faithful reconstruction of the specification as given
incrementally in conversation. It is the SOURCE OF TRUTH for what the
model must contain. The modelling approach lives in plan-so-far.md.


## 1. MACRO MOTIVATION (the phenomenon the model must be able to produce)
The "nightmare scenario": an AUTOMATION SHOCK simultaneously
  - increases the supply of goods and services, AND
  - increases unemployment, which decreases demand for goods and services.
More supply + less demand -> prices fall -> DEFLATION.
But interest on debt must still be paid out of a SHRINKING money supply.
Effective (real) interest rates rise because debt is repaid in money worth
more than it was borrowed for. This prompts businesses and individuals to
sell assets, which further deflates asset prices (a debt-deflation spiral).
High (real) interest rates kill the incentive to start or grow businesses,
so investment collapses and the economy shrinks into a depressed state.

The model's job is to let these dynamics EMERGE from micro rules, not to
assume them.


## 2. INDIVIDUALS (households)
- Expenses: Housing, food, medical, luxury, entertainment, education.
- Liquid assets: private debt, government debt, bank shares.
- Illiquid assets: real estate.
- Individuals pay NO taxes (for now).
- Each individual has HEALTH, HAPPINESS and EDUCATION, and solves its OWN
  economic optimization problem.
- Welfare effects of consumption (each lever does ONE thing, no cross-effects):
    * LUXURY SUPERMARKET -> GENERAL HEALTH ONLY (not happiness).
    * NIGHTCLUB -> HAPPINESS ONLY (not health).
    * a BETTER / BIGGER HOUSE -> HAPPINESS.
    * regular supermarket = staple food / survival (§2b food step).
    * DOCTORS (public or private hospital) do NOT boost general health -- they
      CURE DISEASES (§5c). General health comes from luxury food; disease is a
      separate, catastrophic health state cured only by a specialist doctor.
    * TEACHERS (public or private) -> EDUCATION only (§5b).
- Individuals can OWN a house or RENT.
- Individuals must OWN or RENT at least 10 UNITS worth of real estate, or
  they are HOMELESS and go to 0 HEALTH.
- Individuals may RENT OUT real estate that they own.
- Individuals can own "MINING LAND".
- Individuals may be ENTREPRENEURS.


### 2b. HOW AN INDIVIDUAL ALLOCATES MONEY (spend / invest / save)
Each period an individual divides income + wealth between:
  SPEND:   rent, food, entertainment, health, education
  INVEST:  real estate, mine land, company debt, government debt (NO equity)
  SAVE:    hold as cash

THE PER-TURN SEQUENCE (strict order, each MONTH):
  0. GET PAID — at the START of the turn, collect ALL income due this turn:
       - WAGES from your JOB (if employed);
       - RENT from any real estate you have RENTED OUT to tenants;
       - the monthly REPAYMENT (principal + interest) on any DEBT you OWN;
       - LAND RENT / yield from any MINING LAND you own.
     ALSO this turn: the GOVERNMENT offers FREE PUBLIC EDUCATION (a career
     level-up) and FREE PUBLIC HEALTHCARE (a disease cure) -- NOT an equal share,
     but via the BID + PRIORITY (homeless -> renters -> owners) + LOTTERY +
     ALL-OR-NOTHING mechanism of §5b / §5c. You get a level-up or a cure only if
     the government is PRODUCING that type AND you win; capacity = what the
     government chose to produce (its teacher-type / doctor-type mix). These
     reach even the homeless and are the poverty-trap circuit-breaker (§3/§5),
     but they are RATIONED, not guaranteed.
     The free HEALTH is SMALL but, net of decay, means health GENERALLY TRENDS
     UP over time. There is NO free HAPPINESS -- happiness must be BOUGHT
     (nightclub, or renting/owning more/bigger real estate) and decays without
     spending. (So everyone starts at health 10 / happiness 10, §10; health
     drifts up for free, happiness only rises if you pay.)
     The cash income above, plus existing savings, is the budget for steps 1-4.
     (Timing note: WAGES, DEBT repayments and MINE-LAND yield are MONTHLY
     streams; REAL-ESTATE RENT arrives as the annual UPFRONT lump on real-estate
     day, since tenants pay a year at a time (§12) -- so a landlord's rent income
     is lumpy, mostly zero, big once a year. Mine-land yield is MONTHLY; the bank
     DIVIDEND arrives once a year on the SPECIAL DAY (§12).)
  1. BUY FOOD — the FIRST thing you do EVERY single turn. If you CANNOT buy
     food you begin to STARVE — you do NOT die immediately, but enter the
     THREE-TURN STARVATION rule (below): the engine FORCE-LIQUIDATES your LIQUID
     assets at a below-market price to feed you, and death follows only after
     THREE consecutive turns with no food. RENT is SEPARATE and ANNUAL — the
     whole year paid upfront on real-estate day (§12), NOT part of this monthly
     food step; failing to secure a dwelling there means HOMELESS -> health 0
     (not death).
  2. WELFARE & EDUCATION (with what's left) — buy HEALTH, HAPPINESS and
     EDUCATION, in ANY amount (no personal cap; limited only by who's selling,
     i.e. supply / sell-outs). These are ON TOP OF the free government
     health/education from step 0:
       - HEALTH  from LUXURY FOOD (luxury supermarket) + PRIVATE HOSPITAL.
                 NO UPPER LIMIT to health.
       - HAPPINESS from NIGHTCLUBS + a BIGGER HOUSE. NO UPPER LIMIT.
       - EDUCATION from the PRIVATE UNIVERSITY (paid; public university is the
         free step-0 allocation). Education raises your EDUCATION stock -- human
         capital that GATES jobs (§3b). It is really a FORWARD-LOOKING
         INVESTMENT (you pay now for future wage access), so it follows the
         bounded-lookahead rule (plan §3b), not pure present-utility. WHICH
         career-type you study is the AGENT'S decision, made by looking at LAST
         YEAR'S JOB OFFERINGS -- the listings and salaries posted on the last job
         day -- and investing toward the careers that were most in DEMAND
         (adaptive / backward-looking expectations, not a forecast).
       - COUPLING: HAPPINESS CONTRIBUTES TO HEALTH. There is a CEILING on how
         healthy you can be if you are NOT happy ("you can only be so healthy
         if you're not happy") -> health_max is an increasing function of
         happiness; buying medical/luxury-food past that ceiling is wasted
         until happiness rises. (So the two welfare stocks are COUPLED: even a
         pure health-maximiser must buy some happiness to lift the ceiling.)
  3. INVESTMENT (with what's still left) — the MONTHLY capital market:
       (a) MINE LAND — buy/sell (very expensive; pays a nice yield / land-rent,
           Robin's "dividend"). Mine land is LIQUID (trades monthly).
       (b) DEBT market — decide whether to loan money (buy debt, §11d).
       Either, both, or neither.
     REAL ESTATE / houses are NOT bought or sold here — they trade ONLY on the
     annual real-estate day (§12) and are ILLIQUID in between (hence the
     illiquidity-death above).
  4. SAVE — whatever is not spent or invested stays in savings.
  That is the whole turn.
  (REAL-ESTATE CLOCKS, resolved: HOUSES — both renting AND buying/selling —
  happen ONLY on the annual real-estate day (§12) and are ILLIQUID between.
  MINE LAND and DEBT trade MONTHLY in step 3. That illiquidity of houses is
  exactly what makes the asset-rich/cash-poor illiquidity-death possible.)
  (This necessity-first order mirrors the entrepreneur's (§6d) and the
  government's (§5): three agent types, one principle -- the turn-order decides
  what gets cut first in a downturn.)

Hard feedback rules:
  - TWO HARD-ZERO conditions send HEALTH to ZERO and HOLD it there: being
    HOMELESS (no house owned or rented), and having an uncured DISEASE (§5c).
    While in EITHER state your health is STUCK at 0 -- eating at the luxury
    supermarket does NOTHING; general-health spending cannot lift a hard zero.
    You must first RESOLVE the condition (get housed; and/or buy the 10 units of
    the matching specialist doctor to cure the disease, §5c) before general
    health can rise again.
  - If HEALTH is LOW -> it is HARDER to get a job; employers PREFER to hire
    people with good health (healthiest-wins, §11b). So a hard-zero (homeless or
    diseased) agent is also UNEMPLOYABLE until it recovers.
  (Together these make a poverty trap: job loss -> can't pay rent/food ->
   health falls -> even harder to get hired -> ... a micro-level spiral that
   mirrors the macro debt-deflation spiral.)

Survival & death (DISTINCT from homelessness):
  - Becoming HOMELESS does NOT kill you — your HEALTH goes to ZERO but you
    LIVE. You STILL RECEIVE HEALTH and EDUCATION from the GOVERNMENT (public
    hospital + public university) even while homeless, so health is
    RECOVERABLE and the trap is ESCAPABLE (public services are the
    circuit-breaker, not cash).
  - STARVATION — THE THREE-TURN RULE. An agent that cannot buy food does NOT die
    at once; it enters STARVATION. While starving, the ENGINE AUTOMATICALLY
    raises food money from the agent's LIQUID assets: CASH first, then BANK
    SHARES, DEBT holdings and directly-held MINE LAND are FORCE-SOLD at a
    BELOW-MARKET distress price. You CANNOT die while you still hold ANY liquid
    asset -- the engine will always force-sell it (however cheaply) to feed you;
    the DEATH COUNTDOWN begins ONLY once ALL liquid assets are exhausted. The
    agent then DIES after THREE CONSECUTIVE foodless turns with nothing left to
    burn. UNMORTGAGED real estate is NOT auto-sold (houses are illiquid, §12), so
    the death strikes the house-rich / cash-poor with NO liquid assets. The SAME
    three-turn rule applies to a NEWBORN CHILD that cannot be fed (§2c).
  - REAL ESTATE IS ILLIQUID: houses can be SOLD ONLY on real-estate day (annual,
    §12). So owning real estate does NOT guarantee survival — an ASSET-RICH but
    CASH-POOR owner who runs out of savings mid-year CAN STARVE while waiting for
    the next real-estate day to sell. This is death by ILLIQUIDITY, not
    insolvency, and it CORRECTS the earlier "never die while you hold property".
  - What CAN be converted to food money mid-year: SAVINGS (cash), MINE LAND, and
    DEBT INSTRUMENTS -- all traded MONTHLY in the capital/debt market (debt is
    resold on the SAME market it is issued on, §11d). Only HOUSES are ILLIQUID
    (sell only on real-estate day, §12). So the illiquidity-death strikes those
    whose ONLY remaining asset is a house -- exactly the folded entrepreneur
    (§6e), left with just a homestead.
  - So the lethal edge is widened from "the propertyless" to "the ILLIQUID" — it
    now also catches house-rich, cash-poor owners trapped between real-estate
    days.

Configurable objective — OPTIMIZATION STRATEGIES, sprinkled at RANDOM across
the population. Each agent runs one; the dependency chains mean NONE is truly
single-objective:
  - OPTIMIZE HAPPINESS -> buys REAL ESTATE (bigger houses raise happiness) but
    does NOT rent it out -- it holds property for OWN-USE happiness, WITHDRAWING
    it from the rental pool. Also buys nightclub.
  - OPTIMIZE HEALTH -> must ALSO pursue HAPPINESS, because happiness CAPS health
    (coupling, above); so it buys luxury food + private hospital AND enough
    happiness to lift the ceiling.
  - OPTIMIZE EDUCATION -> buys education to climb job tiers; BUT the right
    education is NOT enough -- you can't win a GOOD job if you are not HEALTHY
    (hiring is healthiest-wins, §11b) -- so it must ALSO keep health up (which in
    turn needs happiness). A three-link chain: education needs health needs
    happiness.
  - OPTIMIZE SAVINGS -> hoards cash; minimal discretionary spend.
  - OPTIMIZE INVESTMENT REVENUE -> buys INCOME assets -- real estate TO RENT OUT,
    mine land, and debt -- maximising rent + yield + interest.
  (The population is a MIX; outcomes depend on the mix. Note the OPPOSITE housing
  effects: HAPPINESS-optimizers WITHDRAW real estate from the rental market,
  INVESTMENT-optimizers SUPPLY it -- so the strategy mix sets rental supply.)


### 2c. CHILDREN / REPRODUCTION (population is ENDOGENOUS)
- Having a child is an OPTION available ONLY to property OWNERS; RENTERS CANNOT
  reproduce. Fertility is therefore PROPERTIED -- only the asset-owning class
  reproduces, so over generations the population becomes increasingly descended
  from owners.
- THE REQUIRED GIFT. A newborn is endowed with a fixed REQUIRED GIFT: 10 UNITS
  of REAL ESTATE (its own dwelling) PLUS a REQUIRED CASH GIFT G (a tunable
  liquid-wealth endowment). The child is born a WHOLE NEW HOUSEHOLD in the
  LOWEST job tier (RETAIL / HOSPITALITY), housed in its own 10 units -> not
  homeless at birth, and itself fertility-eligible once it meets the gate below.
- VOLUNTARY FERTILITY GATE: to have a child a parent must hold, OVER AND ABOVE
  its own housing, at least 10 SPARE UNITS of real estate AND at least 3G in
  LIQUID ASSETS (three times the required cash gift). Each ADDITIONAL child needs
  ANOTHER 10 spare units and 3G more. Whether an eligible parent in this
  VOLUNTARY band actually has a child is governed by its OPTIMIZATION STRATEGY
  (§2b) -- a "children" objective makes it likely, others less so. (This REVISES
  the old "10 units + 5 per extra child" rule and the parent-then-split mechanic:
  the child is now endowed and independent AT BIRTH.)
- MANDATORY REPRODUCTION: a parent holding at least 100 UNITS of real estate AND
  at least 10G in LIQUID ASSETS MUST have a child -- the very rich are FORCED to
  reproduce, a strong anti-concentration bleed on the top.
- FUNDING THE GIFT. On birth the engine transfers the 10 real-estate units and
  assembles the cash gift G out of the parent's LIQUID assets; if cash is short
  it FORCE-SELLS liquid assets at AGGRESSIVELY FALLING prices until the gift is
  raised (distress liquidation, as in starvation, §2b). The 3G / 10G liquidity
  gates ensure the gift can always be funded.
- NEWBORN STARVATION. A newborn is subject to the THREE-TURN STARVATION rule
  (§2b) like any agent: if it cannot be fed, the engine force-liquidates its
  (gifted) liquid assets below market, and it dies only after three foodless
  turns. (Real-estate accumulation and household formation are the SAME process;
  see plan §3c for the demographic consequences.)


### 2d. INHERITANCE (at death)
When an individual DIES (starvation, §2b), DEBTS are settled first (loans
default -> bank seizes collateral, §3 mortality); the NET estate (remaining real
estate, mine land, debt holdings, savings) then passes by this STRICT ORDER:
  1. To the FIRST CHILD -- PRIMOGENITURE: the firstborn inherits EVERYTHING,
     UNDIVIDED. Younger children get nothing at death (they were already endowed
     AT BIRTH with their own 10-unit dwelling + cash gift, §2c).
  2. If NO children, the estate DISSOLVES -- split THREE ways:
     - REAL ESTATE is SPLIT INTO 10-UNIT PIECES, each given to a RANDOM HOMELESS
       person -> that recipient becomes a 10-unit OWNER, instantly housed AND
       reproduction-eligible (§2c). (The ILLIQUID wealth goes to the bottom.)
     - CASH + ALL LIQUID ASSETS ESCHEAT TO THE GOVERNMENT as revenue: the
       decedent's CASH SAVINGS, DEBT HOLDINGS (receivables -- the GOVERNMENT now
       collects those monthly payments), BANK SHARES (the dividend claim; the
       PHYSICAL mining land STAYS in the bank, so the bank's base is UNDISTURBED),
       and directly-held MINE LAND all pass to the GOVERNMENT. (This REVISES the
       earlier "receivables forgiven / bank share to the homeless" rule: LIQUID
       wealth is NATIONALISED, not scattered or forgiven.)
     - The decedent's OWED DEBTS (what IT owed others) are WRITTEN OFF -- its
       creditors lose the claim (money/claim destruction). The bank's SECURED
       collateral is seized FIRST, so only UNSECURED debts and any deficiency are
       written off (RESOLVED B below).
   So a CHILDLESS death splits THREE ways: HOUSES to the bottom (anti-
   concentration), LIQUID WEALTH to the GOVERNMENT (fiscal revenue), and the
   decedent's OWN creditors WIPED (claim destruction). Its DEBTORS do NOT walk
   free -- the STATE inherits the receivables. Still the opposite of the
   CONCENTRATING primogeniture in (1); the distributional fate of the whole model
   hinges on the childless-vs-childful DEATH MIX.
   [RESOLVED A: cash + ALL liquid assets (debt holdings, bank-share claims,
    directly-held mine land) ESCHEAT to the GOVERNMENT; real estate -> homeless;
    the decedent's own owed debts written off. The physical deposited mine land
    stays in the bank.]
   [RESOLVED B: the bank's SECURED claim comes FIRST -- it seizes/sells the
    lien'd COLLATERAL to recover its loan BEFORE anything is written off or
    scattered. The write-off hits only UNSECURED owed debts (and any deficiency
    after the bank recovers); the homeless therefore receive houses NET of any
    bank lien, and the bank bears a loss only if the collateral is worth LESS than
    the loan (a bust). Secured-first, then escheat/scatter the rest.]
   [RESOLVED C: a real-estate REMAINDER < 10 units after splitting ESCHEATS to the
    GOVERNMENT (with the liquid assets) -- a sub-minimum piece cannot house or
    enfranchise anyone, so it is not scattered.]
   [RESOLVED D: the FIRST CHILD inherits the NET estate ONLY -- assets after the
    bank has taken its collateral; it does NOT inherit liabilities beyond what the
    estate covers (no negative inheritance).]

REMARK — THE DARK STABILISER. The debt-deflation spiral above is NOT purely
divergent. Because a CHILDLESS death WRITES OFF the decedent's own debts (its
creditors lose) and scatters their houses to the homeless (§2d), a DEATH-WAVE in
a crash CANCELS debt and DE-LEVERS the top en masse — a grim "jubilee by
mortality". This is
genuine NEGATIVE FEEDBACK on the spiral: the deeper the slump, the more deaths,
the more compounding debt simply vanishes, easing the burden on survivors and
handing houses to the bottom. A SECOND, FISCAL stabiliser rides alongside: the
LIQUID wealth of the childless dead ESCHEATS to the GOVERNMENT (§2d), so a
death-wave also REFILLS the treasury -- strengthening the public safety net (§5)
exactly when demand for it peaks. So the model can find a FLOOR through ATTRITION
even when no borrowed fiscal rescue arrives (§5) — a Malthusian damper. It is macabre by
design: the system's built-in stabiliser is MORTALITY ITSELF, and its losers are
disproportionately the LENDERS (the wealthy), whose loan books the deaths
destroy. Recovery here is never clean — it is the quiet arithmetic of a smaller,
poorer, de-levered population. The model must be allowed to reach this floor
honestly; it must NOT be rescued by a scripted recovery.


## 3. CAREERS & PER-CAREER EDUCATION
There are SIX CAREERS:
    TEACHER, DOCTOR, BUREAUCRAT, RETAIL, HOSPITALITY, ENGINEER.
Each career OPERATES one matching MACHINE TYPE (the bijection, §3b): teachers run
teaching machines, doctors medical, bureaucrats admin, retail/hospitality theirs,
engineers the machine-BUILDING machines at the tech companies.

EDUCATION IS PER-CAREER (this REVISES the earlier single education stock). Within
a career you have an EDUCATION LEVEL, and that level determines WHICH GENERATION
of that career's machine you may OPERATE: level 0 runs gen-0 machines, higher
levels run higher-generation machines. So "ADVANCED ENGINEER" is NOT a separate
career -- it is simply a HIGH-LEVEL ENGINEER (the one who can build/run the next
machine generation); likewise a high-level doctor runs advanced medical machines,
etc. The same per-career ladder gives both (i) the automation dial (a newer
generation needs fewer operators, §9) and (ii) the rising education LEVEL needed
to operate it.

SWITCHING CAREERS RESETS EDUCATION. Your level is specific to ONE career and does
NOT transfer: switch careers and you START AGAIN AT LEVEL 0 for the new career's
machine. This is a STRONG mobility friction -- a displaced worker (e.g. a
bureaucrat automated out) who moves to another career throws away their
accumulated level and re-educates from scratch, which is exactly what makes
automation unemployment STRUCTURAL and slow to clear (§9).

RESOLVED: mining employs NO labour. Extraction is LABOUR-FREE -- a mine produces
raw materials DIRECTLY from its mining land + finite stock (worked by the
owner/bank without staff), so there is NO miner career and the SIX careers above
are the complete set (§3b, §6).
RESOLVED (§5b): public (free) education comes in the TYPE(S) the government
chooses to produce that turn, citizens request a type, and a LOTTERY allocates
it; private tuition buys the SPECIFIC career-type you want outright. You study
ONE career-type at a time, raising that career's level.


### 3b. MACHINES <-> OPERATORS (the unifying bijection)
Organizing principle: EVERY productive job is operating a machine, so machine
TYPES and operator CLASSES are in BIJECTION — one machine per employment type:

    admin / bureaucratic machine  <->  bureaucrat
    medical machine               <->  doctor
    teaching machine              <->  teacher
    retail machine                <->  retail staff
    hospitality machine           <->  hospitality staff
    machine-building machine      <->  ENGINEER (operates the META-machine at
                                        the tech company that BUILDS machines)

The last line is the meta-level fixed point: the thing that automates is
itself a machine with operators who can, in turn, be automated.

Two consequences:
  - "machine operator (simple)" vs "(complex)" is NOT a separate job axis — it
    is the GENERATION axis of ANY machine type. Generation does DOUBLE DUTY:
      (i)  it LOWERS ops_per_machine (the automation dial, §9), AND
      (ii) it RAISES the EDUCATION FLOOR needed to operate the machine.
    So a newer machine needs FEWER operators AND more-educated ones — double
    displacement of the low-educated, from one parameter. This is what turns
    automation unemployment STRUCTURAL rather than merely cyclical.
  - OUTPUT per machine does NOT fall with generation. A newer generation does
    the SAME-OR-MORE output with fewer operators (the hospital example, §9:
    "same throughput, fewer people"). Per-machine output constant-or-rising is
    REQUIRED by §1 — if it fell, automation would cut supply and the whole
    deflation mechanism could never fire.


## 4. BUSINESSES
- Expenses: salaries, machines, debt, taxes.
- COMPANY OWNERSHIP & FINANCING: an ENTREPRENEUR always owns the company
  OUTRIGHT -- there is NO equity/shares market, so you CANNOT buy a stake in a
  company. A company raises EXTERNAL finance ONLY as DEBT: either a BANK LOAN
  (collateralised, §8) or a DIRECT LOAN from an individual, which the company
  solicits by EXPOSING its full information as JSON and OFFERING fixed debt
  terms -- a principal AMOUNT, an INTEREST RATE, and a fixed MONTHLY REPAYMENT
  SCHEDULE to a maturity date -- which a lender accepts or declines (§11d). Firm PROFIT accrues directly
  to the owner-entrepreneur as personal income (§6d) -- there are NO dividends.
- TAXES: a business pays the government a PERCENTAGE of EACH UNIT of goods/
  services SOLD — a per-unit sales/turnover tax, so tax revenue tracks real
  output, not profit. Individuals pay NO tax (§2).
- BUREAUCRAT SUPPORT RATIO: every business employs BUREAUCRATS to SUPPORT its
  PRODUCTIVE workers (teachers, doctors, retail, hospitality, engineers) in a
  FIXED ratio -- β bureaucrats per productive worker. Bureaucrats operate the
  ADMIN machines; a higher-generation admin machine needs FEWER bureaucrats per
  unit of admin throughput (§9), so AUTOMATING THE BACK OFFICE lowers β -- overhead
  automation that sheds bureaucrats exactly as production automation sheds
  operators. A business short of its required bureaucrats cannot run its
  productive workers at full capacity. [DEFAULT β = 1 at generation 0 (the §9
  hospital example: 20 doctors + 20 bureaucrats); TUNABLE, and falls as the admin
  machine is upgraded.]
- Hiring by firm type:
    * generic business : machine operators OR bureaucrats
    * supermarket      : machine operators OR hospitality staff OR bureaucrats
    * nightclub        : hospitality staff OR bureaucrats
- Firm types in the consumer economy:
    * regular supermarket   (staple food -> maintains health / survival)
    * luxury supermarket    (premium food -> improves health)
    * nightclub             (-> improves happiness)
    * private hospital      (-> improves health, paid)


## 5. GOVERNMENT
- Income: TAX REVENUE (the per-unit sales tax of §4) + borrowing (bonds).
- Expenses: pays PUBLIC DOCTORS (public hospital) and PUBLIC TEACHERS (public
  university), plus bureaucrats it employs.
- NO CASH WELFARE, BUT IN-KIND SERVICES ARE UNIVERSAL: there is no cash dole
  for the unemployed or homeless, BUT public HEALTH (public hospital) and
  public EDUCATION (public university) reach EVERYONE, INCLUDING THE HOMELESS
  (§2b). These in-kind services ARE the poverty-trap circuit-breakers: a
  homeless person at health 0 can be treated back to employability and can keep
  climbing the education ladder, so their FUNDING/CAPACITY sets how escapable
  the trap is. What the state does NOT provide is CASH, HOUSING, or FOOD — so
  starvation death (§2b) remains possible for the propertyless.
- Runs the PUBLIC HOSPITAL (-> provides health).
- BORROWING: the government raises debt via the SAME single mechanism as any
  company (§11d) -- but its JSON disclosure is its own finances: it EXPOSES ALL
  its TAX REVENUE and SALARY OBLIGATIONS. It then offers an amount, interest
  rate and fixed monthly repayment schedule, which a lender accepts or declines.
  There is no special "government bond" -- it is the one debt instrument.
- PER-TURN CYCLE: each turn the government, IN ORDER:
    (1) RECEIVES its TAX REVENUE (the per-unit sales tax, §4);
    (2) PAYS its WORKERS (doctors, teachers, bureaucrats) — OR FIRES them if it
        cannot afford them. Firing workers is the government's ADJUSTMENT VALVE,
        and public-sector layoffs feed straight into unemployment (no welfare);
    (3) PAYS the INTEREST on its outstanding DEBT;
    (4) ASKS FOR MORE DEBT — issues new debt via the one mechanism (§11d: expose
        tax revenue + salary obligations as JSON, offer amount/rate/schedule;
        lenders accept or decline) to cover any shortfall;
    (5) DISTRIBUTES the HEALTH and EDUCATION it PRODUCED this turn — the OUTPUT
        of its PUBLIC HOSPITAL and PUBLIC UNIVERSITY, made with its OWN machines
        + workers — to ALL CITIZENS EGALITARIANLY (an equal share each).
  (This supersedes the earlier tax->debt->wages ordering: workers are paid
  BEFORE debt interest, and FIRING workers is the adjustment valve.)
  CONSEQUENCE: the free health/education each citizen receives = PUBLIC PRODUCTION
  / POPULATION. It is CAPACITY-CONSTRAINED — austerity (firing public workers),
  too few public machines, or a GROWING population all SHRINK the per-citizen
  free allocation, weakening the §2b/§3 poverty-trap circuit-breaker exactly when
  (a downturn, or a demographic boom) it is needed most.
- COUNTER-CYCLICAL INTENT vs. EMERGENT CAPACITY (the downturn): the government
  TRIES to be a STABILISER — in a downturn it would rather BORROW (step 4) to
  keep paying public workers than fire them. But whether it CAN is decided by
  the DEBT MARKET, not by its wish: a saver reading its JSON (falling tax revenue
  vs. high salary obligations, §11d) sees rising default risk and may DECLINE or
  demand a punishing rate. So:
    * if savers ACCEPT its debt -> it maintains employment (STABILISER) — but now
      owes interest to those lenders, so public-debt interest flows from
      taxpayers to the wealthy savers (a CONCENTRATION channel);
    * if NO ONE lends at a tolerable rate -> it is FORCED into AUSTERITY (fire
      workers) — the AMPLIFIER outcome.
  The fiscal rescue thus SUCCEEDS OR FAILS ENDOGENOUSLY. Cruel timing: the
  downturn at once makes the government WANT to borrow, WORSENS its
  creditworthiness (tax revenue down), AND makes savers most reluctant (in
  deflation, holding CASH earns a positive real return, so lending must beat
  that). In a deep slump the only agents with savings to lend are the
  INDIGENOUS / RENTIER class — so the fate of the public safety net rests with
  the richest agents, who WIN EITHER WAY (lend -> collect interest from the
  state; refuse -> austerity + buy the cheap dip). Whether a fiscal EXIT from the
  §1 nightmare exists is therefore itself an EMERGENT outcome, set by the savings
  distribution and lender psychology at the crisis moment — never hardcoded.
- GOVERNMENT OWNS MACHINES TOO. Like any employer it operates medical, admin
  and teaching machines; it can BUY more machines, UPGRADE them, and HIRE or
  FIRE workers. So the PUBLIC SECTOR IS SUBJECT TO THE SAME AUTOMATION as
  private business: upgrading lets it deliver the same public health/education
  with fewer public doctors/teachers/bureaucrats — and because there is NO
  WELFARE, those public-sector layoffs feed straight into unemployment.


### 5b. UNIVERSITIES / EDUCATION
- There is a PUBLIC UNIVERSITY and a PRIVATE UNIVERSITY. Both hire TEACHERS (and
  bureaucrats). Education raises a citizen's PER-CAREER education level (§3).
- TEACHERS ARE GENERIC: a teacher can teach ANY subject (career). What a teacher
  produces is set by WHICH SUBJECT they are assigned to teach, not by the teacher.
- PUBLIC EDUCATION -- the government's turn-by-turn choice (a POLICY LEVER):
    * Each turn the GOVERNMENT decides WHICH TYPES of teacher to employ (i.e.
      which subjects its generic teachers teach) -> this sets the MIX of
      education TYPES produced publicly that turn.
    * Each CITIZEN puts in a BID for the education UNITS needed to reach their
      NEXT LEVEL in a chosen career-type (a demand entry sized to the level-up;
      public education is free, so the "bid" is a request/application, not a
      price). The government fulfils this demand in a PRIORITY ORDER by housing
      status: HOMELESS first, then (if education remains) RENTERS, then OWNERS
      last -- the public ladder targets the worst-off first. Within each priority
      tier it is a LOTTERY.
    * Allocation is ALL-OR-NOTHING per person: a WINNER receives the FULL amount
      to COMPLETE the next level (and can then operate that machine generation /
      qualify for that job tier); a LOSER receives NOTHING. Education is NOT
      spread thin as useless fractions -- it is granted in whole LEVEL-UPS, so
      recipients actually ADVANCE. (Citizens get UNEQUAL amounts: some a full
      level, some zero.)
    * So you do NOT automatically get free education in your chosen career: you
      get a level-up only if the government is PRODUCING that type AND (homeless
      first, then) you win the lottery.
- PRIVATE EDUCATION: pay tuition at the private university for the SPECIFIC
  career-type you want -- guaranteed, not subject to the government's mix or the
  lottery (the paid escape, mirroring the private hospital).
- WHY THIS MATTERS (the retraining lever). The government's education-MIX choice
  shapes the FUTURE labour force: if automation is displacing bureaucrats and the
  economy needs ENGINEERS, a government that keeps producing bureaucrat-education
  MIS-TRAINS the population for obsolete careers -> worsens structural
  unemployment (§3 career-switch resets education, so the displaced can only
  retrain into what is offered). Steering the mix toward needed careers is the
  main public tool for ABSORBING the automation shock -- so the mix choice is a
  core stabiliser-vs-amplifier lever (cf. §5).


### 5c. HEALTHCARE / DISEASE (mirrors education, §5b)
- GENERAL HEALTH comes from the LUXURY SUPERMARKET (§2). DISEASE is a SEPARATE,
  catastrophic health state.
- DISEASE: there are FIVE disease types. Each turn, disease INFLICTS citizens AT
  RANDOM (a stochastic per-turn health shock). A disease sends HEALTH TO ZERO and
  HOLDS it there UNTIL CURED -- a HARD zero: while diseased, eating luxury food
  does NOTHING (you are STUCK at 0, exactly as with homelessness, §2b). Being at
  0 also makes you unemployable (healthiest-wins hiring, §11b), so disease is a
  major shock.
- CURE: each disease is cured ONLY by a SPECIALIST DOCTOR of the matching type
  (5 diseases <-> 5 doctor specialties). You must purchase 10 UNITS of the
  matching doctor to cure one disease. Doctors work at hospitals, PUBLIC or
  PRIVATE.
- DOCTOR SUPPLY: a TEACHER can train ANY type of doctor (teachers are generic,
  §5b) -- so doctor supply flows from the education system. The GOVERNMENT decides
  each turn WHICH doctor TYPES to employ (its public-health mix choice, exactly
  like the teacher-type choice, §5b).
- FREE PUBLIC HEALTHCARE works IDENTICALLY to public education (§5b): a citizen
  puts in a BID for the 10 units needed to cure their disease; the government
  fulfils demand in PRIORITY ORDER -- HOMELESS first, then RENTERS, then OWNERS --
  with a LOTTERY within each tier; ALL-OR-NOTHING (a winner gets the full 10 units
  and is CURED; a loser gets NOTHING and stays at health 0). You are cured by the
  public system only if the government is EMPLOYING that specialty AND
  (homeless-first, then) you win the lottery.
- PRIVATE HEALTHCARE: pay the private hospital for the SPECIFIC specialist (the 10
  units) you need -- guaranteed, not subject to the government's mix or the
  lottery (the paid escape, like the private university).
- CONSEQUENCE: disease is a random, catastrophic, PER-TURN risk resolved only by
  MONEY (private cure) or LUCK+NEED-PRIORITY (public lottery). The poor rely on
  the homeless-first public lottery; the rich self-insure privately. And the
  government's doctor-TYPE mix can MISMATCH the diseases actually circulating ->
  citizens with an un-produced disease type can ONLY be cured privately -> a
  public-health analogue of the education mis-training risk (§5b).


## 6. THE "META LEVEL" (supply chain / capital goods)
- A TECH COMPANY produces MACHINES out of RAW MATERIALS.
- RAW-MATERIAL -> MACHINE BILL OF MATERIALS (which materials build which machines).
  There are TWO raw-material types: COMMON (from one mine type) and ADVANCED (from
  the other). Building ONE machine consumes a RECIPE over the two, set by the
  machine's GENERATION: every machine needs COMMON (the bulk input) PLUS some
  ADVANCED, and the ADVANCED requirement RISES with generation -- gen-0 machines
  use mostly COMMON with a little ADVANCED, each higher generation uses MORE
  ADVANCED. So ADVANCED material is the automation BOTTLENECK: as its mine depletes
  it tightens, raising the cost of each new generation -- a MATERIAL brake on
  automation that complements the ENGINEER (labour) brake (§9). This holds for all
  SIX machine types (admin, medical, teaching, retail, hospitality, machine-
  building); per-type recipe differences are a tunable refinement. The two-material
  COMMON/ADVANCED split and every-machine-needs-BOTH are DECIDED (matching the
  seed's "each tech co needs materials from BOTH mines", §10); only the RECIPE
  COEFFICIENTS per generation are numeric calibration (tunable).
- RAW MATERIALS are produced by the MINES directly from their MINING LAND +
  finite raw-material STOCK. Extraction is LABOUR-FREE: a mine employs NO
  operators and NO miners -- it "magically" produces raw materials from its land
  and stock (worked by the owner/bank without staff).
- Each turn a mine ADVERTISES a PRICE and a MAX UNITS (how many it will sell this
  turn, <= its remaining stock). If BUYERS exceed the max units, a RANDOM LOTTERY
  rations who is served (the §11 common protocol). A mine owner may post ANY
  price/quantity but COMPETES with the other mine owners; posting max-units BELOW
  remaining stock = WITHHOLDING (props up price, slows depletion).
- BUYER SIDE (a tech company ordering raw materials): an order is X UNITS at
  price Y, and may carry a ROLL-OVER instruction -- if it does NOT get enough
  units (lost the lottery / the mine sold out), the order PERSISTS and RE-TRIES
  at a HIGHER price, up to a buyer-set PRICE LIMIT (a reservation price). So a
  buyer that really needs materials bids itself UP within its ceiling to secure
  them; the limit caps the chase. This makes raw-material demand PERSISTENT and
  PRICE-ESCALATING under scarcity: as mines deplete / sell out and post higher
  prices (protocol step 4), rollover buyers keep buying up to their limits ->
  price rises toward the marginal buyer's ceiling (genuine price discovery).
  RESOLVED: rollover escalates ACROSS turns -- a STANDING ORDER that persists
  month to month until it is filled or the buyer's price limit is hit (matching
  the monthly market cadence), not within-turn matching rounds.
- RAW MATERIALS ARE FINITE (REVISES the earlier "bottomless" rule). Each mine
  holds a FINITE stock sized to the mine; extraction DEPLETES it and a mine
  eventually RUNS OUT (bigger mines last longer). The TOTAL across all mines is
  calibrated to be ENOUGH to reach FULL AUTOMATION -- so materials do not bind
  BEFORE then, but there is a finite budget, and as mines deplete, supply tightens
  and raw-material PRICE tends to RISE (squeezing tech-company input costs; a slow
  long-run drag). [TUNABLE PARAMETER: total raw-material stock -- large but
  finite.]
- RAW-MATERIALS MARKET (mine -> tech company) is an INTERMEDIATE goods market
  (effectively a sixth market), running the common protocol with COMPETING mine
  sellers. Because stock is FINITE it CAN deplete and tighten over time (prices
  drifting up as mines run out). It does NOT get its own dashboard panel -- its
  price rides as an INPUT-COST line on the MACHINES panel (RESOLVED: no separate
  panel).
- Machines are bought and used by the other businesses as capital.
- OWNERSHIP: the MINES and all mining land are owned at t0 by the INDIGENOUS
  PEOPLE (§10); their raw-material sales are the source of that class's strong,
  steady income.


### 6b. THE TECH ENTREPRENEUR'S DECISION (the automation SUPPLY choice)
A tech company is run by an ENTREPRENEUR (an individual who owns it). Each
period the entrepreneur faces three nested decisions:

(A) PRODUCT STRATEGY — what to sell (a THREE-WAY choice each turn):
    * STAY: keep producing the SAME machines at the SAME volume. Regular
      engineers + raw materials from the mine. Known market, lower price.
    * EXPAND: produce MORE of the SAME (current-generation) machines — buy more
      of its own production machines and hire more REGULAR engineers. Grows
      output WITHOUT automating; it is the only growth path available
      pre-ignition (§10b), and the one that INCREASES employment.
    * UPGRADE: hire an ADVANCED engineer (highest education, scarce -> wage
      premium) to upgrade ONE of the machines it SELLS to a HIGHER model, which
      SELLS FOR MORE. This is the ONLY place new machine GENERATIONS enter the
      economy — the supply side of the automation dial (§9/§6).

(B) PROCESS / REINVESTMENT — what to do with profits on its OWN production
    machines (a higher generation lowers ops_per_machine for its engineers):
    * UPGRADE + FIRE: same output, fewer engineers -> bank the cost saving.
    * UPGRADE + REDEPLOY: keep the engineers, transfer them onto the new
      machines -> produce MORE products.
    Which path is taken turns on EXPECTED DEMAND: a firm only redeploys
    (scales up) if it believes it can sell the extra output; otherwise it
    sheds labour. In a weak-demand/deflationary state firms shed rather than
    scale — which weakens demand further. The displacement-vs-expansion choice
    is ENDOGENOUS, not assumed.

(C) PERSONAL PORTFOLIO — the entrepreneur is ALSO a household (§2, §2b).
    Profits not reinvested in the firm can instead be spent/invested on:
    * HAPPINESS / HEALTH: a bigger house, the luxury supermarket, the nightclub.
    * MINE LAND: note this is BACKWARD VERTICAL INTEGRATION — the mine is the
      entrepreneur's own raw-material supplier.
    * REAL ESTATE (to rent out / for capital gain).
    * DEBT in OTHER companies (lending only; no equity exists).
    * GOVERNMENT DEBT (bonds).
    These compete with firm reinvestment (A/B) for the same profit dollars
    (see the full per-turn ordering in §6d).


### 6c. BECOMING AN ENTREPRENEUR (firm ENTRY)
Entrepreneurs are not a fixed caste — a REGULAR CITIZEN can BECOME one:
- ENTRY GATE: the citizen must OWN REAL ESTATE. That is the requirement -> so
  RENTERS CANNOT become entrepreneurs (no collateral to pledge). Property gates
  entrepreneurship, just as it gates reproduction (§2c) -- reinforcing the
  propertied class on yet another axis.
- RAISING THE CAPITAL: the citizen PLEDGES their REAL ESTATE as COLLATERAL to the
  BANK and takes a BANK LOAN (§8); the loaned lump sum funds the start-up. Entry
  is therefore DEBT-FUNDED -- new firms start LEVERAGED, adding to the all-debt
  corporate fragility of §1. (A citizen could alternatively self-fund by
  liquidating assets, but the canonical route is the bank loan against real
  estate.)
- THE STAKE: because the start-up loan is secured on the entrepreneur's OWN real
  estate, a FOLD (§6e) seizes the PLEDGED property. The ex-entrepreneur keeps a
  FOOD RESERVE and any UNMORTGAGED home, and recovers at the next real-estate day
  by mortgaging or selling it (§6e); but if the pledged home was its only real
  estate it faces the three-turn starvation death (§2b). Becoming an entrepreneur
  RISKS YOUR HOUSE.
- ONCE RUNNING, the new firm behaves like any business: it BUYS MACHINES, pays
  SALARIES and TAXES, and RECEIVES INCOME from selling its products.
This makes the NUMBER OF FIRMS endogenous (entry as well as exit via fold, §6e).
It is the recovery channel of §7 step 4: after a crash, citizens who still OWN
real estate can pledge it and enter -- so recovery depends on who kept their
property through the bust.


### 6d. THE ENTREPRENEUR'S PER-TURN CYCLE (every business owner)
Mirroring the government's turn order (§5), each turn an entrepreneur must, in
order:
  1. PAY TAXES — the per-unit sales tax of §4 on what the firm sold.
  2. SERVICE DEBT — interest/principal on the firm's loans.
  3. DECIDE WHETHER TO BORROW — putting up REAL ESTATE / MINING LAND as
     collateral (personal guarantee; NOT machines — wrong-way collateral, §8).
  4. DECIDE WHETHER TO BUY OR UPGRADE MACHINES — the fire-vs-redeploy choice of
     §6b(B); for a tech firm also the product-generation choice §6b(A).
Whatever remains, the entrepreneur — being a HOUSEHOLD too (§2b, §6b(C)) —
splits across:
  * SAVE: hold as a cash buffer.
  * INVEST OUTSIDE THE BUSINESS: mining land, real estate, other companies'
    DEBT, and GOVERNMENT DEBT (no equity exists).
  * SPEND on own HEALTH and HAPPINESS: a bigger house (happiness), the LUXURY
    SUPERMARKET (health), the NIGHTCLUB (happiness).

The ORDERING is the point: firm OBLIGATIONS (1-2) precede firm INVESTMENT
(3-4), which precedes PERSONAL use. A firm in distress is squeezed from the
BOTTOM UP — personal spending cut first, then business investment, and only a
genuinely insolvent firm fails to meet 1-2 -> default (§3 mortality / §4c
exit). This matches the household's necessity-first order (§2b) and the
government's debt-before-wages order (§5): three agent types, one principle —
the turn-order is what decides what dies first in a downturn.


### 6e. FIRM FOLD / BANKRUPTCY (the exit waterfall)
When an entrepreneur can no longer meet its obligations it FOLDS. Only its LIQUID
estate is marshalled -- CASH SAVINGS, DEBT RECEIVABLES (debt OWED TO it), BANK
SHARES and directly-held MINE LAND, all LIQUIDATED at distress (BELOW-MARKET)
prices -- together with any specifically MORTGAGED collateral the bank holds a
lien on (§8). UNMORTGAGED real estate is NOT seized or sold. The proceeds are
applied to claims in a STRICT PRIORITY WATERFALL:
  1. SALARIES FIRST -- pay WORKERS. Labour is the SENIOR claim. If the estate
     cannot pay ALL workers, RANDOM workers get paid until it runs out.
  2. TAX TO THE GOVERNMENT NEXT -- the per-unit sales tax (§4) owed on units the
     firm ALREADY SOLD is paid BEFORE the bank. A defaulting firm still owes the
     state its tax.
  3. THE BANK -- recovers from the remaining LIQUID estate and from the MORTGAGED
     collateral it holds a lien on: it SELLS that collateral SLIGHTLY BELOW
     MARKET for a quick sale (-> house prices DOWN, feeds §1) and SELLS seized
     RECEIVABLES on the debt market (§11d). It does NOT reach UNMORTGAGED
     property. (Loophole fix: receivables are liquid and reachable, so borrowed
     money cannot be shielded in them.)
  4. OTHER CREDITORS -- the unsecured DIRECT-MARKET lenders recover whatever
     LIQUID estate remains, usually ZERO; the shortfall is their total LOSS
     (money destroyed), which is WHY direct-market debt must carry a risk premium
     over (collateralised) bank lending.
  5. UNMORTGAGED PROPERTY IS SHIELDED, AND A FOOD RESERVE IS KEPT. The
     entrepreneur KEEPS every house and mine NOT under a lien, AND a small
     SURVIVAL RESERVE of CASH -- enough to buy food until the NEXT REAL-ESTATE DAY
     (§12) -- is EXEMPT and kept by the owner. Obligations (1-4) are met only from
     liquid assets ABOVE that reserve, so a fold cannot IMMEDIATELY starve the
     owner. (The reserve is SENIOR to all claims -- a deliberate bare-subsistence
     exemption, like a homestead shield: BARE FOOD ONLY, bounded by the months to
     the next real-estate day, so it barely dents creditor recovery. Chosen over
     creditors-first, which would risk starving the owner in exactly the gap this
     reserve exists to bridge.)
  6. RECOVERY AT THE NEXT REAL-ESTATE DAY. There the ex-entrepreneur either
     MORTGAGES its (unmortgaged) home or SELLS it (§12), converting the shielded
     illiquid asset into cash. So a folded owner with an unencumbered home carries
     its food reserve to the next real-estate day and RECOVERS there; it dies the
     THREE-TURN STARVATION death (§2b) only if it has NO liquid assets AND NO
     unmortgaged property. On such a death the estate passes by inheritance (§2d).
LOOPHOLE CLOSED (this OVERRIDES the earlier "keeps all its debt instruments"):
because RECEIVABLES are now seized and SOLD by the bank BEFORE any default, the
"BORROW -> RE-LEND -> FOLD -> keep the receivable" launder NETS TO ZERO -- the
re-lent money is itself seized to repay the borrowing. This is just standard
bankruptcy (collect receivables, pay creditors). It is ALSO WHY the model needs
a SECONDARY DEBT MARKET (§11d): the bank must be able to LIQUIDATE the seized
receivables for cash.
Firm failure lands on the OWNER as a HOUSEHOLD (§8 personal guarantee): labour
paid first, then TAX, then the bank from LIQUID assets + MORTGAGED collateral,
then unsecured lenders -- but UNMORTGAGED property is PROTECTED, a food reserve is
kept, and the entrepreneur recovers by mortgaging or selling its home at the next
real-estate day (above). Residual losses still bite the LENDERS, as with death
(§2d).
NOTE (by design): a FOLD (owner alive) routes the firm's LIQUID estate to
 CREDITORS via the waterfall; a later CHILDLESS DEATH instead scatters real estate
 to the homeless, ESCHEATS cash + liquid assets to the GOVERNMENT, and writes off
 the decedent's owed debts (§2d). Two different events, two different routings.


## 7. REAL ESTATE / ASSETS
- Houses (various sizes) — owned or rented; bigger house -> more happiness.
- Mining land (various sizes) — owned by individuals or mining companies;
  can be rented out.
- DEBT (ONE type, issued identically by any entrepreneur, tech entrepreneur, or
  the government — §11d) plus MINE LAND: the financial assets besides deposits.
  There is NO company equity: entrepreneurs own their firms outright (§4), and
  external finance is debt only.


### 7b. MINING LAND
- Each BLOCK of mining land holds a FINITE but LARGE number of UNITS of RAW
  MATERIAL. There are TWO TYPES of raw material -- COMMON and ADVANCED (§6 bill
  of materials) -- one per mine type.
- Raw materials are REQUIRED by TECH COMPANIES to BUILD MACHINES (§6b).
- Each MONTH the mine's OWNER posts a PRICE and offers ANY quantity up to the
  remaining finite stock (sell as much as you like, at any price; §11 price
  formation). Mine-land yield is a MONTHLY stream.
- Mining land can be SOLD on the SECONDARY MARKET.
- Mining land can be DEPOSITED in a BANK in exchange for BANK SHARES (§8).
- INITIALLY the INDIGENOUS population owns ALL mining land (§10 seed).


## 8. THE BANKS (two, competing)
- There are TWO banks. They COMPETE on two fronts: (a) the INTEREST RATE they
  charge on loans, and (b) the RAW-MATERIAL PRICE they post for the mines each
  operates. Borrowers pick the cheaper/available loan; raw-material buyers pick
  the cheaper seller (the two banks + the independent mines all compete, §6).
- EACH BANK SETS ITS OWN INTEREST RATE (no longer a single monopoly rate):
  borrowers choose the lower rate they qualify for, so competition DISCIPLINES
  rates. There is NO central bank and NO single policy rate. (This REVISES the
  earlier "the bank fixes rates" / policy-lever framing: rates are now set by
  two-bank COMPETITION, which also means the clean ZLB/policy-rate story from the
  macro discussion does not map directly -- flag for the monetary analysis.)
- DEPOSITORS CHOOSE which bank to deposit their mine into (chasing the higher
  expected DIVIDEND); a bank that mismanages (takes loan losses) pays a lower
  dividend and attracts FEWER new mine deposits -> it shrinks relative to its
  rival (though existing deposits are locked, no withdrawal). So banks compete
  for CAPITAL (mines) as well as for borrowers.
- Competition between the two banks (plus independent mines) further MITIGATES
  the raw-material monopoly / self-dealing-valuation risk of the single-bank
  design: neither bank alone sets "the market price".
- BOTH companies AND individuals can borrow. To borrow you must put up an asset
  as COLLATERAL: REAL ESTATE or MINING LAND ONLY. A firm borrows by its
  ENTREPRENEUR pledging their PERSONAL real estate / mine land (a personal
  guarantee) — so a firm failure can seize the owner's house and tip the
  owner-household toward homelessness (firm risk <-> household risk).
- A BANK LOAN'S STRUCTURE: a PLEDGE of COLLATERAL (real estate / mine land),
  then a single LUMP SUM advanced to the borrower, then an EQUAL MONTHLY STREAM
  repaid to a deadline (total > lump sum -- the SAME cash-flow shape as a private
  loan, §11d). BUT bank loans are NON-TRANSFERABLE: the bank holds every loan to
  maturity -- there is NO secondary market for bank loans.
  TWO CREDIT INSTRUMENTS, contrasted on THREE axes:
    BANK LOAN (§8)      : SECURED (collateral) | mechanical LTV gate | NON-transferable
    PRIVATE LOAN (§11d) : UNSECURED            | JSON disclosure     | TRANSFERABLE (resold)
  And on MONEY: a BANK loan CREATES money (the bank writes a NEW deposit from
  nothing); a PRIVATE loan only MOVES existing money (lender's deposit ->
  borrower) and creates NONE. The bank is the money-creator; the private market
  recirculates money.
- LIENS: collateral pledged for a bank loan (real estate OR mine land) carries a
  BANK LIEN. The lien blocks SALE / TRANSFER ONLY: while it is active you CANNOT
  SELL that asset -- not on real-estate day (houses), not on the monthly market
  (mine land), not anywhere -- until the loan is REPAID and the lien released.
  You keep its USE: you may still LIVE in a lien'd house (reaping its HAPPINESS
  reward, §2b) and RENT IT OUT (collecting the rent), and a lien'd mine still
  produces/earns. You lose only the ability to SELL, not the use or the income. This keeps the bank's
  security intact and CLOSES a loophole (pledge -> borrow -> sell the collateral
  -> keep the cash -> default). Consequence: pledged property is LOCKED as well
  as illiquid -- an entrepreneur who pledged their home to fund a start-up (§6c)
  CANNOT sell it to raise food money until the loan clears, sharpening the
  illiquidity-death risk (§2b). On default/fold the bank takes the lien'd asset
  (§6e).
- MACHINES ARE NEVER COLLATERAL. They are WRONG-WAY collateral: a firm usually
  fails BECAUSE its machines are an obsolete generation, i.e. exactly the
  machines nobody will buy — worthless precisely when seized. Excluding them
  also means NO second-hand-machine market is needed (machines are bought new
  from tech cos and depreciate/obsolesce to scrap; they are not resold).
- THE BANK IS A MECHANICAL SECURED LENDER — IT DOES NOT FORECAST. It lends up to
  LTV x (collateral value), marks collateral to market each turn, and issues a
  MARGIN CALL when the collateral falls below the loan. On a margin call the
  BORROWER meets it by SELLING LIQUID ASSETS FIRST (cash, then debt holdings,
  bank shares, mine land) to pay the loan down and CURE the call if it can; the
  bank FORECLOSES only if the borrower's liquid assets cannot cover the shortfall.
  It performs
  NO discounted-cash-flow analysis and holds NO model of the economy; the LTV
  HAIRCUT is its entire risk model. Its decision is a smart-constructor gate:
  Ok(loan) if collateral x LTV >= loan, else Refused. Reactive, never predictive.
- FORWARD-LOOKING credit lives ONLY in the DIRECT DEBT MARKET (§11d), and even
  there NO agent models the economy: a lender applies a LOCAL HEURISTIC over the
  borrower's disclosed JSON (e.g. does current revenue cover the monthly
  repayment by some margin?), not a forecast. The MARKET prices risk (posted
  offer -> accept/decline -> rate ratchet), not any single agent's brain.
- THE BANK'S CAPITAL BASE IS MINING LAND (10x leverage). The ONLY "deposits" the
  bank accepts are MINING LAND (with its remaining RAW MATERIALS) -- NOT cash.
  Any agent may DEPOSIT a mine into the bank. The bank OPERATES the deposited
  mines (sells their raw materials, setting a SINGLE price across all of them)
  and may LEND up to 10x the "TOTAL VALUE" of its current holdings. New money is
  created out of nothing -- a DEBIT-CREDIT write. (This 10x AGGREGATE ceiling is
  SEPARATE from the per-loan LTV gate above.)
- MINING-LAND DEPOSITORS ARE THE BANK'S "SHAREHOLDERS". The bank's TOTAL INCOME
  = raw-material SALES from its mines + loan INTEREST, POOLED and divided into
  yearly DIVIDENDS pro-rata among depositors, PAID on the annual SPECIAL DAY
  (§12), AFTER bank shares have traded. So a depositor gets (roughly) their
  mine's income back PLUS a share of the INTEREST income -- strictly more than
  keeping the mine out -> VERY HIGH motivation to deposit. This is the ONE place
  a "dividend" exists (companies pay none, §4): the bank's equity-like return.
- *** VALUATION LOOPHOLE (flagged -- do NOT implement the naive version) ***
  Robin's draft values holdings at "remaining raw materials x PREVIOUS-TURN
  MARKET PRICE". But the high deposit incentive drives EVERYONE to deposit ->
  the bank OWNS all the mines -> it IS the raw-materials market -> "previous-turn
  market price" = the bank's OWN posted price. The bank could then POST A HIGH
  PRICE to inflate its own lending base and mint money 10x against self-valued
  collateral (a bubble it prices itself), AND it is perversely incentivised to
  HOARD (not sell) raw materials to keep "remaining x price" high -- starving
  tech of inputs. SELF-DEALING COLLATERAL VALUATION.
  RESOLVED RULE -- MARK TO THE INDEPENDENT MINE-LAND MARKET. Value each deposited
  mine at its REMAINING STOCK times a per-unit REFERENCE PRICE taken from the
  INDEPENDENT (undeposited) mine-land SECONDARY MARKET (§11d) for that raw-material
  type. Each independent mine sale reveals price / remaining-units, and a SMOOTHED
  average of recent such trades per type is the reference:
      value(mine) = remaining_units x ref_price_per_unit(type);
      base = SUM over deposited mines;  lending ceiling = 10 x base.
  This CLOSES the loophole at its SOURCE: the price is formed by INDEPENDENT
  owners trading -- and adverse selection keeps the best mines independent (below),
  so that market stays liquid -- NOT posted by the bank. The bank posts
  raw-material prices, never mine-LAND prices. Three virtues: (i) it is the SAME
  mark-to-market the bank already does for per-loan LTV collateral, so ONE price
  signal drives both gates; (ii) it embeds reserves and type automatically -- a
  near-empty mine has few remaining_units and marks LOW; (iii) it is naturally
  PRO-CYCLICAL -- in a bust the bank fire-sells mine land -> mine-land prices fall
  -> the base shrinks -> the ceiling drops -> lending contracts (the §1 amplifier).
  A DEPOSITED mine cannot itself be sold, so it is valued on COMPARABLE
  independent trades (mark-to-model on REAL comparables).
  THIN-MARKET FALLBACK: if a type has not traded independently within the window,
  carry the last reference forward, or use the last realized RAW-MATERIAL sale
  price x a fixed land-in-the-ground HAIRCUT (tunable).
  OPTIONAL REVENUE FLOOR (switch on ONLY if sims show over-lending against hoarded
  or depleted mines): base = SUM of min(value(mine), k x trailing realized
  revenue(mine)) -- caps a mine that marks high but sells nothing.
- WHY NOT EVERYONE DEPOSITS (the brake on universal deposit / monopoly). Against
  the interest-income bonus stand FIVE disincentives:
    1. UNDERCUT -- stay out and price BELOW the bank's monopoly ask to grab the
       tech demand it over-prices (the bank's market power creates this niche).
    2. MONTHLY CASH vs YEARLY DIVIDEND -- own sales pay MONTHLY; the dividend
       pays once a YEAR. Given eat-or-die (§2b), a cash-poor owner CANNOT afford
       to deposit (would starve awaiting the payout). The food clock deters it.
    3. YOU SHARE THE BANK'S LOSSES -- the dividend = mine income + interest MINUS
       defaults/fold losses, so depositing converts SAFE mine income into a
       RISKY bank-profit-share that craters in a crash. Risk-averse owners stay
       out.
    4. LOCK-UP -- an undeposited mine is LIQUID/versatile (pledge as collateral,
       or sell for emergency food cash); deposited, it is committed and loses
       those uses.
    5. ADVERSE SELECTION -- pro-rata pooling DILUTES a large/rich mine (it
       subsidises marginal mines), so the BEST mines stay independent; the bank
       attracts only MIDDLING mines.
  CONSEQUENCE: the disincentives bite hardest on exactly the agents who would
  cause a monopoly -- the BEST mines (5) and the CASH-POOR (2) -- so the
  equilibrium is MIXED and ADVERSELY-SELECTED (bank holds middling mines; the
  strongest stay out and compete). This both prevents the raw-materials monopoly
  AND preserves a real competitive price to mark the lending base against (which
  the FIX above needs). Deposit-incentive vs these disincentives -> a
  PARTIAL-DEPOSIT steady state, not "bank owns everything".
  NOTE: "deposit" here means MINING-LAND CAPITAL, DISTINCT from the monetary
  "deposits" (cash balances) of the SFC ledger. Two different senses of the word
  -- the plan must keep them separate.
- HOW THE BANK MAKES / LOSES MONEY. Income = raw-material SALES (from the mines
  it operates) + loan INTEREST. The ONLY loss channel is UNDER-RECOVERED
  DEFAULTS: on a default/fold the bank seizes the collateral and sells it
  below-market, and loss = (outstanding loan - sale proceeds). The LTV haircut
  makes collateral > loan at origination, so the bank loses ONLY if asset prices
  have CRASHED since (collateral now < loan) -- i.e. losses are a BUST
  phenomenon (plus a small fire-sale-discount loss on any foreclosure). Losses
  on UNSECURED direct-market loans are NOT the bank's (they fall on the
  individual lenders). Net bank profit (interest + mine sales - loan losses) is
  what funds the dividend; losses CUT the dividend, and cumulative losses that
  exhaust bank capital -> INSOLVENCY -> credit FREEZE.
  NUANCE: a DEFAULT mainly destroys bank EQUITY, not money (the deposit the
  borrower spent is still in circulation; only the collateral-recovery portion
  is extinguished). REPAYMENT destroys money. So defaults kill the BANK;
  the money-supply contraction in a bust comes from REDUCED LENDING (shrinking
  base) + deleveraging, not from defaults per se.
- NO WITHDRAWAL; BANK SHARES ARE TRADEABLE MONTHLY (capital behaves like EQUITY).
  Once a mine is deposited it is PERMANENT capital -- a DEPOSITOR can NEVER
  withdraw it. For liquidity you instead SELL your SHARE (the dividend claim) to
  another agent on a MONTHLY SECONDARY MARKET FOR BANK SHARES (same posted-offer /
  buyers-decide / lottery protocol, §11). The buyer becomes the new shareholder;
  the mine stays. On the annual SPECIAL DAY shares trade FIRST, BEFORE the
  dividend (§12), so a share sold then carries this year's dividend to the BUYER
  (cum-dividend). This makes the bank RUN-PROOF FROM THE DEPOSITOR SIDE (no
  depositor can yank capital out) and gives the SHARE a monthly market PRICE that
  tracks the bank's expected dividend (up when loans perform, crashing when
  defaults mount).
- LOSS ABSORPTION & CREDIT DYNAMICS. There is no depositor run -- BUT the bank's
  EQUITY still absorbs loan losses, so the base CAN shrink through them. On a
  default the seized collateral is REAL ESTATE, which is ILLIQUID (sells only on
  real-estate day, §12); to SERVICE the shortfall meanwhile the bank LIQUIDATES
  BANK EQUITY on the MONTHLY market -- it sells some of its MINE-LAND capital
  (monthly market) to raise cash. So loan losses EAT the bank's mine-land base ->
  the 10x ceiling FALLS -> lending CONTRACTS. The crash amplifier is therefore not
  a depositor run but a BANK FIRE-SALE: in a bust the bank dumps mine land to
  cover losses -> mine-land PRICES fall -> the VALUE of remaining deposited mine
  land falls -> base shrinks further -> more contraction (a mine-land
  debt-deflation). Pro-cyclical UP via new deposits in booms; pro-cyclical DOWN
  via loss-driven equity liquidation in busts. A crash BITES THE SHAREHOLDERS via
  a collapsing dividend AND share price AND a shrinking equity base; cumulative
  losses exhausting equity -> INSOLVENCY -> credit FREEZE.
- WHO CAPITALISES THE BANK: mining land starts entirely with the INDIGENOUS
  (§10), so at t0 the bank is capitalised by -- and pays its dividend to -- the
  indigenous/rentier class. They own the mines, capitalise the bank, AND collect
  its dividend: financial power is triply concentrated in them at the start.
  [RESOLVED (a): deposited mining-land VALUE for the 10x cap is MARKED TO THE
   INDEPENDENT MINE-LAND SECONDARY MARKET (the rule above, §8). (b) deposits can
   NEVER be withdrawn -- permanent capital; for liquidity you SELL THE SHARE, not
   the land, so there is no 'bank run on mining land' from the deposit side.
   (c) RESOLVED: when the marked base falls below outstanding loans in a bust the
   bank stops NEW lending and fire-sells its own mine land (above); it does NOT
   force existing borrowers to deleverage en masse -- existing loans are
   disciplined ONLY by PER-LOAN margin calls when that loan's OWN collateral falls
   below it. Per-loan only, no mass recall.]
- (Money is created when the bank lends; destroyed when loans are repaid.)


## 9. THE AUTOMATION SHOCK — enters through ONE parameter
THE DIAL: operators_per_machine(type, generation) = the number of operators
of the matching class needed to run one machine. This is CONSTANTLY GOING
DOWN; the "automation shock" is an acceleration of that decline.

Mechanism, by worked example (a hospital):
  - starts with: 20 doctors, 20 bureaucrats, 10 medical machines,
    10 bureaucrat (admin) machines.
  - a more advanced generation of admin machine needs FEWER operators per
    machine; the hospital buys it, re-optimises, and FIRES the surplus
    bureaucrats. Same throughput, fewer people.

Supply side (who decides how fast this happens):
  - TECH COMPANIES DECIDE which machines (types & generations) to build.
  - Building MORE ADVANCED machines requires ENGINEERS (highest education).
  - So the pace of automation is THROTTLED by the supply of engineers, which
    is throttled by the universities / the education stock. The same system
    that strands low-education workers is gated by high-education workers.


## 10. INITIAL SEED — the LEVEL-0, FULL-EMPLOYMENT START
The economy begins in a STABLE, FULLY-EMPLOYED, LEVEL-0 state. Automation has
not started yet; it must be IGNITED from within (see 10b).

Households:
  - WELFARE AT t0: every individual starts with HEALTH = 10 and HAPPINESS = 10
    (plus some starting EDUCATION consistent with their t0 job's gate, §3b).
  - EVERYONE IS HOUSED: each individual either OWNS a house or RENTS one.
    Houses come in DIFFERENT SIZES. Nobody is homeless at t0.
  - EVERYONE HAS A JOB (full employment at t0). Starting job classes:
    retail/hospitality, bureaucrat, machine operator, engineer.
  - MINING LAND & THE MINES: the INDIGENOUS PEOPLE own ALL mining land AND the
    MINES at t0 — the initial mine-owning rentier/financier class. Their
    raw-material sales (plus land rent) give them a STRONG, STEADY INCOME from
    turn 1. Each indigenous individual starts with 10 UNITS OF HOUSE (their own
    dwelling; being wealthy they quickly accumulate the 10 SPARE units + liquid
    cash gift the fertility gate needs, §2c) and can QUICKLY BUY MORE housing. Being wealthy they EAT PREMIUM FOOD and go to
    the NIGHTCLUB (high health + happiness), and they deploy surplus as CAPITAL:
    LENDING TO ENTREPRENEURS and others (buying company/government DEBT; there
    is no equity to buy, §4) and acting as creditors. So at t0 the indigenous
    people
    are the economy's PRIMARY SOURCE OF CAPITAL. Whether that dominance persists
    or their land/mines migrate to others is a measurable distributional
    OUTCOME, not a fixed assumption (§7).
  - WEALTH IS DISTRIBUTED RANDOMLY across three strata — this is ASSET
    ownership, NOT shelter (everyone is still housed, per the first bullet):
      * BOURGEOISIE: own their home PLUS additional REAL ESTATE, PLUS DEBT
        holdings (company and/or government bonds — no equity, §4).
      * MIDDLE: own ONLY their own home.
      * POOR: own NOTHING — so they RENT their home. Not homeless at t0, but no
        assets and no buffer, hence one shock from the §3 poverty trap.
    (Mining land is NOT part of this draw — all of it is the indigenous
    people's, per the bullet above.)

Labour / skill:
  - There are REGULAR ENGINEERS but NO ADVANCED ENGINEERS at t0. The advanced
    class starts EMPTY — this is what forces ignition (10b).

Starting business composition (category shorthand: supermarket, hospital,
university, nightclub; the fuller typed seed is below):
  - 2 mines
  - 4 tech companies (hire engineers; at t0 produce ONLY level-0 machines;
    each needs materials from BOTH mines — simplify later)
  - 2 supermarkets
  - 2 luxury supermarkets
  - 3 nightclubs
  - 1 public hospital
  - 1 private hospital
  - 1 public university
  - 1 private university
  - 1 bank (fixes interest rates)

Machines & output at t0:
  - Only LEVEL-0 machines exist. Each level-0 machine of a type requires a set
    number of OPERATORS — ops_per_machine(type, 0) — and produces a set number
    of UNITS of goods/services — output_per_machine(type, 0).
  - Each business starts with a given number of machines and employees,
    producing a given number of units per turn; regular citizens CONSUME those
    units each turn. (These counts are the t0 calibration, TBD numerically.)


### 10b. IGNITION — how automation STARTS (nothing automates at t0)
Because only level-0 machines exist and there are no advanced engineers, at t0
the ONLY thing a business can do with its profits is BUY MORE LEVEL-0 MACHINES
— so the economy can only EXPAND (more machines -> more operators hired -> more
output), it cannot yet AUTOMATE. This is the pre-shock expansion phase.

Automation is IGNITED from inside the model, in sequence:
  1. An agent ACQUIRES EDUCATION and becomes an ADVANCED ENGINEER (the class
     that started empty).
  2. A tech company HIRES that advanced engineer and builds a LEVEL-1 (then
     level-2, ...) machine — see 6b(A).
  3. Businesses can now BUY level-1/level-2 machines, which produce the SAME OR
     MORE goods/services with FEWER employees -> the fire/redeploy choice of
     6b(B) finally has something to bite on.

Consequence: the "automation shock" is not an external event — its TIMING is
endogenous, set by how fast the education system produces the first advanced
engineer. University funding/speed (§5b) is therefore the master lever on WHEN
the shock fires, not merely how unequal its aftermath is.


## 11. MARKETS & PRICE FORMATION (four markets)
There are FOUR markets: CONSUMER, EMPLOYMENT, MACHINES, CAPITAL. Prices are
NOT set by a central auctioneer that clears supply against demand. Every market
runs the SAME disequilibrium protocol, so gluts and shortages are allowed and
informative:

  COMMON PROTOCOL (each turn):
    (1) SELLERS post/advertise their prices FIRST.
    (2) BUYERS then decide what and how much to buy.
    (3) If demand > available supply, the good/asset SELLS OUT and a RANDOM
        LOTTERY decides which buyers are served (rationing by chance, NOT by
        willingness to pay).
    (4) SELLERS use PREVIOUS-TURN FEEDBACK to reset prices: what SOLD OUT
        (raise) vs what went UNSOLD (cut), and what COMPETITORS charged
        (undercut / match). Prices ADAPT turn-to-turn; they are never
        instantaneously cleared.
  Initial conditions FIX a starting price in every market; loop (4) takes over
  from t1.

11a. CONSUMER MARKET — rent, food, entertainment, health, education
  - RENT: houses come in sizes: lowest rent = 10 units, with 20-unit and
    30-unit houses too (bigger house -> more happiness, §2b). Rent is
    advertised and PAID ANNUALLY, UPFRONT, on the annual REAL-ESTATE DAY — the
    full housing-market mechanism (re-advertisement, sitting-tenant preference,
    income-ranked applicants, sale) is §12. (Housing is thus the ONE market
    that runs yearly, not monthly.)
  - FOOD (supermarket / luxury), ENTERTAINMENT (nightclub), HEALTH (private
    hospital), EDUCATION (private university) follow the common protocol:
    advertise -> buy -> can sell out -> lottery.

11b. EMPLOYMENT MARKET — labour (opens only on JOB DAY, §12)
  - The labour market opens ONCE A YEAR, as the JOB step (4) of the annual
    SPECIAL DAY (§12) -- AFTER real-estate SALES, BEFORE the rental market.
    Between special days there is NO hiring.
  - INCUMBENCY = FIRST PREFERENCE (exactly like real estate's sitting tenant):
    you have FIRST PREFERENCE on the job you already hold and keep it at the
    SAME salary (no automatic raise) if you want it; you need not reapply.
  - APPLYING ELSEWHERE: on job day you MAY also apply for OTHER job listings,
    provided you meet the job's MINIMUM EDUCATION (§3/§3b) — the hard gate on
    who may apply. Win another listing and you VACATE your old job.
  - SELECTION for a listing: the INCUMBENT (if any) has first preference; among
    the OTHER eligible applicants, the HEALTHIEST WINS (rationing by health, not
    lottery). So health is both a welfare stock AND a hiring edge.
    (Symmetry with §12 housing: both markets are first-preference-to-the-
    incumbent, then rank the rest — by HEALTH for jobs, by SALARY for tenants.)
  - SALARIES: each listing carries a salary (fixed at t0; new/competing listings
    set their own). You raise your wage only by WINNING a higher-salary listing
    on job day — competition is THROUGH listings on job day, not continuous
    poaching.
  - LOSING A JOB: firms may shed workers ANY month (automation / distress), but
    a laid-off worker CANNOT be rehired until the NEXT JOB DAY — so unemployment
    lasts up to 12 months (until the next annual job day). Hold SAVINGS to buy
    food meanwhile or you STARVE
    (§2b). This makes job loss a DURABLE, dangerous event, not a one-month blip.

11c. MACHINES MARKET — capital goods (tech companies -> businesses)
  - The machines market opens ONCE A YEAR, in the JOB step of the annual SPECIAL
    DAY (§12), together with hiring: a firm reconfigures its CAPITAL (machines)
    and its LABOUR (operators) in the SAME annual act.
  - Each machine has a PURCHASE cost AND a MAINTENANCE cost; level-0 values are
    fixed by the initial conditions.
  - Multiple tech companies sell the SAME machines and COMPETE ON PRICE: they
    list prices, businesses place ORDERS. Machines can SELL OUT, which triggers
    the producer(s) to RAISE prices next turn (protocol step 4).

11d. CAPITAL MARKET — assets: mine land + DEBT (one type; NO equity)
  - There is NO company equity to trade — entrepreneurs own their firms
    OUTRIGHT (§4). The tradeable assets are MINE LAND (earns RENT) and DEBT.
  - MINE LAND trades on a MONTHLY SECONDARY MARKET: bought and sold each month
    under the common protocol (posted ask, buyers decide, random lottery when
    oversubscribed; symmetric price FALL when over-supplied). So mine land is a
    LIQUID asset (unlike houses, which trade only on real-estate day, §12).
  - There is ONLY ONE TYPE OF DEBT: the amortising term loan below. EVERY
    borrower — a generic entrepreneur, a tech entrepreneur, OR the GOVERNMENT —
    issues it the SAME way, and any individual buys it the same way. (There is
    no separate "government bond"; it is this one instrument.) Houses trade on
    real-estate day, §12.
  - PARTICIPATION (buyer/lender side is OPEN): ANY AGENT holding ENOUGH SAVINGS
    can participate in the debt market as a lender — not just rentiers or the
    indigenous people; it is gated by a SAVINGS THRESHOLD, not by class
    (parallel to the savings gate on becoming an entrepreneur, §6c). Savings is
    thus the single key to the capital market: enough of it lets you either
    LEND or START A FIRM.
  - LENDING TO A COMPANY (debt market with FULL DISCLOSURE), three steps:
    (1) The ISSUER EXPOSES ALL ITS INFORMATION as a JSON file on the debt
        market. Disclosure content is issuer-specific: a COMPANY exposes its
        balance sheet, machines, outstanding debt and revenue; the GOVERNMENT
        exposes all its TAX REVENUE and SALARY OBLIGATIONS (the doctors,
        teachers and bureaucrats it must pay).
    (2) The BORROWER makes an OFFER that DEFINES the instrument ("a PRIVATE
        LOAN"): an initial LUMP SUM (the principal advanced to the borrower),
        then a stream of EQUAL MONTHLY PAYMENTS up to a DEADLINE. Those payments
        sum to a TOTAL that is GREATER than the lump sum; the excess
        (total - lump sum) IS the interest. (A plain fixed-installment term loan;
        no other schedule shapes for now.)
    (3) The BUYER OF THE DEBT (the lender) reads the JSON + the offer and
        either ACCEPTS it or does NOT -- binary, no negotiation.
    So the BORROWER posts all terms and the LENDER is accept/decline (matching
    the §11 "sellers post, buyers decide" protocol). If no lender bites, the
    company re-posts next turn at a BETTER (higher) interest rate (protocol
    step 4) -- so a distressed firm visibly RATCHETS UP its offered rate to
    place its debt, in full view of the disclosed JSON. (The JSON offer is a
    natural gold-log artifact; the buyer's accept/refuse reason lands in
    Layer 2.)
  - PRIMARY AND SECONDARY ARE THE SAME MARKET. A debt instrument may be sold by
    its ORIGINAL BORROWER (new issuance = primary) OR by a CURRENT HOLDER
    reselling it (secondary -- e.g. the bank liquidating receivables seized in a
    fold, §6e, or any holder raising cash). From the BUYER's side the two are
    IDENTICAL: you see the BORROWER's full current JSON + the instrument's
    REMAINING payment sequence, and accept or decline. On a RESALE the holder
    lists a NEW PRICE (which may be BIGGER OR SMALLER than the original lump sum,
    depending on how many payments remain and the borrower's current JSON); the
    buyer who accepts PAYS that price to the SELLER and then RECEIVES the
    remaining monthly payments. No NEW claim is created (an existing claim just
    CHANGES HANDS), and the JSON shown is ALWAYS the underlying BORROWER's (whose
    repayments you are buying), never the seller's. So there is no separate
    "secondary market" to build -- it is this one market.
  - A GOVERNMENT BOND IS EXACTLY THIS SAME INSTRUMENT: a lump sum TO the
    government, equal monthly payments back to a deadline, total > lump sum;
    issued and resold identically. Only the disclosed JSON differs (the
    government's tax revenue + salary obligations, §5) -- there is no special
    "bond" type.
  - MARK-TO-MARKET consequence (a real §1 amplifier). Because existing debt can
    be resold, it has a MARKET PRICE that tracks the borrower's current JSON. As
    a borrower's JSON DETERIORATES, the resale price of its debt FALLS -> holders
    take losses when they sell -> a DEBT-REPRICING channel: distressed-firm debt
    gets marked down and dumped BEFORE any default, feeding the asset-price
    collapse of §1 (so debt-deflation now hits debt VALUE, not only via
    defaults). Debt is therefore a LIQUID asset (sellable ANY month), unlike
    houses.
  - All assets trade under the common protocol: SELLERS advertise an asking
    price, BUYERS decide, and a RANDOM function picks which sale succeeds when
    there are too many buyers per unit on offer.
  - SYMMETRIC adjustment (CONFIRMED -- it is protocol step 4, §11): the common
    protocol already cuts the price of what went UNSOLD, so the mirror of the
    sold-out case is built in. Too many SELLERS, too few buyers (asset DUMPING in
    a downturn) -> the ASKING PRICE FALLS next turn. This falling-price branch is
    the asset-collapse / margin-call channel of §1 and §8; without it the
    debt-deflation spiral cannot run, and it is present.


## 12. TIME & THE ANNUAL SPECIAL DAY
CLOCK: there are 12 MONTHS in a year. EACH TURN IS ONE MONTH. Most activity
(food, welfare & education spend, government distribution, mine-land & debt
trading) happens EVERY month. But ONCE A YEAR there is a single SPECIAL DAY on
which bank-share trading, the dividend, real-estate SALES, the job market and the
RENTAL market ALL happen, in a STRICT INTRA-DAY ORDER -- each step feeds the next:
    THE SPECIAL DAY (annual), in order:
      (1) BUY & SELL BANK SHARES. The bank-share secondary market (§11d) runs
          FIRST -- BEFORE the dividend is paid, so a share sold now carries THIS
          YEAR's dividend to the BUYER, not the seller (sold cum-dividend).
      (2) RECEIVE THE DIVIDEND. The bank pays its ANNUAL dividend, pro-rata, to
          whoever holds each share AFTER step (1) (§8).
      (3) BUY & SELL REAL ESTATE ("real-estate SALE"). Houses change hands (the
          ONLY time they can; multiple buyers -> RANDOM winner). Each owner then
          DECIDES whether to OCCUPY the property or RENT IT OUT. Sales do NOT
          depend on a job, so they settle BEFORE the job market.
      (4) JOB MARKET ("job day"). Apply for jobs / switch; selection is
          healthiest-wins with the incumbent first (§11b). MACHINES also trade
          now (§11c), so capital and labour reconfigure together.
      (5) RENTAL MARKET. ONLY NOW, once each agent HAS or HAS NOT secured a job,
          are tenancies matched -- because applicants are ranked by SALARY / JOB
          TITLE, the job must be known first. Properties their owners elected to
          rent out (step 3) are let here.
"Real-estate day" and "job day" name steps of this one annual SPECIAL DAY; note
SALES (3) precede jobs (4) but RENTING (5) follows them. Everything else is
monthly.

REAL-ESTATE SALE (step 3), for each property:
  - An owner may offer the property FOR SALE. If there are MULTIPLE BUYERS the
    winner is chosen AT RANDOM. This annual day is the ONLY time a house can be
    bought or sold -- houses are ILLIQUID in between, which is exactly what
    enables the asset-rich / cash-poor ILLIQUIDITY-DEATH of §2b. (Mine land and
    debt, by contrast, trade monthly, §11d.)
  - Having BOUGHT (or KEPT) the property, the owner DECIDES whether to LIVE IN IT
    (occupy, for the happiness of a bigger / own home, §2b) or RENT IT OUT. Only
    properties elected for rent enter the RENTAL MARKET (step 5).

RENTAL MARKET (step 5), for each property offered to rent:
  - The OWNER RE-ADVERTISES the rent price (annual re-pricing; rents adjust only
    at this annual event).
  - The CURRENT TENANT has FIRST PREFERENCE to renew -- unless the property was
    SOLD out from under them in step (3), in which case the new owner's
    occupy/rent choice governs.
  - Other individuals may ALSO APPLY.
  - Among applicants OTHER than the sitting tenant, the owner PREFERS the one with
    the HIGHEST SALARY / JOB TITLE (known from step 4).
  - RENT IS PAID UPFRONT FOR THE WHOLE YEAR. A tenant who cannot pay the full year
    upfront does NOT secure the home; an individual who ends up with no dwelling
    has HEALTH GO TO ZERO (§2b homelessness rule).

Why this matters (emergent consequences, for the model — see plan §scheduling):
  - ANNUAL LIQUIDITY CLIFF: a full year's rent is due upfront on ONE day, so a
    worker who lost income needs a whole year's buffer to stay housed. The
    real-estate day becomes a SYNCHRONISED RECKONING where the cash-poor are
    evicted EN MASSE -> homeless -> health 0 (§3 poverty trap). A gradual
    downturn can thus produce a SHARP ANNUAL EVICTION CLIFF, not smooth decline.
  - NO MID-YEAR HOMELESSNESS: because the whole year's rent is paid upfront, a
    tenant's housing is SECURE for the year; homelessness is decided ONLY on
    real-estate day. An agent can lose its JOB mid-year (layoffs any month, §11b)
    but its HOUSE only annually -- unemployment is a MONTHLY risk, homelessness an
    ANNUAL one.
  - TENANT-SORTING BY INCOME: ranking non-incumbent applicants by salary/title
    means that in a downturn landlords swap low-paid/unemployed tenants for
    higher-paid applicants -> the weakest lose housing FIRST, reinforcing the
    displacement and divide of §1.
  - FREQUENCY SEPARATION: housing adjusts ANNUALLY while labour/goods/capital
    adjust MONTHLY. Housing is the SLOW variable; the macro cycle may
    PHASE-LOCK to this annual forcing (crashes clustering at year boundaries).


## DESIGN DECISIONS (ALL RESOLVED) & TUNABLE PARAMETERS
No design questions remain open. Resolved this round:
- FERTILITY: gate = 10 SPARE units + 3G liquid; mandatory ceiling = 100 units +
  10G liquid; a child is endowed AT BIRTH with 10 units + cash gift G (§2c).
  Whether an eligible owner in the VOLUNTARY band reproduces is governed by its
  OPTIMIZATION STRATEGY (§2b). (Still tunable: the cash-gift value G.)
- RENT PERIODICITY: ANNUAL, paid UPFRONT on real-estate day (§12).
- MID-YEAR HOMELESSNESS: NONE. Rent is a year paid upfront, so housing is secure
  for the whole year; homelessness is decided ONLY on real-estate day. Only
  UNEMPLOYMENT happens mid-year (layoffs any month, §11b).
- LOOKAHEAD HORIZON: depends on the agent's TIME-PREFERENCE -- long-term-motivated
  agents look FURTHER ahead; short-term-motivated agents are more MYOPIC (§2b).
- MACHINE MARKET: trades on JOB DAY (annual, §11c).
- MINE-LAND YIELD: MONTHLY; a mine may sell ANY quantity up to its remaining
  finite stock, at any price it posts (§6, §7b).
- BANK LENDING-BASE VALUATION: deposited mine land is MARKED to the INDEPENDENT
  mine-land secondary market -- remaining_units x a per-type reference price from
  recent independent trades (§8). Optional revenue floor noted there.
- CHILDLESS ESTATE: cash + ALL liquid assets ESCHEAT to the GOVERNMENT; real
  estate -> random homeless; the decedent's own owed debts written off (§2d).
- EDUCATION CHOICE: the agent picks which career-type to study from LAST YEAR's
  JOB OFFERINGS -- adaptive, backward-looking (§2b, §3).
- MARGIN CALLS: the borrower meets them by SELLING LIQUID ASSETS FIRST; the bank
  forecloses only if liquid assets fall short (§8).
- OVERSUPPLY / GLUT: the symmetric price-FALL is protocol step 4 (unsold -> cut
  next turn); CONFIRMED (§11, §11d).
- DEATH vs LIQUIDITY: you CANNOT die while any LIQUID asset remains -- the engine
  force-sells it to feed you; the countdown starts only when liquid is exhausted
  (§2b).

RESOLVED (design — nothing left genuinely open):
- INTEREST RATES: set by two-bank COMPETITION; no central/policy rate (§8).
- LABOUR-FORCE INFLOW: BIRTHS are the ONLY inflow (§2c) -- no immigration; new
  workers enter as children in the lowest tier.
- RETRAINING: a career switch resets education to level 0 (§3); re-education then
  proceeds at the NORMAL education rate (public lottery + private tuition, §5b) --
  there is NO separate "retraining speed", it IS ordinary education from 0.
- SCRIPTED-AGENT OBJECTIVES: DELIBERATELY the implementer's choice (what the
  GOVERNMENT optimizes; an ENTREPRENEUR's reinvest-vs-extract split) -- a decided
  policy, not a gap.
- BANK FORCED DELEVERAGING: PER-LOAN margin call ONLY, no mass recall. The
  aggregate 10x ceiling governs NEW lending (it stops as the base shrinks);
  existing loans are disciplined by their OWN collateral via per-loan margin
  calls (§8).
- CHILDLESS-ESTATE DETAILS: secured bank collateral seized FIRST, then escheat/
  scatter the rest; a <10-unit real-estate remainder escheats to the government;
  the first child inherits the NET estate only, never liabilities (§2d B/C/D).

TUNABLE NUMERIC PARAMETERS (calibration, NOT design -- set at t0 and swept, no
design decision outstanding):
- the required cash gift G (default ~ one year of subsistence food);
- the bureaucrat support ratio β (default 1 at generation 0, §4);
- the raw-material recipe coefficients per generation (§6);
- LTV haircut, the 10x leverage cap, the per-unit sales-tax rate, the fire-sale
  discount, total raw-material stock, and the t0 counts (§10). Each is a knob.
