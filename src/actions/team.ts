"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db/client";
import { teams, teamMembers, teamRoles, profiles } from "@/db/schema";
import { adminClient } from "@/lib/supabase/admin";
import { createTeamInput, addTeamMemberInput } from "@/domain/team";

export async function createTeam(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const parsed = createTeamInput.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const [team] = await db.insert(teams).values({ name: parsed.data.name }).returning({ id: teams.id });

  // Seed default roles
  await db.insert(teamRoles).values([
    { teamId: team.id, name: "Coach" },
    { teamId: team.id, name: "Captain" },
    { teamId: team.id, name: "Player" },
  ]);

  // Creator gets admin permission, no specific role label
  await db.insert(teamMembers).values({
    teamId: team.id,
    userId: user.id,
    isAdmin: true,
    roleId: null,
  });

  revalidatePath("/dashboard");
  redirect(`/dashboard/${team.id}`);
}

export async function addTeamMember(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const parsed = addTeamMemberInput.safeParse({
    email: formData.get("email"),
    roleId: formData.get("roleId") || undefined,
    isAdmin: formData.get("isAdmin") === "on",
    teamId: formData.get("teamId"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { email, roleId, isAdmin, teamId } = parsed.data;

  const [myMember] = await db
    .select({ isAdmin: teamMembers.isAdmin })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, user.id)));

  if (!myMember?.isAdmin) {
    return { error: "Only team admins can add members." };
  }

  const [profile] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.email, email));

  if (!profile) {
    await adminClient.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/auth/callback?next=/auth/set-password`,
    }).catch((e) => console.error("Invite email error:", e));
  }

  await db.insert(teamMembers).values({
    teamId,
    userId: profile?.id ?? null,
    isAdmin,
    roleId: roleId ?? null,
    inviteEmail: email,
  });

  revalidatePath(`/dashboard/${teamId}`);
  return { success: true };
}
