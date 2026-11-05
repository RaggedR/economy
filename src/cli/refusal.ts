// refusal.ts — a refusal is a value at the gate, and an exception only at the
// process edge, where the CLI turns it into exit 1. The harness catches this
// class and writes `refused`. Anything else is a bug and is logged `error`.

export class Refusal extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Refusal";
  }
}
