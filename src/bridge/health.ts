// health.ts — disease, the two mixes, the public lottery, then private cures
// and tuition. The draw is the engine. The mix and the bids are leaves. The
// lottery is one plan, then each leaf commits only what that plan gave it.
// Private purchases are a later call: after staple, and after the special day's
// rent. An empty order list returns before any write.

import type { Fib } from "../lib/algebra.ts";
import { type Decoders, leafLocal, type Runner } from "../lib/algebra.ts";
import { commitEngine } from "../cli/econ.ts";
import { type Act, decodeAct } from "./containers.ts";
import { householdLeaf } from "./household.ts";
import type { HarnessCtx } from "./harness.ts";
import { type MutationOutcome, type Registry, runMutation } from "./harness.ts";
import { diseaseGate } from "../world/gates.ts";
import { drawDiseases, planDiscretionary, planLottery } from "../world/health.ts";
import { loadWorld, saveWorld } from "../world/store.ts";
import type { Career, Disease, Id, Money, Qty, World } from "../world/types.ts";

type GovernmentC =
  | Fib<
    {
      tag: "setDoctorMix";
      assign: { person: Id; disease: Disease }[];
      reason: string;
    },
    Act
  >
  | Fib<
    {
      tag: "setTeacherMix";
      assign: { person: Id; career: Career }[];
      reason: string;
    },
    Act
  >;

type FirmHealthC =
  | Fib<
    {
      tag: "postCure";
      firm: Id;
      disease: Disease;
      price: Money;
      qty: Qty;
      reason: string;
    },
    Act
  >
  | Fib<
    {
      tag: "postTuition";
      firm: Id;
      career: Career;
      price: Money;
      qty: Qty;
      reason: string;
    },
    Act
  >;

export type HealthOrders = {
  doctors?: { person: Id; disease: Disease }[];
  teachers?: { person: Id; career: Career }[];
  doctorReason?: string;
  teacherReason?: string;
  cures?: { person: Id; disease: Disease; reason: string }[];
  education?: { person: Id; career: Career; reason: string }[];
  curePosts?: { firm: Id; disease: Disease; price: Money; qty: Qty; reason: string }[];
  tuitionPosts?: { firm: Id; career: Career; price: Money; qty: Qty; reason: string }[];
  privateCures?: { person: Id; disease: Disease; provider: Id; reason: string }[];
  privateTuition?: { person: Id; career: Career; provider: Id; reason: string }[];
};

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

function paths(ctx: HarnessCtx) {
  return { world: ctx.worldPath, journal: ctx.journalPath };
}

function keepRng(ctx: HarnessCtx, planned: World): void {
  const current = loadWorld(ctx.worldPath);
  if (
    current.rng.seed === planned.rng.seed && current.rng.stream === planned.rng.stream
  ) return;
  saveWorld(ctx.worldPath, { ...current, rng: planned.rng });
}

function governmentLeaf(ctx: HarnessCtx): Runner<GovernmentC> {
  const agentId = "government";
  const reg: Registry = {
    agentId,
    allowed: new Set(["assign"]),
    argScope: () => null,
  };
  const decoders: Decoders<GovernmentC> = {
    setDoctorMix: decodeAct,
    setTeacherMix: decodeAct,
  };
  return leafLocal(agentId, (shape) => {
    let last: Act = { tag: "done", correlationId: "" };
    if (shape.tag === "setDoctorMix") {
      for (const row of shape.assign) {
        const act = asAct(runMutation(
          ctx,
          reg,
          "assign",
          ["assign", "--person", row.person, "--disease", row.disease],
          {},
          shape.reason,
        ));
        if (act.tag === "refused") return act;
        last = act;
      }
      return last;
    }
    for (const row of shape.assign) {
      const act = asAct(runMutation(
        ctx,
        reg,
        "assign",
        ["assign", "--person", row.person, "--career", row.career],
        {},
        shape.reason,
      ));
      if (act.tag === "refused") return act;
      last = act;
    }
    return last;
  }, decoders);
}

