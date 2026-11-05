# Economy — plan to start building

## For the instance that builds this

Before any code:

1. Load the gold-demo skill at `~/.claude/skills/gold-demo/SKILL.md`.
2. Read the MacBeth nodes and the other PDFs the skill references. The nodes are MacBeth's Note 3, `~/git/gold/from-neil/workers-state-via-tensor.pdf` (covering note `~/git/gold/from-neil/2026-09-15_Doc-3-workers-state-via-tensor_from-macbeth.txt`), and Note 5, `~/git/harness/toy-harness-is-a-worker.pdf` (covering note `~/git/harness/2026-10-11-macbeth-reply-toy-harness-is-a-worker.txt`). Read the rest of the skill's PDF list too, including `~/git/gold/from-neil/programming-with-containers.pdf` and `neil-containers.md` §9.
3. If you need an idea for how a piece is built, look at the code in the other gold demos the skill names. `treasury` and `starship` are siblings in this parent directory. The rest are under `~/git/gold/`: `tower`, `stalin`, `firm`, `federation`, `voting`, `dungeon`, `org-chart`. Copy the treasury spine. Do not invent a second one.

Write a handover after each milestone, at `handover/<n>.md`. Copy the three instructions above, verbatim, into the top of that file, so the next instance reads them before anything else. Under them, say what landed, what `./verify.sh` did, any ruling you had to make, and what the next milestone is. Then stop if the milestone is the end of your instance range below.

The object is a treasury-pole gold demo of the automation economy in this directory. The accounting is five financial instruments in integer minor units, each summing to zero, with a flow column per holder at the end of the month. The control is one worker whose state is the world, delegating to memoryless leaves through a gated command surface. A refusal is a position. The month is ordinary scheduler code.

Nothing in this plan is to be built until it is approved. `absfc_core.py` stays where it is.

## What was read

- The gold-demo skill, and the checklist it says every demo instantiates.
- MacBeth, Note 3: `workers-state-via-tensor.pdf`, via the 15 Sep 2026 covering note. A worker is a morphism `ΔS ⊗ X → Y`. It unfolds into `fwd : S × X₀ → Y₀` and a backward map that splits into `bwdS` (writeback) and `bwdX` (the reply). The split exists because state is tensored on, not composed. `ΔS ⊗ ΔT = Δ(S × T)` entangles two stores. `ΔS ◁ ΔT` nests them, and the writeback is no longer a clean pair.
- MacBeth, Note 5: `toy-harness-is-a-worker.pdf`, via the 11 Oct 2026 reply. Transcript = store, one turn = fwd-then-writeback, the loop = coKleisli iteration, spawn = a nested worker whose store is hidden, the permission gate = a smart constructor. A denied command and a broken tool are both positions. The clock, ids, working directory, and turn cap are not the store.
- `neil-containers.md` §7 and §9. The trap that matters here: `⊗` owes every reply, `×` owes one, and `seqC(a, sumC(b, c))` silently computes `(a ◁ b) + (a ◁ c)`. `stalin/branch.ts` is the repair, and it is deliberately not in `lib/`.
- `interfaces.tex` (the typed spec, including the rulings in Part IV) and `prompt-so-far.md`. `plan-so-far.md` for the motive and the dashboard, not for mechanics.
- The built spines: `treasury` (the sibling this demo copies), `starship` (same spine, gather-amalgamation), `stalin/branch.ts` and `stalin/gosplan.server.ts` (why the month is not a `seqC`). `treasury/src/lib/algebra.ts` and `starship/src/lib/algebra.ts` are byte-identical. Both are the in-process trim of gold's `algebra.ts` (`leafLocal` instead of the socket `leaf()`). Gold's own copy is the 11,520-byte file; we copy the treasury trim and do not edit it.
- `absfc_core.py`: a float, one-bank, three-instrument prototype (`deposits`, `loans`, `bonds`) whose `check()` is the right idea and the wrong chart.

## Authority, where the documents disagree

