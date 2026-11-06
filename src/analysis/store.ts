// store.ts — the Store comonad (a.k.a. Costate, the "spreadsheet" comonad),
// which is the shape a parameter sweep already is.
//
//   Store<S, A> = (readout: S → A, focus: S)
//
// `extract` reads at the focus. `peek` reads elsewhere without moving it.
// `duplicate` refocuses everywhere — the readout becomes "the store focused
// here". `extend` cobinds: it recomputes a focus-aware summary at every
// position. A grid sweep is `experiment` over a list of positions; a local
// sensitivity is `extend` with a finite-difference kernel.
//
// The comonad laws hold here because the readout is a deterministic function:
// the economy runs under a seeded RNG and a fixed clock, so `peek s` is the
// same value every time. Referential effects (the sweep's params cell) are
// quarantined behind that function; the comonad above it stays pure and lawful.
//
// TypeScript has no higher-kinded types, so `experiment` is given at its common
// instance — a list of positions. The general signature is
//   experiment : Functor f ⇒ (S → f S) → Store S A → f A.

export type Store<S, A> = { readonly peek: (s: S) => A; readonly pos: S };

export function store<S, A>(peek: (s: S) => A, pos: S): Store<S, A> {
  return { peek, pos };
}

/** ε — read the readout at the focus. */
export function extract<S, A>(w: Store<S, A>): A {
  return w.peek(w.pos);
}

/** Read at another position, leaving the focus where it was. */
export function peek<S, A>(s: S, w: Store<S, A>): A {
  return w.peek(s);
}

/** Move the focus to a new position. */
export function seek<S, A>(s: S, w: Store<S, A>): Store<S, A> {
  return { peek: w.peek, pos: s };
}

/** Store is a functor in A: post-compose on the readout. */
export function map<S, A, B>(f: (a: A) => B, w: Store<S, A>): Store<S, B> {
  return { peek: (s) => f(w.peek(s)), pos: w.pos };
}

/** δ — refocus everywhere. The focus is unchanged; every position now yields
 *  the whole store re-centred there. */
export function duplicate<S, A>(w: Store<S, A>): Store<S, Store<S, A>> {
  return { peek: (s) => ({ peek: w.peek, pos: s }), pos: w.pos };
}

/** Cobind: recompute a focus-aware summary `k` at every position. Equal to
 *  `map(k, duplicate(w))`, given here directly so a kernel runs lazily per
 *  position rather than building the intermediate store of stores. */
export function extend<S, A, B>(
  k: (w: Store<S, A>) => B,
  w: Store<S, A>,
): Store<S, B> {
  return { peek: (s) => k({ peek: w.peek, pos: s }), pos: w.pos };
}

/** experiment at the list instance: read the readout across a shape of
 *  positions drawn from the focus. `SCENARIOS.map(peek)` is exactly this. */
export function experiment<S, A>(
  shape: (s: S) => readonly S[],
  w: Store<S, A>,
): A[] {
  return shape(w.pos).map((s) => w.peek(s));
}
