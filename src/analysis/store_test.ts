// store_test.ts — the Store comonad obeys the comonad laws. Stores hold
// functions, so equality is tested by sampling the readout over a fixed set of
// positions and comparing the focus.

import { assert } from "jsr:@std/assert@1";
import {
  duplicate,
  experiment,
  extend,
  extract,
  map,
  peek,
  seek,
  type Store,
  store,
} from "./store.ts";

// A deterministic readout over the integers. Any pure function will do; the
// laws do not depend on which.
const SAMPLE = [-3, -1, 0, 2, 5, 9];
const w: Store<number, number> = store((s) => s * s - s, 2);

function eqNum(x: number, y: number): boolean {
  return x === y;
}

/** Two stores are equal when they focus the same point and their readouts
 *  agree across the sample. `eqA` compares the carried values, which may itself
 *  be a store equality one level down. */
function storeEq<S extends number, A>(
  sample: readonly S[],
  a: Store<S, A>,
  b: Store<S, A>,
  eqA: (x: A, y: A) => boolean,
): boolean {
  if (a.pos !== b.pos) return false;
  return sample.every((s) => eqA(a.peek(s), b.peek(s)));
}

Deno.test("extract ∘ duplicate = id", () => {
  assert(storeEq(SAMPLE, extract(duplicate(w)), w, eqNum));
});

Deno.test("map extract ∘ duplicate = id", () => {
  assert(storeEq(SAMPLE, map(extract, duplicate(w)), w, eqNum));
});

Deno.test("coassociativity: duplicate ∘ duplicate = map duplicate ∘ duplicate", () => {
  const left = duplicate(duplicate(w));
  const right = map(duplicate, duplicate(w));
  // Both are Store<number, Store<number, Store<number, number>>>. Compare by
  // sampling down two levels, with storeEq as the value equality at each.
  const eqInner = (x: Store<number, number>, y: Store<number, number>) =>
    storeEq(SAMPLE, x, y, eqNum);
  const eqMiddle = (x: Store<number, Store<number, number>>, y: typeof x) =>
    storeEq(SAMPLE, x, y, eqInner);
  assert(storeEq(SAMPLE, left, right, eqMiddle));
});

Deno.test("extend extract = id", () => {
  assert(storeEq(SAMPLE, extend(extract, w), w, eqNum));
});

Deno.test("extract ∘ extend k = k", () => {
  const k = (v: Store<number, number>) => extract(v) + peek(v.pos + 1, v);
  assert(extract(extend(k, w)) === k(w));
});

Deno.test("extend associativity", () => {
  const g = (v: Store<number, number>) => extract(v) * 2;
  const k = (v: Store<number, number>) => extract(v) + 1;
  const lhs = extend(k, extend(g, w));
  const rhs = extend((v: Store<number, number>) => k(extend(g, v)), w);
  assert(storeEq(SAMPLE, lhs, rhs, eqNum));
});

Deno.test("peek and seek: peek reads, seek moves", () => {
  assert(peek(5, w) === w.peek(5));
  assert(seek(5, w).pos === 5);
  assert(extract(seek(5, w)) === w.peek(5));
  // seek does not change the readout.
  assert(seek(5, w).peek(2) === w.peek(2));
});

Deno.test("experiment at the list instance is a sweep of peeks", () => {
  const shape = (s: number) => [s - 1, s, s + 1];
  const got = experiment(shape, w);
  assert(got.length === 3);
  assert(got[0] === w.peek(1) && got[1] === w.peek(2) && got[2] === w.peek(3));
});
