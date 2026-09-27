"use server";

import { redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { db } from "@/db/client";
import { lineSets } from "@/db/schema";
import { requireTeamMember } from "./_shared";

export async function createLineSet(formData: FormData) {
  const teamId = formData.get("teamId") as string;
  const name = (formData.get("name") as string)?.trim();
  const oLine = (formData.get("oLine") as string) || "[]";
  const dLine = (formData.get("dLine") as string) || "[]";
  if (!name) return;

  const { user } = await requireTeamMember(teamId);

  await db.insert(lineSets).values({ teamId, name, oLine, dLine, createdBy: user.id });
  redirect(`/dashboard/${teamId}/lines`);
}

export async function deleteLineSet(lineSetId: string, teamId: string) {
  await requireTeamMember(teamId);
  await db.delete(lineSets).where(and(eq(lineSets.id, lineSetId), eq(lineSets.teamId, teamId)));
  redirect(`/dashboard/${teamId}/lines`);
}
