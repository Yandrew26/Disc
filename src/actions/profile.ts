"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db/client";
import { profiles } from "@/db/schema";

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const trim = (k: string) => (formData.get(k) as string)?.trim() || null;

  await db.update(profiles).set({
    name:        trim("name"),
    phone:       trim("phone"),
    gender:      trim("gender"),
    dateOfBirth: trim("dateOfBirth"),
  }).where(eq(profiles.id, user.id));

  redirect("/dashboard");
}
