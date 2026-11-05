// demo_test.ts — --live uses the real seams. Without a key it writes nothing.
// With a stub catalogue it runs the month, and the model id is the one the
// catalogue listed first.

import { assertEquals } from "jsr:@std/assert@1";
import { start } from "./demo.ts";
import { fixedClock } from "./log/ids.ts";
import { fileIntentLog } from "./log/intentlog.ts";
import { fileJournal } from "./log/journal.ts";

Deno.test("live without a key does not run", async () => {
  const code = await start(["--live"], { apiKey: "" });
  assertEquals(code, 1);
});

Deno.test("live discovers a model and does not use the fixed clock", async () => {
  const now = Date.parse("2026-11-05T00:00:00.000Z");
  const slept: number[] = [];
  const models = ["catalogue-a", "catalogue-b"];
  const bodies: { url: string; model?: string }[] = [];
  const queue: Response[] = [
    new Response("slow", { status: 429, headers: { "retry-after": "1" } }),
    new Response(JSON.stringify({ data: models.map((id) => ({ id })) }), { status: 200 }),
    new Response("later", {
      status: 429,
      headers: { "retry-after": new Date(now + 2000).toUTCString() },
    }),
    commitResponse(),
    commitResponse(),
  ];
  const fetchImpl: typeof fetch = (input, init) => {
    const url = String(input);
    let model: string | undefined;
    const raw = (init as { body?: unknown } | undefined)?.body;
    if (typeof raw === "string") {
      const parsed = JSON.parse(raw) as { model?: string };
      model = parsed.model;
    }
    bodies.push({ url, model });
    const next = queue.shift();
    if (!next) throw new Error(`no reply stubbed for ${url}`);
    return Promise.resolve(next);
  };
  const code = await start(["--live"], {
    apiKey: "test-key",
    baseUrl: "http://provider.test/v1",
    fetch: fetchImpl,
    sleep: (ms) => {
      slept.push(ms);
      return Promise.resolve();
    },
    now: () => now,
  });
  assertEquals(code, 0);
  assertEquals(slept, [1500, 2500]);
  assertEquals(bodies.map((b) => b.url), [
    "http://provider.test/v1/models",
    "http://provider.test/v1/models",
    "http://provider.test/v1/chat/completions",
    "http://provider.test/v1/chat/completions",
    "http://provider.test/v1/chat/completions",
  ]);
  assertEquals(bodies[2].model, "catalogue-a");
  assertEquals(bodies[4].model, "catalogue-a");
  const fixed = fixedClock().now();
  const intent = fileIntentLog("demo-out/live/intent-log.jsonl").all();
  assertEquals(intent[0].agent, "household:ada");
  const journal = fileJournal("demo-out/live/journal.jsonl").all();
  const effects = journal.map((e) => e.effect);
  assertEquals(effects.includes("pay"), true);
  assertEquals(effects.includes("lendBank"), true);
  for (const entry of journal) assertEquals(entry.ts === fixed, false);
});

function commitResponse(): Response {
  return new Response(
    JSON.stringify({ choices: [{ message: { content: '{"tag":"commit"}' } }] }),
    { status: 200 },
  );
}