`interfaces.tex` is the spec that gets typed. `prompt-so-far.md` supplies domain detail the interface does not retype (fold waterfall, inheritance routing, special-day consequences). `plan-so-far.md` is earlier. Where it still says one bank, one education stock, withdrawable mine deposits, household fission, or debts cancelled in both directions, it is not the spec.

These readings in `prompt-so-far.md` are the earlier rule, including where a later section of the same file has already revised them:

- One bank, and the seed line "2 mines" and "1 bank". There are two banks, `a` and `b`. Each material needs enough parcels, and enough owners who do not deposit, that an independent sale can be observed. That lower bound is a requirement of the valuation rule, not a flavour of the seed.
- Public production divided by population. Citizens `bidEducation` and `bidCure`. The engine serves homeless, then renters, then owners, and lotteries inside a tier. A winner takes one full level or ten units of the matching specialty. A loser takes nothing.
- Health generally trends up because of a free health grant. Luxury food is the only addition to the health stock, still capped by `H_max(happiness)`. A cure clears one disease and adds no points. Staple food resets starvation and does not touch the stock.
- A time-preference or lookahead field on a person. Education reads last year's job archive. The five objectives already separate spending now from accumulating.
- `β` as a second formula, bureaucrats per productive worker. Bureaucrats are the operators of admin machines. `β` is `ops(bureaucrat, 0)`, default 1. Capacity is the one formula in Part II.
- The government leaf pays wages, pays interest, and distributes an equal share. Contractual flows are the engine's writeback, before any leaf runs. The government leaf sets the two mixes and may fire or `issueDebt`. It has no shape that pays cash, transfers a house, or buys food.

The practical difference: an implementer who treats `prompt-so-far.md` as one consistent document will rebuild the chart the interface closed. The interface wins on contact.

## Two disagreements the build has to keep in view

**What "amalgamation" is.** The interface calls the auditor's join of journal to intent log the amalgamation, and says sub-balances sum and debits equal credits. The gold skill and treasury split those. Item 6 of the spine is reconciliation. Item 7 is the container morphism: control down, data up. In treasury the upward map is addition of T-accounts. Both are real here, and they are not the same construction.

- The treasury fold is the invariant. After every effect, each of the five instruments sums to zero across holders. After the last effect of a month, each holder's flow column sums to zero: inflows minus outflows equal the change in net financial assets.
- Inside a market phase, amalgamation is `tensorC`. Every poster and every buyer answers, and the engine consumes the tuple. A market is not a product. `productC` owes one reply.
- Reconciliation is the auditor leaf. An alarm is a committed agent mutation with no recorded reason. A blocked entry is a refusal, present only in the intent log.

Building only the log join would meet the interface's sentence and miss the pole. Building only the sum-to-zero check would meet treasury and miss the reason the two logs exist.

**Nesting.** Note 5 and the skill's fifth milestone hide a child's store inside `spawn`. The interface says there is one worker, its state is the world, and the leaves are memoryless. Copying last year's listings or a balance sheet into an agent forks the books. Those are fields of the world, read back through the command surface.

So this demo does not grow a `fleet/consolidation.ts`. Role changes are fibre changes, the same device as `ExportChoice` in `stalin/containers.ts`: entrepreneur is the household container plus `FirmC` scoped to the owned firm, plus `TechC` when the firm is a tech firm, and the extra summand is absent once the role is gone. Absence is not a refusal. On a scripted run the intent log is a file beside the world. On a live run the harness transcript is a second register, `Δ(Transcript)`, stamped with real ids and real times. It is not seeded, and it is not a field of `World`.

The month is not `seqC` over a sum. Phase order is fixed by Part I. `seqC(phase, sumC(food, welfare))` would mean "decide, then ask", and the TypeScript would do that whether or not we meant it. `stalin/gosplan.server.ts` hit this and repaired it with `seqBranchC` only where a reply must choose the next fibre. Here the scheduler already knows the phase and the role before it asks. `seqBranchC` is not needed, and `seqC` is the wrong tool. The scheduler is a function.

## Language

