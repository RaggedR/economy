// tech_test.ts — upgrade posts, delivery mints, and a shop has no strategy.

import { assertEquals } from "jsr:@std/assert@1";
import { fixedClock, seededIds } from "../log/ids.ts";
import { fileJournal } from "../log/journal.ts";
import { techSeed } from "../world/seed.ts";
import { loadWorld } from "../world/store.ts";
import { assertInvariant, instrumentSums } from "../world/world.ts";
import { openRig } from "./rig.ts";
import { runTechScene, techLeaf } from "./tech.ts";

Deno.test("the tech scene mints generation 1 on delivery and balances", async () => {
  const dir = Deno.makeTempDirSync({ prefix: "econ-tech-" });
  try {
    const ctx = openRig(dir, techSeed(), seededIds("tech"), fixedClock());
    await runTechScene(ctx);
    const world = loadWorld(ctx.worldPath);
    assertInvariant(world);
    for (const [name, sum] of Object.entries(instrumentSums(world))) {
      assertEquals(sum, 0, name);
    }
    const minted = Object.values(world.machines).filter((machine) =>
      machine.generation === 1
    );
    assertEquals(minted.length, 1);
    assertEquals(minted[0].owner, "shop");
    assertEquals(minted[0].builder, "mill");
    assertEquals(world.firms.shop.deposits.a, 15);
    assertEquals(world.firms.mill.deposits.a, 15);
    assertEquals(world.interbank, 0);
    const journal = fileJournal(ctx.journalPath).all();
    assertEquals(journal.map((entry) => `${entry.source} ${entry.effect}`), [
      "agent strategy",
      "agent deliverMachine",
    ]);
    const reasons = ctx.intentLog.all().filter((row) => row.status === "ok").map((row) =>
      row.reason
    );
    assertEquals(reasons, [
      "mill offers the next generation",
      "shop takes delivery of generation 1",
    ]);
  } finally {
    Deno.removeSync(dir, { recursive: true });
  }
});

Deno.test("a shop is not asked strategy, and an empty reason does not attempt", async () => {
  const dir = Deno.makeTempDirSync({ prefix: "econ-tech-absent-" });
  try {
    const ctx = openRig(dir, techSeed(), seededIds("tech"), fixedClock());
    const absent = await techLeaf(ctx, "shop").run(
      {
        tag: "strategy",
        firm: "shop",
        mode: "stay",
        reason: "the shop tries to choose a generation",
      },
      0,
    );
    assertEquals(absent.tag, "refused");
    assertEquals(ctx.intentLog.all().map((row) => row.status), ["refused"]);
    assertEquals(fileJournal(ctx.journalPath).all().length, 0);

    const empty = await techLeaf(ctx, "mill").run(
      { tag: "strategy", firm: "mill", mode: "stay", reason: "" },
      0,
    );
    assertEquals(empty.tag, "refused");
    assertEquals(ctx.intentLog.all().map((row) => row.status), ["refused", "refused"]);
    assertEquals(fileJournal(ctx.journalPath).all().length, 0);
  } finally {
    Deno.removeSync(dir, { recursive: true });
  }
});
