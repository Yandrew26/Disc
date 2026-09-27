import { redirect } from "next/navigation";
import Link from "next/link";
import { eq, and, asc, isNull, inArray } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db/client";
import {
  events, teamMembers, attendance, profiles,
  games, spiritScores, carpools, carpoolRiders, practicePlans, drills, eventPhotos,
} from "@/db/schema";
import { deleteEvent } from "@/actions/event";
import { startGame } from "@/actions/game";
import { addTournamentGame, submitSpiritScore, offerCarpool, joinCarpool, leaveCarpool } from "@/actions/tournament";
import { spiritTotal, SPIRIT_CATEGORIES, type SpiritScores } from "@/domain/spirit";
import RsvpSection from "./RsvpSection";
import EventPhotos from "./EventPhotos";
import SubmitButton from "@/app/dashboard/SubmitButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";

const TYPE_BADGE: Record<string, string> = {
  practice: "bg-accent text-accent-foreground",
  game: "bg-maybe/15 text-maybe",
  tournament: "bg-decline/15 text-decline",
};

function fmtDt(d: Date) {
  return d.toLocaleString(undefined, {
    weekday: "long", month: "long", day: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ teamId: string; eventId: string }>;
}) {
  const { teamId, eventId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [myMember] = await db
    .select({ id: teamMembers.id, isAdmin: teamMembers.isAdmin })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, user.id)));
  if (!myMember) redirect("/dashboard");

  const [event] = await db.select().from(events).where(eq(events.id, eventId));
  if (!event) redirect(`/dashboard/${teamId}/events`);

  const [roster, eventGames, eventCarpools, plans, photos] = await Promise.all([
    db
      .select({ id: teamMembers.id, name: profiles.name, email: profiles.email })
      .from(teamMembers)
      .leftJoin(profiles, eq(profiles.id, teamMembers.userId))
      .where(and(eq(teamMembers.teamId, teamId), isNull(teamMembers.leftAt))),
    db.select().from(games).where(eq(games.eventId, eventId)).orderBy(asc(games.startedAt)),
    db.select().from(carpools).where(eq(carpools.eventId, eventId)),
    db.select().from(practicePlans).where(eq(practicePlans.eventId, eventId)),
    db.select().from(eventPhotos).where(eq(eventPhotos.eventId, eventId)),
  ]);

  const rosterName = new Map(roster.map((m) => [m.id, m.name ?? m.email ?? "Member"]));

  const [gameSpirits, riders, planDrills] = await Promise.all([
    eventGames.length
      ? db.select().from(spiritScores).where(inArray(spiritScores.gameId, eventGames.map((g) => g.id)))
      : Promise.resolve([]),
    eventCarpools.length
      ? db.select().from(carpoolRiders).where(inArray(carpoolRiders.carpoolId, eventCarpools.map((c) => c.id)))
      : Promise.resolve([]),
    plans.length
      ? db.select({ id: drills.id, name: drills.name, playId: drills.playId }).from(drills).where(eq(drills.teamId, teamId))
      : Promise.resolve([]),
  ]);

  const spiritByGame = new Map(gameSpirits.map((s) => [s.gameId, s]));
  const drillById = new Map(planDrills.map((d) => [d.id, d]));
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  const rsvps = await db
    .select({
      userId: attendance.userId,
      status: attendance.status,
      name: profiles.name,
      email: profiles.email,
    })
    .from(attendance)
    .leftJoin(profiles, eq(profiles.id, attendance.userId))
    .where(eq(attendance.eventId, eventId));

  const counts = {
    yes:   rsvps.filter((r) => r.status === "yes").length,
    no:    rsvps.filter((r) => r.status === "no").length,
    maybe: rsvps.filter((r) => r.status === "maybe").length,
  };
  const myRsvp = rsvps.find((r) => r.userId === user.id);

  const deleteWithIds = deleteEvent.bind(null, eventId, teamId);

  const mapsUrl = event.location
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`
    : null;

  const metaRows: [string, string][] = [
    ["Type",  event.type.charAt(0).toUpperCase() + event.type.slice(1)],
    ["Start", fmtDt(event.startsAt)],
    ["End",   fmtDt(event.endsAt)],
  ];

  const attendanceGroups = [
    { label: "Coming",  status: "yes"   as const },
    { label: "Late",    status: "maybe" as const },
    { label: "Absent",  status: "no"    as const },
  ];

  return (
    <main className="detail-layout">
      <div className="detail-main">
        <Link href={`/dashboard/${teamId}/events`} className="back-link">← Schedule</Link>

        <div className="mb-6 flex items-center gap-3">
          <Badge className={`uppercase ${TYPE_BADGE[event.type] ?? ""}`}>{event.type}</Badge>
          <h1 className="m-0">{event.title}</h1>
        </div>

        <RsvpSection
          eventId={eventId}
          myStatus={(myRsvp?.status ?? null) as "yes" | "no" | "maybe" | null}
          initialCounts={counts}
        />

      {event.type === "tournament" && (
        <>
          <Separator className="my-8" />
          <h2 className="mb-4">Tournament games</h2>

          {eventGames.length === 0 ? (
            <p className="empty">No games scheduled yet.</p>
          ) : (
            <ul className="list mb-4">
              {eventGames.map((g) => {
                const spirit = spiritByGame.get(g.id);
                return (
                  <li key={g.id} className="list-row flex-col items-stretch gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <Link href={`/dashboard/${teamId}/games/${g.id}`} className="flex-1">
                        <span className="list-item-title">
                          {g.poolOrBracket ? `${g.poolOrBracket} · ` : ""}vs {g.opponentName}
                        </span>{" "}
                        <span className="list-item-desc">
                          {g.status === "final" ? `Final ${g.ourScore}–${g.theirScore}` : `${g.ourScore}–${g.theirScore}`}
                        </span>
                      </Link>
                      {spirit && (
                        <Badge className="bg-accent text-accent-foreground">
                          Spirit {spiritTotal(JSON.parse(spirit.scores) as SpiritScores)}/20
                        </Badge>
                      )}
                    </div>
                    {g.status === "final" && !spirit && (
                      <form action={submitSpiritScore} className="flex flex-wrap items-end gap-1.5">
                        <input type="hidden" name="teamId" value={teamId} />
                        <input type="hidden" name="gameId" value={g.id} />
                        <input type="hidden" name="eventId" value={eventId} />
                        {SPIRIT_CATEGORIES.map((c) => (
                          <label key={c} className="flex flex-col gap-0.5 text-[0.7rem] font-semibold">
                            {c === "fairMindedness" ? "fair-minded" : c}
                            <NativeSelect name={c} defaultValue="2" className="w-16">
                              {[0, 1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
                            </NativeSelect>
                          </label>
                        ))}
                        <Button type="submit" variant="outline" size="sm">Save spirit score</Button>
                      </form>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {myMember.isAdmin && (
            <form action={addTournamentGame} className="mb-4 flex flex-wrap gap-2">
              <input type="hidden" name="teamId" value={teamId} />
              <input type="hidden" name="eventId" value={eventId} />
              <Input name="opponentName" placeholder="Opponent" required className="min-w-[140px] flex-2" />
              <Input name="poolOrBracket" placeholder="Pool A / Quarterfinal" className="min-w-[140px] flex-2" />
              <Button type="submit" size="sm">Add game</Button>
            </form>
          )}

          <Separator className="my-8" />
          <h2 className="mb-4">Carpools</h2>

          {eventCarpools.length === 0 ? (
            <p className="empty">No cars offered yet.</p>
          ) : (
            <ul className="list mb-4">
              {eventCarpools.map((car) => {
                const carRiders = riders.filter((r) => r.carpoolId === car.id);
                const iAmIn = carRiders.some((r) => r.memberId === myMember.id);
                const full = carRiders.length >= car.seats;
                return (
                  <li key={car.id} className="list-row flex-col items-start gap-1">
                    <div className="flex w-full items-center justify-between">
                      <span className="list-item-title">
                        {rosterName.get(car.driverMemberId) ?? "Driver"} — {carRiders.length}/{car.seats} seats
                      </span>
                      {iAmIn ? (
                        <form action={leaveCarpool.bind(null, teamId, eventId, car.id)}>
                          <Button type="submit" variant="ghost" size="sm">Leave</Button>
                        </form>
                      ) : (
                        <form action={joinCarpool.bind(null, teamId, eventId, car.id)}>
                          <Button type="submit" variant="outline" size="sm" disabled={full}>
                            {full ? "Full" : "Join"}
                          </Button>
                        </form>
                      )}
                    </div>
                    {car.note && <span className="list-item-desc">{car.note}</span>}
                    {carRiders.length > 0 && (
                      <span className="list-item-desc">
                        Riding: {carRiders.map((r) => rosterName.get(r.memberId) ?? "?").join(", ")}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <form action={offerCarpool} className="flex flex-wrap gap-2">
            <input type="hidden" name="teamId" value={teamId} />
            <input type="hidden" name="eventId" value={eventId} />
            <Input name="seats" type="number" min={1} max={12} placeholder="Seats" required className="w-22" />
            <Input name="note" placeholder="Leaving 6am from the gym" className="min-w-[160px] flex-1" />
            <Button type="submit" variant="outline" size="sm">Offer a car</Button>
          </form>
        </>
      )}

      {plans.length > 0 && (
        <>
          <Separator className="my-8" />
          <h2 className="mb-4">Practice plan</h2>
          {plans.map((plan) => {
            const agenda = JSON.parse(plan.agenda) as { drillId: string; minutes: number }[];
            return (
              <div key={plan.id} className="mb-4">
                <h3 className="mb-2">{plan.name}</h3>
                <ol className="list-decimal pl-5">
                  {agenda.map((a, i) => (
                    <li key={i} className="text-[0.9375rem]">
                      {drillById.get(a.drillId)?.name ?? "Drill"} — {a.minutes} min
                      {drillById.get(a.drillId)?.playId && (
                        <>
                          {" · "}
                          <Link href={`/dashboard/${teamId}/plays/${drillById.get(a.drillId)!.playId}`} className="text-primary">
                            diagram ↗
                          </Link>
                        </>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            );
          })}
        </>
      )}

      <Separator className="my-8" />
      <h2 className="mb-4">Photos</h2>
      <EventPhotos
        teamId={teamId}
        eventId={eventId}
        photos={photos.map((p) => ({
          id: p.id,
          url: `${supabaseUrl}/storage/v1/object/public/event-photos/${p.storagePath}`,
        }))}
      />

      {rsvps.length > 0 && (
        <>
          <Separator className="my-8" />
          <h2 className="mb-4">Attendance</h2>
          {attendanceGroups.map(({ label, status }) => {
            const group = rsvps.filter((r) => r.status === status);
            if (group.length === 0) return null;
            return (
              <div key={status} className="mb-5">
                <h3 className="mb-2 font-medium text-muted-foreground">
                  {label} · {group.length}
                </h3>
                <ul className="list mb-0">
                  {group.map((r) => (
                    <li key={r.userId} className="list-row py-2">
                      <span>{r.name ?? r.email ?? "Member"}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </>
      )}

      </div>

      <aside className="detail-panel">
        <div className="detail-panel-section">
          <h3>Details</h3>
          <table className="meta-table">
            <tbody>
              {metaRows.map(([label, value]) => (
                <tr key={label}>
                  <td>{label}</td>
                  <td>{value}</td>
                </tr>
              ))}
              {event.location && (
                <tr>
                  <td>Location</td>
                  <td>
                    {mapsUrl ? (
                      <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
                         className="text-primary underline">
                        {event.location}
                      </a>
                    ) : event.location}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {rsvps.length > 0 && (
          <div className="detail-panel-section">
            <h3>Attendance</h3>
            <div className="flex flex-col gap-1.5">
              {attendanceGroups.map(({ label, status }) => {
                const n = rsvps.filter((r) => r.status === status).length;
                if (n === 0) return null;
                return (
                  <div key={status} className="flex justify-between text-sm">
                    <span>{label}</span>
                    <span className="font-semibold">{n}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {(event.type === "game" || myMember.isAdmin) && (
          <div className="detail-panel-section flex flex-col gap-3">
            <h3>Actions</h3>

            {event.type === "game" && myMember.isAdmin && (
              <form action={startGame} className="flex flex-col gap-2">
                <input type="hidden" name="teamId" value={teamId} />
                <input type="hidden" name="eventId" value={eventId} />
                <Input name="opponentName" placeholder="Opponent name" className="w-full" />
                <Button type="submit" size="sm">Start Game</Button>
              </form>
            )}

            {myMember.isAdmin && (
              <form action={deleteWithIds}>
                <SubmitButton
                  variant="destructive"
                  size="sm"
                  confirmText="Delete this event? This can't be undone."
                  pendingText="Deleting…"
                >
                  Delete event
                </SubmitButton>
              </form>
            )}
          </div>
        )}
      </aside>
    </main>
  );
}
