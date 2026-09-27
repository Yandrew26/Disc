import { redirect } from "next/navigation";
import { eq, and, isNotNull, desc } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db/client";
import { teams, teamMembers, teamRoles, waivers, waiverSignatures, profiles } from "@/db/schema";
import { addTeamRole, updateTeamRole, deleteTeamRole } from "@/actions/teamRole";
import { createWaiver } from "@/actions/waiver";
import { restoreMember, importRosterCsv } from "@/actions/roster";
import SubmitButton from "@/app/dashboard/SubmitButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

export default async function SettingsPage({
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
  if (!myMember?.isAdmin) redirect(`/dashboard/${teamId}`);

  const [team] = await db.select({ name: teams.name }).from(teams).where(eq(teams.id, teamId));
  if (!team) redirect("/dashboard");

  const [roles, teamWaivers, signatures, pastPlayers] = await Promise.all([
    db
      .select({ id: teamRoles.id, name: teamRoles.name })
      .from(teamRoles)
      .where(eq(teamRoles.teamId, teamId)),
    db.select().from(waivers).where(eq(waivers.teamId, teamId)).orderBy(desc(waivers.createdAt)),
    db
      .select({ waiverId: waiverSignatures.waiverId, memberId: waiverSignatures.memberId, signedName: waiverSignatures.signedName })
      .from(waiverSignatures)
      .innerJoin(waivers, eq(waivers.id, waiverSignatures.waiverId))
      .where(eq(waivers.teamId, teamId)),
    db
      .select({ id: teamMembers.id, name: profiles.name, email: profiles.email, inviteEmail: teamMembers.inviteEmail })
      .from(teamMembers)
      .leftJoin(profiles, eq(profiles.id, teamMembers.userId))
      .where(and(eq(teamMembers.teamId, teamId), isNotNull(teamMembers.leftAt))),
  ]);

  const activeCount = await db
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(eq(teamMembers.teamId, teamId))
    .then((rows) => rows.length - pastPlayers.length);

  return (
    <main className="detail-layout">
      <div className="detail-main">
      <h1 className="mb-8">Settings</h1>

      <h2 id="roles" className="mb-4">Roles</h2>
      <p className="mb-6 text-[0.8125rem] text-muted-foreground">
        Roles are labels assigned to members. Admin is a separate permission.
      </p>

      {roles.length === 0 ? (
        <p className="empty">No roles yet.</p>
      ) : (
        <ul className="list mb-6">
          {roles.map((r) => (
            <li key={r.id} className="list-row">
              <form action={updateTeamRole} className="flex flex-1 items-center gap-2">
                <input type="hidden" name="teamId" value={teamId} />
                <input type="hidden" name="roleId" value={r.id} />
                <Input name="name" defaultValue={r.name} required className="flex-1" />
                <SubmitButton variant="outline" size="sm" pendingText="Saving…">Save</SubmitButton>
              </form>
              <form action={deleteTeamRole.bind(null, r.id, teamId)}>
                <SubmitButton
                  variant="destructive"
                  size="sm"
                  confirmText="Delete this role? Members with this role will lose it."
                  pendingText="Deleting…"
                >
                  Delete
                </SubmitButton>
              </form>
            </li>
          ))}
        </ul>
      )}

      <Separator className="my-8" />
      <h2 className="mb-4">Add role</h2>
      <form action={addTeamRole} className="grid max-w-[360px] gap-4">
        <input type="hidden" name="teamId" value={teamId} />
        <div className="grid gap-1.5">
          <Label htmlFor="name">Role name</Label>
          <Input id="name" name="name" required placeholder="e.g. Goalkeeper" />
        </div>
        <SubmitButton pendingText="Adding…" className="justify-self-start">Add role</SubmitButton>
      </form>

      <Separator className="my-8" />
      <h2 id="waivers" className="mb-4">Waivers</h2>

      {teamWaivers.length === 0 ? (
        <p className="empty">No waivers yet.</p>
      ) : (
        <ul className="list mb-6">
          {teamWaivers.map((w) => {
            const signed = signatures.filter((s) => s.waiverId === w.id);
            return (
              <li key={w.id} className="list-row flex-col items-start gap-1">
                <span className="list-item-title">{w.title}</span>
                <span className="list-item-desc">
                  {signed.length} of {activeCount} active members signed
                  {signed.length > 0 && ` — ${signed.map((s) => s.signedName).join(", ")}`}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <form action={createWaiver} className="mb-2 grid max-w-[440px] gap-2">
        <input type="hidden" name="teamId" value={teamId} />
        <Label htmlFor="waiver-title">New waiver</Label>
        <Input id="waiver-title" name="title" placeholder="2026 Season Liability Waiver" required />
        <Textarea name="body" rows={4} required placeholder="Paste the liability text here…" />
        <SubmitButton size="sm" pendingText="Creating…" className="justify-self-start">Create waiver</SubmitButton>
      </form>
      <p className="text-[0.8125rem] text-muted-foreground">Members sign from their team Overview page.</p>

      <Separator className="my-8" />
      <h2 id="past-players" className="mb-4">Past players</h2>

      {pastPlayers.length === 0 ? (
        <p className="empty">No archived players. Archive members from their profile page.</p>
      ) : (
        <ul className="list mb-6">
          {pastPlayers.map((m) => (
            <li key={m.id} className="list-row">
              <span>{m.name ?? m.email ?? m.inviteEmail ?? "Member"}</span>
              <form action={restoreMember.bind(null, teamId, m.id)}>
                <SubmitButton variant="outline" size="sm" pendingText="Restoring…">Restore</SubmitButton>
              </form>
            </li>
          ))}
        </ul>
      )}

      <Separator className="my-8" />
      <h2 id="import" className="mb-4">Import roster from CSV</h2>
      <form action={importRosterCsv} className="grid max-w-[440px] gap-2">
        <input type="hidden" name="teamId" value={teamId} />
        <Label htmlFor="csv-import">Paste rows from Google Sheets — one per line, format: name,email</Label>
        <Textarea id="csv-import" name="csv" rows={5} required
          placeholder={"Alex Chen,alex@example.com\nSam Lee,sam@example.com"} />
        <SubmitButton size="sm" pendingText="Importing…" className="justify-self-start">Import members</SubmitButton>
      </form>
      </div>

      <aside className="detail-panel">
        <div className="detail-panel-section">
          <h3>Jump to</h3>
          <div className="flex flex-col gap-1.5">
            <a href="#roles" className="text-sm hover:text-primary">Roles</a>
            <a href="#waivers" className="text-sm hover:text-primary">Waivers</a>
            <a href="#past-players" className="text-sm hover:text-primary">Past players</a>
            <a href="#import" className="text-sm hover:text-primary">Import roster</a>
          </div>
        </div>

        <div className="detail-panel-section">
          <h3>At a glance</h3>
          <table className="meta-table">
            <tbody>
              <tr><td>Active roster</td><td>{activeCount}</td></tr>
              <tr><td>Roles</td><td>{roles.length}</td></tr>
              <tr><td>Waivers</td><td>{teamWaivers.length}</td></tr>
              <tr><td>Past players</td><td>{pastPlayers.length}</td></tr>
            </tbody>
          </table>
        </div>
      </aside>
    </main>
  );
}
