// leaves_policy_test.ts — the four policies commit, and the quiet issuer is not asked.

import { assertEquals } from "jsr:@std/assert@1";
import { fixedClock, seededIds } from "../log/ids.ts";
import { leafSeed } from "../world/seed.ts";
import { loadWorld } from "../world/store.ts";
import { openRig } from "./rig.ts";
import { runLeaves } from "./spend.ts";

Deno.test("the leaf scene assigns, reserves, lends, and spends", async () => {
  const dir = Deno.makeTempDirSync({ prefix: "econ-leaves-" });
  try {
    const ctx = openRig(dir, leafSeed(), seededIds("leaves"), fixedClock());
    await runLeaves(ctx);
    const world = loadWorld(ctx.worldPath);
    assertEquals(world.people.doc.assignment, "d0");
    assertEquals(world.people.teach.assignment, "engineer");
    assertEquals(world.people.ada.deposits.a, 50);
    assertEquals(world.people.ben.deposits.a, 60);
    assertEquals(world.people.cleo.deposits.a, 200);
    assertEquals(world.firms.shop.deposits.a, 30);
    assertEquals(world.government.deposits.a, 20);
    assertEquals(world.people.ben.education.engineer, 2);
    assertEquals(world.people.ada.education.engineer, 0);
    assertEquals(world.people.cleo.education.engineer, 0);
    const loan = Object.values(world.loans).find((row) => row.kind === "private");
    if (!loan || loan.kind !== "private") throw new Error("cleo did not take the loan");
    assertEquals(loan.holder, "cleo");
    assertEquals(loan.principal, 10);
    assertEquals(ctx.intentLog.all().some((row) => row.reason.includes("shop")), false);
  } finally {
    Deno.removeSync(dir, { recursive: true });
  }
});
