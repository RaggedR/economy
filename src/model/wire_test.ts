// wire_test.ts — Retry-After is seconds or an HTTP date, and the model id
// comes from the catalogue. Nothing in the wire file names one.

import { assertEquals, assertRejects } from "jsr:@std/assert@1";
import { discoverModel, retryDelayMs } from "./wire.ts";

const NOW = Date.parse("2026-11-05T00:00:00.000Z");

Deno.test("retry-after seconds, an HTTP date, a past date, the body, and the cap", () => {
  assertEquals(retryDelayMs("1", "", NOW, 1), 1500);
  assertEquals(retryDelayMs("12.5", "", NOW, 1), 13000);
  const later = new Date(NOW + 2000).toUTCString();
  assertEquals(retryDelayMs(later, "", NOW, 1), 2500);
  const earlier = new Date(NOW - 10_000).toUTCString();
  assertEquals(retryDelayMs(earlier, "", NOW, 1), 500);
  assertEquals(retryDelayMs(null, "try again in 3.5s", NOW, 1), 4000);
  assertEquals(retryDelayMs("soon", "", NOW, 1), 2500);
  assertEquals(retryDelayMs("999", "", NOW, 1), 120_000);
});

Deno.test("a named model must be listed, and an empty catalogue is an error", async () => {
  let posts = 0;
  const fetchImpl: typeof fetch = (input) => {
    const url = String(input);
    if (url.endsWith("/models")) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            data: [{ id: "catalogue-a" }, { id: "" }, { id: "catalogue-b" }],
          }),
          { status: 200 },
        ),
      );
    }
    posts += 1;
    return Promise.resolve(new Response("no", { status: 500 }));
  };
  const opts = {
    apiKey: "k",
    baseUrl: "http://provider.test/v1",
    fetch: fetchImpl,
  };
  assertEquals(await discoverModel({ ...opts, model: "catalogue-b" }), "catalogue-b");
  assertEquals(await discoverModel(opts), "catalogue-a");
  await assertRejects(
    () => discoverModel({ ...opts, model: "not-listed" }),
    Error,
    "not in the provider catalogue",
  );
  const empty: typeof fetch = () =>
    Promise.resolve(new Response(JSON.stringify({ data: [] }), { status: 200 }));
  await assertRejects(
    () => discoverModel({ ...opts, fetch: empty, model: null }),
    Error,
    "catalogue is empty",
  );
  assertEquals(posts, 0);
});

Deno.test("the wire file does not name a model", async () => {
  const src = await Deno.readTextFile(new URL("./wire.ts", import.meta.url));
  assertEquals(src.includes("gpt-"), false);
  assertEquals(src.includes("llama"), false);
  assertEquals(src.includes("claude"), false);
});
