// scheduler_test.ts — the month prefix. The wage has no intent record. The
// legal loan is in both logs. The illegal loan is in the intent log only.
// Reconciliation does not alarm. Two runs match.

import { assertEquals } from "jsr:@std/assert@1";
import { fixedClock, seededIds } from "../log/ids.ts";
import { fileJournal } from "../log/journal.ts";
import { reconcile } from "../log/reconcile.ts";
import { monthSeed } from "../world/seed.ts";
import { loadWorld } from "../world/store.ts";
import { instrumentSums, moneySupply } from "../world/world.ts";
import { openRig } from "./rig.ts";
import { runMonth } from "./scheduler.ts";

Deno.test("the month prefix balances, refuses in the intent log, and replays", async () => {
  const dir1 = Deno.makeTempDirSync({ prefix: "econ-m1-" });
  const dir2 = Deno.makeTempDirSync({ prefix: "econ-m2-" });
  try {
    const once = async (dir: string) => {
      const ctx = openRig(dir, monthSeed(), seededIds("economy"), fixedClock());
      const result = await runMonth(ctx);
      return { ctx, result };
    };
    const a = await once(dir1);
    const b = await once(dir2);

    assertEquals(a.result.households.left.tag, "done");
    assertEquals(a.result.households.right.tag, "refused");
    assertEquals(a.result.recon.ok, true);
    assertEquals(a.result.recon.alarms.length, 0);
    assertEquals(a.result.recon.blocked.length, 1);
    assertEquals(a.result.recon.matched.length, 1);
    assertEquals(a.result.books.instruments.deposits, 0);
    assertEquals(a.result.books.instruments.loans, 0);

    const world = loadWorld(a.ctx.worldPath);
    for (const [name, sum] of Object.entries(instrumentSums(world))) {
      assertEquals(sum, 0, name);
    }
    assertEquals(world.people.ada.deposits.a, 1100);
    assertEquals(world.government.deposits.a, 100);
    assertEquals(world.banks.a.loansOutstanding, 500);
    assertEquals(world.banks.a.equity, -700);
    assertEquals(moneySupply(world), 1600);
    const borrowers = Object.values(world.loans).map((l) =>
      l.kind === "bank" ? l.borrower : ""
    );
    assertEquals(borrowers, ["ada"]);

    const journal = fileJournal(a.ctx.journalPath).all();
    assertEquals(journal.map((e) => e.source), ["engine", "agent"]);
    assertEquals(journal.map((e) => e.effect), ["pay", "lendBank"]);
    assertEquals(journal[0].correlationId, a.result.wage);
    const wageIntent = a.ctx.intentLog.all().filter((r) =>
      r.correlationId === a.result.wage
    );
    assertEquals(wageIntent, []);

    const ben = a.ctx.intentLog.all().filter((r) => r.agent === "household:ben");
    assertEquals(ben.map((r) => r.status), ["attempted", "refused"]);
    assertEquals(ben[0].callId, ben[1].callId);
    assertEquals(ben[1].reason.includes("LTV"), true);

    const again = reconcile(fileJournal(a.ctx.journalPath), a.ctx.intentLog);
    assertEquals(again.ok, true);

    assertEquals(
      Deno.readTextFileSync(b.ctx.worldPath),
      Deno.readTextFileSync(a.ctx.worldPath),
    );
    assertEquals(
      Deno.readTextFileSync(b.ctx.journalPath),
      Deno.readTextFileSync(a.ctx.journalPath),
    );
    assertEquals(
      Deno.readTextFileSync(b.ctx.intentPath),
      Deno.readTextFileSync(a.ctx.intentPath),
    );

    // A planted agent line with no intent record alarms. The engine line does not.
    fileJournal(a.ctx.journalPath).append({
      correlationId: "ROGUE",
      month: 0,
      ts: "t",
      effect: "pay",
      source: "agent",
    });
    const planted = reconcile(fileJournal(a.ctx.journalPath), a.ctx.intentLog);
    assertEquals(planted.ok, false);
    assertEquals(planted.alarms.map((x) => x.kind), ["write-without-reason"]);
  } finally {
    Deno.removeSync(dir1, { recursive: true });
    Deno.removeSync(dir2, { recursive: true });
  }
});
