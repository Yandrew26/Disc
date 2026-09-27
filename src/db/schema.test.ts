import { describe, it, expect } from "vitest";
import {
  teams, teamMembers, profiles, lineSets, games, points, gameEvents,
  pointStats, announcements, announcementReads, expenses, expenseShares, settlements,
  spiritScores, carpools, carpoolRiders, waivers, waiverSignatures,
  drills, practicePlans, shoutouts, eventPhotos,
} from "./schema";
import { getTableConfig } from "drizzle-orm/pg-core";

describe("schema", () => {
  it("teams has a name column", () => {
    const cols = getTableConfig(teams).columns.map((c) => c.name);
    expect(cols).toContain("name");
  });
  it("team_members links team, user and role", () => {
    const cols = getTableConfig(teamMembers).columns.map((c) => c.name);
    expect(cols).toEqual(expect.arrayContaining(["team_id", "user_id", "is_admin", "role_id"]));
  });
  it("profiles keyed by auth uid", () => {
    const cols = getTableConfig(profiles).columns.map((c) => c.name);
    expect(cols).toContain("id");
  });
});

describe("line-set and game schema", () => {
  it("line_sets stores o-line and d-line as text blobs", () => {
    const cols = getTableConfig(lineSets).columns.map((c) => c.name);
    expect(cols).toEqual(expect.arrayContaining(["team_id", "name", "o_line", "d_line"]));
  });
  it("games links a team and optionally an event", () => {
    const cols = getTableConfig(games).columns.map((c) => c.name);
    expect(cols).toEqual(expect.arrayContaining(["team_id", "event_id", "our_score", "their_score", "status"]));
  });
  it("points carries a per-point line snapshot", () => {
    const cols = getTableConfig(points).columns.map((c) => c.name);
    expect(cols).toEqual(expect.arrayContaining(["game_id", "seq", "side", "scored_by", "line_player_ids"]));
  });
  it("game_events records timeouts", () => {
    const cols = getTableConfig(gameEvents).columns.map((c) => c.name);
    expect(cols).toEqual(expect.arrayContaining(["game_id", "type", "at"]));
  });
});

describe("phase 2-8 schema", () => {
  it("point_stats links a point, a member, and a stat type", () => {
    const cols = getTableConfig(pointStats).columns.map((c) => c.name);
    expect(cols).toEqual(expect.arrayContaining(["point_id", "member_id", "type"]));
  });
  it("announcements double as polls; reads double as votes", () => {
    expect(getTableConfig(announcements).columns.map((c) => c.name)).toContain("poll_options");
    expect(getTableConfig(announcementReads).columns.map((c) => c.name)).toEqual(
      expect.arrayContaining(["announcement_id", "user_id", "vote"]),
    );
  });
  it("expenses are fronted by a member; expense_shares record who owes what", () => {
    expect(getTableConfig(expenses).columns.map((c) => c.name)).toEqual(
      expect.arrayContaining(["team_id", "title", "paid_by_member_id"]),
    );
    expect(getTableConfig(expenseShares).columns.map((c) => c.name)).toEqual(
      expect.arrayContaining(["expense_id", "member_id", "amount_cents"]),
    );
  });
  it("settlements track a claimed payment pending counterparty confirmation", () => {
    expect(getTableConfig(settlements).columns.map((c) => c.name)).toEqual(
      expect.arrayContaining(["from_member_id", "to_member_id", "amount_cents", "status"]),
    );
  });
  it("tournament tables: spirit scores keyed by game, carpools with riders", () => {
    expect(getTableConfig(spiritScores).columns.map((c) => c.name)).toEqual(
      expect.arrayContaining(["game_id", "scores"]),
    );
    expect(getTableConfig(carpools).columns.map((c) => c.name)).toEqual(
      expect.arrayContaining(["event_id", "driver_member_id", "seats"]),
    );
    expect(getTableConfig(carpoolRiders).columns.map((c) => c.name)).toEqual(
      expect.arrayContaining(["carpool_id", "member_id"]),
    );
  });
  it("waivers collect typed-name signatures", () => {
    expect(getTableConfig(waivers).columns.map((c) => c.name)).toContain("body");
    expect(getTableConfig(waiverSignatures).columns.map((c) => c.name)).toEqual(
      expect.arrayContaining(["waiver_id", "member_id", "signed_name"]),
    );
  });
  it("team_members supports season archiving via left_at", () => {
    expect(getTableConfig(teamMembers).columns.map((c) => c.name)).toContain("left_at");
  });
  it("player development: drills, practice plans", () => {
    expect(getTableConfig(drills).columns.map((c) => c.name)).toEqual(
      expect.arrayContaining(["name", "tags", "play_id"]),
    );
    expect(getTableConfig(practicePlans).columns.map((c) => c.name)).toEqual(
      expect.arrayContaining(["event_id", "agenda"]),
    );
  });
  it("community: shoutouts and event photos", () => {
    expect(getTableConfig(shoutouts).columns.map((c) => c.name)).toEqual(
      expect.arrayContaining(["member_id", "title"]),
    );
    expect(getTableConfig(eventPhotos).columns.map((c) => c.name)).toEqual(
      expect.arrayContaining(["event_id", "storage_path"]),
    );
  });
});
