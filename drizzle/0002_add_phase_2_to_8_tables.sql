-- Applied directly via Supabase migration tool (drizzle-kit's local snapshot
-- is stale — see 0001 header). Documents migrations `add_phase_2_to_8_tables`
-- and `add_event_photos_bucket`; not wired into drizzle/meta/_journal.json.

-- Phase 2: per-point player stats
CREATE TYPE "public"."stat_type" AS ENUM('goal', 'assist', 'block', 'turnover');
CREATE TABLE "point_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"point_id" uuid NOT NULL REFERENCES "points"("id") ON DELETE CASCADE,
	"member_id" uuid NOT NULL REFERENCES "team_members"("id") ON DELETE CASCADE,
	"type" "stat_type" NOT NULL
);

-- Phase 3: communication
CREATE TABLE "announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
	"body" text NOT NULL,
	"poll_options" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "announcement_reads" (
	"announcement_id" uuid NOT NULL REFERENCES "announcements"("id") ON DELETE CASCADE,
	"user_id" uuid NOT NULL,
	"vote" integer,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "announcement_reads_pk" PRIMARY KEY("announcement_id","user_id")
);

-- Phase 4: payments & dues
CREATE TYPE "public"."charge_payment_status" AS ENUM('unpaid', 'paid', 'waived');
CREATE TABLE "charges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
	"title" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "charge_members" (
	"charge_id" uuid NOT NULL REFERENCES "charges"("id") ON DELETE CASCADE,
	"member_id" uuid NOT NULL REFERENCES "team_members"("id") ON DELETE CASCADE,
	"status" "charge_payment_status" DEFAULT 'unpaid' NOT NULL,
	"stripe_session_id" text,
	"paid_at" timestamp with time zone,
	CONSTRAINT "charge_members_pk" PRIMARY KEY("charge_id","member_id")
);

-- Phase 5: tournament mode
ALTER TABLE "games" ADD COLUMN "pool_or_bracket" text;
CREATE TABLE "spirit_scores" (
	"game_id" uuid PRIMARY KEY REFERENCES "games"("id") ON DELETE CASCADE,
	"scores" text NOT NULL,
	"notes" text
);
CREATE TABLE "carpools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
	"driver_member_id" uuid NOT NULL REFERENCES "team_members"("id") ON DELETE CASCADE,
	"seats" integer NOT NULL,
	"note" text
);
CREATE TABLE "carpool_riders" (
	"carpool_id" uuid NOT NULL REFERENCES "carpools"("id") ON DELETE CASCADE,
	"member_id" uuid NOT NULL REFERENCES "team_members"("id") ON DELETE CASCADE,
	CONSTRAINT "carpool_riders_pk" PRIMARY KEY("carpool_id","member_id")
);

-- Phase 6: admin quality-of-life
ALTER TABLE "team_members" ADD COLUMN "left_at" timestamp with time zone;
CREATE TABLE "waivers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "waiver_signatures" (
	"waiver_id" uuid NOT NULL REFERENCES "waivers"("id") ON DELETE CASCADE,
	"member_id" uuid NOT NULL REFERENCES "team_members"("id") ON DELETE CASCADE,
	"signed_name" text NOT NULL,
	"signed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "waiver_signatures_pk" PRIMARY KEY("waiver_id","member_id")
);

-- Phase 7: player development
CREATE TABLE "skill_ratings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
	"member_id" uuid NOT NULL REFERENCES "team_members"("id") ON DELETE CASCADE,
	"ratings" text NOT NULL,
	"note" text,
	"rated_by" uuid NOT NULL,
	"rated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "drills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
	"name" text NOT NULL,
	"description" text,
	"tags" text DEFAULT '[]' NOT NULL,
	"play_id" uuid REFERENCES "plays"("id") ON DELETE SET NULL,
	"created_by" uuid NOT NULL
);
CREATE TABLE "practice_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
	"event_id" uuid REFERENCES "events"("id") ON DELETE SET NULL,
	"name" text NOT NULL,
	"agenda" text DEFAULT '[]' NOT NULL,
	"created_by" uuid NOT NULL
);

-- Phase 8: community & culture
CREATE TABLE "shoutouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
	"member_id" uuid NOT NULL REFERENCES "team_members"("id") ON DELETE CASCADE,
	"title" text NOT NULL,
	"body" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "event_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
	"storage_path" text NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Storage bucket for event photos (public read, authenticated upload)
insert into storage.buckets (id, name, public)
values ('event-photos', 'event-photos', true)
on conflict (id) do nothing;
create policy "authenticated upload event photos"
on storage.objects for insert to authenticated
with check (bucket_id = 'event-photos');
