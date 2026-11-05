// client.ts — the neutral model seam. Nothing in this file knows a wire
// format, a host, or a model id. The scheduler talks to leaves. A leaf talks
// to a Brain. Only wire.ts knows how a provider spells a request.

/** One turn of a conversation, with the provider's roles erased. */
export type ChatMessage = {
  readonly role: "system" | "user";
  readonly text: string;
};

/** The one call a leaf makes. A provider implements this. */
export interface ModelClient {
  readonly name: string;
  complete(messages: readonly ChatMessage[]): Promise<string>;
}
