// health_test.ts — the stranger scene. Ben is cured in public. Cleo's disease
// is not produced, so she pays. A cure does not raise health. Ben's later ask
// is only in the intent log.

import { assertEquals } from "jsr:@std/assert@1";
import { fixedClock, seededIds } from "../log/ids.ts";
import { fileJournal } from "../log/journal.ts";
import { healthSeed } from "../world/seed.ts";
import { loadWorld } from "../world/store.ts";
import { assertInvariant, instrumentSums } from "../world/world.ts";
import { healthSceneOrders, runHealth } from "./health.ts";
import { openRig } from "./rig.ts";

Deno.test("the health scene cures, rations, refuses, and balances", async () => {
  const dir = Deno.makeTempDirSync({ prefix: "econ-health-" });
  try {
    const ctx = openRig(dir, healthSeed(), seededIds("health"), fixedClock());
    await runHealth(ctx, healthSceneOrders());
    const world = loadWorld(ctx.worldPath);
    assertInvariant(world);
    for (const [name, sum] of Object.entries(instrumentSums(world))) {
      assertEquals(sum, 0, name);
    }

    assertEquals(world.people.ben.diseases, []);
    assertEquals(world.people.ben.health, 0);
    assertEquals(world.people.cleo.diseases, []);
    assertEquals(world.people.cleo.health, 0);
    assertEquals(world.people.ada.education.engineer, 1);
    assertEquals(world.people.cleo.education.bureaucrat, 1);
    assertEquals(world.people.ada.education.bureaucrat, 0);
    assertEquals(world.people.doc.assignment, "d2");
    assertEquals(world.people.teach.assignment, "engineer");
    assertEquals(world.people.cleo.deposits.a, 50);
    assertEquals(world.firms["priv-hosp"].deposits.a, 20);
    assertEquals(world.firms["priv-uni"].deposits.a, 10);
    assertEquals(world.rng, { seed: 8, stream: 6 });

    const journal = fileJournal(ctx.journalPath).all();
    assertEquals(journal.map((entry) => `${entry.source} ${entry.effect}`), [
      "engine pinHealth",
      "agent assign",
      "agent assign",
      "agent cure",
      "agent cure",
      "agent levelUp",
      "agent levelUp",
      "agent post",
      "agent post",
      "agent buyCure",
      "agent buyTuition",
    ]);

    const cleoCure = ctx.intentLog.all().filter((row) =>
      row.agent === "household:cleo" && row.reason.includes("public hospital")
    );
    assertEquals(cleoCure.map((row) => row.status), ["attempted", "rationed"]);

    const intent = ctx.intentLog.all();
    const asked = intent.findIndex((row) =>
      row.agent === "household:ben" && row.reason.includes("buy a d2")
    );
    assertEquals(intent[asked].status, "attempted");
    assertEquals(intent[asked + 1].status, "refused");
    assertEquals(intent[asked].callId, intent[asked + 1].callId);
    assertEquals(
      journal.some((entry) => entry.correlationId === intent[asked].correlationId),
      false,
    );
  } finally {
    Deno.removeSync(dir, { recursive: true });
  }
});
