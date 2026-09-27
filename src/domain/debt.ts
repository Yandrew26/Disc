// Splitwise-style ledger: net balance per member, then simplified into the
// fewest peer-to-peer transactions that zero everyone out.

export type ExpenseLite = { paidByMemberId: string; amountCents: number };
export type ShareLite = { memberId: string; amountCents: number };
export type SettlementLite = { fromMemberId: string; toMemberId: string; amountCents: number };

// Positive balance = team owes this member money. Negative = member owes the team.
export function computeBalances(
  expenses: ExpenseLite[],
  shares: ShareLite[],
  confirmedSettlements: SettlementLite[],
): Record<string, number> {
  const balances: Record<string, number> = {};
  const add = (id: string, delta: number) => { balances[id] = (balances[id] ?? 0) + delta; };

  for (const e of expenses) add(e.paidByMemberId, e.amountCents);
  for (const s of shares) add(s.memberId, -s.amountCents);
  // A confirmed settlement is a real payment from -> to: it reduces what
  // `from` still owes (balance moves up) and reduces what `to` is owed
  // (balance moves down) by the same amount.
  for (const s of confirmedSettlements) {
    add(s.fromMemberId, s.amountCents);
    add(s.toMemberId, -s.amountCents);
  }
  return balances;
}

export type SuggestedTransfer = { from: string; to: string; amountCents: number };

// ponytail: greedy largest-debtor-to-largest-creditor matching, not the
// optimal min-transaction-count solver (that's NP-hard in general). Greedy
// gets within 1-2 transactions of optimal for typical club-sized groups —
// upgrade to a real min-cash-flow algorithm if group sizes get large.
export function simplifyDebts(balances: Record<string, number>): SuggestedTransfer[] {
  const creditors = Object.entries(balances)
    .filter(([, v]) => v > 0)
    .map(([id, amount]) => ({ id, amount }))
    .sort((a, b) => b.amount - a.amount);
  const debtors = Object.entries(balances)
    .filter(([, v]) => v < 0)
    .map(([id, amount]) => ({ id, amount: -amount }))
    .sort((a, b) => b.amount - a.amount);

  const transfers: SuggestedTransfer[] = [];
  let ci = 0, di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const c = creditors[ci];
    const d = debtors[di];
    const amount = Math.min(c.amount, d.amount);
    if (amount > 0) transfers.push({ from: d.id, to: c.id, amountCents: amount });
    c.amount -= amount;
    d.amount -= amount;
    if (c.amount === 0) ci++;
    if (d.amount === 0) di++;
  }
  return transfers;
}
