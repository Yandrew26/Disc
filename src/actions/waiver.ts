"use server";

import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { db } from "@/db/client";
import { waivers, waiverSignatures } from "@/db/schema";
import { requireTeamMember, requireTeamAdmin } from "./_shared";

export async function createWaiver(formData: FormData) {
  const teamId = formData.get("teamId") as string;
  const title = (formData.get("title") as string)?.trim();
  const body = (formData.get("body") as string)?.trim();
  if (!title || !body) return;

  await requireTeamAdmin(teamId);
  await db.insert(waivers).values({ teamId, title, body });
  revalidatePath(`/dashboard/${teamId}/settings`);
}

export async function signWaiver(formData: FormData) {
  const teamId = formData.get("teamId") as string;
  const waiverId = formData.get("waiverId") as string;
  const signedName = (formData.get("signedName") as string)?.trim();
  if (!signedName) return;

  const { memberId } = await requireTeamMember(teamId);

  const [waiver] = await db
    .select({ id: waivers.id })
    .from(waivers)
    .where(and(eq(waivers.id, waiverId), eq(waivers.teamId, teamId)));
  if (!waiver) return;

  // First signature wins — a signed waiver is a record, not an editable field.
  await db
    .insert(waiverSignatures)
    .values({ waiverId, memberId, signedName })
    .onConflictDoNothing();
  revalidatePath(`/dashboard/${teamId}/settings`);
}
