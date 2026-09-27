import { redirect } from "next/navigation";
import Link from "next/link";
import { eq, and, isNull } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db/client";
import { teamMembers, profiles, games, points, pointStats } from "@/db/schema";
import { computeSeasonStats, type StatLine } from "@/domain/stats";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

const SORT_KEYS = ["goals", "assists", "blocks", "turnovers", "plusMinus"] as const;
type SortKey = (typeof SORT_KEYS)[number];

export default async function StatsPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<{ sort?: string }>;
}) {
  const { teamId } = await params;
  const { sort } = await searchParams;
  const sortKey: SortKey = SORT_KEYS.includes(sort as SortKey) ? (sort as SortKey) : "goals";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [myMember] = await db
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, user.id)));
  if (!myMember) redirect("/dashboard");

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
  const rows = roster
    .map((m) => ({ id: m.id, name: m.name ?? m.email ?? "Member", ...(season[m.id] ?? empty) }))
    .sort((a, b) => b[sortKey] - a[sortKey]);

  const cols: { key: SortKey; label: string }[] = [
    { key: "goals", label: "G" },
    { key: "assists", label: "A" },
    { key: "blocks", label: "B" },
    { key: "turnovers", label: "T" },
    { key: "plusMinus", label: "+/−" },
  ];

  return (
    <main className="page-wide">
      <div className="page-hd">
        <h1>Stats</h1>
        <Button asChild variant="outline" size="sm">
          <a href={`/dashboard/${teamId}/stats/export`} download>Export CSV</a>
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="empty">No stats yet — record points in a live game first.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Player</TableHead>
              {cols.map((c) => (
                <TableHead key={c.key} className="text-right">
                  <Link
                    href={`/dashboard/${teamId}/stats?sort=${c.key}`}
                    className={cn(sortKey === c.key && "font-bold text-primary")}
                  >
                    {c.label}
                  </Link>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.name}</TableCell>
                {cols.map((c) => (
                  <TableCell key={c.key} className="text-right">{r[c.key]}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </main>
  );
}
