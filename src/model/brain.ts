// brain.ts — what a live leaf is allowed to say. The shape was already chosen.
// The model does not mint a correlation id, and it does not forecast a price.
// `commit` means "run the shape I was asked". `refused` is a position. Any
// other reply is handed to the decoder, which throws. No default.

import type { ChatMessage, ModelClient } from "./client.ts";

export type Brain = {
  reply(agent: string, shape: unknown): Promise<unknown>;
};

const SYSTEM = [
  "You are a leaf in a typed economy. You are asked one shape.",
  "You do not choose the terms and you do not forecast a price.",
  "Reply with one JSON object and no other text.",
  '{"tag":"commit"} runs the shape through the gate.',
  '{"tag":"refused","reason":"..."} declines it. The reason is non-empty.',
  "Do not invent a correlation id. Do not reply done or rationed.",
].join(" ");

function isRecord(u: unknown): u is Record<string, unknown> {
  return typeof u === "object" && u !== null;
}

/** The first JSON object in a reply. Prose around it is ignored. A reply
 *  with no object comes back as text, and the decoder rejects the text. */
export function parseReply(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return text;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return text;
  }
}

export function modelBrain(client: ModelClient): Brain {
  return {
    async reply(agent, shape) {
      const messages: ChatMessage[] = [
        { role: "system", text: SYSTEM },
        { role: "user", text: `${agent}\n${JSON.stringify(shape)}` },
      ];
      return parseReply(await client.complete(messages));
    },
  };
}

export function isCommit(u: unknown): boolean {
  return isRecord(u) && u.tag === "commit";
}

export function isRefusal(u: unknown): u is { tag: "refused"; reason: string } {
  return isRecord(u) && u.tag === "refused" && typeof u.reason === "string" &&
    u.reason.trim() !== "";
}

/** Absent brain: the scripted answer, unchanged. Present brain: `commit`
 *  runs that answer, `refused` is the caller's logged position, and anything
 *  else is returned as text so a model-authored `done` cannot decode. */
export function answerWithBrain(
  brain: Brain | undefined,
  agent: string,
  shape: unknown,
  scripted: () => unknown,
  onRefuse: (reason: string) => unknown,
): unknown | Promise<unknown> {
  if (!brain) return scripted();
  return brain.reply(agent, shape).then((raw) => {
    if (isCommit(raw)) return scripted();
    if (isRefusal(raw)) return onRefuse(raw.reason);
    return typeof raw === "string" ? raw : JSON.stringify(raw);
  });
}
