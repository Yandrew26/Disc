import { describe, it, expect } from "vitest";
import { isStrongPassword } from "./auth";

describe("isStrongPassword", () => {
  it("accepts a password with upper, lower, number, and symbol", () => {
    expect(isStrongPassword("Abcdef1!")).toBe(true);
  });
  it("rejects passwords missing a required class or too short", () => {
    expect(isStrongPassword("abcdefg1!")).toBe(false); // no uppercase
    expect(isStrongPassword("ABCDEFG1!")).toBe(false); // no lowercase
    expect(isStrongPassword("Abcdefgh!")).toBe(false); // no number
    expect(isStrongPassword("Abcdefg1")).toBe(false);  // no symbol
    expect(isStrongPassword("Ab1!")).toBe(false);       // too short
  });
});
