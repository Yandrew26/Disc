"use server";

import { eq, and } from "drizzle-orm";
import { db } from "@/db/client";
import { pointStats, points, games } from "@/db/schema";
import { requireTeamMember } from "./_shared";

// pointId comes from the client, so ownership is re-checked server-side.
async function pointBelongsToTeam(pointId: string, teamId: string) {
  const [row] = await db
    .select({ id: points.id })
    .from(points)
    .innerJoin(games, eq(games.id, points.gameId))
    .where(and(eq(points.id, pointId), eq(games.teamId, teamId)));
  return !!row;
}

export async function tagPointStat(
  teamId: string,
  pointId: string,
  memberId: string,
  type: "goal" | "assist" | "block" | "turnover",
) {
  await requireTeamMember(teamId);
  if (!(await pointBelongsToTeam(pointId, teamId))) return;
  await db.insert(pointStats).values({ pointId, memberId, type });
}
