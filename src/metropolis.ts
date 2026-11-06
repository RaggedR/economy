// metropolis.ts — the 5× town on the living-economy loop. Same entry as
// livetown.ts (runIgnition with { spend: true }), but over metropolisSeed: ~40
// competing firms and 75 heterogeneous people. Not the demo.

import { runIgnition } from "./bridge/ignition.ts";
import { openRig } from "./bridge/rig.ts";
import { fixedClock, seededIds } from "./log/ids.ts";
import { metropolisSeed } from "./world/metropolis.ts";
import { loadWorld } from "./world/store.ts";

const p = (s = "") => console.log(s);

function pad(n: number | string, width: number): string {
  return String(n).padStart(width, " ");
}

export async function start(argv: string[]): Promise<number> {
  const months = argv.length === 0 ? 24 : Number(argv[0]);
  if (!Number.isInteger(months) || months < 1) {
    console.error("months must be a positive integer");
    return 1;
  }
  const ctx = openRig(
    "demo-out/metropolis",
    metropolisSeed(),
    seededIds("economy-metropolis"),
    fixedClock(),
  );
  const lines = await runIgnition(ctx, months, { spend: true });
  p("month  alive  fed  dead  folded  staple  cash  household  firms");
  for (const line of lines) {
    const cash = line.alive === 0 ? "—" : `${line.cashMin}–${line.cashMax}`;
    p(
      `${pad(line.month, 5)}  ${pad(line.alive, 5)}  ${pad(line.fed, 3)}  ` +
        `${pad(line.dead, 4)}  ${pad(line.folded, 6)}  ${pad(line.stapleLeft, 6)}  ` +
        `${cash.padStart(9, " ")}  ${pad(line.householdCash, 9)}  ${
          pad(line.firmCash, 5)
        }`,
    );
  }
  // Who earned and who did not, by firm kind.
  const world = loadWorld(ctx.worldPath);
  p();
  p("firm      kind                 folded  cash  workers  machines");
  for (const id of Object.keys(world.firms).sort()) {
    const f = world.firms[id];
    const cash = f.deposits.a + f.deposits.b;
    let workers = 0;
    for (const person of Object.values(world.people)) {
      if (person.alive && person.job?.firm === id) workers += 1;
    }
    p(
      `${id.padEnd(9, " ")}  ${f.kind.padEnd(19, " ")}  ` +
        `${(f.folded ? "yes" : "no").padStart(6, " ")}  ${pad(cash, 4)}  ` +
        `${pad(workers, 7)}  ${pad(f.machines.length, 8)}`,
    );
  }
  return 0;
}

if (import.meta.main) {
  Deno.exit(await start(Deno.args));
}
