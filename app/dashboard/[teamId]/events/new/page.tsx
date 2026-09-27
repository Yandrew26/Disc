"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createEvent } from "@/actions/event";
import SubmitButton from "@/app/dashboard/SubmitButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

export default function NewEventPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const [error, setError] = useState("");

  async function handleSubmit(formData: FormData) {
    formData.append("teamId", teamId);
    const result = await createEvent(formData);
    if (result?.error) setError(result.error);
  }

  return (
    <main className="page-narrow">
      <Link href={`/dashboard/${teamId}/events`} className="back-link">← Schedule</Link>
      <h1 className="mb-8">New event</h1>

      <form action={handleSubmit} className="grid gap-5">
        <div className="grid gap-1.5">
          <Label htmlFor="title">Title</Label>
          <Input id="title" name="title" type="text" required placeholder="Tuesday Practice" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="type">Type</Label>
          <NativeSelect id="type" name="type">
            <option value="practice">Practice</option>
            <option value="game">Game</option>
            <option value="tournament">Tournament</option>
          </NativeSelect>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="location">Location</Label>
          <Input id="location" name="location" type="text" placeholder="Riverside Park Field 3" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="startsAt">Start</Label>
          <Input id="startsAt" name="startsAt" type="datetime-local" required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="endsAt">End</Label>
          <Input id="endsAt" name="endsAt" type="datetime-local" required />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <SubmitButton pendingText="Creating…" className="justify-self-start">Create event</SubmitButton>
      </form>
    </main>
  );
}
