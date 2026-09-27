"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CalEvent = { id: string; title: string; type: string; startsAt: string };

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const CHIP: Record<string, string> = {
  practice: "bg-accent text-accent-foreground",
  game: "bg-maybe/15 text-maybe",
  tournament: "bg-decline/15 text-decline",
};

export default function CalendarView({ events, teamId }: { events: CalEvent[]; teamId: string }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  function prev() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }
  function next() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }

  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const byDay = new Map<number, CalEvent[]>();
  for (const e of events) {
    const d = new Date(e.startsAt);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day)!.push(e);
    }
  }

  const isToday = (day: number) =>
    now.getFullYear() === year && now.getMonth() === month && now.getDate() === day;

  const label = new Date(year, month).toLocaleDateString(undefined, {
    month: "long", year: "numeric",
  });

  return (
    <div className="mb-10">
      <div className="mb-3.5 flex items-center gap-2">
        <Button onClick={prev} variant="ghost" size="sm" aria-label="Previous month">‹</Button>
        <span className="flex-1 text-center text-[0.9375rem] font-semibold">{label}</span>
        <Button onClick={next} variant="ghost" size="sm" aria-label="Next month">›</Button>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border bg-border">
        {DOW.map(d => (
          <div key={d} className="bg-muted py-1.5 text-center text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
            {d}
          </div>
        ))}

        {Array.from({ length: firstDow }, (_, i) => (
          <div key={`e${i}`} className="min-h-[4.75rem] bg-muted" />
        ))}

        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const dayEvents = byDay.get(day) ?? [];
          return (
            <div key={day} className="flex min-h-[4.75rem] flex-col gap-1 bg-background p-1.5">
              <span
                className={cn(
                  "mb-0.5 flex size-[1.375rem] items-center justify-center self-start rounded-full text-xs font-medium leading-none text-muted-foreground",
                  isToday(day) && "bg-primary font-semibold text-primary-foreground",
                )}
              >
                {day}
              </span>
              {dayEvents.map(e => (
                <Link
                  key={e.id}
                  href={`/dashboard/${teamId}/events/${e.id}`}
                  className={cn(
                    "block overflow-hidden rounded-sm px-1.5 py-px text-[0.625rem] font-semibold text-ellipsis whitespace-nowrap leading-relaxed transition-opacity hover:opacity-75",
                    CHIP[e.type] ?? "bg-accent text-accent-foreground",
                  )}
                  title={e.title}
                >
                  {e.title}
                </Link>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
