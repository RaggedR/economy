// ignite.ts — print the t₀ seed and twelve months of the town.
// Not the demo. verify.sh does not diff this.

import { runIgnition } from "./bridge/ignition.ts";
import { openRig } from "./bridge/rig.ts";
import { fixedClock, seededIds } from "./log/ids.ts";
import { params } from "./world/params.ts";
import { townSeed } from "./world/seed.ts";

const p = (s = "") => console.log(s);

function pad(n: number, width: number): string {
  return String(n).padStart(width, " ");
}

export async function start(argv: string[]): Promise<number> {
  const months = argv.length === 0 ? 12 : Number(argv[0]);
  if (!Number.isInteger(months) || months < 1) {
    console.error("months must be a positive integer");
    return 1;
  }
  p(
    `seed  savings ${params.startingSavings}  staple ${params.stapleReservePrice}  ` +
      `luxury ${params.luxuryPrice}  nightclub ${params.nightclubPrice}  ` +
      `tuition ${params.tuitionPrice}  cure ${params.curePrice}  rent ${params.rentPrice}  ` +
      `wage ${params.townWage}  machine ${params.machinePrice}  ` +
      `maintenance ${params.maintenance}  ` +
      `ore ${params.initialRef.common}/${params.initialRef.advanced}`,
  );
  const loaf = Math.floor(params.outputAt0 / params.opsAt0);
  p(
    `oven  one on each shop, ${loaf} loaves  ` +
      `luxury and club stocked ${params.outputAt0}  ` +
      `wage float ${params.firmFloat}  people ${Object.keys(townSeed().people).length}`,
  );
  const ctx = openRig(
    "demo-out/ignition",
    townSeed(),
    seededIds("economy-ignition"),
    fixedClock(),
  );
  const lines = await runIgnition(ctx, months);
  p("month  alive  fed  dead  folded  staple  cash  household  firms");
  for (const line of lines) {
    const cash = line.alive === 0 ? "—" : `${line.cashMin}–${line.cashMax}`;
    p(
      `${pad(line.month, 5)}  ${pad(line.alive, 5)}  ${pad(line.fed, 3)}  ` +
        `${pad(line.dead, 4)}  ${pad(line.folded, 6)}  ${pad(line.stapleLeft, 6)}  ` +
        `${cash.padStart(7, " ")}  ${pad(line.householdCash, 9)}  ${pad(line.firmCash, 5)}`,
    );
  }
  return 0;
}

if (import.meta.main) {
  const code = await start(Deno.args);
  Deno.exit(code);
}