TypeScript on Deno, the treasury cut. `plan-so-far.md` §10 recommended Python first and a port later. The interface is already written as TypeScript, the `Runner` plug is forced TypeScript, and `absfc_core.py` is the wrong chart (one bank, floats, `bonds` as a third instrument, a string ledger). The core is not imported. Its four-step story — pay moves money, lend creates it, repay destroys it, `check` after every transaction — is the first scenario, re-expressed on the five-instrument integer chart.

Money is an integer number of minor units. A float sum is not the replay.

## The worker, concretely

`S` is `World`. One step of the engine or one committed command is `bwdS = applyEffect`. The reply that goes back to a leaf is `bwdX`, an `Act` or a `Read<T>`. Leaves do not hold `S`.

What is not `S`, even though it is easy to stuff into the JSON: the working directory, the turn counter, token budgets, and the parameters of Part III. `RngState` is part of `World`, because a lottery is replayable state. Domain ids (`nextId`) and `month` are fields of `World` on every run. Log correlation ids and timestamps are the injectable seams in `src/log/ids.ts`, branched once on `--live`:

- scripted: `seededIds` and `fixedClock`, and `verify.sh` diffs stdout and both logs
- live: `realIds` and `realClock`

A live run that is stamped with the fixed clock is a false audit. That is starship PR #1. The branch lives in `demo.ts` from the first demo, even while `--live` refuses with "not implemented". The model client, when it exists, is the only file that knows a wire format. The scheduler does not know which client it called.

## A representation the interface left implicit

The five instruments sum to zero only if both sides are stored. The interface names the sides and then gives `Bank` four fields: `loanRate`, `equity`, `losses`, and the id. Holder purses store the asset side of deposits. A check that sums those purses and stops is the money supply, not a conservation law. A loan stored as one record with `bank` and `borrower` on it makes "sum to zero" true by the shape of the record.

`absfc_core.py` is non-vacuous because each side is a number the transaction has to hit. Confirmed: the first milestone adds three counters on `Bank`, maintained by the reducer and checked against the derived records. Deriving the liability and trusting only the monthly flow column was the alternative, and it was declined. A reducer bug has to be able to fail the check.

- `depositLiability` — negative, per bank, equal to minus the deposits held at that bank by people, firms, and the government
- `loansOutstanding` — equal to the sum of that bank's loan principals
- `sharesOutstanding` — equal to the units of that bank's share records

`equity` stays what the interface says it is. Interest and ore sales raise it. Dividends and losses lower it. It is not the deposit liability. The three counters are a completion of `Bank` so the invariant can fail. They are not a new instrument.

`World.interbank` is the single antisymmetric claim of `a` on `b`. It moves only when the payee is a bank and the payer's balance at that bank is short. A person-to-person `pay` debits the payer's largest balance and credits the payee at that same bank, and that bank's deposit liability is unchanged.

Journal lines need a source, or every engine wage alarms:

```ts
type JournalEntry = {
  correlationId: string;
  month: number;
  ts: string;
  effect: Effect["tag"];
  source: "agent" | "engine";
};
```

The interface's `JournalEntry` has no `source` and no `ts`. Both are the same kind of completion as the bank counters. Without `source`, reconciliation cannot tell an engine writeback (no intent record, by spec) from an agent commit (an alarm if the reason is missing). Without `ts`, the fixed-clock / real-clock rule has nothing to stamp. The intent record likewise gains `ts`. Its status set stays the interface's: `attempted | ok | rationed | refused | error`.

## Shape absent, or shape refused

Two mechanisms, and they must not be collapsed.

- The container for a leaf is rebuilt from the world at the start of the phase. `keepJob` exists only on the job step. `applyJob` exists only when the person's level in that career is at least the listing's generation. `postMaterial` on a mine exists only while that parcel is undeposited, for the owner, and only while it is deposited, for that bank. Health does not remove `keepJob` or `applyJob`. A missing command, from inside the leaf, is the same position as a refusal or a broken tool — because the registry never listed it.
- A shape that was asked and fails its gate returns `Act` of tag `refused`. It is written to the intent log only. `requestLoan` is the worked example: the shape exists, the gate judges collateral, LTV, and the leverage ceiling, and the bank leaf never sees the decision. `reason === ""` is refused before the command runs.

