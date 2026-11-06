// livetown.ts — the town with demand. Like ignite.ts, but the people hold
// happiness, health, and education objectives, so the discretionary pass has
// something to buy, and the non-staple firms get a customer. Not the demo.

import { runIgnition } from "./bridge/ignition.ts";
import { openRig } from "./bridge/rig.ts";
import { fixedClock, seededIds } from "./log/ids.ts";
import { livingTownSeed } from "./world/seed.ts";
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
    "demo-out/livetown",
    livingTownSeed(),
    seededIds("economy-livetown"),
    fixedClock(),
  );
  const lines = await runIgnition(ctx, months, { spend: true });
  p("month  alive  fed  dead  folded  staple  cash  household  firms");
  for (const line of lines) {
    const cash = line.alive === 0 ? "—" : `${line.cashMin}–${line.cashMax}`;
    p(
      `${pad(line.month, 5)}  ${pad(line.alive, 5)}  ${pad(line.fed, 3)}  ` +
        `${pad(line.dead, 4)}  ${pad(line.folded, 6)}  ${pad(line.stapleLeft, 6)}  ` +
        `${cash.padStart(7, " ")}  ${pad(line.householdCash, 9)}  ${
          pad(line.firmCash, 5)
        }`,
    );
  }
  // Who earned and who did not. A firm that never sold holds its opening float
  // (or nothing, folded); a firm with customers carries their money.
  const world = loadWorld(ctx.worldPath);
  p();
  p("firm          kind                 folded  cash  machines");
  for (const id of Object.keys(world.firms).sort()) {
    const f = world.firms[id];
    const cash = f.deposits.a + f.deposits.b;
    p(
      `${id.padEnd(13, " ")}  ${f.kind.padEnd(19, " ")}  ` +
        `${(f.folded ? "yes" : "no").padStart(6, " ")}  ${
          pad(cash, 4)
        }  ${f.machines.length}`,
    );
  }
  return 0;
}

if (import.meta.main) {
  Deno.exit(await start(Deno.args));
}
