// wire.ts — the only file that knows a provider's wire format.
//
// OpenAI-compatible chat completions. One base URL switches Groq, Cerebras,
// OpenRouter, or a local server. The model id is not written here. It is the
// first id from GET /v1/models, unless the caller names an id the catalogue
// actually lists. A missing id is an error, not a fallback. A 429 waits out
// Retry-After, which is a number of seconds or an HTTP date.

import type { ChatMessage, ModelClient } from "./client.ts";

/** The free tier the skill names. A host, not a model. */
export const DEFAULT_BASE_URL = "https://api.groq.com/openai/v1";

const MAX_ATTEMPTS = 8;
const CAP_SECONDS = 120;

export type FetchLike = typeof fetch;

export type LiveOpts = {
  readonly apiKey: string;
  readonly baseUrl?: string;
  readonly model?: string | null;
  readonly fetch?: FetchLike;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly now?: () => number;
};

type WireCfg = {
  readonly fetch: FetchLike;
  readonly sleep: (ms: number) => Promise<void>;
  readonly now: () => number;
  readonly baseUrl: string;
  readonly apiKey: string;
};

function isRecord(u: unknown): u is Record<string, unknown> {
  return typeof u === "object" && u !== null;
}

/** How long to wait, in milliseconds. The header wins: a number of seconds,
 *  or an HTTP date. Then the "try again in Ns" some providers put in the
 *  body. Then a linear backoff. Half a second keeps a short wait from landing
 *  in the same window. The cap is only for a pathological value. */
export function retryDelayMs(
  header: string | null,
  body: string,
  nowMs: number,
  attempt: number,
): number {
  let seconds: number | null = null;
  if (header && header.trim() !== "") {
    const asNum = Number(header);
    if (Number.isFinite(asNum) && asNum >= 0) {
      seconds = asNum;
    } else {
      const asDate = Date.parse(header);
      if (Number.isFinite(asDate)) seconds = Math.max(0, (asDate - nowMs) / 1000);
    }
  }
  if (seconds === null) {
    const fromBody = body.match(/try again in ([\d.]+)s/);
    seconds = fromBody ? Number(fromBody[1]) : 2 * attempt;
  }
  return Math.min(seconds + 0.5, CAP_SECONDS) * 1000;
}

function cfgOf(opts: LiveOpts): WireCfg {
  const base = opts.baseUrl ?? DEFAULT_BASE_URL;
  return {
    fetch: opts.fetch ?? fetch,
    sleep: opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms))),
    now: opts.now ?? (() => Date.now()),
    baseUrl: base.replace(/\/$/, ""),
    apiKey: opts.apiKey,
  };
}

async function request(cfg: WireCfg, path: string, init: RequestInit): Promise<string> {
  const url = `${cfg.baseUrl}${path}`;
  for (let attempt = 1;; attempt++) {
    const resp = await cfg.fetch(url, init);
    const body = await resp.text();
    if (resp.ok) return body;
    const retryable = resp.status === 429 || resp.status >= 500;
    if (retryable && attempt < MAX_ATTEMPTS) {
      const ms = retryDelayMs(resp.headers.get("retry-after"), body, cfg.now(), attempt);
      await cfg.sleep(ms);
      continue;
    }
    throw new Error(`provider ${resp.status}: ${body.slice(0, 300)}`);
  }
}

function catalogueIds(body: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new Error("the provider catalogue is not JSON");
  }
  if (!isRecord(parsed) || !Array.isArray(parsed.data)) {
    throw new Error("the provider catalogue has no data list");
  }
  const ids: string[] = [];
  for (const row of parsed.data) {
    if (isRecord(row) && typeof row.id === "string" && row.id !== "") ids.push(row.id);
  }
  return ids;
}

/** The id a live run will call. `preferred` must occur in the catalogue.
 *  Otherwise the provider's own order is the choice. */
export async function discoverModel(opts: LiveOpts): Promise<string> {
  const cfg = cfgOf(opts);
  const body = await request(cfg, "/models", {
    headers: { "Authorization": `Bearer ${cfg.apiKey}` },
  });
  const ids = catalogueIds(body);
  const preferred = opts.model ?? null;
  if (preferred) {
    if (!ids.includes(preferred)) {
      throw new Error(`model ${preferred} is not in the provider catalogue`);
    }
    return preferred;
  }
  if (ids.length === 0) throw new Error("the provider catalogue is empty");
  return ids[0];
}

function contentOf(body: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new Error("the provider reply is not JSON");
  }
  const choices = isRecord(parsed) ? parsed.choices : undefined;
  const first = Array.isArray(choices) ? choices[0] : undefined;
  const message = isRecord(first) ? first.message : undefined;
  const content = isRecord(message) ? message.content : undefined;
  if (typeof content !== "string") {
    throw new Error("the provider reply has no text content");
  }
  return content;
}

export function makeWireClient(opts: LiveOpts & { readonly model: string }): ModelClient {
  const cfg = cfgOf(opts);
  const model = opts.model;
  return {
    name: `wire:${model}`,
    async complete(messages: readonly ChatMessage[]): Promise<string> {
      const body = await request(cfg, "/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${cfg.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: messages.map((m) => ({ role: m.role, content: m.text })),
          temperature: 0,
        }),
      });
      return contentOf(body);
    },
  };
}

/** Discover, then build the client around that id. No id is filled in here. */
export async function openLiveClient(opts: LiveOpts): Promise<ModelClient> {
  if (!opts.apiKey) {
    throw new Error("No API key. Set ECONOMY_API_KEY before a --live run.");
  }
  const model = await discoverModel(opts);
  return makeWireClient({ ...opts, model });
}
