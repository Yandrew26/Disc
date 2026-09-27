import { redirect } from "next/navigation";
import Link from "next/link";
import { eq, and, asc, isNull } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db/client";
import { teamMembers, profiles, games, points, lineSets, gameEvents } from "@/db/schema";
import GameLive from "./GameLive";

export default async function GamePage({
  params,
}: {
  params: Promise<{ teamId: string; gameId: string }>;
}) {
  const { teamId, gameId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [myMember] = await db
    .select({ isAdmin: teamMembers.isAdmin })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, user.id)));
  if (!myMember) redirect("/dashboard");

  const [game] = await db.select().from(games).where(eq(games.id, gameId));
  if (!game) redirect(`/dashboard/${teamId}/events`);

  const [roster, pointHistory, savedLineSets, timeoutRows] = await Promise.all([
    db
      .select({ id: teamMembers.id, name: profiles.name, email: profiles.email, gender: profiles.gender })
      .from(teamMembers)
      .leftJoin(profiles, eq(profiles.id, teamMembers.userId))
      .where(and(eq(teamMembers.teamId, teamId), isNull(teamMembers.leftAt))),
    db.select().from(points).where(eq(points.gameId, gameId)).orderBy(asc(points.seq)),
    db.select().from(lineSets).where(eq(lineSets.teamId, teamId)),
    db.select().from(gameEvents).where(eq(gameEvents.gameId, gameId)).orderBy(asc(gameEvents.at)),
  ]);

  const usTimeouts = timeoutRows.filter((t) => t.type === "timeout_us").length;
  const themTimeouts = timeoutRows.filter((t) => t.type === "timeout_them").length;

  return (
    <main className="detail-layout">
      <div className="detail-main">
        <Link href={`/dashboard/${teamId}/events`} className="back-link">← Schedule</Link>
        <div className="page-hd">
          <h1>vs {game.opponentName}</h1>
        </div>

        <GameLive
          teamId={teamId}
          gameId={gameId}
          status={game.status}
          ourScore={game.ourScore}
          theirScore={game.theirScore}
          roster={roster.map((m) => ({ id: m.id, label: m.name ?? m.email ?? "Member", gender: m.gender }))}
          pointHistory={pointHistory.map((p) => ({
            seq: p.seq,
            side: p.side,
            scoredBy: p.scoredBy,
            linePlayerIds: JSON.parse(p.linePlayerIds) as string[],
          }))}
          savedLineSets={savedLineSets.map((ls) => ({
            id: ls.id,
            name: ls.name,
            oLine: JSON.parse(ls.oLine) as string[],
            dLine: JSON.parse(ls.dLine) as string[],
          }))}
          timeouts={timeoutRows.map((t) => ({ type: t.type, at: t.at.toISOString() }))}
        />
      </div>

      <aside className="detail-panel">
        <div className="detail-panel-section">
          <h3>Game</h3>
          <table className="meta-table">
            <tbody>
              <tr><td>Status</td><td>{game.status === "final" ? "Final" : "In progress"}</td></tr>
              <tr><td>Started</td><td>{game.startedAt.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</td></tr>
              {game.poolOrBracket && <tr><td>Round</td><td>{game.poolOrBracket}</td></tr>}
              <tr><td>Timeouts</td><td>Us {usTimeouts} · Them {themTimeouts}</td></tr>
              <tr><td>Roster</td><td>{roster.length} active</td></tr>
            </tbody>
          </table>
        </div>
      </aside>
    </main>
  );
}
