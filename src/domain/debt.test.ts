import { describe, it, expect } from "vitest";
import { computeBalances, simplifyDebts } from "./debt";

describe("computeBalances", () => {
  it("credits the payer and debits each ower", () => {
    const balances = computeBalances(
      [{ paidByMemberId: "a", amountCents: 3000 }],
      [{ memberId: "b", amountCents: 1500 }, { memberId: "c", amountCents: 1500 }],
      [],
    );
    expect(balances).toEqual({ a: 3000, b: -1500, c: -1500 });
  });

  it("a confirmed settlement moves both balances toward zero", () => {
    const balances = computeBalances(
      [{ paidByMemberId: "a", amountCents: 1000 }],
      [{ memberId: "b", amountCents: 1000 }],
      [{ fromMemberId: "b", toMemberId: "a", amountCents: 1000 }],
    );
    expect(balances.a).toBe(0);
    expect(balances.b).toBe(0);
  });
});

describe("simplifyDebts", () => {
  it("cancels out a circular debt between three people into one transfer", () => {
    // a owes b 10, b owes c 10, c owes a 10 -> nets to nothing
    const transfers = simplifyDebts({ a: 0, b: 0, c: 0 });
    expect(transfers).toEqual([]);
  });

  it("produces the minimum transfers for a simple net imbalance", () => {
    // a is owed 3000 total; b and c each owe 1500 -> two transfers, not three
    const transfers = simplifyDebts({ a: 3000, b: -1500, c: -1500 });
    expect(transfers).toHaveLength(2);
    expect(transfers.reduce((s, t) => s + t.amountCents, 0)).toBe(3000);
    for (const t of transfers) expect(t.to).toBe("a");
  });

  it("nets a chain down to a single transfer instead of two", () => {
    // a owes b 500, b (net) owes c 500 -> should collapse to a pays c 500
    const transfers = simplifyDebts({ a: -500, b: 0, c: 500 });
    expect(transfers).toEqual([{ from: "a", to: "c", amountCents: 500 }]);
  });
});
