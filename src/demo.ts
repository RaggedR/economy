// demo.ts — the books a stranger can watch. One id source and one clock for the
// whole run. --live selects the real seams and a model discovered from the
// provider's catalogue. It does not stamp that run with the fixed clock. The
// scripted path never calls the model.

import { formatBooks } from "./world/books.ts";
import { householdLeaf } from "./bridge/household.ts";
import { healthSceneOrders, runHealth } from "./bridge/health.ts";
import { runLeaves } from "./bridge/spend.ts";
import { runTechScene } from "./bridge/tech.ts";
import { runSpecialDay, specialSceneOrders } from "./bridge/special.ts";
import { commitDeath, runBirths } from "./bridge/kin.ts";
import { runStaple } from "./bridge/staple.ts";
import { commitEngine } from "./cli/econ.ts";
import { planOpening } from "./world/fold.ts";
import { postGoodGate } from "./world/gates.ts";
import { remainderDraws } from "./world/purses.ts";
import {
  healthSeed,
  kinSeed,
  leafSeed,
  marketSeed,
  monthSeed,
  purseSeed,
  specialSeed,
  storySeed,
  techSeed,
  townCensus,
  townSeed,
} from "./world/seed.ts";
import { ops, output } from "./world/tech.ts";
import { loadWorld, saveWorld } from "./world/store.ts";
import {
  type Clock,
  fixedClock,
  type IdSource,
  realClock,
  realIds,
  seededIds,
} from "./log/ids.ts";
import { modelBrain } from "./model/brain.ts";
import { type LiveOpts, openLiveClient } from "./model/wire.ts";
import { fileJournal } from "./log/journal.ts";
import { reconSummary } from "./log/reconcile.ts";
import type { Act } from "./bridge/containers.ts";
import type { HarnessCtx } from "./bridge/harness.ts";
import { openRig } from "./bridge/rig.ts";
import { runMonth } from "./bridge/scheduler.ts";
import { playStory } from "./bridge/story.ts";

const p = (s = "") => console.log(s);

function printScene(ctx: HarnessCtx): void {
  const journal = fileJournal(ctx.journalPath).all();
  const intent = ctx.intentLog.all();
  p("journal");
  for (const e of journal) {
    const reasoned = intent.some((r) =>
      r.correlationId === e.correlationId &&
      (r.status === "ok" || r.status === "rationed")
    );
    const why = e.source === "engine"
      ? "no intent record"
      : reasoned
      ? "reason in the intent log"
      : "NO REASON";
    p(`  ${e.source}  ${e.effect}  ${e.correlationId}  ${why}`);
  }
  p("intent");
  for (const r of intent) {
    p(`  ${r.agent}  ${r.status}  ${r.correlationId ?? "—"}  ${r.reason}`);
  }
  p(formatBooks(loadWorld(ctx.worldPath)));
}

