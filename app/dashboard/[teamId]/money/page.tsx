import { redirect } from "next/navigation";
import { eq, and, desc, isNull } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db/client";
import { teamMembers, profiles, expenses, expenseShares, settlements } from "@/db/schema";
import { deleteExpense } from "@/actions/expense";
import { proposeSettlement, confirmSettlement, rejectSettlement } from "@/actions/settlement";
import { computeBalances, simplifyDebts } from "@/domain/debt";
import ExpenseForm from "./ExpenseForm";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

function dollars(cents: number) {
  const sign = cents < 0 ? "-" : "";
  return `${sign}$${(Math.abs(cents) / 100).toFixed(2)}`;
}

export default async function MoneyPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [myMember] = await db
    .select({ id: teamMembers.id, isAdmin: teamMembers.isAdmin })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, user.id)));
  if (!myMember) redirect("/dashboard");

  const [roster, teamExpenses, shares, teamSettlements] = await Promise.all([
    db
      .select({ id: teamMembers.id, name: profiles.name, email: profiles.email })
      .from(teamMembers)
      .leftJoin(profiles, eq(profiles.id, teamMembers.userId))
      .where(and(eq(teamMembers.teamId, teamId), isNull(teamMembers.leftAt))),
    db.select().from(expenses).where(eq(expenses.teamId, teamId)).orderBy(desc(expenses.createdAt)),
    db
      .select({ expenseId: expenseShares.expenseId, memberId: expenseShares.memberId, amountCents: expenseShares.amountCents })
      .from(expenseShares)
      .innerJoin(expenses, eq(expenses.id, expenseShares.expenseId))
      .where(eq(expenses.teamId, teamId)),
    db.select().from(settlements).where(eq(settlements.teamId, teamId)).orderBy(desc(settlements.createdAt)),
  ]);

  const nameOf = new Map(roster.map((m) => [m.id, m.name ?? m.email ?? "Member"]));
  const nameOrPast = (id: string) => nameOf.get(id) ?? "Past player";

  const confirmed = teamSettlements.filter((s) => s.status === "confirmed");
  const pending = teamSettlements.filter((s) => s.status === "pending");

  const expenseTotals = teamExpenses.map((e) => ({
    paidByMemberId: e.paidByMemberId,
    amountCents: shares.filter((s) => s.expenseId === e.id).reduce((sum, s) => sum + s.amountCents, 0),
  }));
  const balances = computeBalances(expenseTotals, shares, confirmed);
  const suggested = simplifyDebts(balances);

  const myBalance = balances[myMember.id] ?? 0;
  const myPending = pending.filter((s) => s.fromMemberId === myMember.id || s.toMemberId === myMember.id);

  return (
    <main className="detail-layout">
      <div className="detail-main">
        <div className="page-hd">
          <h1>Money</h1>
        </div>

        <h2 className="mb-2">Suggested settle-ups</h2>
        {suggested.length === 0 ? (
          <p className="empty">Everyone&apos;s settled up.</p>
        ) : (
          <ul className="list mb-6">
            {suggested.map((t, i) => (
              <li key={i} className="list-row items-center">
                <span>
                  {nameOrPast(t.from)} owes {nameOrPast(t.to)}{" "}
                  <span className="list-item-desc">{dollars(t.amountCents)}</span>
                </span>
                {(t.from === myMember.id || t.to === myMember.id) && (
                  <form action={proposeSettlement}>
                    <input type="hidden" name="teamId" value={teamId} />
                    <input type="hidden" name="fromMemberId" value={t.from} />
                    <input type="hidden" name="toMemberId" value={t.to} />
                    <input type="hidden" name="amount" value={(t.amountCents / 100).toFixed(2)} />
                    <Button type="submit" variant="outline" size="sm">
                      {t.from === myMember.id ? "I paid this" : "I got paid"}
                    </Button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}

        <Separator className="my-8" />
        <h2 className="mb-3">Add an expense</h2>
        <ExpenseForm
          teamId={teamId}
          myMemberId={myMember.id}
          roster={roster.map((m) => ({ id: m.id, label: nameOf.get(m.id)! }))}
        />

        <Separator className="my-8" />
        <h2 className="mb-3">Expense history</h2>
        {teamExpenses.length === 0 ? (
          <p className="empty">No expenses logged yet.</p>
        ) : (
          <ul className="list">
            {teamExpenses.map((e) => {
              const rows = shares.filter((s) => s.expenseId === e.id);
              const total = rows.reduce((s, r) => s + r.amountCents, 0);
              const canDelete = myMember.isAdmin || e.paidByMemberId === myMember.id;
              return (
                <li key={e.id} className="list-row flex-col items-start gap-1">
                  <div className="flex w-full justify-between">
                    <span className="list-item-title">{e.title}</span>
                    {canDelete && (
                      <form action={deleteExpense.bind(null, teamId, e.id)}>
                        <Button type="submit" variant="ghost" size="sm">Delete</Button>
                      </form>
                    )}
                  </div>
                  <span className="list-item-desc">
                    {nameOrPast(e.paidByMemberId)} paid {dollars(total)}, split with{" "}
                    {rows.map((r) => `${nameOrPast(r.memberId)} (${dollars(r.amountCents)})`).join(", ")}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <aside className="detail-panel">
        <div className="detail-panel-section">
          <h3>Your balance</h3>
          <p className={cn(
            "text-lg font-bold",
            myBalance > 0 && "text-going",
            myBalance < 0 && "text-decline",
          )}>
            {myBalance === 0 ? "Settled up" : myBalance > 0 ? `You're owed ${dollars(myBalance)}` : `You owe ${dollars(-myBalance)}`}
          </p>
        </div>

        {myPending.length > 0 && (
          <div className="detail-panel-section">
            <h3>Awaiting confirmation</h3>
            <ul className="list m-0">
              {myPending.map((s) => {
                const iAmRecipient = s.proposedBy !== user.id;
                return (
                  <li key={s.id} className="list-row flex-col items-start gap-1.5 py-2">
                    <span className="text-sm">
                      {nameOrPast(s.fromMemberId)} → {nameOrPast(s.toMemberId)}{" "}
                      <span className="list-item-desc">{dollars(s.amountCents)}</span>
                    </span>
                    {iAmRecipient ? (
                      <span className="flex gap-1.5">
                        <form action={confirmSettlement.bind(null, teamId, s.id)}>
                          <Button type="submit" size="sm">Confirm</Button>
                        </form>
                        <form action={rejectSettlement.bind(null, teamId, s.id)}>
                          <Button type="submit" variant="ghost" size="sm">Reject</Button>
                        </form>
                      </span>
                    ) : (
                      <span className="list-item-desc">Waiting on the other side</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </aside>
    </main>
  );
}
