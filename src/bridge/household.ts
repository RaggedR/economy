// household.ts — requestLoan, and a read. The gate judges collateral, LTV, and
// the leverage ceiling. The bank leaf never sees the decision. The household
// commits the shape it was asked, including a shape the gate will refuse: that
// refusal is the position.

import { type Decoders, leafLocal, type Runner } from "../lib/algebra.ts";
import type { Id } from "../world/types.ts";
import {
  type Act,
  decodeAct,
  decodeBooks,
  decodeRead,
  type HouseholdC,
} from "./containers.ts";
import {
  econRead,
  type HarnessCtx,
  type MutationOutcome,
  type Registry,
  runMutation,
} from "./harness.ts";

function asAct(o: MutationOutcome): Act {
  return o.ok
    ? { tag: "done", correlationId: o.correlationId }
    : { tag: "refused", reason: o.reason };
}

export function householdLeaf(ctx: HarnessCtx, person: Id): Runner<HouseholdC> {
  const agentId = `household:${person}`;
  const reg: Registry = {
    agentId,
    allowed: new Set(["request-loan", "books"]),
    argScope: (tool, args) => {
      if (tool !== "request-loan") return null;
      if (args.borrower === person) return null;
      return `${agentId} cannot request a loan for ${String(args.borrower)}`;
    },
  };
  const decoders: Decoders<HouseholdC> = {
    requestLoan: decodeAct,
    readBooks: decodeRead(decodeBooks),
  };
  return leafLocal(
    agentId,
    (shape) => {
      if (shape.tag === "readBooks") {
        return { tag: "read", value: econRead(ctx, reg, "books", ["books"]) };
      }
      return asAct(runMutation(
        ctx,
        reg,
        "request-loan",
        [
          "request-loan",
          "--bank",
          shape.bank,
          "--borrower",
          shape.borrower,
          "--amount",
          String(shape.amount),
          "--collateral",
          shape.collateral,
          "--installment",
          String(shape.installment),
          "--months",
          String(shape.months),
        ],
        { bank: shape.bank, borrower: shape.borrower },
        shape.reason,
      ));
    },
    decoders,
  );
}