function firmLeaf(ctx: HarnessCtx, firm: Id): Runner<FirmHealthC> {
  const agentId = `firm:${firm}`;
  const reg: Registry = {
    agentId,
    allowed: new Set(["post-cure", "post-tuition"]),
    argScope: (_tool, args) => {
      if (args.firm === firm) return null;
      return `${agentId} cannot post for ${String(args.firm)}`;
    },
  };
  const decoders: Decoders<FirmHealthC> = {
    postCure: decodeAct,
    postTuition: decodeAct,
  };
  return leafLocal(agentId, (shape) => {
    if (shape.tag === "postCure") {
      return asAct(runMutation(
        ctx,
        reg,
        "post-cure",
        [
          "post-cure",
          "--firm",
          firm,
          "--disease",
          shape.disease,
          "--price",
          String(shape.price),
          "--qty",
          String(shape.qty),
        ],
        { firm },
        shape.reason,
      ));
    }
    return asAct(runMutation(
      ctx,
      reg,
      "post-tuition",
      [
        "post-tuition",
        "--firm",
        firm,
        "--career",
        shape.career,
        "--price",
        String(shape.price),
        "--qty",
        String(shape.qty),
      ],
      { firm },
      shape.reason,
    ));
  }, decoders);
}

/** The opening draw. A miss still advances `rng` and journals nothing. */
export function runDisease(ctx: HarnessCtx): void {
  const plan = drawDiseases(loadWorld(ctx.worldPath));
  saveWorld(ctx.worldPath, plan.world);
  for (const strike of plan.strikes) {
    const gate = diseaseGate(loadWorld(ctx.worldPath), strike.person, strike.disease);
    if (!gate.ok) throw new Error(gate.reason);
    commitEngine(paths(ctx), gate.effect, ctx.ids, ctx.clock);
  }
}

/** Mixes, then bids, then the lottery. No orders: the world is not touched. */
export async function runPublic(ctx: HarnessCtx, orders: HealthOrders): Promise<void> {
  const doctors = orders.doctors ?? [];
  const teachers = orders.teachers ?? [];
  const cures = orders.cures ?? [];
  const education = orders.education ?? [];
  if (doctors.length + teachers.length + cures.length + education.length === 0) return;

  if (doctors.length > 0) {
    const act = await governmentLeaf(ctx).run(
      {
        tag: "setDoctorMix",
        assign: doctors,
        reason: orders.doctorReason ?? "",
      },
      0,
    );
    if (act.tag === "refused") throw new Error(act.reason);
  }
  if (teachers.length > 0) {
    const act = await governmentLeaf(ctx).run(
      {
        tag: "setTeacherMix",
        assign: teachers,
        reason: orders.teacherReason ?? "",
      },
      0,
    );
    if (act.tag === "refused") throw new Error(act.reason);
  }

  const plan = planLottery(loadWorld(ctx.worldPath), cures, education);
  keepRng(ctx, plan.world);
  for (let i = 0; i < cures.length; i++) {
    const bid = cures[i];
    const row = plan.cures[i];
    const act = await householdLeaf(ctx, bid.person).run(
      {
        tag: "bidCure",
        disease: bid.disease,
        granted: row.eligible && row.granted,
        reason: bid.reason,
      },
      0,
    );
    expectAward(act, row.eligible, row.granted, `${bid.person} cure`);
  }
  for (let i = 0; i < education.length; i++) {
    const bid = education[i];
    const row = plan.education[i];
    const act = await householdLeaf(ctx, bid.person).run(
      {
        tag: "bidEducation",
        career: bid.career,
        granted: row.eligible && row.granted,
        reason: bid.reason,
      },
      0,
    );
    expectAward(act, row.eligible, row.granted, `${bid.person} level`);
  }
}

function expectAward(act: Act, eligible: boolean, granted: boolean, who: string): void {
  if (!eligible) {
    if (act.tag !== "refused") throw new Error(`${who} was accepted`);
    return;
  }
  if (granted) {
    if (act.tag !== "done") throw new Error(`${who} was not filled`);
    return;
  }
  if (act.tag !== "rationed") throw new Error(`${who} was not rationed`);
}

