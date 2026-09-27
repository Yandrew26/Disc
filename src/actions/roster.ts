"use server";

import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { db } from "@/db/client";
import { teamMembers, profiles } from "@/db/schema";
import { adminClient } from "@/lib/supabase/admin";
import { requireTeamAdmin } from "./_shared";
import { parseRosterCsv } from "@/domain/csv";

export async function archiveMember(teamId: string, memberId: string) {
  await requireTeamAdmin(teamId);
  await db
    .update(teamMembers)
    .set({ leftAt: new Date() })
    .where(and(eq(teamMembers.id, memberId), eq(teamMembers.teamId, teamId)));
  revalidatePath(`/dashboard/${teamId}`);
  revalidatePath(`/dashboard/${teamId}/settings`);
}

export async function restoreMember(teamId: string, memberId: string) {
  await requireTeamAdmin(teamId);
  await db
    .update(teamMembers)
    .set({ leftAt: null })
    .where(and(eq(teamMembers.id, memberId), eq(teamMembers.teamId, teamId)));
  revalidatePath(`/dashboard/${teamId}`);
  revalidatePath(`/dashboard/${teamId}/settings`);
}

export async function importRosterCsv(formData: FormData) {
  const teamId = formData.get("teamId") as string;
  const csvText = (formData.get("csv") as string) ?? "";

  await requireTeamAdmin(teamId);

  const rows = parseRosterCsv(csvText);
  if (rows.length === 0) return;

  const existing = await db
    .select({ inviteEmail: teamMembers.inviteEmail, userId: teamMembers.userId })
    .from(teamMembers)
    .where(eq(teamMembers.teamId, teamId));
  const existingEmails = new Set(existing.map((m) => m.inviteEmail?.toLowerCase()).filter(Boolean));

  for (const row of rows) {
    if (existingEmails.has(row.email)) continue;

    const [profile] = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.email, row.email));

    if (!profile) {
      await adminClient.auth.admin.inviteUserByEmail(row.email, {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/auth/callback?next=/auth/set-password`,
      }).catch((e) => console.error("Invite email error:", e));
    }

    await db.insert(teamMembers).values({
      teamId,
      userId: profile?.id ?? null,
      inviteEmail: row.email,
    });
  }
  revalidatePath(`/dashboard/${teamId}`);
  revalidatePath(`/dashboard/${teamId}/settings`);
}
