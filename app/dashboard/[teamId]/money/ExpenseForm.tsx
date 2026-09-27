"use client";

import { useState } from "react";
import { createExpense } from "@/actions/expense";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";

type RosterMember = { id: string; label: string };

export default function ExpenseForm({
  teamId,
  myMemberId,
  roster,
}: {
  teamId: string;
  myMemberId: string;
  roster: RosterMember[];
}) {
  const [paidBy, setPaidBy] = useState(myMemberId);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  // per-person amount in dollars, keyed by memberId; blank = not yet typed
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  function toggle(id: string) {
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(id)) { next.delete(id); }
      else next.add(id);
      return next;
    });
  }

  function splitEvenly() {
    const total = Number(amounts.__total ?? 0);
    if (!total || picked.size === 0) return;
    const each = (total / picked.size).toFixed(2);
    setAmounts((a) => {
      const next = { ...a };
      for (const id of picked) next[id] = each;
      return next;
    });
  }

  const shares = [...picked]
    .map((id) => ({ memberId: id, amountCents: Math.round(Number(amounts[id] ?? 0) * 100) }))
    .filter((s) => s.amountCents > 0);
  const total = shares.reduce((s, x) => s + x.amountCents, 0);

  return (
    <form action={createExpense} className="grid gap-2">
      <input type="hidden" name="teamId" value={teamId} />
      <input type="hidden" name="paidByMemberId" value={paidBy} />
      <input type="hidden" name="shares" value={JSON.stringify(shares)} />

      <div className="flex flex-wrap gap-2">
        <Input name="title" placeholder="Regionals hotel" required className="min-w-[160px] flex-2" />
        <label className="flex min-w-[140px] flex-1 items-center gap-1.5 text-sm">
          Paid by
          <NativeSelect value={paidBy} onChange={(e) => setPaidBy(e.target.value)} className="flex-1">
            {roster.map((m) => (
              <option key={m.id} value={m.id}>{m.id === myMemberId ? "You" : m.label}</option>
            ))}
          </NativeSelect>
        </label>
      </div>

      <p className="m-0 text-[0.8125rem] text-muted-foreground">Pick who owes, then set each amount.</p>

      <div className="flex flex-wrap items-center gap-1.5">
        <Input
          type="number" step="0.01" min="0" placeholder="Total to split"
          value={amounts.__total ?? ""}
          onChange={(e) => setAmounts((a) => ({ ...a, __total: e.target.value }))}
          className="w-36"
        />
        <Button type="button" variant="outline" size="sm" onClick={splitEvenly} disabled={picked.size === 0}>
          Split evenly
        </Button>
      </div>

      <div className="flex flex-col gap-1.5">
        {roster.map((m) => {
          const isOn = picked.has(m.id);
          return (
            <div
              key={m.id}
              className={cn(
                "flex items-center justify-between gap-2 rounded-md border-[1.5px] border-input bg-background px-3 py-2 text-sm",
                isOn && "border-blue-600 bg-blue-600/10",
              )}
            >
              <button type="button" onClick={() => toggle(m.id)} className="flex-1 cursor-pointer border-0 bg-transparent text-left">
                {m.id === myMemberId ? "You" : m.label}
              </button>
              {isOn && (
                <Input
                  type="number" step="0.01" min="0" placeholder="0.00"
                  value={amounts[m.id] ?? ""}
                  onChange={(e) => setAmounts((a) => ({ ...a, [m.id]: e.target.value }))}
                  className="w-22"
                  aria-label={`Amount owed by ${m.label}`}
                />
              )}
            </div>
          );
        })}
      </div>

      <Button type="submit" size="sm" className="justify-self-start" disabled={shares.length === 0}>
        Log expense{total > 0 ? ` — $${(total / 100).toFixed(2)}` : ""}
      </Button>
    </form>
  );
}
