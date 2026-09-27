"use server";

import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { db } from "@/db/client";
import { announcements, announcementReads } from "@/db/schema";
import { requireTeamMember, requireTeamAdmin } from "./_shared";

export async function postAnnouncement(formData: FormData) {
  const teamId = formData.get("teamId") as string;
  const title = (formData.get("title") as string)?.trim() || null;
  const body = (formData.get("body") as string)?.trim();
  if (!body) return;

  // Each poll option is its own "option" field (repeated inputs), not a
  // newline-separated blob — blank entries dropped.
  const rawOptions = formData.getAll("option")
    .map((o) => (o as string).trim())
    .filter(Boolean);

  const { user } = await requireTeamAdmin(teamId);

  await db.insert(announcements).values({
    teamId,
    title,
    body,
    pollOptions: rawOptions.length >= 2 ? JSON.stringify(rawOptions) : null,
    createdBy: user.id,
  });
  revalidatePath(`/dashboard/${teamId}/feed`);
}

async function announcementBelongsToTeam(announcementId: string, teamId: string) {
  const [row] = await db
    .select({ id: announcements.id })
    .from(announcements)
    .where(and(eq(announcements.id, announcementId), eq(announcements.teamId, teamId)));
  return !!row;
}

export async function markRead(teamId: string, announcementId: string) {
  const { user } = await requireTeamMember(teamId);
  if (!(await announcementBelongsToTeam(announcementId, teamId))) return;
  await db
    .insert(announcementReads)
    .values({ announcementId, userId: user.id })
    .onConflictDoNothing();
}

export async function vote(teamId: string, announcementId: string, optionIdx: number) {
  const { user } = await requireTeamMember(teamId);
  if (!(await announcementBelongsToTeam(announcementId, teamId))) return;
  await db
    .insert(announcementReads)
    .values({ announcementId, userId: user.id, vote: optionIdx })
    .onConflictDoUpdate({
      target: [announcementReads.announcementId, announcementReads.userId],
      set: { vote: optionIdx },
    });
  revalidatePath(`/dashboard/${teamId}/feed`);
}
