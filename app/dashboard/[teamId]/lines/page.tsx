import { redirect } from "next/navigation";
import { eq, and, desc, isNull } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db/client";
import { teamMembers, profiles, lineSets } from "@/db/schema";
import { deleteLineSet } from "@/actions/lineSet";
import LineBuilder from "./LineBuilder";
import { Button } from "@/components/ui/button";

export default async function LinesPage({
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

  const [roster, savedLineSets] = await Promise.all([
    db
      .select({
        id: teamMembers.id,
        name: profiles.name,
        email: profiles.email,
        gender: profiles.gender,
      })
      .from(teamMembers)
      .leftJoin(profiles, eq(profiles.id, teamMembers.userId))
      .where(and(eq(teamMembers.teamId, teamId), isNull(teamMembers.leftAt))),
    db
      .select()
      .from(lineSets)
      .where(eq(lineSets.teamId, teamId))
      .orderBy(desc(lineSets.createdAt)),
  ]);

  return (
    <main className="detail-layout">
      <div className="detail-main">
        <div className="page-hd">
          <h1>Lines</h1>
        </div>

        <LineBuilder
          teamId={teamId}
          roster={roster.map((m) => ({
            id: m.id,
            label: m.name ?? m.email ?? "Member",
            gender: m.gender,
          }))}
        />
      </div>

      <aside className="detail-panel">
        <div className="detail-panel-section">
          <h3>Saved line sets</h3>
          {savedLineSets.length === 0 ? (
            <p className="empty">No line sets yet — build one on the left.</p>
          ) : (
            <ul className="list m-0">
              {savedLineSets.map((ls) => {
                const oCount = (JSON.parse(ls.oLine) as string[]).length;
                const dCount = (JSON.parse(ls.dLine) as string[]).length;
                return (
                  <li key={ls.id} className="list-row items-center py-2">
                    <span>
                      <span className="list-item-title">{ls.name}</span>{" "}
                      <span className="list-item-desc">{oCount} O · {dCount} D</span>
                    </span>
                    <form action={deleteLineSet.bind(null, ls.id, teamId)}>
                      <Button type="submit" variant="ghost" size="sm">Delete</Button>
                    </form>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>
    </main>
  );
}
