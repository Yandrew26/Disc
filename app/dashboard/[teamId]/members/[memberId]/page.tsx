import { redirect } from "next/navigation";
import Link from "next/link";
import { eq, and } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db/client";
import { teamMembers, teamRoles, profiles } from "@/db/schema";
import { archiveMember } from "@/actions/roster";
import SubmitButton from "@/app/dashboard/SubmitButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function calcAge(dob: string): number {
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  if (now.getMonth() - birth.getMonth() < 0 ||
      (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age--;
  return age;
}

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ teamId: string; memberId: string }>;
}) {
  const { teamId, memberId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [myMember] = await db
    .select({ isAdmin: teamMembers.isAdmin })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, user.id)));
  if (!myMember) redirect("/dashboard");

  const [member] = await db
    .select({
      id: teamMembers.id,
      isAdmin: teamMembers.isAdmin,
      inviteEmail: teamMembers.inviteEmail,
      userId: teamMembers.userId,
      name: profiles.name,
      email: profiles.email,
      phone: profiles.phone,
      gender: profiles.gender,
      dateOfBirth: profiles.dateOfBirth,
      roleName: teamRoles.name,
    })
    .from(teamMembers)
    .leftJoin(profiles, eq(profiles.id, teamMembers.userId))
    .leftJoin(teamRoles, eq(teamRoles.id, teamMembers.roleId))
    .where(eq(teamMembers.id, memberId));

  if (!member) redirect(`/dashboard/${teamId}`);

  const displayName = member.name ?? member.email ?? member.inviteEmail ?? "Unknown";
  const displayEmail = member.email ?? member.inviteEmail;
  const isActive = !!member.userId;
  const isOwnProfile = member.userId === user.id;

  const roleLabel = member.roleName ?? (member.isAdmin ? "Admin" : "Member");

  const rows: [string, string][] = [
    ["Role",   roleLabel],
    ["Email",  displayEmail ?? "—"],
    ["Phone",  member.phone ?? "—"],
    ["Gender", member.gender ?? "—"],
    ["Age",    member.dateOfBirth ? String(calcAge(member.dateOfBirth)) : "—"],
    ["Status", isActive ? "Active member" : "Invitation pending"],
  ];

  return (
    <main className="detail-layout">
      <div className="detail-main">
        <Link href={`/dashboard/${teamId}`} className="back-link">← Team</Link>

        <div className="mb-7 flex items-center gap-3">
          {member.isAdmin && <Badge className="bg-decline/15 uppercase text-decline">admin</Badge>}
          {member.roleName && <Badge className="bg-accent uppercase text-accent-foreground">{member.roleName}</Badge>}
          <h1 className="m-0">{displayName}</h1>
        </div>

      </div>

      <aside className="detail-panel">
        <div className="detail-panel-section">
          <h3>Details</h3>
          <table className="meta-table">
            <tbody>
              {rows.map(([label, value]) => (
                <tr key={label}>
                  <td>{label}</td>
                  <td>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {(isOwnProfile || (myMember.isAdmin && !isOwnProfile)) && (
          <div className="detail-panel-section" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <h3>Actions</h3>
            {isOwnProfile && (
              <Button asChild variant="outline" size="sm">
                <Link href="/dashboard/profile">Edit your profile</Link>
              </Button>
            )}
            {myMember.isAdmin && !isOwnProfile && (
              <form action={archiveMember.bind(null, teamId, memberId)}>
                <SubmitButton
                  variant="destructive"
                  size="sm"
                  confirmText="Archive this player? They move to Past players in Settings and disappear from the active roster."
                  pendingText="Archiving…"
                >
                  Archive player
                </SubmitButton>
              </form>
            )}
          </div>
        )}
      </aside>
    </main>
  );
}
