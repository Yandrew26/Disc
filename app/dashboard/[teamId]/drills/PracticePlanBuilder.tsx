"use client";

import { useState } from "react";
import { createPracticePlan } from "@/actions/development";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";

type AgendaItem = { drillId: string; minutes: number };

export default function PracticePlanBuilder({
  teamId,
  drills,
  practices,
}: {
  teamId: string;
  drills: { id: string; name: string }[];
  practices: { id: string; label: string }[];
}) {
  const [agenda, setAgenda] = useState<AgendaItem[]>([]);
  const [drillId, setDrillId] = useState("");
  const [minutes, setMinutes] = useState(10);

  const nameOf = new Map(drills.map((d) => [d.id, d.name]));

  function add() {
    if (!drillId) return;
    setAgenda((a) => [...a, { drillId, minutes }]);
    setDrillId("");
  }

  if (drills.length === 0) {
    return <p className="empty">Add drills first, then build a practice plan from them.</p>;
  }

  return (
    <form action={createPracticePlan} className="grid gap-2">
      <input type="hidden" name="teamId" value={teamId} />
      <input type="hidden" name="agenda" value={JSON.stringify(agenda)} />

      <div className="flex flex-wrap gap-2">
        <Input name="name" placeholder="Tuesday practice plan" required className="min-w-[160px] flex-2" />
        <NativeSelect name="eventId" defaultValue="" className="min-w-[160px] flex-2">
          <option value="">Not attached to a practice</option>
          {practices.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </NativeSelect>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect value={drillId} onChange={(e) => setDrillId(e.target.value)} className="min-w-[150px] flex-2">
          <option value="">Pick a drill…</option>
          {drills.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </NativeSelect>
        <Input
          type="number" min={1} max={120} value={minutes}
          onChange={(e) => setMinutes(Number(e.target.value))}
          className="w-20"
          aria-label="Minutes"
        />
        <Button type="button" variant="outline" size="sm" onClick={add} disabled={!drillId}>
          Add to plan
        </Button>
      </div>

      {agenda.length > 0 && (
        <ol className="flex list-decimal flex-col gap-1 pl-5">
          {agenda.map((a, i) => (
            <li key={i} className="text-sm">
              {nameOf.get(a.drillId)} — {a.minutes} min{" "}
              <button
                type="button"
                onClick={() => setAgenda((x) => x.filter((_, j) => j !== i))}
                className="cursor-pointer border-0 bg-transparent text-muted-foreground hover:text-foreground"
                aria-label={`Remove ${nameOf.get(a.drillId)}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ol>
      )}

      <Button type="submit" size="sm" className="justify-self-start" disabled={agenda.length === 0}>
        Save practice plan
      </Button>
    </form>
  );
}
