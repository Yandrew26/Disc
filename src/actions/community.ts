"use server";

import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { db } from "@/db/client";
import { shoutouts, eventPhotos, events } from "@/db/schema";
import { requireTeamMember } from "./_shared";

export async function giveShoutout(formData: FormData) {
  const teamId = formData.get("teamId") as string;
  const memberId = formData.get("memberId") as string;
  const title = (formData.get("title") as string)?.trim();
  const body = (formData.get("body") as string)?.trim() || null;
  if (!title || !memberId) return;

  const { user } = await requireTeamMember(teamId);

  await db.insert(shoutouts).values({ teamId, memberId, title, body, createdBy: user.id });
  revalidatePath(`/dashboard/${teamId}`);
}

export async function recordPhoto(teamId: string, eventId: string, storagePath: string) {
  const { user } = await requireTeamMember(teamId);

  const [event] = await db
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.id, eventId), eq(events.teamId, teamId)));
  if (!event) return;

  // Path is client-supplied; keep it inside this event's folder.
  if (!storagePath.startsWith(`${teamId}/${eventId}/`)) return;

  await db.insert(eventPhotos).values({ eventId, storagePath, uploadedBy: user.id });
  revalidatePath(`/dashboard/${teamId}/events/${eventId}`);
}