`rationed` is a committed partial fill, both logs, including a lottery loss with `filled: 0`. It does not appear until a market exists.

## Instances

One instance builds one range, writes a handover after every milestone inside it, and stops at the end of the range. Treasury is about 7,600 lines and starship about 9,200, and starship's extensions were separate plans. The spec in front of you is already about 2,700 lines. An instance that continues past its range drops the rulings in this plan. One instance can emit files for the whole economy in a sitting. Keeping every effect honest against the five rows is what takes the breaks.

1. **Milestones 0–5.** The spine. Stop when `./verify.sh` is green on the demo.
2. **Milestones 6–8.** People, firms, the fold, and staple food. This is the first time the invariant meets a real market.
3. **Milestones 9–12.** The special day, the public lottery, generations, and the full month, with placeholder leaves.
4. **Milestone 13.** Only after Robin has accepted the leaf policies written in that section. Calibrating whether the nightmare emerges is its own session, after the policies are in.
5. **Milestone 14 and the dashboard, each its own pass.** `--live` is one. The five-panel HTML dashboard in `plan-so-far.md` §11 is the other. The dashboard is a reader of logs that already balance.

The handoff between instances is this plan, the `handover/*.md` files, and a green `./verify.sh`. It is not a recap of the spec.

## Milestones

Each one is green (`deno task check`, `deno task test`, and from milestone 1 also `./verify.sh`) before the next starts, and each one ends by writing `handover/<n>.md` with the reading instructions at the top. Milestones 0–5 are the first instance. Milestones 6–14 are the later instances. Approving the plan approves the first instance and the constraints on the later ones. It does not approve writing 6–14 in the same breath.

### 0. The spine, no economy

Copy into `economy/`, and do not edit `algebra.ts`:

| Path | From |
|---|---|
| `src/lib/algebra.ts` | `treasury/src/lib/algebra.ts`, byte-identical |
| `src/log/ids.ts` | treasury, unchanged |
| `deno.json`, `verify.sh` | treasury's shape: tasks `econ`, `demo`, `test`, `check` |

`src/log/journal.ts`, `intentlog.ts`, and `reconcile.ts` follow treasury's protocol and the record types above. Write-ahead is treasury's `runMutation`: registry, then argument scope, then non-empty reason, then an `attempted` line, then the command, then `ok`, `rationed`, `refused`, or `error`, one `callId` throughout. The CLI never writes the reason. The journal line is appended only inside `commit`, after the reason check and the gate.

### 1. The books, and a CLI that can only do the four-step story

`src/world/types.ts` types the world from Part II, including the three bank counters and `source` on the journal. Most arrays are empty.

`src/world/world.ts` is `applyEffect` for three effects: `pay`, `lendBank`, `repayBank`. Interest to a bank is a `pay` that lowers the payer's deposit and raises that bank's equity. It does not retire principal. `assertInvariant` runs after every effect and throws on a leak. That throw is a bug, not a refusal.

`src/world/gates.ts` returns `Ok(effect) | Refused(reason)`. The reducer accepts an effect and does not judge it again.

`src/cli/econ.ts` is the one executable. JSON is the default format. Exit 0 on success, 1 on refusal to stderr. Reads, no reason: `books`, `journal recent`, `journal trace`. Mutations, reason required: `pay`, `lend`, `repay`. One `commit()` closure.

The seed is the smallest world on which those three commands mean something: banks `a` and `b`, the government, two people with deposits at different banks. No firms, no houses, no mines. The scripted scenario, driven as a list the way treasury drives postings:

1. A `pay` that stays on one bank. That bank's deposit liability is unchanged. Money supply is unchanged.
2. A `pay` to a bank that is short at the payer's balance there. `interbank` moves. Deposits still sum to zero.
3. `lendBank`. A deposit and a loan appear together. Both rows still sum to zero.
4. A `repayBank` of principal. The deposit and the loan shrink together.
5. An interest `pay`. Customer deposits shrink, equity rises, the loan principal does not.

