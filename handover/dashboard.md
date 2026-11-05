1. Load the gold-demo skill at `~/.claude/skills/gold-demo/SKILL.md`.
2. Read the MacBeth nodes and the other PDFs the skill references. The nodes are MacBeth's Note 3, `~/git/gold/from-neil/workers-state-via-tensor.pdf` (covering note `~/git/gold/from-neil/2026-09-15_Doc-3-workers-state-via-tensor_from-macbeth.txt`), and Note 5, `~/git/harness/toy-harness-is-a-worker.pdf` (covering note `~/git/harness/2026-10-11-macbeth-reply-toy-harness-is-a-worker.txt`). Read the rest of the skill's PDF list too, including `~/git/gold/from-neil/programming-with-containers.pdf` and `neil-containers.md` §9.
3. If you need an idea for how a piece is built, look at the code in the other gold demos the skill names. `treasury` and `starship` are siblings in this parent directory. The rest are under `~/git/gold/`: `tower`, `stalin`, `firm`, `federation`, `voting`, `dungeon`, `org-chart`. Copy the treasury spine. Do not invent a second one.

# Dashboard — the five panels

A reader of logs that already balance. `deno task dashboard` writes `demo-out/dashboard.html` from whatever scene directories are in `demo-out`. The page opens on `special`. On `monthSeed` the journal is still `pay` then `lendBank`.

## What landed

`src/dashboard/tape.ts` reads one scene: the world, the journal, and the intent log. `src/dashboard/html.ts` and `src/dashboard/client.js` draw one column of five panels sharing that scene's months. `src/dashboard/render.ts` is the command. The scripted month is unchanged.

The panels are Consumer, Employment, Housing, Machines, and Capital. A checkbox hides a series. The month rail selects a month, and the reasons for that month sit under the column. Hovering a point names the series.

## What ./verify.sh did

Command: `./verify.sh`.

- Exit 0.
- `deno check` clean across `src/`.
- `ok | 138 passed | 0 failed`.
- `PASS: stdout, worlds and logs are byte-identical across two runs.`

`src/lib/algebra.ts` was not edited. `demo-out/dashboard.html` is not part of the replay. The browser check opened the page, switched from `special` to `market` and to `leaves`, hid the nightclub series, and looked at a phone-width viewport. No console errors.

## Rulings

- The journal stores the effect tag and not the price. A posted price is a listing still on the world, and it is dated at `world.month`, because that is the only book the file holds.
- Cleared quantity is the positive side of the flow divided by that posted price, and only when one price was posted and it divides the flow. Anything else is a warning. It is not a quantity.
- A series the scene did not post is named absent. It is not drawn as zero.
- The demo scenes are separate seeds. The page does not lay them on one axis.
- A share posting has no panel in `plan-so-far.md` §11. It is printed under the column.
- A debt listing's price is plotted as posted. It is not converted into a rate. No scene posts one.
- The loan rate is the integer on the bank, including the seed.
- Every outcome is on the month's reason list. A refusal counts as a refused renewal only when the reason itself says rent, renew, or evict. A short purse does not.
- Unemployment is the share of the living with no job. A wage taken from a seated person, where that career posted no listing, is labelled seated.
- The tech mode is still handed in. `upgradeOwn`, fire versus `issueDebt`, margin calls, the ordinary price posts, the debt and mine and share markets, and `orderMaterial` are not built. The panels show the gap.

## Next

Calibrating whether the deflation spiral shows up is its own session, and it is not this pass.
