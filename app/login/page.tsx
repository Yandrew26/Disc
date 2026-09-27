"use client";

import { useState } from "react";
import { signInWithEmail, signUp, resetPassword } from "@/actions/auth";
import { PASSWORD_HINT } from "@/domain/auth";
import SubmitButton from "@/app/dashboard/SubmitButton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type Mode = "signin" | "signup" | "forgot";

export default function LoginPage() {
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<Mode>("signin");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const mismatch = mode === "signup" && confirmPassword.length > 0 && password !== confirmPassword;

  async function handleAction(formData: FormData) {
    const result = mode === "signin" ? await signInWithEmail(formData)
      : mode === "signup" ? await signUp(formData)
      : await resetPassword(formData);
    if (result?.error) setMessage(result.error);
    else if (result && "message" in result) setMessage(result.message);
  }

  function switchMode(next: Mode) {
    setMode(next);
    setMessage("");
    setPassword("");
    setConfirmPassword("");
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-[380px]">
        <CardHeader className="text-center">
          <span className="block text-xl font-bold tracking-tight text-primary">Disc</span>
          <span className="block text-[0.8125rem] text-muted-foreground">Ultimate Team Manager</span>
          <p className="mt-4 text-[1.0625rem] font-semibold">
            {mode === "signin" ? "Sign in to your account" : mode === "signup" ? "Create an account" : "Reset your password"}
          </p>
        </CardHeader>

        <CardContent>
          <form action={handleAction} className="grid gap-5">
            {mode === "signup" && (
              <div className="grid gap-1.5">
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" type="text" placeholder="Your name" autoComplete="name" />
              </div>
            )}
            <div className="grid gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required placeholder="you@example.com" autoComplete="email" />
            </div>

            {mode !== "forgot" && (
              <div className="grid gap-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                />
                {mode === "signup" && (
                  <p className="text-[0.8125rem] text-muted-foreground">{PASSWORD_HINT}</p>
                )}
              </div>
            )}

            {mode === "signup" && (
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
            )}

            {mode === "signin" && (
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto justify-self-end p-0"
                onClick={() => switchMode("forgot")}
              >
                Forgot password?
              </Button>
            )}

            {message && <p className="text-sm text-destructive">{message}</p>}
            <SubmitButton
              pendingText={mode === "signin" ? "Signing in…" : mode === "signup" ? "Creating account…" : "Sending…"}
              disabled={mismatch}
            >
              {mode === "signin" ? "Sign in" : mode === "signup" ? "Sign up" : "Send reset link"}
            </SubmitButton>
          </form>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            {mode === "signin" && (
              <>Don&apos;t have an account?{" "}
                <Button variant="link" size="sm" className="h-auto p-0" onClick={() => switchMode("signup")}>
                  Sign up
                </Button>
              </>
            )}
            {mode === "signup" && (
              <>Already have an account?{" "}
                <Button variant="link" size="sm" className="h-auto p-0" onClick={() => switchMode("signin")}>
                  Sign in
                </Button>
              </>
            )}
            {mode === "forgot" && (
              <Button variant="link" size="sm" className="h-auto p-0" onClick={() => switchMode("signin")}>
                Back to sign in
              </Button>
            )}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
