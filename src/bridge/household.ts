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
  if (!o.ok) return { tag: "refused", reason: o.reason };
  if (
    o.filled !== undefined &&
    (o.filled === 0 || (o.asked !== undefined && o.filled < o.asked))
  ) {
    return { tag: "rationed", correlationId: o.correlationId, filled: o.filled };
  }
  return { tag: "done", correlationId: o.correlationId };
}

export function householdLeaf(ctx: HarnessCtx, person: Id): Runner<HouseholdC> {
  const agentId = `household:${person}`;
  const reg: Registry = {
    agentId,
    allowed: new Set(["request-loan", "pay", "fill", "books"]),
    argScope: (tool, args) => {
      if (tool === "request-loan") {
        if (args.borrower === person) return null;
        return `${agentId} cannot request a loan for ${String(args.borrower)}`;
      }
      if (tool === "pay") {
        if (args.from === person) return null;
        return `${agentId} cannot pay from ${String(args.from)}`;
      }
      if (tool === "fill") {
        if (args.buyer === person) return null;
        return `${agentId} cannot fill for ${String(args.buyer)}`;
      }
      return null;
    },
  };
  const decoders: Decoders<HouseholdC> = {
    requestLoan: decodeAct,
    pay: decodeAct,
    buy: decodeAct,
    readBooks: decodeRead(decodeBooks),
  };
  return leafLocal(
    agentId,
    (shape) => {
      if (shape.tag === "readBooks") {
        return { tag: "read", value: econRead(ctx, reg, "books", ["books"]) };
      }
      if (shape.tag === "buy") {
        const lots = shape.lots.length > 0 ? shape.lots : [{ listing: "", qty: 0 }];
        const encoded = lots.map((lot) => `${lot.listing}:${lot.qty}`).join(",");
        return asAct(runMutation(
          ctx,
          reg,
          "fill",
          [
            "fill",
            "--buyer",
            person,
            "--asked",
            String(shape.qty),
            "--lots",
            encoded,
          ],
          { buyer: person },
          shape.reason,
        ));
      }
      if (shape.tag === "pay") {
        return asAct(runMutation(
          ctx,
          reg,
          "pay",
          [
            "pay",
            "--from",
            person,
            "--to",
            shape.to,
            "--amount",
            String(shape.amount),
            "--row",
            shape.row,
          ],
          { from: person },
          shape.reason,
        ));
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
