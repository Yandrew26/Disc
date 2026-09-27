"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { expenses, expenseShares } from "@/db/schema";
import { requireTeamMember } from "./_shared";

export async function createExpense(formData: FormData) {
  const teamId = formData.get("teamId") as string;
  const title = (formData.get("title") as string)?.trim();
  const paidByMemberId = formData.get("paidByMemberId") as string;
  // shares arrive as JSON: [{ memberId, amountCents }] — picked members and
  // their (possibly uneven) amounts, built client-side.
  let shares: { memberId: string; amountCents: number }[] = [];
  try {
    shares = JSON.parse((formData.get("shares") as string) ?? "[]");
  } catch { return; }
  shares = shares.filter((s) => Number.isInteger(s.amountCents) && s.amountCents > 0 && s.memberId);
  if (!title || !paidByMemberId || shares.length === 0) return;

  const { user } = await requireTeamMember(teamId);

  const [expense] = await db
    .insert(expenses)
    .values({ teamId, title, paidByMemberId, createdBy: user.id })
    .returning({ id: expenses.id });

  await db.insert(expenseShares).values(
    shares.map((s) => ({ expenseId: expense.id, memberId: s.memberId, amountCents: s.amountCents })),
  );
  revalidatePath(`/dashboard/${teamId}/money`);
}

// Only the person who fronted the money, or a team admin, can undo an expense.
export async function deleteExpense(teamId: string, expenseId: string) {
  const { memberId, isAdmin } = await requireTeamMember(teamId);

  const [expense] = await db
    .select({ teamId: expenses.teamId, paidByMemberId: expenses.paidByMemberId })
    .from(expenses)
    .where(eq(expenses.id, expenseId));
  if (!expense || expense.teamId !== teamId) return;
  if (!isAdmin && expense.paidByMemberId !== memberId) return;

  await db.delete(expenses).where(eq(expenses.id, expenseId));
  revalidatePath(`/dashboard/${teamId}/money`);
}
