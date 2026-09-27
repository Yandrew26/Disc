import { describe, it, expect } from "vitest";
import { canManageTeam, canRsvp } from "./roles";

describe("permissions", () => {
  it("admin flag gates team management", () => {
    expect(canManageTeam(true)).toBe(true);
    expect(canManageTeam(false)).toBe(false);
  });
  it("any member can rsvp; non-members cannot", () => {
    expect(canRsvp(true)).toBe(true);
    expect(canRsvp(false)).toBe(false);
  });
});
