"use client";

import { useState } from "react";
import { createLineSet } from "@/actions/lineSet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type RosterMember = { id: string; label: string; gender: string | null };
type Assignment = "none" | "O" | "D";

export default function LineBuilder({
  teamId,
  roster,
}: {
  teamId: string;
  roster: RosterMember[];
}) {
  const [name, setName] = useState("");
  const [assignments, setAssignments] = useState<Record<string, Assignment>>({});

  // ponytail: tap-to-cycle (none → O → D → none) instead of drag-and-drop.
  // Drag feels natural on paper but is slower and less reliable one-handed
  // on a phone sideline — upgrade to drag if captains ask for it.
  function cycle(id: string) {
    setAssignments((a) => {
      const current = a[id] ?? "none";
      const next: Assignment = current === "none" ? "O" : current === "O" ? "D" : "none";
      return { ...a, [id]: next };
    });
  }

  const oLine = roster.filter((m) => assignments[m.id] === "O").map((m) => m.id);
  const dLine = roster.filter((m) => assignments[m.id] === "D").map((m) => m.id);

  return (
    <form action={createLineSet} className="grid gap-3">
      <input type="hidden" name="teamId" value={teamId} />
      <input type="hidden" name="oLine" value={JSON.stringify(oLine)} />
      <input type="hidden" name="dLine" value={JSON.stringify(dLine)} />

      <Label htmlFor="line-set-name">Line set name</Label>
      <Input
        id="line-set-name"
        name="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Zone D"
        required
      />

      <p className="text-[0.8125rem] text-muted-foreground">Tap a player to cycle: none → O → D → none.</p>

      <div className="flex flex-col gap-1.5">
        {roster.map((m) => {
          const a = assignments[m.id] ?? "none";
          return (
            <button
              type="button"
              key={m.id}
              onClick={() => cycle(m.id)}
              className={cn(
                "flex cursor-pointer items-center justify-between rounded-md border-[1.5px] border-input bg-background px-3 py-2 text-sm transition-colors hover:border-primary",
                a === "O" && "border-blue-600 bg-blue-600/10",
                a === "D" && "border-red-600 bg-red-600/10",
              )}
            >
              <span>{m.label}</span>
              <span className="text-[0.7rem] font-bold tracking-wide text-muted-foreground">{a === "none" ? "—" : a}</span>
            </button>
          );
        })}
      </div>

      <Button type="submit" size="sm" className="justify-self-start" disabled={!oLine.length && !dLine.length}>
        Save line set
      </Button>
    </form>
  );
}
