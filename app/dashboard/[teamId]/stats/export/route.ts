import { eq, and, isNull } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db/client";
import { teamMembers, profiles, games, points, pointStats } from "@/db/schema";
import { computeSeasonStats, buildStatsCsv, type StatLine } from "@/domain/stats";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const { teamId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const [myMember] = await db
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, user.id)));
  if (!myMember) return new Response("Forbidden", { status: 403 });

  const [roster, teamPoints, teamStats] = await Promise.all([
    db
      .select({ id: teamMembers.id, name: profiles.name, email: profiles.email })
      .from(teamMembers)
      .leftJoin(profiles, eq(profiles.id, teamMembers.userId))
      .where(and(eq(teamMembers.teamId, teamId), isNull(teamMembers.leftAt))),
    db
      .select({ scoredBy: points.scoredBy, linePlayerIds: points.linePlayerIds })
      .from(points)
      .innerJoin(games, eq(games.id, points.gameId))
      .where(eq(games.teamId, teamId)),
    db
      .select({ memberId: pointStats.memberId, type: pointStats.type })
      .from(pointStats)
      .innerJoin(points, eq(points.id, pointStats.pointId))
      .innerJoin(games, eq(games.id, points.gameId))
      .where(eq(games.teamId, teamId)),
  ]);

  const season = computeSeasonStats(
    teamPoints.map((p) => ({ scoredBy: p.scoredBy, linePlayerIds: JSON.parse(p.linePlayerIds) as string[] })),
    teamStats,
  );

  const empty: StatLine = { goals: 0, assists: 0, blocks: 0, turnovers: 0, plusMinus: 0 };
  const csv = buildStatsCsv(
    roster.map((m) => ({ name: m.name ?? m.email ?? "Member", ...(season[m.id] ?? empty) })),
  );

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="season-stats.csv"',
    },
  });
}
