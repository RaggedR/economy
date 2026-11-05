"""
Minimal Agent-Based Stock-Flow-Consistent (AB-SFC) accounting core.

The point of this file is NOT behaviour yet -- it is to establish a *watertight*
monetary skeleton for Robin's economy:

  * every payment is double-entry (a balanced multi-sector transaction),
  * money is created ONLY by bank lending and destroyed ONLY by repayment,
  * an invariant is asserted after every transaction, so any future "leak"
    (a flow that does not balance) is caught the instant it is introduced.

Sign convention, per instrument, per sector:
    +value  == the instrument is a NET ASSET to that sector
    -value  == the instrument is a NET LIABILITY of that sector
Consistency then reads: for each financial instrument, the sum across all
sectors is exactly zero -- every asset is someone else's liability.

Real stocks (houses, land, machines, inventory) are held outright: they have
no counterparty, so they do not net to zero -- their system sum is real wealth.

Later layers -- pricing/inventory, labour matching, collateralised credit,
asset markets, and the automation shock -- bolt on top of this core and are
never allowed to break the invariant.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Tuple

Entry = Tuple[str, float]  # (sector name, signed amount)

INSTRUMENTS = ("deposits", "loans", "bonds")
REAL = ("houses", "land", "machines", "inventory")
EPS = 1e-9


@dataclass
class Sector:
    name: str
    # financial position (+asset / -liability)
    deposits: float = 0.0
    loans: float = 0.0
    bonds: float = 0.0
    # real stocks (>= 0, no counterparty)
    houses: float = 0.0
    land: float = 0.0
    machines: float = 0.0
    inventory: float = 0.0

    def net_financial(self) -> float:
        return self.deposits + self.loans + self.bonds


class Economy:
    """An economy is a set of sector balance sheets plus a double-entry ledger."""

    def __init__(self, sector_names: List[str]):
        self.sectors: Dict[str, Sector] = {n: Sector(n) for n in sector_names}
        self.ledger: List[str] = []

    # ---- core primitive: one balanced multi-entry transaction ----------
    def transact(self, instrument: str, entries: List[Entry], memo: str) -> None:
        total = sum(amt for _, amt in entries)
        if abs(total) > EPS:
            raise ValueError(
                f"UNBALANCED {instrument} transaction '{memo}': net {total:+.6f}"
            )
        for name, amt in entries:
            s = self.sectors[name]
            setattr(s, instrument, getattr(s, instrument) + amt)
        self.ledger.append(
            f"{instrument:8s} | {memo:28s} | "
            + ", ".join(f"{n} {amt:+.2f}" for n, amt in entries)
        )
        self.check()  # fail fast: the invariant holds after *every* transaction

    # ---- money primitives ---------------------------------------------
    def pay(self, src: str, dst: str, amount: float, memo: str) -> None:
        """Move EXISTING deposits src -> dst. No money created or destroyed."""
        self.transact("deposits", [(src, -amount), (dst, +amount)], memo)

    def lend(self, bank: str, borrower: str, amount: float, memo: str) -> None:
        """
        Bank makes a loan. Both sides of the borrower's balance sheet grow:
        a new DEPOSIT (asset) and a new LOAN (liability). The bank mirrors it.
        This is the 'number added to both sides of the ledger' from the very
        first conversation -- money is created here, out of nothing but a
        matched asset/liability pair.
        """
        self.transact("deposits", [(bank, -amount), (borrower, +amount)],
                      memo + " :: deposit created")
        self.transact("loans", [(bank, +amount), (borrower, -amount)],
                      memo + " :: loan booked")

    def repay(self, bank: str, borrower: str, amount: float, memo: str) -> None:
        """Loan repayment. The deposit is extinguished -- money is destroyed."""
        self.transact("deposits", [(borrower, -amount), (bank, +amount)],
                      memo + " :: deposit destroyed")
        self.transact("loans", [(bank, -amount), (borrower, +amount)],
                      memo + " :: loan retired")

    # ---- the invariant that makes the model trustworthy ----------------
    def check(self) -> None:
        for instrument in INSTRUMENTS:
            s = sum(getattr(sec, instrument) for sec in self.sectors.values())
            if abs(s) > 1e-6:
                raise AssertionError(
                    f"LEAK: instrument '{instrument}' sums to {s:+.6f}, not 0"
                )

    # ---- read-outs ------------------------------------------------------
    def money_supply(self) -> float:
        """Broad money = deposits held by the non-bank sectors (positive side)."""
        return sum(max(sec.deposits, 0.0)
                   for sec in self.sectors.values() if sec.name != "bank")

    def total_credit(self) -> float:
        """Loans outstanding = the bank's loan assets."""
        return self.sectors["bank"].loans

    def snapshot(self, label: str) -> None:
        print(f"\n=== {label} ===")
        print(f"{'sector':12s} {'deposits':>10s} {'loans':>10s} {'bonds':>8s} "
              f"{'netfin':>8s}")
        for sec in self.sectors.values():
            print(f"{sec.name:12s} {sec.deposits:>10.2f} {sec.loans:>10.2f} "
                  f"{sec.bonds:>8.2f} {sec.net_financial():>8.2f}")
        print(f"{'money supply':12s} = {self.money_supply():.2f}    "
              f"loans outstanding = {self.total_credit():.2f}")


def demo() -> None:
    """
    A four-step cycle that demonstrates endogenous money and the identity
    'broad money == loans outstanding' (the 'money = debt + constant' claim
    from the first conversation, here with constant = 0 because there is no
    government base money yet).
    """
    econ = Economy(["workers", "rentiers", "firm", "bank", "government"])
    econ.snapshot("t0: empty economy (no money exists yet)")

    econ.lend("bank", "firm", 100.0, "firm borrows to fund production")
    econ.snapshot("t1: bank lends 100 to firm  -> money created")

    econ.pay("firm", "workers", 100.0, "firm pays wages")
    econ.snapshot("t2: firm pays 100 wages      -> money relocated, not created")

    econ.pay("workers", "firm", 60.0, "workers buy food")
    econ.snapshot("t3: workers spend 60 on food -> money circulates back")

    econ.repay("bank", "firm", 40.0, "firm repays part of loan")
    econ.snapshot("t4: firm repays 40 of loan   -> money DESTROYED")

    print("\nnote: at every step  broad money == loans outstanding.")
    print("deleveraging (t4) shrank the money supply -- exactly the")
    print("mechanism behind the deflationary debt spiral we discussed.")


if __name__ == "__main__":
    demo()
