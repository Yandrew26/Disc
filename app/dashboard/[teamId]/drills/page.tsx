import { redirect } from "next/navigation";
import Link from "next/link";
import { eq, and, gte, asc, desc } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db/client";
import { teamMembers, drills, practicePlans, plays, events } from "@/db/schema";
import { createDrill } from "@/actions/development";
import PracticePlanBuilder from "./PracticePlanBuilder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

export default async function DrillsPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<{ tag?: string }>;
}) {
  const { teamId } = await params;
  const { tag } = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [myMember] = await db
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, user.id)));
  if (!myMember) redirect("/dashboard");

  const [teamDrills, teamPlans, teamPlays, upcomingPractices] = await Promise.all([
    db.select().from(drills).where(eq(drills.teamId, teamId)),
    db.select().from(practicePlans).where(eq(practicePlans.teamId, teamId)).orderBy(desc(practicePlans.id)),
    db.select({ id: plays.id, name: plays.name }).from(plays).where(eq(plays.teamId, teamId)),
    db
      .select({ id: events.id, title: events.title, startsAt: events.startsAt })
      .from(events)
      .where(and(eq(events.teamId, teamId), eq(events.type, "practice"), gte(events.startsAt, new Date())))
      .orderBy(asc(events.startsAt)),
  ]);

  const parsed = teamDrills.map((d) => ({ ...d, tagList: JSON.parse(d.tags) as string[] }));
  const allTags = [...new Set(parsed.flatMap((d) => d.tagList))].sort();
  const visible = tag ? parsed.filter((d) => d.tagList.includes(tag)) : parsed;
  const playName = new Map(teamPlays.map((p) => [p.id, p.name]));
  const drillName = new Map(parsed.map((d) => [d.id, d.name]));

  return (
    <main className="page-wide">
      <div className="page-hd">
        <h1>Drills</h1>
      </div>

      <form action={createDrill} className="mb-6 grid gap-2">
        <input type="hidden" name="teamId" value={teamId} />
        <Label htmlFor="drill-name">Add a drill</Label>
        <div className="flex flex-wrap gap-2">
          <Input id="drill-name" name="name" placeholder="Endzone flow" required className="min-w-[150px] flex-2" />
          <Input name="tags" placeholder="tags: throwing, zone-o" className="min-w-[150px] flex-2" />
          <NativeSelect name="playId" defaultValue="" className="min-w-[130px] flex-1">
            <option value="">No diagram</option>
            {teamPlays.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </NativeSelect>
        </div>
        <Textarea name="description" rows={2} placeholder="Setup, reps, coaching points…" />
        <Button type="submit" size="sm" className="justify-self-start">Add drill</Button>
      </form>

      {allTags.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          <Button asChild variant={!tag ? "default" : "outline"} size="sm">
            <Link href={`/dashboard/${teamId}/drills`}>All</Link>
          </Button>
          {allTags.map((t) => (
            <Button key={t} asChild variant={tag === t ? "default" : "outline"} size="sm">
              <Link href={`/dashboard/${teamId}/drills?tag=${encodeURIComponent(t)}`}>{t}</Link>
            </Button>
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        <p className="empty">No drills yet — add one above.</p>
      ) : (
        <ul className="list mb-8">
          {visible.map((d) => (
            <li key={d.id} className="list-row flex-col items-start gap-1">
              <span className="list-item-title">
                {d.name}
                {d.playId && playName.has(d.playId) && (
                  <>
                    {" · "}
                    <Link href={`/dashboard/${teamId}/plays/${d.playId}`} className="text-primary">
                      {playName.get(d.playId)} ↗
                    </Link>
                  </>
                )}
              </span>
              {d.description && <span className="list-item-desc">{d.description}</span>}
              {d.tagList.length > 0 && (
                <span className="list-item-desc">{d.tagList.join(" · ")}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      <Separator className="my-8" />
      <h2 className="mb-3">Practice plans</h2>

      <PracticePlanBuilder
        teamId={teamId}
        drills={parsed.map((d) => ({ id: d.id, name: d.name }))}
        practices={upcomingPractices.map((p) => ({
          id: p.id,
          label: `${p.title} — ${p.startsAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`,
        }))}
      />

      {teamPlans.length > 0 && (
        <ul className="list mt-4">
          {teamPlans.map((plan) => {
            const agenda = JSON.parse(plan.agenda) as { drillId: string; minutes: number }[];
            const total = agenda.reduce((s, a) => s + a.minutes, 0);
            return (
              <li key={plan.id} className="list-row flex-col items-start gap-1">
                <span className="list-item-title">{plan.name} · {total} min</span>
                <span className="list-item-desc">
                  {agenda.map((a) => `${drillName.get(a.drillId) ?? "?"} (${a.minutes}m)`).join(" → ")}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
