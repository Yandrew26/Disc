"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { drills, practicePlans } from "@/db/schema";
import { requireTeamMember } from "./_shared";

export async function createDrill(formData: FormData) {
  const teamId = formData.get("teamId") as string;
  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const playId = (formData.get("playId") as string) || null;
  // comma-separated tags → JSON array, lowercased
  const tags = ((formData.get("tags") as string) ?? "")
    .split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
  if (!name) return;

  const { user } = await requireTeamMember(teamId);

  await db.insert(drills).values({
    teamId, name, description, playId, tags: JSON.stringify(tags), createdBy: user.id,
  });
  revalidatePath(`/dashboard/${teamId}/drills`);
}

export async function createPracticePlan(formData: FormData) {
  const teamId = formData.get("teamId") as string;
  const name = (formData.get("name") as string)?.trim();
  const eventId = (formData.get("eventId") as string) || null;
  const agenda = (formData.get("agenda") as string) || "[]";
  if (!name) return;

  const { user } = await requireTeamMember(teamId);

  await db.insert(practicePlans).values({ teamId, name, eventId, agenda, createdBy: user.id });
  revalidatePath(`/dashboard/${teamId}/drills`);
}
