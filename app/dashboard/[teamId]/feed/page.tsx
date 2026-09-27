import { redirect } from "next/navigation";
import { eq, and, desc } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db/client";
import { teamMembers, announcements, announcementReads } from "@/db/schema";
import PostAnnouncementForm from "./PostAnnouncementForm";
import AnnouncementCard from "./AnnouncementCard";

export default async function FeedPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [myMember] = await db
    .select({ isAdmin: teamMembers.isAdmin })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, user.id)));
  if (!myMember) redirect("/dashboard");

  const [posts, reads] = await Promise.all([
    db
      .select()
      .from(announcements)
      .where(eq(announcements.teamId, teamId))
      .orderBy(desc(announcements.createdAt)),
    db
      .select()
      .from(announcementReads)
      .innerJoin(announcements, eq(announcements.id, announcementReads.announcementId))
      .where(eq(announcements.teamId, teamId)),
  ]);

  const readRows = reads.map((r) => r.announcement_reads);

  return (
    <main className="page-wide">
      <div className="page-hd">
        <h1>Feed</h1>
      </div>

      {myMember.isAdmin && <PostAnnouncementForm teamId={teamId} />}

      {posts.length === 0 ? (
        <p className="empty">No announcements yet.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {posts.map((p) => {
            const postReads = readRows.filter((r) => r.announcementId === p.id);
            return (
              <AnnouncementCard
                key={p.id}
                teamId={teamId}
                announcementId={p.id}
                title={p.title}
                body={p.body}
                createdAt={p.createdAt.toISOString()}
                pollOptions={p.pollOptions ? (JSON.parse(p.pollOptions) as string[]) : null}
                votes={postReads.filter((r) => r.vote !== null).map((r) => r.vote as number)}
                myVote={postReads.find((r) => r.userId === user.id)?.vote ?? null}
                seenCount={postReads.length}
                isAdmin={myMember.isAdmin}
              />
            );
          })}
        </div>
      )}
    </main>
  );
}
