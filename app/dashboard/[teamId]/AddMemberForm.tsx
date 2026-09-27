"use client";

import { useState } from "react";
import { addTeamMember } from "@/actions/team";
import SubmitButton from "@/app/dashboard/SubmitButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

type Role = { id: string; name: string };

export default function AddMemberForm({
  teamId,
  roles,
}: {
  teamId: string;
  roles: Role[];
}) {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handle(formData: FormData) {
    formData.append("teamId", teamId);
    setError(""); setSuccess(false);
    const result = await addTeamMember(formData);
    if (result?.error) setError(result.error);
    else setSuccess(true);
  }

  return (
    <form action={handle} className="grid max-w-[360px] gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required placeholder="player@example.com" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="roleId">Role</Label>
        <NativeSelect id="roleId" name="roleId">
          <option value="">No role</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </NativeSelect>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="isAdmin">Permissions</Label>
        <NativeSelect id="isAdmin" name="isAdmin" defaultValue="">
          <option value="">Member</option>
          <option value="on">Admin</option>
        </NativeSelect>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && <p className="text-sm text-going">Member added.</p>}
      <SubmitButton pendingText="Adding…" className="justify-self-start">Add member</SubmitButton>
    </form>
  );
}
