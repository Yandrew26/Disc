import { redirect } from "next/navigation";
import Link from "next/link";
import { eq, and, gte, asc } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db/client";
import { events, teamMembers } from "@/db/schema";
import CalendarView from "./CalendarView";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const TYPE_BADGE: Record<string, string> = {
  practice: "bg-accent text-accent-foreground",
  game: "bg-maybe/15 text-maybe",
  tournament: "bg-decline/15 text-decline",
};

function fmtDate(d: Date) {
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
function fmtTime(d: Date) {
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export default async function EventsPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [myMember] = await db
    .select({ isAdmin: teamMembers.isAdmin })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, user.id)));
  if (!myMember) redirect("/dashboard");

  const lookback = new Date();
  lookback.setMonth(lookback.getMonth() - 2);

  const allEvents = await db
    .select()
    .from(events)
    .where(and(eq(events.teamId, teamId), gte(events.startsAt, lookback)))
    .orderBy(asc(events.startsAt));

  const now = new Date();
  const upcoming = allEvents.filter((e) => e.startsAt >= now);

  const calEvents = allEvents.map((e) => ({
    id: e.id,
    title: e.title,
    type: e.type,
    startsAt: e.startsAt.toISOString(),
  }));

  const canManage = myMember.isAdmin;

  return (
    <main className="page-wide">
      <div className="page-hd">
        <h1>Schedule</h1>
        {canManage && (
          <Button asChild size="sm">
            <Link href={`/dashboard/${teamId}/events/new`}>+ New event</Link>
          </Button>
        )}
      </div>

      <CalendarView events={calEvents} teamId={teamId} />

      <h2 className="mb-3">Upcoming</h2>

      {upcoming.length === 0 ? (
        <p className="empty">
          No upcoming events.{canManage && " Add one above."}
        </p>
      ) : (
        <ul className="list">
          {upcoming.map((e) => (
            <li key={e.id} className="list-row">
              <Link href={`/dashboard/${teamId}/events/${e.id}`} className="list-item-body">
                <div className="flex items-center gap-2">
                  <Badge className={`uppercase ${TYPE_BADGE[e.type] ?? ""}`}>{e.type}</Badge>
                  <span className="list-item-title">{e.title}</span>
                </div>
                <span className="list-item-desc">
                  {fmtDate(e.startsAt)} · {fmtTime(e.startsAt)}
                  {e.location && <> · {e.location}</>}
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