/** Private cures and tuition. No orders: the world is not touched. */
export async function runDiscretionary(
  ctx: HarnessCtx,
  orders: HealthOrders,
): Promise<void> {
  const curePosts = orders.curePosts ?? [];
  const tuitionPosts = orders.tuitionPosts ?? [];
  const privateCures = orders.privateCures ?? [];
  const privateTuition = orders.privateTuition ?? [];
  if (
    curePosts.length + tuitionPosts.length + privateCures.length +
        privateTuition.length === 0
  ) return;

  for (const post of curePosts) {
    const act = await firmLeaf(ctx, post.firm).run(
      {
        tag: "postCure",
        firm: post.firm,
        disease: post.disease,
        price: post.price,
        qty: post.qty,
        reason: post.reason,
      },
      0,
    );
    if (act.tag === "refused") throw new Error(act.reason);
  }
  for (const post of tuitionPosts) {
    const act = await firmLeaf(ctx, post.firm).run(
      {
        tag: "postTuition",
        firm: post.firm,
        career: post.career,
        price: post.price,
        qty: post.qty,
        reason: post.reason,
      },
      0,
    );
    if (act.tag === "refused") throw new Error(act.reason);
  }

  const plan = planDiscretionary(loadWorld(ctx.worldPath), privateCures, privateTuition);
  for (let i = 0; i < privateCures.length; i++) {
    const bid = privateCures[i];
    const row = plan.cures[i];
    const act = await householdLeaf(ctx, bid.person).run(
      {
        tag: "buyCure",
        disease: bid.disease,
        provider: bid.provider,
        listing: row.listing,
        qty: row.qty,
        reason: bid.reason,
      },
      0,
    );
    if (row.refuse) {
      if (act.tag !== "refused") throw new Error(`${bid.person} cure was accepted`);
      continue;
    }
    if (act.tag === "refused") throw new Error(`${bid.person}: ${act.reason}`);
  }
  for (let i = 0; i < privateTuition.length; i++) {
    const bid = privateTuition[i];
    const row = plan.tuition[i];
    const act = await householdLeaf(ctx, bid.person).run(
      {
        tag: "buyTuition",
        career: bid.career,
        provider: bid.provider,
        listing: row.listing,
        qty: row.qty,
        reason: bid.reason,
      },
      0,
    );
    if (row.refuse) {
      if (act.tag !== "refused") throw new Error(`${bid.person} tuition was accepted`);
      continue;
    }
    if (act.tag === "refused") throw new Error(`${bid.person}: ${act.reason}`);
  }
}

export async function runHealth(ctx: HarnessCtx, orders: HealthOrders): Promise<void> {
  runDisease(ctx);
  await runPublic(ctx, orders);
  await runDiscretionary(ctx, orders);
}

/** Seed 8. Ben is struck with d2 and the public doctor matches it. Cleo's d0
 *  is not produced, so she buys it. Ada takes the engineer level the teacher
 *  was pointed at. Cleo's bureaucrat bid loses, then she pays tuition. */
export function healthSceneOrders(): HealthOrders {
  return {
    doctors: [{ person: "doc", disease: "d2" }],
    doctorReason: "the government points its doctor at d2",
    teachers: [{ person: "teach", career: "engineer" }],
    teacherReason: "the government points its teacher at engineer",
    cures: [
      { person: "ben", disease: "d2", reason: "ben asks the public hospital to cure d2" },
      {
        person: "cleo",
        disease: "d0",
        reason: "cleo asks the public hospital to cure d0",
      },
    ],
    education: [
      { person: "ada", career: "engineer", reason: "ada asks for an engineer level" },
      {
        person: "cleo",
        career: "bureaucrat",
        reason: "cleo asks for a bureaucrat level",
      },
    ],
    curePosts: [{
      firm: "priv-hosp",
      disease: "d0",
      price: 2,
      qty: 10,
      reason: "the private hospital posts a d0 cure",
    }],
    tuitionPosts: [{
      firm: "priv-uni",
      career: "bureaucrat",
      price: 1,
      qty: 10,
      reason: "the private university posts bureaucrat tuition",
    }],
    privateCures: [
      {
        person: "cleo",
        disease: "d0",
        provider: "priv-hosp",
        reason: "cleo buys the d0 cure",
      },
      {
        person: "ben",
        disease: "d2",
        provider: "priv-hosp",
        reason: "ben asks to buy a d2 cure",
      },
    ],
    privateTuition: [{
      person: "cleo",
      career: "bureaucrat",
      provider: "priv-uni",
      reason: "cleo buys the bureaucrat level",
    }],
  };
}
