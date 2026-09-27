import { redirect } from "next/navigation";
import Link from "next/link";
import { eq, and, isNull, desc } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db/client";
import { teams, teamMembers, teamRoles, profiles, shoutouts, waivers, waiverSignatures } from "@/db/schema";
import { giveShoutout } from "@/actions/community";
import { signWaiver } from "@/actions/waiver";
import AddMemberForm from "./AddMemberForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";

export default async function TeamPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [myMember] = await db
    .select({ id: teamMembers.id, isAdmin: teamMembers.isAdmin })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, user.id)));
  if (!myMember) redirect("/dashboard");

  const [team] = await db.select({ name: teams.name }).from(teams).where(eq(teams.id, teamId));
  if (!team) redirect("/dashboard");

  const [teamWaivers, mySignatures] = await Promise.all([
    db.select().from(waivers).where(eq(waivers.teamId, teamId)),
    db
      .select({ waiverId: waiverSignatures.waiverId })
      .from(waiverSignatures)
      .where(eq(waiverSignatures.memberId, myMember.id)),
  ]);
  const signedIds = new Set(mySignatures.map((s) => s.waiverId));
  const unsignedWaivers = teamWaivers.filter((w) => !signedIds.has(w.id));

  const [members, roles, recentShoutouts] = await Promise.all([
    db
      .select({
        id: teamMembers.id,
        isAdmin: teamMembers.isAdmin,
        inviteEmail: teamMembers.inviteEmail,
        name: profiles.name,
        profileEmail: profiles.email,
        roleName: teamRoles.name,
      })
      .from(teamMembers)
      .leftJoin(profiles, eq(profiles.id, teamMembers.userId))
      .leftJoin(teamRoles, eq(teamRoles.id, teamMembers.roleId))
      .where(and(eq(teamMembers.teamId, teamId), isNull(teamMembers.leftAt))),
    db.select({ id: teamRoles.id, name: teamRoles.name })
      .from(teamRoles)
      .where(eq(teamRoles.teamId, teamId)),
    db.select()
      .from(shoutouts)
      .where(eq(shoutouts.teamId, teamId))
      .orderBy(desc(shoutouts.createdAt))
      .limit(5),
  ]);

  const memberName = new Map(
    members.map((m) => [m.id, m.name ?? m.profileEmail ?? m.inviteEmail ?? "Member"]),
  );

  const roleCounts = new Map<string, number>();
  for (const m of members) {
    const label = m.roleName ?? (m.isAdmin ? "Admin" : "No role");
    roleCounts.set(label, (roleCounts.get(label) ?? 0) + 1);
  }

  return (
    <main className="detail-layout">
      <div className="detail-main">
        <div className="page-hd">
          <h1>{team.name}</h1>
        </div>

        {unsignedWaivers.length > 0 && (
          <div className="mb-8 flex flex-col gap-4">
            {unsignedWaivers.map((w) => (
              <div key={w.id} className="rounded-lg border-[1.5px] border-maybe p-4">
                <h3 className="mb-2">Waiver needs your signature: {w.title}</h3>
                <p className="mb-3 text-[0.8125rem] whitespace-pre-wrap text-muted-foreground">{w.body}</p>
                <form action={signWaiver} className="flex flex-wrap gap-2">
                  <input type="hidden" name="teamId" value={teamId} />
                  <input type="hidden" name="waiverId" value={w.id} />
                  <Input name="signedName" placeholder="Type your full name to sign" required className="min-w-[200px] flex-1" />
                  <Button type="submit" size="sm">Sign</Button>
                </form>
              </div>
            ))}
          </div>
        )}

        <h2 className="mb-3">Members</h2>

        {members.length === 0 ? (
          <p className="empty">No members yet.</p>
        ) : (
          <ul className="list">
            {members.map((m) => (
              <li key={m.id} className="list-row py-2">
                {/* One compact line per member: name · badges · email (right, truncates) */}
                <Link href={`/dashboard/${teamId}/members/${m.id}`} className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="list-item-title shrink-0">{m.name ?? m.profileEmail ?? m.inviteEmail ?? "Invited"}</span>
                  {m.isAdmin && <Badge className="shrink-0 bg-decline/15 uppercase text-decline">admin</Badge>}
                  {m.roleName && <Badge className="shrink-0 bg-accent uppercase text-accent-foreground">{m.roleName}</Badge>}
                  {m.name && (m.profileEmail ?? m.inviteEmail) && (
                    <span className="list-item-desc ml-auto truncate">{m.profileEmail ?? m.inviteEmail}</span>
                  )}
                </Link>
                <span className="list-item-arrow">›</span>
              </li>
            ))}
          </ul>
        )}

        <Separator className="my-8" />
        <h2 className="mb-3">Shoutouts</h2>

        {recentShoutouts.length === 0 ? (
          <p className="empty">No shoutouts yet — celebrate someone below.</p>
        ) : (
          <ul className="list mb-4">
            {recentShoutouts.map((s) => (
              <li key={s.id} className="list-row flex-col items-start gap-0.5">
                <span className="list-item-title">
                  {s.title} — {memberName.get(s.memberId) ?? "Past player"}
                </span>
                {s.body && <span className="list-item-desc">{s.body}</span>}
              </li>
            ))}
          </ul>
        )}

        <form action={giveShoutout} className="grid max-w-[440px] gap-2">
          <input type="hidden" name="teamId" value={teamId} />
          <div className="flex flex-wrap gap-2">
            <NativeSelect name="memberId" required defaultValue="" className="min-w-[140px] flex-1">
              <option value="" disabled>Who?</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{memberName.get(m.id)}</option>
              ))}
            </NativeSelect>
            <Input name="title" placeholder="Hustle Play of the Week" required className="min-w-[170px] flex-2" />
          </div>
          <Input name="body" placeholder="What happened? (optional)" />
          <Button type="submit" variant="outline" size="sm" className="justify-self-start">
            Give shoutout
          </Button>
        </form>
      </div>

      <aside className="detail-panel">
        <div className="rounded-xl border bg-muted/50 px-5 py-4">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Roster</h3>
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-sm">
              <span>Active members</span>
              <span className="font-semibold">{members.length}</span>
            </div>
            {[...roleCounts.entries()].map(([label, n]) => (
              <div key={label} className="flex justify-between text-sm text-muted-foreground">
                <span>{label}</span>
                <span>{n}</span>
              </div>
            ))}
          </div>
        </div>

        {myMember.isAdmin && (
          <div className="rounded-xl border bg-muted/50 px-5 py-4">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Add member</h3>
            <AddMemberForm teamId={teamId} roles={roles} />
          </div>
        )}
      </aside>
    </main>
  );
}
