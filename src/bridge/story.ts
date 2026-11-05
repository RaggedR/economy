// story.ts — the four-step story, driven as a list through the command surface.
// Interest is a pay. It does not retire principal.

import { loadWorld } from "../world/store.ts";
import type { World } from "../world/types.ts";
import { type HarnessCtx, type Registry, runMutation } from "./harness.ts";

export const story = {
  sameBank: 200,
  crossInterest: 100,
  lend: 300,
  repay: 100,
  interest: 40,
} as const;

const teller: Registry = {
  agentId: "teller",
  allowed: new Set(["pay", "lend", "repay"]),
};

function onlyLoan(world: World): string {
  const ids = Object.keys(world.loans);
  if (ids.length !== 1) throw new Error(`expected one loan, found ${ids.length}`);
  return ids[0];
}

export function playStory(
  ctx: HarnessCtx,
  check?: (world: World, step: number) => void,
): void {
  const step = (
    n: number,
    tool: string,
    argv: string[],
    args: Record<string, unknown>,
    reason: string,
  ) => {
    const outcome = runMutation(ctx, teller, tool, argv, args, reason);
    if (!outcome.ok) throw new Error(`${tool} refused: ${outcome.reason}`);
    check?.(loadWorld(ctx.worldPath), n);
  };

  step(
    0,
    "pay",
    [
      "pay",
      "--from",
      "ada",
      "--to",
      "ben",
      "--amount",
      String(story.sameBank),
      "--row",
      "wages",
    ],
    { from: "ada", to: "ben" },
    "ada pays ben on the bank that holds her deposit",
  );
  step(
    1,
    "pay",
    [
      "pay",
      "--from",
      "ada",
      "--to",
      "b",
      "--amount",
      String(story.crossInterest),
      "--row",
      "bankInterest",
    ],
    { from: "ada", to: "b" },
    "ada pays interest to bank b, where she holds nothing",
  );
  step(
    2,
    "lend",
    [
      "lend",
      "--bank",
      "a",
      "--borrower",
      "ada",
      "--amount",
      String(story.lend),
      "--collateral",
      "note",
      "--installment",
      "30",
      "--months",
      "10",
    ],
    { bank: "a", borrower: "ada" },
    "bank a lends ada 300",
  );
  const loan = onlyLoan(loadWorld(ctx.worldPath));
  step(
    3,
    "repay",
    ["repay", "--loan", loan, "--amount", String(story.repay)],
    { loan },
    "ada repays principal",
  );
  step(
    4,
    "pay",
    [
      "pay",
      "--from",
      "ada",
      "--to",
      "a",
      "--amount",
      String(story.interest),
      "--row",
      "bankInterest",
    ],
    { from: "ada", to: "a" },
    "ada pays interest to bank a; the principal stays",
  );
}
