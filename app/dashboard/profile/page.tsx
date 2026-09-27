import { redirect } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db/client";
import { profiles } from "@/db/schema";
import { updateProfile } from "@/actions/profile";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [profile] = await db.select().from(profiles).where(eq(profiles.id, user.id));

  return (
    <main className="page-narrow">
      <Link href="/dashboard" className="back-link">← Teams</Link>
      <h1 className="mb-7">Your profile</h1>
      <form action={updateProfile} className="grid gap-5">
        <div className="grid gap-1.5">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" type="text" defaultValue={profile?.name ?? ""} placeholder="Your name" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" type="tel" defaultValue={profile?.phone ?? ""} placeholder="+1 555 000 0000" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="gender">Gender</Label>
          <Input id="gender" name="gender" type="text" defaultValue={profile?.gender ?? ""} placeholder="e.g. Female, Male, Non-binary" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="dateOfBirth">Date of birth</Label>
          <Input id="dateOfBirth" name="dateOfBirth" type="date" defaultValue={profile?.dateOfBirth ?? ""} />
        </div>
        <Button type="submit" className="justify-self-start">Save</Button>
      </form>
    </main>
  );
}
