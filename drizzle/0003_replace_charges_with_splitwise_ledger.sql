-- Applied directly via Supabase migration tool (drizzle-kit's local snapshot
-- is stale — see 0001 header). Replaces the Stripe-based charges/charge_members
-- tables with a Splitwise-style peer ledger: expenses + expense_shares +
-- settlements (pending until the counterparty confirms).

DROP TABLE IF EXISTS "charge_members" CASCADE;
DROP TABLE IF EXISTS "charges" CASCADE;
DROP TYPE IF EXISTS "public"."charge_payment_status";

CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
	"title" text NOT NULL,
	"paid_by_member_id" uuid NOT NULL REFERENCES "team_members"("id") ON DELETE CASCADE,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "expense_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expense_id" uuid NOT NULL REFERENCES "expenses"("id") ON DELETE CASCADE,
	"member_id" uuid NOT NULL REFERENCES "team_members"("id") ON DELETE CASCADE,
	"amount_cents" integer NOT NULL
);

CREATE TYPE "public"."settlement_status" AS ENUM('pending', 'confirmed', 'rejected');

CREATE TABLE "settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
	"from_member_id" uuid NOT NULL REFERENCES "team_members"("id") ON DELETE CASCADE,
	"to_member_id" uuid NOT NULL REFERENCES "team_members"("id") ON DELETE CASCADE,
	"amount_cents" integer NOT NULL,
	"status" "settlement_status" DEFAULT 'pending' NOT NULL,
	"proposed_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
