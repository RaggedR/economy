#!/usr/bin/env bash
# verify.sh — the definition of done, mechanised.
#
#   1. type-check and unit tests pass
#   2. the demo replays byte-identically (stdout AND the world and both logs)
#      across two runs.
#
# Run from anywhere: ./verify.sh
set -euo pipefail
cd "$(dirname "$0")"

echo "== deno check =="
deno check src/**/*.ts

echo "== deno test =="
deno test --allow-read --allow-write

echo "== determinism: two demo runs must be byte-identical =="
books() {
  cat demo-out/story/world.json demo-out/story/journal.jsonl demo-out/story/intent-log.jsonl \
      demo-out/month/world.json demo-out/month/journal.jsonl demo-out/month/intent-log.jsonl \
      demo-out/purse/world.json demo-out/purse/journal.jsonl demo-out/purse/intent-log.jsonl \
      demo-out/market/world.json demo-out/market/journal.jsonl demo-out/market/intent-log.jsonl
}

OUT1="$(deno run --allow-read --allow-write src/demo.ts)"; A="$(books)"
OUT2="$(deno run --allow-read --allow-write src/demo.ts)"; B="$(books)"

if [[ "$OUT1" == "$OUT2" && "$A" == "$B" ]]; then
  echo "PASS: stdout, worlds and logs are byte-identical across two runs."
else
  echo "FAIL: replay is not deterministic." >&2
  exit 1
fi