`absfc_core.py`'s demo is the oracle for the story, not for the numbers' representation. Tests live next to the reducer. `verify.sh` runs it twice.

### 2. The rest of the financial gates, still no households

Effects, each with a gate and a test that the illegal one cannot be held: `issuePrivate`, `acceptDebt`'s `transferPrivate`, `writeOff`, `depositMine`, `dividend`, `seize`. `issueDebt` is legal only when the installment times the months is an integer, at least the principal, and both are positive. `sellCapital` is legal only when that bank's equity is negative, or its loans exceed `leverageMultiple` times its marked mine base. A lien blocks `depositMine` and any transfer. An empty reason never reaches the reducer.

Mines and shares enter here as data, because `depositMine` is the operation that separates "deposit" the purse from "deposit" the parcel. The parcel count in this seed is whatever the tests need, not the t₀ population.

### 3. The auditor, one read-only leaf

`AuditorC` is `invariant` and `reconcile`. The registry contains no mutation. `leafLocal` decodes the reply. A reply that does not decode throws, and the level logs the refusal. No default.

The scripted auditor calls `books` and `reconcile` and returns the two reports. This is the plug against `algebra.ts`. There is no tensor yet.

Reconciliation alarms only on `source: "agent"`. Engine lines are excluded. A planted agent commit with no intent record must alarm. A refused `lend` must show as blocked and must not appear in the journal.

### 4. One mutating leaf

The bank leaf is the smallest mutating registry: `postLoanRate`, and `postMaterial` / `sellCapital` only for mines deposited at that bank. The household shape in this milestone is only `requestLoan`. The gate judges it. The bank does not.

Scripted policy, local, no forecast, and explicitly the implementer's slot from Part IV rather than a number in the spec:

- The bank's next rate moves toward the other bank's posted rate, and steps up when `losses` is positive or the loan book was full. The ore price is posted from the same observations. It does not read a price level.
- The household asks for a loan against an unliened house or mine when the gate would accept it, and names a reason. One scenario asks with collateral that fails LTV, so the refusal is visible only in the intent log.

Argument scope is treasury's device: the same command, fenced to `bank: "a"` or `bank: "b"`. Bank `a` cannot post bank `b`'s rate.

### 5. One month, as a function, and the first thing a stranger can watch

`src/bridge/scheduler.ts` is a plain function. A comment at the top says why it is not `seqC`, citing `stalin/branch.ts`. The phase list for this milestone is a prefix of Part I, not the whole month:

1. Engine: one contractual `pay` (a wage). Journal line, `source: "engine"`, no intent record.
2. Tensor of the two households, each asked `requestLoan` or a read. `tensorC`, so both owe a reply.
3. Engine: apply the `Ok` effects. A refusal is not applied.
4. Auditor: invariant and reconcile.

`deno task demo` prints the books and the reconciliation report. A stranger sees a wage land with no reason in the journal, a legal loan land with a reason in the intent log and a correlation id in both, an illegal loan refused only in the intent log, and the five rows at zero. Under a minute. `./verify.sh` diffs the two runs. That is the definition of done for the start.

The printed books are the visible rendering at this scale. The five-panel HTML dashboard in `plan-so-far.md` §11 is a reader of these logs. It waits until a month produces prices.

## After the start, in order, each one re-checking the invariant

These are named so the types from milestones 0–5 do not have to be repainted. They belong to the later instances. The instance that finishes milestone 5 writes `handover/5.md` and stops.

