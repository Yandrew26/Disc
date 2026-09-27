import { describe, it, expect } from "vitest";
import { checkGenderRatio, suggestSubs, DEFAULT_MIXED_RATIO } from "./lines";

describe("checkGenderRatio", () => {
  it("flags a line with too many of one gender", () => {
    const genders = ["f", "f", "f", "f", "f", "m", "m"];
    const result = checkGenderRatio(genders, DEFAULT_MIXED_RATIO);
    expect(result.valid).toBe(false);
    expect(result.counts.f).toBe(5);
    expect(result.message).toMatch(/max is 4/);
  });

  it("allows a line within the ratio", () => {
    const genders = ["f", "f", "f", "m", "m", "m", "m"];
    expect(checkGenderRatio(genders, DEFAULT_MIXED_RATIO).valid).toBe(true);
  });

  it("treats missing gender as its own bucket instead of crashing", () => {
    const genders = [null, null, "f", "f", "f", "m", "m"];
    const result = checkGenderRatio(genders, DEFAULT_MIXED_RATIO);
    expect(result.counts.unspecified).toBe(2);
    expect(result.valid).toBe(true);
  });
});

describe("suggestSubs", () => {
  it("surfaces the player with the longest active playing streak first", () => {
    const roster = ["a", "b", "c"];
    const history = [
      { seq: 1, linePlayerIds: ["a", "b"] },
      { seq: 2, linePlayerIds: ["a", "b"] },
      { seq: 3, linePlayerIds: ["a", "c"] }, // b rested at seq 3
    ];
    const order = suggestSubs(history, roster);
    expect(order[0]).toBe("a"); // played every point, never rested
  });

  it("returns the full roster even with no history yet", () => {
    const order = suggestSubs([], ["a", "b"]);
    expect(order).toEqual(expect.arrayContaining(["a", "b"]));
    expect(order).toHaveLength(2);
  });
});
