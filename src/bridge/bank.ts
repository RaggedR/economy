// bank.ts — the smallest mutating leaf. postLoanRate, and postMaterial /
// sellCapital, fenced to this bank. The same command name, a different bank
// id, is a scope refusal: bank a cannot post bank b's rate. The leaf posts the
// rate it was handed. It does not compute another one.

import { type Decoders, leafLocal, type Runner } from "../lib/algebra.ts";
import type { BankId } from "../world/types.ts";
import { type Act, type BankC, decodeAct } from "./containers.ts";
import {
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

export function bankLeaf(ctx: HarnessCtx, bank: BankId): Runner<BankC> {
  const agentId = `bank:${bank}`;
  const reg: Registry = {
    agentId,
    allowed: new Set(["post-rate", "post-material", "sell-capital"]),
    argScope: (tool, args) => {
      if (args.bank === bank) return null;
      if (tool === "post-rate") {
        return `bank ${bank} cannot post bank ${String(args.bank)}'s rate`;
      }
      return `bank ${bank} cannot post for bank ${String(args.bank)}`;
    },
  };
  const decoders: Decoders<BankC> = {
    postLoanRate: decodeAct,
    postMaterial: decodeAct,
    sellCapital: decodeAct,
  };
  return leafLocal(
    agentId,
    (shape) => {
      if (shape.tag === "postLoanRate") {
        return asAct(runMutation(
          ctx,
          reg,
          "post-rate",
          ["post-rate", "--bank", shape.bank, "--rate", String(shape.rate)],
          { bank: shape.bank },
          shape.reason,
        ));
      }
      if (shape.tag === "postMaterial") {
        return asAct(runMutation(
          ctx,
          reg,
          "post-material",
          [
            "post-material",
            "--bank",
            shape.bank,
            "--mine",
            shape.mine,
            "--price",
            String(shape.price),
            "--max-units",
            String(shape.maxUnits),
          ],
          { bank: shape.bank, mine: shape.mine },
          shape.reason,
        ));
      }
      return asAct(runMutation(
        ctx,
        reg,
        "sell-capital",
        [
          "sell-capital",
          "--bank",
          shape.bank,
          "--mine",
          shape.mine,
          "--ask",
          String(shape.ask),
        ],
        { bank: shape.bank, mine: shape.mine },
        shape.reason,
      ));
    },
    decoders,
  );
}
