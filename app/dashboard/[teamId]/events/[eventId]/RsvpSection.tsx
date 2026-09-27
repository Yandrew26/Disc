"use client";

import { useState, useEffect, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { upsertRsvp } from "@/actions/rsvp";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Status = "yes" | "no" | "maybe";

interface Props {
  eventId: string;
  myStatus: Status | null;
  initialCounts: { yes: number; no: number; maybe: number };
}

const RSVP_STYLES: Record<Status, { idle: string; active: string }> = {
  yes:   { idle: "border-2 border-going text-going hover:bg-going hover:text-white",     active: "border-2 border-going bg-going text-white hover:bg-going" },
  maybe: { idle: "border-2 border-maybe text-maybe hover:bg-maybe hover:text-white",     active: "border-2 border-maybe bg-maybe text-white hover:bg-maybe" },
  no:    { idle: "border-2 border-decline text-decline hover:bg-decline hover:text-white", active: "border-2 border-decline bg-decline text-white hover:bg-decline" },
};

export default function RsvpSection({ eventId, myStatus, initialCounts }: Props) {
  const [current, setCurrent] = useState<Status | null>(myStatus);
  const [counts, setCounts] = useState(initialCounts);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`attendance:${eventId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance", filter: `event_id=eq.${eventId}` },
        () => {
          supabase
            .from("attendance")
            .select("status")
            .eq("event_id", eventId)
            .then(({ data }) => {
              if (!data) return;
              setCounts({
                yes:   data.filter((r) => r.status === "yes").length,
                no:    data.filter((r) => r.status === "no").length,
                maybe: data.filter((r) => r.status === "maybe").length,
              });
            });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [eventId]);

  function rsvp(status: Status) {
    setCurrent(status);
    startTransition(() => upsertRsvp(eventId, status));
  }

  const options: { status: Status; label: string }[] = [
    { status: "yes", label: "Coming" },
    { status: "maybe", label: "Late" },
    { status: "no", label: "Absent" },
  ];

  return (
    <div className="mt-9 border-t pt-8">
      <h2 className="mb-4">RSVP</h2>
      <div className="mb-3.5 grid grid-cols-3 gap-2">
        {options.map(({ status, label }) => (
          <Button
            key={status}
            variant="outline"
            className={cn(
              "h-11 bg-transparent",
              current === status ? RSVP_STYLES[status].active : RSVP_STYLES[status].idle,
            )}
            disabled={pending}
            onClick={() => rsvp(status)}
          >
            {label}
          </Button>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        {counts.yes} coming · {counts.maybe} late · {counts.no} absent
      </p>
    </div>
  );
}
