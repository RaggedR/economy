// auditor.ts — a read-only leaf. The registry has no mutation. It calls books
// and reconcile through the command surface and returns the two reports. A
// reply that does not decode throws inside leafLocal. No default.

import { type Decoders, leafLocal, type Runner } from "../lib/algebra.ts";
import { type AuditorC, decodeBooks, decodeRead, decodeReconcile } from "./containers.ts";
import { econRead, type HarnessCtx, type Registry } from "./harness.ts";

export function auditorLeaf(ctx: HarnessCtx): Runner<AuditorC> {
  const reg: Registry = {
    agentId: "auditor",
    allowed: new Set(["books", "reconcile", "journal recent", "journal trace"]),
  };
  const decoders: Decoders<AuditorC> = {
    invariant: decodeRead(decodeBooks),
    reconcile: decodeRead(decodeReconcile),
  };
  // The auditor stays on the books. A model does not get to say the rows
  // sum to zero, so this leaf does not read ctx.brain.
  return leafLocal(
    "auditor",
    (shape) => {
      if (shape.tag === "invariant") {
        return { tag: "read", value: econRead(ctx, reg, "books", ["books"]) };
      }
      return { tag: "read", value: econRead(ctx, reg, "reconcile", ["reconcile"]) };
    },
    decoders,
  );
}
