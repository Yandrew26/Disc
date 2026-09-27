"use client";

import { useState } from "react";
import Link from "next/link";
import { createTeam } from "@/actions/team";
import SubmitButton from "@/app/dashboard/SubmitButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function NewTeamPage() {
  const [error, setError] = useState("");

  async function handleSubmit(formData: FormData) {
    const result = await createTeam(formData);
    if (result?.error) setError(result.error);
  }

  return (
    <main className="page-narrow">
      <Link href="/dashboard" className="back-link">← Teams</Link>
      <h1 className="mb-8">New team</h1>

      <form action={handleSubmit} className="grid gap-5">
        <div className="grid gap-1.5">
          <Label htmlFor="name">Team name</Label>
          <Input id="name" name="name" type="text" required placeholder="Mixed Open" />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <SubmitButton pendingText="Creating…" className="justify-self-start">Create team</SubmitButton>
      </form>
    </main>
  );
}
