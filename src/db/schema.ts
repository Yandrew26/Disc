import {
  pgTable, uuid, text, timestamp, pgEnum, primaryKey, date, boolean, integer,
} from "drizzle-orm/pg-core";

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  name: text("name"),
  email: text("email"),
  avatar: text("avatar"),
  phone: text("phone"),
  gender: text("gender"),
  dateOfBirth: date("date_of_birth"),
});

export const teams = pgTable("teams", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Per-team role catalogue — admin can add/rename/remove entries
export const teamRoles = pgTable("team_roles", {
  id: uuid("id").defaultRandom().primaryKey(),
  teamId: uuid("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
});

export const teamMembers = pgTable("team_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  teamId: uuid("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  userId: uuid("user_id"),
  isAdmin: boolean("is_admin").notNull().default(false),
  roleId: uuid("role_id").references(() => teamRoles.id, { onDelete: "set null" }),
  inviteToken: uuid("invite_token").defaultRandom().unique(),
  inviteEmail: text("invite_email"),
  invitedAt: timestamp("invited_at", { withTimezone: true }).defaultNow().notNull(),
  // null = active roster; set = archived "past player" (multi-season history)
  leftAt: timestamp("left_at", { withTimezone: true }),
});

export const eventType = pgEnum("event_type", ["practice", "game", "tournament"]);
export const rsvpStatus = pgEnum("rsvp_status", ["yes", "no", "maybe"]);

export const events = pgTable("events", {
  id: uuid("id").defaultRandom().primaryKey(),
  teamId: uuid("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  type: eventType("type").notNull().default("practice"),
  title: text("title").notNull(),
  location: text("location"),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  rrule: text("rrule"),
  createdBy: uuid("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const attendance = pgTable(
  "attendance",
  {
    eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    status: rsvpStatus("status").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.eventId, t.userId] }) }),
);

