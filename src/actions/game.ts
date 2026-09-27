"use server";

import { redirect } from "next/navigation";
import { eq, and, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { games, points, gameEvents } from "@/db/schema";
import { requireTeamMember } from "./_shared";

export async function startGame(formData: FormData) {
  const teamId = formData.get("teamId") as string;
  const eventId = (formData.get("eventId") as string) || null;
  const opponentName = (formData.get("opponentName") as string)?.trim() || "Opponent";

  const { user } = await requireTeamMember(teamId);

  const [game] = await db
    .insert(games)
    .values({ teamId, eventId, opponentName, createdBy: user.id })
    .returning({ id: games.id });

  redirect(`/dashboard/${teamId}/games/${game.id}`);
}

export async function recordPoint(
  gameId: string,
  teamId: string,
  input: { side: "O" | "D"; scoredBy: "us" | "them"; linePlayerIds: string[] },
) {
  await requireTeamMember(teamId);

  const [game] = await db.select().from(games).where(and(eq(games.id, gameId), eq(games.teamId, teamId)));
  if (!game || game.status !== "in_progress") return;

  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(points)
    .where(eq(points.gameId, gameId));

  const ourScoreAfter = game.ourScore + (input.scoredBy === "us" ? 1 : 0);
  const theirScoreAfter = game.theirScore + (input.scoredBy === "them" ? 1 : 0);

  const [point] = await db.insert(points).values({
    gameId,
    seq: n + 1,
    side: input.side,
    scoredBy: input.scoredBy,
    ourScoreAfter,
    theirScoreAfter,
    linePlayerIds: JSON.stringify(input.linePlayerIds),
  }).returning({ id: points.id });

  await db.update(games).set({ ourScore: ourScoreAfter, theirScore: theirScoreAfter }).where(eq(games.id, gameId));

  return { pointId: point.id };
}

async function gameBelongsToTeam(gameId: string, teamId: string) {
  const [row] = await db.select({ id: games.id }).from(games).where(and(eq(games.id, gameId), eq(games.teamId, teamId)));
  return !!row;
}

export async function logTimeout(gameId: string, teamId: string, type: "timeout_us" | "timeout_them") {
  await requireTeamMember(teamId);
  if (!(await gameBelongsToTeam(gameId, teamId))) return;
  await db.insert(gameEvents).values({ gameId, type });
}

export async function endGame(gameId: string, teamId: string) {
  await requireTeamMember(teamId);
  if (!(await gameBelongsToTeam(gameId, teamId))) return;
  await db.update(games).set({ status: "final", endedAt: new Date() }).where(eq(games.id, gameId));
  redirect(`/dashboard/${teamId}/events`);
}
