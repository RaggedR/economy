// demo_test.ts — --live selects the real seams and refuses before the scripted
// books are written.

import { assertEquals } from "jsr:@std/assert@1";
import { start } from "./demo.ts";

Deno.test("live is refused and the scripted demo does not run", async () => {
  const code = await start(["--live"]);
  assertEquals(code, 1);
});
