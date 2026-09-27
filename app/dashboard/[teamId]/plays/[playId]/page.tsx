import { redirect } from "next/navigation";
import Link from "next/link";
import { eq, and } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db/client";
import { teams, teamMembers, plays } from "@/db/schema";
import { deletePlay, duplicatePlay } from "@/actions/play";
import PlayEditor from "./PlayEditor";
import SubmitButton from "@/app/dashboard/SubmitButton";

export default async function PlayPage({
  params,
}: {
  params: Promise<{ teamId: string; playId: string }>;
}) {
  const { teamId, playId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [myMember] = await db
    .select({ isAdmin: teamMembers.isAdmin })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, user.id)));
  if (!myMember) redirect("/dashboard");

  const [team] = await db.select({ name: teams.name }).from(teams).where(eq(teams.id, teamId));
  if (!team) redirect("/dashboard");

  const [play] = await db
    .select({ id: plays.id, name: plays.name, canvas: plays.canvas, createdBy: plays.createdBy })
    .from(plays)
    .where(and(eq(plays.id, playId), eq(plays.teamId, teamId)));
  if (!play) redirect(`/dashboard/${teamId}/plays`);

  const canEdit = play.createdBy === user.id || myMember.isAdmin;

  return (
    <main className="page">
      <Link href={`/dashboard/${teamId}/plays`} className="back-link">← Plays</Link>

      <div className="page-hd mb-5">
        <h1>{play.name}</h1>
        <div className="flex gap-2">
          <form action={duplicatePlay.bind(null, play.id, teamId)}>
            <SubmitButton variant="outline" size="sm" pendingText="Copying…">Duplicate</SubmitButton>
          </form>
          {canEdit && (
            <form action={deletePlay.bind(null, play.id, teamId)}>
              <SubmitButton
                variant="destructive"
                size="sm"
                confirmText="Delete this play? This can't be undone."
                pendingText="Deleting…"
              >
                Delete
              </SubmitButton>
            </form>
          )}
        </div>
      </div>

      <PlayEditor
        playId={play.id}
        initialCanvas={play.canvas}
        canEdit={canEdit}
      />
    </main>
  );
}
