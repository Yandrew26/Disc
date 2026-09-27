"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { markRead, vote } from "@/actions/announcement";
import { cn } from "@/lib/utils";

export default function AnnouncementCard({
  teamId,
  announcementId,
  title,
  body,
  createdAt,
  pollOptions,
  votes,
  myVote,
  seenCount,
  isAdmin,
}: {
  teamId: string;
  announcementId: string;
  title: string | null;
  body: string;
  createdAt: string;
  pollOptions: string[] | null;
  votes: number[];
  myVote: number | null;
  seenCount: number;
  isAdmin: boolean;
}) {
  const router = useRouter();

  // Read receipt: viewing the feed marks the announcement read.
  useEffect(() => {
    markRead(teamId, announcementId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [announcementId]);

  async function castVote(idx: number) {
    await vote(teamId, announcementId, idx);
    router.refresh();
  }

  const totalVotes = votes.length;

  return (
    <div className="flex flex-col gap-2.5 rounded-lg border px-4 py-3.5">
      {title && <h3 className="m-0">{title}</h3>}
      <p className="whitespace-pre-wrap">{body}</p>

      {pollOptions && (
        <div className="flex flex-col gap-1.5">
          {pollOptions.map((opt, idx) => {
            const count = votes.filter((v) => v === idx).length;
            const pct = totalVotes ? Math.round((count / totalVotes) * 100) : 0;
            const mine = myVote === idx;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => castVote(idx)}
                className={cn(
                  "relative cursor-pointer overflow-hidden rounded-md border-[1.5px] bg-background px-2.5 py-1.5 text-left text-sm transition-colors",
                  mine ? "border-primary" : "border-input hover:border-primary/60",
                )}
              >
                <span className="absolute inset-0 bg-accent" style={{ width: `${pct}%` }} />
                <span className="relative flex justify-between">
                  <span className={mine ? "font-semibold" : ""}>{opt}</span>
                  <span className="text-muted-foreground">{count}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{new Date(createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
        {isAdmin && <span>Seen by {seenCount}</span>}
      </div>
    </div>
  );
}
