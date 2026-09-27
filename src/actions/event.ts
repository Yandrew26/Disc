"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db/client";
import { events, teamMembers } from "@/db/schema";
import { createEventInput } from "@/domain/event";

export async function createEvent(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const parsed = createEventInput.safeParse({
    teamId: formData.get("teamId"),
    type: formData.get("type") || "practice",
    title: formData.get("title"),
    location: formData.get("location") || undefined,
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { teamId, type, title, location, startsAt, endsAt } = parsed.data;

  const [myMember] = await db
    .select({ isAdmin: teamMembers.isAdmin })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, user.id)));

  if (!myMember?.isAdmin) {
    return { error: "Only team admins can create events." };
  }

  await db.insert(events).values({
    teamId,
    type,
    title,
    location: location ?? null,
    startsAt: new Date(startsAt),
    endsAt: new Date(endsAt),
    createdBy: user.id,
  });

  revalidatePath(`/dashboard/${teamId}/events`);
  redirect(`/dashboard/${teamId}/events`);
}

export async function deleteEvent(eventId: string, teamId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [myMember] = await db
    .select({ isAdmin: teamMembers.isAdmin })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, user.id)));

  if (!myMember?.isAdmin) return;

  await db.delete(events).where(and(eq(events.id, eventId), eq(events.teamId, teamId)));

  revalidatePath(`/dashboard/${teamId}/events`);
  redirect(`/dashboard/${teamId}/events`);
}
