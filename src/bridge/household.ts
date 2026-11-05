// household.ts — requestLoan, and a read. The gate judges collateral, LTV, and
// the leverage ceiling. The bank leaf never sees the decision. The household
// commits the shape it was asked, including a shape the gate will refuse: that
// refusal is the position.

import { params } from "../world/params.ts";
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
    allowed: new Set([
      "request-loan",
      "pay",
      "fill",
      "books",
      "sell-share",
      "buy-share",
      "offer-house",
      "buy-house",
      "occupy",
      "hire",
      "post-rent",
      "apply-rent",
      "bid-cure",
      "bid-education",
      "buy-cure",
      "buy-tuition",
    ]),
    argScope: (tool, args) => {
      if (tool === "request-loan") {
        if (args.borrower === person) return null;
        return `${agentId} cannot request a loan for ${String(args.borrower)}`;
      }
      if (tool === "pay") {
        if (args.from === person) return null;
        return `${agentId} cannot pay from ${String(args.from)}`;
      }
      if (tool === "fill" || tool === "buy-share" || tool === "buy-house") {
        if (args.buyer === person) return null;
        return `${agentId} cannot buy for ${String(args.buyer)}`;
      }
      if (tool === "sell-share") {
        if (args.seller === person) return null;
        return `${agentId} cannot sell shares for ${String(args.seller)}`;
      }
      if (tool === "offer-house" || tool === "occupy" || tool === "post-rent") {
        if (args.owner === person) return null;
        return `${agentId} cannot act for ${String(args.owner)}`;
      }
      if (tool === "hire") {
        if (args.person === person) return null;
        return `${agentId} cannot take a job for ${String(args.person)}`;
      }
      if (tool === "apply-rent") {
        if (args.tenant === person) return null;
        return `${agentId} cannot rent for ${String(args.tenant)}`;
      }
      if (
        tool === "bid-cure" || tool === "bid-education" || tool === "buy-cure" ||
        tool === "buy-tuition"
      ) {
        if (args.person === person) return null;
        return `${agentId} cannot bid for ${String(args.person)}`;
      }
      return null;
    },
  };
  const decoders: Decoders<HouseholdC> = {
    requestLoan: decodeAct,
    pay: decodeAct,
    buy: decodeAct,
    sellShare: decodeAct,
    buyShare: decodeAct,
    offerHouse: decodeAct,
    buyHouse: decodeAct,
    occupyOrLet: decodeAct,
    keepJob: decodeAct,
    applyJob: decodeAct,
    postRent: decodeAct,
    applyRent: decodeAct,
    bidCure: decodeAct,
    bidEducation: decodeAct,
    buyCure: decodeAct,
    buyTuition: decodeAct,
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
      if (shape.tag === "sellShare") {
        return asAct(runMutation(
          ctx,
          reg,
          "sell-share",
          [
            "sell-share",
            "--seller",
            person,
            "--bank",
            shape.bank,
            "--qty",
            String(shape.qty),
            "--price",
            String(shape.price),
          ],
          { seller: person },
          shape.reason,
        ));
      }
      if (shape.tag === "buyShare") {
        const lots = shape.lots.length > 0 ? shape.lots : [{ listing: "", qty: 0 }];
        return asAct(runMutation(
          ctx,
          reg,
          "buy-share",
          [
            "buy-share",
            "--buyer",
            person,
            "--asked",
            String(shape.qty),
            "--lots",
            lots.map((lot) => `${lot.listing}:${lot.qty}`).join(","),
          ],
          { buyer: person },
          shape.reason,
        ));
      }
      if (shape.tag === "offerHouse") {
        return asAct(runMutation(
          ctx,
          reg,
          "offer-house",
          [
            "offer-house",
            "--owner",
            person,
            "--house",
            shape.house,
            "--ask",
            String(shape.ask),
          ],
          { owner: person },
          shape.reason,
        ));
      }
      if (shape.tag === "buyHouse") {
        return asAct(runMutation(
          ctx,
          reg,
          "buy-house",
          [
            "buy-house",
            "--buyer",
            person,
            "--listing",
            shape.listing,
            "--qty",
            shape.won ? "1" : "0",
          ],
          { buyer: person },
          shape.reason,
        ));
      }
      if (shape.tag === "occupyOrLet") {
        return asAct(runMutation(
          ctx,
          reg,
          "occupy",
          ["occupy", "--owner", person, "--house", shape.house, "--mode", shape.mode],
          { owner: person },
          shape.reason,
        ));
      }
      if (shape.tag === "keepJob" || shape.tag === "applyJob") {
        return asAct(runMutation(
          ctx,
          reg,
          "hire",
          [
            "hire",
            "--person",
            person,
            "--listing",
            shape.listing,
            "--seated",
            shape.seated ? "true" : "false",
            "--keep",
            shape.tag === "keepJob" ? "true" : "false",
          ],
          { person },
          shape.reason,
        ));
      }
      if (shape.tag === "postRent") {
        return asAct(runMutation(
          ctx,
          reg,
          "post-rent",
          [
            "post-rent",
            "--owner",
            person,
            "--house",
            shape.house,
            "--rent",
            String(shape.rent),
          ],
          { owner: person },
          shape.reason,
        ));
      }
      if (shape.tag === "applyRent") {
        return asAct(runMutation(
          ctx,
          reg,
          "apply-rent",
          [
            "apply-rent",
            "--tenant",
            person,
            "--listing",
            shape.listing,
            "--pay",
            shape.pay ? "true" : "false",
          ],
          { tenant: person },
          shape.reason,
        ));
      }
      if (shape.tag === "bidCure") {
        return asAct(runMutation(
          ctx,
          reg,
          "bid-cure",
          [
            "bid-cure",
            "--person",
            person,
            "--disease",
            shape.disease,
            "--granted",
            shape.granted ? "true" : "false",
          ],
          { person },
          shape.reason,
        ));
      }
      if (shape.tag === "bidEducation") {
        return asAct(runMutation(
          ctx,
          reg,
          "bid-education",
          [
            "bid-education",
            "--person",
            person,
            "--career",
            shape.career,
            "--granted",
            shape.granted ? "true" : "false",
          ],
          { person },
          shape.reason,
        ));
      }
      if (shape.tag === "buyCure") {
        return asAct(runMutation(
          ctx,
          reg,
          "buy-cure",
          [
            "buy-cure",
            "--person",
            person,
            "--disease",
            shape.disease,
            "--listing",
            shape.listing,
            "--qty",
            String(shape.qty),
            "--asked",
            String(params.cureSize),
          ],
          { person },
          shape.reason,
        ));
      }
      if (shape.tag === "buyTuition") {
        return asAct(runMutation(
          ctx,
          reg,
          "buy-tuition",
          [
            "buy-tuition",
            "--person",
            person,
            "--career",
            shape.career,
            "--listing",
            shape.listing,
            "--qty",
            String(shape.qty),
            "--asked",
            String(params.unitsPerLevel),
          ],
          { person },
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
