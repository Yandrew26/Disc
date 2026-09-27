import { redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db/client";
import { teamMembers } from "@/db/schema";

// Every action in this file re-checks membership server-side — never trust
// the teamId a client sends. Shared here because game.ts and lineSet.ts both
// need the identical check (existing action files duplicate this inline;
// factoring it out for two *new* call sites avoids adding a third copy).
export async function requireTeamMember(teamId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [member] = await db
    .select({ id: teamMembers.id, isAdmin: teamMembers.isAdmin })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, user.id)));
  if (!member) redirect("/dashboard");

  return { user, memberId: member.id, isAdmin: member.isAdmin };
}

export async function requireTeamAdmin(teamId: string) {
  const m = await requireTeamMember(teamId);
  if (!m.isAdmin) redirect(`/dashboard/${teamId}`);
  return m;
}