async function runScripted(ids: IdSource, clock: Clock): Promise<void> {
  p("object: one worker, and the world is its state");
  p("accounting: five instruments, integer minor units, each row sums to zero");
  p("control: the engine pays a wage; a leaf asks for a loan; a refusal is a position");

  p("\n— story: pay, pay a bank, lend, repay, pay interest —\n");
  const storyCtx = openRig("demo-out/story", storySeed(), ids, clock);
  playStory(storyCtx);
  printScene(storyCtx);

  p("\n— month: a wage with no reason, a loan with a reason, a loan refused —\n");
  const monthCtx = openRig("demo-out/month", monthSeed(), ids, clock);
  const month = await runMonth(monthCtx);
  printScene(monthCtx);
  p(reconSummary(month.recon));
  for (const b of month.recon.blocked) p(`  blocked  ${b.agent}  ${b.reason}`);
  for (const a of month.recon.alarms) p(`  ALARM  ${a.kind}`);

  p("\n— purses: the firm pays the wage, the household cannot spend the firm's cash —\n");
  const purseCtx = openRig("demo-out/purse", purseSeed(), ids, clock);
  const engine = { world: purseCtx.worldPath, journal: purseCtx.journalPath };
  const opening = planOpening(loadWorld(purseCtx.worldPath));
  for (const effect of opening.effects) {
    commitEngine(engine, effect, ids, clock);
  }
  saveWorld(purseCtx.worldPath, opening.mark(loadWorld(purseCtx.worldPath)));
  const cleo = householdLeaf(purseCtx, "cleo");
  await cleo.run(
    {
      tag: "pay",
      to: "shop",
      amount: 20,
      row: "staple",
      reason: "cleo tries to buy food from an empty purse",
    },
    0,
  );
  for (const effect of remainderDraws(loadWorld(purseCtx.worldPath))) {
    commitEngine(engine, effect, ids, clock);
  }
  printScene(purseCtx);

  p("\n— staple: the shop posts one lot, then the households buy —\n");
  const marketCtx = openRig("demo-out/market", marketSeed(), ids, clock);
  const marketEngine = { world: marketCtx.worldPath, journal: marketCtx.journalPath };
  const lot = postGoodGate(loadWorld(marketCtx.worldPath), "shop", 10, 1);
  if (!lot.ok) throw new Error(lot.reason);
  commitEngine(marketEngine, lot.effect, ids, clock);
  const bought = await runStaple(marketCtx, [
    { buyer: "ada", qty: 1, reason: "ada buys staple" },
    { buyer: "ben", qty: 1, reason: "ben buys staple" },
    { buyer: "cleo", qty: 1, reason: "cleo buys staple" },
  ]);
  printScene(marketCtx);
  const shelf = loadWorld(marketCtx.worldPath);
  p(
    `filled  ada ${fillText(bought[0])}  ben ${fillText(bought[1])}  ` +
      `cleo ${fillText(bought[2])}`,
  );
  p(
    `starvation  ada ${shelf.people.ada.starvation}  ` +
      `ben ${shelf.people.ben.starvation}  cleo ${shelf.people.cleo.starvation}`,
  );
  p(`listing qty ${shelf.listings[0]?.qty ?? 0}  shop staple ${
    shelf.firms.shop.inventory.staple ?? 0
  }`);

  p("\n— special day: shares, the dividend, a house lottery, a job, a machine, the rent —\n");
  const specialCtx = openRig("demo-out/special", specialSeed(), ids, clock);
  await runSpecialDay(specialCtx, specialSceneOrders());
  printScene(specialCtx);
  const day = loadWorld(specialCtx.worldPath);
  const units = (holder: string) =>
    Object.values(day.shares).filter((share) => share.holder === holder)
      .reduce((n, share) => n + share.units, 0);
  const machine = Object.values(day.machines)[0];
  p(
    `shares  ada ${units("ada")}  ben ${units("ben")}  ` +
      `outstanding ${day.banks.a.sharesOutstanding}  equity ${day.banks.a.equity}`,
  );
  p(
    `houses  h-cleo ${day.houses["h-cleo"].owner}  ` +
      `h-ben occupant ${day.houses["h-ben"].occupant ?? "none"}  ` +
      `h-ada ${day.houses["h-ada"].occupant}`,
  );
  p(
    `jobs  ben salary ${day.people.ben.job?.salary ?? "none"}  ` +
      `cleo ${day.people.cleo.job ? "seated" : "rationed"}`,
  );
  p(
    `machine  generation ${machine?.generation ?? "none"}  ` +
      `owner ${machine?.owner ?? "none"}  builder ${machine?.builder ?? "none"}`,
  );
  p(
    `dwellings  ada ${day.people.ada.dwelling}  ben ${day.people.ben.dwelling}  ` +
      `cleo ${day.people.cleo.dwelling ?? "none"}  cleo health ${day.people.cleo.health}`,
  );

  p("\n— health: a disease, the public lottery, a private cure, a level —\n");
  const healthCtx = openRig("demo-out/health", healthSeed(), ids, clock);
  await runHealth(healthCtx, healthSceneOrders());
  printScene(healthCtx);
  const health = loadWorld(healthCtx.worldPath);
  p(
    `diseases  ben ${health.people.ben.diseases.join(",") || "none"}  ` +
      `cleo ${health.people.cleo.diseases.join(",") || "none"}  ` +
      `ben health ${health.people.ben.health}  cleo health ${health.people.cleo.health}`,
  );
  p(
    `levels  ada engineer ${health.people.ada.education.engineer}  ` +
      `cleo bureaucrat ${health.people.cleo.education.bureaucrat}`,
  );
  p(
    `mix  doc ${health.people.doc.assignment ?? "none"}  ` +
      `teach ${health.people.teach.assignment ?? "none"}`,
  );
  p(
    `purses  cleo ${health.people.cleo.deposits.a}  ` +
      `hospital ${health.firms["priv-hosp"].deposits.a}  ` +
      `university ${health.firms["priv-uni"].deposits.a}`,
  );

  p("\n— tech: the plan offers generation 1, and delivery is what mints it —\n");
  const techCtx = openRig("demo-out/tech", techSeed(), ids, clock);
  await runTechScene(techCtx);
  printScene(techCtx);
  const built = loadWorld(techCtx.worldPath);
  const generations = Object.values(built.machines)
    .map((machine) => machine.generation)
    .sort((a, b) => a - b);
  const made = Object.values(built.machines).find((machine) => machine.generation === 1);
  const offer = built.listings.find((listing) => listing.kind === "machine");
  const slot = built.listings.find((listing) => listing.kind === "job");
  const offerGen = offer?.payload && "generation" in offer.payload
    ? offer.payload.generation
    : "none";
  const slotGen = slot?.payload && "generation" in slot.payload
    ? slot.payload.generation
    : "none";
  p(`generations ${generations.join(" ")}`);
  p(
    `delivered  generation ${made?.generation ?? "none"}  ` +
      `owner ${made?.owner ?? "none"}  builder ${made?.builder ?? "none"}`,
  );
  p(`offer generation ${offerGen}  engineer slot generation ${slotGen}`);
  p(
    `ops engineer  ${ops("engineer", 0)} at 0, ${ops("engineer", 1)} at 1  ` +
      `output  ${output("engineer", 0)} at 0, ${output("engineer", 1)} at 1`,
  );
  p(
    `purses  shop ${built.firms.shop.deposits.a}  mill ${built.firms.mill.deposits.a}`,
  );

  p("\n— kin: the town at t₀, then a forced birth and a childless house —\n");
  const census = townCensus(townSeed());
  p(
    `town  people ${census.people}  firms ${census.firms}  housed ${census.housed}  ` +
      `engineer ${census.engineer}  mines ${census.commonMines} common ${census.advancedMines} advanced`,
  );
  const kinCtx = openRig("demo-out/kin", kinSeed(), ids, clock);
  runBirths(kinCtx);
  commitDeath(kinCtx, "ben");
  printScene(kinCtx);
  const kin = loadWorld(kinCtx.worldPath);
  const child = Object.values(kin.people).find((person) => person.parent === "ada");
  const born = child ? kin.houses[child.dwelling ?? ""] : undefined;
  p(
    `birth  ${child?.id ?? "none"}  units ${born?.units ?? 0}  ` +
      `cash ${child ? child.deposits.a + child.deposits.b : 0}  ` +
      `ada units ${kin.houses["h-ada"].units}  ada cash ${kin.people.ada.deposits.a}`,
  );
  p(
    `death  ben ${kin.people.ben.alive ? "alive" : "dead"}  ` +
      `h-ben ${kin.houses["h-ben"].owner}  cleo ${kin.people.cleo.dwelling ?? "none"}`,
  );

  p("\n— leaves: a mix, a reserve, a lender, a nightclub, a level —\n");
  const leafCtx = openRig("demo-out/leaves", leafSeed(), ids, clock);
  await runLeaves(leafCtx);
  printScene(leafCtx);
  const leaves = loadWorld(leafCtx.worldPath);
  p(
    `mix  doc ${leaves.people.doc.assignment ?? "none"}  ` +
      `teach ${leaves.people.teach.assignment ?? "none"}`,
  );
  p(`level  ben ${leaves.people.ben.education.engineer}`);
  p(
    `spend  ada ${leaves.people.ada.deposits.a}  ben ${leaves.people.ben.deposits.a}  ` +
      `cleo ${leaves.people.cleo.deposits.a}  shop ${leaves.firms.shop.deposits.a}`,
  );
  const loan = Object.values(leaves.loans).find((row) => row.kind === "private");
  p(
    `lender  ${loan && loan.kind === "private" ? loan.holder : "none"}  ` +
      `principal ${loan && loan.kind === "private" ? loan.principal : 0}  ` +
      `gov ${leaves.government.deposits.a}`,
  );
}

