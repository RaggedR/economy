// demo.ts — the books a stranger can watch. One id source and one clock for the
// whole run. --live selects the real seams and then refuses: this pass does
// not call a model, and it does not stamp a live run with the fixed clock.

import { formatBooks } from "./world/books.ts";
import { monthSeed, storySeed } from "./world/seed.ts";
import { loadWorld } from "./world/store.ts";
import {
  type Clock,
  fixedClock,
  type IdSource,
  realClock,
  realIds,
  seededIds,
} from "./log/ids.ts";
import { fileJournal } from "./log/journal.ts";
import { reconSummary } from "./log/reconcile.ts";
import type { HarnessCtx } from "./bridge/harness.ts";
import { openRig } from "./bridge/rig.ts";
import { runMonth } from "./bridge/scheduler.ts";
import { playStory } from "./bridge/story.ts";

const p = (s = "") => console.log(s);

function printScene(ctx: HarnessCtx): void {
  const journal = fileJournal(ctx.journalPath).all();
  const intent = ctx.intentLog.all();
  p("journal");
  for (const e of journal) {
    const reasoned = intent.some((r) =>
      r.correlationId === e.correlationId &&
      (r.status === "ok" || r.status === "rationed")
    );
    const why = e.source === "engine"
      ? "no intent record"
      : reasoned
      ? "reason in the intent log"
      : "NO REASON";
    p(`  ${e.source}  ${e.effect}  ${e.correlationId}  ${why}`);
  }
  p("intent");
  for (const r of intent) {
    p(`  ${r.agent}  ${r.status}  ${r.correlationId ?? "—"}  ${r.reason}`);
  }
  p(formatBooks(loadWorld(ctx.worldPath)));
}

async function runScripted(ids: IdSource, clock: Clock): Promise<void> {
  p("object: one worker, and the world is its state");
  p("accounting: five instruments, integer minor units, each row sums to zero");
  p("control: the engine pays a wage; a leaf asks for a loan; a refusal is a position");

  p("\n— story: pay, pay a bank, lend, repay, pay interest —\n");
  const storyCtx = openRig("demo-out/story", storySeed(), ids, clock);
  playStory(storyCtx);
  printScene(storyCtx);

  p("\n— month: a wage with no reason, a loan with a reason, a loan refused —\n");
  const monthCtx = openRig("demo-out/month", monthSeed(), ids, clock);
  const month = await runMonth(monthCtx);
  printScene(monthCtx);
  p(reconSummary(month.recon));
  for (const b of month.recon.blocked) p(`  blocked  ${b.agent}  ${b.reason}`);
  for (const a of month.recon.alarms) p(`  ALARM  ${a.kind}`);
}

export async function start(argv: string[]): Promise<number> {
  if (argv.includes("--live")) {
    // Real seams, selected and not used. A live clock must not stamp these books.
    const ids = realIds();
    const clock = realClock();
    void ids.next;
    void clock.now;
    console.error("not implemented");
    return 1;
  }
  await runScripted(seededIds("economy"), fixedClock());
  return 0;
}

if (import.meta.main) {
  const code = await start(Deno.args);
  Deno.exit(code);
}
