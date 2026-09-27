"use server";

import { redirect } from "next/navigation";
import { eq, and, isNull } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db/client";
import { teamMembers, profiles } from "@/db/schema";
import { isStrongPassword, PASSWORD_HINT } from "@/domain/auth";

export async function signInWithEmail(formData: FormData) {
  const supabase = await createClient();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  redirect("/dashboard");
}

export async function signUp(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;
  const name = (formData.get("name") as string | null)?.trim() || null;

  if (password !== confirmPassword) return { error: "Passwords don't match." };
  if (!isStrongPassword(password)) return { error: PASSWORD_HINT };

  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.signUp({ email, password });
  if (error) return { error: error.message };

  // Supabase returns a success response with no real user row (identities: [])
  // when the email is already registered, to avoid leaking which emails exist.
  // This app hit that as a crash: invited members (auth.users row created by
  // inviteUserByEmail) who used the sign-up form instead of their invite link
  // got a fake user id here, which then violated the team_members FK.
  if (user && user.identities?.length === 0) {
    return { error: "That email already has an account. Sign in instead, or use the link from your invite email to set a password." };
  }

  if (user) {
    await db.insert(profiles).values({ id: user.id, email, name }).onConflictDoNothing();
    await db.update(teamMembers)
      .set({ userId: user.id })
      .where(and(eq(teamMembers.inviteEmail, email), isNull(teamMembers.userId)));
  }

  return { message: "Check your email to confirm your account." };
}

export async function setPassword(formData: FormData) {
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (password !== confirmPassword) return { error: "Passwords don't match." };
  if (!isStrongPassword(password)) return { error: PASSWORD_HINT };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  await db.insert(profiles).values({ id: user.id, email: user.email }).onConflictDoNothing();
  await db.update(teamMembers)
    .set({ userId: user.id })
    .where(and(eq(teamMembers.inviteEmail, user.email!), isNull(teamMembers.userId)));

  redirect("/dashboard");
}

export async function resetPassword(formData: FormData) {
  const email = formData.get("email") as string;
  const supabase = await createClient();

  // Same landing flow as invite links — recovery also authenticates the
  // user via /auth/callback, which then sends them to set a new password.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl}/auth/callback?next=/auth/set-password`,
  });
  if (error) return { error: error.message };

  return { message: "Check your email for a password reset link." };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
