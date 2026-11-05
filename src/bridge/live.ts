// live.ts — the swap behind the decoder. The scheduler calls a Runner. It
// does not know whether the answer was scripted. A read stays scripted: the
// model does not get to author the books.

import { answerWithBrain } from "../model/brain.ts";
import type { HarnessCtx } from "./harness.ts";
import { recordLeafRefusal } from "./harness.ts";

// One world file. A tensor owes both replies, and Promise.all would run the
// two commits at once. The chain keeps the writes in ask order. The scripted
// path never touches it, because that answer returns before the next leaf.
const tails = new WeakMap<HarnessCtx, Promise<unknown>>();

function isRead(shape: unknown): boolean {
  return typeof shape === "object" && shape !== null &&
    (shape as { tag?: string }).tag === "readBooks";
}

/** No brain: one scripted answer, in the same order as before. A brain: the
 *  model speaks, and `commit` is the only path into the command. */
export function liveAnswer<S>(
  ctx: HarnessCtx,
  agent: string,
  shape: S,
  scripted: (shape: S) => unknown,
): unknown | Promise<unknown> {
  if (!ctx.brain || isRead(shape)) return scripted(shape);
  const prev = tails.get(ctx) ?? Promise.resolve();
  const run = prev.then(() =>
    answerWithBrain(
      ctx.brain,
      agent,
      shape,
      () => scripted(shape),
      (reason) => recordLeafRefusal(ctx, agent, reason),
    )
  );
  tails.set(ctx, run.then(() => {}, () => {}));
  return run;
}
