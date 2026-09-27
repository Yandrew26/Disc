"use server";

import { revalidatePath } from "next/cache";
import { eq, and, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { games, spiritScores, carpools, carpoolRiders, events } from "@/db/schema";
import { requireTeamMember, requireTeamAdmin } from "./_shared";
import { SPIRIT_CATEGORIES, type SpiritScores } from "@/domain/spirit";

export async function addTournamentGame(formData: FormData) {
  const teamId = formData.get("teamId") as string;
  const eventId = formData.get("eventId") as string;
  const opponentName = (formData.get("opponentName") as string)?.trim();
  const poolOrBracket = (formData.get("poolOrBracket") as string)?.trim() || null;
  if (!opponentName) return;

  const { user } = await requireTeamAdmin(teamId);

  const [event] = await db
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.id, eventId), eq(events.teamId, teamId)));
  if (!event) return;

  await db.insert(games).values({ teamId, eventId, opponentName, poolOrBracket, createdBy: user.id });
  revalidatePath(`/dashboard/${teamId}/events/${eventId}`);
}

export async function submitSpiritScore(formData: FormData) {
  const teamId = formData.get("teamId") as string;
  const gameId = formData.get("gameId") as string;
  const eventId = formData.get("eventId") as string;
  const notes = (formData.get("notes") as string)?.trim() || null;

  await requireTeamMember(teamId);

  const [game] = await db
    .select({ id: games.id })
    .from(games)
    .where(and(eq(games.id, gameId), eq(games.teamId, teamId)));
  if (!game) return;

  const scores = {} as SpiritScores;
  for (const c of SPIRIT_CATEGORIES) {
    const v = Number(formData.get(c));
    scores[c] = Number.isFinite(v) ? Math.min(4, Math.max(0, Math.round(v))) : 0;
  }

  await db
    .insert(spiritScores)
    .values({ gameId, scores: JSON.stringify(scores), notes })
    .onConflictDoUpdate({ target: spiritScores.gameId, set: { scores: JSON.stringify(scores), notes } });
  revalidatePath(`/dashboard/${teamId}/events/${eventId}`);
}

export async function offerCarpool(formData: FormData) {
  const teamId = formData.get("teamId") as string;
  const eventId = formData.get("eventId") as string;
  const seats = Number(formData.get("seats"));
  const note = (formData.get("note") as string)?.trim() || null;
  if (!Number.isInteger(seats) || seats < 1 || seats > 12) return;

  const { memberId } = await requireTeamMember(teamId);

  const [event] = await db
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.id, eventId), eq(events.teamId, teamId)));
  if (!event) return;

  await db.insert(carpools).values({ eventId, driverMemberId: memberId, seats, note });
  revalidatePath(`/dashboard/${teamId}/events/${eventId}`);
}

export async function joinCarpool(teamId: string, eventId: string, carpoolId: string) {
  const { memberId } = await requireTeamMember(teamId);

  const [car] = await db.select().from(carpools).where(eq(carpools.id, carpoolId));
  if (!car || car.eventId !== eventId) return;

  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(carpoolRiders)
    .where(eq(carpoolRiders.carpoolId, carpoolId));
  if (n >= car.seats) return; // ponytail: read-then-insert race is fine at club scale

  await db.insert(carpoolRiders).values({ carpoolId, memberId }).onConflictDoNothing();
  revalidatePath(`/dashboard/${teamId}/events/${eventId}`);
}

export async function leaveCarpool(teamId: string, eventId: string, carpoolId: string) {
  const { memberId } = await requireTeamMember(teamId);
  await db
    .delete(carpoolRiders)
    .where(and(eq(carpoolRiders.carpoolId, carpoolId), eq(carpoolRiders.memberId, memberId)));
  revalidatePath(`/dashboard/${teamId}/events/${eventId}`);
}
