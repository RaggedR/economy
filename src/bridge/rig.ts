// rig.ts — one world file, one journal, one intent log, and the econ runner
// pointed at them. The demo and the tests share this so a leaf never holds the
// world object.

import { run } from "../cli/econ.ts";
import type { Clock, IdSource } from "../log/ids.ts";
import { fileIntentLog } from "../log/intentlog.ts";
import { saveWorld } from "../world/store.ts";
import type { World } from "../world/types.ts";
import type { HarnessCtx } from "./harness.ts";

export function freshDir(path: string): void {
  try {
    Deno.removeSync(path, { recursive: true });
  } catch {
    // absent on the first run
  }
  Deno.mkdirSync(path, { recursive: true });
}

export function openRig(
  dir: string,
  seed: World,
  ids: IdSource,
  clock: Clock,
): HarnessCtx {
  freshDir(dir);
  const worldPath = `${dir}/world.json`;
  const journalPath = `${dir}/journal.jsonl`;
  const intentPath = `${dir}/intent-log.jsonl`;
  saveWorld(worldPath, seed);
  // A book even when every commit is engine. Empty means no agent spoke.
  // The journal stays absent until something commits.
  Deno.writeTextFileSync(intentPath, "");
  const intentLog = fileIntentLog(intentPath);
  const econ = (argv: string[]) =>
    run(
      [...argv, "--world", worldPath, "--journal", journalPath, "--intent", intentPath],
      ids,
      clock,
    );
  return { ids, clock, intentLog, worldPath, journalPath, intentPath, econ };
}
