// harness_test.ts — the protocol. Empty reason, a missing command, and a scope
// violation never call the command. A gate refusal is attempted, then refused,
// one call id, and the journal does not grow.

import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import { Refusal } from "../cli/refusal.ts";
import { fixedClock, seededIds } from "../log/ids.ts";
import { fileJournal } from "../log/journal.ts";
import { storySeed } from "../world/seed.ts";
import { loadWorld } from "../world/store.ts";
import type { HarnessCtx } from "./harness.ts";
import { runMutation } from "./harness.ts";
import { openRig } from "./rig.ts";
import { playStory, story } from "./story.ts";
import { assertInvariant, instrumentSums, moneySupply } from "../world/world.ts";

function rig(): { ctx: HarnessCtx; dir: string } {
  const dir = Deno.makeTempDirSync({ prefix: "econ-" });
  const ctx = openRig(dir, storySeed(), seededIds("desk"), fixedClock());
  return { ctx, dir };
}

function watch(ctx: HarnessCtx): { ctx: HarnessCtx; calls: () => number } {
  let n = 0;
  return {
    calls: () => n,
    ctx: {
      ...ctx,
      econ: (argv) => {
        n++;
        return ctx.econ(argv);
      },
    },
  };
}

const teller = { agentId: "teller", allowed: new Set(["pay", "lend", "repay"]) };

Deno.test("an empty reason never reaches the command", () => {
  const { ctx, dir } = rig();
  try {
    const before = Deno.readTextFileSync(ctx.worldPath);
    const w = watch(ctx);
    const outcome = runMutation(
      w.ctx,
      teller,
      "pay",
      ["pay", "--from", "ada", "--to", "ben", "--amount", "10", "--row", "wages"],
      {},
      "",
    );
    assertEquals(outcome.ok, false);
    assertEquals(w.calls(), 0);
    assertEquals(ctx.intentLog.all().map((r) => r.status), ["refused"]);
    assertEquals(Deno.readTextFileSync(ctx.worldPath), before);
    assertThrows(() => Deno.statSync(ctx.journalPath));
  } finally {
    Deno.removeSync(dir, { recursive: true });
  }
});

Deno.test("a command outside the registry is refused with no attempt", () => {
  const { ctx, dir } = rig();
  try {
    const w = watch(ctx);
    const outcome = runMutation(
      w.ctx,
      { agentId: "auditor", allowed: new Set(["books"]) },
      "pay",
      ["pay"],
      {},
      "a reason",
    );
    assertEquals(outcome.ok, false);
    assertEquals(w.calls(), 0);
    assertEquals(ctx.intentLog.all().length, 1);
    assertEquals(ctx.intentLog.all()[0].status, "refused");
  } finally {
    Deno.removeSync(dir, { recursive: true });
  }
});

Deno.test("a gate refusal is attempted then refused, and the journal does not grow", () => {
  const { ctx, dir } = rig();
  try {
    const before = Deno.readTextFileSync(ctx.worldPath);
    const outcome = runMutation(
      ctx,
      teller,
      "lend",
      [
        "lend",
        "--bank",
        "a",
        "--borrower",
        "ada",
        "--amount",
        "100",
        "--collateral",
        "note",
        "--installment",
        "1",
        "--months",
        "1",
      ],
      { bank: "a", borrower: "ada" },
      "a schedule that cannot cover the principal",
    );
    assertEquals(outcome.ok, false);
    if (outcome.ok) return;
    assertEquals(outcome.reason.includes("below principal"), true);
    const lines = ctx.intentLog.all();
    assertEquals(lines.map((r) => r.status), ["attempted", "refused"]);
    assertEquals(lines[0].callId, lines[1].callId);
    assertEquals(Deno.readTextFileSync(ctx.worldPath), before);
    assertThrows(() => Deno.statSync(ctx.journalPath));
    assertEquals(loadWorld(ctx.worldPath).loans, {});
  } finally {
    Deno.removeSync(dir, { recursive: true });
  }
});

Deno.test("a committed pay keeps the reason out of the journal", () => {
  const { ctx, dir } = rig();
  try {
    const reason = "because the rent is due";
    const outcome = runMutation(
      ctx,
      teller,
      "pay",
      ["pay", "--from", "ada", "--to", "ben", "--amount", "10", "--row", "wages"],
      {},
      reason,
    );
    assertEquals(outcome.ok, true);
    if (!outcome.ok) return;
    const lines = ctx.intentLog.all();
    assertEquals(lines.map((r) => r.status), ["attempted", "ok"]);
    assertEquals(lines[0].callId, lines[1].callId);
    assertEquals(lines[1].correlationId, outcome.correlationId);
    assertEquals(lines[1].reason, reason);
    const entry = fileJournal(ctx.journalPath).trace(outcome.correlationId);
    assertEquals(entry?.source, "agent");
    assertEquals(entry?.effect, "pay");
    assertEquals(JSON.stringify(entry).includes(reason), false);
    const traced = ctx.econ(["journal", "trace", outcome.correlationId]).value as {
      correlationId: string;
    };
    assertEquals(traced.correlationId, outcome.correlationId);
  } finally {
    Deno.removeSync(dir, { recursive: true });
  }
});

Deno.test("the CLI itself refuses a missing reason", () => {
  const { ctx, dir } = rig();
  try {
    const before = Deno.readTextFileSync(ctx.worldPath);
    assertThrows(
      () =>
        ctx.econ([
          "pay",
          "--from",
          "ada",
          "--to",
          "ben",
          "--amount",
          "10",
          "--row",
          "wages",
        ]),
      Refusal,
    );
    assertEquals(Deno.readTextFileSync(ctx.worldPath), before);
  } finally {
    Deno.removeSync(dir, { recursive: true });
  }
});

Deno.test("the story through the command surface closes and replays", () => {
  const dir1 = Deno.makeTempDirSync({ prefix: "econ-s1-" });
  const dir2 = Deno.makeTempDirSync({ prefix: "econ-s2-" });
  try {
    const play = (dir: string) => {
      const ctx = openRig(dir, storySeed(), seededIds("economy"), fixedClock());
      const seen: number[] = [];
      playStory(ctx, (world, step) => {
        assertInvariant(world);
        for (const [name, sum] of Object.entries(instrumentSums(world))) {
          assertEquals(sum, 0, `${name} at step ${step}`);
        }
        seen.push(step);
      });
      const world = loadWorld(ctx.worldPath);
      assertEquals(world.interbank, -story.crossInterest);
      assertEquals(world.banks.a.loansOutstanding, story.lend - story.repay);
      assertEquals(world.banks.a.equity, -1000 + story.interest);
      assertEquals(moneySupply(world), 1860);
      return {
        world: Deno.readTextFileSync(ctx.worldPath),
        journal: Deno.readTextFileSync(ctx.journalPath),
        intent: Deno.readTextFileSync(ctx.intentPath),
        seen,
      };
    };
    const a = play(dir1);
    const b = play(dir2);
    assertEquals(a.seen, [0, 1, 2, 3, 4]);
    assertEquals(a.world, b.world);
    assertEquals(a.journal, b.journal);
    assertEquals(a.intent, b.intent);
  } finally {
    Deno.removeSync(dir1, { recursive: true });
    Deno.removeSync(dir2, { recursive: true });
  }
});
