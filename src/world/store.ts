// store.ts — the world file. The CLI is invoked per command, so the world has
// to persist between invocations. Domain ids live in the file. Log ids do not.

import { storySeed } from "./seed.ts";
import type { World } from "./types.ts";

export function loadWorld(path: string): World {
  try {
    return JSON.parse(Deno.readTextFileSync(path)) as World;
  } catch {
    return storySeed();
  }
}

export function saveWorld(path: string, world: World): void {
  const slash = path.lastIndexOf("/");
  if (slash > 0) Deno.mkdirSync(path.slice(0, slash), { recursive: true });
  Deno.writeTextFileSync(path, JSON.stringify(world, null, 2) + "\n");
}
