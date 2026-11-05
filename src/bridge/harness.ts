// harness.ts — registry, argument scope, reason, then the write-ahead line.
//
// Order, and it is the whole protocol: the allowlist, then the argument scope,
// then a non-empty reason, then `attempted`, then the command, then one outcome
// under the same callId. An empty reason, a missing command, and a scope
// violation are `refused` with no `attempted` line, and the command does not
// run. A gate refusal inside the command is `attempted` then `refused`. The
// journal is untouched in both cases. The CLI never writes the reason.

import type { Clock, IdSource } from "../log/ids.ts";
import type { IntentLog, IntentRecord, IntentStatus } from "../log/intentlog.ts";
import { loadWorld } from "../world/store.ts";
import { Refusal } from "../cli/refusal.ts";

export type ConRun = (argv: string[]) => { value: unknown };

export type HarnessCtx = {
  readonly ids: IdSource;
  readonly clock: Clock;
  readonly intentLog: IntentLog;
  readonly worldPath: string;
  readonly journalPath: string;
  readonly intentPath: string;
  readonly econ: ConRun;
};

export type Registry = {
  readonly agentId: string;
  readonly allowed: ReadonlySet<string>;
  readonly argScope?: (tool: string, args: Record<string, unknown>) => string | null;
};

export type MutationOutcome =
  | { readonly ok: true; readonly correlationId: string; readonly result: unknown }
  | { readonly ok: false; readonly reason: string };

function monthOf(ctx: HarnessCtx): number {
  return loadWorld(ctx.worldPath).month;
}

function line(
  ctx: HarnessCtx,
  agent: string,
  status: IntentStatus,
  callId: string,
  correlationId: string | null,
  reason: string,
): IntentRecord {
  return {
    callId,
    correlationId,
    month: monthOf(ctx),
    ts: ctx.clock.now(),
    agent,
    status,
    reason,
  };
}

/** A read. One intent line, no reason gate, no journal line, no correlation. */
export function econRead(
  ctx: HarnessCtx,
  reg: Registry,
  tool: string,
  argv: string[],
): unknown {
  if (!reg.allowed.has(tool)) {
    throw new Error(`${tool} is not in ${reg.agentId}'s registry`);
  }
  ctx.intentLog.append(line(ctx, reg.agentId, "ok", ctx.ids.next(), null, "read"));
  return ctx.econ(argv).value;
}

export function runMutation(
  ctx: HarnessCtx,
  reg: Registry,
  tool: string,
  argv: string[],
  args: Record<string, unknown>,
  reason: string,
): MutationOutcome {
  const early = (why: string): MutationOutcome => {
    ctx.intentLog.append(line(ctx, reg.agentId, "refused", ctx.ids.next(), null, why));
    return { ok: false, reason: why };
  };

  if (!reg.allowed.has(tool)) return early(`${tool} is not in ${reg.agentId}'s registry`);
  const scope = reg.argScope?.(tool, args) ?? null;
  if (scope) return early(scope);
  if (!reason || reason.trim() === "") {
    return early(`${tool} requires a non-empty reason`);
  }

  const callId = ctx.ids.next();
  const correlationId = ctx.ids.next();
  ctx.intentLog.append(
    line(ctx, reg.agentId, "attempted", callId, correlationId, reason),
  );

  try {
    const { value } = ctx.econ([...argv, "--reason", reason, "--corr", correlationId]);
    ctx.intentLog.append(line(ctx, reg.agentId, "ok", callId, correlationId, reason));
    return { ok: true, correlationId, result: value };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (err instanceof Refusal) {
      ctx.intentLog.append(line(ctx, reg.agentId, "refused", callId, correlationId, msg));
      return { ok: false, reason: msg };
    }
    ctx.intentLog.append(line(ctx, reg.agentId, "error", callId, correlationId, msg));
    throw err;
  }
}
