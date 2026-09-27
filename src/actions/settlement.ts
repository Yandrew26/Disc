"use server";

import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { db } from "@/db/client";
import { settlements } from "@/db/schema";
import { requireTeamMember } from "./_shared";

// Either side of a debt can record "I paid" / "I got paid" — it starts
// pending either way and only counts once the OTHER member confirms it.
export async function proposeSettlement(formData: FormData) {
  const teamId = formData.get("teamId") as string;
  const fromMemberId = formData.get("fromMemberId") as string;
  const toMemberId = formData.get("toMemberId") as string;
  const amountDollars = Number(formData.get("amount"));
  if (!fromMemberId || !toMemberId || fromMemberId === toMemberId) return;
  if (!Number.isFinite(amountDollars) || amountDollars <= 0) return;

  const { user, memberId } = await requireTeamMember(teamId);
  // The proposer must be one of the two members in the settlement.
  if (memberId !== fromMemberId && memberId !== toMemberId) return;

  await db.insert(settlements).values({
    teamId, fromMemberId, toMemberId,
    amountCents: Math.round(amountDollars * 100),
    proposedBy: user.id,
  });
  revalidatePath(`/dashboard/${teamId}/money`);
}

async function loadPending(teamId: string, settlementId: string) {
  const [s] = await db.select().from(settlements).where(eq(settlements.id, settlementId));
  if (!s || s.teamId !== teamId || s.status !== "pending") return null;
  return s;
}

// Only the counterparty (not the proposer) can confirm — prevents self-confirm.
export async function confirmSettlement(teamId: string, settlementId: string) {
  const { memberId, user } = await requireTeamMember(teamId);
  const s = await loadPending(teamId, settlementId);
  if (!s) return;
  const isParty = memberId === s.fromMemberId || memberId === s.toMemberId;
  const isProposer = s.proposedBy === user.id;
  if (!isParty || isProposer) return;

  await db
    .update(settlements)
    .set({ status: "confirmed", resolvedAt: new Date() })
    .where(eq(settlements.id, settlementId));
  revalidatePath(`/dashboard/${teamId}/money`);
}

export async function rejectSettlement(teamId: string, settlementId: string) {
  const { memberId } = await requireTeamMember(teamId);
  const s = await loadPending(teamId, settlementId);
  if (!s) return;
  if (memberId !== s.fromMemberId && memberId !== s.toMemberId) return;

  await db
    .update(settlements)
    .set({ status: "rejected", resolvedAt: new Date() })
    .where(and(eq(settlements.id, settlementId), eq(settlements.status, "pending")));
  revalidatePath(`/dashboard/${teamId}/money`);
}
