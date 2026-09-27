"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db/client";
import { attendance, events, teamMembers } from "@/db/schema";

export async function upsertRsvp(eventId: string, status: "yes" | "no" | "maybe") {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [event] = await db.select({ teamId: events.teamId }).from(events).where(eq(events.id, eventId));
  if (!event) return;

  const [member] = await db
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, event.teamId), eq(teamMembers.userId, user.id)));
  if (!member) return;

  await db
    .insert(attendance)
    .values({ eventId, userId: user.id, status, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [attendance.eventId, attendance.userId],
      set: { status, updatedAt: new Date() },
    });
  revalidatePath(`/dashboard/${event.teamId}/events`);
}