function fillText(act: Act | undefined): string {
  if (!act) return "missing";
  if (act.tag === "rationed") return `${act.filled} rationed`;
  if (act.tag === "done") return "filled";
  return "refused";
}

function liveOptsFromEnv(): LiveOpts {
  return {
    apiKey: Deno.env.get("ECONOMY_API_KEY") ?? Deno.env.get("GROQ_API_KEY") ?? "",
    baseUrl: Deno.env.get("ECONOMY_BASE_URL") || undefined,
    model: Deno.env.get("ECONOMY_MODEL") ?? Deno.env.get("GROQ_MODEL") ?? null,
  };
}

/** Real ids, real clock, and the model the catalogue named. The month is the
 *  same function the scripted demo calls. demo-out/live is not part of the
 *  byte-identical replay. */
export async function runLive(opts: LiveOpts): Promise<number> {
  const ids = realIds();
  const clock = realClock();
  let name = "";
  try {
    const client = await openLiveClient(opts);
    name = client.name;
    const ctx = {
      ...openRig("demo-out/live", monthSeed(), ids, clock),
      brain: modelBrain(client),
    };
    p(`live  ${name}`);
    const month = await runMonth(ctx);
    printScene(ctx);
    p(reconSummary(month.recon));
    for (const b of month.recon.blocked) p(`  blocked  ${b.agent}  ${b.reason}`);
    for (const a of month.recon.alarms) p(`  ALARM  ${a.kind}`);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }
  return 0;
}

export async function start(argv: string[], live?: LiveOpts): Promise<number> {
  if (argv.includes("--live")) {
    const opts = live ?? liveOptsFromEnv();
    if (!opts.apiKey) {
      console.error("No API key. Set ECONOMY_API_KEY before a --live run.");
      return 1;
    }
    return runLive(opts);
  }
  await runScripted(seededIds("economy"), fixedClock());
  return 0;
}

if (import.meta.main) {
  const code = await start(Deno.args);
  Deno.exit(code);
}
