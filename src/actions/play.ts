"use server";

import { redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db/client";
import { plays, teamMembers } from "@/db/schema";
import { requireTeamMember } from "./_shared";

export async function createPlay(formData: FormData) {
  const teamId = formData.get("teamId") as string;
  const name = (formData.get("name") as string)?.trim();
  if (!name) return;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [member] = await db
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, user.id)));
  if (!member) return;

  const [play] = await db
    .insert(plays)
    .values({ teamId, name, canvas: "{}", createdBy: user.id })
    .returning({ id: plays.id });

  redirect(`/dashboard/${teamId}/plays/${play.id}`);
}

export async function savePlayCanvas(playId: string, canvas: string) {
  // ponytail: size cap + JSON check only; the client re-normalizes via parseCanvas on load.
  if (canvas.length > 500_000) return { error: "Play is too large" };
  try { JSON.parse(canvas); } catch { return { error: "Invalid play data" }; }

  const [play] = await db
    .select({ teamId: plays.teamId, createdBy: plays.createdBy })
    .from(plays)
    .where(eq(plays.id, playId));
  if (!play) return { error: "Play not found" };

  // Same rule as the play page's canEdit: creator or team admin.
  const { user, isAdmin } = await requireTeamMember(play.teamId);
  if (play.createdBy !== user.id && !isAdmin) return { error: "Not allowed" };

  await db.update(plays).set({ canvas }).where(eq(plays.id, playId));
  return { ok: true };
}

export async function duplicatePlay(playId: string, teamId: string) {
  const { user } = await requireTeamMember(teamId);

  const [play] = await db
    .select({ name: plays.name, canvas: plays.canvas })
    .from(plays)
    .where(and(eq(plays.id, playId), eq(plays.teamId, teamId)));
  if (!play) redirect(`/dashboard/${teamId}/plays`);

  const [copy] = await db
    .insert(plays)
    .values({ teamId, name: `${play.name} (copy)`, canvas: play.canvas, createdBy: user.id })
    .returning({ id: plays.id });

  redirect(`/dashboard/${teamId}/plays/${copy.id}`);
}

export async function deletePlay(playId: string, teamId: string) {
  const { user, isAdmin } = await requireTeamMember(teamId);

  const where = and(eq(plays.id, playId), eq(plays.teamId, teamId));
  await db.delete(plays).where(isAdmin ? where : and(where, eq(plays.createdBy, user.id)));
  redirect(`/dashboard/${teamId}/plays`);
}
