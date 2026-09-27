"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db/client";
import { teamRoles, teamMembers } from "@/db/schema";

async function assertAdmin(teamId: string, userId: string) {
  const [m] = await db
    .select({ isAdmin: teamMembers.isAdmin })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)));
  return !!m?.isAdmin;
}

export async function addTeamRole(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const teamId = formData.get("teamId") as string;
  const name = (formData.get("name") as string)?.trim();
  if (!name) return;
  if (!(await assertAdmin(teamId, user.id))) return;

  await db.insert(teamRoles).values({ teamId, name });
  revalidatePath(`/dashboard/${teamId}/settings`);
}

export async function updateTeamRole(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const teamId = formData.get("teamId") as string;
  const roleId = formData.get("roleId") as string;
  const name = (formData.get("name") as string)?.trim();
  if (!name) return;
  if (!(await assertAdmin(teamId, user.id))) return;

  await db.update(teamRoles).set({ name }).where(and(eq(teamRoles.id, roleId), eq(teamRoles.teamId, teamId)));
  revalidatePath(`/dashboard/${teamId}/settings`);
}

export async function deleteTeamRole(roleId: string, teamId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!(await assertAdmin(teamId, user.id))) return;

  await db.delete(teamRoles).where(and(eq(teamRoles.id, roleId), eq(teamRoles.teamId, teamId)));
  revalidatePath(`/dashboard/${teamId}/settings`);
}
