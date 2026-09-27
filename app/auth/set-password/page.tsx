"use client";

import { useState } from "react";
import { setPassword } from "@/actions/auth";
import { PASSWORD_HINT } from "@/domain/auth";
import SubmitButton from "@/app/dashboard/SubmitButton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SetPasswordPage() {
  const [error, setError] = useState("");
  const [password, setPasswordValue] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const mismatch = confirmPassword.length > 0 && password !== confirmPassword;

  async function handleAction(formData: FormData) {
    const result = await setPassword(formData);
    if (result?.error) setError(result.error);
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-[380px]">
        <CardHeader className="text-center">
          <span className="block text-xl font-bold tracking-tight text-primary">Disc</span>
          <span className="block text-[0.8125rem] text-muted-foreground">Ultimate Team Manager</span>
          <p className="mt-4 text-[1.0625rem] font-semibold">Set your password</p>
        </CardHeader>

        <CardContent>
          <form action={handleAction} className="grid gap-5">
            <div className="grid gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPasswordValue(e.target.value)}
                autoComplete="new-password"
              />
              <p className="text-[0.8125rem] text-muted-foreground">{PASSWORD_HINT}</p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
              {mismatch && <p className="text-sm text-destructive">Passwords don&apos;t match.</p>}
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <SubmitButton pendingText="Saving…" disabled={mismatch}>Continue</SubmitButton>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