6. People, houses, and the two purses. `draw` moves a firm deposit to its owner after the capital step. Opening obligations are paid from the firm purse. The household buys food from its own purse.
7. Firms, machines, maintenance paid to `Machine.builder` (zero if the builder has folded), and the fold waterfall: wages, tax, the bank, unsecured holders, with the food reserve and unmortgaged houses kept out. A same-month loan cannot reach back into the opening.
8. Listings and one market, staple food. Sellers post before buyers. Cheapest lots if the buyer named no seller, then a draw from `RngState` on a sell-out. `rationed` is the committed outcome, including `filled: 0`. Starvation is the engine rule after that, not a leaf.
9. The special day, in the interface's order: shares, dividend, house sales by seeded lottery, `occupyOrLet`, jobs and machine orders, rents. Share trades do not run again in the ordinary step 7 of that month. Mine trades and debt still do.
10. Disease draws, the two government mixes, bids, and the public lottery. Private cures and tuition are discretionary and settle after staple and after the special day's rent.
11. The tech summand: `stay`, `expand`, `upgrade`. A generation enters the world when a built machine of that generation is delivered, not when the plan is chosen. `ops(c, g)` falls in `g`. `output(c, g)` does not.
12. The rest of the month from Part I, including births and deaths. Reproduction has no shape. The fertility gate is engine code. Inheritance is the prompt's resolved routing: secured collateral first, houses to the homeless in 10-unit pieces, liquid assets escheat to the government, the decedent's own unsecured debts are written off, and the first child inherits the net estate only.
13. The other scripted leaves, still with no model of the economy. Proposed, and open for you to reject before that milestone: government assigns public staff toward last month's disease counts and toward careers that listed slots; an entrepreneur leaves in the firm whatever last month's maintenance, tax, and debt service cost, and draws the rest; a lender accepts when disclosed revenue covers the installment by a fixed multiple; households spend in objective order after staple food, and train toward the job archive. None of these reads a forecast of the price level.
14. `--live`, behind the seam from milestone 0. Discover the model from the provider's `/v1/models`. Honour `Retry-After` on 429, both as seconds and as an HTTP date. Do not hardcode a model id.

Knobs with no stated default (`LTV`, the sales tax, `δ_h`, `δ_q`, the reprice factors, the disease probability, the savings threshold, `H_max` beyond the interface's linear placeholder) are a `params.ts` object with named placeholders. They are not invented inside a reducer. Sweeping them is not part of the start. The t₀ population (4 tech firms, 2 of each shop, 3 nightclubs, 1 of each hospital and university, full employment, all housed, indigenous mine owners, no level-1 engineer) is the seed of milestone 12, not of milestone 1.

## Tests that have to exist before the corresponding code is called done

- After every effect in every scripted scenario, the five rows sum to zero, or the test fails with the instrument's name.
- `pay` across banks moves `interbank` and does not change the sum of deposit liabilities.
- `lendBank` then `repayBank` returns the deposit row and the loan row to their previous totals. An interest `pay` between them changes equity and does not change principal.
- A gate refusal is a value. The reducer is never called. The journal does not grow. The intent log contains `attempted` and then `refused` under one call id.
- An engine effect grows the journal with `source: "engine"` and grows the intent log by nothing. Reconciliation does not alarm.
- An agent journal line with no intent record alarms.
- A decoder rejects an out-of-union reply and does not coerce it.
- `verify.sh` is green on the demo.

TDD fits milestones 1–4: the inputs and outputs are already typed. The scripted policies in milestone 13 are where the interface said the implementer chooses, so those tests should pin the chosen rule once you have accepted it, not before.

## What the first branch does not contain

- The HTML dashboard.
- A model client.
- `productC` used as a lottery. Lotteries draw from `RngState` after a tensor has collected the bids.
- A second store on a leaf, a forecast inside a leaf, or `Math.random` / `Date.now` inside `applyEffect`.
- An edit to `src/lib/algebra.ts`, or a shared import of it from treasury. The copy is the test of whether it is a library.
- A port of the float ledger, household fission, bilateral debt cancellation, or a free per-capita health grant.
- Nesting for its own sake.

## Confidence

About 85% that milestones 0–5, built this way, replay and balance. The spine is already running in treasury, the three bank counters are confirmed, and the effects in milestone 1 are the ones `absfc_core.py` already demonstrated on a coarser chart.

The emergence in §1 of the prompt — deflation, the debt spiral, the distribution — is a property of milestones 8–13. The start does not claim it.
