import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db/client";
import { teams, teamMembers, teamRoles, profiles } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await Promise.all([
    db.insert(profiles).values({ id: user.id, email: user.email!, name: null }).onConflictDoNothing(),
    db.update(teamMembers)
      .set({ userId: user.id })
      .where(and(eq(teamMembers.inviteEmail, user.email!), isNull(teamMembers.userId))),
  ]);

  const userTeams = await db
    .select({
      id: teams.id,
      name: teams.name,
      isAdmin: teamMembers.isAdmin,
      roleName: teamRoles.name,
    })
    .from(teams)
    .innerJoin(teamMembers, eq(teamMembers.teamId, teams.id))
    .leftJoin(teamRoles, eq(teamRoles.id, teamMembers.roleId))
    .where(eq(teamMembers.userId, user.id));

  return (
    <main className="page">
      <div className="page-hd">
        <h1>Your teams</h1>
        <Button asChild size="sm">
          <Link href="/dashboard/new-team">+ New team</Link>
        </Button>
      </div>

      {userTeams.length === 0 ? (
        <p className="empty">You&apos;re not on any teams yet. Create one or wait for an invite.</p>
      ) : (
        <ul className="list">
          {userTeams.map((t) => (
            <li key={t.id} className="list-row">
              <Link href={`/dashboard/${t.id}`} className="list-item-body">
                <span className="list-item-title">{t.name}</span>
                <span className="list-item-desc">
                  {t.isAdmin ? "Admin" : (t.roleName ?? "Member")}
                </span>
              </Link>
              <span className="list-item-arrow">›</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
