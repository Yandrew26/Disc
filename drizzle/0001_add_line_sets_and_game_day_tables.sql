-- Applied directly via Supabase migration tool (drizzle-kit's local snapshot
-- was stale and would have dropped live tables — see session notes). This
-- file documents what was actually run against the database; it is not
-- wired into drizzle/meta/_journal.json. Run `npx drizzle-kit pull` to
-- resync the local snapshot with the live schema before using
-- `db:generate`/`db:migrate` again.

CREATE TYPE "public"."game_status" AS ENUM('in_progress', 'final');
CREATE TYPE "public"."point_side" AS ENUM('O', 'D');
CREATE TYPE "public"."point_scored_by" AS ENUM('us', 'them');
CREATE TYPE "public"."game_event_type" AS ENUM('timeout_us', 'timeout_them');

CREATE TABLE "line_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
	"name" text NOT NULL,
	"o_line" text DEFAULT '[]' NOT NULL,
	"d_line" text DEFAULT '[]' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
	"event_id" uuid REFERENCES "events"("id") ON DELETE SET NULL,
	"opponent_name" text NOT NULL,
	"our_score" integer DEFAULT 0 NOT NULL,
	"their_score" integer DEFAULT 0 NOT NULL,
	"status" "game_status" DEFAULT 'in_progress' NOT NULL,
	"created_by" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);

CREATE TABLE "points" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL REFERENCES "games"("id") ON DELETE CASCADE,
	"seq" integer NOT NULL,
	"side" "point_side" NOT NULL,
	"scored_by" "point_scored_by" NOT NULL,
	"our_score_after" integer NOT NULL,
	"their_score_after" integer NOT NULL,
	"line_player_ids" text NOT NULL,
	"played_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "game_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL REFERENCES "games"("id") ON DELETE CASCADE,
	"type" "game_event_type" NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
