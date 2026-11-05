// rng.ts — the world's lottery. RngState is part of World. A draw writes the
// next stream back. Nothing in the reducer calls Math.random.

import type { RngState, World } from "./types.ts";

/** One unsigned step. `stream` advances by 1. The seed stays put. */
export function nextUint(state: RngState): { state: RngState; value: number } {
  let t = (state.seed + Math.imul(state.stream + 1, 0x6D2B79F5)) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = (t ^ (t >>> 14)) >>> 0;
  return { state: { seed: state.seed, stream: state.stream + 1 }, value };
}

export function nextIndex(world: World, n: number): { world: World; index: number } {
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`lottery width ${n} is not a positive integer`);
  }
  const drawn = nextUint(world.rng);
  return { world: { ...world, rng: drawn.state }, index: drawn.value % n };
}
