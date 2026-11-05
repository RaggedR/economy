// render.ts — write the dashboard from scene logs that already balance.
//
// verify.sh diffs the world and the two logs. This file is a reader of those
// logs, and it is not part of that diff. demo-out/dashboard.html is gitignored
// with the rest of demo-out.

import { renderPage } from "./html.ts";
import { parseScene, type Tape } from "./tape.ts";

const SCENE_ORDER = [
  "story",
  "month",
  "purse",
  "market",
  "special",
  "health",
  "tech",
  "kin",
  "leaves",
];

export function loadScenes(root: string): Tape[] {
  const names: string[] = [];
  for (const entry of Deno.readDirSync(root)) {
    if (!entry.isDirectory) continue;
    const dir = `${root}/${entry.name}`;
    if (!isFile(`${dir}/world.json`)) continue;
    if (!isFile(`${dir}/journal.jsonl`)) continue;
    if (!isFile(`${dir}/intent-log.jsonl`)) continue;
    names.push(entry.name);
  }
  names.sort(byScene);
  return names.map((name) => {
    const dir = `${root}/${name}`;
    return parseScene(
      name,
      JSON.parse(Deno.readTextFileSync(`${dir}/world.json`)),
      lines(`${dir}/journal.jsonl`),
      lines(`${dir}/intent-log.jsonl`),
    );
  });
}

export function writeDashboard(root: string, outPath: string): string {
  const tapes = loadScenes(root);
  if (tapes.length === 0) throw new Error(`no scene logs in ${root}`);
  Deno.writeTextFileSync(outPath, renderPage(tapes, { source: root }));
  return outPath;
}

function byScene(a: string, b: string): number {
  const ia = SCENE_ORDER.indexOf(a);
  const ib = SCENE_ORDER.indexOf(b);
  if (ia === -1 && ib === -1) return a.localeCompare(b);
  if (ia === -1) return 1;
  if (ib === -1) return -1;
  return ia - ib;
}

function lines(path: string): unknown[] {
  const text = Deno.readTextFileSync(path).trim();
  if (!text) return [];
  return text.split("\n").filter((line) => line.trim().length > 0).map((line) =>
    JSON.parse(line)
  );
}

function isFile(path: string): boolean {
  try {
    return Deno.statSync(path).isFile;
  } catch {
    return false;
  }
}

if (import.meta.main) {
  const root = Deno.args[0] ?? "demo-out";
  const out = Deno.args[1] ?? "demo-out/dashboard.html";
  console.log(writeDashboard(root, out));
}