export const plays = pgTable("plays", {
  id: uuid("id").defaultRandom().primaryKey(),
  teamId: uuid("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  canvas: text("canvas").notNull().default("{}"),
  createdBy: uuid("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── line sets ──────────────────────────────────────────
export const lineSets = pgTable("line_sets", {
  id: uuid("id").defaultRandom().primaryKey(),
  teamId: uuid("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  // JSON array of team_members.id strings — same text-blob convention as plays.canvas
  oLine: text("o_line").notNull().default("[]"),
  dLine: text("d_line").notNull().default("[]"),
  createdBy: uuid("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── game-day tracking ─────────────────────────────────
export const gameStatus = pgEnum("game_status", ["in_progress", "final"]);
export const pointSide = pgEnum("point_side", ["O", "D"]);
export const pointScoredBy = pgEnum("point_scored_by", ["us", "them"]);
export const gameEventType = pgEnum("game_event_type", ["timeout_us", "timeout_them"]);

export const games = pgTable("games", {
  id: uuid("id").defaultRandom().primaryKey(),
  teamId: uuid("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  eventId: uuid("event_id").references(() => events.id, { onDelete: "set null" }),
  opponentName: text("opponent_name").notNull(),
  ourScore: integer("our_score").notNull().default(0),
  theirScore: integer("their_score").notNull().default(0),
  status: gameStatus("status").notNull().default("in_progress"),
  // free text: "Pool A", "Quarterfinal" — no bracket engine (tournament mode)
  poolOrBracket: text("pool_or_bracket"),
  createdBy: uuid("created_by").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
});

export const points = pgTable("points", {
  id: uuid("id").defaultRandom().primaryKey(),
  gameId: uuid("game_id").notNull().references(() => games.id, { onDelete: "cascade" }),
  seq: integer("seq").notNull(),
  side: pointSide("side").notNull(),
  scoredBy: pointScoredBy("scored_by").notNull(),
  ourScoreAfter: integer("our_score_after").notNull(),
  theirScoreAfter: integer("their_score_after").notNull(),
  // JSON array of team_members.id strings on the field for this point
  linePlayerIds: text("line_player_ids").notNull(),
  playedAt: timestamp("played_at", { withTimezone: true }).defaultNow().notNull(),
});

// Substitutions are implicit in the linePlayerIds diff between consecutive
// points — no separate subs table. Timeouts are the only in-game event that
// isn't already captured by a point row, so this table stays narrow.
export const gameEvents = pgTable("game_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  gameId: uuid("game_id").notNull().references(() => games.id, { onDelete: "cascade" }),
  type: gameEventType("type").notNull(),
  at: timestamp("at", { withTimezone: true }).defaultNow().notNull(),
});

// ── per-point player stats (Phase 2) ──────────────────
export const statType = pgEnum("stat_type", ["goal", "assist", "block", "turnover"]);

export const pointStats = pgTable("point_stats", {
  id: uuid("id").defaultRandom().primaryKey(),
  pointId: uuid("point_id").notNull().references(() => points.id, { onDelete: "cascade" }),
  memberId: uuid("member_id").notNull().references(() => teamMembers.id, { onDelete: "cascade" }),
  type: statType("type").notNull(),
});

// ── communication (Phase 3) ───────────────────────────
// A poll is an announcement with pollOptions; a vote is a read with a vote index.
export const announcements = pgTable("announcements", {
  id: uuid("id").defaultRandom().primaryKey(),
  teamId: uuid("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  title: text("title"),
  body: text("body").notNull(),
  // null = plain announcement; JSON array of option strings = poll
  pollOptions: text("poll_options"),
  createdBy: uuid("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const announcementReads = pgTable(
  "announcement_reads",
  {
    announcementId: uuid("announcement_id").notNull().references(() => announcements.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    // null = just read; integer = poll option index they voted for
    vote: integer("vote"),
    readAt: timestamp("read_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.announcementId, t.userId] }) }),
);

// ── payments & dues (Phase 4) ─────────────────────────
// Splitwise-style peer ledger: an expense is fronted by one member and owed
// by whichever members were picked (arbitrary per-person amounts, not forced
// even splits). Net balances are computed in src/domain/debt.ts and
// simplified into the fewest settle-up transactions.
export const expenses = pgTable("expenses", {
  id: uuid("id").defaultRandom().primaryKey(),
  teamId: uuid("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  title: text("title").notNull(), // "Regionals hotel", "Friday pizza"
  paidByMemberId: uuid("paid_by_member_id").notNull().references(() => teamMembers.id, { onDelete: "cascade" }),
  createdBy: uuid("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const expenseShares = pgTable("expense_shares", {
  id: uuid("id").defaultRandom().primaryKey(),
  expenseId: uuid("expense_id").notNull().references(() => expenses.id, { onDelete: "cascade" }),
  memberId: uuid("member_id").notNull().references(() => teamMembers.id, { onDelete: "cascade" }),
  amountCents: integer("amount_cents").notNull(),
});

// A settlement is a claimed real-world payment from one member to another.
// It only affects balances once BOTH sides have agreed: the proposer records
// it, the counterparty (the other member of the pair) confirms it.
export const settlementStatus = pgEnum("settlement_status", ["pending", "confirmed", "rejected"]);

export const settlements = pgTable("settlements", {
  id: uuid("id").defaultRandom().primaryKey(),
  teamId: uuid("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  fromMemberId: uuid("from_member_id").notNull().references(() => teamMembers.id, { onDelete: "cascade" }), // the payer (debtor)
  toMemberId: uuid("to_member_id").notNull().references(() => teamMembers.id, { onDelete: "cascade" }),     // the recipient (creditor)
  amountCents: integer("amount_cents").notNull(),
  status: settlementStatus("status").notNull().default("pending"),
  proposedBy: uuid("proposed_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

// ── tournament mode (Phase 5) ─────────────────────────
export const spiritScores = pgTable("spirit_scores", {
  gameId: uuid("game_id").notNull().references(() => games.id, { onDelete: "cascade" }).primaryKey(),
  // JSON: { rules, fouls, fairMindedness, attitude, communication } each 0-4 (WFDF categories)
  scores: text("scores").notNull(),
  notes: text("notes"),
});

export const carpools = pgTable("carpools", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  driverMemberId: uuid("driver_member_id").notNull().references(() => teamMembers.id, { onDelete: "cascade" }),
  seats: integer("seats").notNull(),
  note: text("note"), // "leaving 6am from the gym"
});

export const carpoolRiders = pgTable(
  "carpool_riders",
  {
    carpoolId: uuid("carpool_id").notNull().references(() => carpools.id, { onDelete: "cascade" }),
    memberId: uuid("member_id").notNull().references(() => teamMembers.id, { onDelete: "cascade" }),
  },
  (t) => ({ pk: primaryKey({ columns: [t.carpoolId, t.memberId] }) }),
);

// ── admin quality-of-life (Phase 6) ───────────────────
export const waivers = pgTable("waivers", {
  id: uuid("id").defaultRandom().primaryKey(),
  teamId: uuid("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  body: text("body").notNull(), // the liability text itself
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const waiverSignatures = pgTable(
  "waiver_signatures",
  {
    waiverId: uuid("waiver_id").notNull().references(() => waivers.id, { onDelete: "cascade" }),
    memberId: uuid("member_id").notNull().references(() => teamMembers.id, { onDelete: "cascade" }),
    signedName: text("signed_name").notNull(), // typed-name signature
    signedAt: timestamp("signed_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.waiverId, t.memberId] }) }),
);

// ── player development (Phase 7) ──────────────────────
export const drills = pgTable("drills", {
  id: uuid("id").defaultRandom().primaryKey(),
  teamId: uuid("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  tags: text("tags").notNull().default("[]"), // JSON string array: ["throwing","zone-o"]
  playId: uuid("play_id").references(() => plays.id, { onDelete: "set null" }), // optional canvas diagram
  createdBy: uuid("created_by").notNull(),
});

export const practicePlans = pgTable("practice_plans", {
  id: uuid("id").defaultRandom().primaryKey(),
  teamId: uuid("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  eventId: uuid("event_id").references(() => events.id, { onDelete: "set null" }), // attach to a practice
  name: text("name").notNull(),
  // JSON array of { drillId, minutes } — ordered agenda
  agenda: text("agenda").notNull().default("[]"),
  createdBy: uuid("created_by").notNull(),
});

// ── community & culture (Phase 8) ─────────────────────
export const shoutouts = pgTable("shoutouts", {
  id: uuid("id").defaultRandom().primaryKey(),
  teamId: uuid("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  memberId: uuid("member_id").notNull().references(() => teamMembers.id, { onDelete: "cascade" }),
  title: text("title").notNull(), // "Hustle Play of the Week"
  body: text("body"),
  createdBy: uuid("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const eventPhotos = pgTable("event_photos", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  storagePath: text("storage_path").notNull(), // Supabase Storage object path
  uploadedBy: uuid("uploaded_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
