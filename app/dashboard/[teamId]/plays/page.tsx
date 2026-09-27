import { redirect } from "next/navigation";
import Link from "next/link";
import { eq, and, desc } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db/client";
import { teams, teamMembers, plays } from "@/db/schema";
import { createPlay } from "@/actions/play";
import SubmitButton from "@/app/dashboard/SubmitButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export default async function PlaysPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;

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

  const teamPlays = await db
    .select({ id: plays.id, name: plays.name, createdAt: plays.createdAt })
    .from(plays)
    .where(eq(plays.teamId, teamId))
    .orderBy(desc(plays.createdAt));

  return (
    <main className="page-wide">
      <div className="page-hd">
        <h1>Plays</h1>
      </div>

      {teamPlays.length === 0 ? (
        <p className="empty">No plays yet. Draw your first one below.</p>
      ) : (
        <ul className="list mb-8">
          {teamPlays.map((p) => (
            <li key={p.id} className="list-row">
              <Link href={`/dashboard/${teamId}/plays/${p.id}`} className="list-item-body">
                <span className="list-item-title">{p.name}</span>
                <span className="list-item-desc">
                  {new Date(p.createdAt).toLocaleDateString()}
                </span>
              </Link>
              <span className="list-item-arrow">›</span>
            </li>
          ))}
        </ul>
      )}

      <Separator className="my-8" />
      <h2 className="mb-4">New play</h2>
      <form action={createPlay} className="grid max-w-[360px] gap-4">
        <input type="hidden" name="teamId" value={teamId} />
        <div className="grid gap-1.5">
          <Label htmlFor="name">Play name</Label>
          <Input id="name" name="name" required placeholder="e.g. Vert Stack Isolation" />
        </div>
        <SubmitButton pendingText="Creating…" className="justify-self-start">Create &amp; Edit</SubmitButton>
      </form>
    </main>
  );
}
